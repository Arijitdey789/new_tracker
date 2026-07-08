"""
Pipeline — Frame processing pipeline for the Edge AI Node.

Orchestrates: Camera Capture → Face Detection → Embedding → FaceEvent → Matching.

Runs as a background async task, streaming annotated frames via MJPEG
and pushing match results via the event bus (asyncio.Queue).

Performance optimisations over the original implementation:
  1. A dedicated *daemon thread* continuously reads frames from OpenCV,
     keeping the camera buffer drained so the async loop always gets the
     latest frame without blocking.
  2. Face detection (the heaviest operation) runs in a thread-pool executor
     and is *skipped* if the previous detection hasn't finished yet (frame
     skipping).  This guarantees the annotated-frame pipeline never stalls
     waiting on inference.
  3. The annotated frame is JPEG-encoded once and cached; streaming
     endpoints simply serve the cached bytes.
  4. A new `tracking_update` WebSocket event is emitted every detection
     cycle so the frontend status panel can update in real time.
"""

import asyncio
import logging
import time
import threading
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


# ──────────────────────────────────────────────────────────────────────
# Threaded camera reader — runs in its own daemon thread, always
# keeping self.frame set to the most recent camera frame.
# ──────────────────────────────────────────────────────────────────────
class _ThreadedCameraReader:
    """Continuously grabs frames from an OpenCV VideoCapture on a daemon thread."""

    def __init__(self, capture: cv2.VideoCapture):
        self._cap = capture
        self._lock = threading.Lock()
        self._frame: Optional[np.ndarray] = None
        self._ret: bool = False
        self._running = True
        self._thread = threading.Thread(target=self._read_loop, daemon=True)
        self._thread.start()

    def _read_loop(self):
        while self._running and self._cap.isOpened():
            ret, frame = self._cap.read()
            with self._lock:
                self._ret = ret
                self._frame = frame
            if not ret:
                time.sleep(0.005)

    def read(self):
        """Return (ret, frame) — always the latest available frame."""
        with self._lock:
            return self._ret, self._frame.copy() if self._frame is not None else None

    def stop(self):
        self._running = False
        self._thread.join(timeout=2.0)


