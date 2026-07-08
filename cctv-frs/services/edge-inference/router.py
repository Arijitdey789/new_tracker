"""
Edge Inference Service — API Router.

Endpoints:
  GET  /api/v1/feed/stream  — MJPEG live stream with annotations
  POST /api/v1/feed/start   — Start camera capture
  POST /api/v1/feed/stop    — Stop camera capture
  GET  /api/v1/feed/status  — Pipeline status (FPS, camera state)
"""

import asyncio
import logging
import importlib
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/feed", tags=["edge-inference"])


def _get_pipeline(camera_id: str = "cam-0"):
    """Import the pipeline manager."""
    mod = importlib.import_module("services.edge-inference.pipeline")
    return mod.get_pipeline(camera_id)


@router.post("/start")
async def start_feed(
    source: str = Query(default="0", description="Camera index (0,1,...) or RTSP URL or video file path"),
    camera_id: str = Query(default="cam-0", description="Camera identifier")
):
    """Start the camera capture and detection pipeline."""
    pipeline = _get_pipeline(camera_id)

    # Parse source — integer for webcam index, string for URL/file
    try:
        cam_source = int(source)
    except ValueError:
        cam_source = source

    if pipeline.is_running:
        if pipeline._camera_source == cam_source:
            return {"status": "already_running", "fps": pipeline.fps}
        else:
            logger.info(f"Stopping active camera pipeline to switch source to: {cam_source}")
            await pipeline.stop()

    try:
        await pipeline.start(source=cam_source)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"status": "started", "source": str(cam_source)}


@router.post("/stop")
async def stop_feed(camera_id: str = Query(default="cam-0", description="Camera identifier")):
    """Stop the camera capture and pipeline."""
    pipeline = _get_pipeline(camera_id)
    await pipeline.stop()
    return {"status": "stopped"}


@router.get("/status")
async def feed_status(camera_id: str = Query(default="cam-0", description="Camera identifier")):
    """Get current pipeline status."""
    pipeline = _get_pipeline(camera_id)
    edge_init = importlib.import_module("services.edge-inference")

    return {
        "running": pipeline.is_running,
        "fps": round(pipeline.fps, 1),
        "model_loaded": edge_init.is_model_loaded(),
        "execution_provider": edge_init.get_execution_provider(),
        "latest_match": pipeline.latest_match,
    }


@router.get("/stream")
async def video_stream(camera_id: str = Query(default="cam-0", description="Camera identifier")):
    """
    MJPEG live stream endpoint.

    Returns annotated frames with bounding boxes around matched targets.
    Non-target faces are not annotated.
    """
    pipeline = _get_pipeline(camera_id)

    if not pipeline.is_running:
        raise HTTPException(
            status_code=409,
            detail="Camera feed is not running. Call POST /api/v1/feed/start first."
        )

    async def generate_frames():
        last_bytes = None
        while pipeline.is_running:
            frame_bytes = await pipeline.get_frame_jpeg()
            if frame_bytes and frame_bytes is not last_bytes:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n"
                    + frame_bytes
                    + b"\r\n"
                )
                last_bytes = frame_bytes
            await asyncio.sleep(0.016)  # ~60 FPS cap; actual rate limited by pipeline

    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.post("/threshold")
async def set_threshold(
    value: float = Query(..., ge=0.0, le=1.0, description="Match similarity threshold (0.0 to 1.0)"),
    camera_id: str = Query(default="cam-0", description="Camera identifier")
):
    """Update the match similarity threshold at runtime."""
    pipeline = _get_pipeline(camera_id)
    pipeline.set_threshold(value)
    return {"status": "updated", "threshold": value}
