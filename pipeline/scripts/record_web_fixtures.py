"""Record small fixtures for the web component gallery from real pipeline output.

Usage: python scripts/record_web_fixtures.py   (writes web/tests/fixtures/*.json)
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from thawline import db  # noqa: E402
from thawline.config import REPO_DIR, metrics  # noqa: E402
from thawline.derive.weekly import load_weekly  # noqa: E402
from thawline.sources.indeed import series_id  # noqa: E402

OUT = REPO_DIR / "web" / "tests" / "fixtures"
COUNTRY = "US"
FORECAST_SERIES = "indeed.US.scientific-research-and-development"


def weekly_points(s):
    return [{"date": d.date().isoformat(), "value": round(float(v), 2)} for d, v in s.items()]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cfg = metrics()["line_strip"]
    with db.connect() as conn:
        sectors = [s["sector"] for s in cfg["sectors"]] + [None]
        ids = [series_id(COUNTRY, s) for s in sectors]
        weekly = load_weekly(conn, ids + [FORECAST_SERIES])
        items = []
        for sector, sid in zip(sectors, ids, strict=False):
            if sid not in weekly:
                continue
            m4 = weekly[sid]
            short = next((s["short"] for s in cfg["sectors"] if s["sector"] == sector), "All jobs")
            items.append({"id": sid, "name": sector or "All jobs", "short": short,
                          "value": round(float(m4.iloc[-1]), 2),
                          "valueThen": round(float(m4.iloc[-1 - cfg["tail_weeks"]]), 2),
                          "href": f"/series/{sid}", "reference": sector is None})
        data_through = weekly[ids[0]].index[-1].date().isoformat()
        updated = conn.execute(
            "select last_success_at from datasets where id = 'indeed_jpi'").fetchone()[0]
        thaw = conn.execute(
            """select week, score, state, level, momentum, weights from thaw_index
               where family_id = 'backend' and country = %s order by week desc limit 1""",
            (COUNTRY,)).fetchone()
        (OUT / "line-strip-US.json").write_text(json.dumps({
            "dataThrough": data_through, "updated": updated.isoformat(), "items": items,
            "thaw": {"week": thaw[0].isoformat(), "score": thaw[1], "state": thaw[2],
                     "level": thaw[3], "momentum": thaw[4], "weights": thaw[5]},
        }, indent=1))

        sw = weekly[series_id(COUNTRY, "Software Development")]
        (OUT / "weekly-US-software-development.json").write_text(
            json.dumps({"seriesId": series_id(COUNTRY, "Software Development"),
                        "points": weekly_points(sw)}, indent=1))

        fc = conn.execute(
            "select paths, recovery from forecasts where series_id = %s and shipped "
            "order by made_on desc limit 1", (FORECAST_SERIES,)).fetchone()
        n = metrics()["forecast"]["display_weeks"]
        paths = fc[0]
        (OUT / "forecast-US-scientific-research.json").write_text(json.dumps({
            "seriesId": FORECAST_SERIES, "recovery": fc[1],
            "points": weekly_points(weekly[FORECAST_SERIES]),
            "forecast": {k: paths[k][:n] for k in ("weeks", "p10", "p25", "p50", "p75", "p90")},
        }, indent=1))

        rows = conn.execute(
            """select id, signal_date, sentence, subject_id from signals where country = %s
               order by signal_date desc, importance desc limit 6""", (COUNTRY,)).fetchall()
        (OUT / "signals-US.json").write_text(json.dumps([
            {"id": r[0], "date": r[1].isoformat(), "sentence": r[2], "href": f"/series/{r[3]}"}
            for r in rows], indent=1))
    print(f"wrote fixtures to {OUT}")


if __name__ == "__main__":
    main()
