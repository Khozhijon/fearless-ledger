"""Step 2: turn game records into scouting packs of counts and rates.

A pack holds, for each scouted team and each slice (period x side), the
draft tendencies, Fearless shifts by game number, player champion pools, first
objectives and jungle first-clear habits. It contains aggregates only: no game
by game rows, so it can be shown publicly (the data licence forbids publishing
the match data itself). ``--evidence`` adds the list of games behind each team
for local use only; such a pack must stay in the git-ignored ``packs/`` folder.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field

from .geo import buff_side

ROLES = ("top", "jungle", "mid", "bot", "support")
EARLY_GANK_SECONDS = 8 * 60
OBJECTIVES = ("first_blood", "first_tower", "first_grubs", "first_drake", "first_herald", "first_baron")
SIDES = ("any", "blue", "red")


def draft_slots(record: dict) -> list[dict]:
    """Label each draft action with its slot: phase, side, and the team's k-th pick or ban."""
    side_of = {t["id"]: t["side"] for t in record["teams"]}
    picks: Counter = Counter()
    bans: Counter = Counter()
    out = []
    for action in record["draft"]:
        team = action["team"]
        side = side_of.get(team)
        if action["type"] == "pick":
            picks[team] += 1
            slot = f"{'B' if side == 'blue' else 'R'}{picks[team]}"
            phase = 1 if picks[team] <= 3 else 2
        else:
            bans[team] += 1
            slot = f"{'B' if side == 'blue' else 'R'}ban{bans[team]}"
            phase = 1 if bans[team] <= 3 else 2
        out.append(dict(action, side=side, slot=slot, phase=phase))
    return out


def champion_roles(records: Iterable[dict]) -> dict[str, dict]:
    """Each champion's role counts and main role across every game (used to label bans)."""
    roles: dict[str, Counter] = defaultdict(Counter)
    for record in records:
        for team in record["teams"]:
            for player in team["players"]:
                if player["champ"]:
                    roles[player["champ"]][player["role"]] += 1
    return {champ: {"role": counts.most_common(1)[0][0], "roles": dict(counts), "games": sum(counts.values())} for champ, counts in sorted(roles.items())}


def _top(counter: Counter, n: int = 10) -> list[list]:
    return [[key, count] for key, count in counter.most_common(n)]


def _share(counter: Counter) -> dict:
    return dict(counter.most_common())


@dataclass
class ObjectiveTally:
    games: int = 0
    took: int = 0
    times: list[int] = field(default_factory=list)


@dataclass
class JungleTally:
    games: int = 0
    junglers: Counter = field(default_factory=Counter)
    start: Counter = field(default_factory=Counter)
    end_half: Counter = field(default_factory=Counter)
    first_scuttle: Counter = field(default_factory=Counter)


@dataclass
class GameNumberTally:
    n: int = 0
    picks: Counter = field(default_factory=Counter)


