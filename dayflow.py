"""The day hour by hour: heart rate every 5 minutes and our own energy reserve.

Energy reserve (0-100), our own model on the raw heart rate, run continuously over the last days:
  asleep   recharges towards 100, faster after a good night: each hour fills 22% x (Sleep score / 100)
           of the room left, so a full good night takes a tired evening back above 90
  awake    drains 2 points an hour just for being awake (none while you're truly at rest,
           heart rate within 8% of reserve above resting)
  effort   every minute above 30% of heart-rate reserve drains like Banister TRIMP: harder minutes
           cost exponentially more (0.3 points per TRIMP unit: an hour of endurance riding ~18,
           an hour at tempo ~30)
Slots where the watch saw nothing count as awake and still.

Stress (0-100), estimated from heart rate because Garmin's personal API has no stress series:
awake and not exercising, how far heart rate sits above your resting value, on a scale where
+5 bpm is calm and 30% of heart-rate reserve is the top. Exercise (above 30%) is shown as
activity, not stress. Walking about also lifts it, so it is a guide, not a measurement.
"""
import datetime as dt
import math

SLOT_MIN = 5
SLOTS = 24 * 60 // SLOT_MIN
SHOW_DAYS = 7
BASE_DRAIN = 2.0 / 12          # per 5-minute slot
SLEEP_FILL = 0.22              # share of the room left filled per hour of good sleep
TRIMP_COST = 0.3


def _slot(ms):
    """Slot index within its local day from a local-as-UTC timestamp in ms."""
    t = dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc)
    return t.date().isoformat(), (t.hour * 60 + t.minute) // SLOT_MIN


def _asleep(gdays, dates):
    """Set of (date, slot) inside the main sleep of each night."""
    out = set()
    for d in dates:
        s = (gdays.get(d) or {}).get("sleep")
        if not s or not s.get("start") or not s.get("end"):
            continue
        t = s["start"]
        while t < s["end"]:
            out.add(_slot(t))
            t += SLOT_MIN * 60000
    return out


def _smooth(v):
    """15-minute centred mean of the stress slots, keeping activity (-1) and gaps as they are."""
    out = []
    for k, x in enumerate(v):
        if x is None or x < 0:
            out.append(x)
            continue
        w = [y for y in v[max(0, k - 1):k + 2] if y is not None and y >= 0]
        out.append(round(sum(w) / len(w)))
    return out


def _workout_hr(days):
    """Heart rate recorded by the sessions themselves, per 5-minute slot: {date: {slot: bpm}} and the peak of each day.

    During exercise the watch's all-day wrist reading is unreliable (hands on the bars, sweat, and often the session is
    recorded by a chest or arm strap on another device), so inside a session its own heart-rate trace replaces it.
    Without a trace (older sessions) the session's average is used."""
    out, peak = {}, {}
    for x in days:
        for w in x.get("workouts") or []:
            st, mins = w.get("start"), w.get("elapsed") or w.get("minutes")
            try:
                s0 = int(st[:2]) * 60 + int(st[3:5])
            except (TypeError, ValueError):
                continue
            if not mins:
                continue
            trace = [v for v in (w.get("profile") or {}).get("hr") or []]
            slots = out.setdefault(x["date"], {})
            for k in range(s0 // SLOT_MIN, min(SLOTS, -(-(s0 + mins) // SLOT_MIN))):
                a, b = max(k * SLOT_MIN, s0) - s0, min((k + 1) * SLOT_MIN, s0 + mins) - s0     # minutes into the session
                if b - a < SLOT_MIN / 2:
                    continue                                   # barely touches this slot: leave the watch's value
                if any(trace):
                    n = len(trace)
                    vals = [v for v in trace[int(a * n / mins):max(int(a * n / mins) + 1, -(-b * n // mins))] if v]
                    if vals:
                        slots[k] = round(sum(vals) / len(vals))
                elif w.get("avg_hr"):
                    slots[k] = round(w["avg_hr"])
            if w.get("max_hr"):
                peak[x["date"]] = max(peak.get(x["date"], 0), round(w["max_hr"]))
    return out, peak


def build(gdays, days, today, hrmax, now_slot=None):
    hrmax = hrmax if hrmax and hrmax >= 150 else 190
    first = today - dt.timedelta(days=12)
    dates = [(first + dt.timedelta(days=k)).isoformat() for k in range((today - first).days + 1)]
    have = [d for d in dates if ((gdays.get(d) or {}).get("hr") or {}).get("hr5")]
    if not have or today.isoformat() not in have:
        return None
    t5 = gdays[today.isoformat()]["hr"]["hr5"]
    if now_slot is None:                 # today runs up to the last slot the watch has synced
        now_slot = max(k for k, v in enumerate(t5) if v is not None)
    sleep = _asleep(gdays, dates + [(today + dt.timedelta(days=1)).isoformat()])
    score = {x["date"]: (x.get("sleep_score") or {}).get("score") for x in days}
    level, out = 60.0, {}
    session_hr, session_peak = _workout_hr(days)

    def fill(date):
        q = (score.get(date) or 75) / 100
        return 1 - (1 - SLEEP_FILL * q) ** (SLOT_MIN / 60)

    started = False
    for i, d in enumerate(dates):
        hr = ((gdays.get(d) or {}).get("hr") or {})
        h5 = hr.get("hr5")
        if not h5 and not started:
            continue
        started = True
        if h5 and session_hr.get(d):
            h5 = list(h5)
            for k, v in session_hr[d].items():
                h5[k] = v
        rest = hr.get("rest_used") or ((gdays.get(d) or {}).get("daily") or {}).get("rhr") or 55
        nxt = (dt.date.fromisoformat(d) + dt.timedelta(days=1)).isoformat()
        f_morning, f_evening = fill(d), fill(nxt)      # a night is scored on the date it ends
        series, asleep, stress = [], [], []
        for k in range(SLOTS):
            if d == today.isoformat() and now_slot is not None and k > now_slot:
                series.append(None)
                stress.append(None)
                continue
            h = h5[k] if h5 else None
            x = (h - rest) / (hrmax - rest) if h else 0
            if (d, k) in sleep:
                level += (100 - level) * (f_morning if k < SLOTS // 2 else f_evening)
                asleep.append(k)
                stress.append(None)
            else:
                top = 0.3 * (hrmax - rest)
                stress.append(None if not h else -1 if x >= 0.3 else
                              round(max(0.0, min(1.0, (h - rest - 5) / max(top - 5, 10))) * 100))
                if x >= 0.3:
                    level -= TRIMP_COST * SLOT_MIN * x * 0.64 * math.exp(1.92 * x) + BASE_DRAIN
                elif x > 0.08 or not h:
                    level -= BASE_DRAIN
            level = max(0.0, min(100.0, level))
            series.append(round(level, 1))
        runs = []
        for k in asleep:
            if runs and k == runs[-1][1] + 1:
                runs[-1][1] = k
            else:
                runs.append([k, k])
        if d == today.isoformat() and h5 and now_slot is not None:
            h5 = h5[:now_slot + 1] + [None] * (SLOTS - now_slot - 1)
        out[d] = {"energy": series, "hr": h5 or [None] * SLOTS, "rest": round(rest), "sleep": runs,
                  "stress": _smooth(stress), "peak": session_peak.get(d)}
    keep = dates[-SHOW_DAYS:]
    return {"slot_min": SLOT_MIN, "now": now_slot, "hrmax": round(hrmax), "days": {d: out[d] for d in keep if d in out}}
