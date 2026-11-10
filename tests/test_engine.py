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


# ---------------------------------------------------------------- monthly reports
def test_monthly_reports(data):
    m = data["monthly"]
    assert m and len(m["months"]) >= 4
    assert m["months"][-1]["month"] == TODAY.strftime("%Y-%m") and m["months"][-1]["partial"]
    for x in m["months"]:
        assert x["headline"] and all(isinstance(l, str) and l for l in x["lines"])
    assert m["trend"] and m["trend"]["items"]


def test_monthly_explains_hrv_drop_with_more_training():
    import months
    base = {"hours_week": 6, "hrv": 65, "rhr": 48, "sleep_h": 7.3}
    cur = {"days": 30, "sessions": 22, "hours": 40, "hours_week": 9.3, "ctl": 70, "ctl_start": 62, "hrv": 57,
           "rhr": 51, "sleep_h": 6.6, "weight": 63, "ftp": None, "vo2max": None}
    head, lines = months.explain(cur, dict(base, weight=63), base)
    assert "costing more than usual" in head
    assert any("under 7 hours" in l for l in lines)


# ---------------------------------------------------------------- score validation
def test_validation_checks(data):
    v = data["validation"]
    assert v["verdict"]["state"] in ("collecting", "valid", "retune")
    assert {c["key"] for c in v["checks"]} >= {"feel", "morning", "illness", "notes", "stability"}
    assert all(c["status"] in ("ok", "watch", "bad", "early", "wait") for c in v["checks"])
    assert v["history"]["n"] > 10


def test_validation_catches_illness():
    days = []
    for k in range(20):
        d = (TODAY - dt.timedelta(days=19 - k)).isoformat()
        days.append({"date": d, "score": 70, "band": "Normal", "base": 70, "workouts": [],
                     "alarm": k == 14, "answers": {"sick": True} if k in (15, 16) else None})
    v = readiness.validation(days, since=days[0]["date"])
    ill = next(c for c in v["checks"] if c["key"] == "illness")
    assert ill["status"] == "ok" and "1 of 1" in ill["text"]


# ---------------------------------------------------------------- synced values, reminders, stable key
def test_synced_value_in_pieces():
    import base64, gzip, mailbox
    plan = {"meals": [{"meal": "b", "title": "Colazione", "n": k} for k in range(300)]}
    body = base64.b64encode(gzip.compress(json.dumps(plan).encode())).decode()
    parts = [body[i:i + 500] for i in range(0, len(body), 500)]
    assert len(parts) > 2
    mail = {}
    msgs = [{"key": "rd_plan", "ts": 2000, "i": i, "n": len(parts), "z": 1, "s": s} for i, s in enumerate(parts)]
    for m in reversed(msgs[1:]):                       # pieces can arrive in any order
        assert not mailbox.keep_value(mail, m)
    assert "rd_plan" not in mail.get("kv", {})
    assert mailbox.keep_value(mail, msgs[0]) and mail["kv"]["rd_plan"] == {"ts": 2000, "v": plan}
    # an older change never replaces a newer one; a newer small one does; unknown keys are ignored
    assert not mailbox.keep_value(mail, {"key": "rd_plan", "ts": 1000, "i": 0, "n": 1, "z": 0, "s": "{}"})
    assert mailbox.keep_value(mail, {"key": "rd_fuel", "ts": 3000, "i": 0, "n": 1, "z": 0, "s": '{"rate":80}'})
    assert mail["kv"]["rd_fuel"]["v"] == {"rate": 80} and mail["kv"]["rd_plan"]["ts"] == 2000
    assert not mailbox.keep_value(mail, {"key": "rd_pass", "ts": 9000, "i": 0, "n": 1, "z": 0, "s": '"x"'})


def _remind_data(**over):
    t = TODAY.isoformat()
    data = {"days": [{"date": t, "score": 72, "band": "Normal", "answers": None}], "journal": {"days": {}},
            "athlete": {"weights": [{"date": (TODAY - dt.timedelta(days=9)).isoformat(), "kg": 70}], "metrics": {}}, "sync": {}}
    data.update(over)
    return data, t


