"""Probe for intraday endpoints (stress, body battery, sleep stages).
Prints only structure, key names, list lengths and value types — never personal values."""
import datetime as dt, json, sys
from zoneinfo import ZoneInfo
sys.path.insert(0, ".")
import garmin


def shape(x, depth=0, max_depth=4):
    if isinstance(x, dict):
        if depth >= max_depth:
            return f"{{{len(x)} keys}}"
        return {k: shape(v, depth + 1, max_depth) for k, v in sorted(x.items())}
    if isinstance(x, list):
        if not x:
            return []
        return [shape(x[0], depth + 1, max_depth), f"x{len(x)}"]
    return type(x).__name__ if x is not None else "null"


today = dt.datetime.now(ZoneInfo("Europe/Rome")).date()
y = (today - dt.timedelta(days=1)).isoformat()
t = today.isoformat()
paths = [
    ("/sleep-service/sleep/dailySleepLevels", {"date": t}),
    ("/sleep-service/sleep/levels", {"date": t}),
    (f"/sleep-service/sleep/dailySleep/{t}", None),
    ("/sleep-service/sleep/dailySleepDetail", {"date": t}),
    ("/sleep-service/sleep/sleepLevels", {"date": t}),
    ("/stress-service/stress/dailyStress", {"date": y}),
    (f"/stress-service/stress/dailyStress/{y}", None),
    ("/stress-service/stress/daily", {"date": y}),
    ("/wellness-service/wellness/stressDetails", {"date": y}),
    ("/wellness-service/wellness/dailyStressDetails", {"date": y}),
    ("/wellness-service/wellness/epochs", {"date": y}),
    ("/wellness-service/wellness/dailySummaryChart", {"date": y}),
    (f"/wellness-service/wellness/daily/respiration/{y}", None),
    ("/wellness-service/wellness/daily/respiration", {"date": y}),
    ("/wellness-service/wellness/bodyBattery/reports/daily", {"startDate": t, "endDate": t}),
]
r = garmin._req("GET", "/sleep-service/sleep/dailySleep", {"Authorization": f"Bearer {garmin.token()}"}, {"date": t})
print("dailySleep top keys:", sorted(r.keys()) if isinstance(r, dict) else type(r).__name__)
for p, params in paths:
    try:
        r = garmin._req("GET", p, {"Authorization": f"Bearer {garmin.token()}"}, params)
        print("OK ", p, json.dumps(shape(r))[:2500])
    except Exception as e:
        print("ERR", p, type(e).__name__, str(getattr(e, "code", ""))[:10])
