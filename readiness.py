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
    activities = fetch(f"athlete/{aid}/activities", {
        "oldest": (today - dt.timedelta(days=KEEP_DAYS)).isoformat(), "newest": today.isoformat()})
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
        zs = 0.5 * clip(s - SLEEP_TARGET, -2.5, 1) + 0.5 * clip(st.mean(last3) - SLEEP_TARGET, -2.5, 1)
        out["sleep"] = {"z": zs, "value": round(s, 2), "avg3": round(st.mean(last3), 2),
                        "lo": SLEEP_TARGET, "hi": SLEEP_TARGET + 2}

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


BANDS = [(95, "Peak", "Ideal day for hard intervals or a test."),
         (75, "High", "Go ahead with the planned quality."),
         (50, "Moderate", "Stick to the plan and listen to your legs in the hard parts."),
         (25, "Low", "Swap quality for easy endurance."),
         (0, "Very low", "Rest or a very easy spin.")]


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


def build(wellness, activities, events, answers, today, streams=None):
    streams = streams or {}
    rows = []
    for w in sorted(wellness, key=lambda x: x["id"]):
        rows.append({"date": w["id"], "hrv": w.get("hrv"), "rhr": w.get("restingHR"),
                     "sleep": (w["sleepSecs"] / 3600) if w.get("sleepSecs") else None,
                     "ctl": w.get("ctl"), "atl": w.get("atl")})
    for i, r in enumerate(rows):
        r["comp"] = components(rows, i)
        r["raw"] = raw_score(r["comp"])

    raws = [r["raw"] for r in rows[-180:] if r["raw"] is not None]
    mu, sigma = (st.mean(raws), max(st.stdev(raws), 0.05)) if len(raws) >= 30 else (0.0, 1.0)

    done = {}
    for a in activities:
        d = (a.get("start_date_local") or "")[:10]
        if d:
            done.setdefault(d, []).append(summary(a, streams))
    plans = plans_by_day(events)

    days = []
    for r in rows[-KEEP_DAYS:]:
        d = r["date"]
        item = {"date": d, "workouts": done.get(d, []), "plan": plans.get(d, []), "answers": answers.get(d)}
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
        days.append({"date": t, "workouts": done.get(t, []), "plan": plans.get(t, []), "answers": answers.get(t)})
    upcoming = {d: p for d, p in plans.items() if d >= today.isoformat()}
    return {"generated_at": dt.datetime.now(TZ).isoformat(timespec="minutes"),
            "today": today.isoformat(),
            "calibration": {"mu": mu, "sigma": sigma, "n": len(raws)},
            "weights": WEIGHTS, "days": days, "upcoming": upcoming}


def main():
    today = dt.datetime.now(TZ).date()
    pw = os.environ["READINESS_PASSPHRASE"]
    wellness, activities, events, streams = load_data(today)
    data = build(wellness, activities, events, load_answers(pw), today, streams)
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
