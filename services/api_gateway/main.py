"""
PacketPulse DPI — FastAPI Backend (Production)

Features:
  - Paginated + filtered /flows and /alerts endpoints
  - API key auth (Redis-backed)
  - Per-IP rate limiting (slowapi, 100/min)
  - WebSocket broadcast (stats every 2s, alerts + flow flushes immediately)
  - FastAPI lifespan for startup/shutdown
"""

import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from routes import stats, flows, alerts, ws, admin
from data_loader import data_manager
from connection_manager import ws_manager

logger = logging.getLogger("api_gateway")

# ---------------------------------------------------------------------------
# Rate Limiter  (100 requests/min per IP)
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


# ---------------------------------------------------------------------------
# Lifespan (replaces deprecated on_event)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("PacketPulse API Gateway starting up")
    poll_task = asyncio.create_task(data_manager.poll_loop())
    yield
    logger.info("PacketPulse API Gateway shutting down")
    poll_task.cancel()
    try:
        await poll_task
    except asyncio.CancelledError:
        pass
    await ws_manager.disconnect_all()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="PacketPulse DPI API",
    description="Production-grade REST + WebSocket API for the C++ deep packet inspection engine",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
app.include_router(admin.router, prefix="/admin", tags=["Admin"])

# ---------------------------------------------------------------------------
# Health Check (always public — no auth required)
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
async def health_check():
    """System health — always public."""
    return {
        "status": "ok",
        "source": data_manager.get_source(),
        "ws_clients": ws_manager.count,
    }
