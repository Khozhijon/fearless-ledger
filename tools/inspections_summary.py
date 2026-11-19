"""Summarise the JSON reports written by tools/pycharm-inspect.sh.

    python3 tools/inspections_summary.py [inspections-folder]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

folder = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "inspections")
total = 0
for report in sorted(folder.glob("*.json")):
    if report.name.startswith("."):
        continue
    data = json.loads(report.read_text(encoding="utf-8"))
    problems = data.get("problems", []) if isinstance(data, dict) else data
    total += len(problems)
    print(f"{report.stem}: {len(problems)}")
    for problem in problems:
        where = problem.get("file", "").replace("file://$PROJECT_DIR$/", "")
        print(f"  {where}:{problem.get('line')}  {problem.get('description', '')[:120]}")
print(f"total: {total}")
