"""Our own physiology engine on raw Garmin data.

Garmin is only the sensor: from the raw nightly sleep record, the 5-minute HRV readings and the
all-day heart-rate series we extract per-day features, then compute three scores ourselves.

  Sleep     how well the night covered your need: duration, efficiency, restorative sleep (deep + REM),
            continuity, regularity of timing, minus a short-term sleep debt.
  Recovery  autonomic recovery: overnight HRV (ln rMSSD, 7-day rolling vs 60-day baseline),
            sleeping heart rate, breathing rate during sleep, the night's Sleep score and training form.
  Strain    cardiovascular load of the whole day: Banister TRIMP from the all-day heart rate above
            30% of heart-rate reserve, scaled to your usual day.

Per-day features are cached (encrypted) in cache/features.enc so each run only downloads recent days.
"""
import datetime as dt
import json
import math
import os
import statistics as st

import garmin

CACHE = "cache/features.enc"
DETAIL_DAYS = 3          # per-day endpoints refreshed every run
BACKFILL_PER_RUN = 30    # older days filled progressively
DETAIL_HISTORY = 180


def clip(x, lo, hi):
    return max(lo, min(hi, x))


# ---------------------------------------------------------------- cache
def load_cache(pw, decrypt):
    try:
        with open(CACHE) as f:
            return decrypt(json.load(f), pw)
    except Exception:
        return {"v": 1, "days": {}}


def save_cache(cache, pw, encrypt):
    """Rewrite the encrypted cache only when its content changed (keeps commits rare)."""
    import hashlib
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    digest = hashlib.sha256(json.dumps(cache, sort_keys=True).encode()).hexdigest()
    hfile = CACHE.replace(".enc", ".hash")
    try:
        if open(hfile).read().strip() == digest and os.path.exists(CACHE):
            return False
    except OSError:
        pass
    with open(CACHE, "w") as f:
        json.dump(encrypt(cache, pw), f)
    with open(hfile, "w") as f:
        f.write(digest + "\n")
    return True


# ---------------------------------------------------------------- feature extraction
def _num(x):
    return x if isinstance(x, (int, float)) and not isinstance(x, bool) else None


def sleep_features(s):
    secs = _num(s.get("sleepTimeSeconds"))
    start, end = _num(s.get("sleepStartTimestampLocal")), _num(s.get("sleepEndTimestampLocal"))
    if not secs or not start or not end or end <= start:
        return None
    in_bed = (end - start) / 1000
    deep, rem = _num(s.get("deepSleepSeconds")) or 0, _num(s.get("remSleepSeconds")) or 0
    light, awake = _num(s.get("lightSleepSeconds")) or 0, _num(s.get("awakeSleepSeconds")) or 0
    staged = deep + rem + light > 0.5 * secs
    overall = (s.get("sleepScores") or {}).get("overall") or {}
    return {
        "start": start, "end": end,
        "start_gmt": _num(s.get("sleepStartTimestampGMT")), "end_gmt": _num(s.get("sleepEndTimestampGMT")),
        "hours": round(secs / 3600, 3),
        "eff": round(clip(secs / in_bed, 0, 1), 3),
        "deep": round(deep / 3600, 2), "rem": round(rem / 3600, 2), "light": round(light / 3600, 2),
        "awake_min": round(awake / 60), "awake_n": _num(s.get("awakeCount")),
        "restorative": round((deep + rem) / secs, 3) if staged else None,
        "hr": _num(s.get("avgHeartRate")), "resp": _num(s.get("averageRespirationValue")),
        "stress": _num(s.get("avgSleepStress")), "garmin": _num(overall.get("value")),
    }


def hrv_night(chart):
    """Median of the 5-minute rMSSD readings of the night: robust to movement artefacts."""
    vals = [_num(r.get("hrvValue")) for r in (chart or {}).get("hrvReadings") or []]
    vals = [v for v in vals if v and 5 <= v <= 250]
    if len(vals) < 12:
        return None
    return {"ms": round(st.median(vals), 1), "n": len(vals)}