def test_reminders_only_when_missing():
    import push
    data, t = _remind_data()
    at = lambda h, m=0: dt.datetime(TODAY.year, TODAY.month, TODAY.day, h, m, tzinfo=readiness.TZ)
    keys = lambda now, sent=(), times=None, d=data: [k for k, _ in push.reminders(d, set(sent), now, times or {})]
    scored = {f"score:{t}": at(7).timestamp()}
    assert keys(at(7, 10), times=scored) == [f"weight:{t}"]                       # check-in waits 25 minutes
    assert keys(at(7, 30), times=scored) == [f"checkin:{t}", f"weight:{t}"]
    assert keys(at(7, 30), sent=[f"checkin:{t}", f"weight:{t}"], times=scored) == []   # each one once
    assert keys(at(7, 30), times={**scored, "weight": at(7).timestamp() - 3 * 86400}) == [f"checkin:{t}"]   # weigh-in: weekly
    assert keys(at(20, 59)) == [] and keys(at(21)) == [f"journal:{t}"]
    done, _ = _remind_data(days=[{"date": t, "score": 72, "answers": {"feel": 4}}], journal={"days": {t: {"tags": []}}},
                           athlete={"weights": [{"date": t, "kg": 70}], "metrics": {}})
    assert keys(at(7, 30), times=scored, d=done) == [] and keys(at(22), d=done) == []          # nothing missing, nothing sent
    off, _ = _remind_data(sync={"rd_remind": {"ts": 1, "v": {"checkin": False, "journal": True, "weight": False, "jhour": 22}}})
    assert keys(at(7, 30), times=scored, d=off) == [] and keys(at(21, 30), d=off) == [] and keys(at(22), d=off) == [f"journal:{t}"]


def test_data_key_is_stable_and_iv_is_not():
    a = readiness.encrypt({"x": 1}, PASS, readiness.data_salt(PASS))
    b = readiness.encrypt({"x": 1}, PASS, readiness.data_salt(PASS))
    assert a["salt"] == b["salt"] and a["iv"] != b["iv"] and a["ct"] != b["ct"]
    assert readiness.decrypt(a, PASS) == {"x": 1}
    assert readiness.encrypt({"x": 1}, PASS)["salt"] != a["salt"]                 # everything else keeps a random salt


def test_ride_carbs_reach_the_app():
    out = readiness.summary({"id": "i1", "type": "Ride", "moving_time": 7200, "carbs_ingested": 150}, {})
    assert out["carbs_in"] == 150 and readiness.summary({"id": "i2", "type": "Ride", "moving_time": 600}, {})["carbs_in"] is None


# ---------------------------------------------------------------- fuelling model
def test_fuel_share_follows_intensity_and_duration():
    import fuel
    assert fuel.frac_power(0.55) < fuel.frac_power(0.75) < fuel.frac_power(0.95) <= fuel.frac_power(1.3) == 1.0
    ride = lambda mins, zones: {"type": "Ride", "moving_time": mins * 60, "icu_ftp": 280, "icu_joules": 190 * mins * 60,
                                "icu_power_zones": [55, 75, 90, 105, 120, 150, 999],
                                "icu_zone_times": [{"id": f"Z{i}", "secs": mins * 60 * s} for i, s in enumerate(zones, 1)]}
    easy, hard = [.3, .65, .05, 0, 0, 0, 0], [.3, .25, .1, .3, .05, 0, 0]
    e2, h2, e4 = fuel.session(ride(120, easy)), fuel.session(ride(120, hard)), fuel.session(ride(240, easy))
    assert e2["how"] == "power zones" and e2["kcal"] == h2["kcal"] == round(190 * 7.2 / fuel.GE / 4.184)
    assert h2["frac"] > e2["frac"] > e4["frac"]                     # harder burns more carbohydrate, longer burns less of it
    # two hours of easy endurance, nothing eaten: 40-50% of energy, close to what lab studies in trained cyclists report
    assert 0.38 <= e2["frac"] <= 0.50 and 70 <= fuel.used(e2) / 2 <= 110
    assert fuel.used(e2, 180) > fuel.used(e2)                       # eating on the bike raises carbohydrate use
    # without power: Garmin's calories and heart rate
    run = fuel.session({"type": "Run", "moving_time": 3600, "calories": 800, "average_heartrate": 150}, 48, 188)
    assert run["how"] == "heart rate" and 0.5 < run["frac"] < 0.8
    assert fuel.session({"type": "Run", "moving_time": 3600}, 48, 188) is None


