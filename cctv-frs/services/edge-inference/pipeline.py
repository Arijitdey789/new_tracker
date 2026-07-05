"""
Pipeline — Frame processing pipeline for the Edge AI Node.

Orchestrates: Camera Capture → Face Detection → Embedding → FaceEvent → Matching.

Runs as a background async task, streaming annotated frames via MJPEG
and pushing match results via the event bus (asyncio.Queue).
"""

import asyncio
import logging
import time
import cv2
import numpy as np
from typing import Optional
import importlib

logger = logging.getLogger(__name__)


class EdgePipeline:
    """
    Real-time frame processing pipeline.

    Captures frames from a camera source, detects faces, extracts embeddings,
    runs matching against the watchlist, and produces annotated output frames.
    """

    def __init__(self):
        self._capture: Optional[cv2.VideoCapture] = None
        self._running: bool = False
        self._current_frame: Optional[np.ndarray] = None
        self._frame_lock = asyncio.Lock()
        self._fps: float = 0.0
        self._camera_source = 0  # default webcam
        self._match_threshold: float = 0.45
        self._latest_match: Optional[dict] = None
        self._latest_detected_faces = []
        self._event_queue: asyncio.Queue = asyncio.Queue(maxsize=100)

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def fps(self) -> float:
        return self._fps

    @property
    def latest_match(self) -> Optional[dict]:
        return self._latest_match

    @property
    def event_queue(self) -> asyncio.Queue:
        return self._event_queue

    def set_threshold(self, threshold: float):
        """Update the match similarity threshold."""
        self._match_threshold = max(0.0, min(1.0, threshold))
        logger.info(f"Match threshold updated to {self._match_threshold:.2f}")

    async def start(self, source=0):
        """Start the camera capture and processing pipeline."""
        if self._running:
            logger.warning("Pipeline already running")
            return

        self._camera_source = source

        # Open camera in executor to prevent blocking startup
        loop = asyncio.get_running_loop()
        try:
            cap = await loop.run_in_executor(None, lambda: cv2.VideoCapture(source))
            if not cap or not cap.isOpened():
                if cap:
                    cap.release()
                raise RuntimeError(f"Cannot open camera source: {source}")
            self._capture = cap
        except Exception as e:
            logger.error(f"Error opening camera source {source}: {e}")
            raise RuntimeError(f"Cannot open camera source: {source}. Details: {str(e)}")

        # Set camera properties
        self._capture.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self._capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self._capture.set(cv2.CAP_PROP_FPS, 30)

        self._running = True
        logger.info(f"Edge pipeline started with source: {source}")

        # Start the processing loop in background
        asyncio.create_task(self._process_loop())

    async def stop(self):
        """Stop the camera capture and pipeline."""
        self._running = False
        if self._capture:
            # Release capture in executor to prevent blocking
            loop = asyncio.get_running_loop()
            cap = self._capture
            self._capture = None
            await loop.run_in_executor(None, cap.release)
        self._current_frame = None
        self._latest_match = None
        logger.info("Edge pipeline stopped")

    async def _process_loop(self):
        """Main processing loop — runs in background."""
        # Import modules
        edge_init = importlib.import_module("services.edge-inference")
        detector_mod = importlib.import_module("services.edge-inference.detector")
        embedder_mod = importlib.import_module("services.edge-inference.embedder")
        matcher_mod = importlib.import_module("services.recognition-service.matcher")
        store_mod = importlib.import_module("services.watchlist-service.store")

        face_app = edge_init.get_face_app()
        frame_count = 0
        fps_start = time.time()
        loop = asyncio.get_running_loop()

        def _read_frame():
            if self._capture and self._capture.isOpened():
                return self._capture.read()
            return False, None

        def _process_detect(frame_img, app, threshold):
            if app is None:
                return [], None
            
            detected = detector_mod.detect_faces(frame_img, app)
            watchlist = store_mod.watchlist_store.get_all_embeddings()
            
            best_match_res = None
            best_score_res = 0.0

            for det_face in detected:
                bbox = det_face.bbox
                x1, y1, x2, y2 = bbox

                for target_id, target_name, target_emb, target_crop_b64 in watchlist:
                    score = matcher_mod.cosine_similarity(det_face.embedding, target_emb)
                    if score >= threshold and score > best_score_res:
                        face_crop = embedder_mod.extract_face_crop(frame_img, bbox)
                        face_crop_b64 = embedder_mod.face_crop_to_b64(face_crop)
                        best_match_res = {
                            "target_id": target_id,
                            "target_name": target_name,
                            "confidence": float(score),
                            "threshold": threshold,
                            "bbox": [int(x1), int(y1), int(x2), int(y2)],
                            "face_crop_b64": face_crop_b64,
                            "target_image_b64": target_crop_b64,
                            "camera_id": "cam-0",
                        }
                        best_score_res = score
            return detected, best_match_res

        while self._running and self._capture and self._capture.isOpened():
            # 1. Read frame without blocking the event loop
            ret, frame = await loop.run_in_executor(None, _read_frame)
            if not ret:
                await asyncio.sleep(0.01)
                continue

            frame_count += 1
            annotated = frame.copy()

            # Run detection every 3 frames to reduce CPU load
            if frame_count % 3 == 0 and face_app is not None:
                # 2. Run detection and matching in executor to keep event loop fully responsive
                detected_faces, best_match = await loop.run_in_executor(
                    None, _process_detect, frame, face_app, self._match_threshold
                )
                
                self._latest_detected_faces = detected_faces

                # Update match state and push event
                if best_match:
                    self._latest_match = best_match
                    try:
                        self._event_queue.put_nowait(best_match)
                    except asyncio.QueueFull:
                        pass  # Drop if queue is full
                else:
                    self._latest_match = None

            # Draw bounding boxes on annotated frame
            # First, draw grey boxes for ALL detected faces (unknowns)
            for det_face in self._latest_detected_faces:
                bx1, by1, bx2, by2 = [int(v) for v in det_face.bbox]
                cv2.rectangle(annotated, (bx1, by1), (bx2, by2), (128, 128, 128), 2)
                
            # Then, draw the matching target in green over it
            if self._latest_match:
                bbox = self._latest_match["bbox"]
                x1, y1, x2, y2 = bbox
                # TARGET MATCH — Green box + label
                cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 3)
                label = f"TARGET: {self._latest_match['target_name']} ({self._latest_match['confidence']:.0%})"
                label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
                cv2.rectangle(
                    annotated,
                    (x1, y1 - label_size[1] - 10),
                    (x1 + label_size[0], y1),
                    (0, 255, 0), -1,
                )
                cv2.putText(
                    annotated, label,
                    (x1, y1 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2,
                )

            # Calculate FPS
            elapsed = time.time() - fps_start
            if elapsed >= 1.0:
                self._fps = frame_count / elapsed
                frame_count = 0
                fps_start = time.time()

            # Draw FPS counter
            cv2.putText(
                annotated,
                f"FPS: {self._fps:.1f}",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2,
            )

            # Store the annotated frame for MJPEG streaming
            async with self._frame_lock:
                self._current_frame = annotated

            # Yield control to event loop
            await asyncio.sleep(0.001)

        logger.info("Processing loop ended")

    async def get_frame_jpeg(self) -> Optional[bytes]:
        """Get the current annotated frame as JPEG bytes."""
        async with self._frame_lock:
            if self._current_frame is None:
                return None
            _, buffer = cv2.imencode(
                '.jpg', self._current_frame,
                [cv2.IMWRITE_JPEG_QUALITY, 70]
            )
            return buffer.tobytes()


# Singleton pipeline instance
pipeline = EdgePipeline()
