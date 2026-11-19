"""Replay one GRID League of Legends series feed into compact per-game records.

A record keeps what a coach needs for draft and early-macro scouting: the draft
order, who played what, the result, the first objectives, early kills and where
the junglers were during their first clear. Records are built in memory and
written only to the git-ignored ``packs/`` folder, never to the repository.
"""
from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field

from .geo import zone_of

ROLES = ("top", "jungle", "mid", "bot", "support")
LANING = (100, 480)  # seconds of early laning used to see where each player stands
GOLD_AT = 600  # net worth is compared at 10:00 to tell the bot carry from the support

# Moments of the jungler's first clear: first camp, mid-clear, around scuttle spawn.
JUNGLE_SAMPLES = {"start": 95, "mid_clear": 150, "end_clear": 200}
EARLY_KILL_SECONDS = 14 * 60

DRAKE_PREFIX = "player-completed-slay"
EPIC = {
    "slayVoidGrub": "grubs",
    "slayRiftHerald": "herald",
    "slayBaron": "baron",
    "slayVoraciousAtakhan": "atakhan",
    "slayRuinousAtakhan": "atakhan",
    "slayElderDragon": "elder",
}


@dataclass
class GameState:
    game_id: str
    clock: int = 0
    rolled_back: bool = False
    final: dict | None = None
    kills: list[dict] = field(default_factory=list)
    firsts: dict[str, dict] = field(default_factory=dict)
    towers: list[dict] = field(default_factory=list)
    jungle: dict[str, dict[str, dict]] = field(default_factory=dict)  # player id -> sample -> position
    positions: dict[str, dict] = field(default_factory=dict)  # player id -> latest {x, y}
    scuttles: list[dict] = field(default_factory=list)
    lane_time: dict[str, dict[str, int]] = field(default_factory=dict)  # player id -> zone -> snapshots
    camps: dict[str, int] = field(default_factory=dict)  # player id -> jungle monsters killed early
    gold: dict[str, float] = field(default_factory=dict)  # player id -> net worth at 10:00


def _game_entries(series_state: dict | None) -> list[dict]:
    return (series_state or {}).get("games") or []


def _objective_name(event_type: str) -> str | None:
    if not event_type.startswith(DRAKE_PREFIX):
        return None
    target = event_type[len("player-completed-"):]
    if target in EPIC:
        return EPIC[target]
    if target.endswith("Drake"):
        return "drake"
    return None


def _player_side(state: dict) -> tuple[str | None, str | None]:
    return state.get("teamId"), state.get("side")


def replay(envelopes: Iterable[dict]) -> list[dict]:
    """Turn a series feed into one record per game actually played."""
    games: dict[str, GameState] = {}
    order: list[str] = []
    current: str | None = None

    def game(game_id: str) -> GameState:
        if game_id not in games:
            games[game_id] = GameState(game_id)
            order.append(game_id)
        return games[game_id]

    for envelope in envelopes:
        for event in envelope.get("events", []):
            kind = event.get("type", "")
            state = event.get("seriesState")
            target = event.get("target") or {}
            actor = event.get("actor") or {}

            if kind == "series-started-game":
                current = target.get("id")
                if current:
                    game(current).rolled_back = False
            elif kind == "series-!started-game" and target.get("id"):
                game(target["id"]).rolled_back = True

            for entry in _game_entries(state):
                gid = entry.get("id")
                if not isinstance(gid, str):
                    continue
                g = game(gid)
                clock = (entry.get("clock") or {}).get("currentSeconds")
                if isinstance(clock, (int, float)):
                    g.clock = int(clock)
                if "draftActions" in entry and entry.get("teams"):
                    g.final = entry
                for team in entry.get("teams") or []:
                    for player in team.get("players") or []:
                        pos = player.get("position")
                        if pos and "x" in pos and "y" in pos:
                            g.positions[player["id"]] = {"x": pos["x"], "y": pos["y"]}
                            if LANING[0] <= g.clock <= LANING[1]:
                                zone = zone_of(pos["x"], pos["y"])["zone"]
                                counts = g.lane_time.setdefault(player["id"], {})
                                counts[zone] = counts.get(zone, 0) + 1
                        worth = player.get("netWorth")
                        if g.clock >= GOLD_AT and player.get("id") not in g.gold and isinstance(worth, (int, float)):
                            g.gold[player["id"]] = worth

            if current is None or current not in games:
                continue
            g = games[current]
            if g.clock > 0:
                for sample, at in JUNGLE_SAMPLES.items():
                    if g.clock >= at:
                        for pid, pos in g.positions.items():
                            g.jungle.setdefault(pid, {}).setdefault(sample, dict(pos, t=g.clock))

            if actor.get("type") == "player" and g.clock <= EARLY_KILL_SECONDS and (
                kind.endswith("TierNPC") or kind.startswith("player-completed-slay")
            ) and isinstance(actor.get("id"), str):
                g.camps[actor["id"]] = g.camps.get(actor["id"], 0) + 1

            if kind == "player-killed-player" and g.clock <= EARLY_KILL_SECONDS:
                victim = target.get("state") or {}
                killer = actor.get("state") or {}
                vpos = (victim.get("game") or {}).get("position") or {}
                assisters = _assisters(event.get("seriesStateDelta"), current)
                g.kills.append({
                    "t": g.clock,
                    "killer": killer.get("id") or actor.get("id"),
                    "killer_team": killer.get("teamId"),
                    "victim": victim.get("id") or target.get("id"),
                    "victim_team": victim.get("teamId"),
                    "assisters": assisters,
                    "zone": zone_of(vpos["x"], vpos["y"]) if "x" in vpos and "y" in vpos else None,
                })
                g.firsts.setdefault("first_blood", {"t": g.clock, "team": killer.get("teamId")})
            elif kind == "player-destroyed-tower" or kind == "team-destroyed-tower":
                team_id = (actor.get("state") or {}).get("teamId") if actor.get("type") == "player" else actor.get("id")
                tower = target.get("id", "")
                g.towers.append({"t": g.clock, "team": team_id, "tower": tower})
                g.firsts.setdefault("first_tower", {"t": g.clock, "team": team_id, "lane": _tower_lane(tower)})
            elif kind.startswith("player-completed-slayRiftScuttler"):
                pid = actor.get("id")
                side = "top" if kind.endswith("Top") else "bot"
                g.scuttles.append({"t": g.clock, "player": pid, "team": (actor.get("state") or {}).get("teamId"), "side": side})
            else:
                name = _objective_name(kind)
                if name:
                    team_id, _ = _player_side(actor.get("state") or {})
                    g.firsts.setdefault(f"first_{name}", {"t": g.clock, "team": team_id})

    return [record for gid in order if (record := _record(games[gid])) is not None]


