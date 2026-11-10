"""Synthetic, deterministic data for the tests: no personal data, no network.

build_data(today) runs the same pipeline as readiness.main() on made-up Intervals and Garmin data.
Run as a script to write tests/out/data.enc (passphrase "test") for the app smoke test.
"""
import datetime as dt
import json
import math
import os
import random
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import dayflow  # noqa: E402
import energy  # noqa: E402
import engine  # noqa: E402
import months  # noqa: E402
import readiness  # noqa: E402

TODAY = dt.date(2026, 11, 9)
PASS = "test"


def _ms(d, minutes):
    """Local-as-UTC timestamp in ms for a date plus minutes from its midnight."""
    return dt.datetime(d.year, d.month, d.day, tzinfo=dt.timezone.utc).timestamp() * 1000 + minutes * 60000


def make_inputs(today=TODAY, days=150, seed=7):
    rnd = random.Random(seed)
    wellness, activities, gdays = [], [], {}
    ctl = atl = 45.0
    for k in range(days, -1, -1):
        d = today - dt.timedelta(days=k)
        iso = d.isoformat()
        weekend = d.weekday() >= 5
        bed = 23 * 60 + rnd.randint(-40, 50) + (60 if weekend else 0)      # minutes from previous midnight
        hours = rnd.uniform(5.9, 8.4)
        start = _ms(d - dt.timedelta(days=1), bed)
        end = start + hours * 3600e3 + rnd.randint(8, 35) * 60e3
        sleep = {"sleepTimeSeconds": hours * 3600, "sleepStartTimestampLocal": start, "sleepEndTimestampLocal": end,
                 "sleepStartTimestampGMT": start - 3600e3, "sleepEndTimestampGMT": end - 3600e3,
                 "deepSleepSeconds": hours * 3600 * rnd.uniform(.12, .22), "remSleepSeconds": hours * 3600 * .22,
                 "lightSleepSeconds": hours * 3600 * .5, "awakeSleepSeconds": rnd.randint(5, 45) * 60,
                 "awakeCount": rnd.randint(0, 4), "averageRespirationValue": 14 + rnd.uniform(-.5, .5),
                 "sleepScores": {"overall": {"value": rnd.randint(60, 90)}}}
        hrv = 62 + 6 * math.sin(k / 9) + rnd.uniform(-7, 7)
        rhr = 48 + rnd.randint(-2, 3)
        load = 0
        if d.weekday() in (1, 3, 5, 6) or (d.weekday() == 2 and rnd.random() < .5):
            ride = d.weekday() != 3
            mins = rnd.randint(50, 210) if ride else rnd.randint(30, 55)
            load = round(mins * rnd.uniform(.8, 1.25))
            activities.append({
                "id": f"i{k}", "start_date_local": f"{iso}T{17 if not weekend else 9}:30:00",
                "type": "Ride" if ride else "Run", "name": "Endurance" if ride else "Easy run",
                "moving_time": mins * 60, "elapsed_time": mins * 60 + 300, "icu_training_load": load,
                "average_heartrate": 138 if ride else 148, "max_heartrate": 172, "calories": mins * 11,
                "distance": mins * (500 if ride else 180), "icu_average_watts": 205 if ride else None,
                "icu_weighted_avg_watts": 220 if ride else None, "icu_ftp": 290, "feel": rnd.randint(1, 5),
                "icu_joules": mins * 60 * 205 if ride else None, "total_elevation_gain": mins * 4,
                "icu_power_zones": [55, 75, 90, 105, 120, 150, 999] if ride else None,
                "icu_zone_times": [{"id": f"Z{z}", "secs": round(mins * 60 * sh)} for z, sh in
                                   enumerate([.22, .48, .16, .09, .04, .01, 0], start=1)] if ride else None,
                "carbs_ingested": 60 if ride and k % 5 == 0 else None})
        ctl += (load - ctl) / 42
        atl += (load - atl) / 7
        wellness.append({"id": iso, "hrv": round(hrv), "restingHR": rhr, "sleepSecs": round(hours * 3600),
                         "ctl": round(ctl, 1), "atl": round(atl, 1), "weight": round(63 + rnd.uniform(-.6, .6), 1),
                         "sleepScore": rnd.randint(60, 90)})
        rec = {"sleep": engine.sleep_features(sleep), "hrv_avg": round(hrv), "hrv_night": {"ms": round(hrv, 1), "n": 80},
               "daily": {"rhr": rhr, "stress": rnd.randint(20, 40), "steps": rnd.randint(4000, 14000), "steps_goal": 8000,
                         "km": 6.2, "kcal_active": rnd.randint(300, 1100), "kcal_resting": 1650, "kcal_total": 2400,
                         "resp": 14, "asof": f"{iso}T12:40:00.0"}}
        hr = {"rest_used": rhr, "max": 186, "trimp": 40 + load * 1.1}
        if k < engine.INTRADAY_DAYS:
            h5 = []
            for s in range(288):
                ms = _ms(d, s * 5)
                asleep = start <= ms <= end or s * 5 >= 23 * 60 + 30
                h = rhr + rnd.randint(-2, 4) if asleep else 64 + rnd.randint(-4, 14)
                if load and (17 * 60 + 30 if not weekend else 9 * 60 + 30) <= s * 5 < (17 * 60 + 30 if not weekend else 9 * 60 + 30) + 90:
                    h = 140 + rnd.randint(-8, 10)
                h5.append(None if k == 0 and s > 152 else h)
            hr["hr5"] = h5
        rec["hr"] = hr
        gdays[iso] = rec
    return wellness, activities, gdays


