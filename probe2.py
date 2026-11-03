"""Diagnostics: prints only types, lengths, status codes and header names, never secret values."""
import json, os, urllib.request, urllib.error
BASE = "https://personal.connectapi.garmin.com"
key = os.environ["GARMIN_API_KEY"].strip()
print("key length", len(key), "has spaces", " " in key)

def call(method, path, headers, show_body=False):
    req = urllib.request.Request(BASE + path, method=method, data=b"" if method == "POST" else None)
    for k, v in headers.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            b = r.read()
            return r.status, dict(r.headers), b
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()

st, hd, body = call("POST", "/personalapitoken-service/personal-api/personal-api-key/token",
                    {"Authorization": f"ApiKey {key}", "Accept": "*/*", "User-Agent": "readiness/1.0"})
print("token status", st, "content-type", hd.get("Content-Type"), "len", len(body))
tok = None
try:
    j = json.loads(body)
    if isinstance(j, dict):
        print("token json keys", {k: (type(v).__name__, len(str(v))) for k, v in j.items()})
        tok = j.get("access_token") or j.get("accessToken") or j.get("token")
        tt = j.get("token_type") or j.get("tokenType")
        print("token_type", tt)
    else:
        print("token json type", type(j).__name__, len(str(j)))
        tok = j
except ValueError:
    print("token not json; starts with eyJ:", body[:3] == b"eyJ", "len", len(body.strip()))
    tok = body.decode().strip()

path = "/sleep-service/sleep/dailySleep?date=2026-11-02"
variants = {
    "bearer+json": {"Authorization": f"Bearer {tok}", "Accept": "application/json"},
    "bearer+none": {"Authorization": f"Bearer {tok}"},
    "bearer+json+ua": {"Authorization": f"Bearer {tok}", "Accept": "application/json", "User-Agent": "readiness/1.0"},
    "bearer+jsonutf8": {"Authorization": f"Bearer {tok}", "Accept": "application/json;charset=UTF-8"},
    "apikey-direct": {"Authorization": f"ApiKey {key}", "Accept": "application/json"},
    "bearer+di": {"Authorization": f"Bearer {tok}", "Accept": "application/json", "DI-Backend": "connectapi.garmin.com", "NK": "NT"},
}
for name, h in variants.items():
    for p in (path, "/userprofile-service/userprofile/settings", "/usersummary-service/usersummary/daily?calendarDate=2026-11-02"):
        st, hd, b = call("GET", p, h)
        print(f"{name:16} {p[:45]:45} -> {st} {hd.get('Content-Type')} len={len(b)}" + (f" {b[:120]!r}" if st >= 400 else ""))