def hr_features(day, sleep, rest_hint):
    """Lowest 30-min heart rate during sleep and the day's TRIMP from the all-day series."""
    desc = {d.get("key"): d.get("index") for d in day.get("heartRateValueDescriptors") or []}
    it, ih = desc.get("timestamp", 0), desc.get("heartrate", 1)
    pts = sorted((p[it], p[ih]) for p in day.get("heartRateValues") or []
                 if isinstance(p, list) and len(p) > max(it, ih) and _num(p[ih]) and 25 <= p[ih] <= 230)
    if len(pts) < 30:
        return None
    out = {"max": max(h for _, h in pts)}
    if sleep and sleep.get("start_gmt") and sleep.get("end_gmt"):
        sl = [h for t, h in pts if sleep["start_gmt"] <= t <= sleep["end_gmt"]]
        win = 15                                   # 2-minute samples -> ~30 min
        if len(sl) >= win:
            out["low30"] = round(min(st.mean(sl[i:i + win]) for i in range(len(sl) - win + 1)), 1)
    rest = out.get("low30") or rest_hint
    out["rest_used"] = rest
    out["pts"] = pts                               # used in-run for TRIMP, not cached
    return out


def trimp(pts, rest, hrmax):
    """Banister TRIMP (male weighting) counting only time above 30% of heart-rate reserve."""
    if not pts or not rest or not hrmax or hrmax <= rest + 20:
        return None
    total = 0.0
    for (t0, h0), (t1, _) in zip(pts, pts[1:]):
        dmin = min((t1 - t0) / 60000, 5)
        x = (h0 - rest) / (hrmax - rest)
        if x >= 0.3 and dmin > 0:
            total += dmin * x * 0.64 * math.exp(1.92 * x)
    return round(total, 1)


# ---------------------------------------------------------------- download
def refresh(cache, today, errors, hrmax_hint):
    days = cache["days"]
    start = today - dt.timedelta(days=240)
    for a, b in garmin.chunks(start, today, 31):
        res = garmin.safe(lambda: garmin.get("/sleep-service/sleep/dailySleepSummariesByDate",
                                             {"startDate": a.isoformat(), "endDate": b.isoformat()}), "sleep", errors)
        for s in res if isinstance(res, list) else []:
            f = sleep_features(s) if s.get("calendarDate") else None
            if f:
                days.setdefault(s["calendarDate"], {})["sleep"] = f
        res = garmin.safe(lambda: garmin.get(f"/hrv-service/hrv/daily/{a}/{b}"), "hrv", errors)
        for h in (res.get("hrvSummaries") or []) if isinstance(res, dict) else []:
            if h.get("calendarDate") and _num(h.get("lastNightAvg")):
                days.setdefault(h["calendarDate"], {})["hrv_avg"] = h["lastNightAvg"]
    res = garmin.safe(lambda: garmin.get("/usersummary-service/v2/dailysummaries",
                                         {"startDate": start.isoformat(), "endDate": today.isoformat()}), "daily", errors)
    for d in (res.get("data") or []) if isinstance(res, dict) else []:
        if d.get("calendarDate"):
            hr, stress, bb = d.get("heartRate") or {}, d.get("stress") or {}, d.get("bodyBattery") or {}
            days.setdefault(d["calendarDate"], {})["daily"] = {
                "rhr": _num(hr.get("restingValue")), "stress": _num(stress.get("avgLevel")),
                "bb_max": _num(bb.get("maxValue")), "bb_charged": _num(bb.get("chargedValue")),
                "resp": _num((d.get("respiration") or {}).get("avgValue"))}

    # per-day detail: recent days every run, older ones a batch at a time
    recent = [(today - dt.timedelta(days=k)).isoformat() for k in range(DETAIL_DAYS)]
    older = [(today - dt.timedelta(days=k)).isoformat() for k in range(DETAIL_DAYS, DETAIL_HISTORY)]
    need = lambda r: ("hr" not in r or "hrv_night" not in r) and r.get("tries", 0) < 3
    todo = recent + [d for d in older if need(days.get(d, {}))][:BACKFILL_PER_RUN]
    trimps = {}
    for d in todo:
        rec = days.setdefault(d, {})
        chart = garmin.safe(lambda: garmin.get(f"/hrv-service/hrv/{d}"), "hrv_night", errors)
        hn = hrv_night(chart) if isinstance(chart, dict) else None
        if hn:
            rec["hrv_night"] = hn
        hrd = garmin.safe(lambda: garmin.get("/wellness-service/wellness/dailyHeartRate", {"date": d}), "heart_rate", errors)
        if isinstance(hrd, dict):
            rest_hint = (rec.get("daily") or {}).get("rhr") or _num(hrd.get("restingHeartRate"))
            f = hr_features(hrd, rec.get("sleep"), rest_hint)
            if f:
                pts = f.pop("pts")
                rec["hr"] = f
                trimps[d] = pts
        if isinstance(chart, dict) and isinstance(hrd, dict):
            rec["detail"] = True
        if d not in recent:
            rec["tries"] = rec.get("tries", 0) + 1
    # TRIMP needs a stable HRmax: observed max over cached days or from activities
    hrmax = max([hrmax_hint or 0] + [(v.get("hr") or {}).get("max") or 0 for v in days.values()])
    hrmax = hrmax if hrmax >= 150 else 190
    for d, pts in trimps.items():
        rest = days[d]["hr"].get("rest_used")
        days[d]["hr"]["trimp"] = trimp(pts, rest, hrmax)
    cache["hrmax"] = hrmax
    return cache


