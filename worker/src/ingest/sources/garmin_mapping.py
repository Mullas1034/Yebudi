"""Pure payload -> DTO mappers for the python-garminconnect responses.

No network, no DB — just dict-in / DTO-out, so this is unit-testable in isolation.

Field names are based on observed Garmin Connect responses but Garmin changes shapes
between firmware/app versions. Everything uses defensive ``.get()`` and numeric
coercion, and anything uncertain is flagged ``VERIFY`` — confirm against the stored
``raw.garmin_response`` payloads and adjust here (no re-fetch needed; raw is the
source of truth).
"""

from __future__ import annotations

from dataclasses import replace
from datetime import date, datetime, timedelta, timezone

from ..domain import (
    ActivityDTO,
    ActivitySampleDTO,
    ActivityZoneDTO,
    DailySummaryDTO,
    Metric,
    MetricSampleDTO,
    SleepBundle,
    SleepSessionDTO,
    SleepStage,
    SleepStageDTO,
    StrengthSetDTO,
)

UTC = timezone.utc

# VERIFY against raw: Garmin `sleepLevels[].activityLevel` encoding.
SLEEP_STAGE_BY_LEVEL: dict[int, SleepStage] = {
    0: SleepStage.DEEP,
    1: SleepStage.LIGHT,
    2: SleepStage.REM,
    3: SleepStage.AWAKE,
}


# ── coercion / time helpers ─────────────────────────────────────────────────


def _int(x: object) -> int | None:
    return int(round(x)) if isinstance(x, (int, float)) and not isinstance(x, bool) else None


def _float(x: object) -> float | None:
    return float(x) if isinstance(x, (int, float)) and not isinstance(x, bool) else None


def _lower(x: object) -> str | None:
    return x.lower() if isinstance(x, str) else None


def _ts_from_ms(ms: object) -> datetime | None:
    if not isinstance(ms, (int, float)):
        return None
    return datetime.fromtimestamp(ms / 1000, tz=UTC)


def _ts_from_gmt(s: object) -> datetime | None:
    if not s:
        return None
    text = str(s).replace("Z", "").replace(" ", "T")
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=UTC)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text).replace(tzinfo=UTC)
    except ValueError:
        return None


def _ts_any(v: object) -> datetime | None:
    """Garmin timestamps are sometimes epoch-ms ints, sometimes GMT strings."""
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return _ts_from_ms(v)
    return _ts_from_gmt(v)


def _first(x: object) -> dict:
    if isinstance(x, list):
        return x[0] if x else {}
    return x if isinstance(x, dict) else {}


def _g(activity: dict | None, *keys: str) -> object:
    """Read a key from the activity top-level or its nested summaryDTO."""
    src = activity or {}
    nested = src.get("summaryDTO") if isinstance(src.get("summaryDTO"), dict) else {}
    for key in keys:
        if src.get(key) is not None:
            return src[key]
        if nested.get(key) is not None:
            return nested[key]
    return None


# ── daily summary ───────────────────────────────────────────────────────────


def map_daily_summary(
    day: date,
    summary: dict | None = None,
    hrv: dict | None = None,
    sleep: dict | None = None,
    readiness: object = None,
    training_status: dict | None = None,
) -> DailySummaryDTO:
    s = summary or {}
    hrv_summary = (hrv or {}).get("hrvSummary") or {}
    baseline = hrv_summary.get("baseline") or {}
    tr = _first(readiness)

    sleep_dto = (sleep or {}).get("dailySleepDTO") or {}
    overall = (sleep_dto.get("sleepScores") or {}).get("overall") or {}

    acute, chronic = _training_load(training_status or {})

    return DailySummaryDTO(
        day=day,
        readiness_score=_int(tr.get("score")),
        readiness_status=_lower(tr.get("level")),
        hrv_status=_lower(hrv_summary.get("status")),
        hrv_last_night_ms=_int(hrv_summary.get("lastNightAvg")),
        hrv_weekly_avg_ms=_int(hrv_summary.get("weeklyAvg")),
        hrv_baseline_low_ms=_int(baseline.get("balancedLow") or baseline.get("lowUpper")),
        hrv_baseline_high_ms=_int(baseline.get("balancedUpper") or baseline.get("markerValue")),
        body_battery_high=_int(s.get("bodyBatteryHighestValue")),
        body_battery_low=_int(s.get("bodyBatteryLowestValue")),
        body_battery_morning=_int(s.get("bodyBatteryMostRecentValue")),
        sleep_score=_int(overall.get("value") or sleep_dto.get("sleepScore")),
        sleep_duration_s=_int(sleep_dto.get("sleepTimeSeconds")),
        resting_hr=_int(s.get("restingHeartRate")),
        stress_avg=_int(s.get("averageStressLevel")),
        training_load_acute=acute,
        training_load_chronic=chronic,
        training_readiness=_int(tr.get("score")),
    )


