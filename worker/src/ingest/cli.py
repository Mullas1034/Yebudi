from __future__ import annotations

import argparse
from datetime import date, datetime

from .config import Settings
from .db.engine import get_engine
from .pipeline import run_activity_sync, run_backfill, run_daily_sync
from .sources import get_source


def _parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="garmin-ingest", description="Garmin ingestion worker"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_daily = sub.add_parser("daily", help="sync a single day")
    p_daily.add_argument("--date", type=_parse_date, default=date.today())

    p_back = sub.add_parser("backfill", help="sync an inclusive date range")
    p_back.add_argument("--start", type=_parse_date, required=True)
    p_back.add_argument("--end", type=_parse_date, default=date.today())

    p_act = sub.add_parser("activity", help="sync a single activity by external id")
    p_act.add_argument("--id", required=True)

    sub.add_parser("login", help="authenticate to the source and cache tokens (interactive)")

    args = parser.parse_args(argv)

    settings = Settings.from_env()
    source = get_source(settings)

    if args.command == "login":
        if hasattr(source, "login"):
            source.login()
        else:
            print(f"source {settings.garmin_source!r} has no interactive login")
        return 0

    engine = get_engine(settings.database_url)
    if args.command == "daily":
        print(run_daily_sync(source, engine, args.date))
    elif args.command == "backfill":
        results = run_backfill(source, engine, args.start, args.end)
        ok = sum(1 for r in results if r.status == "success")
        print(f"{ok}/{len(results)} day(s) synced")
    elif args.command == "activity":
        print(run_activity_sync(source, engine, args.id))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
