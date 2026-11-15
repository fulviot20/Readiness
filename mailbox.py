"""Token-free channel from the app to the calculation.

The app posts end-to-end encrypted messages (check-in, notes, push subscription) to an ntfy.sh topic
whose name is derived from the passphrase, so only someone with the passphrase can find or read it.
ntfy keeps messages for 12 hours; every run (each 10 minutes) collects them into the encrypted cache.
"""
import base64
import gzip
import hashlib
import json
import urllib.request

BASE = "https://ntfy.sh"
SYNC_KEYS = ("rd_fuel", "rd_remind", "rd_insight", "rd_gear", "rd_fuelg")    # same list as site/js/sync.js (checked by a test)
FOOD_KEYS = ("food", "lib", "fnotes", "goal")      # the food section was removed in November 2026: dropped from the cache


def keep_value(mail, obj):
    """One piece of a synced value: {key, ts, i, n, z, s}. When all n pieces of the newest change are in,
    they are joined (and unzipped) into mail['kv'][key] = {ts, v}. Returns True when a value was completed."""
    key, ts, n = obj.get("key"), obj.get("ts"), obj.get("n") or 1
    if key not in SYNC_KEYS or not isinstance(ts, (int, float)) or not 1 <= n <= 60:
        return False
    kv = mail.setdefault("kv", {})
    if ts < (kv.get(key) or {}).get("ts", 0):
        return False                                   # older than what we already have
    parts = mail.setdefault("kv_parts", {}).setdefault(key, {})
    for old in [t for t in parts if float(t) < ts - 86400000]:
        parts.pop(old)                                 # pieces of a change that never completed
    bucket = parts.setdefault(str(ts), {})
    bucket[str(obj.get("i") or 0)] = obj.get("s") or ""
    if len(bucket) < n:
        return False
    parts.pop(str(ts))
    try:
        raw = "".join(bucket[str(i)] for i in range(n))
        text = gzip.decompress(base64.b64decode(raw)).decode() if obj.get("z") else raw
        if len(text) > 400_000:
            return False
        kv[key] = {"ts": ts, "v": json.loads(text)}
    except Exception:
        return False
    for old in [t for t in parts if float(t) <= ts]:
        parts.pop(old)
    return True


def topic(pw):
    return "rd-" + hashlib.sha256(("readiness-mailbox:" + pw).encode()).hexdigest()[:32]


def collect(cache, pw, decrypt):
    """Read new messages into cache['mail']: answers/notes by date, push subscription, athlete profile and metrics.

    Messages of kind "refresh" carry nothing: they only wake the Keeper workflow (see keeper.yml)."""
    url = f"{BASE}/{topic(pw)}/json?poll=1&since=24h"
    req = urllib.request.Request(url, headers={"User-Agent": "readiness-score/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        lines = r.read().decode().splitlines()
    mail = cache.setdefault("mail", {"answers": {}, "notes": {}})
    seen = cache.setdefault("mail_seen", [])
    new = 0
    for line in lines:
        try:
            m = json.loads(line)
            if m.get("event") != "message" or m.get("id") in seen:
                continue
            env = json.loads(m.get("message") or "{}")
            obj = decrypt(env["env"], pw)
        except Exception:
            continue
        kind = env.get("kind")
        if kind in ("answers", "notes") and obj.get("date"):
            mail[kind][obj["date"]] = obj
        elif kind == "sub" and obj.get("endpoint"):          # one per device
            import hashlib
            mail.setdefault("subs", {})[hashlib.sha256(obj["endpoint"].encode()).hexdigest()[:16]] = obj
        elif kind == "test":
            mail["test"] = obj.get("ts")
        elif kind == "profile":                      # athlete profile: birth date, sex, height
            if (obj.get("ts") or 0) >= (mail.get("profile") or {}).get("ts", 0):
                mail["profile"] = obj
        elif kind == "journal" and obj.get("date"):      # habits tapped for a day; the newest copy wins
            old = mail.setdefault("journal", {}).get(obj["date"])
            if not old or (obj.get("ts") or 0) >= (old.get("ts") or 0):
                mail["journal"][obj["date"]] = obj
        elif kind == "jtags":                           # which habits are tracked, plus your own
            if (obj.get("ts") or 0) >= (mail.get("jtags") or {}).get("ts", 0):
                mail["jtags"] = obj
        elif kind == "kv":                              # a synced value (settings, gear), possibly in pieces
            keep_value(mail, obj)
        elif kind == "metric" and obj.get("key") in ("weight", "lthr") and obj.get("date"):
            series = mail.setdefault("metrics", {}).setdefault(obj["key"], {})
            if obj.get("value") is None:
                series.pop(obj["date"], None)
            else:
                series[obj["date"]] = obj["value"]
        seen.append(m["id"])
        new += 1
    for k in FOOD_KEYS:
        mail.pop(k, None)
    for k in [k for k in mail.get("kv", {}) if k not in SYNC_KEYS]:
        mail["kv"].pop(k)
    cache["mail_seen"] = seen[-600:]
    return new
