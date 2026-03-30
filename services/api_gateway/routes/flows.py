from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List, Optional
from data_loader import data_manager

router = APIRouter()

class FlowObj(BaseModel):
    timestamp: str
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str
    app: str
    sni: Optional[str] = None
    bytes: int
    blocked: bool
    flow_id: str

class FlowsResponse(BaseModel):
    total: int
    page: int
    limit: int
    flows: List[FlowObj]

@router.get("", response_model=FlowsResponse)
async def get_flows(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=500, description="Items per page"),
):
    data = data_manager.get_data()
    all_flows = data.get("flows", [])
    
    start = (page - 1) * limit
    end = start + limit
    paginated = all_flows[start:end]

    return FlowsResponse(
        total=len(all_flows),
        page=page,
        limit=limit,
        flows=paginated
    )
