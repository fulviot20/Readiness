"""Garmin Connect Personal API client (official, personal tier).

The personal API key (secret GARMIN_API_KEY) is exchanged for a short-lived access token,
then used to read raw health data. Nothing here prints personal values: only shapes and counts.
"""
import datetime as dt
import json
import os
import urllib.error
import urllib.request

BASE = "https://personal.connectapi.garmin.com"
UA = "readiness-score/1.0 (+github.com/fulviot20/Readiness)"
_token = None


def _req(method, path, headers, params=None, accept="*/*"):
    url = BASE + path + ("?" + "&".join(f"{k}={v}" for k, v in params.items()) if params else "")
    req = urllib.request.Request(url, method=method, data=b"" if method == "POST" else None)
    req.add_header("User-Agent", UA)
    req.add_header("Accept", accept)
    for k, v in headers.items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read()
        return json.loads(body) if body else None


def token():
    """Exchange the personal API key for an access token (cached for the run)."""
    global _token
    if _token:
        return _token
    key = os.environ["GARMIN_API_KEY"].strip()
    res = _req("POST", "/personalapitoken-service/personal-api/personal-api-key/token",
               {"Authorization": f"ApiKey {key}"})
    if isinstance(res, str):
        _token = res
    else:
        for k in ("access_token", "accessToken", "token", "value"):
            if isinstance(res, dict) and res.get(k):
                _token = res[k]
                break
    if not _token:
        shape = sorted(res.keys()) if isinstance(res, dict) else type(res).__name__
        raise SystemExit(f"Garmin token response not understood: {shape}")
    return _token


def get(path, params=None):
    last = None
    for accept in ("*/*", "application/json"):
        try:
            return _req("GET", path, {"Authorization": f"Bearer {token()}"}, params, accept)
        except urllib.error.HTTPError as e:
            last = f"Garmin {path} returned {e.code}: {e.read()[:200].decode(errors='replace')}"
            if e.code != 406:
                break
    raise SystemExit(last)


def safe(fn, label, errors):
    try:
        return fn()
    except SystemExit as e:
        errors.append(f"{label}: {e}")
        return None


def chunks(start, end, days):
    d = start
    while d <= end:
        e = min(end, d + dt.timedelta(days=days - 1))
        yield d, e
        d = e + dt.timedelta(days=1)


def load(today, history_days=240):
    """Raw Garmin data for the last `history_days` days, keyed by calendar date."""
    start = today - dt.timedelta(days=history_days)
    errors = []
    sleep, hrv = {}, {}
    for a, b in chunks(start, today, 31):
        res = safe(lambda: get("/sleep-service/sleep/dailySleepSummariesByDate",
                               {"startDate": a.isoformat(), "endDate": b.isoformat()}), "sleep", errors)
        for s in res if isinstance(res, list) else []:
            if s.get("calendarDate"):
                sleep[s["calendarDate"]] = s
        res = safe(lambda: get(f"/hrv-service/hrv/daily/{a}/{b}"), "hrv", errors)
        for h in (res or {}).get("hrvSummaries") or [] if isinstance(res, dict) else []:
            if h.get("calendarDate"):
                hrv[h["calendarDate"]] = h
    daily = {}
    for a, b in chunks(start, today, 365):
        res = safe(lambda: get("/usersummary-service/v2/dailysummaries",
                               {"startDate": a.isoformat(), "endDate": b.isoformat()}), "daily", errors)
        for d in (res or {}).get("data") or [] if isinstance(res, dict) else []:
            if d.get("calendarDate"):
                daily[d["calendarDate"]] = d
    # single-day endpoints, for the last few days only
    nights, one_sleep, hr = {}, {}, {}
    for k in range(3):
        d = (today - dt.timedelta(days=k)).isoformat()
        r = safe(lambda: get(f"/hrv-service/hrv/{d}"), "hrv_night", errors)
        if r: nights[d] = r
        r = safe(lambda: get("/sleep-service/sleep/dailySleep", {"date": d}), "sleep_day", errors)
        if r: one_sleep[d] = r
        r = safe(lambda: get("/wellness-service/wellness/dailyHeartRate", {"date": d}), "heart_rate", errors)
        if r: hr[d] = r
    return {"sleep": sleep, "hrv": hrv, "daily": daily, "hrv_nights": nights,
            "sleep_day": one_sleep, "heart_rate": hr, "errors": errors}


def shape(x, depth=0):
    """Structure of a JSON value without its contents."""
    if isinstance(x, dict):
        if depth >= 2:
            return f"{{{len(x)} keys}}"
        return {k: shape(v, depth + 1) for k, v in sorted(x.items())}
    if isinstance(x, list):
        return [shape(x[0], depth + 1), f"x{len(x)}"] if x else []
    return type(x).__name__ if x is not None else "null"


if __name__ == "__main__":      # probe: prints only structure and counts, never values
    from zoneinfo import ZoneInfo
    today = dt.datetime.now(ZoneInfo("Europe/Rome")).date()
    data = load(today, 40)
    errs = data.pop("errors")
    for e in sorted(set(errs)):
        print("ERROR", e)
    for k, v in data.items():
        dates = sorted(v)
        print(f"{k}: {len(v)} days" + (f", {dates[0]} .. {dates[-1]}" if dates else ""))
    for k in data:
        if data[k]:
            last = data[k][sorted(data[k])[-1]]
            print(f"\n== {k} fields ==\n" + json.dumps(shape(last), indent=1)[:3000])
