"""Reference data: role families (spec 7.3). Countries come from the Indeed ingester."""

from __future__ import annotations

from .config import families

ENGINEERING_COMPETITION = "Engineering"


def run(conn) -> int:
    for i, f in enumerate(families(), start=1):
        conn.execute(
            """insert into role_families (id, label, grp, indeed_sector, uses_competition, sort)
               values (%s, %s, %s, %s, %s, %s)
               on conflict (id) do update set label = excluded.label, grp = excluded.grp,
                 indeed_sector = excluded.indeed_sector,
                 uses_competition = excluded.uses_competition, sort = excluded.sort""",
            (f["id"], f["label"], f["grp"], f["indeed_sector"],
             f["grp"] == ENGINEERING_COMPETITION, i),
        )
    return len(families())
