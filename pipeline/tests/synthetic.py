"""A tiny made-up League series in the GRID event shape, for tests.

Nothing here comes from the licensed data: names, ids and champions are
invented or generic, and only the fields the pipeline reads are present.
"""
from __future__ import annotations

from itertools import count

BLUE, RED = "t-blue", "t-red"
ROSTER = {
    BLUE: [("b-top", "Anvil"), ("b-jg", "Bramble"), ("b-mid", "Cinder"), ("b-bot", "Dart"), ("b-sup", "Ember")],
    RED: [("r-top", "Flint"), ("r-jg", "Gale"), ("r-mid", "Hollow"), ("r-bot", "Iris"), ("r-sup", "Jade")],
}
# Where each role stands during laning, in Summoner's Rift units.
LANE_SPOT = {"top": (1200, 9000), "jungle": (4000, 7600), "mid": (7200, 7300), "bot": (9500, 1100), "support": (9600, 1300)}
RED_JUNGLE = (10_900, 7_200)

_ids = count(1)


def _player(pid: str, name: str, x: float, y: float, worth: float = 500, champ: str | None = None) -> dict:
    out: dict = {"id": pid, "name": name, "position": {"x": x, "y": y}, "netWorth": worth, "participationStatus": "active"}
    if champ:
        out["character"] = {"name": champ}
    return out


def _mirror(x: float, y: float) -> tuple[float, float]:
    return 14_800 - y, 14_800 - x


def snapshot(game_id: str, clock: int, champs: dict[str, str] | None = None, final: dict | None = None, blue_first: bool = True) -> dict:
    """A series state with every player where their role usually stands."""
    teams = []
    for team, side in ((BLUE, "blue"), (RED, "red")):
        players = []
        roster = ROSTER[team] if blue_first or team == BLUE else list(reversed(ROSTER[team]))  # red listed out of role order
        for pid, name in roster:
            role = {"top": "top", "jg": "jungle", "mid": "mid", "bot": "bot", "sup": "support"}[pid.split("-")[1]]
            x, y = LANE_SPOT[role]
            if side == "red":
                x, y = _mirror(x, y) if role != "jungle" else RED_JUNGLE
            worth = 3000 if role == "bot" else 1500
            players.append(_player(pid, name, x, y, worth, (champs or {}).get(pid)))
        entry = {"id": team, "side": side, "name": "Blue Team" if team == BLUE else "Red Team", "players": players}
        if final:
            entry["won"] = final["winner"] == team
        teams.append(entry)
    game: dict = {"id": game_id, "sequenceNumber": int(game_id[-1]), "clock": {"currentSeconds": clock}, "teams": teams}
    if final:
        game.update(finished=True, titleVersion={"name": "99.1"}, draftActions=final["draft"])
    return {"id": "s-1", "games": [game]}


def event(kind: str, state: dict | None = None, actor: dict | None = None, target: dict | None = None, delta: dict | None = None) -> dict:
    return {"id": f"e-{next(_ids)}", "type": kind, "actor": actor or {}, "target": target or {}, "seriesState": state, "seriesStateDelta": delta}


def envelope(*events: dict) -> dict:
    return {"id": f"env-{next(_ids)}", "events": list(events)}


def draft(picks: dict[str, str], bans: list[tuple[str, str]]) -> list[dict]:
    """A pro-order draft: 6 bans, B1 R1 R2 B2 B3 R3, 4 bans, R4 B4 B5 R5."""
    order = ["b-top", "r-top", "r-jg", "b-jg", "b-mid", "r-mid", "r-bot", "b-bot", "b-sup", "r-sup"]
    team = {pid: BLUE if pid.startswith("b") else RED for pid in order}
    actions = []
    seq = count(1)
    for t, champ in bans[:6]:
        actions.append({"sequenceNumber": next(seq), "type": "ban", "drafter": {"id": t}, "draftable": {"name": champ}})
    for pid in order[:6]:
        actions.append({"sequenceNumber": next(seq), "type": "pick", "drafter": {"id": team[pid]}, "draftable": {"name": picks[pid]}})
    for t, champ in bans[6:]:
        actions.append({"sequenceNumber": next(seq), "type": "ban", "drafter": {"id": t}, "draftable": {"name": champ}})
    for pid in order[6:]:
        actions.append({"sequenceNumber": next(seq), "type": "pick", "drafter": {"id": team[pid]}, "draftable": {"name": picks[pid]}})
    return actions


