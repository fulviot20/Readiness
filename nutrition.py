"""Today's intake targets (calories, carbohydrate, protein, fat), recomputed on every run as the day unfolds.

1. WHAT YOU BURN. The projection of energy.py: Garmin's basal and active calories so far, the rest of the day at your
   usual pace, plus planned sessions not done yet. Before today's Garmin data arrives (early morning) the same parts
   come from your usual day. So when a session turns out longer or harder than planned, or the day is more (or less)
   active than usual, the targets follow by themselves. After 21:30 a planned session that hasn't happened is
   no longer counted.

2. THE WEIGHT GOAL. Goal band 59-61 kg, losing at most about 1 kg a month and never at the cost of the watts.
   The trend comes from the weigh-ins of the last four weeks (a straight line through them, not the last number:
   day-to-day swings are mostly water). Above the band: a deficit of about 250 kcal a day (~1 kg a month).
   It shrinks when the trend falls faster than that and grows a little (max 350) when it has stalled for 3 weeks.
   Inside the band: maintenance, corrected if the trend drifts. Below it: a small surplus.

3. THE DEFICIT FOLLOWS THE TRAINING. Hard or long days (and the day before a long one) get only a small part of it:
   those sessions and the refill for the next one come first. Rest and easy days carry more, so the week
   still averages out.

4. MACROS. Protein 1.75 g/kg (your 1.7-1.8 rule); fat at the minimum that supports hormones: 0.8 g/kg or 20% of
   the energy, whichever is higher; carbohydrate is everything else. The grams to take on the bike
   (from fuel.py) are part of the carbohydrate total and are shown separately.
"""
import datetime as dt
import statistics as st

import fuel

GOAL_LO, GOAL_HI = 59.0, 61.0
DEFICIT = 250                       # kcal/day: about 1 kg a month (7700 kcal per kg of tissue)
DEFICIT_MAX = 350
FAST_LOSS = -0.25                   # kg/week: faster than ~1 kg a month
STALL = -0.05
PROTEIN_GKG = 1.75
FAT_GKG, FAT_SHARE = 0.8, 0.20
DAY_SHARE = {"hard": 0.3, "normal": 1.0, "easy": 1.3}
LATE = 21.5                         # after this hour a planned session not done is dropped from the projection
WAKE, BED = 7.0, 23.0


def _r(x, step):
    return int(round(x / step) * step)


def weight_trend(points, today, days=28):
    """{kg, rate (kg/week or None), n} from [(date iso, kg)]: a least-squares line through the last 4 weeks."""
    pts = sorted((dt.date.fromisoformat(d), kg) for d, kg in points if kg and 35 < kg < 150)
    if not pts:
        return None
    recent = [(d, kg) for d, kg in pts if (today - d).days <= days]
    if len(recent) >= 3 and (recent[-1][0] - recent[0][0]).days >= 10:
        xs = [(d - today).days for d, _ in recent]
        ys = [kg for _, kg in recent]
        mx, my = st.mean(xs), st.mean(ys)
        slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
        return {"kg": round(my - slope * mx, 1), "rate": round(slope * 7, 2), "n": len(recent),
                "span": (recent[-1][0] - recent[0][0]).days}
    last = [kg for _, kg in pts[-3:]]
    return {"kg": round(st.median(last), 1), "rate": None, "n": len(recent), "span": 0}


def deficit_for(trend):
    """Daily kcal below what you burn (negative = surplus) and the reason, from the weight trend."""
    if not trend:
        return 0, "no weigh-ins yet: maintenance"
    kg, rate, span = trend["kg"], trend["rate"], trend.get("span", 0)
    if kg > GOAL_HI:
        if rate is not None and rate < FAST_LOSS:
            return 100, f"losing {abs(rate):.2f} kg/week, faster than 1 kg a month: deficit eased"
        if rate is not None and rate > STALL and span >= 21:
            return DEFICIT_MAX, "trend flat for 3 weeks: deficit nudged up"
        return DEFICIT, "above the goal band: slow loss, about 1 kg a month"
    if kg < GOAL_LO:
        return -200, "below the goal band: small surplus"
    if rate is not None and rate < FAST_LOSS:
        return -150, "in the goal band but dropping fast: eat a bit more"
    if rate is not None and rate > -FAST_LOSS:
        return 150, "in the goal band but rising: small deficit"
    return 0, "in the goal band: maintenance"


