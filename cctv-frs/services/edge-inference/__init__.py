"""
Edge Inference Service — Detection, alignment, embedding, local tracking.

Provides:
- Face detection using InsightFace (SCRFD/RetinaFace)
- Face alignment (built into InsightFace)
- ArcFace 512-d embedding extraction
- MJPEG video streaming with annotations
- Shared FaceAnalysis model instance

The InsightFace model is loaded once at startup and shared across
the watchlist-service (enrollment) and edge-inference (live detection).
"""

import logging
from insightface.app import FaceAnalysis

logger = logging.getLogger(__name__)

# Global model instance — initialized once at startup
_face_app: FaceAnalysis = None
_model_loaded: bool = False


def init_face_app(det_size: tuple = (640, 640)):
    """
    Initialize the InsightFace FaceAnalysis model.

    Downloads the buffalo_l model pack (~300MB) on first run.
    Uses CPU-only execution via ONNX Runtime.
    """
    global _face_app, _model_loaded
    if _model_loaded:
        return _face_app

    logger.info("Loading InsightFace model (buffalo_l)... This may take a moment on first run.")
    try:
        _face_app = FaceAnalysis(
            name="buffalo_l",
            providers=["CPUExecutionProvider"],
        )
        _face_app.prepare(ctx_id=-1, det_size=det_size)
        _model_loaded = True
        logger.info(f"InsightFace model loaded successfully. Detection size: {det_size}")
    except Exception as e:
        logger.error(f"Failed to load InsightFace model: {e}")
        raise
    return _face_app


def get_face_app() -> FaceAnalysis:
    """Get the shared InsightFace model instance."""
    global _face_app
    return _face_app


def is_model_loaded() -> bool:
    """Check if the model has been loaded."""
    return _model_loaded
