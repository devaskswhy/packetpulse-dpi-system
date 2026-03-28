"""Pydantic models for the /flows endpoint."""

from pydantic import BaseModel, Field


class Flow(BaseModel):
    """A single network flow (five-tuple + metadata)."""
    src_ip: str    = Field(..., description="Source IP address")
    dst_ip: str    = Field(..., description="Destination IP address")
    src_port: int  = Field(..., description="Source port")
    dst_port: int  = Field(..., description="Destination port")
    protocol: str  = Field(..., description="Transport protocol (TCP/UDP)")
    app: str       = Field(..., description="Classified application name")
    packets: int   = Field(..., description="Packet count for this flow")
    bytes: int     = Field(..., description="Byte count for this flow")
    blocked: bool  = Field(False, description="Whether this flow is blocked by a rule")


class FlowsResponse(BaseModel):
    """Top-level wrapper returned by GET /flows."""
    total: int
    flows: list[Flow]
