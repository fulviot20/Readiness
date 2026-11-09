"""Unit tests for the physiology engine and the data pipeline (synthetic data only)."""
import datetime as dt
import json

import pytest

from fixture import TODAY, PASS, build_data, make_inputs
import dayflow
import engine
import readiness


@pytest.fixture(scope="module")
def data():
    return build_data()


# ---------------------------------------------------------------- engine
def test_sleep_features_rejects_bad_records():
    assert engine.sleep_features({}) is None
    assert engine.sleep_features({"sleepTimeSeconds": 3600, "sleepStartTimestampLocal": 10, "sleepEndTimestampLocal": 5}) is None


def test_sleep_features_basic():
    f = engine.sleep_features({"sleepTimeSeconds": 7 * 3600, "sleepStartTimestampLocal": 1e12,
                               "sleepEndTimestampLocal": 1e12 + 7.5 * 3600e3, "deepSleepSeconds": 3600,
                               "remSleepSeconds": 5400, "lightSleepSeconds": 16200, "awakeSleepSeconds": 600})
    assert f["hours"] == 7 and 0.9 < f["eff"] < 0.95 and f["awake_min"] == 10
    assert f["restorative"] == pytest.approx(2.5 / 7, abs=1e-3)


def test_sleep_need_bounds():
    assert engine.sleep_need([6] * 5) == (7.5, 6.5)                    # too few nights: defaults
    target, floor = engine.sleep_need([5.0] * 30)
    assert target == 7.0 and floor == 6.0                              # clipped to sane limits


def test_sleep_levels_shapes():
    lv = engine.sleep_levels({"sleepLevels": [
        {"startGMT": "2026-11-08T22:00:00.0", "endGMT": "2026-11-08T22:30:00.0", "activityLevel": 1},
        {"startGMT": "2026-11-08T22:30:00.0", "endGMT": "2026-11-08T23:00:00.0", "activityLevel": 0},
        {"startGMT": "2026-11-08T23:00:00.0", "endGMT": "2026-11-08T23:10:00.0", "activityLevel": 2}]})
    assert lv == [[0, 30, "light"], [30, 30, "deep"], [60, 10, "rem"]]
    assert engine.sleep_levels({}) is None and engine.sleep_levels("x") is None


def test_trimp_monotonic():
    pts = [(i * 120000, 150) for i in range(31)]                       # one hour at 150 bpm
    low = engine.trimp([(t, 120) for t, _ in pts], 50, 190)
    high = engine.trimp(pts, 50, 190)
    assert 0 < low < high
    assert engine.trimp(pts, 50, 60) is None                           # implausible HRmax


def test_hr_slots_places_samples_in_local_day():
    d0 = dt.datetime(2026, 11, 8, tzinfo=dt.timezone.utc).timestamp() * 1000
    pts = [(d0 - 3600e3 + 30 * 60000, 60)]                              # 00:30 local at UTC+1
    slots = engine.hr_slots(pts, 3600e3, "2026-11-08")
    assert len(slots) == 288 and slots[6] == 60 and sum(v is not None for v in slots) == 1


# ---------------------------------------------------------------- scores
def test_scores_in_range(data):
    scored = [d for d in data["days"] if d.get("score") is not None]
    assert len(scored) > 60
    assert all(1 <= d["score"] <= 100 for d in scored)
    assert all(0 <= d["sleep_score"]["score"] <= 100 for d in data["days"] if d.get("sleep_score"))
    assert all(0 <= d["strain"]["score"] <= 100 for d in data["days"] if d.get("strain"))


def test_alarm_caps_score():
    wellness, activities, gdays = make_inputs()
    t = TODAY.isoformat()
    gdays[t]["hrv_night"] = {"ms": 25.0, "n": 80}                       # crashed HRV
    gdays[t]["hrv_avg"] = 25
    gdays[t]["hr"]["low30"] = gdays[t]["hr"]["rest_used"] = 62          # high sleeping HR
    gdays[t]["daily"]["rhr"] = 62
    data = readiness.build(wellness, activities, [], {}, TODAY, {}, {}, gdays)
    today = data["days"][-1]
    assert today["alarm"] and today["score"] <= 49


def test_sick_answer_caps_score():
    wellness, activities, gdays = make_inputs()
    data = readiness.build(wellness, activities, [], {TODAY.isoformat(): {"sick": True}}, TODAY, {}, {}, gdays)
    assert data["days"][-1]["score"] <= 49


# ---------------------------------------------------------------- day, hour by hour
def test_dayflow_energy(data):
    f = data["dayflow"]
    assert f and TODAY.isoformat() in f["days"]
    for d, v in f["days"].items():
        e = [x for x in v["energy"] if x is not None]
        assert len(v["energy"]) == 288 and all(0 <= x <= 100 for x in e)
        assert all(x is None or x == -1 or 0 <= x <= 100 for x in v["stress"])
    today = f["days"][TODAY.isoformat()]["energy"]
    assert today[f["now"] + 1] is None and today[f["now"]] is not None


def test_energy_recharges_overnight(data):
    v = data["dayflow"]["days"][(TODAY - dt.timedelta(days=1)).isoformat()]
    first, last = v["sleep"][0]
    assert v["energy"][last] > v["energy"][first]


# ---------------------------------------------------------------- crypto and output
def test_encrypt_roundtrip(data):
    enc = readiness.encrypt({"a": 1, "b": [1, 2]}, PASS)
    assert readiness.decrypt(enc, PASS) == {"a": 1, "b": [1, 2]}
    with pytest.raises(Exception):
        readiness.decrypt(enc, "wrong")


def test_output_is_json(data):
    json.dumps(data)
