# AI-powered workflow: how Fearless Ledger was built

Fearless Ledger was built by one person with **Claude Code**, an AI coding agent working in the
terminal, and JetBrains tools: **PyCharm 2026.3** for the data pipeline's project setup, run
configurations and code inspections (19 November 2026), and **WebStorm 2026.3 with JetBrains Air
and the Junie agent** for the printable scouting sheet (25 November 2026, section 7). This is what
each step looked like, including the places where an AI's first idea was wrong and the data said so.

Lead developer: Khozhijon. I led the project from idea to submission and directed an AI
pair-programmer (Claude Code) that helped write the code, which I reviewed and tested.

## 1. Read the rules and the data licence before writing code

The agent read the hackathon rules and the GRID starter repository's `AGENTS.md` (a file the
organisers wrote for AI agents). The licence decided the architecture: the data may not be
redistributed, so the repository holds no data, the pipeline reads a separate clone through
`STL_DATA_DIR`, everything derived goes to a git-ignored folder, and the public demo shows
aggregates only. The build script refuses to publish a pack that contains game lists.

## 2. Look at one series before designing anything

Instead of guessing the schema, the agent streamed a single LCK series and printed only the event
types and a truncated draft event. That showed the draft lives in each game's `draftActions`,
that every event carries all ten players' positions, and that assists can be read from which
players' `killAssistsGiven` changed. A first replay of that series produced the right draft, the
right first objectives and a jungler path that made sense on the map.

## 3. Let the data check the AI's assumptions

The first version assumed GRID lists players in role order (top, jungle, mid, bot, support), which
was true in the first series looked at. Running the pipeline over all 745 series and checking "does
the player we call the jungler take the scuttle crab?" showed it held in early 2025 but failed in
up to 70% of games in later events. The agent replaced the assumption with role inference from the
first eight minutes (camps, lane presence, gold), found that early lane swaps still mislabelled top
and bot laners (K'Sante "in bot lane" 55 times), and added a second pass that settles each player
on their usual role. After that the inferred jungler takes the first scuttle in 99.5% of games.

The same habit caught a product problem: the first ban suggestions against FlyQuest included
champions of players who had left the team a season earlier. Suggestions now use only the current
lineup, and former players are marked in the report.

## 4. Use the IDE's inspections as a second reviewer

PyCharm opened the project, detected its `pyproject.toml` and uv `.venv` as the interpreter, and
ran the full 745-series build from the shared run configuration. Its headless inspector was run with a shared profile
(`tools/pycharm-inspect.sh`). Its first report had 35 findings; 25 were type errors from tallies
that mixed ints, lists and Counters in one dict, which the agent had written for speed. They became
three dataclasses, a possibly-`None` position index got a guard, and a variable shadowing `main()`
was renamed. The agent re-ran the pipeline to confirm the numbers did not change, and re-ran the
inspector until only deliberate wording notes were left
([docs/pycharm-inspections.md](docs/pycharm-inspections.md)).

## 5. Test what can break, on invented data

The test suites use made-up series and teams (`pipeline/tests/synthetic.py`) so they can be public:
replay, rolled-back games, scrambled player order, Fearless detection, aggregation, and in
TypeScript the insight sentences, ban scoring, the Fearless lock rules and plan checks. Three test
expectations the agent first wrote were wrong about its own synthetic data (the test team was blue
side in both games); the failures were read, and the tests, not the code, were corrected.

## 6. Drive the real app

The agent built the site, served it locally and used a browser to read every view, then scripted a
series on the board (game 1 picks, a win, an attempt to re-pick Rumble in game 2, a plan with a
duplicate). That found two bugs no unit test covered: the map's zones were missing (a nested array
was escaped as text) and the bases were drawn as lens shapes. Both were fixed and checked again.

## 7. Hand a self-contained feature to a second agent: Junie in JetBrains Air

What a coaching staff takes into the booth is often a sheet of paper, not a web page. The "Scouting
sheet" tab (one printable page per opponent) was a good fit for a second agent: it touches only the
web app, reuses existing scouting logic, and is easy to check.

1. **Guidelines first.** `.junie/AGENTS.md` gives any agent the project's rules: no invented
   numbers, every rate with its sample size, never copy GRID data, add tests, no new dependencies.
2. **The task as a file.** The task was written as `.github/prompts/scouting-sheet.prompt.md`, so it
   appears in Air's prompt library and the exact text the agent got is in the repository
   ([screenshot](docs/air-session/1-prompt-from-library.jpg)).
3. **Junie in an Air session in WebStorm** (JetBrains AI Ultimate from the hackathon code). Junie
   read the routing, stats and view code, wrote a plan, created `web/src/sheet.ts` and `tests/sheet.test.ts`, edited
   `views.ts`, `main.ts`, `stats.ts` and `styles.css`, and ran `npm test` (14 tests) and
   `npm run build` itself ([working](docs/air-session/2-junie-working.jpg),
   [summary and changed files](docs/air-session/3-junie-result.jpg)). On its own initiative it also
   made the ban-target and insight evidence show win counts next to win rates, which follows the
   sample-size rule.
4. **Independent check.** Tests and build were run again outside the IDE, the tab was read on the
   real pack, and a Chromium print script (`tools/print-sheet.cjs`) confirmed one page on Letter and
   A4 for five teams ([printout](submission/9-scouting-sheet-print.png)). Junie's code needed no
   changes.

What this showed: with written rules and a precise task, the agent in Air delivered a complete,
tested feature in under five minutes; the review step was about checking the numbers and the
printout, not fixing code.

## What the human did

Chose the contest and set the constraints ($0 cost, truthful entry, data licence respected),
redeemed the JetBrains codes and signed in to JetBrains AI, and approved every public step:
publishing the repository, the video and the submission.

## What the AI did not do

It did not invent data, numbers or results: every figure in this repository and in the video comes
from running the pipeline on the GRID files. JetBrains AI Assistant chat was not used; Junie in Air
was used only for the scouting sheet (section 7).
