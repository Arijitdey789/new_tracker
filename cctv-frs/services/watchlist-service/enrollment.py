"""
Enrollment — Extract face embedding from an uploaded target image.

Uses the shared InsightFace model from edge-inference to maintain
consistency between enrollment embeddings and live detection embeddings.
"""

import io
import base64
import logging
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


def image_bytes_to_numpy(image_bytes: bytes) -> np.ndarray:
    """Convert raw image bytes to a BGR NumPy array (OpenCV format)."""
    import cv2
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image — unsupported format or corrupted data")
    return img


def numpy_to_base64_jpeg(img: np.ndarray, quality: int = 85) -> str:
    """Encode a BGR NumPy array as a base64 JPEG string."""
    import cv2
    _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buffer.tobytes()).decode('utf-8')


def extract_face_embedding(image_bytes: bytes, face_app) -> dict:
    """
    Extract the primary face embedding from an uploaded image.

    Args:
        image_bytes: Raw bytes of the uploaded image file.
        face_app: Initialized InsightFace FaceAnalysis instance.

    Returns:
        dict with keys:
          - embedding: np.ndarray (512-d, L2-normalized)
          - face_crop_b64: str (base64 JPEG of the detected face crop)
          - source_image_b64: str (base64 JPEG of the original image)
          - quality_score: float

    Raises:
        ValueError: If no face is detected in the image.
    """
    img_bgr = image_bytes_to_numpy(image_bytes)
    source_b64 = numpy_to_base64_jpeg(img_bgr)

    # Detect faces using InsightFace
    faces = face_app.get(img_bgr)

    if not faces:
        raise ValueError(
            "No face detected in the uploaded image. "
            "Please upload a clear, front-facing photo with a visible face."
        )

    # Use the highest-confidence face (largest detection score)
    best_face = max(faces, key=lambda f: f.det_score)

    # Extract the face crop from the original image
    bbox = best_face.bbox.astype(int)
    x1, y1, x2, y2 = bbox
    # Clamp to image bounds
    h, w = img_bgr.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    face_crop = img_bgr[y1:y2, x1:x2]
    face_crop_b64 = numpy_to_base64_jpeg(face_crop)

    # Get the 512-d ArcFace embedding (already L2-normalized by InsightFace)
    embedding = best_face.normed_embedding

    logger.info(
        f"Enrollment: detected face at bbox=({x1},{y1},{x2},{y2}), "
        f"quality={best_face.det_score:.3f}, embedding_dim={len(embedding)}"
    )

    return {
        "embedding": embedding,
        "face_crop_b64": face_crop_b64,
        "source_image_b64": source_b64,
        "quality_score": float(best_face.det_score),
    }
