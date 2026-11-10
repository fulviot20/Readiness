"""Fuelling model on the real activities: only counts and ratios, never values."""
import datetime as dt, os, statistics as st, sys
sys.path.insert(0, ".")
import fuel, readiness
aid = os.environ.get("INTERVALS_ATHLETE_ID") or "0"
today = dt.date.today()
acts = readiness.fetch(f"athlete/{aid}/activities", {"oldest": (today - dt.timedelta(days=180)).isoformat(), "newest": today.isoformat()})
rides = [a for a in acts if "Ride" in (a.get("type") or "")]
has = lambda k: sum(1 for a in rides if a.get(k))
print("rides", len(rides), {k: has(k) for k in ("icu_joules", "icu_ftp", "icu_zone_times", "icu_power_zones", "carbs_used", "carbs_ingested", "calories")})
zt = next((a["icu_zone_times"] for a in rides if a.get("icu_zone_times")), None)
print("zone ids", [z.get("id") for z in zt] if zt else None, "n bounds", next((len(a["icu_power_zones"]) for a in rides if a.get("icu_power_zones")), None))
hows, ratios, rates = {}, [], []
for a in rides:
    f = fuel.session(a, 45, 190)
    hows[f["how"] if f else None] = hows.get(f["how"] if f else None, 0) + 1
    if f and a.get("carbs_used"):
        ratios.append(fuel.used(f, a.get("carbs_ingested") or 0) / a["carbs_used"])
    if a.get("carbs_ingested") and a.get("moving_time"):
        rates.append(round(a["carbs_ingested"] / (a["moving_time"] / 3600)))
print("model source", hows)
if ratios:
    q = st.quantiles(ratios, n=4) if len(ratios) > 3 else ratios
    print("ours / Intervals carbs_used: n", len(ratios), "quartiles", [round(x, 2) for x in q])
print("carbs_ingested: sessions", len(rates), "distinct g/h values", len(set(rates)), "all multiples of the same rate", len(set(rates)) <= 2)
others = [a for a in acts if a.get("type") and "Ride" not in a["type"]]
print("other sessions", len(others), "with calories+hr", sum(1 for a in others if a.get("calories") and a.get("average_heartrate")),
      "with carbs_used", sum(1 for a in others if a.get("carbs_used")))
