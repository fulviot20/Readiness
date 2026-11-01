"""Readiness score personale.

Legge i dati wellness e le attività da Intervals.icu, calcola lo score
giornaliero (0-100), applica il correttivo facoltativo del questionario
e scrive i risultati cifrati in site/data.enc per l'app.

Variabili d'ambiente:
  INTERVALS_API_KEY       chiave API di Intervals.icu (obbligatoria)
  INTERVALS_ATHLETE_ID    id atleta (default "0" = proprietario della chiave)
  READINESS_PASSPHRASE    frase segreta per cifrare i dati (obbligatoria)
  FIXTURE_DIR             (solo test) cartella con wellness.json e activities.json
"""
import base64
import datetime as dt
import glob
import hashlib
import json
import math
import os
import statistics as st
import urllib.request
from zoneinfo import ZoneInfo

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

TZ = ZoneInfo("Europe/Rome")
HISTORY_DAYS = 240        # giorni scaricati da Intervals
KEEP_DAYS = 120           # giorni mostrati nell'app
WEIGHTS = {"hrv": 0.40, "load": 0.25, "sleep": 0.20, "rhr": 0.15}
SLEEP_TARGET = 7.0        # ore
KDF_ITER = 200_000


# ---------------------------------------------------------------- dati
def fetch(path, params):
    key = os.environ["INTERVALS_API_KEY"]
    url = f"https://intervals.icu/api/v1/{path}?" + "&".join(f"{k}={v}" for k, v in params.items())
    req = urllib.request.Request(url)
    tok = base64.b64encode(f"API_KEY:{key}".encode()).decode()
    req.add_header("Authorization", f"Basic {tok}")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def load_data(today):
    oldest = (today - dt.timedelta(days=HISTORY_DAYS)).isoformat()
    newest = today.isoformat()
    fx = os.environ.get("FIXTURE_DIR")
    if fx:
        with open(os.path.join(fx, "wellness.json")) as f:
            wellness = json.load(f)
        with open(os.path.join(fx, "activities.json")) as f:
            activities = json.load(f)
        return wellness, activities
    aid = os.environ.get("INTERVALS_ATHLETE_ID") or "0"
    wellness = fetch(f"athlete/{aid}/wellness", {"oldest": oldest, "newest": newest})
    act_oldest = (today - dt.timedelta(days=KEEP_DAYS)).isoformat()
    activities = fetch(f"athlete/{aid}/activities", {"oldest": act_oldest, "newest": newest})
    return wellness, activities


# ---------------------------------------------------------------- cifratura
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
        except Exception as e:  # file corrotto o frase sbagliata: si ignora
            print(f"risposta ignorata {p}: {e}")
    return out


# ---------------------------------------------------------------- calcolo
def clip(x, lo, hi):
    return max(lo, min(hi, x))


def mean_sd(vals, min_sd):
    if len(vals) < 2:
        return None, None
    return st.mean(vals), max(st.stdev(vals), min_sd)


def sub(z):
    """Sottopunteggio 0-100 mostrato nell'app (70 = nella tua norma)."""
    return None if z is None else round(clip(70 + 15 * z, 0, 100))


def components(rows, i):
    r = rows[i]
    out = {}

    # HRV: 70% media 7 giorni + 30% notte, vs baseline 60 giorni (log rMSSD)
    prior = [math.log(x["hrv"]) for x in rows[max(0, i - 60):i] if x.get("hrv")]
    zh = None
    if r.get("hrv") and len(prior) >= 20:
        m, sd = mean_sd(prior, 0.03)
        last7 = [math.log(x["hrv"]) for x in rows[max(0, i - 6):i + 1] if x.get("hrv")]
        z7 = (st.mean(last7) - m) / sd
        z1 = (math.log(r["hrv"]) - m) / sd
        zh = 0.7 * z7 + 0.3 * z1
        out["hrv"] = {"z": zh, "z_night": z1, "value": r["hrv"],
                      "avg7": round(math.exp(st.mean(last7)), 1), "base": round(math.exp(m), 1)}

    # FC a riposo vs baseline 30 giorni
    priorr = [x["rhr"] for x in rows[max(0, i - 30):i] if x.get("rhr")]
    zr = None
    if r.get("rhr") and len(priorr) >= 10:
        m, sd = mean_sd(priorr, 1.0)
        zr = -(r["rhr"] - m) / sd
        out["rhr"] = {"z": zr, "value": r["rhr"], "base": round(m, 1)}

    # Sonno: durata della notte + media 3 notti (valori <4 h o >11 h scartati)
    ok = lambda s: s is not None and 4 <= s <= 11
    s = r.get("sleep")
    if ok(s):
        last3 = [x["sleep"] for x in rows[max(0, i - 2):i + 1] if ok(x.get("sleep"))]
        zs = 0.5 * clip(s - SLEEP_TARGET, -2.5, 1) + 0.5 * clip(st.mean(last3) - SLEEP_TARGET, -2.5, 1)
        out["sleep"] = {"z": zs, "value": round(s, 2), "avg3": round(st.mean(last3), 2)}

    # Carico: Form % del giorno prima (CTL-ATL)/CTL
    if i > 0 and rows[i - 1].get("ctl"):
        p = rows[i - 1]
        f = (p["ctl"] - p["atl"]) / p["ctl"] * 100
        if f >= -10:
            zl = 1.0
        elif f >= -30:
            zl = (f + 30) / 20          # da 0 (-30%) a 1 (-10%)
        else:
            zl = -(abs(f) - 30) / 10    # sotto -30% scende
        # il riposo non compensa marker fisiologici peggiorati
        if (zh is not None and zh < -0.5) or (zr is not None and zr < -0.5):
            zl = min(zl, 0.0)
        out["load"] = {"z": zl, "form": round(f), "ctl": round(p["ctl"]), "atl": round(p["atl"])}
    return out


