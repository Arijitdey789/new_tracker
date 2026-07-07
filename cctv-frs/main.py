"""
CCTV FRS — ASGI Entry Point.

Combines all service routers (watchlist-service, edge-inference,
recognition-service, iccc-bff) and initializes the shared
InsightFace ArcFace detection models on startup.

Architecture:
  - Core domain services: edge-inference, recognition-service, watchlist-service
  - BFF layer: iccc-bff (serves the SENTINEL PRO ICCC Dashboard SPA)
  - Frontend: frontends/iccc-dashboard/ (static SPA served by iccc-bff)
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
    """Lifecycle manager for model loading and pipeline cleanup."""
    # 1. Initialize InsightFace model
    edge_init = importlib.import_module("services.edge-inference")
    
    # Load model in a separate thread so it doesn't block the ASGI server startup
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, edge_init.init_face_app)
    except Exception as e:
        logger.error(f"Failed to load detection model during startup: {e}")

    # 2. Start the camera feed pipeline automatically (source 0)
    pipeline_mod = importlib.import_module("services.edge-inference.pipeline")
    try:
        await pipeline_mod.pipeline.start(source=0)
        logger.info("Camera pipeline auto-started successfully at startup.")
    except Exception as e:
        logger.error(f"Failed to auto-start camera pipeline: {e}")

    # 3. Start WebSocket broadcast loop (via iccc-bff)
    bff_router_mod = importlib.import_module("services.iccc-bff.router")
    broadcast_task = asyncio.create_task(bff_router_mod.broadcast_loop())

    yield

    # Cleanup
    logger.info("Shutting down CCTV FRS. Cleaning up pipelines...")
    broadcast_task.cancel()
    
    pipeline_mod = importlib.import_module("services.edge-inference.pipeline")
    await pipeline_mod.pipeline.stop()


# Initialize FastAPI APP
app = FastAPI(
    title="CCTV FRS",
    description="City-Scale CCTV Face Recognition & Tracking Pipeline (Target Detection & Verification)",
    version="1.0.0",
    lifespan=lifespan
)

# Load routers dynamically using importlib to bypass Python import syntax limits on hyphenated folders
watchlist_router = importlib.import_module("services.watchlist-service.router").router
edge_router = importlib.import_module("services.edge-inference.router").router
recognition_router = importlib.import_module("services.recognition-service.router").router
bff_router_mod = importlib.import_module("services.iccc-bff.router")

# Mount frontend static files first (SPA assets from frontends/iccc-dashboard/)
bff_router_mod.mount_static_files(app)

# Include Routers
app.include_router(watchlist_router)
app.include_router(edge_router)
app.include_router(recognition_router)
app.include_router(bff_router_mod.router)

logger.info("FastAPI Application initialized successfully with all dynamic routers.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
