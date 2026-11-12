"""Power analysis from the ride power streams: best efforts, CP and W', durability, time by intensity.

Each ride is analysed once, when its power stream is first read, and kept in the encrypted cache as a small
summary (never the stream itself):
  mmp  best average power for each duration in DURS (seconds)
  zt   seconds in each intensity band, as % of the CP set on Intervals for that ride (coasting not counted)
  dk   best 5' and 20' power that started after the ride had already done 1000, 1500, ... kJ of work
From those summaries the app gets:
  * the power-duration curve of the last 90 days against the 90 days before,
  * CP and W' fitted on the best 3-20 min efforts, week by week (the classic 2-parameter model, work = CP*t + W'),
  * durability: how much of the fresh 5' and 20' power is still there after 1000-4000 kJ,
  * weekly hours in each band, with intensive endurance (70-80% CP) on its own.
Estimates from rides are a floor: they are as good as the hardest efforts done in the window, and the app says so.
"""
import datetime as dt

DURS = [5, 15, 30, 60, 120, 180, 300, 480, 600, 720, 900, 1200, 1800, 2400, 3600, 5400, 7200]
FIT_DURS = [180, 300, 480, 600, 720, 900, 1200]       # 3-20 min: the range where the 2-parameter model holds
KJ_STEPS = [1000, 1500, 2000, 2500, 3000, 3500, 4000]
BANDS = [(0, 55, "Recovery"), (55, 70, "Easy endurance"), (70, 80, "Intensive endurance"),
         (80, 90, "Tempo"), (90, 105, "Threshold"), (105, 999, "VO2max and above")]
POWER_DAYS = 200          # how far back ride streams are read
MAX_FETCH = 30            # new rides read per run (the rest follow on the next runs)


def _prefix(w):
    p = [0.0]
    for v in w:
        p.append(p[-1] + v)
    return p


def _best(p, n, d, start=0):
    """Best average over d seconds for windows that start at or after `start`."""
    if n - start < d:
        return None
    best = max(p[i + d] - p[i] for i in range(start, n - d + 1))
    return round(best / d)


def analyse(watts, cp):
    """Summary of one ride from its 1 Hz power stream and the CP (Intervals FTP) set for that ride."""
    w = [v if isinstance(v, (int, float)) and 0 <= v < 2500 else 0 for v in (watts or [])]
    n = len(w)
    if n < 300 or not any(w):
        return None
    p = _prefix(w)
    mmp = {str(d): b for d in DURS if (b := _best(p, n, d)) is not None}
    zt = [0] * len(BANDS)
    if cp:
        for v in w:
            if v <= 0:
                continue
            pc = v / cp * 100
            for k, (lo, hi, _) in enumerate(BANDS):
                if lo <= pc < hi:
                    zt[k] += 1
                    break
    dk, cum, j = {}, 0.0, 0
    for t in KJ_STEPS:
        while j < n and cum < t * 1000:
            cum += w[j]
            j += 1
        if cum < t * 1000:
            break
        b5, b20 = _best(p, n, 300, j), _best(p, n, 1200, j)
        if b5 is None:
            break
        dk[str(t)] = {"300": b5, "1200": b20}
    return {"mmp": mmp, "zt": zt, "dk": dk, "kj": round(p[-1] / 1000), "cp": cp or None, "s": n}


def fit_cp(curve):
    """CP and W' from best efforts: least squares of work (P*t) against t over 3-20 min."""
    pts = [(d, curve[str(d)]) for d in FIT_DURS if curve.get(str(d))]
    if len(pts) < 4:
        return None
    xs, ys = [d for d, _ in pts], [d * pw for d, pw in pts]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    cp = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx
    wp = my - cp * mx
    if not (80 <= cp <= 600) or not (2000 <= wp <= 60000):
        return None
    # how well the line explains the efforts: a low R² means the window had no real maximal efforts
    ss = sum((y - (cp * x + wp)) ** 2 for x, y in zip(xs, ys))
    st = sum((y - my) ** 2 for y in ys)
    return {"cp": round(cp), "wp": round(wp / 100) / 10, "r2": round(1 - ss / st, 3) if st else None}


def _envelope(rides):
    out = {}
    for r in rides:
        for d, v in r["mmp"].items():
            if v and v > out.get(d, 0):
                out[d] = v
    return out


