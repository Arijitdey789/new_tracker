"""
Embedder — Embedding extraction utilities.

InsightFace produces embeddings as part of face detection (in detector.py).
This module provides utility functions for embedding operations:
  - Conversion to FaceEvent schema
  - Face crop extraction and encoding
"""

import base64
import numpy as np
import cv2
from datetime import datetime

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from schemas.events.face_event import FaceEvent, BoundingBox


def extract_face_crop(frame_bgr: np.ndarray, bbox: np.ndarray, padding: int = 10) -> np.ndarray:
    """
    Extract and pad a face crop from the frame.

    Args:
        frame_bgr: Source BGR image.
        bbox: [x1, y1, x2, y2] bounding box.
        padding: Extra pixels around the face for context.

    Returns:
        Cropped face region as BGR numpy array.
    """
    h, w = frame_bgr.shape[:2]
    x1 = max(0, int(bbox[0]) - padding)
    y1 = max(0, int(bbox[1]) - padding)
    x2 = min(w, int(bbox[2]) + padding)
    y2 = min(h, int(bbox[3]) + padding)
    return frame_bgr[y1:y2, x1:x2].copy()


def face_crop_to_b64(crop_bgr: np.ndarray, quality: int = 85) -> str:
    """Encode a BGR face crop as a base64 JPEG string."""
    _, buffer = cv2.imencode('.jpg', crop_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buffer.tobytes()).decode('utf-8')


def create_face_event(
    embedding: np.ndarray,
    bbox: np.ndarray,
    quality_score: float,
    face_crop_b64: str = None,
    camera_id: str = "cam-0",
    zone_id: str = "zone-local",
) -> FaceEvent:
    """
    Create a FaceEvent from detection results.

    This is the structured event that leaves the edge —
    never raw video, only embedding + bbox + metadata.
    """
    return FaceEvent(
        camera_id=camera_id,
        zone_id=zone_id,
        timestamp=datetime.utcnow(),
        embedding=embedding.tolist(),
        bbox=BoundingBox(
            x1=int(bbox[0]),
            y1=int(bbox[1]),
            x2=int(bbox[2]),
            y2=int(bbox[3]),
        ),
        quality_score=quality_score,
        face_crop_b64=face_crop_b64,
    )
