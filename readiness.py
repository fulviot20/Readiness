"""Personal readiness score.

Reads wellness data, activities and planned workouts from Intervals.icu,
computes the daily score (0-100), applies the optional morning check-in
and writes the encrypted result to site/data.enc for the app.

Environment:
  INTERVALS_API_KEY       Intervals.icu API key (required)
  INTERVALS_ATHLETE_ID    athlete id (default "0" = owner of the key)
  READINESS_PASSPHRASE    passphrase used to encrypt the data (required)
  FIXTURE_DIR             (tests only) folder with wellness/activities/events json
"""
import base64
import datetime as dt
import glob
import hashlib
import json
import math
import os
import re
import statistics as st
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

TZ = ZoneInfo("Europe/Rome")
HISTORY_DAYS = 240
KEEP_DAYS = 120
WEIGHTS = {"hrv": 0.40, "load": 0.25, "sleep": 0.20, "rhr": 0.15}
SLEEP_TARGET = 7.0
KDF_ITER = 200_000
STREAM_DAYS = 3
PROFILE_POINTS = 140


# ---------------------------------------------------------------- data
def fetch(path, params):
    key = os.environ["INTERVALS_API_KEY"]
    url = f"https://intervals.icu/api/v1/{path}?" + "&".join(f"{k}={v}" for k, v in params.items())
    req = urllib.request.Request(url)
    tok = base64.b64encode(f"API_KEY:{key}".encode()).decode()
    req.add_header("Authorization", f"Basic {tok}")
    req.add_header("User-Agent", "readiness-score/1.0 (+github.com/fulviot20/Readiness)")
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read()[:300].decode(errors="replace")
        hint = " (check INTERVALS_API_KEY and INTERVALS_ATHLETE_ID secrets)" if e.code in (401, 403) else ""
        raise SystemExit(f"Intervals returned {e.code}{hint}: {body}")


def load_data(today):
    fx = os.environ.get("FIXTURE_DIR")
    if fx:
        def rd(name):
            p = os.path.join(fx, name)
            return json.load(open(p)) if os.path.exists(p) else []
        streams = rd("streams.json") or {}
        return rd("wellness.json"), rd("activities.json"), rd("events.json"), streams
    aid = os.environ.get("INTERVALS_ATHLETE_ID") or "0"
    wellness = fetch(f"athlete/{aid}/wellness", {
        "oldest": (today - dt.timedelta(days=HISTORY_DAYS)).isoformat(), "newest": today.isoformat()})
    # from 1 January of last year: enough for the yearly volume view
    activities = fetch(f"athlete/{aid}/activities", {
        "oldest": dt.date(today.year - 1, 1, 1).isoformat(), "newest": today.isoformat()})
    try:
        events = fetch(f"athlete/{aid}/events", {
            "oldest": (today - dt.timedelta(days=KEEP_DAYS)).isoformat(),
            "newest": (today + dt.timedelta(days=7)).isoformat()})
    except SystemExit as e:
        print(f"planned workouts skipped: {e}")
        events = []
    # power/HR profile for recent rides, for the chart in the app
    streams = {}
    recent = (today - dt.timedelta(days=STREAM_DAYS)).isoformat()
    for a in activities:
        if (a.get("start_date_local") or "")[:10] >= recent and a.get("id"):
            try:
                streams[str(a["id"])] = fetch(f"activity/{a['id']}/streams.json", {"types": "watts,heartrate"})
            except SystemExit as e:
                print(f"streams skipped for {a['id']}: {e}")
    return wellness, activities, events, streams


# ---------------------------------------------------------------- encryption
def _key(passphrase, salt):
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=KDF_ITER)
    return kdf.derive(passphrase.encode())


def encrypt(obj, passphrase):
    salt, iv = os.urandom(16), os.urandom(12)
    ct = AESGCM(_key(passphrase, salt)).encrypt(iv, json.dumps(obj, separators=(",", ":")).encode(), None)
    b = lambda x: base64.b64encode(x).decode()
    return {"v": 1, "salt": b(salt), "iv": b(iv), "ct": b(ct)}


def decrypt(env, passphrase):
    d = lambda x: base64.b64decode(x)
    pt = AESGCM(_key(passphrase, d(env["salt"]))).decrypt(d(env["iv"]), d(env["ct"]), None)
    return json.loads(pt)


