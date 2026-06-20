from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True, slots=True)
class Settings:
    """Runtime configuration, read once from the environment / .env."""

    database_url: str  # SQLAlchemy URL, e.g. postgresql+psycopg://user:pw@host/db
    garmin_source: str = "python-garminconnect"
    garmin_email: str | None = None
    garmin_password: str | None = None
    garmin_token_store: str | None = None

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv()  # loads repo-root .env if present; real env always wins
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise RuntimeError("DATABASE_URL is not set (see .env.example)")
        return cls(
            database_url=url,
            garmin_source=os.environ.get("GARMIN_SOURCE", "python-garminconnect"),
            garmin_email=os.environ.get("GARMIN_EMAIL"),
            garmin_password=os.environ.get("GARMIN_PASSWORD"),
            garmin_token_store=os.environ.get("GARMIN_TOKEN_STORE"),
        )
