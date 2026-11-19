"""Step 1: replay every League series in the local GRID clone into game records.

    python -m ledger.build            # all series, in parallel
    python -m ledger.build --limit 20 # a quick sample

Writes ``packs/games.jsonl`` (git-ignored: it is derived from licensed data).
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from .extract import replay
from .feed import PROJECT_ROOT, data_dir, envelopes, series_index

OUT_DIR = PROJECT_ROOT / "packs"


def detect_fearless(records: list[dict]) -> bool | None:
    """True when no champion is picked twice across the games of one series.

    One-game series cannot tell, so they return None and inherit their event's rule.
    """
    if len(records) < 2:
        return None
    seen: set[str] = set()
    for record in sorted(records, key=lambda r: r.get("sequence") or 0):
        picks = {d["champ"] for d in record["draft"] if d["type"] == "pick" and d["champ"]}
        if picks & seen:
            return False
        seen |= picks
    return True


def settle_roles(games: list[dict]) -> int:
    """Give each player the role they play most often, when that fits the team.

    The per-game guess (see `extract.assign_roles`) can be fooled by early lane
    swaps, where a top laner starts in bot lane. Pros keep one role, so a
    player's most frequent guess across all their games is far more reliable.
    A team's roles are replaced only when the five main roles are all different.
    """
    from collections import Counter

    seen: dict[str, Counter] = {}
    for record in games:
        for team in record["teams"]:
            for player in team["players"]:
                seen.setdefault(player["id"], Counter())[player["role"]] += 1
    usual = {pid: counts.most_common(1)[0][0] for pid, counts in seen.items()}
    changed = 0
    for record in games:
        for team in record["teams"]:
            roles = [usual[p["id"]] for p in team["players"]]
            if len(roles) == 5 and len(set(roles)) == 5:
                for player, role in zip(team["players"], roles):
                    if player["role"] != role:
                        changed += 1
                        player["role"] = role
                jungler = next(p["id"] for p in team["players"] if p["role"] == "jungle")
                record["junglers"][team["id"]] = jungler
    return changed


def _one(args: tuple[str, dict]) -> tuple[dict, list[dict], str | None]:
    root, row = args
    try:
        records = replay(envelopes(Path(root) / row["file"]))
        return row, records, None
    except Exception as error:  # a broken feed should not stop the whole build
        return row, [], f"{type(error).__name__}: {error}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, default=0, help="only the first N series (for a quick check)")
    parser.add_argument("--workers", type=int, default=1, help="processes (the default 1 also works where process pools are not allowed)")
    args = parser.parse_args(argv)

    root = data_dir()
    rows = series_index(root, "lol")
    if args.limit:
        rows = rows[: args.limit]
    OUT_DIR.mkdir(exist_ok=True)
    started = time.time()
    games: list[dict] = []
    problems: list[str] = []
    by_event: dict[str, list[bool]] = {}
    jobs = [(str(root), r) for r in rows]
    pool = ProcessPoolExecutor(max_workers=args.workers) if args.workers > 1 else None
    results = pool.map(_one, jobs, chunksize=4) if pool else map(_one, jobs)
    try:
        for done, (row, records, error) in enumerate(results, 1):
            if error:
                problems.append(f"{row['series_id']}: {error}")
            fearless = detect_fearless(records)
            if fearless is not None:
                by_event.setdefault(row["event"], []).append(fearless)
            for record in records:
                record.update(series_id=row["series_id"], event=row["event"], stage=row["stage"], date=row["scheduled_start"][:10], series_fearless=fearless, series_games=len(records))
                games.append(record)
            if done % 50 == 0:
                print(f"  {done}/{len(rows)} series, {len(games)} games, {time.time() - started:.0f}s", flush=True)
    finally:
        if pool:
            pool.shutdown()

    # An event counts as Fearless when every multi-game series in it followed the rule.
    event_rule = {event: all(flags) for event, flags in by_event.items()}
    for record in games:
        record["fearless"] = record["series_fearless"] if record["series_fearless"] is not None else event_rule.get(record["event"], False)
        record["game_number"] = record.pop("sequence", None)
    changed = settle_roles(games)
    print(f"roles: {changed} player-games moved to the player's main role")

    with open(OUT_DIR / "games.jsonl", "w", encoding="utf-8") as out:
        for record in games:
            out.write(json.dumps(record, separators=(",", ":")) + "\n")
    print(f"{len(games)} games from {len(rows)} series in {time.time() - started:.0f}s -> {OUT_DIR / 'games.jsonl'}")
    for event, rule in sorted(event_rule.items()):
        print(f"  {'Fearless' if rule else 'standard'}: {event}")
    if problems:
        print(f"{len(problems)} series could not be read:", *problems[:20], sep="\n  ", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
