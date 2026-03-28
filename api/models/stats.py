"""Pydantic models for the /stats endpoint."""

from pydantic import BaseModel, Field


class ProtocolBreakdown(BaseModel):
    """Traffic share per protocol."""
    tcp: int   = Field(..., description="Total TCP packets")
    udp: int   = Field(..., description="Total UDP packets")
    other: int = Field(..., description="Non-TCP/UDP packets")


class PacketStats(BaseModel):
    """Aggregate counters for the capture window."""
    total_packets: int          = Field(..., description="Packets seen")
    total_bytes: int            = Field(..., description="Bytes on the wire")
    active_flows: int           = Field(..., description="Currently tracked flows")
    blocked_packets: int        = Field(..., description="Packets dropped by rules")
    protocols: ProtocolBreakdown
    capture_duration_sec: float = Field(..., description="Seconds since capture start")
    packets_per_sec: float      = Field(..., description="Average throughput")


class StatsResponse(BaseModel):
    """Top-level wrapper returned by GET /stats."""
    stats: PacketStats
