"""
POST /admin/keys — manage API keys.

Protected by ADMIN_SECRET env var (X-Admin-Secret header).
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from auth import validate_admin_secret
from redis_client import redis_client

router = APIRouter()


class AddKeyRequest(BaseModel):
    key: str = Field(..., min_length=8, max_length=128, description="API key to register")


class AddKeyResponse(BaseModel):
    status: str
    key: str


@router.post("/keys", response_model=AddKeyResponse)
async def add_api_key(
    body: AddKeyRequest,
    _admin: str = Depends(validate_admin_secret),
):
    """Add a new API key to the Redis set 'api:keys'. Admin-only."""
    try:
        await redis_client.sadd("api:keys", body.key)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Failed to store key: {e}")

    return AddKeyResponse(status="created", key=body.key)