# ---------------------------------------------------------------- scores
def _ms(vals, min_sd):
    if len(vals) < 2:
        return None, None
    return st.mean(vals), max(st.stdev(vals), min_sd)


def sleep_need(hours):
    if len(hours) < 14:
        return 7.5, 6.5
    srt = sorted(hours)
    target = clip(st.median(srt), 7.0, 9.0)
    floor = clip(srt[int(0.2 * (len(srt) - 1))], 6.0, target - 0.25)
    return target, floor


def _midpoint_min(s):
    """Sleep midpoint in minutes from local noon (handles nights across midnight)."""
    mid = (s["start"] + s["end"]) / 2 / 60000
    return (mid - 720) % 1440


def sleep_score(dates, days, i):
    d = dates[i]
    s = (days.get(d) or {}).get("sleep")
    if not s or not (3 <= s["hours"] <= 13):
        return None
    prev = [days[x]["sleep"] for x in dates[max(0, i - 30):i] if (days.get(x) or {}).get("sleep")]
    prev = [p for p in prev if 3 <= p["hours"] <= 13]
    target, floor = sleep_need([p["hours"] for p in prev])
    h = s["hours"]
    if h >= target:
        dur = 100.0
    elif h >= floor:
        dur = 100 - 25 * (target - h) / max(target - floor, 0.25)
    else:
        dur = max(0.0, 75 - 35 * (floor - h))
    eff = clip((s["eff"] - 0.75) / (0.93 - 0.75), 0, 1) * 100
    rest_hist = [p["restorative"] for p in prev if p.get("restorative") is not None]
    if s.get("restorative") is not None and len(rest_hist) >= 10:
        m, sd = _ms(rest_hist, 0.03)
        restor = clip(70 + 20 * (s["restorative"] - m) / sd, 0, 100)
    else:
        restor = None
    cont = clip(100 - (s["awake_min"] - 10) * 2, 0, 100)
    mids = [_midpoint_min(p) for p in prev[-7:]]
    if len(mids) >= 4:
        dev = abs(_midpoint_min(s) - st.mean(mids))
        reg = clip(100 - (dev - 15) * 100 / 105, 0, 100)
    else:
        dev, reg = None, None
    parts = {"duration": (dur, .40), "efficiency": (eff, .15), "restorative": (restor, .15),
             "continuity": (cont, .10), "regularity": (reg, .20)}
    avail = {k: v for k, v in parts.items() if v[0] is not None}
    base = sum(v * w for v, w in avail.values()) / sum(w for _, w in avail.values())
    last3 = [p["hours"] for p in prev[-2:]] + [h]
    debt = max(0.0, target * len(last3) - sum(last3))
    score = round(clip(base - min(15, 6 * debt), 0, 100))
    name = "Great" if score >= 85 else "Good" if score >= 70 else "Fair" if score >= 50 else "Poor"
    return {"score": score, "band": name, "hours": round(h, 2), "need": round(target, 2), "floor": round(floor, 2),
            "debt": round(debt, 2), "eff": s["eff"], "deep": s["deep"], "rem": s["rem"], "light": s["light"],
            "awake_min": s["awake_min"], "midpoint_dev": round(dev) if dev is not None else None,
            "start": s["start"], "end": s["end"], "garmin": s.get("garmin"),
            "parts": {k: round(v[0]) for k, v in avail.items()}}


