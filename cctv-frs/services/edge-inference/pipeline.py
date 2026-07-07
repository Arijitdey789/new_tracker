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
import base64
from datetime import datetime
import threading
import os

# Improve RTSP stability and set TCP transport
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

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
        self._cap_lock = threading.Lock()
        self._fps: float = 0.0
        self._camera_source = 0  # default webcam
        self._match_threshold: float = 0.45
        self._latest_match: Optional[dict] = None
        self._latest_detected_faces = []
        self._event_queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._is_mock: bool = False

        # Local tracking states
        self._is_tracking: bool = False
        self._tracked_bbox: Optional[list] = None  # [x1, y1, x2, y2]
        self._tracked_target_id: Optional[str] = None
        self._tracked_target_name: Optional[str] = None
        self._tracked_target_emb: Optional[np.ndarray] = None
        self._tracked_target_crop_b64: Optional[str] = None
        self._target_template: Optional[np.ndarray] = None
        self._tracking_lost_count: int = 0
        self._max_lost_frames: int = 30  # ~1 second at 30 FPS
        self._track_confidence: float = 0.0

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
        """Start the camera capture and pipeline."""
        if self._running:
            logger.warning("Pipeline already running")
            return

        self._camera_source = source
        self._is_mock = False

        # Open camera in executor to prevent blocking startup
        loop = asyncio.get_running_loop()
        cap = None
        try:
            if isinstance(source, int):
                logger.info(f"Attempting to open camera index {source} via CAP_DSHOW backend...")
                cap = await loop.run_in_executor(None, lambda: cv2.VideoCapture(source, cv2.CAP_DSHOW))
                if not cap or not cap.isOpened():
                    if cap:
                        cap.release()
                    logger.warning("DirectShow camera open failed. Falling back to default backend...")
                    cap = await loop.run_in_executor(None, lambda: cv2.VideoCapture(source))
            else:
                logger.info(f"Opening camera source stream: {source}")
                cap = await loop.run_in_executor(None, lambda: cv2.VideoCapture(source))

            if cap and cap.isOpened():
                self._capture = cap
                # Set camera properties
                self._capture.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self._capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                self._capture.set(cv2.CAP_PROP_FPS, 30)
                logger.info(f"Edge pipeline started physical capture successfully with source: {source}")
            else:
                if cap:
                    cap.release()
                raise RuntimeError(f"VideoCapture opened is False for source: {source}")
        except Exception as e:
            logger.warning(f"Failed to connect to physical camera source '{source}' (Error: {e}). Falling back to Simulated Camera Mode.")
            self._is_mock = True
            self._capture = None

        self._running = True
        logger.info(f"Edge pipeline running. Simulated/Mock mode: {self._is_mock}")

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
            def _release_cap():
                with self._cap_lock:
                    cap.release()
            await loop.run_in_executor(None, _release_cap)
        self._current_frame = None
        self._latest_match = None
        self._is_mock = False
        
        # Reset tracking states
        self._is_tracking = False
        self._tracked_bbox = None
        self._tracked_target_id = None
        self._tracked_target_name = None
        self._tracked_target_emb = None
        self._tracked_target_crop_b64 = None
        self._target_template = None
        self._tracking_lost_count = 0
        self._track_confidence = 0.0
        logger.info("Edge pipeline stopped")

    async def _process_loop(self):
        """Main processing loop — runs in background."""
        import base64
        from datetime import datetime

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
            with self._cap_lock:
                if self._capture and self._capture.isOpened():
                    return self._capture.read()
                return False, None

        def calculate_iou(boxA, boxB):
            xA = max(boxA[0], boxB[0])
            yA = max(boxA[1], boxB[1])
            xB = min(boxA[2], boxB[2])
            yB = min(boxA[3], boxB[3])

            interArea = max(0, xB - xA) * max(0, yB - yA)
            boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
            boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])

            iou = interArea / float(boxAArea + boxBArea - interArea + 1e-6)
            return iou

        while self._running and (self._is_mock or (self._capture and self._capture.isOpened())):
            ret = False
            frame = None

            if self._is_mock:
                # Generate synthetic camera frame
                frame = np.zeros((480, 640, 3), dtype=np.uint8)
                # Draw grid lines
                for y in range(0, 480, 40):
                    cv2.line(frame, (0, y), (640, y), (30, 30, 30), 1)
                for x in range(0, 640, 40):
                    cv2.line(frame, (x, 0), (x, 480), (30, 30, 30), 1)
                
                # Draw text and metadata overlays
                cv2.putText(frame, "SENTINEL PRO - SIMULATED CCTV FEED", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
                cv2.putText(frame, f"SOURCE: {self._camera_source} (VIRTUAL)", (30, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)
                cv2.putText(frame, datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3], (30, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

                watchlist = store_mod.watchlist_store.get_all_embeddings()
                if watchlist:
                    # Retrieve the first enrolled target and decode its face crop
                    target_id, target_name, target_emb, target_crop_b64 = watchlist[0]
                    if target_crop_b64:
                        try:
                            crop_bytes = base64.b64decode(target_crop_b64)
                            crop_arr = np.frombuffer(crop_bytes, dtype=np.uint8)
                            crop_img = cv2.imdecode(crop_arr, cv2.IMREAD_COLOR)

                            if crop_img is not None:
                                # Resize face crop
                                face_size = 120
                                crop_resized = cv2.resize(crop_img, (face_size, face_size))

                                # Calculate circular movement over time
                                t = time.time()
                                face_x = int(260 + 160 * np.cos(t * 0.7))
                                face_y = int(180 + 90 * np.sin(t * 1.1))

                                # Clamp position
                                face_x = max(0, min(640 - face_size, face_x))
                                face_y = max(0, min(480 - face_size, face_y))

                                # Paste the face onto the mock frame
                                frame[face_y:face_y+face_size, face_x:face_x+face_size] = crop_resized
                        except Exception as overlay_err:
                            logger.error(f"Error drawing simulated suspect face: {overlay_err}")
                else:
                    cv2.putText(frame, "NO TARGET ENROLLED", (190, 220), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                    cv2.putText(frame, "Upload a suspect photo in Section 2 to start target detection.", (90, 260), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (170, 170, 170), 1)

                ret = True
                await asyncio.sleep(0.033)  # Rate limit virtual loop to ~30 FPS
            else:
                ret, frame = await loop.run_in_executor(None, _read_frame)

            if not ret or frame is None:
                await asyncio.sleep(0.01)
                continue

            frame_count += 1
            annotated = frame.copy()
            h, w = frame.shape[:2]

            # 1. Short-term tracking update using template matching (runs on every frame when tracking is active)
            tracked_this_frame = False
            if self._is_tracking and self._target_template is not None and self._tracked_bbox is not None:
                prev_x1, prev_y1, prev_x2, prev_y2 = self._tracked_bbox
                tw = prev_x2 - prev_x1
                th = prev_y2 - prev_y1

                if tw > 10 and th > 10:
                    # Pad the search window by 50% of the bounding box size
                    pad_w = int(tw * 0.5)
                    pad_h = int(th * 0.5)
                    search_x1 = max(0, prev_x1 - pad_w)
                    search_y1 = max(0, prev_y1 - pad_h)
                    search_x2 = min(w, prev_x2 + pad_w)
                    search_y2 = min(h, prev_y2 + pad_h)

                    if (search_x2 - search_x1) > tw and (search_y2 - search_y1) > th:
                        search_region = frame[search_y1:search_y2, search_x1:search_x2]
                        tem_h, tem_w = self._target_template.shape[:2]
                        if tem_w > 0 and tem_h > 0 and tem_w < search_region.shape[1] and tem_h < search_region.shape[0]:
                            res = cv2.matchTemplate(search_region, self._target_template, cv2.TM_CCOEFF_NORMED)
                            _, max_val, _, max_loc = cv2.minMaxLoc(res)

                            # Correlation threshold (0.50 is safe for consecutive frames)
                            if max_val > 0.50:
                                new_x1 = search_x1 + max_loc[0]
                                new_y1 = search_y1 + max_loc[1]
                                self._tracked_bbox = [new_x1, new_y1, new_x1 + tem_w, new_y1 + tem_h]
                                tracked_this_frame = True
                                self._tracking_lost_count = 0
                                
                                # If correlation is very high, update the template to handle scale/pose shifts
                                if max_val > 0.85:
                                    self._target_template = frame[new_y1:new_y1+tem_h, new_x1:new_x1+tem_w].copy()
                            else:
                                self._tracking_lost_count += 1
                        else:
                            self._tracking_lost_count += 1
                    else:
                        self._tracking_lost_count += 1
                else:
                    self._tracking_lost_count += 1

                # If tracking and updated in non-detection frame, update annotation coordinates
                if tracked_this_frame and self._latest_match:
                    self._latest_match["bbox"] = self._tracked_bbox

            # 2. Run face detection and watchlist matching (every 3 frames)
            if frame_count % 3 == 0 and face_app is not None:
                detected_faces = await loop.run_in_executor(
                    None, detector_mod.detect_faces, frame, face_app
                )
                self._latest_detected_faces = detected_faces
                watchlist = store_mod.watchlist_store.get_all_embeddings()

                if not self._is_tracking:
                    # Look for any watchlist target matches
                    best_score = -1.0
                    best_face = None
                    best_target_id = None
                    best_target_name = None
                    best_target_crop_b64 = None
                    best_target_emb = None

                    for det_face in detected_faces:
                        for target_id, target_name, target_emb, target_crop_b64 in watchlist:
                            score = matcher_mod.cosine_similarity(det_face.embedding, target_emb)
                            if score >= self._match_threshold and score > best_score:
                                best_score = score
                                best_face = det_face
                                best_target_id = target_id
                                best_target_name = target_name
                                best_target_crop_b64 = target_crop_b64
                                best_target_emb = target_emb

                    if best_face is not None:
                        # Initialize target tracking
                        self._is_tracking = True
                        self._tracked_bbox = [int(v) for v in best_face.bbox]
                        self._tracked_target_id = best_target_id
                        self._tracked_target_name = best_target_name
                        self._tracked_target_emb = best_target_emb
                        self._tracked_target_crop_b64 = best_target_crop_b64
                        self._tracking_lost_count = 0
                        self._track_confidence = best_score

                        # Crop template from current frame
                        tx1, ty1, tx2, ty2 = self._tracked_bbox
                        tx1, ty1 = max(0, tx1), max(0, ty1)
                        tx2, ty2 = min(w, tx2), min(h, ty2)
                        self._target_template = frame[ty1:ty2, tx1:tx2].copy()

                        # Emit tracking_start event exactly once
                        face_crop = embedder_mod.extract_face_crop(frame, best_face.bbox)
                        face_crop_b64 = embedder_mod.face_crop_to_b64(face_crop)
                        event = {
                            "type": "tracking_start",
                            "camera_id": "cam-0",
                            "target_id": best_target_id,
                            "confidence": f"{int(best_score * 100)}%",
                            "coordinates": {
                                "x": int((tx1 + tx2) / 2),
                                "y": int((ty1 + ty2) / 2)
                            },
                            "timestamp": datetime.utcnow().isoformat() + "Z",
                            "face_crop_b64": face_crop_b64,
                            "target_image_b64": best_target_crop_b64
                        }
                        self._event_queue.put_nowait(event)

                        self._latest_match = {
                            "target_id": best_target_id,
                            "target_name": best_target_name,
                            "confidence": best_score,
                            "threshold": self._match_threshold,
                            "bbox": self._tracked_bbox,
                            "face_crop_b64": face_crop_b64,
                            "target_image_b64": best_target_crop_b64,
                            "camera_id": "cam-0"
                        }
                else:
                    # We are already tracking a target. Associate detections by similarity OR IoU overlap
                    best_det_face = None
                    best_score = -1.0

                    for det_face in detected_faces:
                        score = matcher_mod.cosine_similarity(det_face.embedding, self._tracked_target_emb)
                        iou = calculate_iou(det_face.bbox, self._tracked_bbox)

                        # Match if similarity >= threshold OR (IoU overlap >= 0.40 and similarity >= 0.25)
                        if score >= self._match_threshold:
                            if score > best_score:
                                best_score = score
                                best_det_face = det_face
                        elif iou >= 0.40 and score >= 0.25:
                            if score > best_score:
                                best_score = score
                                best_det_face = det_face

                    if best_det_face is not None:
                        self._tracked_bbox = [int(v) for v in best_det_face.bbox]
                        self._track_confidence = max(best_score, 0.25)
                        self._tracking_lost_count = 0

                        # Update template
                        tx1, ty1, tx2, ty2 = self._tracked_bbox
                        tx1, ty1 = max(0, tx1), max(0, ty1)
                        tx2, ty2 = min(w, tx2), min(h, ty2)
                        self._target_template = frame[ty1:ty2, tx1:tx2].copy()

                        face_crop = embedder_mod.extract_face_crop(frame, best_det_face.bbox)
                        face_crop_b64 = embedder_mod.face_crop_to_b64(face_crop)
                        self._latest_match = {
                            "target_id": self._tracked_target_id,
                            "target_name": self._tracked_target_name,
                            "confidence": self._track_confidence,
                            "threshold": self._match_threshold,
                            "bbox": self._tracked_bbox,
                            "face_crop_b64": face_crop_b64,
                            "target_image_b64": self._tracked_target_crop_b64,
                            "camera_id": "cam-0"
                        }
                    else:
                        # Detection failed to find the target face, increment lost counter
                        self._tracking_lost_count += 1

            # 3. Check for lost tracking
            if self._is_tracking and self._tracking_lost_count >= self._max_lost_frames:
                self._is_tracking = False
                event = {
                    "type": "tracking_stop",
                    "camera_id": "cam-0",
                    "target_id": self._tracked_target_id,
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }
                self._event_queue.put_nowait(event)
                
                self._latest_match = None
                self._tracked_bbox = None
                self._target_template = None

            # 4. Draw bounding box around tracked target only
            if self._is_tracking and self._tracked_bbox is not None:
                x1, y1, x2, y2 = self._tracked_bbox
                cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 3)
                label = f"TARGET: {self._tracked_target_name} ({self._track_confidence:.0%})"
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
