"""
Detector — Face detection using InsightFace.

Wraps InsightFace's FaceAnalysis.get() to return structured detection results.
Handles the Detect → Align stages of the edge pipeline.
"""

import logging
import numpy as np
from typing import List
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class DetectedFace:
    """A single detected face with bounding box and landmarks."""
    bbox: np.ndarray       # [x1, y1, x2, y2]
    det_score: float       # detection confidence
    landmarks: np.ndarray  # 5-point facial landmarks (for alignment)
    embedding: np.ndarray  # 512-d ArcFace embedding (L2-normalized)
    age: int = 0
    gender: int = 0        # 0=female, 1=male


def detect_faces(frame_bgr: np.ndarray, face_app) -> List[DetectedFace]:
    """
    Detect all faces in a BGR frame and extract embeddings.

    InsightFace performs detection, alignment, and embedding in a single call.
    This corresponds to the Edge AI Node pipeline:
      Detect → Align → Embed

    Args:
        frame_bgr: OpenCV BGR image (numpy array).
        face_app: Initialized InsightFace FaceAnalysis instance.

    Returns:
        List of DetectedFace objects with bounding boxes and embeddings.
    """
    if face_app is None:
        return []

    try:
        faces = face_app.get(frame_bgr)
    except Exception as e:
        logger.warning(f"Face detection failed on frame: {e}")
        return []

    results = []
    for face in faces:
        try:
            detected = DetectedFace(
                bbox=face.bbox.astype(int),
                det_score=float(face.det_score),
                landmarks=face.kps if hasattr(face, 'kps') else np.array([]),
                embedding=face.normed_embedding,
                age=int(face.age) if hasattr(face, 'age') else 0,
                gender=int(face.gender) if hasattr(face, 'gender') else 0,
            )
            results.append(detected)
        except Exception as e:
            logger.warning(f"Failed to process detected face: {e}")
            continue

    return results
