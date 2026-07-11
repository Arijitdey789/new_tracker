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
_execution_provider: str = "none"  # 'gpu', 'cpu', or 'none'


def init_face_app(det_size: tuple = (640, 640)):
    """
    Initialize the InsightFace FaceAnalysis model.

    Downloads the buffalo_l model pack (~300MB) on first run.
    GPU-first strategy: tries GPU-only providers first (without CPU in the
    provider list) so that ONNX Runtime raises an error if the GPU backend
    is non-functional.  Falls back to CPU only on explicit failure.
    This prevents the runtime from silently alternating between GPU and CPU.
    """
    global _face_app, _model_loaded, _execution_provider
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
        "OpenVINOExecutionProvider",
    ]]

    _face_app = None

    # ── Step 1: Try GPU-only (no CPU fallback in the list) ────────────
    if gpu_providers:
        logger.info(f"Detected GPU Execution Providers: {gpu_providers}. Trying GPU-only execution...")
        try:
            # GPU-only — if the GPU runtime cannot load, this will raise
            _face_app = FaceAnalysis(
                name="buffalo_l",
                providers=gpu_providers,          # NO CPUExecutionProvider here
            )
            _face_app.prepare(ctx_id=0, det_size=det_size)

            # Verify sessions actually registered a GPU provider.
            # ONNX Runtime can silently fall back to CPU if CUDA library versions
            # don't match the onnxruntime-gpu build — this catches that case.
            active_providers = set()
            for model_name, model in _face_app.models.items():
                if hasattr(model, 'session'):
                    active_providers.update(model.session.get_providers())

            _gpu_provider_names = {
                "CUDAExecutionProvider", "DmlExecutionProvider",
                "ROCMExecutionProvider", "TensorrtExecutionProvider",
                "OpenVINOExecutionProvider",
            }
            if not active_providers.intersection(_gpu_provider_names):
                raise RuntimeError(
                    f"ONNX Runtime silently fell back to CPU. Active providers: {active_providers}. "
                    "Ensure onnxruntime-gpu is installed and CUDA libraries match the ORT version "
                    "(see: https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html)."
                )

            logger.info(f"InsightFace models prepared on GPU. Active providers: {active_providers}")
            logger.info("✓ Application is running on the GPU.")
            _model_loaded = True
            _execution_provider = "gpu"
        except Exception as e:
            logger.warning(f"GPU initialization failed: {e}. Will fall back to CPU.")
            _face_app = None

    # ── Step 2: CPU fallback ──────────────────────────────────────────
    if _face_app is None:
        logger.info("Initializing InsightFace on CPU...")
        try:
            _face_app = FaceAnalysis(
                name="buffalo_l",
                providers=["CPUExecutionProvider"],
            )
            _face_app.prepare(ctx_id=-1, det_size=det_size)
            _model_loaded = True
            _execution_provider = "cpu"
            logger.info("✓ Application is running on the CPU.")
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


def get_execution_provider() -> str:
    """Return the active execution provider ('gpu', 'cpu', or 'none')."""
    return _execution_provider