def game_events(game_id: str, picks: dict[str, str], winner: str, blue_first: bool = True) -> list[dict]:
    bans = [(BLUE, "BanA"), (RED, "BanB"), (BLUE, "BanC"), (RED, "BanD"), (BLUE, "BanE"), (RED, "BanF"), (RED, "BanG"), (BLUE, "BanH"), (RED, "BanI"), (BLUE, "BanJ")]
    final = {"winner": winner, "draft": draft(picks, bans)}
    timed: list[tuple[int, dict]] = []
    out = [envelope(event("series-started-game", snapshot(game_id, 0, blue_first=blue_first), target={"id": game_id}))]

    def at(clock: int, kind: str, **parts) -> None:
        timed.append((clock, envelope(event(kind, snapshot(game_id, clock, blue_first=blue_first), **parts))))

    for second in range(100, 700, 20):
        at(second, "player-purchased-item", actor={"type": "player", "id": "b-top"})
    # The blue jungler clears camps and takes the top scuttle; the red jungler takes the bot one.
    for second in (95, 130, 170):
        at(second, "player-killed-BTierNPC", actor={"type": "player", "id": "b-jg", "state": {"teamId": BLUE}})
        at(second + 1, "player-killed-BTierNPC", actor={"type": "player", "id": "r-jg", "state": {"teamId": RED}})
    at(215, "player-completed-slayRiftScuttlerTop", actor={"type": "player", "id": "b-jg", "state": {"teamId": BLUE}})
    at(220, "player-completed-slayRiftScuttlerBot", actor={"type": "player", "id": "r-jg", "state": {"teamId": RED}})
    # First blood at 4:00 in blue's top lane: blue jungler assists the blue top laner.
    kill_delta = {"games": [{"id": game_id, "teams": [{"id": BLUE, "players": [{"id": "b-jg", "killAssistsGiven": 1}]}]}]}
    at(
        240, "player-killed-player",
        actor={"type": "player", "id": "b-top", "state": {"id": "b-top", "teamId": BLUE}},
        target={"type": "player", "id": "r-top", "state": {"id": "r-top", "teamId": RED, "game": {"position": {"x": 1500, "y": 11_000}}}},
        delta=kill_delta,
    )
    at(420, "player-completed-slayOceanDrake", actor={"type": "player", "id": "r-jg", "state": {"teamId": RED}})
    at(800, "player-destroyed-tower", actor={"type": "player", "id": "b-bot", "state": {"teamId": BLUE}}, target={"id": "red-turret-bot-1"})
    out += [env for _, env in sorted(timed, key=lambda item: item[0])]
    champs = {pid: champ for pid, champ in picks.items()}
    out.append(envelope(event("series-ended-game", snapshot(game_id, 1700, champs, final, blue_first=blue_first))))
    return out


GAME1 = {"b-top": "Rumble", "b-jg": "Vi", "b-mid": "Azir", "b-bot": "Varus", "b-sup": "Rell",
         "r-top": "Gnar", "r-jg": "Sejuani", "r-mid": "Orianna", "r-bot": "Ezreal", "r-sup": "Nautilus"}
GAME2 = {"b-top": "Renekton", "b-jg": "Wukong", "b-mid": "Taliyah", "b-bot": "Corki", "b-sup": "Alistar",
         "r-top": "Ambessa", "r-jg": "Skarner", "r-mid": "Sylas", "r-bot": "Kalista", "r-sup": "Rakan"}


def series(rolled_back_first: bool = False) -> list[dict]:
    """Two games; optionally an abandoned first attempt that is rolled back and replayed."""
    out: list[dict] = []
    if rolled_back_first:
        out.append(envelope(event("series-started-game", snapshot("g-0", 0), target={"id": "g-0"})))
        out.append(envelope(event("series-!started-game", None, target={"id": "g-0"})))
    out += game_events("g-1", GAME1, BLUE)
    out += game_events("g-2", GAME2, RED, blue_first=False)
    return out
