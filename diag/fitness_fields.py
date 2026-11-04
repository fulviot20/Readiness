"""Lists field NAMES (no values) related to VO2max / FTP / running thresholds in Garmin and Intervals."""
import datetime as dt, json, os, re, sys
sys.path.insert(0, ".")
import garmin, readiness
pat = re.compile(r"vo2|ftp|threshold|lactate|race|predict|fitness|eftp|pace|vdot|power", re.I)
today = dt.date.today()
fa = garmin.safe(lambda: garmin.get(f"/fitnessage-service/fitnessage/v2/{today}"), "fa", [])
print("fitnessage keys:", sorted(fa.keys()) if isinstance(fa, dict) else type(fa).__name__)
if isinstance(fa, dict):
    for k, v in fa.items():
        if isinstance(v, dict): print("  ", k, sorted(v.keys())[:20])
acts = garmin.safe(lambda: garmin.get("/activitylist-service/activities/search/activities", {"limit": 5}), "acts", []) or []
print("garmin activities:", len(acts) if isinstance(acts, list) else type(acts).__name__)
for a in (acts if isinstance(acts, list) else [])[:5]:
    t = (a.get("activityType") or {}).get("typeKey")
    print("  ", t, sorted(k for k, v in a.items() if pat.search(k) and v is not None))
if isinstance(acts, list) and acts:
    det = garmin.safe(lambda: garmin.get(f"/activity-service/activity/{acts[0]['activityId']}"), "det", [])
    if isinstance(det, dict):
        flat = {}
        def walk(o, p=""):
            if isinstance(o, dict):
                for k, v in o.items(): walk(v, p + "." + k if p else k)
            elif o is not None and pat.search(p): flat[p] = type(o).__name__
        walk(det); print("  detail:", sorted(flat)[:40])
aid = os.environ.get("INTERVALS_ATHLETE_ID") or "0"
ath = readiness.fetch(f"athlete/{aid}", {})
print("intervals athlete keys:", sorted(k for k in ath if pat.search(k))[:30])
for s in ath.get("sportSettings") or []:
    print("  sport", s.get("types"), sorted(k for k, v in s.items() if pat.search(k) and v is not None))
acts = readiness.fetch(f"athlete/{aid}/activities", {"oldest": (today - dt.timedelta(days=20)).isoformat(), "newest": today.isoformat()})
for a in acts[:4]:
    print("  icu", a.get("type"), sorted(k for k, v in a.items() if pat.search(k) and v is not None))
