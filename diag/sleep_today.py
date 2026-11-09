"""Diagnostics for today's night: prints only presence flags and field types, never values."""
import datetime as dt, sys
from zoneinfo import ZoneInfo
sys.path.insert(0, ".")
import garmin, engine
today = dt.datetime.now(ZoneInfo("Europe/Rome")).date()
for d in (today, today - dt.timedelta(days=1)):
    one = garmin.get("/sleep-service/sleep/dailySleep", {"date": d.isoformat()})
    rng = garmin.get("/sleep-service/sleep/dailySleepSummariesByDate", {"startDate": d.isoformat(), "endDate": d.isoformat()})
    hrv = garmin.get(f"/hrv-service/hrv/{d}")
    print(d, "dailySleep:", type(one).__name__,
          {k: (v is not None) for k, v in (one or {}).items() if k in ("calendarDate", "sleepTimeSeconds", "sleepStartTimestampLocal", "sleepEndTimestampLocal", "deepSleepSeconds")} if isinstance(one, dict) else "",
          "| range:", type(rng).__name__, len(rng) if isinstance(rng, list) else "",
          [sorted(k for k, v in x.items() if v is not None)[:6] for x in rng][:1] if isinstance(rng, list) else "",
          "| features:", engine.sleep_features(one) is not None if isinstance(one, dict) else None,
          "| hrv readings:", len((hrv or {}).get("hrvReadings") or []) if isinstance(hrv, dict) else None)
    if isinstance(one, dict) and "dailySleepDTO" in one:
        print("  nested dailySleepDTO keys present")
    if isinstance(one, dict):
        print("  top keys:", sorted(one.keys())[:25])
    if isinstance(one, dict):
        lv = engine.sleep_levels(one)
        print("  stage segments:", len(lv) if lv else 0,
              "| keys with 'level':", [k for k in one if "level" in k.lower()])
