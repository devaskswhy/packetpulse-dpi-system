from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict
from data_loader import data_manager

router = APIRouter()

class StatsResponse(BaseModel):
    total_packets: int
    total_bytes: int
    blocked_count: int
    top_apps: Dict[str, int]

@router.get("", response_model=StatsResponse)
async def get_stats():
    data = data_manager.get_data()
    return data.get("stats", {})
