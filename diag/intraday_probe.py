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
    ("/sleep-service/sleep/dailySleep", {"date": t}),
    ("/sleep-service/sleep/dailySleepData", {"date": t}),
    (f"/sleep-service/sleep/dailySleepData/{t}", None),
    ("/wellness-service/wellness/dailySleepData", {"date": t}),
    (f"/wellness-service/wellness/dailyStress/{y}", None),
    ("/wellness-service/wellness/dailyStress", {"date": y}),
    ("/wellness-service/wellness/bodyBattery/reports/daily", {"startDate": y, "endDate": y}),
    (f"/wellness-service/wellness/bodyBattery/events/{y}", None),
    (f"/usersummary-service/stats/stress/daily/{y}/{y}", None),
    ("/wellness-service/wellness/dailyHeartRate", {"date": y}),
]
for p, params in paths:
    try:
        r = garmin._req("GET", p, {"Authorization": f"Bearer {garmin.token()}"}, params)
        print("OK ", p, json.dumps(shape(r))[:2500])
    except Exception as e:
        print("ERR", p, type(e).__name__, str(getattr(e, "code", ""))[:10])
