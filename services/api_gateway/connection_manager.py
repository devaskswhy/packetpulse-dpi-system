"""
WebSocket ConnectionManager — manages active connections and broadcasting.

Used by ws.py and data_loader.py to push real-time events to all connected clients.
"""

import logging
from typing import Set
from fastapi import WebSocket

logger = logging.getLogger("api_gateway")


class ConnectionManager:
    """Manages a set of active WebSocket connections."""

    def __init__(self):
        self._active: Set[WebSocket] = set()

    @property
    def count(self) -> int:
        return len(self._active)

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self._active.add(websocket)
        logger.info(f"WS client connected — {self.count} active")

    def disconnect(self, websocket: WebSocket):
        self._active.discard(websocket)
        logger.info(f"WS client disconnected — {self.count} active")

    async def broadcast(self, message: dict):
        """Send a JSON message to every connected client. Removes stale connections."""
        stale = []
        for ws in list(self._active):
            try:
                await ws.send_json(message)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self._active.discard(ws)

    async def disconnect_all(self):
        """Gracefully close all connections (used at shutdown)."""
        for ws in list(self._active):
            try:
                await ws.close(code=1001, reason="Server shutdown")
            except Exception:
                pass
        self._active.clear()


# Global singleton
ws_manager = ConnectionManager()
