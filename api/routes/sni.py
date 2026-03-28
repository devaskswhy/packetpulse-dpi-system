"""
GET /sni — Extracted domains (TLS SNI / HTTP Host / DNS).

Returns domain-level aggregation that mirrors the C++ engine's
SNIExtractor + ConnectionTracker classification output.
"""

from fastapi import APIRouter, Query

from models.sni import SNIResponse, DomainEntry

router = APIRouter()

# ---------------------------------------------------------------------------
# Mock data — will be replaced by C++ engine bridge / Redis cache
# ---------------------------------------------------------------------------
MOCK_DOMAINS: list[DomainEntry] = [
    DomainEntry(
        domain="www.youtube.com",
        app="YouTube",
        flow_count=18,
        total_bytes=24_117_248,
        blocked=False,
    ),
    DomainEntry(
        domain="*.facebook.com",
        app="Facebook",
        flow_count=7,
        total_bytes=1_572_864,
        blocked=True,
    ),
    DomainEntry(
        domain="www.reddit.com",
        app="Reddit",
        flow_count=4,
        total_bytes=524_288,
        blocked=False,
    ),
    DomainEntry(
        domain="dns.google",
        app="DNS",
        flow_count=42,
        total_bytes=53_760,
        blocked=False,
    ),
    DomainEntry(
        domain="*.tiktok.com",
        app="TikTok",
        flow_count=12,
        total_bytes=8_912_896,
        blocked=True,
    ),
    DomainEntry(
        domain="s3.amazonaws.com",
        app="AWS",
        flow_count=9,
        total_bytes=15_728_640,
        blocked=False,
    ),
    DomainEntry(
        domain="login.microsoftonline.com",
        app="Microsoft",
        flow_count=3,
        total_bytes=262_144,
        blocked=False,
    ),
    DomainEntry(
        domain="gateway.icloud.com",
        app="Apple",
        flow_count=5,
        total_bytes=786_432,
        blocked=False,
    ),
    DomainEntry(
        domain="*.netflix.com",
        app="Netflix",
        flow_count=14,
        total_bytes=41_943_040,
        blocked=False,
    ),
    DomainEntry(
        domain="api.twitter.com",
        app="Twitter/X",
        flow_count=6,
        total_bytes=1_048_576,
        blocked=False,
    ),
]


@router.get(
    "",
    response_model=SNIResponse,
    summary="Extracted domains",
    description="Returns domains extracted via TLS SNI, HTTP Host, and DNS inspection.",
)
async def get_sni(
    app: str | None = Query(None, description="Filter by application name"),
    blocked: bool | None = Query(None, description="Filter by blocked status"),
    limit: int = Query(50, ge=1, le=500, description="Max entries to return"),
):
    results = MOCK_DOMAINS

    if app is not None:
        results = [d for d in results if d.app.lower() == app.lower()]
    if blocked is not None:
        results = [d for d in results if d.blocked is blocked]

    results = results[:limit]
    return SNIResponse(total=len(results), domains=results)
