"""
GET /flows — paginated, filtered network flows.

Query params:
  page, limit, src_ip, dst_ip, app, protocol, blocked, start, end
"""

import math
import datetime
from typing import Optional

from fastapi import APIRouter, Query, HTTPException, Depends
from pydantic import BaseModel, Field, field_validator

from auth import validate_api_key
from data_loader import data_manager
from redis_client import get_active_flows, get_flow
from db.session import AsyncSessionLocal
from db.crud import get_flows as db_get_flows

router = APIRouter()


# ── Pydantic models ────────────────────────────────────────────────────────

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


class PaginatedFlowsResponse(BaseModel):
    data: list[FlowObj]
    total: int
    page: int
    limit: int
    pages: int


class FlowFilterQuery(BaseModel):
    """Validated filter params for /flows endpoint."""
    page: int = Field(1, ge=1, description="Page number")
    limit: int = Field(50, ge=1, le=500, description="Items per page")
    src_ip: Optional[str] = Field(None, description="Filter by source IP (exact)")
    dst_ip: Optional[str] = Field(None, description="Filter by destination IP (exact)")
    app: Optional[str] = Field(None, description="Filter by app name (exact)")
    protocol: Optional[str] = Field(None, description="Filter by protocol (TCP/UDP)")
    blocked: Optional[bool] = Field(None, description="Filter blocked flows")
    start: Optional[datetime.datetime] = Field(None, description="Start time (ISO 8601)")
    end: Optional[datetime.datetime] = Field(None, description="End time (ISO 8601)")

    @field_validator("protocol")
    @classmethod
    def validate_protocol(cls, v):
        if v is not None and v.upper() not in ("TCP", "UDP", "ICMP"):
            raise ValueError("protocol must be TCP, UDP, or ICMP")
        return v.upper() if v else v


# ── Helper: filter in-memory flows ─────────────────────────────────────────

def _filter_flows(flows: list, q: FlowFilterQuery) -> list:
    """Apply query filters to an in-memory list of flow dicts."""
    result = flows
    if q.src_ip:
        result = [f for f in result if f.get("src_ip") == q.src_ip]
    if q.dst_ip:
        result = [f for f in result if f.get("dst_ip") == q.dst_ip]
    if q.app:
        result = [f for f in result if f.get("app") == q.app]
    if q.protocol:
        result = [f for f in result if f.get("protocol", "").upper() == q.protocol]
    if q.blocked is not None:
        result = [f for f in result if f.get("blocked") == q.blocked]
    if q.start:
        start_str = q.start.strftime("%Y-%m-%dT%H:%M:%SZ")
        result = [f for f in result if f.get("timestamp", "") >= start_str]
    if q.end:
        end_str = q.end.strftime("%Y-%m-%dT%H:%M:%SZ")
        result = [f for f in result if f.get("timestamp", "") <= end_str]
    return result


# ── Routes ──────────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedFlowsResponse)
async def get_flows(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    src_ip: Optional[str] = Query(None),
    dst_ip: Optional[str] = Query(None),
    app: Optional[str] = Query(None),
    protocol: Optional[str] = Query(None),
    blocked: Optional[bool] = Query(None),
    start: Optional[datetime.datetime] = Query(None),
    end: Optional[datetime.datetime] = Query(None),
    _key: str = Depends(validate_api_key),
):
    # Build validated query model (triggers 422 on bad input)
    q = FlowFilterQuery(
        page=page, limit=limit,
        src_ip=src_ip, dst_ip=dst_ip, app=app,
        protocol=protocol, blocked=blocked,
        start=start, end=end,
    )

    # 1. Try DB first
    try:
        async with AsyncSessionLocal() as session:
            filters = {
                "src_ip": q.src_ip,
                "dst_ip": q.dst_ip,
                "app": q.app,
                "protocol": q.protocol,
                "blocked": q.blocked,
                "start_time": q.start,
                "end_time": q.end,
            }
            db_flows = await db_get_flows(session, q.page, q.limit, filters)

            if db_flows:
                flows_out = []
                for f in db_flows:
                    flows_out.append(FlowObj(
                        timestamp=f.last_seen.isoformat() + "Z",
                        src_ip=f.src_ip, dst_ip=f.dst_ip,
                        src_port=f.src_port, dst_port=f.dst_port,
                        protocol=f.protocol, app=f.app,
                        sni=f.sni, bytes=f.bytes,
                        blocked=f.blocked, flow_id=f.flow_id,
                    ))

                # Get total count for pagination
                from sqlalchemy import select, func
                from db.models import Flow as FlowModel
                async with AsyncSessionLocal() as count_session:
                    count_q = select(func.count()).select_from(FlowModel)
                    if q.src_ip:
                        count_q = count_q.where(FlowModel.src_ip == q.src_ip)
                    if q.dst_ip:
                        count_q = count_q.where(FlowModel.dst_ip == q.dst_ip)
                    if q.app:
                        count_q = count_q.where(FlowModel.app == q.app)
                    if q.protocol:
                        count_q = count_q.where(FlowModel.protocol == q.protocol)
                    if q.blocked is not None:
                        count_q = count_q.where(FlowModel.blocked == q.blocked)
                    if q.start:
                        count_q = count_q.where(FlowModel.last_seen >= q.start)
                    if q.end:
                        count_q = count_q.where(FlowModel.last_seen <= q.end)
                    total = (await count_session.execute(count_q)).scalar() or 0

                return PaginatedFlowsResponse(
                    data=flows_out,
                    total=total,
                    page=q.page,
                    limit=q.limit,
                    pages=max(1, math.ceil(total / q.limit)),
                )
    except Exception:
        pass  # Fall through to Redis / in-memory

    # 2. Try Redis
    active_flows = await get_active_flows(limit=1000)

    if active_flows:
        all_flows = active_flows
    else:
        # 3. Fallback to in-memory
        data = data_manager.get_data()
        all_flows = list(data.get("flows", []))

    # Apply filters in memory
    filtered = _filter_flows(all_flows, q)
    total = len(filtered)
    start_idx = (q.page - 1) * q.limit
    paginated = filtered[start_idx : start_idx + q.limit]

    return PaginatedFlowsResponse(
        data=paginated,
        total=total,
        page=q.page,
        limit=q.limit,
        pages=max(1, math.ceil(total / q.limit)),
    )


@router.get("/{flow_id}", response_model=FlowObj)
async def get_single_flow(flow_id: str, _key: str = Depends(validate_api_key)):
    flow_record = await get_flow(flow_id)
    if flow_record:
        return flow_record

    # Fallback: scan in-memory
    data = data_manager.get_data()
    for f in data.get("flows", []):
        if f.get("flow_id") == flow_id:
            return f

    raise HTTPException(status_code=404, detail="Flow not found")