def load_answers(passphrase):
    out = {}
    for p in sorted(glob.glob("answers/*.json")):
        try:
            with open(p) as f:
                a = decrypt(json.load(f), passphrase)
            out[a["date"]] = a
        except Exception as e:
            print(f"check-in skipped {p}: {e}")
    return out


def load_notes(passphrase):
    """'Something's off' notes saved from the app, one encrypted file per day."""
    out = {}
    for p in sorted(glob.glob("notes/*.json")):
        try:
            with open(p) as f:
                n = decrypt(json.load(f), passphrase)
            out[n["date"]] = n
        except Exception as e:
            print(f"note skipped {p}: {e}")
    return out


# ---------------------------------------------------------------- planned workouts
DUR = re.compile(r"(?:(\d+)h)?(?:(\d+)m(?!s))?(?:(\d+)s)?")


def _minutes(tok):
    m = DUR.fullmatch(tok)
    if not m or not any(m.groups()):
        return None
    h, mi, s = (int(x) if x else 0 for x in m.groups())
    return h * 60 + mi + s / 60


def parse_workout(text):
    """Parse Intervals workout text into [{min, lo, hi}] (intensity in % of FTP/CP)."""
    if not text:
        return []
    steps, repeat, block = [], 1, []

    def flush():
        nonlocal repeat, block
        steps.extend(block * repeat)
        repeat, block = 1, []

    for line in text.splitlines():
        s = line.strip()
        rep = re.fullmatch(r"(\d+)\s*x", s, re.I)
        if rep:
            flush()
            repeat = int(rep.group(1))
            continue
        if not s:
            if repeat > 1 and block:
                flush()
            continue
        if not s.startswith("-"):
            if repeat > 1 and block:
                flush()
            continue
        parts = s[1:].split()
        if not parts:
            continue
        mins = _minutes(parts[0])
        pct = re.search(r"(\d+)\s*%?\s*-\s*(\d+)\s*%", s) or re.search(r"(\d+)\s*%", s)
        if mins is None or not pct:
            continue
        lo = int(pct.group(1))
        hi = int(pct.group(2)) if pct.lastindex and pct.lastindex > 1 else lo
        block.append({"min": round(mins, 2), "lo": lo, "hi": hi})
    flush()
    return steps


def profile(raw_streams, n=PROFILE_POINTS):
    """Downsample watts/heartrate streams to n buckets of averages."""
    if not raw_streams:
        return None
    by = {x.get("type"): x.get("data") or [] for x in raw_streams if isinstance(x, dict)}
    w, hr = by.get("watts") or [], by.get("heartrate") or []
    length = max(len(w), len(hr))
    if length < 60:
        return None
    def bucket(series):
        if not series:
            return None
        out = []
        for i in range(n):
            a, b = i * length // n, max(i * length // n + 1, (i + 1) * length // n)
            vals = [v for v in series[a:b] if isinstance(v, (int, float))]
            out.append(round(sum(vals) / len(vals)) if vals else None)
        return out
    return {"w": bucket(w), "hr": bucket(hr)}


def summary(a, streams):
    mins = round((a.get("moving_time") or 0) / 60)
    first = lambda *ks: next((a[k] for k in ks if a.get(k) not in (None, 0)), None)
    out = {
        "id": a.get("id"), "type": a.get("type"), "name": a.get("name"), "feel": a.get("feel"),
        "rpe": a.get("icu_rpe"), "minutes": mins,
        "load": first("icu_training_load"),
        "avg_w": first("icu_average_watts", "average_watts"),
        "np": first("icu_weighted_avg_watts", "weighted_average_watts"),
        "if": first("icu_intensity"),
        "avg_hr": first("average_heartrate"), "max_hr": first("max_heartrate"),
        "kj": round(a["icu_joules"] / 1000) if a.get("icu_joules") else None,
        "km": round(a["distance"] / 1000, 1) if a.get("distance") else None,
        "elev": round(a["total_elevation_gain"]) if a.get("total_elevation_gain") else None,
        "ftp": first("icu_ftp"),
        "event": a.get("paired_event_id"),
    }
    if out["if"] and out["if"] > 3:      # Intervals sometimes reports IF as a percentage
        out["if"] = round(out["if"] / 100, 2)
    prof = profile(streams.get(str(a.get("id"))))
    if prof:
        out["profile"] = prof
    return out