def raw_score(comp):
    w = {k: WEIGHTS[k] for k in comp if k in WEIGHTS}
    if "hrv" not in w or sum(w.values()) < 0.6:
        return None
    tot = sum(w.values())
    return sum(comp[k]["z"] * w[k] for k in w) / tot


def band(score):
    if score >= 95:
        return "Ottima", "Giornata perfetta per la qualità o un test."
    if score >= 75:
        return "Alta", "Via libera alla qualità come da piano."
    if score >= 50:
        return "Moderata", "Segui il piano; ascolta le sensazioni nella qualità."
    if score >= 25:
        return "Bassa", "Meglio endurance facile al posto della qualità."
    return "Molto bassa", "Riposo o seduta molto leggera."


def modifier(ans):
    """Correttivo facoltativo: massimo ±15 punti; malattia = tetto a 49."""
    if not ans:
        return 0, False
    mod = 0.0
    if ans.get("feel"):
        mod += (ans["feel"] - 3) * 5
    if ans.get("sleep"):
        mod += (ans["sleep"] - 3) * 2.5
    sick = bool(ans.get("sick"))
    if sick:
        mod -= 10
    return clip(mod, -15, 15), sick


def explain(comp):
    names = {"hrv": "l'HRV", "rhr": "la FC a riposo", "sleep": "il sonno", "load": "il carico"}
    if not comp:
        return ""
    ranked = sorted(((comp[k]["z"], k) for k in comp), key=lambda t: t[0])
    lo, hi = ranked[0], ranked[-1]
    parts = []
    if lo[0] < -0.3:
        parts.append(f"Pesa soprattutto {names[lo[1]]}")
    if hi[0] > 0.3 and hi[1] != lo[1]:
        parts.append(f"a favore {names[hi[1]]}")
    if not parts:
        return "Tutti i parametri sono nella tua norma."
    s = ", ".join(parts)
    return s[0].upper() + s[1:] + "."


def build(wellness, activities, answers, today):
    rows = []
    for w in sorted(wellness, key=lambda x: x["id"]):
        rows.append({
            "date": w["id"],
            "hrv": w.get("hrv"),
            "rhr": w.get("restingHR"),
            "sleep": (w["sleepSecs"] / 3600) if w.get("sleepSecs") else None,
            "ctl": w.get("ctl"),
            "atl": w.get("atl"),
        })

    # calcolo grezzo per ogni giorno
    for i, r in enumerate(rows):
        r["comp"] = components(rows, i)
        r["raw"] = raw_score(r["comp"])

    # taratura sulla tua storia: giorno tipico = 70, 2 dev. std sopra ≈ 94
    raws = [r["raw"] for r in rows[-180:] if r["raw"] is not None]
    mu, sigma = (st.mean(raws), max(st.stdev(raws), 0.05)) if len(raws) >= 30 else (0.0, 1.0)

    feel_by_day = {}
    for a in activities:
        d = (a.get("start_date_local") or "")[:10]
        if d:
            feel_by_day.setdefault(d, []).append({
                "type": a.get("type"), "name": a.get("name"),
                "feel": a.get("feel"), "load": a.get("icu_training_load"),
                "minutes": round((a.get("moving_time") or 0) / 60)})

    days = []
    for r in rows[-KEEP_DAYS:]:
        d = r["date"]
        item = {"date": d, "workouts": feel_by_day.get(d, []), "answers": answers.get(d)}
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
                "score": round(final), "base": round(base), "mod": round(mod),
                "alarm": alarm, "band": name, "advice": advice,
                "why": ("Allarme: HRV bassa e FC a riposo alta insieme. " if alarm else "") + explain(r["comp"]),
                "comp": {k: {**{kk: vv for kk, vv in v.items() if kk not in ("z", "z_night")},
                             "sub": sub(v["z"])} for k, v in r["comp"].items()},
            })
        days.append(item)

    return {
        "generated_at": dt.datetime.now(TZ).isoformat(timespec="minutes"),
        "today": today.isoformat(),
        "calibration": {"mu": mu, "sigma": sigma, "n": len(raws)},
        "weights": WEIGHTS,
        "days": days,
    }


def main():
    today = dt.datetime.now(TZ).date()
    pw = os.environ["READINESS_PASSPHRASE"]
    wellness, activities = load_data(today)
    data = build(wellness, activities, load_answers(pw), today)
    os.makedirs("site", exist_ok=True)
    with open("site/data.enc", "w") as f:
        json.dump(encrypt(data, pw), f)
    # impronta dei dati (senza orario): serve solo a capire se qualcosa è cambiato
    stable = {k: v for k, v in data.items() if k != "generated_at"}
    h = hashlib.sha256(json.dumps(stable, sort_keys=True).encode()).hexdigest()
    with open("data.hash", "w") as f:
        f.write(h + "\n")
    last = data["days"][-1] if data["days"] else {}
    print(f"{last.get('date')}: score {last.get('score', 'in attesa')}")


if __name__ == "__main__":
    main()
