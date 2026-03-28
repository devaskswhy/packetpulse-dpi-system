"""
PacketPulse DPI — FastAPI Backend
Bridge between C++ packet analyzer and the frontend dashboard.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import stats, flows, sni

app = FastAPI(
    title="PacketPulse DPI API",
    description="REST API bridge for the C++ deep packet inspection engine",
    version="0.1.0",
)

# ---------------------------------------------------------------------------
# CORS — allow the frontend (dev & prod) to call the API
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],            # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(stats.router, prefix="/stats", tags=["Stats"])
app.include_router(flows.router, prefix="/flows", tags=["Flows"])
app.include_router(sni.router,   prefix="/sni",   tags=["SNI"])


@app.get("/", tags=["Health"])
async def health_check():
    """Simple liveness probe."""
    return {
        "service": "packetpulse-api",
        "status": "healthy",
        "version": "0.1.0",
    }
