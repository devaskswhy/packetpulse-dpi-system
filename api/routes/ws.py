"""
WebSocket endpoint for real-time dashboard updates.

Streams the latest stats, flows, and alerts to connected clients.
"""

import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from data_loader import data_manager

router = APIRouter()
logger = logging.getLogger("packetpulse.ws")

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Error sending to websocket: {e}")
                self.disconnect(connection)

manager = ConnectionManager()

@router.websocket("/live")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket streaming endpoint. Connect via ws://localhost:8000/ws/live
    Emits cached data every 1.5 seconds.
    """
    await manager.connect(websocket)
    try:
        while True:
            # Continuously fetch the memory cached data (updated by poll loop)
            current_data = data_manager.get_data()
            source = data_manager.get_source()
            
            data_package = {
                "source": source,
                "stats": current_data.get("stats", {}),
                "flows": current_data.get("flows", []),
                "alerts": current_data.get("alerts", [])
            }

            await websocket.send_json(data_package)
            await asyncio.sleep(1.5)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except asyncio.CancelledError:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
