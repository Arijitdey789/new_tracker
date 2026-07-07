"""
Trajectory Engine — API Router.

Endpoints:
  GET  /api/v1/trajectory/tracks              — List all active trajectories
  GET  /api/v1/trajectory/tracks/{target_id}  — Get trajectory for a target
  POST /api/v1/trajectory/clear               — Clear all trajectories
"""

import logging
import importlib
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/trajectory", tags=["trajectory"])


def _get_engine():
    """Lazy import to bypass hyphenated directory name."""
    mod = importlib.import_module("services.trajectory-engine.engine")
    return mod.trajectory_engine


@router.get("/tracks")
async def list_active_tracks():
    """List all active compiled suspect trajectories."""
    engine = _get_engine()
    return engine.list_tracks()


@router.get("/tracks/{target_id}")
async def get_target_track(target_id: str):
    """Retrieve the compiled trajectory file for a specific suspect."""
    engine = _get_engine()
    track = engine.get_track(target_id)
    if not track:
        raise HTTPException(
            status_code=404,
            detail=f"No active trajectory found for target '{target_id}'"
        )
    return track


@router.post("/clear")
async def clear_all_tracks():
    """Clear all active compiled trajectories."""
    engine = _get_engine()
    engine.clear_tracks()
    return {"status": "cleared"}