def build(store, activities, today, weeks=12):
    """store: {activity id: summary with "d" = date}. Returns the "power" block for the app."""
    rides = sorted((dict(v, id=k) for k, v in (store or {}).items() if v and v.get("mmp")), key=lambda r: r["d"])
    if not rides:
        return None
    iso = today.isoformat()
    ago = lambda k: (today - dt.timedelta(days=k)).isoformat()
    now90 = [r for r in rides if ago(90) < r["d"] <= iso]
    prev90 = [r for r in rides if ago(180) < r["d"] <= ago(90)]
    curve, curve_prev = _envelope(now90), _envelope(prev90)
    # CP week by week, each from the 90 days before that Sunday
    trend = []
    last_sun = today - dt.timedelta(days=(today.weekday() + 1) % 7)
    for k in range(25, -1, -1):
        end = last_sun - dt.timedelta(weeks=k)
        win = [r for r in rides if (end - dt.timedelta(days=90)).isoformat() < r["d"] <= end.isoformat()]
        f = fit_cp(_envelope(win)) if len(win) >= 5 else None
        if f:
            trend.append({"date": end.isoformat(), **f})
    fit = fit_cp(curve)
    # durability: best 5' and 20' after each amount of work, against the fresh bests of the same 90 days
    dur = []
    for t in KJ_STEPS:
        got = [r["dk"][str(t)] for r in now90 if str(t) in (r.get("dk") or {})]
        if not got:
            continue
        b5 = max((g["300"] or 0) for g in got)
        b20 = max((g.get("1200") or 0) for g in got) or None
        dur.append({"kj": t, "p5": b5, "p20": b20, "n": len(got),
                    "pc5": round(b5 / curve["300"] * 100) if curve.get("300") else None,
                    "pc20": round(b20 / curve["1200"] * 100) if b20 and curve.get("1200") else None})
    long_rides = [{"date": r["d"], "name": r.get("name"), "kj": r["kj"],
                   "after2000": (r.get("dk") or {}).get("2000")}
                  for r in now90 if r["kj"] >= 1500][-8:]
    # weekly time in each band (Monday to Sunday)
    mon = today - dt.timedelta(days=today.weekday())
    zones = []
    for k in range(weeks - 1, -1, -1):
        a = mon - dt.timedelta(weeks=k)
        b = a + dt.timedelta(days=6)
        secs = [0] * len(BANDS)
        for r in rides:
            if a.isoformat() <= r["d"] <= b.isoformat():
                for i, s in enumerate(r.get("zt") or []):
                    secs[i] += s
        zones.append({"week": a.isoformat(), "secs": secs})
    set_cp = next((a.get("icu_ftp") for a in sorted(activities or [], key=lambda a: a.get("start_date_local") or "",
                                                     reverse=True) if a.get("icu_ftp")), None)
    return {"curve": curve, "curve_prev": curve_prev, "fit": fit, "trend": trend, "set_cp": set_cp,
            "durability": dur, "long_rides": long_rides, "zones": zones,
            "bands": [[lo, hi, name] for lo, hi, name in BANDS], "rides90": len(now90)}


def is_power_ride(a):
    t = a.get("type") or ""
    return "Ride" in t and bool(a.get("icu_average_watts") or a.get("average_watts")) and bool(a.get("id"))


def refresh(cache, activities, today, fetch_streams, have_streams=None):
    """Analyse the rides not yet in the cache (newest first, at most MAX_FETCH per run)."""
    store = cache.setdefault("power", {})
    oldest = (today - dt.timedelta(days=POWER_DAYS)).isoformat()
    for k in [k for k, v in store.items() if (v or {}).get("d", "") < (today - dt.timedelta(days=400)).isoformat()]:
        store.pop(k)
    todo = [a for a in activities if is_power_ride(a) and (a.get("start_date_local") or "")[:10] >= oldest
            and str(a["id"]) not in store]
    todo.sort(key=lambda a: a.get("start_date_local") or "", reverse=True)
    done = 0
    for a in todo:
        aid = str(a["id"])
        raw = (have_streams or {}).get(aid)
        if raw is None:
            if done >= MAX_FETCH:
                continue
            try:
                raw = fetch_streams(aid)
            except SystemExit as e:
                print(f"power stream skipped for {aid}: {str(e)[:80]}")
                continue
            done += 1
        by = {x.get("type"): x.get("data") for x in (raw or []) if isinstance(x, dict)}
        s = analyse(by.get("watts"), a.get("icu_ftp"))
        # a ride without usable power is remembered too, so it isn't read again every run
        store[aid] = dict(s or {}, d=(a.get("start_date_local") or "")[:10], name=a.get("name"))
    return done
