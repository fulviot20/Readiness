"""Planned workout fields on Intervals: names, types and numbers only (no text)."""
import datetime as dt, os, sys, json
sys.path.insert(0, ".")
import readiness
aid = os.environ.get("INTERVALS_ATHLETE_ID") or "0"
today = dt.date.today()
ev = readiness.fetch(f"athlete/{aid}/events", {"oldest": today.isoformat(), "newest": (today + dt.timedelta(days=6)).isoformat()})
ws = [e for e in ev if (e.get("category") or "") == "WORKOUT"]
print("workouts", len(ws))
def shape(v):
    if isinstance(v, (int, float)) or v is None or isinstance(v, bool): return v
    if isinstance(v, str): return f"str[{len(v)}]"
    if isinstance(v, list): return f"list[{len(v)}]" + (f" of {shape(v[0])}" if v and not isinstance(v[0], str) else "")
    if isinstance(v, dict): return {k: shape(x) for k, x in v.items() if k not in ("text", "description", "name")}
    return type(v).__name__
for e in ws[:2]:
    print("EVENT", json.dumps({k: shape(v) for k, v in e.items() if k != "workout_doc"}, default=str))
    wd = e.get("workout_doc") or {}
    print("DOC", json.dumps({k: shape(v) for k, v in wd.items() if k != "steps"}, default=str)[:3000])
    for s in (wd.get("steps") or [])[:3]:
        print("STEP", json.dumps(shape(s), default=str)[:800])