def _training_load(ts: dict) -> tuple[float | None, float | None]:
    """Acute/chronic load (verified vs raw): it lives under
    mostRecentTrainingStatus.latestTrainingStatusData.<deviceId>.acuteTrainingLoadDTO.
    """
    try:
        status_data = (ts.get("mostRecentTrainingStatus") or {}).get("latestTrainingStatusData") or {}
        entry = next(iter(status_data.values()), {})  # keyed by deviceId
        acwr = entry.get("acuteTrainingLoadDTO") or {}
        return _float(acwr.get("dailyTrainingLoadAcute")), _float(acwr.get("dailyTrainingLoadChronic"))
    except Exception:
        return None, None


# ── time-series metrics ─────────────────────────────────────────────────────


def _array_metrics(payload: dict | None, key: str, metric: Metric, *, drop_negative: bool) -> list[MetricSampleDTO]:
    out: list[MetricSampleDTO] = []
    for item in (payload or {}).get(key) or []:
        if not item:
            continue
        ts = _ts_any(item[0])
        value = item[1] if len(item) > 1 else None
        if ts is None or not isinstance(value, (int, float)):
            continue
        if drop_negative and value < 0:  # Garmin uses -1/-2 for "no reading"
            continue
        out.append(MetricSampleDTO(ts, metric, float(value)))
    return out


def map_hrv_metrics(hrv: dict | None) -> list[MetricSampleDTO]:
    out: list[MetricSampleDTO] = []
    for r in (hrv or {}).get("hrvReadings") or []:
        ts = _ts_any(r.get("readingTimeGMT"))
        value = r.get("hrvValue")
        if ts is not None and isinstance(value, (int, float)):
            out.append(MetricSampleDTO(ts, Metric.HRV, float(value)))
    return out


def map_stress_metrics(stress: dict | None) -> list[MetricSampleDTO]:
    return _array_metrics(stress, "stressValuesArray", Metric.STRESS, drop_negative=True)


def map_hr_metrics(hr: dict | None) -> list[MetricSampleDTO]:
    return _array_metrics(hr, "heartRateValues", Metric.HEART_RATE, drop_negative=True)


def map_respiration_metrics(resp: dict | None) -> list[MetricSampleDTO]:
    return _array_metrics(resp, "respirationValuesArray", Metric.RESPIRATION, drop_negative=True)


def map_body_battery_metrics(battery: object) -> list[MetricSampleDTO]:
    out: list[MetricSampleDTO] = []
    for block in battery or []:
        for item in (block or {}).get("bodyBatteryValuesArray") or []:
            if not item or len(item) < 3:
                continue
            ts = _ts_any(item[0])
            level = item[2]
            if ts is not None and isinstance(level, (int, float)):
                out.append(MetricSampleDTO(ts, Metric.BODY_BATTERY, float(level)))
    return out


# ── sleep ───────────────────────────────────────────────────────────────────


def map_sleep(day: date, sleep: dict | None) -> SleepBundle | None:
    sleep = sleep or {}
    dto = sleep.get("dailySleepDTO") or {}
    start = _ts_any(dto.get("sleepStartTimestampGMT"))
    end = _ts_any(dto.get("sleepEndTimestampGMT"))
    if start is None or end is None:
        return None

    overall = (dto.get("sleepScores") or {}).get("overall") or {}
    session = SleepSessionDTO(
        day=day,
        start_ts=start,
        end_ts=end,
        sleep_score=_int(overall.get("value") or dto.get("sleepScore")),
        deep_s=_int(dto.get("deepSleepSeconds")),
        light_s=_int(dto.get("lightSleepSeconds")),
        rem_s=_int(dto.get("remSleepSeconds")),
        awake_s=_int(dto.get("awakeSleepSeconds")),
        avg_hrv_ms=_int(sleep.get("avgOvernightHrv") or dto.get("avgOvernightHrv")),
        avg_spo2=_int(dto.get("averageSpO2Value") or sleep.get("averageSpO2Value")),
        avg_respiration=_float(dto.get("averageRespirationValue") or sleep.get("averageRespirationValue")),
        resting_hr=_int(dto.get("restingHeartRate") or sleep.get("restingHeartRate")),
    )

    stages: list[SleepStageDTO] = []
    for level in sleep.get("sleepLevels") or []:
        s = _ts_any(level.get("startGMT"))
        e = _ts_any(level.get("endGMT"))
        raw_level = level.get("activityLevel")
        stage = SLEEP_STAGE_BY_LEVEL.get(_int(raw_level)) if raw_level is not None else None
        if s is not None and e is not None and stage is not None:
            stages.append(SleepStageDTO(s, e, stage))

    return SleepBundle(session=session, stages=stages)


# ── activities ──────────────────────────────────────────────────────────────


