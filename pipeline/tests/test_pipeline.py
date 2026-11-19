"""Tests for the pipeline, on a made-up series (see synthetic.py).

    cd pipeline && python -m unittest -v
"""
from __future__ import annotations

import unittest

from ledger.aggregate import build_pack, champion_roles, draft_slots, team_slice
from ledger.build import detect_fearless, settle_roles
from ledger.extract import assign_roles, replay
from ledger.geo import buff_side, zone_of

from tests import synthetic as s


class GeoTest(unittest.TestCase):
    def test_lanes_bases_river_and_jungle(self):
        self.assertEqual(zone_of(500, 500)["zone"], "base")
        self.assertEqual(zone_of(14_300, 14_300)["owner"], "red")
        self.assertEqual(zone_of(7_400, 7_400)["zone"], "mid")
        self.assertEqual(zone_of(1_200, 9_000)["zone"], "top")
        self.assertEqual(zone_of(6_000, 13_800)["zone"], "top")
        self.assertEqual(zone_of(9_500, 1_100)["zone"], "bot")
        self.assertEqual(zone_of(4_300, 10_500)["zone"], "river")
        jungle = zone_of(4_000, 7_600)
        self.assertEqual((jungle["zone"], jungle["half"], jungle["owner"]), ("jungle", "top", "blue"))

    def test_buff_side_depends_on_team_side(self):
        self.assertEqual(buff_side("blue", "top"), "blue buff")
        self.assertEqual(buff_side("blue", "bot"), "red buff")
        self.assertEqual(buff_side("red", "top"), "red buff")
        self.assertEqual(buff_side("red", "bot"), "blue buff")
        self.assertIsNone(buff_side("red", "mid"))


class ReplayTest(unittest.TestCase):
    def setUp(self):
        self.games = replay(s.series())

    def test_one_record_per_finished_game(self):
        self.assertEqual([g["game_id"] for g in self.games], ["g-1", "g-2"])
        self.assertEqual(self.games[0]["patch"], "99.1")

    def test_rolled_back_attempt_is_dropped(self):
        self.assertEqual([g["game_id"] for g in replay(s.series(rolled_back_first=True))], ["g-1", "g-2"])

    def test_draft_order_and_players(self):
        first = self.games[0]
        self.assertEqual(len(first["draft"]), 20)
        self.assertEqual([d["type"] for d in first["draft"][:7]], ["ban"] * 6 + ["pick"])
        blue = next(t for t in first["teams"] if t["side"] == "blue")
        self.assertTrue(blue["won"])
        self.assertEqual({p["role"]: p["champ"] for p in blue["players"]}["jungle"], "Vi")

    def test_roles_inferred_when_feed_order_is_scrambled(self):
        # In game 2 the red players are listed support-first.
        red = next(t for t in self.games[1]["teams"] if t["side"] == "red")
        roles = {p["id"]: p["role"] for p in red["players"]}
        self.assertEqual(roles, {"r-top": "top", "r-jg": "jungle", "r-mid": "mid", "r-bot": "bot", "r-sup": "support"})

    def test_first_objectives(self):
        firsts = self.games[0]["firsts"]
        self.assertEqual(firsts["first_blood"], {"t": 240, "team": s.BLUE})
        self.assertEqual(firsts["first_drake"]["team"], s.RED)
        self.assertEqual(firsts["first_tower"], {"t": 800, "team": s.BLUE, "lane": "bot"})

    def test_early_kill_has_zone_and_jungle_assist(self):
        kill = self.games[0]["kills"][0]
        self.assertEqual(kill["zone"]["zone"], "top")
        self.assertEqual(kill["assisters"], ["b-jg"])

    def test_jungle_first_clear(self):
        jungle = self.games[0]["jungle"]
        self.assertEqual(jungle[s.BLUE]["start"]["half"], "top")
        self.assertEqual(jungle[s.BLUE]["first_scuttle"], {"side": "top", "t": 215, "by_jungler": True})
        self.assertEqual(jungle[s.RED]["first_scuttle"]["side"], "bot")


