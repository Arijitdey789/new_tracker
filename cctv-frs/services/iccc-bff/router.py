"""
ICCC BFF — API Router & WebSocket Relay.

Endpoints:
  GET /              — Serve the ICCC Dashboard SPA (index.html)
  WS  /ws/events     — WebSocket relay for live match alerts from the pipeline event queue

This router replaces the old services/iccc-dashboard/router.py.
The key change is that it serves the full SENTINEL PRO SPA from
frontends/iccc-dashboard/ instead of a Jinja2 template, and acts
as a BFF gateway to core domain services.
"""

import logging
import asyncio
import importlib
import os
from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles

logger = logging.getLogger(__name__)

# ---- Path resolution ----
# The frontend SPA lives at: cctv-frs/frontends/iccc-dashboard/
_service_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(_service_dir))  # cctv-frs/
_frontend_dir = os.path.join(_project_root, "frontends", "iccc-dashboard")

router = APIRouter(tags=["dashboard"])

# ---- WebSocket Connection Tracking ----
_active_connections = []


def _get_pipeline():
    """Lazy import of edge pipeline to avoid circular dependency."""
    mod = importlib.import_module("services.edge-inference.pipeline")
    return mod.pipeline


@router.get("/", response_class=HTMLResponse)
async def dashboard_index(request: Request):
    """Serve the ICCC Dashboard SPA entry point."""
    index_path = os.path.join(_frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")
    return HTMLResponse("<h1>ICCC Dashboard not found</h1>", status_code=404)


@router.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    """
    WebSocket endpoint for real-time match events.

    Listens to the edge-inference event queue and broadcasts
    target matches to the connected dashboard clients.
    """
    await websocket.accept()
    _active_connections.append(websocket)
    logger.info(f"WebSocket client connected. Active: {len(_active_connections)}")

    try:
        # Keep connection open and check for events
        while True:
            # We just need to keep the socket alive. The background broadcaster (broadcast_loop)
            # handles sending data from the pipeline queue.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in _active_connections:
            _active_connections.remove(websocket)
        logger.info(f"WebSocket client disconnected. Active: {len(_active_connections)}")


async def broadcast_loop():
    """
    Background loop that polls events from the pipeline event_queue
    and broadcasts them directly to all active WebSocket clients.
    """
    logger.info("Starting dashboard WebSocket broadcast loop...")
    pipeline = _get_pipeline()

    while True:
        try:
            # Wait for an event from the pipeline
            event = await pipeline.event_queue.get()

            # Broadcast to all active clients
            if _active_connections:
                for conn in list(_active_connections):
                    try:
                        await conn.send_json(event)
                    except Exception as e:
                        logger.warning(f"Failed to send websocket message, removing client: {e}")
                        if conn in _active_connections:
                            _active_connections.remove(conn)

            pipeline.event_queue.task_done()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in WebSocket broadcast loop: {e}")
            await asyncio.sleep(1)


def datetime_to_iso(dt):
    """Format datetime helper."""
    from datetime import datetime
    if not dt:
        return datetime.utcnow().isoformat() + "Z"
    if isinstance(dt, datetime):
        return dt.isoformat() + "Z"
    return str(dt)


def mount_static_files(app):
    """
    Mount the ICCC Dashboard SPA static files into the main FastAPI application.

    Serves the entire frontends/iccc-dashboard/ directory tree so that
    the SPA's CSS, JS, and asset files are accessible via the web server.
    """
    if os.path.exists(_frontend_dir):
        # Mount the SPA source files (src/styles, src/components, etc.)
        src_dir = os.path.join(_frontend_dir, "src")
        config_dir = os.path.join(_frontend_dir, "config")
        public_dir = os.path.join(_frontend_dir, "public")

        if os.path.exists(src_dir):
            app.mount("/src", StaticFiles(directory=src_dir), name="frontend-src")
            logger.info(f"Mounted frontend src from: {src_dir}")

        if os.path.exists(config_dir):
            app.mount("/config", StaticFiles(directory=config_dir), name="frontend-config")
            logger.info(f"Mounted frontend config from: {config_dir}")

        if os.path.exists(public_dir):
            app.mount("/public", StaticFiles(directory=public_dir), name="frontend-public")
            logger.info(f"Mounted frontend public from: {public_dir}")
    else:
        logger.warning(f"Frontend directory not found at: {_frontend_dir}")