def plans_by_day(events):
    out = {}
    for e in events:
        d = (e.get("start_date_local") or "")[:10]
        if not d or (e.get("category") and e["category"] != "WORKOUT"):
            continue
        steps = parse_workout(e.get("description") or "")
        out.setdefault(d, []).append({
            "id": e.get("id"), "name": e.get("name") or "Workout", "type": e.get("type"),
            "minutes": round(sum(x["min"] for x in steps)) or round((e.get("moving_time") or 0) / 60) or None,
            "load": e.get("icu_training_load"), "steps": steps})
    return out


# ---------------------------------------------------------------- score
def clip(x, lo, hi):
    return max(lo, min(hi, x))


def mean_sd(vals, min_sd):
    if len(vals) < 2:
        return None, None
    return st.mean(vals), max(st.stdev(vals), min_sd)


def sub(z):
    return None if z is None else round(clip(70 + 15 * z, 0, 100))


def sleep_need(nights):
    """Personal sleep target and minimum, learned from the last 30 valid nights (adapts quickly to a new routine).

    target = your usual night (median), kept between 6.5 and 9 h;
    floor  = your short nights (20th percentile), never below 6 h.
    Until 14 nights are available, 7 h / 6 h are used.
    """
    if len(nights) < 14:
        return SLEEP_TARGET, 6.0, len(nights)
    srt = sorted(nights)
    target = clip(st.median(srt), 6.5, 9.0)
    floor = clip(srt[int(0.2 * (len(srt) - 1))], 6.0, target - 0.25)
    return target, floor, len(nights)


def sleep_z(h, target, floor):
    if h >= target:
        return clip((h - target) / 1.5, 0, 0.6)          # small bonus for extra sleep
    if h >= floor:
        return -0.8 * (target - h) / max(target - floor, 0.25)
    return clip(-0.8 - (floor - h) / 0.75, -2.5, -0.8)    # below your minimum: steeper


def components(rows, i):
    r = rows[i]
    out = {}

    prior = [math.log(x["hrv"]) for x in rows[max(0, i - 60):i] if x.get("hrv")]
    zh = None
    if r.get("hrv") and len(prior) >= 20:
        m, sd = mean_sd(prior, 0.03)
        last7 = [math.log(x["hrv"]) for x in rows[max(0, i - 6):i + 1] if x.get("hrv")]
        z7 = (st.mean(last7) - m) / sd
        z1 = (math.log(r["hrv"]) - m) / sd
        zh = 0.7 * z7 + 0.3 * z1
        out["hrv"] = {"z": zh, "z_night": z1, "value": r["hrv"],
                      "avg7": round(math.exp(st.mean(last7)), 1), "base": round(math.exp(m), 1),
                      "lo": round(math.exp(m - 0.5 * sd), 1), "hi": round(math.exp(m + 0.5 * sd), 1)}

    priorr = [x["rhr"] for x in rows[max(0, i - 30):i] if x.get("rhr")]
    zr = None
    if r.get("rhr") and len(priorr) >= 10:
        m, sd = mean_sd(priorr, 1.0)
        zr = -(r["rhr"] - m) / sd
        out["rhr"] = {"z": zr, "value": r["rhr"], "base": round(m, 1),
                      "lo": round(m - 0.5 * sd, 1), "hi": round(m + 0.5 * sd, 1)}

    ok = lambda s: s is not None and 4 <= s <= 11
    s = r.get("sleep")
    if ok(s):
        last3 = [x["sleep"] for x in rows[max(0, i - 2):i + 1] if ok(x.get("sleep"))]
        target, floor, n = sleep_need([x.get("sleep") for x in rows[max(0, i - 30):i] if ok(x.get("sleep"))])
        zs = 0.5 * sleep_z(s, target, floor) + 0.5 * sleep_z(st.mean(last3), target, floor)
        out["sleep"] = {"z": zs, "value": round(s, 2), "avg3": round(st.mean(last3), 2),
                        "lo": round(floor, 2), "hi": round(target, 2), "base": round(target, 2), "nights": n}

    if i > 0 and rows[i - 1].get("ctl"):
        p = rows[i - 1]
        f = (p["ctl"] - p["atl"]) / p["ctl"] * 100
        if f >= -10:
            zl = 1.0
        elif f >= -30:
            zl = (f + 30) / 20
        else:
            zl = -(abs(f) - 30) / 10
        if (zh is not None and zh < -0.5) or (zr is not None and zr < -0.5):
            zl = min(zl, 0.0)
        out["load"] = {"z": zl, "value": round(f), "ctl": round(p["ctl"]), "atl": round(p["atl"]),
                       "lo": -30, "hi": -10}
    return out