class RolesTest(unittest.TestCase):
    def test_assign_roles_prefers_camps_lanes_and_gold(self):
        lanes = {"a": {"top": 9}, "b": {"jungle": 9}, "c": {"mid": 9}, "d": {"bot": 9}, "e": {"bot": 9}}
        roles = assign_roles(["e", "d", "c", "b", "a"], lanes, {"b": 6}, {"d": 4000, "e": 2000})
        self.assertEqual(roles, {"a": "top", "b": "jungle", "c": "mid", "d": "bot", "e": "support"})

    def test_settle_roles_uses_each_players_usual_role(self):
        def game(top_role: str, bot_role: str) -> dict:
            players = [{"id": "x", "role": top_role}, {"id": "y", "role": bot_role}, {"id": "j", "role": "jungle"}, {"id": "m", "role": "mid"}, {"id": "s", "role": "support"}]
            return {"teams": [{"id": "T", "players": players}], "junglers": {}}

        games = [game("top", "bot"), game("top", "bot"), game("bot", "top")]  # the last one is a lane swap
        self.assertEqual(settle_roles(games), 2)
        self.assertEqual([p["role"] for p in games[2]["teams"][0]["players"]][:2], ["top", "bot"])


class FearlessTest(unittest.TestCase):
    def test_series_without_repeats_is_fearless(self):
        self.assertTrue(detect_fearless(replay(s.series())))

    def test_a_repeated_pick_means_standard_draft(self):
        games = replay(s.series())
        games[1]["draft"][6]["champ"] = "Rumble"  # picked again in game 2
        self.assertFalse(detect_fearless(games))

    def test_single_game_cannot_tell(self):
        self.assertIsNone(detect_fearless(replay(s.series())[:1]))


class AggregateTest(unittest.TestCase):
    def setUp(self):
        self.records = replay(s.series())
        for number, record in enumerate(self.records, 1):
            record.update(series_id="s-1", event="Made-up Cup", date=f"2026-01-0{number}", game_number=number, fearless=True)

    def test_draft_slots(self):
        slots = [a["slot"] for a in draft_slots(self.records[0]) if a["type"] == "pick"]
        self.assertEqual(slots, ["B1", "R1", "R2", "B2", "B3", "R3", "R4", "B4", "B5", "R5"])

    def test_team_slice_counts(self):
        roles = champion_roles(self.records)
        blue = team_slice(s.BLUE, self.records, roles)
        self.assertEqual((blue["games"], blue["wins"]), (2, 1))
        self.assertEqual(blue["sides"], {"blue": [2, 1], "red": [0, 0]})
        rumble = next(c for c in blue["champs"] if c["champ"] == "Rumble")
        self.assertEqual((rumble["picks"], rumble["first_pick"], rumble["rotation1"]), (1, 1, 1))
        self.assertEqual(blue["pick_roles"]["blue"][0], {"top": 2})  # B1 was the top laner in both games
        self.assertEqual([f["game"] for f in blue["fearless"]], [1, 2])
        self.assertEqual(blue["objectives"]["first_blood"], {"games": 2, "took": 2, "avg_t": 240})
        self.assertEqual(blue["jungle"]["early_kills"]["zones"], {"top": 2})

    def test_public_pack_has_no_game_rows(self):
        pack = build_pack(self.records, [s.BLUE, s.RED], s.BLUE)
        self.assertFalse(pack["evidence"])
        self.assertNotIn("evidence", pack["teams"][s.BLUE])
        text = repr(pack)
        self.assertNotIn("g-1", text)  # no game ids
        self.assertIn("all|any", pack["teams"][s.BLUE]["slices"])

    def test_local_pack_lists_games(self):
        pack = build_pack(self.records, [s.BLUE], s.BLUE, evidence=True)
        self.assertEqual(len(pack["teams"][s.BLUE]["evidence"]), 2)


if __name__ == "__main__":
    unittest.main()