def _is_hard(sessions):
    load = sum(s.get("load") or 0 for s in sessions)
    long_ = any((s.get("minutes") or 0) >= 180 for s in sessions)
    intense = any(s.get("race") or max([x.get("hi") or 0 for x in s.get("steps") or []] + [0]) >= 105 for s in sessions)
    return load >= 90 or long_ or intense


def day_kind(day, tomorrow):
    """hard / normal / easy, from what is planned and done today, and tomorrow's planned sessions (a list)."""
    sessions = [w for w in day.get("workouts", []) if w.get("type")] + [p for p in day.get("plan", []) if not p.get("done")]
    if _is_hard(sessions) or any((p.get("minutes") or 0) >= 180 for p in tomorrow or []):
        return "hard"
    if not sessions or sum(s.get("load") or 0 for s in sessions) < 40:
        return "easy"
    return "normal"


def ride_carbs(day, hour):
    """Grams of carbohydrate to take on the bike today: sessions done (their real duration) and still planned."""
    g = 0
    for w in day.get("workouts", []):
        f = w.get("fuel")
        if f and "Ride" in (w.get("type") or ""):
            g += fuel.intake_rate(f) * f["min"] / 60
    if hour < LATE:
        for p in day.get("plan", []):
            f = p.get("fuel")
            if f and not p.get("done") and "Ride" in (p.get("type") or ""):
                g += fuel.intake_rate(f) * f["min"] / 60
    return g


def _hour_now(energy_today, now):
    if energy_today and energy_today.get("asof") is not None:
        return energy_today["asof"]
    return now.hour + now.minute / 60


