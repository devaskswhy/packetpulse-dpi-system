"""
GET /stats — aggregate statistics.
GET /stats/history — hourly history.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Dict, List, Any

from auth import validate_api_key
from data_loader import data_manager
from redis_client import get_cached_stats, set_cached_stats
from db.session import AsyncSessionLocal
from db.crud import get_stats_history

router = APIRouter()


class StatsResponse(BaseModel):
    total_packets: int
    total_bytes: int
    blocked_count: int
    top_apps: Dict[str, int]


@router.get("", response_model=StatsResponse)
async def get_stats(_key: str = Depends(validate_api_key)):
    cached = await get_cached_stats()
    if cached and cached.get("total_packets", 0) > 0:
        return cached

    data = data_manager.get_data()
    stats = data.get("stats", {})

    if stats:
        await set_cached_stats(stats)

    return stats


@router.get("/history")
async def get_history(hours: int = 24, _key: str = Depends(validate_api_key)):
    try:
        async with AsyncSessionLocal() as session:
            history = await get_stats_history(session, hours)
            return [
                {
                    "hour": row.hour.isoformat() + "Z",
                    "avg_packets": float(row.avg_packets),
                    "avg_bytes": float(row.avg_bytes),
                    "avg_blocked": float(row.avg_blocked),
                }
                for row in history
            ]
    except Exception:
        return []
