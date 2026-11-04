"""Field NAMES only: Intervals wellness keys mentioning vo2, and how many days have them."""
import datetime as dt, os, sys
sys.path.insert(0, ".")
import readiness
aid = os.environ.get("INTERVALS_ATHLETE_ID") or "0"
today = dt.date.today()
w = readiness.fetch(f"athlete/{aid}/wellness", {"oldest": (today - dt.timedelta(days=365)).isoformat(), "newest": today.isoformat()})
keys = {}
for r in w:
    for k, v in r.items():
        if v is not None: keys[k] = keys.get(k, 0) + 1
print("wellness keys with counts:", sorted((k, n) for k, n in keys.items() if "vo2" in k.lower() or "ftp" in k.lower() or "readiness" in k.lower()))
acts = readiness.fetch(f"athlete/{aid}/activities", {"oldest": (today - dt.timedelta(days=365)).isoformat(), "newest": today.isoformat()})
runs = [a for a in acts if (a.get("type") or "").endswith("Run")]
rides = [a for a in acts if "Ride" in (a.get("type") or "")]
print("runs", len(runs), "with hr+speed", sum(1 for a in runs if a.get("average_heartrate") and a.get("average_speed")),
      "rides", len(rides), "with rolling ftp", sum(1 for a in rides if a.get("icu_rolling_ftp")))
