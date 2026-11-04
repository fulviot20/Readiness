"""Names only: sub-keys of today's daily summary (steps, calories, chronology)."""
import datetime as dt, sys
from zoneinfo import ZoneInfo
sys.path.insert(0, ".")
import garmin
t = dt.datetime.now(ZoneInfo("Europe/Rome")).date()
r = garmin.get("/usersummary-service/v2/dailysummaries", {"startDate": (t - dt.timedelta(days=1)).isoformat(), "endDate": t.isoformat()})
for d in r.get("data", []):
    mv = d.get("movement") or {}
    print(d.get("calendarDate"), "steps keys:", {k: (sorted(v) if isinstance(v, dict) else type(v).__name__) for k, v in mv.items()},
          "| calories:", sorted(k for k, v in (d.get("calories") or {}).items() if v is not None),
          "| chrono:", sorted((d.get("wellnessChronology") or {}).keys()),
          "| intensity:", sorted((d.get("intensityMinutes") or {}).keys()))