class EdgePipeline:
    """
    Real-time frame processing pipeline.

    Captures frames from a camera source, detects faces, extracts embeddings,
    runs matching against the watchlist, and produces annotated output frames.
    """

    def __init__(self, camera_id="cam-0"):
        self.camera_id = camera_id
        self._capture: Optional[cv2.VideoCapture] = None
        self._reader: Optional[_ThreadedCameraReader] = None
        self._running: bool = False
        self._current_frame: Optional[np.ndarray] = None
        self._current_jpeg: Optional[bytes] = None        # pre-encoded JPEG
        # Lock-free design: CPython GIL makes attribute assignment atomic.
        # Single writer (process loop) / multiple readers (stream endpoints).
        # No asyncio.Lock needed — eliminates the main source of frame stalls.
        self._fps: float = 0.0
        self._camera_source = 0  # default webcam
        self._match_threshold: float = 0.45
        self._latest_match: Optional[dict] = None
        self._latest_detected_faces = []
        self._event_queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._is_mock: bool = False

        # Detection concurrency guard — only one detection runs at a time
        self._detection_busy: bool = False
        self._template_busy: bool = False   # guard for async template matching

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
                self._capture.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                self._capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                self._capture.set(cv2.CAP_PROP_FPS, 30)
                # Minimise internal buffering so we always get the latest frame
                self._capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                logger.info(f"Edge pipeline started physical capture successfully with source: {source}")

                # Start threaded reader to keep camera buffer drained
                self._reader = _ThreadedCameraReader(self._capture)
            else:
                if cap:
                    cap.release()
                raise RuntimeError(f"VideoCapture opened is False for source: {source}")
        except Exception as e:
            logger.warning(f"Failed to connect to physical camera source '{source}' (Error: {e}). Falling back to Simulated Camera Mode.")
            self._is_mock = True
            self._capture = None
            self._reader = None

        self._running = True
        logger.info(f"Edge pipeline running. Simulated/Mock mode: {self._is_mock}")

        # Start the processing loop in background
        asyncio.create_task(self._process_loop())

    async def stop(self):
        """Stop the camera capture and pipeline."""
        self._running = False

        # Stop threaded reader first
        if self._reader:
            self._reader.stop()
            self._reader = None

        if self._capture:
            # Release capture in executor to prevent blocking
            loop = asyncio.get_running_loop()
            cap = self._capture
            self._capture = None
            await loop.run_in_executor(None, cap.release)
        self._current_frame = None
        self._current_jpeg = None
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
        self._detection_busy = False
        self._template_busy = False
        logger.info("Edge pipeline stopped")

    # ──────────────────────────────────────────────────────────────────
    # Main processing loop
    # ──────────────────────────────────────────────────────────────────
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
        fps_frame_count = 0
        loop = asyncio.get_running_loop()


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

        while self._running and (self._is_mock or (self._reader is not None)):
            ret = False
            frame = None

            if self._is_mock:
                # Generate synthetic camera frame at display resolution
                frame = np.zeros((720, 1280, 3), dtype=np.uint8)
                # Draw grid lines
                for y in range(0, 720, 40):
                    cv2.line(frame, (0, y), (1280, y), (30, 30, 30), 1)
                for x in range(0, 1280, 40):
                    cv2.line(frame, (x, 0), (x, 720), (30, 30, 30), 1)
                
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
                                face_size = 180
                                crop_resized = cv2.resize(crop_img, (face_size, face_size))

                                # Calculate circular movement over time
                                t = time.time()
                                face_x = int(500 + 250 * np.cos(t * 0.7))
                                face_y = int(280 + 140 * np.sin(t * 1.1))

                                # Clamp position
                                face_x = max(0, min(1280 - face_size, face_x))
                                face_y = max(0, min(720 - face_size, face_y))

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
                # Read the latest frame from the threaded reader (non-blocking)
                ret, frame = self._reader.read()

            if not ret or frame is None:
                await asyncio.sleep(0.005)
                continue

            frame_count += 1
            fps_frame_count += 1
            annotated = frame  # defer copy until we actually draw
            h, w = frame.shape[:2]

            # 1. Short-term tracking update using template matching
            #    Offloaded to executor so it doesn't block the event loop.
            tracked_this_frame = False
            if self._is_tracking and self._target_template is not None and self._tracked_bbox is not None and not self._template_busy:
                prev_x1, prev_y1, prev_x2, prev_y2 = self._tracked_bbox
                tw = prev_x2 - prev_x1
                th = prev_y2 - prev_y1

                if tw > 10 and th > 10:
                    pad_w = int(tw * 0.5)
                    pad_h = int(th * 0.5)
                    search_x1 = max(0, prev_x1 - pad_w)
                    search_y1 = max(0, prev_y1 - pad_h)
                    search_x2 = min(w, prev_x2 + pad_w)
                    search_y2 = min(h, prev_y2 + pad_h)

                    if (search_x2 - search_x1) > tw and (search_y2 - search_y1) > th:
                        search_region = frame[search_y1:search_y2, search_x1:search_x2].copy()
                        template_snap = self._target_template
                        tem_h, tem_w = template_snap.shape[:2]
                        if tem_w > 0 and tem_h > 0 and tem_w < search_region.shape[1] and tem_h < search_region.shape[0]:
                            # Offload CPU-heavy matchTemplate to thread pool
                            self._template_busy = True
                            def _do_template_match(sr, tmpl):
                                res = cv2.matchTemplate(sr, tmpl, cv2.TM_CCOEFF_NORMED)
                                _, max_val, _, max_loc = cv2.minMaxLoc(res)
                                return max_val, max_loc
                            try:
                                max_val, max_loc = await loop.run_in_executor(None, _do_template_match, search_region, template_snap)

                                if max_val > 0.50:
                                    new_x1 = search_x1 + max_loc[0]
                                    new_y1 = search_y1 + max_loc[1]
                                    self._tracked_bbox = [new_x1, new_y1, new_x1 + tem_w, new_y1 + tem_h]
                                    tracked_this_frame = True
                                    self._tracking_lost_count = 0

                                    if max_val > 0.85:
                                        self._target_template = frame[new_y1:new_y1+tem_h, new_x1:new_x1+tem_w].copy()
                                else:
                                    self._tracking_lost_count += 1
                            except Exception:
                                self._tracking_lost_count += 1
                            finally:
                                self._template_busy = False
                        else:
                            self._tracking_lost_count += 1
                    else:
                        self._tracking_lost_count += 1
                else:
                    self._tracking_lost_count += 1

                # If tracking and updated in non-detection frame, update annotation coordinates
                if tracked_this_frame and self._latest_match:
                    self._latest_match["bbox"] = self._tracked_bbox

            # 2. Run face detection and watchlist matching (every 3 frames if tracking, or on every frame if not tracking)
            should_detect = (frame_count % 3 == 0) if self._is_tracking else True
            if should_detect and face_app is not None and not self._detection_busy:
                self._detection_busy = True
                
                # Snap full-res frame for cropping and template initialization (resolves race condition)
                det_frame_full = frame.copy()
                
                # Downscale for detection speed — keeps inference fast and preserves 16:9 aspect ratio
                if h > 360 or w > 640:
                    det_frame = cv2.resize(frame, (640, 360))
                    # Scale factors to map detection bboxes back to display coords
                    scale_x = w / 640.0
                    scale_y = h / 360.0
                else:
                    det_frame = frame.copy()
                    scale_x = 1.0
                    scale_y = 1.0

                async def _run_detection(det_frame_local, det_frame_full_local):
                    """Run detection in executor and process results."""
                    t_start = time.time()
                    try:
                        detected_faces = await loop.run_in_executor(
                            None, detector_mod.detect_faces, det_frame_local, face_app
                        )
                        t_det = (time.time() - t_start) * 1000
                        logger.info(f"[DETECTION] Found {len(detected_faces)} faces in {t_det:.1f}ms")

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
                                    logger.info(f"[MATCH] Scanning Face (score={score:.3f}) vs watchlist target '{target_name}' (Threshold: {self._match_threshold:.2f})")
                                    if score >= self._match_threshold and score > best_score:
                                        best_score = score
                                        best_face = det_face
                                        best_target_id = target_id
                                        best_target_name = target_name
                                        best_target_crop_b64 = target_crop_b64
                                        best_target_emb = target_emb

                            if best_face is not None:
                                logger.info(f"[MATCH SUCCESS] Target '{best_target_name}' verified with score {best_score:.3f}. Starting tracking immediately.")
                                # Initialize target tracking
                                self._is_tracking = True
                                # Scale bbox from detection resolution back to display resolution
                                raw_bbox = best_face.bbox
                                self._tracked_bbox = [int(raw_bbox[0]*scale_x), int(raw_bbox[1]*scale_y),
                                                       int(raw_bbox[2]*scale_x), int(raw_bbox[3]*scale_y)]
                                self._tracked_target_id = best_target_id
                                self._tracked_target_name = best_target_name
                                self._tracked_target_emb = best_target_emb
                                self._tracked_target_crop_b64 = best_target_crop_b64
                                self._tracking_lost_count = 0
                                self._track_confidence = best_score

                                # Crop template from full-res frame snapshot (resolves race condition)
                                tx1, ty1, tx2, ty2 = self._tracked_bbox
                                tx1, ty1 = max(0, tx1), max(0, ty1)
                                tx2, ty2 = min(w, tx2), min(h, ty2)
                                self._target_template = det_frame_full_local[ty1:ty2, tx1:tx2].copy()

                                # Emit tracking_start event exactly once
                                face_crop = embedder_mod.extract_face_crop(det_frame_full_local, self._tracked_bbox)
                                face_crop_b64 = embedder_mod.face_crop_to_b64(face_crop)
                                event = {
                                    "type": "tracking_start",
                                    "camera_id": self.camera_id,
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
                                try:
                                    self._event_queue.put_nowait(event)
                                except asyncio.QueueFull:
                                    pass

                                self._latest_match = {
                                    "target_id": best_target_id,
                                    "target_name": best_target_name,
                                    "confidence": best_score,
                                    "threshold": self._match_threshold,
                                    "bbox": self._tracked_bbox,
                                    "face_crop_b64": face_crop_b64,
                                    "target_image_b64": best_target_crop_b64,
                                    "camera_id": self.camera_id
                                }
                        else:
                            # We are already tracking a target. Associate detections by similarity OR IoU overlap
                            best_det_face = None
                            best_score = -1.0

                            for det_face in detected_faces:
                                # Scale face bbox to display resolution for IoU comparison space compatibility
                                scaled_det_bbox = [
                                    int(det_face.bbox[0]*scale_x),
                                    int(det_face.bbox[1]*scale_y),
                                    int(det_face.bbox[2]*scale_x),
                                    int(det_face.bbox[3]*scale_y)
                                ]
                                score = matcher_mod.cosine_similarity(det_face.embedding, self._tracked_target_emb)
                                iou = calculate_iou(scaled_det_bbox, self._tracked_bbox)

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
                                # Scale bbox back to display resolution
                                raw_bb = best_det_face.bbox
                                self._tracked_bbox = [int(raw_bb[0]*scale_x), int(raw_bb[1]*scale_y),
                                                       int(raw_bb[2]*scale_x), int(raw_bb[3]*scale_y)]
                                self._track_confidence = max(best_score, 0.25)
                                self._tracking_lost_count = 0

                                # Update template from full-res frame snapshot (resolves race condition)
                                tx1, ty1, tx2, ty2 = self._tracked_bbox
                                tx1, ty1 = max(0, tx1), max(0, ty1)
                                tx2, ty2 = min(w, tx2), min(h, ty2)
                                self._target_template = det_frame_full_local[ty1:ty2, tx1:tx2].copy()

                                face_crop = embedder_mod.extract_face_crop(det_frame_full_local, self._tracked_bbox)
                                face_crop_b64 = embedder_mod.face_crop_to_b64(face_crop)
                                self._latest_match = {
                                    "target_id": self._tracked_target_id,
                                    "target_name": self._tracked_target_name,
                                    "confidence": self._track_confidence,
                                    "threshold": self._match_threshold,
                                    "bbox": self._tracked_bbox,
                                    "face_crop_b64": face_crop_b64,
                                    "target_image_b64": self._tracked_target_crop_b64,
                                    "camera_id": self.camera_id
                                }
                            else:
                                # Detection failed to find the target face, increment lost counter
                                self._tracking_lost_count += 1

                        # ── Emit tracking_update for the status panel ─────────
                        if self._is_tracking and self._latest_match:
                            # Determine tracking status label
                            if self._tracking_lost_count == 0:
                                _trk_status = "TRACKING"
                            elif self._tracking_lost_count < self._max_lost_frames // 2:
                                _trk_status = "WEAK_SIGNAL"
                            else:
                                _trk_status = "LOST"

                            update_event = {
                                "type": "tracking_update",
                                "camera_id": self.camera_id,
                                "target_id": self._tracked_target_id,
                                "target_name": self._tracked_target_name,
                                "confidence": f"{int(self._track_confidence * 100)}%",
                                "confidence_raw": round(self._track_confidence, 4),
                                "threshold": self._match_threshold,
                                "bbox": self._tracked_bbox,
                                "faces_detected": len(detected_faces),
                                "match_verified": self._track_confidence >= self._match_threshold,
                                "face_crop_b64": self._latest_match.get("face_crop_b64"),
                                "target_image_b64": self._latest_match.get("target_image_b64"),
                                "coordinates": {
                                    "x": int((self._tracked_bbox[0] + self._tracked_bbox[2]) / 2),
                                    "y": int((self._tracked_bbox[1] + self._tracked_bbox[3]) / 2),
                                } if self._tracked_bbox else None,
                                "timestamp": datetime.utcnow().isoformat() + "Z",
                                "fps": round(self._fps, 1),
                                "tracking_status": _trk_status,
                            }
                            try:
                                self._event_queue.put_nowait(update_event)
                            except asyncio.QueueFull:
                                pass

                    except Exception as det_err:
                        logger.warning(f"Detection task error: {det_err}")
                    finally:
                        self._detection_busy = False

                # Fire and forget — the detection runs concurrently
                asyncio.create_task(_run_detection(det_frame, det_frame_full))

            # 3. Check for lost tracking
            if self._is_tracking and self._tracking_lost_count >= self._max_lost_frames:
                self._is_tracking = False
                event = {
                    "type": "tracking_stop",
                    "camera_id": self.camera_id,
                    "target_id": self._tracked_target_id,
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }
                try:
                    self._event_queue.put_nowait(event)
                except asyncio.QueueFull:
                    pass
                
                self._latest_match = None
                self._tracked_bbox = None
                self._target_template = None

            # 4. Draw bounding box around tracked target only
            if self._is_tracking and self._tracked_bbox is not None:
                # Deferred copy: only copy when we need to annotate
                if annotated is frame:
                    annotated = frame.copy()
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
                self._fps = fps_frame_count / elapsed
                fps_frame_count = 0
                fps_start = time.time()

            # Draw FPS counter
            if annotated is frame:
                annotated = frame.copy()
            cv2.putText(
                annotated,
                f"FPS: {self._fps:.1f}",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2,
            )

            # ── Pre-encode JPEG once and cache it ─────────────────────
            _, jpeg_buf = cv2.imencode(
                '.jpg', annotated,
                [cv2.IMWRITE_JPEG_QUALITY, 85]
            )
            jpeg_bytes = jpeg_buf.tobytes()

            # Lock-free atomic swap — streaming endpoints read the latest reference
            self._current_frame = annotated
            self._current_jpeg = jpeg_bytes

            # Yield control to event loop — short sleep keeps CPU usage bounded
            await asyncio.sleep(0.001)

        logger.info("Processing loop ended")

    async def get_frame_jpeg(self) -> Optional[bytes]:
        """Get the current annotated frame as JPEG bytes (pre-encoded).
        Lock-free: reads the latest atomic reference set by the process loop."""
        return self._current_jpeg


# Dictionary of pipelines
pipelines = {}

def get_pipeline(camera_id="cam-0") -> EdgePipeline:
    if camera_id not in pipelines:
        pipelines[camera_id] = EdgePipeline(camera_id=camera_id)
    return pipelines[camera_id]

# Singleton pipeline instance for legacy startup compatibility
pipeline = get_pipeline("cam-0")
