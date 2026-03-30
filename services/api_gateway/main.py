"""
PacketPulse DPI — FastAPI Backend
Bridge between C++ packet analyzer and the frontend dashboard.
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio

from routes import stats, flows, alerts, ws
from data_loader import data_manager

logger = logging.getLogger("api_gateway")

app = FastAPI(
    title="PacketPulse DPI API",
    description="REST API bridge for the C++ deep packet inspection engine",
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# Background Task
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup_event():
    logger.info("Starting api_gateway service")
    # Start the continuous polling task
    asyncio.create_task(data_manager.poll_loop())

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(stats.router, prefix="/stats", tags=["Stats"])
app.include_router(flows.router, prefix="/flows", tags=["Flows"])
app.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
app.include_router(ws.router, prefix="/ws", tags=["WebSockets"])

# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def health_check():
    """System health mapping."""
    return {
        "status": "ok",
        "source": data_manager.get_source()
    }
