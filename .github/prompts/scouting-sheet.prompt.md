---
description: Add a print-ready one-page scouting sheet tab (Fearless Ledger)
---

Add a "Scouting sheet" tab: a one-page, print-ready summary of the selected opponent that a coach can print or save as PDF before a match. Follow .junie/AGENTS.md (no invented numbers, every rate shows its sample size).

1. New pure module web/src/sheet.ts exporting sheetData(v: View) that returns, from the existing pack slice only: the team record (games, wins, blue and red side record, date range); the top 5 whiteboard insights from insights(); the top 5 ban targets from banSuggestions() with their first reason; up to 3 protect picks from protect(); each current player (currentPlayers(), one per role in ROLES order) with their top 3 champions (games, wins, last date); the top 5 first-rotation picks (rotation1 out of games); and the jungle start split and first blood / first dragon / first herald / first tower rates from slice.jungle and slice.objectives (took of games).
2. New view sheetView(v) in web/src/views.ts that renders that data in a compact two-column layout with a "Print sheet" button (window.print()).
3. Add the tab ['sheet', 'Scouting sheet'] in web/src/main.ts, wired like the 'prep' tab (self-scout: show the sheet for Cloud9 Kia without ban/protect sections); handle the print button click.
4. In web/styles.css: screen styles for .sheet and an @media print block that fits the sheet on one Letter/A4 page (hide header, tabs, controls and footer; small type).
5. Add tests/sheet.test.ts with invented data: former players are excluded, at most 5 bans, every rate carries its count, and missing objectives give no number.
6. Run npm test and npm run build and fix any errors.
