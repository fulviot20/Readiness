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


def _req(method, path, headers, params=None):
    url = BASE + path + ("?" + "&".join(f"{k}={v}" for k, v in params.items()) if params else "")
    req = urllib.request.Request(url, method=method, data=b"" if method == "POST" else None)
    req.add_header("User-Agent", UA)
    req.add_header("Accept", "application/json")
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
    try:
        return _req("GET", path, {"Authorization": f"Bearer {token()}"}, params)
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Garmin {path} returned {e.code}: {e.read()[:200].decode(errors='replace')}")


def chunks(start, end, days):
    d = start
    while d <= end:
        e = min(end, d + dt.timedelta(days=days - 1))
        yield d, e
        d = e + dt.timedelta(days=1)


def load(today, history_days=240):
    """Raw Garmin data for the last `history_days` days, keyed by calendar date."""
    start = today - dt.timedelta(days=history_days)
    sleep, hrv = {}, {}
    for a, b in chunks(start, today, 31):
        for s in get("/sleep-service/sleep/dailySleepSummariesByDate",
                     {"startDate": a.isoformat(), "endDate": b.isoformat()}) or []:
            if s.get("calendarDate"):
                sleep[s["calendarDate"]] = s
        for h in (get(f"/hrv-service/hrv/daily/{a}/{b}") or {}).get("hrvSummaries") or []:
            if h.get("calendarDate"):
                hrv[h["calendarDate"]] = h
    daily = {}
    for a, b in chunks(start, today, 365):
        for d in (get("/usersummary-service/v2/dailysummaries",
                      {"startDate": a.isoformat(), "endDate": b.isoformat()}) or {}).get("data") or []:
            if d.get("calendarDate"):
                daily[d["calendarDate"]] = d
    # night-by-night HRV readings (every 5 min) for the last few nights only
    nights = {}
    for k in range(3):
        d = (today - dt.timedelta(days=k)).isoformat()
        try:
            nights[d] = get(f"/hrv-service/hrv/{d}")
        except SystemExit:
            pass
    return {"sleep": sleep, "hrv": hrv, "daily": daily, "hrv_nights": nights}


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
    for k, v in data.items():
        dates = sorted(v)
        print(f"{k}: {len(v)} days" + (f", {dates[0]} .. {dates[-1]}" if dates else ""))
    for k in ("sleep", "hrv", "daily", "hrv_nights"):
        if data[k]:
            last = data[k][sorted(data[k])[-1]]
            print(f"\n== {k} fields ==\n" + json.dumps(shape(last), indent=1)[:3000])
