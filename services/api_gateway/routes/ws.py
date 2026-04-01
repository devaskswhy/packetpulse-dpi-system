"""
WebSocket endpoint: ws://host/ws/live

Uses the shared ConnectionManager. The data_loader pushes events via broadcast:
  - { "type": "stats", "data": {...} }       — every ~2s
  - { "type": "alert", "data": {...} }       — immediately on new alert
  - { "type": "flows_update", "count": N }   — on new flow flush

This endpoint simply keeps the connection alive and handles connect/disconnect.
Clients receive broadcasts from the data_loader loop.
"""

import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from connection_manager import ws_manager

router = APIRouter()
logger = logging.getLogger("api_gateway")


@router.websocket("/live")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket streaming endpoint.
    Connect via ws://localhost:8000/ws/live
    No auth required on WS (API key is for REST only).
    """
    await ws_manager.connect(websocket)
    try:
        # Keep connection alive — listen for client pings / close frames.
        # All data is pushed by data_loader via ws_manager.broadcast().
        while True:
            # Wait for client messages (ping/pong, or close).
            # If the client disconnects, this raises WebSocketDisconnect.
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except asyncio.CancelledError:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)
