# Tooling explanation

Which tools built Fearless Ledger, and exactly what each one did. The entry was built by one
person working with an AI coding agent; this file says which part is whose.

## JetBrains PyCharm 2026.3 (free tier, macOS)

PyCharm is the project's IDE for the Python data pipeline, the part that turns GRID's raw event
feeds into everything the app shows. The `.idea/` folder is committed so the setup is reproducible.

| What | Where | What it did |
|---|---|---|
| Project model | `.idea/cloud9.iml`, `.idea/modules.xml`, `.idea/misc.xml` | `pipeline/` is a source root, `pipeline/tests/` a test root, and the derived-data folder `packs/`, `node_modules/` and `site/` are excluded from indexing. The project interpreter is "Python 3" (3.15). |
| Run configurations | `.idea/runConfigurations/*.xml` | One per pipeline step: "1. Build game records" (all 745 series), "1a. Build sample (20 series, for debugging)", "2. Public demo pack (aggregates only)", "3. Local pack (every team, with game lists)", and "Pipeline tests" (unittest). They set `STL_DATA_DIR` to the data clone next to the project, so the licensed data is read in place and never enters the repository. |
| Code inspections | `tools/pycharm-inspect.sh`, `.idea/inspectionProfiles/Project_Default.xml`, [`docs/pycharm-inspections.md`](docs/pycharm-inspections.md) | PyCharm's headless inspector (`inspect.sh`) checked the pipeline with the shared profile. The first run found 35 problems, including 25 type errors from tallies that mixed ints, lists and Counters in one dict, a `None` position that could be indexed, and a variable shadowing the module's `main()`. All code findings were fixed (dataclasses, guards, renames) and the run repeated until only three deliberate wording notes remained. The aggregate output was checked to be identical before and after. The JSON reports are in `docs/inspections-latest/`. |
| Inspection profile | `.idea/inspectionProfiles/` | The project profile is shared (PEP 8 on, line length relaxed to the project's style, spell-checking off because champion and player names are not dictionary words). |

What PyCharm did **not** do: JetBrains AI Assistant, Junie and JetBrains Air were not used (they
need a paid AI plan). The TypeScript front end was edited outside PyCharm.

## Claude Code (Anthropic), the AI coding agent

Claude Code wrote most of the code, tests and documents from the author's direction, ran the
pipeline on the real data, checked the results, and drove the app in a browser to test it. See
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
