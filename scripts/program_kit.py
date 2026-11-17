"""Shared skeleton for every season: 13 weeks, three 3+1 waves, test and deload.

  Wave 1: weeks 1-3, deload 4
  Wave 2: weeks 5-7, deload (+ retest) 8
  Wave 3: weeks 9-11, test 12, deload 13

A season file (scripts/seasons/<name>.py) provides SEASON, PHASES and DAYS;
build() turns it into the program JSON the app reads.
"""

DELOAD = {4, 8, 13}
TEST = 12
RETEST = 8
WEEKS = range(1, 14)


def wave_of(w):
    return 1 if w <= 4 else 2 if w <= 8 else 3


def step(w):
    """Position inside a build wave: 0, 1, 2 (None for deload/test weeks)."""
    if w in DELOAD or w == TEST:
        return None
    return (w - 1) % 4


class Day:
    """Collects blocks and hands out block letters A, B, C... in order."""

    def __init__(self, number, name):
        self.number = number
        self.name = name
        self.blocks = []
        self.letters = iter("ABCDEFGH")

    def wu(self, exercises, note=None):
        self._add("WU", exercises, note)

    def fin(self, exercises, note=None):
        self._add("FIN", exercises, note)

    def work(self, rounds, rest, exercises, note=None):
        self._add(f"{rounds}{next(self.letters)}{rest}s", exercises, note)

    def _add(self, header, exercises, note):
        b = {"header": header, "exercises": exercises}
        if note:
            b["note"] = note
        self.blocks.append(b)

    def to_json(self):
        return {"day": self.number, "name": self.name, "blocks": self.blocks}


def build(season):
    """Program JSON for a season module."""
    s = season.SEASON
    weeks = {}
    for w in WEEKS:
        phase, goal = season.PHASES[w]
        weeks[str(w)] = {"phase": phase, "goal": goal, "days": [day(w) for day in season.DAYS]}
    notes = f"{s['season']} ({s['dates'][0]} to {s['dates'][1]}). Eating: {s['eating']} " + s["notes"]
    return {"program": {"title": s["title"], "subtitle": s["subtitle"], "notes": notes, "weeks": weeks}}
