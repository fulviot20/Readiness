"""Why the power block is empty: counts and field names only (the log is public, never values)."""
import datetime as dt
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import engine  # noqa: E402
import power  # noqa: E402
import readiness  # noqa: E402

today = dt.datetime.now(readiness.TZ).date()
aid = os.environ.get("INTERVALS_ATHLETE_ID") or "0"
acts = readiness.fetch(f"athlete/{aid}/activities", {"oldest": (today - dt.timedelta(days=60)).isoformat(),
                                                    "newest": today.isoformat()})
rides = [a for a in acts if "Ride" in (a.get("type") or "")]
print("activities", len(acts), "rides", len(rides), "power rides", sum(power.is_power_ride(a) for a in acts))
print("types", sorted({a.get("type") for a in acts}))
print("sources", sorted({str(a.get("source")) for a in acts}))
if rides:
    r = rides[-1]
    print("ride keys", sorted(k for k, v in r.items() if v not in (None, "", [], {})))
    try:
        s = readiness.fetch(f"activity/{r['id']}/streams.json", {"types": "watts"})
        print("stream types", [x.get("type") for x in s if isinstance(x, dict)], "len", [len(x.get("data") or []) for x in s if isinstance(x, dict)])
    except SystemExit as e:
        print("stream error", str(e)[:120])
cache = engine.load_cache(os.environ["READINESS_PASSPHRASE"], readiness.decrypt)
st = cache.get("power") or {}
print("cache power entries", len(st), "with mmp", sum(1 for v in st.values() if (v or {}).get("mmp")))
