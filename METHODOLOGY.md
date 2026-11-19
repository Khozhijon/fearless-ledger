# Methodology

## The problem

Before a League of Legends series a coaching staff answers the same questions about the opponent
every week: what do they first-pick, which role do they hold for the counter-pick, what do they ban
in each phase, which champions does each player rely on, where does their jungler go, and what
should we ban. Under **Fearless Draft** (used by every 2025–26 event in the hackathon data) a
champion picked in one game of a series is gone for both teams in every later game, so the staff
also has to track, game by game, what each player has left and whether our own plan still works.
Today that is VOD review plus a spreadsheet. Fearless Ledger answers those questions from data and
keeps the Fearless bookkeeping for the staff during the series.

## Data

The official GRID event feeds provided for the hackathon: 745 League of Legends series, 1,739
games, LCK, LEC, LTA North/South and LCS, January 2025 to October 2026. Each series is a stream of
events (`team-picked-character`, `player-killed-player`, `player-completed-slayVoidGrub`, …) with
a snapshot of the game state after each event, including all ten players' positions. Cloud9 Kia
plays 142 of these games.

## Approach

### 1. Replay every series (`pipeline/ledger/extract.py`)

The pipeline streams each `.jsonl.zst` file line by line (Python's built-in Zstandard reader) and
keeps one compact record per game:

- the 20-step draft from the game's final `draftActions`, with each team's side;
- the five players of each team and their champions, and the result;
- first blood, first tower (and its lane), first void grubs, dragon, Rift Herald, Atakhan and
  Baron, with the game clock and the team that took it;
- every kill before 14:00, with the victim's map zone and the players who assisted;
- each jungler's position at 1:35 (first camp), 2:30 and 3:20 (end of the first clear), and which
  river scuttle their team took first;
- abandoned and rolled-back game starts (`series-!started-game`) are dropped.

### 2. Infer roles

GRID records no roles, and in many 2025–26 feeds the player order is not the usual
top-jungle-mid-bot-support. For each team in each game the pipeline tries all 120 assignments of
the five roles and keeps the one that best fits the first eight minutes: the jungler kills the
early camps and stands in the jungle or river, the top and mid laners stand in their lanes, the
bot carry and support share bot lane and the carry has more gold at 10:00. Because teams sometimes
swap lanes early, each player's role is then settled to the role they are given most often across
all their games (1,194 of 17,390 player-games changed).

Checks on all 1,739 games: the inferred jungler takes their team's first scuttle in 99.5% of games
(3,444 of 3,463), stands in their own jungle at 1:35 in 94.5%, and 94.6% of picks land on the role
that champion is most often played in.

### 3. Detect Fearless

A series follows Fearless Draft when no champion is picked twice across its games. Every
multi-game series in every event in the data qualifies, so all events are treated as Fearless.

### 4. Map zones (`pipeline/ledger/geo.py`)

Positions are Summoner's Rift units (blue base near (400, 400), red base near (14 400, 14 400)).
A position is classified as base, mid lane (near the diagonal x = y), top or bot lane (near the
map edges on each side of the diagonal), river (near x + y = 14 800) or jungle, and by which half
of the map it is in. The jungler's first-camp position plus their team's side tells whether they
started on red or blue buff.

### 5. Aggregate (`pipeline/ledger/aggregate.py`)

For each team, period (all of 2025–26, or the latest season) and side (both, blue, red):

| Output | Coaching question |
|---|---|
| role taken in each pick slot B1…B5, R1…R5 | What do they first-pick? What do they leave for the counter-pick? |
| bans by phase and side, and the role of each ban | What do they always take away? Which role do they target in phase 2? |
| champion priority: presence, picks, wins, first picks, first-rotation picks, bans by and against | Which champions matter to them, and which do other teams respect? |
| share of comfort picks (a player's top three) in game 1, 2, 3, 4, 5 | How fast does a long Fearless series push them off their pools? |
| player pools with games, wins, last played | What does each player have, and who has left the lineup? |
| jungle start buff, side where the first clear ends, first scuttle | Where should we ward and when can we invade? |
| zones of kills involving their jungler before 8:00 | Which lane do they gank? |
| first blood / tower / grubs / dragon / herald / Baron rate and average time | Which early objective do they prioritise? |

### 6. Recommend (`web/src/stats.ts`, `web/src/board.ts`)

- **Ban targets.** For each champion in a current opponent player's top six, a comfort score of
  `games / (games + 3) × (0.5 + smoothed win rate) × recency` (recency 1 within 60 days of their
  last game, 0.75 within 180, else 0.5), plus a bonus for the team's first-rotation picks.
  Players whose last game is more than 150 days before the team's last game are treated as having
  left the lineup. Champions that are also one of our players' top three are flagged "also ours".
- **Protect.** Our players' top-five champions that this opponent banned at least twice.
- **Contested.** Champions both teams' starters in the same role have played at least twice.
- **Series board.** A champion picked in an earlier game of the series is locked for both teams;
  bans reset every game. Ban targets are recomputed from what is still available, every player's
  pool shows what is gone, and our game-by-game plan is checked for champions planned twice,
  already picked, banned in that game or taken by the opponent.
- **Whiteboard.** Plain sentences are written only when a habit is clear (at least 35% of a slot
  and 3 games); every sentence shows its numbers, and samples under 15 are labelled "small sample".

## Limits

- Roles are inferred, not recorded; around 5% of picks may sit on an unusual role (flex picks are
  real, but some are inference errors).
- Zones are coarse and positions are sampled at events, not continuously.
- The public demo covers the LCS 2026 teams and shows aggregates only, because the data licence
  forbids redistributing match-level data. Run locally for every team and the game list.
- Draft data reflects past patches (15.1 to 16.17); the period switch lets the staff focus on the
  latest season.

## Who it is for, and how it is used

The Cloud9 Kia coaching staff: the head coach and analysts preparing a draft for the next opponent
(scouting report and draft prep), and the staff member running the draft board during a series
(series board, which works offline once loaded and can be exported and shared as a file).
