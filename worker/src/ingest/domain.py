"""Vendor-agnostic data shapes.

These DTOs are what adapters produce and the pipeline consumes. They map 1:1 onto
the curated tables and deliberately know nothing about Garmin's JSON or FIT files.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from enum import StrEnum


class Metric(StrEnum):
    HEART_RATE = "heart_rate"
    HRV = "hrv"
    STRESS = "stress"
    RESPIRATION = "respiration"
    SPO2 = "spo2"
    BODY_BATTERY = "body_battery"


class SleepStage(StrEnum):
    DEEP = "deep"
    LIGHT = "light"
    REM = "rem"
    AWAKE = "awake"


@dataclass(frozen=True, slots=True)
class RawRecord:
    """An untouched payload destined for raw.garmin_response."""

    endpoint: str
    payload: dict
    target_date: date | None = None
    external_id: str | None = None


# ── Curated row DTOs ────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class MetricSampleDTO:
    ts: datetime  # tz-aware UTC
    metric: Metric
    value: float


@dataclass(frozen=True, slots=True)
class DailySummaryDTO:
    day: date
    readiness_score: int | None = None
    readiness_status: str | None = None
    hrv_status: str | None = None
    hrv_last_night_ms: int | None = None
    hrv_weekly_avg_ms: int | None = None
    hrv_baseline_low_ms: int | None = None
    hrv_baseline_high_ms: int | None = None
    body_battery_high: int | None = None
    body_battery_low: int | None = None
    body_battery_morning: int | None = None
    sleep_score: int | None = None
    sleep_duration_s: int | None = None
    resting_hr: int | None = None
    stress_avg: int | None = None
    training_load_acute: float | None = None
    training_load_chronic: float | None = None
    training_readiness: int | None = None


@dataclass(frozen=True, slots=True)
class SleepStageDTO:
    start_ts: datetime
    end_ts: datetime
    stage: SleepStage


@dataclass(frozen=True, slots=True)
class SleepSessionDTO:
    day: date
    start_ts: datetime
    end_ts: datetime
    sleep_score: int | None = None
    deep_s: int | None = None
    light_s: int | None = None
    rem_s: int | None = None
    awake_s: int | None = None
    avg_hrv_ms: int | None = None
    avg_spo2: int | None = None
    avg_respiration: float | None = None
    resting_hr: int | None = None


@dataclass(frozen=True, slots=True)
class StrengthSetDTO:
    set_index: int
    exercise: str | None = None
    exercise_category: str | None = None
    reps: int | None = None
    weight_kg: float | None = None
    rest_s: int | None = None
    start_ts: datetime | None = None
    duration_s: int | None = None


@dataclass(frozen=True, slots=True)
class ActivityZoneDTO:
    zone: int
    seconds_in: int
    low_bpm: int | None = None
    high_bpm: int | None = None


@dataclass(frozen=True, slots=True)
class ActivitySampleDTO:
    ts: datetime
    elapsed_s: int | None = None
    hr: int | None = None
    speed_mps: float | None = None
    cadence: int | None = None
    power_w: int | None = None
    altitude_m: float | None = None
    lat: float | None = None
    lon: float | None = None


@dataclass(frozen=True, slots=True)
class ActivityDTO:
    external_id: str
    sport: str
    start_ts: datetime
    sub_sport: str | None = None
    name: str | None = None
    end_ts: datetime | None = None
    duration_s: int | None = None
    moving_s: int | None = None
    distance_m: float | None = None
    calories: int | None = None
    avg_hr: int | None = None
    max_hr: int | None = None
    training_load: float | None = None
    aerobic_te: float | None = None
    anaerobic_te: float | None = None
    rpe: int | None = None


# ── Bundles: what adapters return ───────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class SleepBundle:
    session: SleepSessionDTO
    stages: list[SleepStageDTO] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class ActivityBundle:
    activity: ActivityDTO
    raw: list[RawRecord] = field(default_factory=list)
    strength_sets: list[StrengthSetDTO] = field(default_factory=list)
    zones: list[ActivityZoneDTO] = field(default_factory=list)
    samples: list[ActivitySampleDTO] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class DailyBundle:
    day: date
    raw: list[RawRecord] = field(default_factory=list)
    summary: DailySummaryDTO | None = None
    metrics: list[MetricSampleDTO] = field(default_factory=list)
    sleep: SleepBundle | None = None
    activities: list[ActivityBundle] = field(default_factory=list)