def raw_score(comp):
    w = {k: WEIGHTS[k] for k in comp if k in WEIGHTS}
    if "hrv" not in w or sum(w.values()) < 0.6:
        return None
    return sum(comp[k]["z"] * w[k] for k in w) / sum(w.values())


def sleep_score(rows, i):
    """Sleep score 0-100: last night vs your own need, a 3-night debt penalty, Garmin's score when present."""
    ok = lambda s: s is not None and 4 <= s <= 11
    r = rows[i]
    s = r.get("sleep")
    if not ok(s):
        return None
    target, floor, _ = sleep_need([x.get("sleep") for x in rows[max(0, i - 30):i] if ok(x.get("sleep"))])
    if s >= target:
        dur = 100.0
    elif s >= floor:
        dur = 100 - 25 * (target - s) / max(target - floor, 0.25)
    else:
        dur = max(0.0, 75 - 30 * (floor - s))
    last3 = [x["sleep"] for x in rows[max(0, i - 2):i + 1] if ok(x.get("sleep"))]
    debt = max(0.0, target * len(last3) - sum(last3))
    g = r.get("sleep_score")
    base = 0.6 * dur + 0.4 * g if isinstance(g, (int, float)) and 0 < g <= 100 else dur
    score = round(clip(base - min(20, 8 * debt), 0, 100))
    name = "Great" if score >= 85 else "Good" if score >= 70 else "Fair" if score >= 50 else "Poor"
    return {"score": score, "band": name, "hours": round(s, 2), "need": round(target, 2),
            "debt": round(debt, 2), "garmin": g if isinstance(g, (int, float)) else None}


def strain(load, ctl):
    """Day strain 0-100 from training load vs your usual daily load (fitness): 1x -> ~49, 2x -> ~74, 3x -> ~86."""
    if not load:
        return {"score": 0, "band": "Rest", "load": 0}
    ref = max(ctl or 0, 15)
    v = round(100 * (1 - math.exp(-load / (1.5 * ref))))
    name = "Max" if v >= 80 else "High" if v >= 60 else "Moderate" if v >= 30 else "Light"
    return {"score": v, "band": name, "load": round(load)}


def spearman(xs, ys):
    def ranks(v):
        o = sorted(range(len(v)), key=lambda k: v[k])
        r = [0.0] * len(v)
        i = 0
        while i < len(o):
            j = i
            while j + 1 < len(o) and v[o[j + 1]] == v[o[i]]:
                j += 1
            for k in range(i, j + 1):
                r[o[k]] = (i + j) / 2
            i = j + 1
        return r
    if len(xs) < 5:
        return None
    rx, ry = ranks(xs), ranks(ys)
    try:
        return round(st.correlation(rx, ry), 2)
    except st.StatisticsError:
        return None


def validation(days, since="2026-11-01"):
    """How well the morning score matches how sessions felt (Intervals feel: 1 strong ... 5 weak)."""
    pairs, by_band, notes = [], {}, []
    for d in days:
        if d["date"] < since or d.get("score") is None:
            continue
        feels = [w["feel"] for w in d.get("workouts", []) if isinstance(w.get("feel"), (int, float))]
        if feels:
            f = st.mean(feels)
            pairs.append((d["score"], f))
            by_band.setdefault(d["band"], []).append(f)
        if d.get("note"):
            notes.append({"date": d["date"], "score": d["score"], **{k: v for k, v in d["note"].items() if k != "date"}})
    return {"since": since, "n": len(pairs),
            "r": spearman([p[0] for p in pairs], [-p[1] for p in pairs]),
            "by_band": {k: {"n": len(v), "feel": round(st.mean(v), 2)} for k, v in by_band.items()},
            "notes": notes}


BANDS = [(80, "Super", "Recovery is above your usual: a good day to go for it if you feel it."),
         (60, "Normal", "Recovery is in your usual range: train as planned and stay tuned to how it feels."),
         (50, "Low", "Recovery is below your usual: see how the legs respond."),
         (0, "Very low", "Recovery is well below your usual: keep an eye on how you feel today.")]


def band(score):
    for lim, name, advice in BANDS:
        if score >= lim:
            return name, advice