def assign_roles(player_ids: list[str], lane_time: dict[str, dict[str, int]], camps: dict[str, int], gold: dict[str, float]) -> dict[str, str]:
    """Infer each player's role from the first minutes of the game.

    GRID does not record roles, and its player order is only sometimes the
    standard top-jungle-mid-bot-support. So, for one team's five players, try
    every assignment and keep the one that best fits what each player did:
    the jungler kills the early jungle camps, the top and mid laners stand in
    their lanes, the bot carry and the support share bot lane and the carry
    has more gold at 10:00.
    """
    from itertools import permutations

    if len(player_ids) != 5:
        return {}

    def share(pid: str, zone: str) -> float:
        counts = lane_time.get(pid) or {}
        total = sum(counts.values())
        return counts.get(zone, 0) / total if total else 0.0

    most_camps = max((camps.get(p, 0) for p in player_ids), default=0) or 1
    ranked_gold = sorted(player_ids, key=lambda p: gold.get(p, 0))
    gold_rank = {p: i / 4 for i, p in enumerate(ranked_gold)}  # 0 = poorest, 1 = richest

    def fit(pid: str, role: str) -> float:
        if role == "jungle":
            return 2 * camps.get(pid, 0) / most_camps + share(pid, "jungle") + share(pid, "river")
        if role == "top":
            return share(pid, "top")
        if role == "mid":
            return share(pid, "mid")
        if role == "bot":
            return share(pid, "bot") + gold_rank[pid]
        return share(pid, "bot") + (1 - gold_rank[pid])

    best = max(permutations(ROLES), key=lambda roles: sum(fit(p, r) for p, r in zip(player_ids, roles)))
    return dict(zip(player_ids, best))


def _assisters(delta: dict | None, game_id: str) -> list[str]:
    out: list[str] = []
    for entry in _game_entries(delta):
        if entry.get("id") != game_id:
            continue
        for team in entry.get("teams") or []:
            for player in team.get("players") or []:
                if "killAssistsGiven" in player:
                    out.append(player["id"])
    return out


def _tower_lane(tower_id: str) -> str | None:
    for lane in ("top", "mid", "bot"):
        if f"-{lane}-" in tower_id or tower_id.endswith(f"-{lane}"):
            return lane
    return None


def _record(g: GameState) -> dict | None:
    final = g.final
    if g.rolled_back or not final or not final.get("finished"):
        return None
    teams = []
    junglers: dict[str, str] = {}
    for team in final.get("teams") or []:
        players = []
        roster = [p for p in team.get("players") or [] if p.get("participationStatus", "active") == "active"]
        roles = assign_roles([p.get("id") for p in roster], g.lane_time, g.camps, g.gold)
        for index, player in enumerate(roster):
            role = roles.get(player.get("id")) or (ROLES[index] if index < len(ROLES) else f"sub{index}")
            champ = (player.get("character") or {}).get("name")
            players.append({"id": player.get("id"), "name": player.get("name"), "role": role, "champ": champ})
            if role == "jungle":
                junglers[team["id"]] = player.get("id")
        teams.append({"id": team.get("id"), "name": team.get("name"), "side": team.get("side"), "won": bool(team.get("won")), "players": players})
    if len(teams) != 2:
        return None
    draft = []
    for action in sorted(final.get("draftActions") or [], key=lambda a: int(a.get("sequenceNumber") or 0)):
        draft.append({
            "seq": int(action.get("sequenceNumber") or 0),
            "type": action.get("type"),
            "team": (action.get("drafter") or {}).get("id"),
            "champ": (action.get("draftable") or {}).get("name"),
        })
    jungle = {}
    for team_id, pid in junglers.items():
        samples = g.jungle.get(pid, {})
        jungle[team_id] = {name: zone_of(pos["x"], pos["y"]) | {"x": round(pos["x"]), "y": round(pos["y"])} for name, pos in samples.items()}
        first_scuttle = next((s for s in g.scuttles if s["team"] == team_id), None)
        jungle[team_id]["first_scuttle"] = first_scuttle and {"side": first_scuttle["side"], "t": first_scuttle["t"], "by_jungler": first_scuttle["player"] == pid}
    return {
        "game_id": g.game_id,
        "sequence": final.get("sequenceNumber"),
        "patch": (final.get("titleVersion") or {}).get("name") if isinstance(final.get("titleVersion"), dict) else final.get("titleVersion"),
        "duration_s": g.clock,
        "teams": teams,
        "draft": draft,
        "firsts": g.firsts,
        "kills": g.kills,
        "jungle": jungle,
        "junglers": junglers,
    }
