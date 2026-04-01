"""
API Key authentication middleware.

Keys are stored in Redis set "api:keys".
All protected endpoints require a valid X-API-Key header.
"""

import os
import logging
from typing import Optional

from fastapi import Request, HTTPException, Security, Depends
from fastapi.security import APIKeyHeader

from redis_client import redis_client

logger = logging.getLogger("api_gateway")

ADMIN_SECRET = os.getenv("ADMIN_SECRET", "packetpulse-admin-secret")

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def validate_api_key(api_key: Optional[str] = Security(api_key_header)) -> str:
    """
    Dependency that validates the X-API-Key header against Redis set 'api:keys'.
    Returns the validated key on success, raises 401 on failure.
    """
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API key — provide X-API-Key header")

    try:
        is_valid = await redis_client.sismember("api:keys", api_key)
    except Exception as e:
        logger.error(f"Redis auth check failed: {e}")
        # If Redis is down, reject to be safe
        raise HTTPException(status_code=503, detail="Auth service unavailable")

    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid API key")

    return api_key


def validate_admin_secret(request: Request) -> str:
    """
    Dependency for admin-only endpoints.
    Validates the X-Admin-Secret header against ADMIN_SECRET env var.
    """
    secret = request.headers.get("X-Admin-Secret", "")
    if secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin secret")
    return secret
