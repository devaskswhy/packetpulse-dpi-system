"""Pydantic models for the /sni endpoint."""

from pydantic import BaseModel, Field


class DomainEntry(BaseModel):
    """A domain extracted via TLS SNI, HTTP Host, or DNS inspection."""
    domain: str       = Field(..., description="Extracted hostname / SNI")
    app: str          = Field(..., description="Classified application")
    flow_count: int   = Field(..., description="Number of flows to this domain")
    total_bytes: int  = Field(..., description="Aggregate bytes to this domain")
    blocked: bool     = Field(False, description="Whether this domain is blocked")


class SNIResponse(BaseModel):
    """Top-level wrapper returned by GET /sni."""
    total: int
    domains: list[DomainEntry]
