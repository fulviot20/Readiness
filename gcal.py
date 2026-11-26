"""Google Calendar: one all-day event per day with today's intake targets (nutrition.py), kept up to date.

Access is through a Google Cloud service account: the calendar is shared with the account's e-mail address
("Make changes to events"), so no sign-in or refresh token is needed. Secrets:
  GOOGLE_SA_KEY   the service account's JSON key (whole file)
  GCAL_ID         the calendar id (your Gmail address for the main calendar, or a dedicated calendar's id)
The event has a fixed id per day, so every run updates the same event instead of creating new ones, and it is
only written when its text changes (the fingerprint is kept in the encrypted cache).
"""
import base64
import datetime as dt
import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

SCOPE = "https://www.googleapis.com/auth/calendar.events"
API = "https://www.googleapis.com/calendar/v3/calendars/{cal}/events"


def _b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def token(sa):
    """OAuth access token for the service account (JWT bearer grant)."""
    now = int(time.time())
    head = _b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claim = _b64(json.dumps({"iss": sa["client_email"], "scope": SCOPE, "aud": sa["token_uri"],
                             "iat": now, "exp": now + 3600}).encode())
    key = serialization.load_pem_private_key(sa["private_key"].encode(), password=None)
    sig = _b64(key.sign(f"{head}.{claim}".encode(), padding.PKCS1v15(), hashes.SHA256()))
    body = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                                   "assertion": f"{head}.{claim}.{sig}"}).encode()
    with urllib.request.urlopen(urllib.request.Request(sa["token_uri"], data=body), timeout=30) as r:
        return json.load(r)["access_token"]


def _call(method, url, tok, body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Authorization", f"Bearer {tok}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def event_id(date):
    """Calendar event ids allow only a-v and 0-9: 'rdfuel' + the date's digits."""
    return "rdfuel" + date.replace("-", "")


def upsert(sa_json, cal, date, title, desc, cache):
    """Create or update the day's event. Returns 'created', 'updated', 'unchanged'."""
    fp = hashlib.sha256(f"{cal}|{date}|{title}|{desc}".encode()).hexdigest()[:16]
    seen = cache.setdefault("gcal", {})
    if seen.get(date) == fp:
        return "unchanged"
    sa = json.loads(sa_json)
    tok = token(sa)
    base = API.format(cal=urllib.parse.quote(cal, safe=""))
    eid = event_id(date)
    nxt = (dt.date.fromisoformat(date) + dt.timedelta(days=1)).isoformat()
    body = {"summary": title, "description": desc, "start": {"date": date}, "end": {"date": nxt},
            "transparency": "transparent", "colorId": "2", "reminders": {"useDefault": False, "overrides": []}}
    try:
        _call("PUT", f"{base}/{eid}", tok, {**body, "status": "confirmed"})
        res = "updated"
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
        _call("POST", base, tok, {**body, "id": eid})
        res = "created"
    seen[date] = fp
    for d in sorted(seen)[:-10]:                  # keep the last ten days only
        seen.pop(d)
    return res
