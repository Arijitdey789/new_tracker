"""
Recognition Service — API Router.

Endpoints:
  GET /api/v1/recognition/status — Current match state and statistics
"""

import importlib
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/recognition", tags=["recognition"])


@router.get("/status")
async def recognition_status():
    """Get the current recognition/matching status."""
    store_mod = importlib.import_module("services.watchlist-service.store")
    pipeline_mod = importlib.import_module("services.edge-inference.pipeline")

    store = store_mod.watchlist_store
    pipeline = pipeline_mod.pipeline

    return {
        "watchlist_count": store.count(),
        "pipeline_running": pipeline.is_running,
        "latest_match": pipeline.latest_match,
        "match_threshold": pipeline._match_threshold,
    }
