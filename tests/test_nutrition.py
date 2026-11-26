"""Intake targets and the calendar event (synthetic data only)."""
import copy
import datetime as dt

import pytest

from fixture import TODAY, build_data
import gcal
import nutrition

NOW = dt.datetime.combine(TODAY, dt.time(10, 0))


@pytest.fixture(scope="module")
def data():
    return build_data()


def test_trend_line_not_last_value():
    pts = [((TODAY - dt.timedelta(days=d)).isoformat(), 63.0 - 0.2 / 7 * (24 - d)) for d in range(0, 25, 4)]
    pts[3] = (pts[3][0], pts[3][1] + 1.0)                     # one watery morning
    t = nutrition.weight_trend(pts, TODAY)
    assert t["rate"] < 0 and abs(t["kg"] - 62.3) < 0.5


def test_deficit_rules():
    assert nutrition.deficit_for({"kg": 62.5, "rate": -0.1, "span": 21})[0] == nutrition.DEFICIT
    assert nutrition.deficit_for({"kg": 62.5, "rate": -0.4, "span": 21})[0] < nutrition.DEFICIT      # too fast
    assert nutrition.deficit_for({"kg": 62.5, "rate": 0.0, "span": 24})[0] == nutrition.DEFICIT_MAX  # stalled
    assert nutrition.deficit_for({"kg": 60.0, "rate": 0.0, "span": 24})[0] == 0
    assert nutrition.deficit_for({"kg": 58.5, "rate": None})[0] < 0
    assert nutrition.deficit_for(None)[0] == 0


def test_targets_add_up(data):
    t = nutrition.build(data, [((TODAY - dt.timedelta(days=k)).isoformat(), 62.2) for k in (0, 5, 10, 15)], NOW)
    assert t and t["kcal"] > 1500
    kcal = t["carbs"] * 4 + t["protein"] * 4 + t["fat"] * 9
    assert abs(kcal - t["kcal"]) < 80
    assert t["protein"] == pytest.approx(1.75 * 62.2, abs=5)
    assert 0 <= t["bike_carbs"] <= t["carbs"]
    title, desc = nutrition.event_text(t)
    assert title.startswith("Fuel ·") and "Target" in desc and "Updated 10:00" in desc


def test_targets_follow_the_day(data):
    w = [((TODAY - dt.timedelta(days=k)).isoformat(), 62.2) for k in (0, 5, 10, 15)]
    base = nutrition.build(data, w, NOW)
    harder = copy.deepcopy(data)
    harder["energy"]["today"]["parts"]["active_so_far"] += 600     # a longer, harder session than planned
    assert nutrition.build(harder, w, NOW)["kcal"] >= base["kcal"] + 550
    early = copy.deepcopy(data)
    early["energy"].pop("today")                                    # before Garmin's first sync
    t = nutrition.build(early, w, NOW)
    assert t and t["source"] == "usual day"


def test_event_id_is_valid():
    eid = gcal.event_id("2026-11-26")
    assert 5 <= len(eid) and set(eid) <= set("abcdefghijklmnopqrstuv0123456789")


def test_upsert_skips_unchanged():
    cache = {"gcal": {}}
    import hashlib
    fp = hashlib.sha256("c|2026-11-26|t|d".encode()).hexdigest()[:16]
    cache["gcal"]["2026-11-26"] = fp
    assert gcal.upsert("{}", "c", "2026-11-26", "t", "d", cache) == "unchanged"
