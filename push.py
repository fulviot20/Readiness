"""Web push notifications, sent from the calculation run (no server needed).

* VAPID keys are created once inside GitHub Actions; the private key is kept encrypted in
  cache/vapid.enc, the public key travels to the app inside the encrypted data.
* The app saves its push subscription encrypted in push/subscription.json (through the GitHub token).
* Which notifications have been sent is remembered in the encrypted feature cache, so each one goes once.
"""
import base64
import datetime as dt
import json
import os

VAPID = "cache/vapid.enc"
SUB = "push/subscription.json"
CONTACT = "mailto:readiness-bot@users.noreply.github.com"


def _b64u(b):
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def vapid_keys(pw, encrypt, decrypt):
    """Return (private_pem, public_b64url), creating them on first use."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    try:
        with open(VAPID) as f:
            k = decrypt(json.load(f), pw)
        return k["private"], k["public"]
    except Exception:
        pass
    key = ec.generate_private_key(ec.SECP256R1())
    priv = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                             serialization.NoEncryption()).decode()
    pub = _b64u(key.public_key().public_bytes(serialization.Encoding.X962,
                                              serialization.PublicFormat.UncompressedPoint))
    os.makedirs(os.path.dirname(VAPID), exist_ok=True)
    with open(VAPID, "w") as f:
        json.dump(encrypt({"private": priv, "public": pub}, pw), f)
    return priv, pub


def subscription(pw, decrypt):
    try:
        with open(SUB) as f:
            return decrypt(json.load(f), pw)
    except Exception:
        return None


def send(sub, priv_pem, payload):
    from pywebpush import webpush, WebPushException
    try:
        webpush(subscription_info=sub, data=json.dumps(payload), vapid_private_key=priv_pem,
                vapid_claims={"sub": CONTACT}, ttl=6 * 3600)
        return True
    except WebPushException as e:
        print("push failed:", getattr(e.response, "status_code", "?"))
        return False


def due(data, sent, now):
    """Notifications that should go out now: [(key, payload)]."""
    out = []
    days = {d["date"]: d for d in data["days"]}
    t = now.date().isoformat()
    d = days.get(t) or {}
    # 1. morning score, once, between 5:00 and 13:00
    if d.get("score") is not None and 5 <= now.hour < 13 and f"score:{t}" not in sent:
        sl = d.get("sleep_score") or {}
        body = [f"Sleep {sl['score']}" if sl.get("score") is not None else None, d.get("why")]
        out.append((f"score:{t}", {"title": f"Recovery {d['score']} · {d['band']}",
                                   "body": " · ".join(x for x in body if x)[:180], "tag": "score"}))
    # 2. early warning, once per day
    if d.get("alarm") and f"alarm:{t}" not in sent:
        out.append((f"alarm:{t}", {"title": "Early warning",
                                   "body": ((d.get("why") or "") + " Take it easy and see how you feel.").strip()[:200],
                                   "tag": "alarm"}))
    # 3. weekly review, Sunday from 19:00
    wk = data.get("week_review") or {}
    if now.weekday() == 6 and now.hour >= 19 and wk.get("start") and f"week:{wk['start']}" not in sent:
        out.append((f"week:{wk['start']}", {"title": "Your week in review", "body": wk.get("headline", "")[:180],
                                            "tag": "week", "url": "./?tab=training"}))
    return out


def run(data, cache, pw, encrypt, decrypt, now):
    """Adds the public key to the data and sends what's due. Returns True if the cache changed."""
    priv, pub = vapid_keys(pw, encrypt, decrypt)
    data["push_key"] = pub
    sub = subscription(pw, decrypt)
    if not sub:
        return False
    sent = cache.setdefault("push_sent", [])
    changed = False
    import hashlib
    h = hashlib.sha256(json.dumps(sub, sort_keys=True).encode()).hexdigest()[:16]
    if cache.get("push_sub") != h:          # new device: confirm it works
        if send(sub, priv, {"title": "Notifications are on",
                            "body": "You'll get your score each morning as soon as it's ready.", "tag": "hello"}):
            print("push sent: hello")
        cache["push_sub"] = h
        changed = True
    for key, payload in due(data, set(sent), now):
        if send(sub, priv, payload):
            sent.append(key)
            changed = True
            print("push sent:", key.split(":")[0])
    cache["push_sent"] = sent[-60:]
    return changed
