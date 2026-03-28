"""
GET /stats — Packet capture statistics.

Returns aggregate counters that mirror the C++ engine's
ConnectionTracker::getGlobalStats() output.
"""

from fastapi import APIRouter

from models.stats import StatsResponse, PacketStats, ProtocolBreakdown

router = APIRouter()

# ---------------------------------------------------------------------------
# Mock data — will be replaced by C++ engine bridge / Redis cache
# ---------------------------------------------------------------------------
MOCK_STATS = PacketStats(
    total_packets=584_213,
    total_bytes=437_812_480,
    active_flows=142,
    blocked_packets=3_871,
    protocols=ProtocolBreakdown(tcp=491_740, udp=88_902, other=3_571),
    capture_duration_sec=3_612.7,
    packets_per_sec=161.7,
)


@router.get(
    "",
    response_model=StatsResponse,
    summary="Packet capture summary",
    description="Returns aggregate packet statistics from the DPI engine.",
)
async def get_stats():
    return StatsResponse(stats=MOCK_STATS)
