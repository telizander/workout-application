"""Build a season's program into current.json.

Usage (from the repo root):
  python3 scripts/build_program.py                      # current season -> current.json
  python3 scripts/build_program.py spring_2027          # another season
  python3 scripts/build_program.py winter_2026 out.json # write somewhere else

Seasons live in scripts/seasons/. To start a new one, copy the last season file,
change SEASON (dates, eating, notes) and the dials in the day functions, and
point CURRENT at it. TrainingYear.md says what each season is for.
"""
import importlib
import json
import sys
from pathlib import Path

from program_kit import build

CURRENT = "winter_2026"
ROOT = Path(__file__).resolve().parent.parent

name = sys.argv[1] if len(sys.argv) > 1 else CURRENT
out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "current.json"

program = build(importlib.import_module(f"seasons.{name}"))
with open(out_path, "w") as f:
    json.dump(program, f, indent=2, ensure_ascii=False)
    f.write("\n")
print("wrote", out_path, "from season", name)
