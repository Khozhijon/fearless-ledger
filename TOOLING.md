# Tooling explanation

Which tools built Fearless Ledger, and exactly what each one did. The entry was built by one
person working with an AI coding agent; this file says which part is whose.

## JetBrains PyCharm 2026.3 (macOS; the free 30-day Pro trial, which falls back to the free tier, no payment)

PyCharm is the project's IDE for the Python data pipeline, the part that turns GRID's raw event
feeds into everything the app shows. The `.idea/` folder is committed so the setup is reproducible.

| What | Where | What it did |
|---|---|---|
| Project model | `.idea/fearless-ledger-pipeline.iml`, `.idea/modules.xml`, `.idea/misc.xml`, `pyproject.toml` | `pipeline/` is a source root, `pipeline/tests/` a test root, and the derived-data folder `packs/`, `node_modules/`, `site/` and `.venv/` are excluded from indexing. PyCharm picked up `pyproject.toml` and the project's `.venv` (Python 3.15, created with uv) as the interpreter by itself. |
| Run configurations | `.idea/runConfigurations/*.xml` | One per pipeline step: "1. Build game records" (all 745 series), "1a. Build sample (20 series, for debugging)", "2. Public demo pack (aggregates only)", "3. Local pack (every team, with game lists)", and "Pipeline tests" (unittest). They set `STL_DATA_DIR` to the data clone next to the project, so the licensed data is read in place and never enters the repository. The full 745-series build was run from the IDE with this configuration (six worker processes; screenshot `submission/pycharm-run.png`). |
| Code inspections | `tools/pycharm-inspect.sh`, `.idea/inspectionProfiles/Project_Default.xml`, [`docs/pycharm-inspections.md`](docs/pycharm-inspections.md) | PyCharm's headless inspector (`inspect.sh`) checked the pipeline with the shared profile. The first run found 35 problems, including 25 type errors from tallies that mixed ints, lists and Counters in one dict, a `None` position that could be indexed, and a variable shadowing the module's `main()`. All code findings were fixed (dataclasses, guards, renames) and the run repeated until only three deliberate wording notes remained. The aggregate output was checked to be identical before and after. The JSON reports are in `docs/inspections-latest/`. |
| Inspection profile | `.idea/inspectionProfiles/` | The project profile is shared (PEP 8 on, line length relaxed to the project's style, spell-checking off because champion and player names are not dictionary words). |

PyCharm was used for the pipeline only; the TypeScript front end was edited outside it, except
for the scouting-sheet feature below, which was built in WebStorm.

## JetBrains WebStorm 2026.3 with JetBrains Air and Junie (added 25 November 2026)

The hackathon's All Products Pack and AI Ultimate codes (two months each, free for entrants) gave
access to WebStorm and to JetBrains AI, which runs the Junie agent inside Air. WebStorm ran on its
trial; Junie ran on the AI Ultimate workspace. No money was spent.

| What | Where | What it did |
|---|---|---|
| Air in WebStorm | Air plugin (bundled in WebStorm 2026.3), Agent Sessions | One Air session with the **Junie** agent (model shown in the session: GPT-6.1 Terra, via JetBrains AI) built the **Scouting sheet** tab: a one-page, print-ready summary of an opponent. The session is shown in `docs/air-session/` (prompt, Junie working, Junie's summary). |
| The task | `.github/prompts/scouting-sheet.prompt.md` (Air's prompt library), copy in `docs/air-session/prompt.md` | The task was written as a project prompt file and chosen from Air's prompt library, so the exact text the agent received is in the repository. |
| Agent guidelines | `.junie/AGENTS.md` | The project rules Junie followed: no invented numbers, every rate with its sample size, GRID data never copied, add tests, no new dependencies. |
| What Junie wrote | `web/src/sheet.ts` (new), `web/src/views.ts` (`sheetView`), `web/src/main.ts` (tab and print button), `web/styles.css` (screen and `@media print` styles), `tests/sheet.test.ts` (new, 3 tests on invented data), `web/src/stats.ts` (evidence strings now give win counts next to win rates) | Junie read the code, planned, made the edits, and ran `npm test` (14 tests) and `npm run build` itself before reporting. |

How the result was checked (outside WebStorm, by the AI pair-programmer described below): `npm test` and `npm run build`
again, the tab read in a browser on the real pack (FlyQuest: 113 games, every rate with its count),
and Chromium's print engine (`tools/print-sheet.cjs`) on five teams: the sheet is one page on both
Letter and A4 for each. `submission/9-scouting-sheet-print.png` is that printout. No change to
Junie's code was needed.

JetBrains AI Assistant chat was not used; Junie was the only JetBrains agent.

## Claude Code (Anthropic), the AI coding agent

Claude Code wrote most of the code, tests and documents from the author's direction, ran the
pipeline on the real data, checked the results, and drove the app in a browser to test it. For the
scouting sheet it wrote the task and the agent guidelines, set up the Air session, and verified
Junie's result. See
[AI_SHOWCASE.md](AI_SHOWCASE.md) for the workflow and the places where checking the data changed
the design.

## Other tools

| Tool | Used for |
|---|---|
| Python 3.15 standard library (`compression.zstd`, `json`, `csv`, `dataclasses`, `unittest`) | The whole pipeline; no third-party Python packages. |
| TypeScript 7, esbuild, Node's test runner | The web app (`web/src`), its build (`tools/build.ts`) and its tests (`tests/`). No front-end framework. |
| GitHub Actions + GitHub Pages | Tests, build and hosting of the public demo (`.github/workflows/pages.yml`). |
| Playwright | Recording the demo video. |

## Data

Official GRID esports data provided for the hackathon (`cloud9esports/stl-hackathon-2026-grid-starter`),
used under its hackathon licence: read from a local clone, never committed, and published only as
aggregates.
