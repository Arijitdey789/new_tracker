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
    Detects and uses available GPU Execution Providers (CUDA, DML, etc.),
    falling back to CPU on failure or if no GPU is available.
    """
    global _face_app, _model_loaded
    if _model_loaded:
        return _face_app

    logger.info("Loading InsightFace model (buffalo_l)... This may take a moment on first run.")

    import onnxruntime as ort
    all_providers = ort.get_available_providers()
    logger.info(f"All available ONNX Runtime providers: {all_providers}")

    # Define execution providers representing GPUs/accelerators
    gpu_providers = [p for p in all_providers if p in [
        "CUDAExecutionProvider",
        "DmlExecutionProvider",
        "ROCMExecutionProvider",
        "TensorrtExecutionProvider",
        "OpenVINOExecutionProvider"
    ]]

    _face_app = None
    if gpu_providers:
        logger.info(f"Detected GPU Execution Providers: {gpu_providers}. Trying GPU execution...")
        try:
            # Prefer GPU providers, using CPUExecutionProvider as fallback in ONNX Runtime
            providers = gpu_providers + ["CPUExecutionProvider"]
            _face_app = FaceAnalysis(
                name="buffalo_l",
                providers=providers,
            )
            # Use ctx_id=0 for GPU context
            _face_app.prepare(ctx_id=0, det_size=det_size)

            # Verify if the sessions actually registered the GPU provider
            active_providers = []
            for name, model in _face_app.models.items():
                if hasattr(model, 'session'):
                    active_providers.extend(model.session.get_providers())

            logger.info(f"InsightFace models prepared successfully on GPU. Active providers: {set(active_providers)}")
            logger.info("Application is running on the GPU.")
            _model_loaded = True
        except Exception as e:
            logger.error(f"Failed to initialize InsightFace on GPU: {e}. Falling back to CPU...")
            _face_app = None

    if _face_app is None:
        logger.info("Initializing InsightFace on CPU...")
        try:
            _face_app = FaceAnalysis(
                name="buffalo_l",
                providers=["CPUExecutionProvider"],
            )
            _face_app.prepare(ctx_id=-1, det_size=det_size)
            _model_loaded = True
            logger.info("Application is running on the CPU.")
        except Exception as e:
            logger.error(f"Failed to initialize InsightFace on CPU: {e}")
            raise e

    return _face_app


def get_face_app() -> FaceAnalysis:
    """Get the shared InsightFace model instance."""
    global _face_app
    return _face_app


def is_model_loaded() -> bool:
    """Check if the model has been loaded."""
    return _model_loaded
