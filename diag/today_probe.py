"""Today's activities and planned workouts on Intervals: types, sources, times (no text)."""
import datetime as dt, os, sys
sys.path.insert(0, ".")
import readiness
aid = os.environ.get("INTERVALS_ATHLETE_ID") or "0"
today = dt.date.today()
day = (today - dt.timedelta(days=1)).isoformat()
acts = readiness.fetch(f"athlete/{aid}/activities", {"oldest": day, "newest": today.isoformat()})
for a in acts:
    print("ACT", {k: a.get(k) for k in ("id", "type", "source", "start_date_local", "moving_time",
                                        "icu_training_load", "paired_event_id", "device_name", "_note")})
ev = readiness.fetch(f"athlete/{aid}/events", {"oldest": day, "newest": today.isoformat()})
for e in ev:
    print("EV", {k: e.get(k) for k in ("id", "category", "type", "start_date_local", "moving_time", "paired_activity_id")})
