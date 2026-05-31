"""Health-check endpoint."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings

router = APIRouter(tags=["system"])

SettingsDep = Annotated[Settings, Depends(get_settings)]


@router.get("/health")
def health(settings: SettingsDep) -> dict[str, str]:
    """Return application status. No secrets leaked — environment only."""
    return {
        "status": "ok",
        "environment": settings.environment,
    }