def team_slice(team_id: str, records: list[dict], champ_role: dict[str, dict]) -> dict:
    """All scouting aggregates for one team over the given games."""
    games = sorted(records, key=lambda r: (r["date"], r["series_id"], r.get("game_number") or 0))
    out: dict = {"games": len(games)}
    if not games:
        return out
    wins = 0
    sides = {"blue": [0, 0], "red": [0, 0]}
    champ = defaultdict(Counter)  # champ -> picks, wins, bans_by, bans_vs, first_pick, rotation1
    bans_by_side = {s: {1: Counter(), 2: Counter()} for s in ("blue", "red")}
    ban_roles = {1: Counter(), 2: Counter()}
    pick_roles = {s: [Counter() for _ in range(5)] for s in ("blue", "red")}
    players: dict[str, dict] = {}
    by_game_number: dict[int, GameNumberTally] = defaultdict(GameNumberTally)
    objectives = {name: ObjectiveTally() for name in OBJECTIVES}
    tower_lanes: Counter = Counter()
    jungle = JungleTally()
    ganks: Counter = Counter()
    gank_games = 0
    opponents: Counter = Counter()

    for record in games:
        mine = next(t for t in record["teams"] if t["id"] == team_id)
        theirs = next(t for t in record["teams"] if t["id"] != team_id)
        side = mine["side"]
        opponents[theirs["name"]] += 1
        won = mine["won"]
        wins += won
        if side in sides:
            sides[side][0] += 1
            sides[side][1] += won
        role_of = {p["champ"]: p["role"] for p in mine["players"]}
        for player in mine["players"]:
            entry = players.setdefault(player["id"], {"id": player["id"], "name": player["name"], "roles": Counter(), "champs": defaultdict(lambda: [0, 0, ""])})
            entry["name"] = player["name"]
            entry["roles"][player["role"]] += 1
            stat = entry["champs"][player["champ"]]
            stat[0] += 1
            stat[1] += won
            stat[2] = max(stat[2], record["date"])
        for action in draft_slots(record):
            name = action["champ"]
            if not name:
                continue
            if action["type"] == "pick" and action["team"] == team_id:
                champ[name]["picks"] += 1
                champ[name]["wins"] += won
                if action["slot"] in ("B1", "R1"):
                    champ[name]["first_pick"] += 1
                if action["phase"] == 1:
                    champ[name]["rotation1"] += 1
                index = int(action["slot"][1:]) - 1
                if side in pick_roles and 0 <= index < 5:
                    pick_roles[side][index][role_of.get(name, champ_role.get(name, {}).get("role", "?"))] += 1
            elif action["type"] == "ban" and action["team"] == team_id:
                champ[name]["bans_by"] += 1
                if side in bans_by_side:
                    bans_by_side[side][action["phase"]][name] += 1
                ban_roles[action["phase"]][champ_role.get(name, {}).get("role", "?")] += 1
            elif action["type"] == "ban":
                champ[name]["bans_vs"] += 1

        # Fearless: what they pick in game 1, 2, 3... of a series, and how much of it is comfort.
        number = record.get("game_number") or 1
        tally = by_game_number[number]
        tally.n += 1
        for player in mine["players"]:
            tally.picks[player["champ"]] += 1

        for name in OBJECTIVES:
            first = record["firsts"].get(name)
            if first:
                objectives[name].games += 1
                if first.get("team") == team_id:
                    objectives[name].took += 1
                    objectives[name].times.append(first["t"])
                    if name == "first_tower" and first.get("lane"):
                        tower_lanes[first["lane"]] += 1

        samples = record.get("jungle", {}).get(team_id)
        jungler = record.get("junglers", {}).get(team_id)
        if samples:
            jungle.games += 1
            jungler_name = next((p["name"] for p in mine["players"] if p["id"] == jungler), None)
            if jungler_name:
                jungle.junglers[jungler_name] += 1
            start = samples.get("start")
            if start and start["zone"] == "jungle":
                jungle.start[buff_side(side, start["half"]) or "other"] += 1
            elif start:
                jungle.start["other"] += 1
            end = samples.get("end_clear")
            if end and end["half"] in ("top", "bot"):
                jungle.end_half[end["half"]] += 1
            scuttle = samples.get("first_scuttle")
            if scuttle:
                jungle.first_scuttle[scuttle["side"]] += 1
        if jungler:
            gank_games += 1
            for kill in record["kills"]:
                if kill["t"] > EARLY_GANK_SECONDS or not kill.get("zone"):
                    continue
                involved = jungler == kill["killer"] or jungler in kill.get("assisters", [])
                if involved and kill["killer_team"] == team_id:
                    ganks[kill["zone"]["zone"]] += 1

    # Player pools, main role first, ordered top -> support.
    pools = []
    for entry in players.values():
        role = entry["roles"].most_common(1)[0][0]
        champs = sorted(([name, *stats] for name, stats in entry["champs"].items() if name), key=lambda c: (-c[1], -c[2], c[0]))
        total = sum(c[1] for c in champs)
        pools.append({
            "id": entry["id"], "name": entry["name"], "role": role, "games": total,
            "champs": [{"champ": c[0], "games": c[1], "wins": c[2], "last": c[3]} for c in champs],
            "depth": sum(1 for c in champs if c[1] >= 2),
        })
    pools.sort(key=lambda p: (ROLES.index(p["role"]) if p["role"] in ROLES else 9, -p["games"]))
    top3 = {p["id"]: {c["champ"] for c in p["champs"][:3]} for p in pools}

    fearless = []
    for number in sorted(by_game_number):
        tally = by_game_number[number]
        comfort = 0
        total = 0
        for record in games:
            if (record.get("game_number") or 1) != number:
                continue
            mine = next(t for t in record["teams"] if t["id"] == team_id)
            for player in mine["players"]:
                total += 1
                comfort += player["champ"] in top3.get(player["id"], set())
        fearless.append({"game": number, "n": tally.n, "comfort_share": round(comfort / total, 3) if total else None, "top": _top(tally.picks, 8)})

    champ_rows = []
    for name, stats in champ.items():
        champ_rows.append({
            "champ": name, "role": champ_role.get(name, {}).get("role"),
            "picks": stats["picks"], "wins": stats["wins"], "bans_by": stats["bans_by"], "bans_vs": stats["bans_vs"],
            "first_pick": stats["first_pick"], "rotation1": stats["rotation1"],
            "presence": round((stats["picks"] + stats["bans_by"] + stats["bans_vs"]) / len(games), 3),
        })
    champ_rows.sort(key=lambda c: (-c["presence"], c["champ"]))

    out.update(
        wins=wins,
        first_date=games[0]["date"], last_date=games[-1]["date"],
        series=len({r["series_id"] for r in games}),
        events=sorted({r["event"] for r in games}),
        sides=sides,
        opponents=_top(opponents, 20),
        champs=champ_rows,
        bans={s: {"phase1": _top(bans_by_side[s][1]), "phase2": _top(bans_by_side[s][2])} for s in bans_by_side},
        ban_roles={"phase1": _share(ban_roles[1]), "phase2": _share(ban_roles[2])},
        pick_roles={s: [_share(c) for c in pick_roles[s]] for s in pick_roles},
        fearless=fearless,
        players=pools,
        objectives={
            name: {"games": v.games, "took": v.took, "avg_t": round(sum(v.times) / len(v.times)) if v.times else None}
            for name, v in objectives.items()
        },
        first_tower_lanes=_share(tower_lanes),
        jungle={
            "games": jungle.games, "junglers": _top(jungle.junglers, 3),
            "start": _share(jungle.start), "end_half": _share(jungle.end_half), "first_scuttle": _share(jungle.first_scuttle),
            "early_kills": {"before_s": EARLY_GANK_SECONDS, "games": gank_games, "zones": _share(ganks)},
        },
    )
    return out


