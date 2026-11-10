"""Fuelling model: how many carbohydrates a session burns, how many to take during it, how many after.

Everything is an estimate built from published physiology and the session's own data (no lab test):

1. ENERGY. On the bike, mechanical work (kJ, from the power meter) divided by gross efficiency.
   Trained cyclists sit around 20-23% (Coyle 1992; Lucia 2002): 22% is used. Without power, Garmin's calories.

2. SHARE OF THAT ENERGY FROM CARBOHYDRATE. It rises with intensity (the "crossover": Brooks & Mercier 1994;
   Romijn 1993; van Loon 2001; Achten & Jeukendrup 2003). The curve below gives the share early in a fed session
   as a function of % of FTP, applied to the time spent in each power zone (hard minutes cost far more than
   their share of the clock). Two corrections come from the meta-regression of 434 study arms by
   Rothschild et al. (Sports Med 2022, "Factors influencing substrate oxidation during submaximal cycling"):
     * duration: RER falls about 0.0004 per minute (Model II), i.e. the carb share drops ~8 points per hour
       as glycogen runs down and fat takes over;
     * carbs taken while riding push it back up: about +0.0005 RER per g/h (their models give 0.0003-0.0007).
   One RER unit spans 0.30 between pure fat (0.70) and pure carbohydrate (1.00).

3. HOW MUCH TO TAKE WHILE RIDING. This is the priority: sized on what the engine burns, not on a duration table
   (see intake_rate). The classic tables (Jeukendrup 2014; Thomas, Erdman & Burke 2016) describe the least that
   helps performance in that one session; here the aim is wider: that session, the refill for the next one, and
   a gut kept used to high intakes (Cox 2010; Costa 2017; Podlogar & Wallis 2022). Glucose + fructose above 60 g/h.

4. AFTER. What was burned minus what was taken is the hole left in glycogen. Muscle refills fastest with
   1.0-1.2 g/kg/h in the first hours (Burke, van Loon & Hawley 2017); that speed only matters when the next hard
   session is close, otherwise the day's meals do it. Protein 0.3 g/kg supports repair and helps glycogen when
   carbohydrate is below ~0.8 g/kg/h (Alghannam, Gonzalez & Betts 2018).

Individual fat-burning ability differs a lot (roughly +-25% on the carb share at a given intensity), so the numbers
are shown rounded and as "about".
"""

GE = 0.22                    # gross efficiency on the bike
KCAL_PER_G = 4.0
DRIFT_PER_MIN = 0.0004 / 0.30      # carb share lost per minute of exercise (Rothschild 2022, Model II)
DRIFT_MAX = 0.25
INTAKE_PER_GH = 0.0005 / 0.30      # carb share gained per g/h taken during exercise
FRAC_MIN, FRAC_MAX = 0.15, 1.0

# share of energy from carbohydrate early in a fed session, by intensity
BY_FTP = [(0.30, 0.28), (0.40, 0.35), (0.55, 0.44), (0.65, 0.50), (0.75, 0.58), (0.85, 0.70), (0.95, 0.84),
          (1.05, 0.95), (1.20, 1.00)]
BY_HRR = [(0.30, 0.30), (0.50, 0.45), (0.60, 0.52), (0.70, 0.62), (0.80, 0.76), (0.90, 0.92), (1.00, 1.00)]
# where the power of each zone typically sits, as a fraction of FTP, when the zone is [lo, hi] % of FTP
Z1_MID = 0.42                # the bottom zone includes soft pedalling and coasting


