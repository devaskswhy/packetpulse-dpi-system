from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from data_loader import data_manager

router = APIRouter()

class AlertObj(BaseModel):
    type: str # "blocked" or "anomaly"
    ip: str
    reason: str
    ts: str

@router.get("", response_model=List[AlertObj])
async def get_alerts():
    data = data_manager.get_data()
    return data.get("alerts", [])
