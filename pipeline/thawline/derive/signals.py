"""Signals (spec 8.8). Phase 1 kinds: crossed_line, streak, state_change.

Each signal is a dated one-sentence fact produced by a rule. Rules run over the
last `lookback_weeks` weeks so a rerun produces the same rows (idempotent).
"""

from __future__ import annotations

from datetime import date, timedelta

import pandas as pd

from .. import db
from ..config import country_in_sentence, metrics
from ..sources.indeed import series_id
from .weekly import four_week_mean, load_weekly


def fmt_date(d: date) -> str:
    return f"{d.day} {d:%b %Y}"


def streak_lengths(s: pd.Series) -> pd.Series:
    """Signed run length of consecutive weekly moves: +k after k rises, -k after k falls."""
    diff = s.diff()
    out, run = [], 0
    for d in diff:
        if pd.isna(d) or d == 0:
            run = 0
        elif d > 0:
            run = run + 1 if run > 0 else 1
        else:
            run = run - 1 if run < 0 else -1
        out.append(run)
    return pd.Series(out, index=s.index)


def sector_signals(sector: str, country: str, i4: pd.Series, since: pd.Timestamp) -> list[dict]:
    cfg = metrics()["signals"]
    label = sector or "All jobs"
    subject = series_id(country, sector)
    where = country_in_sentence(country)
    noun = f"{label} postings in {where}" if sector else f"Job postings in {where}"
    out = []
    # crossed_line: the 4-week mean moves from below 100 to 100 or above.
    above = i4 >= 100
    for i in range(1, len(i4)):
        week = i4.index[i]
        if week < since or not (above.iloc[i] and not above.iloc[i - 1]):
            continue
        previous_above = above.iloc[:i - 1][above.iloc[:i - 1]]
        if len(previous_above):
            last = previous_above.index[-1].date()
            sentence = f"{noun} rose above the line for the first time since {fmt_date(last)}."
        else:
            sentence = f"{noun} rose above the line for the first time since February 2020."
        out.append({"kind": "crossed_line", "subject_type": "series", "subject_id": subject,
                    "country": country, "signal_date": week.date(), "sentence": sentence,
                    "data": {"value": round(float(i4.iloc[i]), 2)}, "importance": 3})
    # streak: 6, 9, 13 or 26 consecutive weekly moves in one direction.
    runs = streak_lengths(i4)
    for week, k in runs.items():
        if week < since or abs(k) not in cfg["streak_lengths"]:
            continue
        verb = "risen" if k > 0 else "fallen"
        out.append({"kind": "streak", "subject_type": "series", "subject_id": subject,
                    "country": country, "signal_date": week.date(),
                    "sentence": f"{noun} have {verb} for {abs(k)} weeks.",
                    "data": {"weeks": int(k)}, "importance": 2 if abs(k) >= 13 else 1})
    return out


def state_signals(conn, since: date) -> list[dict]:
    """A Thaw Index state change that holds for two weeks.

    In ti-1 every family mapped to the same Indeed sector has the same score, so one
    signal is emitted per sector and country rather than one per family (D-011).
    """
    cfg = metrics()
    hold = cfg["signals"]["state_hold_weeks"]
    rows = conn.execute(
        """select t.week, f.indeed_sector, t.country, t.state, array_agg(f.label order by f.sort)
           from thaw_index t join role_families f on f.id = t.family_id
           where t.version = %s group by 1, 2, 3, 4 order by 2, 3, 1""",
        (cfg["thaw_index"]["version"],),
    ).fetchall()
    df = pd.DataFrame(rows, columns=["week", "sector", "country", "state", "families"])
    out = []
    for (sector, country), g in df.groupby(["sector", "country"]):
        states = g["state"].tolist()
        weeks = g["week"].tolist()
        for i in range(1, len(states) - hold + 1):
            if states[i] == states[i - 1]:
                continue
            if any(states[j] != states[i] for j in range(i, i + hold)):
                continue  # did not hold
            confirmed = weeks[i + hold - 1]
            if confirmed < since:
                continue
            where = country_in_sentence(country)
            out.append({
                "kind": "state_change", "subject_type": "sector",
                "subject_id": series_id(country, sector), "country": country,
                "signal_date": confirmed,
                "sentence": f"Roles mapped to {sector} in {where} moved from "
                            f"{states[i - 1]} to {states[i]}.",
                "data": {"from": states[i - 1], "to": states[i], "families": g["families"].iloc[i]},
                "importance": 2,
            })
    return out


def apply_cooldown(signals: list[dict], days: int) -> list[dict]:
    """Do not emit the same kind for the same subject more than once in 28 days."""
    kept, last = [], {}
    for s in sorted(signals, key=lambda s: s["signal_date"]):
        key = (s["kind"], s["subject_id"], s["country"])
        prev = last.get(key)
        if s["kind"] != "verdict_change" and prev and (s["signal_date"] - prev).days < days:
            continue
        last[key] = s["signal_date"]
        kept.append(s)
    return kept


def run(conn) -> int:
    cfg = metrics()
    from ..models.forecast import target_series
    weekly = load_weekly(conn, target_series(conn))
    if not weekly:
        return 0
    latest = max(s.index[-1] for s in weekly.values())
    since = latest - timedelta(weeks=cfg["signals"]["lookback_weeks"])
    sector_of = dict(conn.execute(
        "select id, sector from series where dataset_id = 'indeed_jpi'").fetchall())
    country_of = dict(conn.execute(
        "select id, country from series where dataset_id = 'indeed_jpi'").fetchall())
    shown = set(conn.execute("select code from countries where sort is not null").fetchall())
    shown = {c for (c,) in shown}
    signals: list[dict] = []
    for sid, s in weekly.items():
        if country_of[sid] not in shown:
            continue
        signals += sector_signals(sector_of[sid], country_of[sid], four_week_mean(s), since)
    signals += [s for s in state_signals(conn, since.date()) if s["country"] in shown]
    signals = apply_cooldown(signals, cfg["signals"]["cooldown_days"])
    conn.execute(
        "delete from signals where kind in ('crossed_line','streak','state_change') "
        "and signal_date >= %s", (since.date(),))
    for s in signals:
        conn.execute(
            """insert into signals (kind, subject_type, subject_id, country, signal_date, sentence,
                                    data, importance)
               values (%(kind)s, %(subject_type)s, %(subject_id)s, %(country)s, %(signal_date)s,
                       %(sentence)s, %(data)s, %(importance)s)
               on conflict (kind, subject_type, subject_id, country, signal_date) do update
                 set sentence = excluded.sentence, data = excluded.data,
                     importance = excluded.importance""",
            {**s, "data": db.jsonb(s["data"])},
        )
    return len(signals)