def periods(records: list[dict]) -> dict[str, list[dict]]:
    """The time windows a coach can switch between: everything, and the latest season."""
    latest: str = max((str(r["date"])[:4] for r in records), default="")
    return {"all": records, latest: [r for r in records if r["date"].startswith(latest)]}


def build_pack(records: list[dict], team_ids: list[str], home_team: str, evidence: bool = False) -> dict:
    roles = champion_roles(records)
    teams = {}
    for team_id in team_ids:
        own = [r for r in records if any(t["id"] == team_id for t in r["teams"])]
        if not own:
            continue
        name = next(t["name"] for t in own[-1]["teams"] if t["id"] == team_id)
        slices = {}
        for period, chosen in periods(own).items():
            for side in SIDES:
                subset = [r for r in chosen if side == "any" or next(t for t in r["teams"] if t["id"] == team_id)["side"] == side]
                slices[f"{period}|{side}"] = team_slice(team_id, subset, roles)
        teams[team_id] = {"id": team_id, "name": name, "slices": slices}
        if evidence:
            teams[team_id]["evidence"] = [
                {
                    "series_id": r["series_id"], "game_id": r["game_id"], "date": r["date"], "event": r["event"], "game": r.get("game_number"),
                    "side": next(t["side"] for t in r["teams"] if t["id"] == team_id),
                    "opponent": next(t["name"] for t in r["teams"] if t["id"] != team_id),
                    "won": next(t["won"] for t in r["teams"] if t["id"] == team_id),
                    "draft": [[a["slot"], a["champ"]] for a in draft_slots(r)],
                }
                for r in sorted(own, key=lambda r: (r["date"], r["series_id"], r.get("game_number") or 0))
            ]
    return {
        "home_team": home_team,
        "periods": sorted({p for t in teams.values() for p in (s.split("|")[0] for s in t["slices"])}, key=lambda p: (p != "all", p)),
        "games_total": len(records),
        "date_range": [min(r["date"] for r in records), max(r["date"] for r in records)] if records else None,
        "champions": roles,
        "teams": teams,
        "evidence": evidence,
    }
