from __future__ import annotations

from ..config import Settings
from .base import GarminSource
from .fake import FakeSource
from .garminconnect import GarminConnectSource


def get_source(settings: Settings) -> GarminSource:
    """Resolve the configured adapter.

    This factory is the single place that knows which concrete sources exist.
    Add FitFileSource / OfficialApiSource here — callers keep using GarminSource.
    """
    name = settings.garmin_source
    if name == "python-garminconnect":
        return GarminConnectSource(
            email=settings.garmin_email,
            password=settings.garmin_password,
            token_store=settings.garmin_token_store,
        )
    if name == "fake":
        return FakeSource()
    # if name == "fit-file":
    #     return FitFileSource(settings.fit_dir)
    raise ValueError(f"unknown GARMIN_SOURCE: {name!r}")


__all__ = ["FakeSource", "GarminConnectSource", "GarminSource", "get_source"]