def modifier(ans):
    """Optional check-in: at most ±15 points; illness caps the score at 49."""
    if not ans:
        return 0, False
    mod = 0.0
    if ans.get("feel"):
        mod += (ans["feel"] - 3) * 5      # how recovered the body feels
    if ans.get("sleep"):
        mod += (ans["sleep"] - 3) * 2.5   # how rested on waking
    sick = bool(ans.get("sick"))
    if sick:
        mod -= 10
    return clip(mod, -15, 15), sick


def explain(comp):
    names = {"hrv": "HRV", "rhr": "resting HR", "sleep": "sleep", "load": "training load"}
    if not comp:
        return ""
    ranked = sorted(((comp[k]["z"], k) for k in comp), key=lambda t: t[0])
    lo, hi = ranked[0], ranked[-1]
    parts = []
    if lo[0] < -0.3:
        parts.append(f"{names[lo[1]].capitalize() if lo[1] != 'hrv' else 'HRV'} is holding you back")
    if hi[0] > 0.3 and hi[1] != lo[1]:
        parts.append(f"{names[hi[1]]} is on your side")
    if not parts:
        return "Every signal is within your normal range."
    s = ", ".join(parts)
    return s[0].upper() + s[1:] + "."


SPORTS = {"Ride": "Cycling", "VirtualRide": "Cycling", "GravelRide": "Cycling", "MountainBikeRide": "Cycling",
          "EBikeRide": "Cycling", "Velomobile": "Cycling",
          "Run": "Running", "VirtualRun": "Running", "TrailRun": "Running",
          "WeightTraining": "Strength", "Workout": "Strength", "Crossfit": "Strength", "Pilates": "Strength",
          "Yoga": "Yoga", "Hike": "Hiking", "Walk": "Walking", "Swim": "Swimming", "OpenWaterSwim": "Swimming",
          "NordicSki": "Skiing", "AlpineSki": "Skiing", "BackcountrySki": "Skiing", "Rowing": "Rowing",
          "VirtualRow": "Rowing", "RockClimbing": "Climbing", "Soccer": "Football"}


def sport_name(t):
    if t in SPORTS:
        return SPORTS[t]
    return re.sub(r"(?<!^)(?=[A-Z])", " ", t or "Other").strip() or "Other"


def volume(activities):
    """Minutes per sport per day, for weekly/monthly/yearly totals and the streak."""
    out = {}
    for a in activities:
        d = (a.get("start_date_local") or "")[:10]
        m = round((a.get("moving_time") or a.get("elapsed_time") or 0) / 60)
        if not d or m <= 0:
            continue
        sp = sport_name(a.get("type"))
        day = out.setdefault(d, {})
        day[sp] = day.get(sp, 0) + m
    return out


def week_summary(done, plans, today, n=6):
    """Current week day by day (done vs planned) plus totals for the last n weeks."""
    monday = today - dt.timedelta(days=today.weekday())
    def day_stats(d):
        ws = [w for w in done.get(d, []) if w.get("type")]
        doneev = {w.get("event") for w in ws if w.get("event")}
        ps = plans.get(d, [])
        return {"date": d,
                "done_min": sum(w["minutes"] or 0 for w in ws), "done_load": round(sum(w.get("load") or 0 for w in ws)),
                "done_n": len(ws),
                "plan_min": sum(p.get("minutes") or 0 for p in ps), "plan_load": round(sum(p.get("load") or 0 for p in ps)),
                "plan_n": len(ps), "missed": d < today.isoformat() and bool(ps) and not ws}
    current = [day_stats((monday + dt.timedelta(days=i)).isoformat()) for i in range(7)]
    hist = []
    for k in range(n - 1, -1, -1):
        start = monday - dt.timedelta(weeks=k)
        ds = [(start + dt.timedelta(days=i)).isoformat() for i in range(7)]
        ws = [w for d in ds for w in done.get(d, []) if w.get("type")]
        hist.append({"start": start.isoformat(), "minutes": sum(w["minutes"] or 0 for w in ws),
                     "load": round(sum(w.get("load") or 0 for w in ws)), "n": len(ws)})
    return {"start": monday.isoformat(), "days": current, "history": hist}


