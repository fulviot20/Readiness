import os
import sys
import datetime as dt

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import power  # noqa: E402


def test_analyse_steady_ride():
    s = power.analyse([250] * 3600, 280)
    assert s["mmp"]["1200"] == 250 and s["mmp"]["3600"] == 250 and "5400" not in s["mmp"]
    # 250 W is 89% of 280: tempo band, the whole hour
    assert s["zt"][3] == 3600 and sum(s["zt"]) == 3600
    assert s["kj"] == 900 and s["dk"] == {}


def test_coasting_not_counted():
    s = power.analyse([0] * 600 + [200] * 600, 280)
    assert sum(s["zt"]) == 600


def test_fit_cp_recovers_model():
    cp, wp = 280, 23000
    curve = {str(d): round(cp + wp / d) for d in power.DURS}
    f = power.fit_cp(curve)
    assert abs(f["cp"] - cp) <= 2 and abs(f["wp"] - 23.0) <= 0.3 and f["r2"] > 0.99


def test_durability_after_work():
    # 1 h at 200 W (720 kJ), then 1 h at 250 W: past 1000 kJ the best 20' is 250 W
    s = power.analyse([200] * 3600 + [250] * 3600, 280)
    assert s["dk"]["1000"]["1200"] == 250
    assert "2000" not in s["dk"]


def test_build_blocks():
    today = dt.date(2026, 11, 12)
    store = {}
    for k in range(20):
        d = (today - dt.timedelta(days=k * 4)).isoformat()
        w = [200] * 7200
        w[1000:1300] = [360] * 300
        w[3000:4200] = [300] * 1200
        store[f"a{k}"] = dict(power.analyse(w, 280), d=d, name="Ride")
    out = power.build(store, [{"icu_ftp": 280, "start_date_local": today.isoformat() + "T10:00:00"}], today)
    assert out["curve"]["300"] == 360 and out["set_cp"] == 280
    assert len(out["zones"]) == 12 and sum(out["zones"][-1]["secs"]) + sum(out["zones"][-2]["secs"]) > 0
    assert out["durability"] and out["durability"][0]["kj"] == 1000


def test_refresh_limits_and_remembers():
    today = dt.date(2026, 11, 12)
    acts = [{"id": f"r{k}", "type": "Ride", "icu_average_watts": 200, "icu_ftp": 280,
             "start_date_local": (today - dt.timedelta(days=k)).isoformat() + "T10:00:00"} for k in range(40)]
    cache, calls = {}, []
    def fetch(i):
        calls.append(i)
        return [{"type": "watts", "data": [200] * 1200}]
    power.refresh(cache, acts, today, fetch)
    assert len(calls) == power.MAX_FETCH and calls[0] == "r0"
    power.refresh(cache, acts, today, fetch)
    assert len(calls) == 40 and len(cache["power"]) == 40
