from __future__ import annotations

from datetime import date

from ingest.domain import Metric, SleepStage
from ingest.sources import garmin_mapping as gm


def test_map_daily_summary():
    summary = {
        "restingHeartRate": 48,
        "averageStressLevel": 28,
        "bodyBatteryHighestValue": 94,
        "bodyBatteryLowestValue": 18,
        "bodyBatteryMostRecentValue": 88,
    }
    hrv = {
        "hrvSummary": {
            "lastNightAvg": 68,
            "weeklyAvg": 64,
            "status": "BALANCED",
            "baseline": {"balancedLow": 52, "balancedUpper": 78},
        }
    }
    sleep = {"dailySleepDTO": {"sleepTimeSeconds": 26280, "sleepScores": {"overall": {"value": 79}}}}
    readiness = [{"score": 82, "level": "READY"}]

    dto = gm.map_daily_summary(
        date(2026, 6, 19), summary=summary, hrv=hrv, sleep=sleep, readiness=readiness, training_status={}
    )
    assert dto.readiness_score == 82
    assert dto.readiness_status == "ready"
    assert dto.hrv_status == "balanced"
    assert dto.hrv_last_night_ms == 68
    assert dto.hrv_baseline_low_ms == 52 and dto.hrv_baseline_high_ms == 78
    assert dto.body_battery_high == 94 and dto.body_battery_morning == 88
    assert dto.sleep_score == 79 and dto.sleep_duration_s == 26280
    assert dto.resting_hr == 48 and dto.stress_avg == 28


def test_map_training_load_from_status():
    # Real fenix 8 shape: load lives under latestTrainingStatusData.<deviceId>.acuteTrainingLoadDTO
    ts = {
        "mostRecentTrainingStatus": {
            "latestTrainingStatusData": {
                "3502821268": {
                    "acuteTrainingLoadDTO": {
                        "dailyTrainingLoadAcute": 340,
                        "dailyTrainingLoadChronic": 265,
                    }
                }
            }
        }
    }
    dto = gm.map_daily_summary(date(2026, 6, 19), training_status=ts)
    assert dto.training_load_acute == 340.0
    assert dto.training_load_chronic == 265.0


def test_map_hrv_and_stress_metrics():
    hrv = {"hrvReadings": [{"readingTimeGMT": "2026-06-19T06:00:00.0", "hrvValue": 66}]}
    metrics = gm.map_hrv_metrics(hrv)
    assert len(metrics) == 1
    assert metrics[0].metric is Metric.HRV and metrics[0].value == 66.0
    assert metrics[0].ts.tzinfo is not None and metrics[0].ts.hour == 6

    stress = {"stressValuesArray": [[1718776800000, 25], [1718776860000, -1]]}  # -1 is "no reading"
    s = gm.map_stress_metrics(stress)
    assert len(s) == 1 and s[0].metric is Metric.STRESS and s[0].value == 25.0


def test_map_body_battery_metrics():
    bb = [{"bodyBatteryValuesArray": [[1718776800000, "CHARGING", 88], [1718776860000, "DRAINING", 87]]}]
    out = gm.map_body_battery_metrics(bb)
    assert [m.value for m in out] == [88.0, 87.0]
    assert all(m.metric is Metric.BODY_BATTERY for m in out)