def build(wellness, activities, events, answers, today, streams=None, notes=None):
    streams = streams or {}
    notes = notes or {}
    rows = []
    for w in sorted(wellness, key=lambda x: x["id"]):
        rows.append({"date": w["id"], "hrv": w.get("hrv"), "rhr": w.get("restingHR"),
                     "sleep": (w["sleepSecs"] / 3600) if w.get("sleepSecs") else None,
                     "ctl": w.get("ctl"), "atl": w.get("atl"),
                     "sleep_score": w.get("sleepScore")})
    for i, r in enumerate(rows):
        r["comp"] = components(rows, i)
        r["raw"] = raw_score(r["comp"])

    raws = [r["raw"] for r in rows[-180:] if r["raw"] is not None]
    mu, sigma = (st.mean(raws), max(st.stdev(raws), 0.05)) if len(raws) >= 30 else (0.0, 1.0)

    done = {}
    keep_from = (today - dt.timedelta(days=KEEP_DAYS)).isoformat()
    for a in activities:
        d = (a.get("start_date_local") or "")[:10]
        if d and d >= keep_from:
            done.setdefault(d, []).append(summary(a, streams))
    plans = plans_by_day(events)

    days = []
    for j, r in enumerate(rows):
        if j < len(rows) - KEEP_DAYS:
            continue
        d = r["date"]
        prev_ctl = rows[j - 1].get("ctl") if j > 0 else r.get("ctl")
        item = {"date": d, "workouts": done.get(d, []), "plan": plans.get(d, []), "answers": answers.get(d),
                "note": notes.get(d), "sleep_score": sleep_score(rows, j),
                "strain": strain(sum(w.get("load") or 0 for w in done.get(d, [])), prev_ctl),
                "ctl": round(r["ctl"], 1) if r.get("ctl") is not None else None,
                "atl": round(r["atl"], 1) if r.get("atl") is not None else None}
        if r["raw"] is not None:
            base = clip(70 + 12 * (r["raw"] - mu) / sigma, 1, 100)
            hz = r["comp"].get("hrv", {}).get("z_night")
            rz = r["comp"].get("rhr", {}).get("z")
            alarm = hz is not None and rz is not None and hz < -1 and rz < -1
            if alarm:
                base = min(base, 49)
            mod, sick = modifier(answers.get(d))
            final = clip(base + mod, 1, 100)
            if sick or alarm:
                final = min(final, 49)
            name, advice = band(final)
            item.update({
                "score": round(final), "base": round(base), "mod": round(mod), "alarm": alarm,
                "band": name, "advice": advice,
                "why": ("Low HRV and high resting HR together: a classic early warning. " if alarm else "")
                       + explain(r["comp"]),
                "comp": {k: {**{kk: vv for kk, vv in v.items() if kk not in ("z", "z_night")},
                             "sub": sub(v["z"])} for k, v in r["comp"].items()},
            })
        days.append(item)

    t = today.isoformat()
    if not days or days[-1]["date"] != t:     # today's wellness not in yet: keep today's sessions anyway
        last_ctl = rows[-1].get("ctl") if rows else None
        days.append({"date": t, "workouts": done.get(t, []), "plan": plans.get(t, []), "answers": answers.get(t),
                     "note": notes.get(t), "strain": strain(sum(w.get("load") or 0 for w in done.get(t, [])), last_ctl)})
    upcoming = {d: p for d, p in plans.items() if d >= today.isoformat()}
    weeks = week_summary(done, plans, today)
    return {"generated_at": dt.datetime.now(TZ).isoformat(timespec="minutes"),
            "today": today.isoformat(),
            "calibration": {"mu": mu, "sigma": sigma, "n": len(raws)},
            "weights": WEIGHTS, "days": days, "upcoming": upcoming, "weeks": weeks,
            "volume": volume(activities), "validation": validation(days)}


def main():
    today = dt.datetime.now(TZ).date()
    pw = os.environ["READINESS_PASSPHRASE"]
    wellness, activities, events, streams = load_data(today)
    data = build(wellness, activities, events, load_answers(pw), today, streams, load_notes(pw))
    os.makedirs("site", exist_ok=True)
    with open("site/data.enc", "w") as f:
        json.dump(encrypt(data, pw), f)
    stable = {k: v for k, v in data.items() if k != "generated_at"}
    with open("data.hash", "w") as f:
        f.write(hashlib.sha256(json.dumps(stable, sort_keys=True).encode()).hexdigest() + "\n")
    last = data["days"][-1] if data["days"] else {}
    print(f"{last.get('date')}: score {last.get('score', 'pending')}")


if __name__ == "__main__":
    main()
