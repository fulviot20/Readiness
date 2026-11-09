"""Monthly reports and long trends, explained in words.

For each of the last 12 calendar months: recovery, sleep, overnight HRV and heart rate, training volume
and load, fitness (CTL), weight and fitness markers, each compared with the month before and with the
average of the three months before. A few plain sentences then say what changed and what it likely
means, looking at the signals together (more training with steady HRV = load absorbed well, etc.).
"""
import datetime as dt
import math
import statistics as st

import engine

N_MONTHS = 12


def _month_start(d, back=0):
    k = d.year * 12 + d.month - 1 - back
    return dt.date(k // 12, k % 12 + 1, 1)


def _month_end(start):
    nxt = _month_start(start, -1)
    return nxt - dt.timedelta(days=1)


def _avg(xs, nd=1):
    xs = [x for x in xs if x is not None]
    return round(st.mean(xs), nd) if xs else None


def _sport(t):
    t = t or ""
    return "ride" if "Ride" in t else "run" if "Run" in t else "other"


def _stats(a, b, today, wellness, activities, gdays, days, fit):
    end = min(b, today)
    dates = [(a + dt.timedelta(days=k)).isoformat() for k in range((end - a).days + 1)]
    ds = {d["date"]: d for d in days}
    wl = {w["id"]: w for w in wellness}
    hrv = [engine.night_hrv(gdays[d]) if d in gdays else None for d in dates]
    hrv = [h if h else (wl.get(d) or {}).get("hrv") for h, d in zip(hrv, dates)]
    rhr = [engine.night_hr(gdays[d]) if d in gdays else None for d in dates]
    rhr = [h if h else (wl.get(d) or {}).get("restingHR") for h, d in zip(rhr, dates)]
    sleep = [((gdays.get(d) or {}).get("sleep") or {}).get("hours") for d in dates]
    sleep = [s if s else ((wl.get(d) or {}).get("sleepSecs") or 0) / 3600 or None for s, d in zip(sleep, dates)]
    sleep = [s for s in sleep if s and 3 <= s <= 13]
    acts = [x for x in activities if a.isoformat() <= (x.get("start_date_local") or "")[:10] <= end.isoformat()]
    mins = {"ride": 0, "run": 0, "other": 0}
    km = {"ride": 0.0, "run": 0.0}
    for x in acts:
        sp = _sport(x.get("type"))
        mins[sp] += round((x.get("moving_time") or x.get("elapsed_time") or 0) / 60)
        if sp in km and x.get("distance"):
            km[sp] += x["distance"] / 1000
    ctl = [(wl.get(d) or {}).get("ctl") for d in dates]
    ctl = [c for c in ctl if c is not None]
    weight = [(wl.get(d) or {}).get("weight") for d in dates]
    ser = {x["date"]: x for x in (fit or {}).get("series", [])}
    mark = lambda k: next((ser[d][k] for d in reversed(dates) if d in ser and ser[d].get(k) is not None), None)
    score = [ds[d]["score"] for d in dates if d in ds and ds[d].get("score") is not None]
    covered = sum(1 for d in dates if d in wl or (gdays.get(d) or {}).get("sleep") or d in ds)
    return {
        "days": len(dates), "covered": covered, "partial": b > today,
        "recovery": _avg(score, 0), "sleep_score": _avg([(ds.get(d) or {}).get("sleep_score", {}).get("score")
                                                       if (ds.get(d) or {}).get("sleep_score") else None for d in dates], 0),
        "sleep_h": _avg(sleep, 2), "hrv": _avg(hrv), "rhr": _avg(rhr),
        "hours": round(sum(mins.values()) / 60, 1), "sessions": len(acts),
        "hours_week": round(sum(mins.values()) / 60 / max(len(dates), 1) * 7, 1),
        "load": round(sum(x.get("icu_training_load") or 0 for x in acts)),
        "ride_h": round(mins["ride"] / 60, 1), "run_h": round(mins["run"] / 60, 1),
        "ride_km": round(km["ride"]), "run_km": round(km["run"]),
        "ctl": round(ctl[-1], 1) if ctl else None, "ctl_start": round(ctl[0], 1) if ctl else None,
        "weight": _avg(weight), "vo2max": mark("vo2max"), "ftp": mark("ftp"),
    }


def _pct(a, b):
    return (a - b) / b * 100 if a is not None and b else None


def _hm(h):
    m = round(h * 60)
    return f"{m // 60}h{m % 60:02d}"


def explain(cur, prev, base):
    """A headline and up to five sentences on what changed and what it likely means."""
    out = []
    ref = base or prev or {}
    # training
    vol = _pct(cur["hours_week"], ref.get("hours_week"))
    if cur["sessions"]:
        line = f"You trained {_hm(cur['hours'])} over {cur['sessions']} sessions"
        if vol is not None and abs(vol) >= 10:
            line += f", {abs(round(vol))}% {'more' if vol > 0 else 'less'} per week than your recent months"
        out.append(("training", line + "."))
    elif cur["days"] >= 7:
        out.append(("training", "No training recorded this month."))
    if cur["ctl"] is not None and cur["ctl_start"] is not None:
        d = cur["ctl"] - cur["ctl_start"]
        if abs(d) >= 3:
            out.append(("fitness", f"Fitness (CTL) {'rose' if d > 0 else 'fell'} from {cur['ctl_start']:.0f} to {cur['ctl']:.0f}"
                        f"{': the training is building up' if d > 0 else ': a lighter block, or time off, lets it drop'}."))
    # autonomic signals, read together with the load
    hrv = _pct(cur["hrv"], ref.get("hrv"))
    rhr = cur["rhr"] - ref["rhr"] if cur["rhr"] is not None and ref.get("rhr") is not None else None
    if hrv is not None:
        if hrv <= -7 and (rhr or 0) >= 1.5:
            msg = (f"Overnight HRV was {abs(round(hrv))}% below your recent months and resting heart rate {rhr:.0f} bpm higher"
                   + (": with more training, the load is costing more than usual. A lighter week would let it settle."
                      if (vol or 0) > 10 else ": with steady training this points to something else, such as illness, stress or short sleep."))
        elif hrv <= -7:
            msg = f"Overnight HRV was {abs(round(hrv))}% below your recent months, with resting heart rate steady: worth watching, not yet a warning."
        elif hrv >= 7:
            msg = f"Overnight HRV was {round(hrv)}% above your recent months" + (
                ": you're absorbing the extra training well." if (vol or 0) > 10 else ": a sign of good recovery.")
        elif (vol or 0) > 10:
            msg = "HRV held steady while training went up: the extra load is being absorbed."
        else:
            msg = "Overnight HRV and heart rate stayed in your usual range."
        out.append(("recovery" if "usual range" not in msg else "recovery_ok", msg))
    # sleep
    if cur["sleep_h"]:
        ds = (cur["sleep_h"] - ref["sleep_h"]) * 60 if ref.get("sleep_h") else None
        line = f"You slept {_hm(cur['sleep_h'])} a night on average"
        if ds is not None and abs(ds) >= 10:
            line += f", {abs(round(ds))} min {'more' if ds > 0 else 'less'} than in your recent months"
        if cur["sleep_h"] < 7:
            line += "; under 7 hours recovery from training is slower"
        out.append(("sleep", line + "."))
    # body and markers
    if cur["weight"] is not None and prev and prev.get("weight") is not None and abs(cur["weight"] - prev["weight"]) >= 0.5:
        d = cur["weight"] - prev["weight"]
        out.append(("weight", f"Average weight {'up' if d > 0 else 'down'} {abs(d):.1f} kg on last month."))
    marks = []
    if cur["ftp"] and prev and prev.get("ftp") and abs(cur["ftp"] - prev["ftp"]) >= 3:
        marks.append(f"FTP {'+' if cur['ftp'] > prev['ftp'] else '−'}{abs(round(cur['ftp'] - prev['ftp']))} W")
    if cur["vo2max"] and prev and prev.get("vo2max") and abs(cur["vo2max"] - prev["vo2max"]) >= 0.5:
        marks.append(f"VO₂max {'+' if cur['vo2max'] > prev['vo2max'] else '−'}{abs(cur['vo2max'] - prev['vo2max']):.1f}")
    if marks:
        out.append(("markers", "Markers: " + ", ".join(marks) + " on last month."))
    head = out[0][1] if out else ""
    for k in ("recovery", "fitness", "training", "recovery_ok"):
        hit = next((s for kk, s in out if kk == k), None)
        if hit:
            head = hit
            break
    return head, [s for _, s in out]


def build(wellness, activities, gdays, days, fit, today):
    months = []
    for back in range(N_MONTHS - 1, -1, -1):
        a = _month_start(today, back)
        s = _stats(a, _month_end(a), today, wellness, activities, gdays, days, fit)
        s["month"] = a.strftime("%Y-%m")
        months.append(s)
    for i, m in enumerate(months):
        prev = months[i - 1] if i else None
        base_ms = [x for x in months[max(0, i - 3):i] if x["covered"] >= 20]
        base = None
        if base_ms:
            base = {k: _avg([x.get(k) for x in base_ms], 2) for k in ("hours_week", "hrv", "rhr", "sleep_h")}
        has = m["covered"] >= 5
        m["headline"], m["lines"] = explain(m, prev, base) if has else ("", [])
        m["vs_prev"] = {k: (round(m[k] - prev[k], 1) if prev and m.get(k) is not None and prev.get(k) is not None else None)
                        for k in ("recovery", "sleep_score", "sleep_h", "hrv", "rhr", "hours_week", "ctl", "weight")}
    months = [m for m in months if m["covered"] >= 5]
    return {"months": months, "trend": long_trend(months)}


def long_trend(months):
    """Direction over the last six complete months, in words, for the signals that move slowly."""
    full = [m for m in months if not m["partial"] and m["covered"] >= 20][-6:]
    if len(full) < 3:
        return None
    out = []

    def slope(k):
        pts = [(i, m[k]) for i, m in enumerate(full) if m.get(k) is not None]
        if len(pts) < 3:
            return None, None
        xs, ys = zip(*pts)
        mx, my = st.mean(xs), st.mean(ys)
        den = sum((x - mx) ** 2 for x in xs)
        return (sum((x - mx) * (y - my) for x, y in pts) / den if den else 0.0), my

    for k, name, unit, thr, good in (("ctl", "Fitness (CTL)", "", 1.0, 1), ("hrv", "Overnight HRV", " ms", 0.8, 1),
                                     ("rhr", "Resting heart rate", " bpm", 0.3, -1), ("sleep_h", "Sleep", "", 5 / 60, 1),
                                     ("weight", "Weight", " kg", 0.15, 0), ("ftp", "FTP", " W", 2, 1)):
        b, mean = slope(k)
        if b is None:
            continue
        total = b * (len(full) - 1)
        if abs(b) < thr:
            out.append({"key": k, "dir": 0, "text": f"{name}: steady over the last {len(full)} months."})
            continue
        val = _hm(abs(total)) if k == "sleep_h" else f"{abs(total):.1f}{unit}" if k in ("weight", "hrv") else f"{abs(round(total))}{unit}"
        out.append({"key": k, "dir": 1 if b > 0 else -1, "good": (b > 0) == (good > 0) if good else None,
                    "text": f"{name}: {'up' if b > 0 else 'down'} about {val} over the last {len(full)} months."})
    return {"months": len(full), "items": out}