def build_data(today=TODAY):
    wellness, activities, gdays = make_inputs(today)
    answers = {(today - dt.timedelta(days=k)).isoformat(): {"feel": 3 + (k % 3) - 1, "sleep": 3} for k in range(1, 20)}
    # planned rides around today: intervals on the last three days and today, a long endurance ride tomorrow
    hard = "- 15m 55%\n\n4x\n- 8m 100%\n- 4m 50%\n\n- 17m 60%"
    events = [{"id": 900 + k, "category": "WORKOUT", "type": "Ride", "name": "4x8 threshold", "description": hard,
               "start_date_local": f"{(today - dt.timedelta(days=k)).isoformat()}T17:00:00", "icu_training_load": 85}
              for k in range(0, 4)]
    events.append({"id": 990, "category": "WORKOUT", "type": "Ride", "name": "Long endurance", "description": "- 3h30m 65%",
                   "start_date_local": f"{(today + dt.timedelta(days=1)).isoformat()}T09:00:00", "icu_training_load": 150})
    data = readiness.build(wellness, activities, events, answers, today, {}, {}, gdays)
    data["athlete"] = readiness.athlete(wellness, {}, data["fitness"], None)
    data["energy"] = energy.build(gdays, data["days"], today, 174, "m")
    data["nutrition"] = readiness.nutrition({}, today)
    data["journal"] = {"days": {}, "tags": None}
    data["garmin_key"] = {"expires": "2027-11-03", "error": False}
    data["dayflow"] = dayflow.build(gdays, data["days"], today, 186)
    data["monthly"] = months.build(wellness, activities, gdays, data["days"], data["fitness"], today)
    return data


if __name__ == "__main__":
    # the app always opens on the real "today", so the fixture for the smoke test is built around it
    out = os.path.join(ROOT, "tests", "out")
    os.makedirs(out, exist_ok=True)
    data = build_data(dt.datetime.now(readiness.TZ).date())
    env = readiness.encrypt(data, PASS, readiness.data_salt(PASS))
    with open(os.path.join(out, "data.enc"), "w") as f:
        json.dump(env, f)
    with open(os.path.join(out, "stamp.json"), "w") as f:
        json.dump({"iv": env["iv"]}, f)
    print("fixture:", len(data["days"]), "days,", sum(1 for d in data["days"] if d.get("score") is not None), "scored")
