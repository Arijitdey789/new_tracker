"""
Watchlist Service — API Router.

Endpoints:
  POST /api/v1/watchlist/enroll   — Upload target image, extract embedding, store
  GET  /api/v1/watchlist/targets  — List all enrolled targets
  DELETE /api/v1/watchlist/targets/{target_id} — Remove a target
"""

import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/watchlist", tags=["watchlist"])


def _get_face_app():
    """Lazy import to avoid circular dependency at module load time."""
    import importlib
    edge_init = importlib.import_module("services.edge-inference")
    return edge_init.get_face_app()


def _get_store():
    """Import the singleton watchlist store."""
    import importlib
    store_mod = importlib.import_module("services.watchlist-service.store")
    return store_mod.watchlist_store


@router.post("/enroll")
async def enroll_target(
    file: UploadFile = File(..., description="Target face image (JPEG/PNG)"),
    target_name: Optional[str] = Form(default="Unknown Target"),
):
    """
    Enroll a target into the watchlist.

    1. Reads the uploaded image
    2. Detects the face and extracts the 512-d ArcFace embedding
    3. Stores the embedding in the watchlist
    4. Returns the target_id and face crop preview
    """
    import importlib
    enrollment_mod = importlib.import_module("services.watchlist-service.enrollment")

    # Read file bytes
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    # Get the shared InsightFace model
    face_app = _get_face_app()
    if face_app is None:
        raise HTTPException(
            status_code=503,
            detail="Face detection model is still loading. Please try again in a few seconds."
        )

    # Extract face embedding
    try:
        result = enrollment_mod.extract_face_embedding(image_bytes, face_app)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Store in watchlist
    store = _get_store()
    entry = store.enroll(
        target_name=target_name,
        embedding=result["embedding"],
        source_image_b64=result["source_image_b64"],
        face_crop_b64=result["face_crop_b64"],
    )

    logger.info(f"Enrolled target: id={entry.target_id}, name={entry.target_name}")

    return {
        "status": "enrolled",
        "target_id": entry.target_id,
        "target_name": entry.target_name,
        "quality_score": result["quality_score"],
        "embedding_dim": len(result["embedding"]),
        "face_crop_b64": result["face_crop_b64"],
    }


@router.get("/targets")
async def list_targets():
    """List all enrolled targets in the watchlist."""
    store = _get_store()
    entries = store.list_all()
    return {
        "count": len(entries),
        "targets": [
            {
                "target_id": e.target_id,
                "target_name": e.target_name,
                "enrolled_at": e.enrolled_at.isoformat(),
                "face_crop_b64": e.face_crop_b64,
            }
            for e in entries
        ],
    }


@router.delete("/targets/{target_id}")
async def remove_target(target_id: str):
    """Remove a target from the watchlist."""
    store = _get_store()
    removed = store.remove(target_id)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Target '{target_id}' not found")
    logger.info(f"Removed target: {target_id}")
    return {"status": "removed", "target_id": target_id}
