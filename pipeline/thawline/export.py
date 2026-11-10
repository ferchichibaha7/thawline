"""CSV and JSON snapshots (spec 9.3). Written to data/exports/, the local stand-in
for Supabase Storage `public/exports/` until the owner provides a project."""

from __future__ import annotations

import csv
import json
from datetime import UTC, datetime

from . import storage
from .config import EXPORT_DIR, metrics

EXPORTS = {
    "indeed_weekly": (
        "indeed_jpi",
        """select w.series_id, s.country, coalesce(s.sector, 'All jobs') as sector, w.week,
                  round(w.value::numeric, 2) as value
           from series_weekly w join series s on s.id = w.series_id
           where s.dataset_id = 'indeed_jpi' order by 1, 4""",
    ),
    "bls_monthly": (
        "bls",
        """select o.series_id, s.label, o.date, o.value from observations o
           join series s on s.id = o.series_id where s.dataset_id = 'bls' order by 1, 3""",
    ),
    "fred": (
        "fred",
        """select o.series_id, s.label, o.date, o.value from observations o
           join series s on s.id = o.series_id where s.dataset_id = 'fred' order by 1, 3""",
    ),
    "thaw_index": (
        "thawline",
        """select week, family_id, country, round(score::numeric, 2) as score, state,
                  round(level::numeric, 2) as level, round(momentum::numeric, 2) as momentum,
                  weights::text as weights, version
           from thaw_index order by family_id, country, week""",
    ),
    "forecasts": (
        "thawline",
        """select series_id, made_on, model, mase_13, mase_26, mase_52, shipped,
                  recovery::text as recovery, version from forecasts order by series_id, made_on""",
    ),
    "signals": (
        "thawline",
        """select signal_date, kind, subject_type, subject_id, country, sentence, importance
           from signals order by signal_date desc, id desc""",
    ),
}

THAWLINE_DATASET = {"license": "CC BY 4.0", "attribution": "Thawline"}


def run(conn) -> int:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    datasets = {r[0]: {"license": r[1], "attribution": r[2], "data_through": r[3]}
                for r in conn.execute(
                    "select id, license, attribution, data_through from datasets").fetchall()}
    manifest = {"generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
                "method_versions": {k: v["version"] for k, v in metrics().items()
                                    if isinstance(v, dict) and "version" in v},
                "files": []}
    total = 0
    for name, (dataset_id, sql) in EXPORTS.items():
        cur = conn.execute(sql)
        cols = [c.name for c in cur.description]
        rows = cur.fetchall()
        with open(EXPORT_DIR / f"{name}.csv", "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(cols)
            w.writerows(rows)
        with open(EXPORT_DIR / f"{name}.json", "w") as fh:
            json.dump([dict(zip(cols, r, strict=True)) for r in rows], fh, default=str)
        info = datasets.get(dataset_id, THAWLINE_DATASET)
        manifest["files"].append({
            "name": name, "rows": len(rows), "csv": f"{name}.csv", "json": f"{name}.json",
            "license": info["license"], "attribution": info["attribution"],
            "source_dataset": dataset_id,
        })
        total += len(rows)
    (EXPORT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, default=str))
    if storage.configured():
        files = [EXPORT_DIR / f for e in manifest["files"] for f in (e["csv"], e["json"])]
        storage.upload([*files, EXPORT_DIR / "manifest.json"])
        print(f"  uploaded {len(files) + 1} files to Supabase Storage")
    return total
