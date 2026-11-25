# Guidelines for coding agents (Junie, Claude Agent) working on Fearless Ledger

Fearless Ledger is a League of Legends draft and early-macro scouting tool for Cloud9 Kia's
coaches, built from the official GRID match data of the Cloud9 × JetBrains hackathon.

## Data rules (hard constraints)

- The GRID data is licensed for this hackathon only. Never copy, commit or print raw GRID files
  or game-by-game extracts. The data lives outside this repository (`STL_DATA_DIR`).
- Never invent numbers. Every figure the app shows must come from the scouting pack the Python
  pipeline writes (`web/public/demo-pack.json` or the git-ignored `packs/local-pack.json`).
  If a value is missing, show nothing or "–", never a placeholder number.
- Every rate shown to a coach shows its sample size (for example "7 of 19 games").
- The public pack holds aggregates only; `tools/build.ts` refuses a public pack with game lists.

## Code layout

- `pipeline/` Python 3.14+, standard library only. Tests: `npm run test:py` (made-up data).
- `web/src/` TypeScript, no framework. Views return `Raw` HTML from the `html` tagged template
  in `web/src/html.ts`, which escapes every interpolated value. Pure logic lives in `stats.ts`
  and `board.ts`; views in `views.ts` and `boardView.ts`; routing and state in `main.ts`.
- Tests: `npm test` (tsc type check + node:test in `tests/*.test.ts`). Tests use invented teams
  and numbers only.
- Build: `npm run build` writes `site/`. Local server: `npm run dev` (port 5180).

## Style

- Plain, specific English aimed at a coach, not a data scientist.
- Keep functions small and pure where possible, and add a test for new logic.
- Do not add dependencies.
