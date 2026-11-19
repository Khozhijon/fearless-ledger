"""Step 3: write a scouting pack for the web app.

    python -m ledger.pack                       # public demo pack: Cloud9 Kia and its LCS 2026 rivals
    python -m ledger.pack --all --evidence      # every team, with game lists, for local use only

The public pack (``web/public/demo-pack.json``) holds aggregates only. A pack built
with ``--evidence`` lists individual games, which the data licence does not allow
publishing, so it is always written to the git-ignored ``packs/`` folder.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from .aggregate import build_pack
from .build import OUT_DIR
from .feed import PROJECT_ROOT

HOME_TEAM = "Cloud9 Kia"
DEMO_EVENTS = ("LCS - Split 1 2026", "LCS - Split 2 2026", "LCS - Split 3 2026", "LCS - Promotion 2026")
PUBLIC_PACK = PROJECT_ROOT / "web" / "public" / "demo-pack.json"


def load_games(path: Path = OUT_DIR / "games.jsonl") -> list[dict]:
    if not path.exists():
        raise SystemExit(f"{path} is missing: run `python -m ledger.build` first")
    with open(path, encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def teams_in(records: list[dict], events: tuple[str, ...]) -> list[str]:
    ids: dict[str, int] = {}
    for record in records:
        if record["event"] in events:
            for team in record["teams"]:
                ids[team["id"]] = ids.get(team["id"], 0) + 1
    return sorted(ids, key=lambda i: -ids[i])


def team_id_by_name(records: list[dict], name: str) -> str:
    for record in reversed(records):
        for team in record["teams"]:
            if team["name"].lower() == name.lower():
                return team["id"]
    raise SystemExit(f"no team called {name!r} in the data")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--all", action="store_true", help="every team in the data, not just the LCS 2026 field")
    parser.add_argument("--evidence", action="store_true", help="include game lists (local use only)")
    parser.add_argument("--home", default=HOME_TEAM, help="your own team, shown first")
    args = parser.parse_args(argv)

    records = load_games()
    home = team_id_by_name(records, args.home)
    if args.all:
        # Placeholder names such as "TBD-1" are bracket slots, not teams.
        team_ids: list[str] = sorted({str(t["id"]) for r in records for t in r["teams"] if not t["name"].upper().startswith("TBD")})
    else:
        team_ids = teams_in(records, DEMO_EVENTS)
    if home not in team_ids:
        team_ids.insert(0, home)
    pack = build_pack(records, team_ids, home, evidence=args.evidence)

    target = PUBLIC_PACK if not (args.all or args.evidence) else OUT_DIR / "local-pack.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    with open(target, "w", encoding="utf-8") as out:
        json.dump(pack, out, separators=(",", ":"), ensure_ascii=False)
    size = float(target.stat().st_size) / 1024
    print(f"{len(pack['teams'])} teams, {pack['games_total']} games aggregated -> {target} ({size:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