def night_hrv(rec):
    hn = rec.get("hrv_night")
    return hn["ms"] if hn else rec.get("hrv_avg")


def night_hr(rec):
    return (rec.get("hr") or {}).get("low30") or (rec.get("daily") or {}).get("rhr")


def recovery_components(dates, days, i, sleep_sc, form_prev):
    d = dates[i]
    r = days.get(d) or {}
    out = {}
    hist = lambda f, n: [f(days.get(x) or {}) for x in dates[max(0, i - n):i]]

    hv = night_hrv(r)
    prior = [math.log(v) for v in hist(night_hrv, 60) if v]
    zh = None
    if hv and len(prior) >= 14:
        m, sd = _ms(prior, 0.03)
        last7 = [math.log(v) for v in [night_hrv(days.get(x) or {}) for x in dates[max(0, i - 6):i + 1]] if v]
        z7, z1 = (st.mean(last7) - m) / sd, (math.log(hv) - m) / sd
        zh = 0.6 * z7 + 0.4 * z1
        out["hrv"] = {"z": zh, "z_night": z1, "value": hv, "avg7": round(math.exp(st.mean(last7)), 1),
                      "base": round(math.exp(m), 1), "lo": round(math.exp(m - 0.5 * sd), 1),
                      "hi": round(math.exp(m + 0.5 * sd), 1), "src": "readings" if r.get("hrv_night") else "garmin"}

    hr = night_hr(r)
    priorr = [v for v in hist(night_hr, 30) if v]
    zr = None
    if hr and len(priorr) >= 10:
        m, sd = _ms(priorr, 1.0)
        zr = -(hr - m) / sd
        out["rhr"] = {"z": zr, "value": round(hr, 1), "base": round(m, 1),
                      "lo": round(m - 0.5 * sd, 1), "hi": round(m + 0.5 * sd, 1)}

    rs = (r.get("sleep") or {}).get("resp")
    priors = [v for v in hist(lambda x: (x.get("sleep") or {}).get("resp"), 30) if v]
    if rs and len(priors) >= 10:
        m, sd = _ms(priors, 0.3)
        zz = (rs - m) / sd
        out["resp"] = {"z": -max(0.0, zz - 0.5), "z_raw": zz, "value": round(rs, 1), "base": round(m, 1),
                       "lo": round(m - sd, 1), "hi": round(m + sd, 1)}

    if sleep_sc:
        out["sleep"] = {"z": clip((sleep_sc["score"] - 75) / 15, -2.5, 1.0), "value": sleep_sc["hours"],
                        "score": sleep_sc["score"], "lo": sleep_sc["floor"], "hi": sleep_sc["need"],
                        "base": sleep_sc["need"]}

    if form_prev is not None:
        f = form_prev["form"]
        zl = 1.0 if f >= -10 else (f + 30) / 20 if f >= -30 else -(abs(f) - 30) / 10
        if (zh is not None and zh < -0.5) or (zr is not None and zr < -0.5):
            zl = min(zl, 0.0)
        out["load"] = {"z": zl, "value": round(f), "ctl": round(form_prev["ctl"]), "atl": round(form_prev["atl"]),
                       "lo": -30, "hi": -10}
    return out


WEIGHTS = {"hrv": 0.40, "rhr": 0.20, "sleep": 0.15, "load": 0.15, "resp": 0.10}


def raw_recovery(comp):
    w = {k: WEIGHTS[k] for k in comp if k in WEIGHTS}
    if "hrv" not in w or sum(w.values()) < 0.6:
        return None
    return sum(comp[k]["z"] * w[k] for k in w) / sum(w.values())


def strain_score(dates, days, i, workout_load):
    rec = days.get(dates[i]) or {}
    t = (rec.get("hr") or {}).get("trimp")
    hist = [(days.get(x) or {}).get("hr", {}).get("trimp") for x in dates[max(0, i - 42):i]]
    hist = [v for v in hist if v is not None]
    if t is None:
        return None
    ref = max(st.mean(hist) if len(hist) >= 7 else 60, 25)
    v = round(100 * (1 - math.exp(-t / (1.5 * ref))))
    name = "Max" if v >= 80 else "High" if v >= 60 else "Moderate" if v >= 30 else "Light"
    return {"score": v, "band": name, "trimp": round(t), "usual": round(ref), "load": round(workout_load or 0)}
