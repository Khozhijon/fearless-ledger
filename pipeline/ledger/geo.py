"""Coarse zones of Summoner's Rift from game coordinates.

GRID positions are Summoner's Rift units: the blue base is near (400, 400), the red
base near (14 400, 14 400), the mid lane follows the diagonal x = y and the river follows
x + y = 14 800. The zones are deliberately coarse (lane, river, jungle quadrant,
base) because scouting questions are "which side of the map", not exact spots.
"""
from __future__ import annotations

import math

RIVER = 14_800
BLUE_FOUNTAIN = (400, 400)
RED_FOUNTAIN = (14_400, 14_400)
BASE_RADIUS = 4_700
LANE_EDGE = 2_400
MID_HALF_WIDTH = 1_250
RIVER_HALF_WIDTH = 1_100


def zone_of(x: float, y: float) -> dict:
    """Return ``{zone, half, owner}``.

    zone:  top | mid | bot | river | jungle | base
    half:  top (the half above the x = y diagonal) or bot
    owner: blue | red for jungle and base (whose side of the river), else None
    """
    half = "top" if y > x else "bot"
    own = "blue" if x + y < RIVER else "red"
    if math.dist((x, y), BLUE_FOUNTAIN) < BASE_RADIUS:
        return {"zone": "base", "half": half, "owner": "blue"}
    if math.dist((x, y), RED_FOUNTAIN) < BASE_RADIUS:
        return {"zone": "base", "half": half, "owner": "red"}
    if abs(x - y) / math.sqrt(2) < MID_HALF_WIDTH:
        return {"zone": "mid", "half": "mid", "owner": None}
    if half == "top" and (x < LANE_EDGE or y > 15_000 - LANE_EDGE):
        return {"zone": "top", "half": half, "owner": None}
    if half == "bot" and (y < LANE_EDGE or x > 15_000 - LANE_EDGE):
        return {"zone": "bot", "half": half, "owner": None}
    if abs(x + y - RIVER) / math.sqrt(2) < RIVER_HALF_WIDTH:
        return {"zone": "river", "half": half, "owner": None}
    return {"zone": "jungle", "half": half, "owner": own}


def buff_side(team_side: str, half: str) -> str | None:
    """Which buff a jungler's own-jungle position is next to.

    Blue team: blue buff is in the top half, red buff in the bottom half.
    Red team:  red buff is in the top half, blue buff in the bottom half.
    """
    if half not in ("top", "bot") or team_side not in ("blue", "red"):
        return None
    if team_side == "blue":
        return "blue buff" if half == "top" else "red buff"
    return "red buff" if half == "top" else "blue buff"