def build(data, weights, now):
    """Targets for today, or None when the basal burn isn't known yet. weights: [(date, kg)]."""
    today = dt.date.fromisoformat(data["today"])
    days = {d["date"]: d for d in data["days"]}
    day = days.get(data["today"]) or {"workouts": [], "plan": []}
    tomorrow = (data.get("upcoming") or {}).get((today + dt.timedelta(days=1)).isoformat())
    en = data.get("energy") or {}
    et = en.get("today")
    bmr = en.get("bmr")
    if not bmr:
        return None
    hour = _hour_now(et, now)
    notes = []

    if et:
        parts = dict(et["parts"])
        if hour >= LATE and parts.get("planned"):
            notes.append("No session logged this evening: targets follow what you actually burned.")
            parts["planned"] = 0
        burn = parts["basal"] + parts["active_so_far"] + parts["rest_of_day"] + parts["planned"]
        # how the day compares with a usual one so far (outside the sessions)
        rate = bmr / 1440
        wk = sum(max(0.0, (w.get("kcal") or 0) - rate * (w.get("minutes") or 0)) for w in day.get("workouts", []))
        usual = (en.get("hourly_active") or 0) * max(0.0, min(hour, BED) - WAKE)
        life = parts["active_so_far"] - wk - usual
        if usual and abs(life) >= 150:
            notes.append(f"Day so far {'more' if life > 0 else 'less'} active than usual ({life:+.0f} kcal).")
        source = "live"
    else:
        hourly = en.get("hourly_active") or 0
        per_min = en.get("per_min") or {}
        planned = 0
        for p in day.get("plan", []):
            k = per_min.get("run" if "Run" in (p.get("type") or "") else "ride" if "Ride" in (p.get("type") or "") else "other")
            if k and p.get("minutes") and not p.get("done"):
                planned += k * p["minutes"]
        parts = {"basal": bmr, "active_so_far": 0, "rest_of_day": round(hourly * (BED - WAKE)), "planned": round(planned)}
        burn = sum(parts.values())
        source = "usual day"

    # sessions that came out different from the plan
    for p in day.get("plan", []):
        if not p.get("done") or not p.get("fuel"):
            continue
        w = next((x for x in day.get("workouts", []) if x.get("id") == p.get("done_id")), None)
        if w and w.get("fuel"):
            diff = w["fuel"]["kcal"] - p["fuel"]["kcal"]
            if abs(diff) >= 100:
                notes.append(f"{p.get('name') or 'Session'}: {'harder' if diff > 0 else 'easier'} than planned "
                             f"({diff:+.0f} kcal), targets {'up' if diff > 0 else 'down'}.")
    planned_ids = {p.get("done_id") for p in day.get("plan", []) if p.get("done")}
    for w in day.get("workouts", []):
        if w.get("type") and w.get("id") not in planned_ids and (w.get("fuel") or {}).get("kcal", 0) >= 150:
            notes.append(f"Unplanned {w.get('name') or 'session'}: +{w['fuel']['kcal']} kcal included.")

    trend = weight_trend(weights, today)
    base, why = deficit_for(trend)
    kind = day_kind(day, tomorrow)
    deficit = base * DAY_SHARE[kind] if base > 0 else base
    kcal = burn - deficit
    kg = (trend or {}).get("kg") or 62.0
    protein = PROTEIN_GKG * kg
    fat = max(FAT_GKG * kg, FAT_SHARE * kcal / 9)
    carbs = max(0.0, (kcal - protein * 4 - fat * 9) / 4)
    bike = min(ride_carbs(day, hour), carbs)
    return {
        "date": data["today"], "asof": round(hour, 2), "source": source, "kind": kind,
        "kcal": _r(kcal, 50), "carbs": _r(carbs, 5), "protein": _r(protein, 5), "fat": _r(fat, 5),
        "bike_carbs": _r(bike, 5), "food_carbs": _r(carbs - bike, 5), "carbs_gkg": round(carbs / kg, 1),
        "burn": _r(burn, 50), "parts": {k: round(v) for k, v in parts.items()},
        "deficit": round(deficit), "goal": {"lo": GOAL_LO, "hi": GOAL_HI, "why": why, **(trend or {})},
        "notes": notes, "updated": now.strftime("%H:%M"),
    }


KIND_TEXT = {"hard": "hard/long day: deficit kept small", "normal": "normal day", "easy": "easy day: deficit a bit larger"}


def event_text(t):
    """Title and description of the calendar event."""
    title = f"Fuel · {t['kcal']:,} kcal · C {t['carbs']} · P {t['protein']} · F {t['fat']}"
    p = t["parts"]
    g = t["goal"]
    lines = [
        f"Target {t['kcal']:,} kcal",
        f"Carbs {t['carbs']} g ({t['carbs_gkg']} g/kg)" + (f" — {t['bike_carbs']} g on the bike, {t['food_carbs']} g from meals"
                                                          if t["bike_carbs"] else ""),
        f"Protein {t['protein']} g · Fat {t['fat']} g",
        "",
        f"Burn today ≈ {t['burn']:,} kcal ({t['source']}): basal {p['basal']:,} · active so far {p['active_so_far']:,} · "
        f"rest of day {p['rest_of_day']:,} · sessions still to do {p['planned']:,}",
        (f"Weight {g['kg']} kg" + (f", trend {g['rate']:+.2f} kg/week" if g.get("rate") is not None else "")
         + f" · goal {g['lo']:.0f}-{g['hi']:.0f} kg") if g.get("kg") else "Weight: log a weigh-in in Readiness",
        f"{'Deficit' if t['deficit'] >= 0 else 'Surplus'} {abs(t['deficit'])} kcal — {g['why']}; {KIND_TEXT[t['kind']]}",
    ]
    if t["notes"]:
        lines += [""] + t["notes"]
    lines += ["", f"Updated {t['updated']} · Readiness (recomputed through the day)"]
    return title, "\n".join(lines)