def _interp(table, x):
    if x <= table[0][0]:
        return table[0][1]
    for (x0, y0), (x1, y1) in zip(table, table[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return table[-1][1]


def frac_power(rel):
    """Carb share at a power expressed as a fraction of FTP."""
    return _interp(BY_FTP, rel)


def frac_hr(hrr):
    """Carb share at a fraction of heart-rate reserve (close to % of VO2 reserve)."""
    return _interp(BY_HRR, hrr)


def _drift(minutes):
    """Average loss of carb share over a session of this length (the loss grows linearly, capped)."""
    end = min(DRIFT_MAX, DRIFT_PER_MIN * minutes)
    if end < DRIFT_MAX:
        return end / 2
    t_cap = DRIFT_MAX / DRIFT_PER_MIN
    return (DRIFT_MAX / 2 * t_cap + DRIFT_MAX * (minutes - t_cap)) / minutes


def _num(x):
    return x if isinstance(x, (int, float)) and not isinstance(x, bool) and x > 0 else None


def _zone_shares(a, ftp):
    """[(power as fraction of FTP, seconds)] from Intervals' time in power zones, or None."""
    zt, bounds = a.get("icu_zone_times"), a.get("icu_power_zones")
    if not isinstance(zt, list) or not isinstance(bounds, list) or not ftp:
        return None
    secs = {}
    for z in zt:
        if isinstance(z, dict) and isinstance(z.get("id"), str) and z["id"][:1] == "Z" and z["id"][1:].isdigit():
            secs[int(z["id"][1:])] = _num(z.get("secs")) or 0
    if sum(secs.values()) < 300:
        return None
    out, lo = [], 0
    for i, hi in enumerate(bounds, start=1):
        if not isinstance(hi, (int, float)):
            return None
        hi_c = min(hi, lo + 40) if lo else hi          # the open top zone ("999") sits just above its floor
        mid = Z1_MID if i == 1 else (lo + hi_c) / 200
        if secs.get(i):
            out.append((mid, secs[i]))
        lo = hi
    return out or None


def session(a, rest=None, hrmax=None, ftp_default=None):
    """Energy and carb share of a finished activity (raw Intervals dict).

    Returns {"kcal", "frac", "min", "how"}: frac is the carb share after the duration effect and before the effect
    of what was eaten while riding (see used()). None when there isn't enough to go on."""
    mins = (_num(a.get("moving_time")) or 0) / 60
    if mins < 10:
        return None
    ftp = _num(a.get("icu_ftp")) or ftp_default
    kj = (_num(a.get("icu_joules")) or 0) / 1000
    if not kj and _num(a.get("icu_average_watts")):
        kj = a["icu_average_watts"] * mins * 60 / 1000
    if kj and ftp and "Ride" in (a.get("type") or ""):
        kcal = kj / GE / 4.184
        zones = _zone_shares(a, ftp)
        if zones:
            # scale the zone mid-points so that they add up to the work actually done
            est = sum(m * ftp * s for m, s in zones) / 1000
            k = min(1.3, max(0.7, kj / est)) if est else 1
            e = [(m * k, m * k * s) for m, s in zones]
            frac, how = sum(frac_power(m) * w for m, w in e) / sum(w for _, w in e), "power zones"
        else:
            # no zone detail: normalised power stands in for the uneven effort
            rel = (_num(a.get("icu_weighted_avg_watts")) or _num(a.get("icu_average_watts")) or kj * 1000 / (mins * 60)) / ftp
            frac, how = frac_power(rel), "average power"
    else:
        kcal, hr = _num(a.get("calories")), _num(a.get("average_heartrate"))
        if not kcal or not hr or not rest or not hrmax or hrmax <= rest + 40:
            return None
        frac, how = frac_hr((hr - rest) / (hrmax - rest)), "heart rate"
    frac0, frac = frac, min(FRAC_MAX, max(FRAC_MIN, frac - _drift(mins)))
    return {"kcal": round(kcal), "frac": round(frac, 3), "frac0": round(frac0, 3), "min": round(mins), "how": how}


def planned(p, ftp, kcal_per_min=None):
    """The same for a planned workout {minutes, steps:[{min, lo, hi}], load, type}. Rides need FTP;
    other sports need kcal_per_min from past sessions of that sport."""
    mins = _num(p.get("minutes"))
    if not mins or mins < 10:
        return None
    steps = [s for s in p.get("steps") or [] if _num(s.get("min")) and _num(s.get("hi"))]
    load = _num(p.get("load"))
    rel_load = (load / (mins / 60) / 100) ** 0.5 if load else None        # intensity factor from the planned load
    if "Ride" in (p.get("type") or "") and ftp:
        if steps:
            parts = [(((s["lo"] + s["hi"]) / 200), s["min"]) for s in steps]
            covered = sum(m for _, m in parts)
            if covered < mins * 0.98:                   # time not described by steps: easy riding
                parts.append((rel_load or 0.6, mins - covered))
        else:
            parts = [(rel_load or (0.92 if p.get("race") else 0.65), mins)]
        kj = sum(rel * ftp * m * 60 for rel, m in parts) / 1000
        frac = sum(frac_power(rel) * rel * m for rel, m in parts) / sum(rel * m for rel, m in parts)
        kcal, how = kj / GE / 4.184, "planned power"
    elif kcal_per_min:
        rel = rel_load or 0.7
        kcal, frac, how = kcal_per_min * mins * rel / 0.7, frac_power(rel), "planned load"
    else:
        return None
    frac0, frac = frac, min(FRAC_MAX, max(FRAC_MIN, frac - _drift(mins)))
    return {"kcal": round(kcal), "frac": round(frac, 3), "frac0": round(frac0, 3), "min": round(mins), "how": how}


def used(f, intake_g=0):
    """Grams of carbohydrate burned, given what was taken during the session (mirrored in site/js/food.js)."""
    rate = intake_g / (f["min"] / 60) if f["min"] else 0
    frac = min(FRAC_MAX, max(FRAC_MIN, f["frac"] + INTAKE_PER_GH * rate))
    return f["kcal"] * frac / KCAL_PER_G


REPLACE = 0.70               # share of what the engine burns that is put back in while riding
RIDE_FLOOR = 40              # g/h on any ride worth fuelling: keeps the gut used to it
RIDE_MIN = 40                # minutes below which a ride isn't fuelled


def intake_rate(f, ceiling=90, ride=True):
    """Grams per hour to take during a session (mirrored in site/js/food.js).

    On the bike fuelling comes first: it feeds the session, it starts the refill for the next one before this one
    is over, and it keeps the gut trained. So the amount is sized on the engine: 70% of what the session burns per
    hour (energy from the power, carb share from the intensity, before the fall that comes with duration), 10% more
    for every hour beyond the second, never under 40 g/h and never over what the gut tolerates. A hard hour by a
    strong rider burns 150-200 g: the ceiling is what limits it, not a guideline table.
    Other sports keep the classic duration tiers (Jeukendrup 2014; Thomas, Erdman & Burke 2016)."""
    mins = f["min"]
    if ride:
        if mins < RIDE_MIN:
            return 0
        burn = f["kcal"] * f.get("frac0", f["frac"]) / KCAL_PER_G / (mins / 60)
        want = REPLACE * burn * (1 + 0.10 * max(0, mins / 60 - 2))
        return int(round(min(ceiling, max(RIDE_FLOOR, want)) / 5) * 5)
    if mins < 75:
        return 0
    burn = used(f) / (mins / 60)
    lo, hi = (30, 60) if mins < 150 else (50, 90)
    return int(round(min(ceiling, hi, max(lo, 0.55 * burn)) / 5) * 5)


def recovery(used_g, intake_g, kg, soon, extra=0):
    """Carbs and protein for after the session (mirrored in site/js/food.js).

    soon: another demanding session within about a day. extra: grams of deficit the plan had not foreseen
    (the session ran longer or harder, or less was eaten): an unplanned hole is refilled promptly too.
    Returns {deficit, carbs (first dose), more (a second dose in the following two hours), protein, window}."""
    deficit = max(0, used_g - intake_g)
    fast = soon or extra >= 0.3 * kg
    cap = (1.2 if fast else 0.8) * kg
    carbs = 0 if deficit < 0.25 * kg else min(deficit, cap)
    more = min(deficit - carbs, 1.0 * kg) if fast and carbs else 0
    more = more if more >= 0.25 * kg else 0
    return {"deficit": round(deficit), "carbs": int(round(carbs / 5) * 5), "more": int(round(more / 5) * 5),
            "protein": int(round(0.3 * kg)), "window": "within the hour" if fast else "in your next meal"}