def test_map_sleep():
    sleep = {
        "dailySleepDTO": {
            "sleepStartTimestampGMT": 1718774220000,
            "sleepEndTimestampGMT": 1718801400000,
            "sleepScores": {"overall": {"value": 79}},
            "deepSleepSeconds": 5400,
            "lightSleepSeconds": 14400,
            "remSleepSeconds": 6480,
            "awakeSleepSeconds": 900,
            "averageSpO2Value": 96,
            "averageRespirationValue": 14.2,
            "restingHeartRate": 48,
        },
        "avgOvernightHrv": 66.4,
        "sleepLevels": [
            {"startGMT": 1718774220000, "endGMT": 1718776020000, "activityLevel": 1},
            {"startGMT": 1718776020000, "endGMT": 1718781420000, "activityLevel": 0},
        ],
    }
    bundle = gm.map_sleep(date(2026, 6, 19), sleep)
    assert bundle is not None
    assert bundle.session.sleep_score == 79
    assert bundle.session.deep_s == 5400 and bundle.session.awake_s == 900
    assert bundle.session.avg_hrv_ms == 66  # float coerced to int column
    assert bundle.session.avg_respiration == 14.2
    assert [s.stage for s in bundle.stages] == [SleepStage.LIGHT, SleepStage.DEEP]

    assert gm.map_sleep(date(2026, 6, 19), {"dailySleepDTO": {}}) is None


def test_map_exercise_sets_with_rest():
    payload = {
        "exerciseSets": [
            {
                "setType": "ACTIVE",
                "repetitionCount": 8,
                "weight": 80000,
                "duration": 40,
                "exercises": [{"name": "BENCH_PRESS", "category": "BENCH_PRESS"}],
            },
            {"setType": "REST", "duration": 90},
            {
                "setType": "ACTIVE",
                "repetitionCount": 8,
                "weight": 82500,
                "duration": 41,
                "exercises": [{"name": "BENCH_PRESS", "category": "BENCH_PRESS"}],
            },
        ]
    }
    sets = gm.map_exercise_sets(payload)
    assert len(sets) == 2
    assert sets[0].set_index == 1 and sets[0].reps == 8
    assert sets[0].weight_kg == 80.0 and sets[0].rest_s == 90
    assert sets[1].set_index == 2 and sets[1].weight_kg == 82.5 and sets[1].rest_s is None
    assert sets[0].exercise == "bench_press"


def test_map_hr_zones():
    zones = [
        {"zoneNumber": 1, "secsInZone": 600, "zoneLowBoundary": 90},
        {"zoneNumber": 2, "secsInZone": 1200, "zoneLowBoundary": 110},
        {"zoneNumber": 3, "secsInZone": 900, "zoneLowBoundary": 131},
    ]
    out = gm.map_hr_zones(zones)
    assert [z.zone for z in out] == [1, 2, 3]
    assert out[0].low_bpm == 90 and out[0].high_bpm == 109  # next zone low - 1
    assert out[2].high_bpm is None  # last zone, no upper
    assert out[1].seconds_in == 1200


def test_map_activity_samples():
    details = {
        "metricDescriptors": [
            {"key": "directTimestamp", "metricsIndex": 0},
            {"key": "directHeartRate", "metricsIndex": 1},
            {"key": "directSpeed", "metricsIndex": 2},
        ],
        "activityDetailMetrics": [
            {"metrics": [1718776800000, 96, 0.0]},
            {"metrics": [1718776860000, 122, 2.5]},
        ],
    }
    out = gm.map_activity_samples(details)
    assert len(out) == 2
    assert out[0].elapsed_s == 0 and out[1].elapsed_s == 60
    assert out[0].hr == 96 and out[1].hr == 122
    assert out[1].speed_mps == 2.5


def test_map_activity_header_nested_summary():
    activity = {
        "activityId": 123,
        "activityName": "Push Day",
        "activityType": {"typeKey": "strength_training"},
        # detail responses nest the metrics under summaryDTO
        "summaryDTO": {
            "startTimeGMT": "2026-06-19T17:00:00.0",
            "duration": 3480,
            "calories": 320,
            "averageHR": 118,
            "maxHR": 156,
        },
    }
    dto = gm.map_activity_header(activity)
    assert dto is not None
    assert dto.external_id == "123" and dto.sport == "strength_training"
    assert dto.duration_s == 3480 and dto.calories == 320 and dto.avg_hr == 118
    assert dto.start_ts.hour == 17 and dto.end_ts.minute == 58  # 17:00 + 3480s = 17:58

    assert gm.map_activity_header({"activityId": 1}) is None  # no start time -> None