def test_fuel_plan_intake_and_recovery():
    import fuel
    steps = [{"min": 15, "lo": 55, "hi": 55}] + [{"min": 8, "lo": 100, "hi": 100}, {"min": 4, "lo": 50, "hi": 50}] * 4 + [{"min": 17, "lo": 60, "hi": 60}]
    p = fuel.planned({"type": "Ride", "minutes": 80, "steps": steps, "load": 85}, 280)
    long = fuel.planned({"type": "Ride", "minutes": 240, "steps": [{"min": 240, "lo": 65, "hi": 65}]}, 280)
    assert p["how"] == "planned power" and p["frac"] > long["frac"]
    # on the bike the amount follows the engine: a hard hour lands on the ceiling, an easy spin on the floor
    assert fuel.intake_rate({**p, "min": 30}) == 0 and fuel.intake_rate(p) == 90 and fuel.intake_rate(p, ceiling=80) == 80
    spin = fuel.planned({"type": "Ride", "minutes": 60, "steps": [{"min": 60, "lo": 45, "hi": 45}]}, 280)
    z2 = fuel.planned({"type": "Ride", "minutes": 60, "steps": [{"min": 60, "lo": 68, "hi": 68}]}, 280)
    assert fuel.intake_rate(spin) == 40 and 65 <= fuel.intake_rate(z2) <= 80
    assert fuel.intake_rate(z2) < fuel.intake_rate(long) <= 90      # the same pace asks for more on a long ride
    small = fuel.planned({"type": "Ride", "minutes": 60, "steps": [{"min": 60, "lo": 68, "hi": 68}]}, 180)
    assert fuel.intake_rate(small) < fuel.intake_rate(z2)           # a smaller engine burns, and needs, less
    race = fuel.planned({"type": "Ride", "minutes": 60, "race": True}, 280)
    assert race["frac0"] > 0.75 and fuel.intake_rate(race) == 90
    # other sports keep the duration tiers
    run = {"kcal": 900, "frac": 0.6, "min": 70}
    assert fuel.intake_rate(run, ride=False) == 0 and 30 <= fuel.intake_rate({**run, "min": 100, "kcal": 1300}, ride=False) <= 60
    kg, intake = 65, fuel.intake_rate(long) * 4
    used = fuel.used(long, intake)
    soon, later = fuel.recovery(used, intake, kg, True), fuel.recovery(used, intake, kg, False)
    assert soon["deficit"] == later["deficit"] == round(used - intake) and soon["carbs"] >= later["carbs"]
    assert soon["carbs"] <= round(1.2 * kg / 5) * 5 and later["carbs"] <= round(0.8 * kg / 5) * 5 and soon["protein"] == round(0.3 * kg)
    assert fuel.recovery(100, 95, kg, True)["carbs"] == 0           # nearly everything was covered on the bike
    # the same ride an hour longer than planned leaves more to refill, with the same food in the pocket
    longer = {**long, "min": 300, "kcal": round(long["kcal"] * 1.25)}
    assert fuel.recovery(fuel.used(longer, intake), intake, kg, True)["deficit"] > soon["deficit"]
    # an unplanned hole is refilled promptly even with nothing demanding close, in two doses when it is big
    calm, hole = fuel.recovery(300, 80, kg, False), fuel.recovery(300, 80, kg, False, extra=95)
    assert calm["window"] == "in your next meal" and calm["more"] == 0
    assert hole["window"] == "within the hour" and hole["carbs"] > calm["carbs"] and hole["more"] > 0
    assert hole["carbs"] + hole["more"] <= hole["deficit"] + 5


def test_fuel_reaches_sessions_and_plans():
    data = build_data()
    rides = [w for d in data["days"] for w in d["workouts"] if w["type"] == "Ride"]
    assert rides and all(w.get("fuel", {}).get("how") == "power zones" for w in rides)
    plans = [p for ps in data["upcoming"].values() for p in ps]
    assert plans and all(p.get("fuel") for p in plans)
    assert any(p.get("done_id") for d in data["days"] for p in d["plan"])
