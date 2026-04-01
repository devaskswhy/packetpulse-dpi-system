"""
GET /alerts — paginated, filtered alerts.

Query params:
  page, limit, type, severity, start, end
"""

import math
import datetime
from typing import Optional

from fastapi import APIRouter, Query, Depends
from pydantic import BaseModel, Field, field_validator

from auth import validate_api_key
from data_loader import data_manager
from db.session import AsyncSessionLocal
from sqlalchemy import select, func
from db.models import Alert

router = APIRouter()


# ── Pydantic models ────────────────────────────────────────────────────────

class AlertObj(BaseModel):
    type: str
    severity: Optional[str] = "medium"
    ip: str
    reason: str
    ts: str


class PaginatedAlertsResponse(BaseModel):
    data: list[AlertObj]
    total: int
    page: int
    limit: int
    pages: int


class AlertFilterQuery(BaseModel):
    """Validated filter params for /alerts endpoint."""
    page: int = Field(1, ge=1)
    limit: int = Field(50, ge=1, le=500)
    type: Optional[str] = Field(None, description="Filter by alert type (blocked/anomaly)")
    severity: Optional[str] = Field(None, description="Filter by severity (low/medium/high/critical)")
    start: Optional[datetime.datetime] = Field(None, description="Start time (ISO 8601)")
    end: Optional[datetime.datetime] = Field(None, description="End time (ISO 8601)")

    @field_validator("type")
    @classmethod
    def validate_type(cls, v):
        if v is not None and v not in ("blocked", "anomaly"):
            raise ValueError("type must be 'blocked' or 'anomaly'")
        return v

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v):
        if v is not None and v not in ("low", "medium", "high", "critical"):
            raise ValueError("severity must be low, medium, high, or critical")
        return v


# ── Helper ──────────────────────────────────────────────────────────────────

def _filter_alerts(alerts: list, q: AlertFilterQuery) -> list:
    result = alerts
    if q.type:
        result = [a for a in result if a.get("type") == q.type]
    if q.severity:
        result = [a for a in result if a.get("severity") == q.severity]
    if q.start:
        start_str = q.start.strftime("%Y-%m-%dT%H:%M:%SZ")
        result = [a for a in result if a.get("ts", "") >= start_str]
    if q.end:
        end_str = q.end.strftime("%Y-%m-%dT%H:%M:%SZ")
        result = [a for a in result if a.get("ts", "") <= end_str]
    return result


# ── Route ───────────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedAlertsResponse)
async def get_alerts(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    start: Optional[datetime.datetime] = Query(None),
    end: Optional[datetime.datetime] = Query(None),
    _key: str = Depends(validate_api_key),
):
    # Validate (triggers 422 on bad input)
    q = AlertFilterQuery(
        page=page, limit=limit,
        type=type, severity=severity,
        start=start, end=end,
    )

    # 1. Try DB first
    try:
        async with AsyncSessionLocal() as session:
            query = select(Alert).order_by(Alert.ts.desc())
            count_q = select(func.count()).select_from(Alert)

            if q.type:
                query = query.where(Alert.type == q.type)
                count_q = count_q.where(Alert.type == q.type)
            if q.severity:
                query = query.where(Alert.severity == q.severity)
                count_q = count_q.where(Alert.severity == q.severity)
            if q.start:
                query = query.where(Alert.ts >= q.start)
                count_q = count_q.where(Alert.ts >= q.start)
            if q.end:
                query = query.where(Alert.ts <= q.end)
                count_q = count_q.where(Alert.ts <= q.end)

            total = (await session.execute(count_q)).scalar() or 0
            query = query.offset((q.page - 1) * q.limit).limit(q.limit)
            result = await session.execute(query)
            db_alerts = result.scalars().all()

            if db_alerts:
                return PaginatedAlertsResponse(
                    data=[
                        AlertObj(
                            type=a.type,
                            severity=a.severity,
                            ip=a.src_ip if a.src_ip else "N/A",
                            reason=a.reason,
                            ts=a.ts.isoformat() + "Z",
                        )
                        for a in db_alerts
                    ],
                    total=total,
                    page=q.page,
                    limit=q.limit,
                    pages=max(1, math.ceil(total / q.limit)),
                )
    except Exception:
        pass

    # 2. Fallback to in-memory
    data = data_manager.get_data()
    all_alerts = data.get("alerts", [])
    filtered = _filter_alerts(all_alerts, q)
    total = len(filtered)
    start_idx = (q.page - 1) * q.limit
    paginated = filtered[start_idx : start_idx + q.limit]

    return PaginatedAlertsResponse(
        data=paginated,
        total=total,
        page=q.page,
        limit=q.limit,
        pages=max(1, math.ceil(total / q.limit)),
    )
