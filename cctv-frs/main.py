"""
CCTV FRS — ASGI Entry Point.

Combines all service routers and initializes the full pipeline on startup:
  - L1 Edge:  edge-inference (detect + embed + track)
  - L4 Match: recognition-service, watchlist-service
  - L5 Track: trajectory-engine (spatio-temporal gating)
  - L6 Alert: alert-service (orchestration + operator decisions)
  - L7 ICCC:  iccc-bff (dashboard SPA + WebSocket relay)
  - Cross:    audit-service (immutable hash-chained ledger)
  - Cross:    evidentiary-service (clip stitching + SHA-256 chain of custody)

Architecture:
  Pipeline events flow:
    EdgePipeline → event_queue → broadcast_loop → WebSocket clients
                                                 → Event Bus → Trajectory Engine
                                                             → Alert Service
                                                             → Audit Service
                                                             → Evidentiary Service
"""

import logging
import asyncio
import importlib
from fastapi import FastAPI
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("cctv-frs.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager — starts all services on boot, cleans up on shutdown."""

    # ── 1. Load InsightFace model ─────────────────────────────────────
    edge_init = importlib.import_module("services.edge-inference")
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, edge_init.init_face_app)
    except Exception as e:
        logger.error(f"Failed to load detection model during startup: {e}")

    # ── 2. Start the camera feed pipeline (source 0) ──────────────────
    pipeline_mod = importlib.import_module("services.edge-inference.pipeline")
    try:
        await pipeline_mod.pipeline.start(source=0)
        logger.info("Camera pipeline auto-started successfully at startup.")
    except Exception as e:
        logger.error(f"Failed to auto-start camera pipeline: {e}")

    # ── 3. Start the WebSocket broadcast loop (+ Event Bus bridge) ────
    bff_router_mod = importlib.import_module("services.iccc-bff.router")
    broadcast_task = asyncio.create_task(bff_router_mod.broadcast_loop())

    # ── 4. Start Audit Service (must be first consumer so nothing is missed) ─
    audit_mod = importlib.import_module("services.audit-service.ledger")
    await audit_mod.audit_ledger.start()

    # ── 5. Start Trajectory Engine ────────────────────────────────────
    traj_mod = importlib.import_module("services.trajectory-engine.engine")
    await traj_mod.trajectory_engine.start()

    # ── 6. Start Alert Service ────────────────────────────────────────
    alert_mod = importlib.import_module("services.alert-service.service")
    await alert_mod.alert_service.start()

    # ── 7. Start Evidentiary Service ──────────────────────────────────
    evid_mod = importlib.import_module("services.evidentiary-service.stitcher")
    await evid_mod.evidentiary_service.start()

    logger.info("All CCTV FRS services started successfully.")

    yield

    # ── Cleanup ───────────────────────────────────────────────────────
    logger.info("Shutting down CCTV FRS. Cleaning up all services...")
    broadcast_task.cancel()

    await evid_mod.evidentiary_service.stop()
    await alert_mod.alert_service.stop()
    await traj_mod.trajectory_engine.stop()
    await audit_mod.audit_ledger.stop()
    await pipeline_mod.pipeline.stop()
    logger.info("All services stopped.")


# ── Initialize FastAPI App ────────────────────────────────────────────
app = FastAPI(
    title="CCTV FRS",
    description="City-Scale CCTV Face Recognition & Tracking Pipeline",
    version="2.0.0",
    lifespan=lifespan
)

# ── Load routers dynamically (bypasses Python syntax limits on hyphens) ─
watchlist_router = importlib.import_module("services.watchlist-service.router").router
edge_router = importlib.import_module("services.edge-inference.router").router
recognition_router = importlib.import_module("services.recognition-service.router").router
trajectory_router = importlib.import_module("services.trajectory-engine.router").router
alert_router = importlib.import_module("services.alert-service.router").router
audit_router = importlib.import_module("services.audit-service.router").router
bff_router_mod = importlib.import_module("services.iccc-bff.router")

# Mount frontend static files first (SPA assets from frontends/iccc-dashboard/)
bff_router_mod.mount_static_files(app)

# Include Routers
app.include_router(watchlist_router)
app.include_router(edge_router)
app.include_router(recognition_router)
app.include_router(trajectory_router)
app.include_router(alert_router)
app.include_router(audit_router)
app.include_router(bff_router_mod.router)

logger.info("FastAPI Application initialized with all service routers.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
