"""
GET /flows — Active network flows.

Returns live flow data that mirrors the C++ engine's
ConnectionTracker flow table.
"""

from fastapi import APIRouter, Query

from models.flows import FlowsResponse, Flow

router = APIRouter()

# ---------------------------------------------------------------------------
# Mock data — will be replaced by C++ engine bridge / Redis cache
# ---------------------------------------------------------------------------
MOCK_FLOWS: list[Flow] = [
    Flow(
        src_ip="192.168.1.10",
        dst_ip="142.250.183.78",
        src_port=54312,
        dst_port=443,
        protocol="TCP",
        app="YouTube",
        packets=1_204,
        bytes=1_847_296,
        blocked=False,
    ),
    Flow(
        src_ip="192.168.1.10",
        dst_ip="157.240.1.35",
        src_port=49201,
        dst_port=443,
        protocol="TCP",
        app="Facebook",
        packets=342,
        bytes=218_560,
        blocked=True,
    ),
    Flow(
        src_ip="192.168.1.25",
        dst_ip="151.101.1.140",
        src_port=60122,
        dst_port=443,
        protocol="TCP",
        app="Reddit",
        packets=189,
        bytes=97_408,
        blocked=False,
    ),
    Flow(
        src_ip="192.168.1.25",
        dst_ip="8.8.8.8",
        src_port=51933,
        dst_port=53,
        protocol="UDP",
        app="DNS",
        packets=26,
        bytes=3_328,
        blocked=False,
    ),
    Flow(
        src_ip="192.168.1.30",
        dst_ip="52.94.236.248",
        src_port=44871,
        dst_port=443,
        protocol="TCP",
        app="AWS",
        packets=4_710,
        bytes=6_291_456,
        blocked=False,
    ),
    Flow(
        src_ip="192.168.1.30",
        dst_ip="104.16.85.20",
        src_port=55024,
        dst_port=443,
        protocol="TCP",
        app="TikTok",
        packets=876,
        bytes=1_310_720,
        blocked=True,
    ),
    Flow(
        src_ip="192.168.1.42",
        dst_ip="13.107.42.14",
        src_port=62011,
        dst_port=443,
        protocol="TCP",
        app="Microsoft",
        packets=512,
        bytes=393_216,
        blocked=False,
    ),
    Flow(
        src_ip="192.168.1.42",
        dst_ip="17.253.144.10",
        src_port=58340,
        dst_port=443,
        protocol="TCP",
        app="Apple",
        packets=98,
        bytes=65_536,
        blocked=False,
    ),
    Flow(
        src_ip="10.0.0.5",
        dst_ip="192.168.1.1",
        src_port=38901,
        dst_port=22,
        protocol="TCP",
        app="SSH",
        packets=2_340,
        bytes=327_680,
        blocked=False,
    ),
    Flow(
        src_ip="192.168.1.10",
        dst_ip="35.186.224.45",
        src_port=47802,
        dst_port=443,
        protocol="TCP",
        app="Netflix",
        packets=3_580,
        bytes=5_242_880,
        blocked=False,
    ),
]


@router.get(
    "",
    response_model=FlowsResponse,
    summary="Active network flows",
    description="Returns currently tracked flows from the DPI engine's connection table.",
)
async def get_flows(
    app: str | None = Query(None, description="Filter by application name"),
    blocked: bool | None = Query(None, description="Filter by blocked status"),
    limit: int = Query(50, ge=1, le=500, description="Max flows to return"),
):
    results = MOCK_FLOWS

    if app is not None:
        results = [f for f in results if f.app.lower() == app.lower()]
    if blocked is not None:
        results = [f for f in results if f.blocked is blocked]

    results = results[:limit]
    return FlowsResponse(total=len(results), flows=results)
