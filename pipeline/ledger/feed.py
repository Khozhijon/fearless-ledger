"""Reading GRID series feeds from the local data clone.

The data is licensed for the hackathon only and must never be copied into this
repository, so everything here streams it from a path outside the project:
``STL_DATA_DIR`` (default ``../stl-hackathon-2026-grid-starter``).
"""
from __future__ import annotations

import csv
import io
import json
import os
from collections.abc import Iterator
from pathlib import Path

try:  # Python 3.14+ ships Zstandard in the standard library.
    from compression import zstd as _zstd
except ImportError:  # pragma: no cover - older Pythons need `pip install zstandard`
    import zstandard as _zstd  # type: ignore[no-redef]

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def data_dir() -> Path:
    """The local GRID data clone. It lives next to the project, never inside it."""
    configured = os.environ.get("STL_DATA_DIR")
    path = Path(configured) if configured else PROJECT_ROOT.parent / "stl-hackathon-2026-grid-starter"
    path = path.resolve()
    if path == PROJECT_ROOT or PROJECT_ROOT in path.parents:
        raise RuntimeError("STL_DATA_DIR must be outside the project folder, so the licensed data can never be committed")
    return path


def open_text(path: Path) -> io.TextIOBase:
    """Open a file as text, decompressing `.zst` on the fly."""
    if path.suffix == ".zst":
        return _zstd.open(path, "rt", encoding="utf-8")  # type: ignore[return-value]
    return open(path, encoding="utf-8")


def envelopes(path: Path) -> Iterator[dict]:
    """Yield the JSON envelopes of one series feed, in file order."""
    with open_text(path) as handle:
        for line in handle:
            line = line.strip()
            if line:
                yield json.loads(line)


def series_index(root: Path, title: str = "lol") -> list[dict[str, str]]:
    """Rows of ``{title}/series.csv``: one per series, with event, stage, date and file."""
    with open(root / title / "series.csv", newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))
