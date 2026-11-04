"""Fitness markers, from every session's own numbers (Garmin's VO2max isn't exposed by any API we can read).

VO2max   Each steady session gives an estimate: oxygen cost of the effort (ACSM equations: running from
         speed and climb, cycling from power and body weight) divided by the fraction of heart-rate
         reserve used, since %HRR tracks %VO2 reserve (Swain & Leutholtz 1997):
             VO2max = 3.5 + (VO2_effort - 3.5) / %HRR
         The daily value is the median of the last 30 days (at least 3 sessions).
FTP      Intervals' rolling eFTP from your rides (best recent power-duration estimate), carried forward.
Easy pace  Running speed scaled to one fixed easy heart rate (65% of HRR) using the linear HR-speed
         relationship; median of the last 30 days. Faster = better aerobic fitness.
"""
import datetime as dt
import statistics as st


def _n(x):
    return x if isinstance(x, (int, float)) and not isinstance(x, bool) and x > 0 else None


def session_points(activities, rest, hrmax):
    pts = []
    if not rest or not hrmax or hrmax <= rest + 40:
        return pts
    for a in activities:
        d = (a.get("start_date_local") or "")[:10]
        t, hr, mins = a.get("type") or "", _n(a.get("average_heartrate")), (_n(a.get("moving_time")) or 0) / 60
        if not d or not hr or mins < 20:
            continue
        hrr = (hr - rest) / (hrmax - rest)
        if not 0.45 <= hrr <= 0.92:          # too easy or too hard for a linear estimate
            continue
        p = {"date": d, "sport": None}
        if t.endswith("Run") and t != "VirtualRun":
            v = _n(a.get("average_speed"))
            dist = _n(a.get("distance"))
            if not v or not dist or not 1.8 <= v <= 7:
                continue
            grade = ((a.get("total_elevation_gain") or 0) - (a.get("total_elevation_loss") or 0)) / dist
            vm = v * 60                                  # m/min
            vo2 = 3.5 + 0.2 * vm + 0.9 * vm * max(grade, 0)
            p.update(sport="run", vo2max=3.5 + (vo2 - 3.5) / hrr)
            z2 = rest + 0.65 * (hrmax - rest)
            p["easy_speed"] = v * (z2 - rest) / (hr - rest)
        elif "Ride" in t:
            w, kg = _n(a.get("icu_average_watts")), _n(a.get("icu_weight"))
            vi = a.get("icu_variability_index") or 1
            if not w or not kg or vi > 1.15:
                continue
            vo2 = 1.8 * (w * 6.12) / kg + 7
            p.update(sport="ride", vo2max=3.5 + (vo2 - 3.5) / hrr)
        else:
            continue
        if not 25 <= p["vo2max"] <= 90:
            continue
        pts.append(p)
    return pts


def series(activities, rest, hrmax, dates):
    pts = session_points(activities, rest, hrmax)
    ftp_by_day = {}
    for a in sorted(activities, key=lambda x: x.get("start_date_local") or ""):
        d = (a.get("start_date_local") or "")[:10]
        if "Ride" in (a.get("type") or "") and _n(a.get("icu_rolling_ftp")):
            ftp_by_day[d] = (a["icu_rolling_ftp"], _n(a.get("icu_weight")))
    out, ftp, kg = [], None, None
    first = dates[0] if dates else None
    for d, v in sorted(ftp_by_day.items()):
        if first and d < first:
            ftp, kg = v
    for d in dates:
        if d in ftp_by_day:
            ftp, kg = ftp_by_day[d][0], ftp_by_day[d][1] or kg
        lo = (dt.date.fromisoformat(d) - dt.timedelta(days=30)).isoformat()
        win = [p for p in pts if lo < p["date"] <= d]
        vo = [p["vo2max"] for p in win]
        ez = [p["easy_speed"] for p in win if p.get("easy_speed")]
        out.append({"date": d,
                    "vo2max": round(st.median(vo), 1) if len(vo) >= 3 else None,
                    "vo2_n": len(vo),
                    "ftp": round(ftp) if ftp else None,
                    "wkg": round(ftp / kg, 2) if ftp and kg else None,
                    "easy_pace": round(1000 / st.median(ez)) if len(ez) >= 2 else None})   # seconds per km
    return {"series": out, "easy_hr": round(rest + 0.65 * (hrmax - rest)) if rest and hrmax else None,
            "hrmax": hrmax, "rest": round(rest) if rest else None,
            "sessions": [{"date": p["date"], "sport": p["sport"], "vo2max": round(p["vo2max"], 1)} for p in pts[-60:]]}
