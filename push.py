"""Web push notifications, sent from the calculation run (no server needed).

* VAPID keys are created once inside GitHub Actions; the private key is kept encrypted in
  cache/vapid.enc, the public key travels to the app inside the encrypted data.
* Each device's push subscription arrives through the encrypted mailbox; every device gets every notification,
  and a device the browser has dropped (404/410) is forgotten.
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
    """'ok', 'gone' (the browser dropped this subscription: forget it) or 'fail'."""
    from pywebpush import webpush, WebPushException
    try:
        from py_vapid import Vapid
        webpush(subscription_info=sub, data=json.dumps(payload), vapid_private_key=Vapid.from_pem(priv_pem.encode()),
                vapid_claims={"sub": CONTACT}, ttl=6 * 3600,
                headers={"Urgency": "high"})        # delivered at once even when the phone is idle (Doze)
        return "ok"
    except WebPushException as e:
        code = getattr(e.response, "status_code", None)
        print("push failed:", code or "?")
        return "gone" if code in (404, 410) else "fail"
    except Exception as e:
        print("push failed:", type(e).__name__)
        return "fail"


def sub_id(sub):
    import hashlib
    return hashlib.sha256((sub.get("endpoint") or "").encode()).hexdigest()[:16]


REMIND = {"checkin": True, "journal": True, "weight": True, "jhour": 21}   # defaults; changed in the app's Settings


def remind_cfg(data):
    v = ((data.get("sync") or {}).get("rd_remind") or {}).get("v")
    return {**REMIND, **(v if isinstance(v, dict) else {})}


def reminders(data, sent, now, at):
    """Gentle nudges, each at most once and only when the thing is actually missing:
    * morning check-in: 25 minutes after the score notification, if no answers yet (before 11:00);
    * journal: in the evening (21:00 unless changed), if nothing was tapped for today;
    * weigh-in: in the morning, when the last weight is a week old; then not again for a week.
    `at` holds when the score notification and the last weigh-in reminder went out (epoch seconds)."""
    cfg, out = remind_cfg(data), []
    t = now.date().isoformat()
    d = next((x for x in data.get("days") or [] if x.get("date") == t), {})
    ts = now.timestamp()
    morning = d.get("score") is not None and 5 <= now.hour < 11
    scored = at.get(f"score:{t}")
    if cfg["checkin"] and morning and not d.get("answers") and scored and ts - scored >= 25 * 60 \
            and f"checkin:{t}" not in sent:
        out.append((f"checkin:{t}", {"title": "Morning check-in",
                                     "body": "Two taps: how rested you woke up and how your body feels. It fine-tunes today's score.",
                                     "tag": "checkin", "url": "./?go=checkin"}))
    try:
        jhour = min(23, max(17, int(cfg.get("jhour") or 21)))
    except (TypeError, ValueError):
        jhour = 21
    if cfg["journal"] and now.hour >= jhour and t not in ((data.get("journal") or {}).get("days") or {}) \
            and f"journal:{t}" not in sent:
        out.append((f"journal:{t}", {"title": "Today's journal",
                                     "body": "Ten seconds: tap what happened today, so tomorrow's recovery has its context.",
                                     "tag": "journal", "url": "./?go=journal"}))
    ath = data.get("athlete") or {}
    dates = [w.get("date") for w in ath.get("weights") or []] + list(((ath.get("metrics") or {}).get("weight") or {}))
    dates = [x for x in dates if x]
    age = (now.date() - dt.date.fromisoformat(max(dates))).days if dates else None
    if cfg["weight"] and morning and (age is None or age >= 7) and ts - (at.get("weight") or 0) >= 6.5 * 86400 \
            and f"weight:{t}" not in sent:
        body = (f"Your last one was {age} days ago. " if age is not None else "") + "Before breakfast is the best moment."
        out.append((f"weight:{t}", {"title": "Weekly weigh-in", "body": body, "tag": "weight", "url": "./?go=weight"}))
    return out


def due(data, sent, now, at=None):
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
    out.extend(reminders(data, sent, now, at or {}))
    return out


def run(data, cache, pw, encrypt, decrypt, now):
    """Adds the public key to the data and sends what's due to every device. Returns True if the cache changed."""
    priv, pub = vapid_keys(pw, encrypt, decrypt)
    data["push_key"] = pub
    mail = cache.setdefault("mail", {})
    subs = mail.setdefault("subs", {})
    for old in (mail.pop("sub", None), subscription(pw, decrypt)):   # single-device format used before
        if old and old.get("endpoint"):
            subs.setdefault(sub_id(old), old)
    data["push_devices"] = len(subs)
    if not subs:
        return False
    sent = cache.setdefault("push_sent", [])
    hello = set(cache.setdefault("push_hello", []))
    at = cache.setdefault("push_at", {})
    todo = due(data, set(sent), now, at)
    test = mail.get("test")
    if test and f"test:{test}" not in sent:
        todo.append((f"test:{test}", {"title": "Test notification",
                                      "body": "Notifications from Readiness reach this device.", "tag": "test"}))
    delivered = set()
    for sid, sub in list(subs.items()):
        if sid not in hello:                 # new device: confirm it works
            todo_dev = [("hello", {"title": "Notifications are on",
                                   "body": "You'll get your score each morning as soon as it's ready.", "tag": "hello"})] + todo
        else:
            todo_dev = todo
        for key, payload in todo_dev:
            r = send(sub, priv, payload)
            if r == "gone":
                subs.pop(sid, None)
                print("push: removed a device that no longer accepts notifications")
                break
            if r == "ok":
                if key == "hello":
                    hello.add(sid)
                else:
                    delivered.add(key)
                print("push sent:", key.split(":")[0])
    sent.extend(k for k, _ in todo if k in delivered)
    today = now.date().isoformat()
    for k in delivered:
        if k.startswith("score:"):
            at[k] = now.timestamp()
        elif k.startswith("weight:"):
            at["weight"] = now.timestamp()
    cache["push_at"] = {k: v for k, v in at.items() if k in ("weight", f"score:{today}")}
    cache["push_sent"] = sent[-150:]
    cache["push_hello"] = sorted(hello & set(subs))
    data["push_devices"] = len(subs)
    return True
