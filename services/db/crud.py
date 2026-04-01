import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy import select, update, insert, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert
from .models import Flow, Alert, Stats

async def upsert_flows(session: AsyncSession, flow_records: List[Dict[str, Any]]):
    """Batch upsert flows into PostgreSQL."""
    if not flow_records:
        return
        
    for chunk in [flow_records[i:i + 100] for i in range(0, len(flow_records), 100)]:
        stmt = pg_insert(Flow).values(chunk)
        update_cols = {
            col.name: stmt.excluded[col.name]
            for col in Flow.__table__.columns
            if col.name not in ["id", "flow_id"]
        }
        stmt = stmt.on_conflict_do_update(
            index_elements=["flow_id"],
            set_=update_cols
        )
        await session.execute(stmt)
    await session.commit()

async def insert_alert(session: AsyncSession, alert_record: Dict[str, Any]):
    """Insert a single alert."""
    # Convert string timestamp to datetime if necessary
    if isinstance(alert_record.get("ts"), str):
        try:
            alert_record["ts"] = datetime.datetime.fromisoformat(alert_record["ts"].replace("Z", "+00:00"))
        except:
            alert_record["ts"] = datetime.datetime.utcnow()
            
    stmt = insert(Alert).values(alert_record)
    await session.execute(stmt)
    await session.commit()

async def insert_stats(session: AsyncSession, stats_record: Dict[str, Any]):
    """Insert a single stats snapshot."""
    if isinstance(stats_record.get("ts"), (int, float)):
        stats_record["ts"] = datetime.datetime.fromtimestamp(stats_record["ts"])
    elif isinstance(stats_record.get("timestamp"), (int, float)):
        stats_record["ts"] = datetime.datetime.fromtimestamp(stats_record["timestamp"])
        del stats_record["timestamp"]
        
    # Map fields from stats_record to model fields
    model_data = {
        "ts": stats_record.get("ts", datetime.datetime.utcnow()),
        "total_packets": stats_record.get("total_packets", 0),
        "total_bytes": stats_record.get("total_bytes", 0),
        "blocked_count": stats_record.get("blocked_count", 0),
        "top_apps": stats_record.get("top_apps", {})
    }
    
    stmt = insert(Stats).values(model_data)
    await session.execute(stmt)
    await session.commit()

async def get_flows(
    session: AsyncSession, 
    page: int = 1, 
    limit: int = 50,
    filters: Dict[str, Any] = None
):
    """Query flows with pagination and filters."""
    query = select(Flow)
    
    if filters:
        if filters.get("src_ip"):
            query = query.where(Flow.src_ip == filters["src_ip"])
        if filters.get("dst_ip"):
            query = query.where(Flow.dst_ip == filters["dst_ip"])
        if filters.get("app"):
            query = query.where(Flow.app == filters["app"])
        if filters.get("protocol"):
            query = query.where(Flow.protocol == filters["protocol"])
        if filters.get("blocked") is not None:
            query = query.where(Flow.blocked == filters["blocked"])
        if filters.get("start_time"):
            query = query.where(Flow.last_seen >= filters["start_time"])
        if filters.get("end_time"):
            query = query.where(Flow.last_seen <= filters["end_time"])
            
    query = query.order_by(Flow.last_seen.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    
    result = await session.execute(query)
    return result.scalars().all()

async def get_stats_history(session: AsyncSession, hours: int = 24):
    """Get stats grouped by hour for the last X hours."""
    since = datetime.datetime.utcnow() - datetime.timedelta(hours=hours)
    
    query = select(
        func.date_trunc('hour', Stats.ts).label('hour'),
        func.avg(Stats.total_packets).label('avg_packets'),
        func.avg(Stats.total_bytes).label('avg_bytes'),
        func.avg(Stats.blocked_count).label('avg_blocked')
    ).where(Stats.ts >= since).group_by('hour').order_by('hour')
    
    result = await session.execute(query)
    return result.all()
