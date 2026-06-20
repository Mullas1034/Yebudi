"""Deterministic in-memory adapter for smoke tests and CI.

Returns the same canned data the web dashboard mocks (web/lib/mock-data.ts), so an
ingested day lines up with what the UI shows. Everything is fixed and side-effect
free, so re-running a sync for the same day is byte-identical — which is exactly what
proves the raw dedupe and the curated upserts are idempotent.

    GARMIN_SOURCE=fake garmin-ingest daily --date 2026-06-19
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import ClassVar

from ..domain import (
    ActivityBundle,
    ActivityDTO,
    ActivitySampleDTO,
    ActivityZoneDTO,
    DailyBundle,
    DailySummaryDTO,
    Metric,
    MetricSampleDTO,
    RawRecord,
    SleepBundle,
    SleepSessionDTO,
    SleepStage,
    SleepStageDTO,
    StrengthSetDTO,
)
from .base import GarminSource

UTC = timezone.utc


class FakeSource(GarminSource):
    source_id: ClassVar[str] = "fake"

    def health_check(self) -> bool:
        return True

    def fetch_daily(self, day: date) -> DailyBundle:
        summary = DailySummaryDTO(
            day=day,
            readiness_score=82,
            readiness_status="primed",
            hrv_status="balanced",
            hrv_last_night_ms=68,
            hrv_weekly_avg_ms=64,
            hrv_baseline_low_ms=52,
            hrv_baseline_high_ms=78,
            body_battery_high=94,
            body_battery_low=18,
            body_battery_morning=88,
            sleep_score=79,
            sleep_duration_s=26280,
            resting_hr=48,
            stress_avg=28,
            training_load_acute=420.0,
            training_load_chronic=480.0,
            training_readiness=80,
        )

        morning = datetime(day.year, day.month, day.day, 6, 0, tzinfo=UTC)
        metrics = [
            MetricSampleDTO(morning, Metric.HEART_RATE, 52),
            MetricSampleDTO(morning + timedelta(minutes=1), Metric.HEART_RATE, 54),
            MetricSampleDTO(morning + timedelta(minutes=2), Metric.HEART_RATE, 51),
            MetricSampleDTO(morning, Metric.HRV, 68),
            MetricSampleDTO(morning, Metric.STRESS, 28),
            MetricSampleDTO(morning, Metric.BODY_BATTERY, 88),
        ]

        activity = self._activity(day, f"fake-{day.isoformat()}-1")

        return DailyBundle(
            day=day,
            raw=[
                RawRecord("daily_summary", _summary_payload(day), target_date=day),
                RawRecord("sleep", _sleep_payload(day), target_date=day),
                RawRecord(
                    "activity",
                    _activity_payload(day),
                    target_date=day,
                    external_id=activity.activity.external_id,
                ),
            ],
            summary=summary,
            metrics=metrics,
            sleep=self._sleep(day),
            activities=[activity],
        )

    def list_activities(self, start: date, end: date) -> list[str]:
        return [f"fake-{start.isoformat()}-1"]

    def fetch_activity(self, external_id: str) -> ActivityBundle:
        # external_id encodes the day: fake-YYYY-MM-DD-N
        try:
            day = date.fromisoformat("-".join(external_id.split("-")[1:4]))
        except ValueError:
            day = date(2026, 6, 19)
        bundle = self._activity(day, external_id)
        return ActivityBundle(
            activity=bundle.activity,
            raw=[
                RawRecord(
                    "activity", _activity_payload(day), target_date=day, external_id=external_id
                )
            ],
            strength_sets=bundle.strength_sets,
            zones=bundle.zones,
            samples=bundle.samples,
        )

    # ── builders ────────────────────────────────────────────────────────────

    def _sleep(self, day: date) -> SleepBundle:
        midnight = datetime(day.year, day.month, day.day, tzinfo=UTC)
        start = midnight - timedelta(hours=1, minutes=3)  # 22:57 the night before
        plan = [
            (SleepStage.LIGHT, 1800),
            (SleepStage.DEEP, 5400),
            (SleepStage.REM, 3240),
            (SleepStage.LIGHT, 12600),
            (SleepStage.REM, 3240),
            (SleepStage.AWAKE, 900),
        ]
        stages: list[SleepStageDTO] = []
        cursor = start
        for stage, dur in plan:
            nxt = cursor + timedelta(seconds=dur)
            stages.append(SleepStageDTO(cursor, nxt, stage))
            cursor = nxt
        session = SleepSessionDTO(
            day=day,
            start_ts=start,
            end_ts=cursor,
            sleep_score=79,
            deep_s=5400,
            light_s=14400,
            rem_s=6480,
            awake_s=900,
            avg_hrv_ms=66,
            avg_spo2=96,
            avg_respiration=14.2,
            resting_hr=48,
        )
        return SleepBundle(session=session, stages=stages)

    def _activity(self, day: date, external_id: str) -> ActivityBundle:
        start = datetime(day.year, day.month, day.day, 17, 0, tzinfo=UTC)
        activity = ActivityDTO(
            external_id=external_id,
            sport="strength_training",
            sub_sport="indoor",
            name="Push Day",
            start_ts=start,
            end_ts=start + timedelta(minutes=58),
            duration_s=3480,
            moving_s=2400,
            distance_m=None,
            calories=320,
            avg_hr=118,
            max_hr=156,
            training_load=180.0,
            aerobic_te=2.4,
            anaerobic_te=1.1,
            rpe=7,
        )
        sets = [
            StrengthSetDTO(1, "bench_press", "BENCH_PRESS", 8, 80.0, 90, start + timedelta(minutes=5), 40),
            StrengthSetDTO(2, "bench_press", "BENCH_PRESS", 8, 82.5, 90, start + timedelta(minutes=8), 40),
        ]
        zones = [
            ActivityZoneDTO(2, 1200, 110, 130),
            ActivityZoneDTO(3, 900, 131, 150),
        ]
        samples = [
            ActivitySampleDTO(start, 0, 96),
            ActivitySampleDTO(start + timedelta(seconds=60), 60, 122),
            ActivitySampleDTO(start + timedelta(seconds=120), 120, 138),
        ]
        return ActivityBundle(activity=activity, strength_sets=sets, zones=zones, samples=samples)


def _summary_payload(day: date) -> dict:
    return {"calendarDate": day.isoformat(), "source": "fake", "bodyBatteryMostRecentValue": 88}


def _sleep_payload(day: date) -> dict:
    return {"calendarDate": day.isoformat(), "overallSleepScore": 79, "deepSleepSeconds": 5400}


def _activity_payload(day: date) -> dict:
    return {"activityId": f"fake-{day.isoformat()}-1", "activityType": "strength_training"}