def map_activity_header(activity: dict | None) -> ActivityDTO | None:
    ext = _g(activity, "activityId")
    start = _ts_any(_g(activity, "startTimeGMT"))
    if ext is None or start is None:
        return None

    duration = _g(activity, "duration")
    end = start + timedelta(seconds=float(duration)) if isinstance(duration, (int, float)) else None
    atype = (_g(activity, "activityType", "activityTypeDTO") or {})

    return ActivityDTO(
        external_id=str(ext),
        sport=(atype.get("typeKey") if isinstance(atype, dict) else None) or "unknown",
        sub_sport=(_g(activity, "eventType") or {}).get("typeKey") if isinstance(_g(activity, "eventType"), dict) else None,
        name=_g(activity, "activityName"),
        start_ts=start,
        end_ts=end,
        duration_s=_int(duration),
        moving_s=_int(_g(activity, "movingDuration")),
        distance_m=_float(_g(activity, "distance")),
        calories=_int(_g(activity, "calories")),
        avg_hr=_int(_g(activity, "averageHR")),
        max_hr=_int(_g(activity, "maxHR")),
        training_load=_float(_g(activity, "activityTrainingLoad")),
        aerobic_te=_float(_g(activity, "aerobicTrainingEffect")),
        anaerobic_te=_float(_g(activity, "anaerobicTrainingEffect")),
        rpe=None,
    )


def map_exercise_sets(sets_json: dict | None) -> list[StrengthSetDTO]:
    out: list[StrengthSetDTO] = []
    index = 0
    for s in (sets_json or {}).get("exerciseSets") or []:
        set_type = str(s.get("setType") or "").upper()
        if set_type == "REST":
            if out:  # attach this rest to the previous active set
                out[-1] = replace(out[-1], rest_s=_int(s.get("duration")))
            continue
        index += 1
        exercise = (s.get("exercises") or [{}])[0]
        out.append(
            StrengthSetDTO(
                set_index=index,
                exercise=_lower(exercise.get("name")),
                exercise_category=exercise.get("category"),
                reps=_int(s.get("repetitionCount")),
                weight_kg=_grams_to_kg(s.get("weight")),  # VERIFY unit (Garmin reports grams)
                rest_s=None,
                start_ts=_ts_any(s.get("startTime")),
                duration_s=_int(s.get("duration")),
            )
        )
    return out


def _grams_to_kg(grams: object) -> float | None:
    return round(grams / 1000.0, 2) if isinstance(grams, (int, float)) and not isinstance(grams, bool) else None


def map_hr_zones(zones_json: object) -> list[ActivityZoneDTO]:
    zones = zones_json
    if isinstance(zones, dict):
        zones = zones.get("hrTimeInZones") or zones.get("zones") or []
    if not isinstance(zones, list):
        return []
    ordered = sorted(
        (z for z in zones if isinstance(z, dict) and z.get("zoneNumber") is not None),
        key=lambda z: z["zoneNumber"],
    )
    out: list[ActivityZoneDTO] = []
    for i, z in enumerate(ordered):
        low = _int(z.get("zoneLowBoundary"))
        high = None
        if i + 1 < len(ordered):
            nxt = _int(ordered[i + 1].get("zoneLowBoundary"))
            high = nxt - 1 if nxt is not None else None
        out.append(
            ActivityZoneDTO(
                zone=_int(z.get("zoneNumber")) or 0,
                seconds_in=_int(z.get("secsInZone")) or 0,
                low_bpm=low,
                high_bpm=high,
            )
        )
    return out


def map_activity_samples(details_json: dict | None) -> list[ActivitySampleDTO]:
    details = details_json or {}
    index_of = {
        d["key"]: d["metricsIndex"]
        for d in details.get("metricDescriptors") or []
        if d.get("key") is not None and d.get("metricsIndex") is not None
    }

    def value(metrics: list, key: str) -> object:
        i = index_of.get(key)
        return metrics[i] if i is not None and i < len(metrics) else None

    out: list[ActivitySampleDTO] = []
    start_ts: datetime | None = None
    for frame in details.get("activityDetailMetrics") or []:
        metrics = frame.get("metrics") or []
        ts = _ts_any(value(metrics, "directTimestamp"))
        if ts is None:
            continue
        if start_ts is None:
            start_ts = ts
        out.append(
            ActivitySampleDTO(
                ts=ts,
                elapsed_s=int((ts - start_ts).total_seconds()),
                hr=_int(value(metrics, "directHeartRate")),
                speed_mps=_float(value(metrics, "directSpeed")),
                cadence=_int(
                    value(metrics, "directRunCadence")
                    or value(metrics, "directBikeCadence")
                    or value(metrics, "directDoubleCadence")
                ),
                power_w=_int(value(metrics, "directPower")),
                altitude_m=_float(value(metrics, "directElevation")),
                lat=_float(value(metrics, "directLatitude")),
                lon=_float(value(metrics, "directLongitude")),
            )
        )
    return out
