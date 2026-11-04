"""Steps and calories for today, with a projection of the whole day.

Total = basal (resting) + active. Garmin gives both so far; for the end of the day:
  basal     your usual full-day resting burn (median of the last 14 complete days)
  active    what you've burned so far
          + the rest of the day at your usual pace outside workouts (per waking hour, 7:00-23:00)
          + planned sessions not done yet, at your usual active kcal per minute for that sport
"""
import datetime as dt
import statistics as st

WAKE, BED = 7.0, 23.0


def _sport(t):
    t = t or ""
    return "run" if "Run" in t else "ride" if "Ride" in t else "other"


def _hour(ts):
    try:
        x = dt.datetime.fromisoformat(str(ts)[:19])
        return x.hour + x.minute / 60
    except ValueError:
        return None


def waking_left(h):
    return max(0.0, BED - max(h, WAKE))


def build(gdays, days, today):
    t = today.isoformat()
    byd = {d["date"]: d for d in days}
    past = [(today - dt.timedelta(days=k)).isoformat() for k in range(1, 15)]
    full = [(d, (gdays.get(d) or {}).get("daily") or {}) for d in past]
    full = [(d, x) for d, x in full if x.get("kcal_resting") and x.get("kcal_active") is not None]
    bmr = st.median([x["kcal_resting"] for _, x in full]) if full else None

    def workout_active(d, rate):
        return sum(max(0.0, (w.get("kcal") or 0) - rate * (w.get("minutes") or 0))
                   for w in (byd.get(d) or {}).get("workouts", []) if w.get("type"))

    rate = (bmr or 1700) / 1440
    # usual active kcal per minute for each sport (from workouts with calories)
    per_min = {}
    for d in byd.values():
        for w in d.get("workouts", []):
            if w.get("kcal") and w.get("minutes"):
                per_min.setdefault(_sport(w.get("type")), []).append(max(0.0, w["kcal"] / w["minutes"] - rate))
    per_min = {k: st.median(v) for k, v in per_min.items()}
    # usual active outside workouts, per waking hour
    nonw = [max(0.0, x["kcal_active"] - workout_active(d, rate)) / (BED - WAKE) for d, x in full]
    hourly = st.median(nonw) if nonw else None
    steps_hist = [x.get("steps") for _, x in full if x.get("steps")]

    history = []
    for k in range(29, -1, -1):
        d = (today - dt.timedelta(days=k)).isoformat()
        x = (gdays.get(d) or {}).get("daily") or {}
        history.append({"date": d, "steps": x.get("steps"), "goal": x.get("steps_goal"), "km": x.get("km"),
                        "kcal": x.get("kcal_total"), "active": x.get("kcal_active"), "resting": x.get("kcal_resting")})

    now = (gdays.get(t) or {}).get("daily") or {}
    out = {"history": history, "bmr": round(bmr) if bmr else None}
    if now.get("kcal_active") is None or not bmr:
        return out
    h = _hour(now.get("asof"))
    if h is None:
        h = dt.datetime.now().hour
    left = waking_left(h)
    rest_of_day = (hourly or 0) * left
    planned, names = 0.0, []
    for p in (byd.get(t) or {}).get("plan", []):
        if p.get("done") or not p.get("minutes"):
            continue
        k = per_min.get(_sport(p.get("type")))
        if k is None:
            continue
        planned += k * p["minutes"]
        names.append(p.get("name") or "Workout")
    active_now = now["kcal_active"]
    projected = bmr + active_now + rest_of_day + planned
    steps_now = now.get("steps") or 0
    steps_proj = steps_now + (st.median(steps_hist) / (BED - WAKE) * left if steps_hist else 0)
    out["today"] = {
        "asof": round(h, 2), "steps": steps_now, "goal": now.get("steps_goal"), "km": now.get("km"),
        "steps_projected": round(steps_proj / 100) * 100,
        "kcal_now": now.get("kcal_total"), "active_now": round(active_now), "resting_now": now.get("kcal_resting"),
        "projected": round(projected / 10) * 10,
        "parts": {"basal": round(bmr), "active_so_far": round(active_now), "rest_of_day": round(rest_of_day),
                  "planned": round(planned)},
        "planned_names": names, "hourly_active": round(hourly) if hourly else None,
    }
    return out
