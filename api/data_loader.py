import json
import os
import asyncio
import logging
from typing import Dict, Any, Optional
from mock_data import get_mock_data

logger = logging.getLogger("packetpulse.dataloader")

JSON_PATH = os.getenv("DPI_OUTPUT_PATH", os.path.join(os.path.dirname(os.path.dirname(__file__)), "output.json"))

class DataLoader:
    def __init__(self):
        self._cache: Optional[Dict[str, Any]] = None
        self._source = "mock"
        self._last_mtime = 0.0

    def get_data(self) -> Dict[str, Any]:
        """Returns the cached data, falling back to mock if empty."""
        if self._cache is None:
            return get_mock_data()
        return self._cache

    def get_source(self) -> str:
        return self._source

    async def poll_loop(self):
        """Background task to poll JSON file every 2 seconds and update memory cache."""
        logger.info(f"Starting DataLoader poll loop on {JSON_PATH}")
        while True:
            try:
                if os.path.exists(JSON_PATH):
                    mtime = os.path.getmtime(JSON_PATH)
                    if mtime > self._last_mtime:
                        with open(JSON_PATH, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            self._cache = data
                            self._source = "file"
                            self._last_mtime = mtime
                            logger.debug("Successfully updated cache from output.json")
                else:
                    self._cache = None
                    self._source = "mock"
            except Exception as e:
                logger.error(f"Error reading {JSON_PATH}: {e}")
                # Don't nullify cache if it's a momentary read error
            
            await asyncio.sleep(2.0)

# Global singleton instance
data_manager = DataLoader()
