"""Generate the 13-week CARL WEATHERS BUILD program as current.json.

Structure: three 4-week waves (3 build weeks + 1 lighter week), then a
test week (12) and a deload week (13).
  Wave 1: weeks 1-3, deload 4
  Wave 2: weeks 5-7, deload + pull-up retest 8
  Wave 3: weeks 9-11, test 12, deload 13

Every work block pairs non-competing moves so rest time gets used.
Letters are assigned in order per day, so blocks can be added or removed
without renumbering by hand.

Usage (from the repo root):
  python3 scripts/build_program.py              # writes current.json
  python3 scripts/build_program.py other.json   # writes somewhere else
"""
import json
import sys
from pathlib import Path

out_path = sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "current.json"

DELOAD = {4, 8, 13}
TEST = 12
RETEST = 8


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


PAIN_RULE = ("Pain rule: up to 3/10 in the elbow or shoulder is OK if it is no worse the next morning. "
             "Above that: finish the sets as band-assisted pull-ups (@-20lbs); if those hurt too, do KB Pullover 12@16 instead.")

# ---------------------------------------------------------------- D1 PUSH + 350


def day1(w):
    wave, s, light = wave_of(w), step(w), w in DELOAD
    d = Day(1, "Push + 350")
    d.wu(["RopeFlow :120@BW", "Arm Circles :45@BW", "Band Pull-Apart :45@BW", "Scapula Pull 8@BW"])

    # Dips: the cut block ended at 5x6@+30lbs. 4x8@+20 is the same effort in more reps, so wave 1 starts there,
    # then +25 and +30, building 8 -> 10 reps inside each wave. Wave 3 is 4x10@+30: past the cut block.
    dip_load = {1: 20, 2: 25, 3: 30}[wave]
    if w == TEST:
        d.work(1, 180, ["Ring Dip 10@+30lbs", "Ring Face Pull 15@BW"],
               "TEST: one set of max reps at +30lbs, stopping at the last clean rep. Your cut-block number was 6 reps at +30. Log the real number.")
        d.work(2, 120, ["Ring Dip 8@+20lbs", "Ring Face Pull 15@BW"], "Back-off sets.")
    elif light:
        d.work(3, 120, ["Ring Dip 6@+15lbs", "Ring Face Pull 12@BW"], "Lighter week. Smooth reps, full lockout, rings turned out at the top.")
    else:
        reps = 8 + s
        d.work(4, 90, [f"Ring Dip {reps}@+{dip_load}lbs", "Ring Face Pull 15@BW"],
               f"Shoulders stop just below elbows at the bottom; turn the rings out at the top. If the front of the shoulder complains, cut depth first. "
               f"Drop to +{dip_load - 5}lbs if it keeps talking. If dips hurt at any load, do KB Floor Press 10@24+20 instead.")

    # KB Clean + Press with band pull-aparts (no extra elbow flexion).
    mixed = "Mixed pair: switch which hand holds the 24 every set (even set counts keep the sides equal). If you buy a second 24, use 24+24."
    if w == TEST:
        d.work(2, 180, ["KB Clean + Press 8@24+20", "Band Pull-Apart 20@BW"],
               "TEST: max reps, one set with the 24 in each hand; stop at the last clean rep. Week 11 was 5x5. " + mixed)
    elif light:
        d.work(3, 90, ["KB Clean + Press 3@20+20", "Band Pull-Apart 20@BW"], "Lighter week. Crisp reps.")
    else:
        rounds, reps, load = {
            1: (4, 5, "20+20"), 2: (5, 5, "20+20"), 3: (5, 6, "20+20"),
            5: (4, 3, "24+20"), 6: (6, 3, "24+20"), 7: (4, 4, "24+20"),
            9: (4, 4, "24+20"), 10: (4, 5, "24+20"), 11: (5, 5, "24+20"),
        }[w]
        d.work(rounds, 90, [f"KB Clean + Press {reps}@{load}", "Band Pull-Apart 20@BW"],
               "Clean every rep. " + (mixed if load == "24+20" else ""))

    # The 350: about 70 reps a round; 3 -> 4 -> 5 rounds across waves.
    rounds_350 = 2 if light else 3 if w == TEST else {1: 3, 2: 4, 3: 5}[wave]
    d.work(rounds_350, 60, [
        "KB Pullover 10@16",
        "KB Crush Curl 12@16",
        "KB Halo 5'@16",
        "KB Around-the-World 5'@16",
        "DB Lateral Raise 12@20lbs",
        "KB Woodchop 8'@16",
    ], "The 350 (TREE FITTY): about 70 reps a round, building to 5 rounds (350 reps) in wave 3. Loads stay at 16 all block; progress with a 3s lowering, not weight. "
       "Pullover: lie on the floor, knees bent, bell by the horns, ribs down, lower behind your head on a 3-count, pull back with the lats. "
       "Lateral raise replaces the upright row. If an elbow goes above 3/10, swap the crush curl for KB Bottoms-Up Hold :20'@16.")
    return d.to_json()

# ------------------------------------------------------- D2 SANDBAG LOWER


CLEAN = {  # week: (rounds, reps) -- load holds at 130lbs: maintenance, not a push.
    1: (4, 3), 2: (3, 5), 3: (4, 3), 4: (3, 3),
    5: (4, 3), 6: (3, 5), 7: (4, 3), 8: (3, 3),
    9: (4, 3), 10: (3, 5), 11: (4, 3), 12: (3, 3), 13: (3, 3),
}
ZERCHER = {1: 110, 2: 120, 3: 120}
ZERCHER_NOTE = ("Zercher: size lift for quads and upper back. Bag in the crooks of your elbows, stay tall. Wear sleeves or a towel; "
                "if the elbows complain, do SB Bear Hug Squat 8 at the same load instead.")


def day2(w):
    wave, s, light = wave_of(w), step(w), w in DELOAD
    easy = light or w == TEST
    d = Day(2, "Sandbag Lower")
    d.wu(["RopeFlow :120@BW", "Hindu Squat 15@BW", "Hip Circles :45@BW", "SB Bear Hug Hold :20@100lbs"])

    # Shouldering first, while fresh: the favourite, every week.
    sh_reps = 2 if easy else {1: 2, 2: 3, 3: 3}[wave]
    d.work(3, 75, [f"SB Shouldering {sh_reps}'@130lbs", "Band Pull-Apart 15@BW"],
           "Maintenance at 130lbs. Alternate shoulders every rep. Fast and crisp, never a grind.")

    rounds, reps = CLEAN[w]
    note = ("Maintenance: 130lbs all block, alternating triples and fives. Every rep a clean pickup. "
            "If a day feels great you can do one extra triple at 140lbs, but nothing in this block depends on it.")
    if light:
        note = "Lighter week. Fast, clean reps."
    d.work(rounds, 150, [f"SB Clean + Front Squat {reps}@{120 if light else 130}lbs", "Ring Push-up 8@BW"],
           note + " Push-ups go in the rest: easy chest volume that doesn't touch the legs or back.")

    zl = ZERCHER[wave]
    if easy:
        d.work(2, 120, [f"SB Zercher Squat 6@{zl - 10}lbs", "Band Pull-Apart 15@BW"], ZERCHER_NOTE)
    else:
        d.work(4 if s == 2 else 3, 120, [f"SB Zercher Squat 8@{zl}lbs", "Band Pull-Apart 20@BW"], ZERCHER_NOTE)

    if easy:
        d.work(3, 90, ["SB Shoulder Carry 40@120lbs", "SB Bear Hug Carry 40@120lbs"])
    else:
        dist = 40 + 10 * s
        d.work(3, 120, [f"SB Shoulder Carry {dist}@130lbs", f"SB Bear Hug Carry {dist}@130lbs"],
               "Carries at 130lbs all block; distance goes 40, 50, 60 steps in each wave. Switch shoulders each round.")

    d.fin(["KB Farmer Walk 60@20+20" if wave == 1 or easy else "KB Farmer Walk 60@24+20"])
    return d.to_json()

# ---------------------------------------------------------------- D3 PULL


PULL = {  # week: (rounds, reps, tempo)
    1: (5, 3, True), 2: (5, 3, True), 3: (5, 4, True), 4: (3, 3, True),
    5: (5, 4, True), 6: (5, 5, True), 7: (5, 5, True),
    9: (5, 5, False), 10: (5, 6, False), 11: (6, 5, False),
    13: (3, 3, False),
}


def day3(w):
    wave, s, light = wave_of(w), step(w), w in DELOAD
    d = Day(3, "Pull")
    d.wu(["Dead Hang :30@BW", "Scapula Pull 10@BW", "Band Pull-Apart :45@BW", "RopeFlow :90@BW"])
    hollow = "Hollow Body Hold :20@BW"

    if w in (RETEST, TEST):
        d.work(1, 180, ["Ring Pull-up 8@BW"],
               "TEST: one strict max set, dead hang to chin over rings, 2s down, no kip. Log your real number, even if it's more or less than 8. "
               "10+ reps pain-free means weighted pull-ups can come back next block.")
        d.work(3, 90, ["KB Pullover 12@16", hollow], "Lats without bending the elbows. No more pull-ups today.")
    else:
        rounds, reps, tempo = PULL[w]
        name = "Tempo Ring Pull-up" if tempo else "Ring Pull-up"
        note = "Neutral grip, rings free to rotate. " + ("3 seconds down on every rep. " if tempo else "") + \
            "Add the next rep only if last session stayed at 3/10 or less and the next morning was fine. " + PAIN_RULE
        if light:
            note = "Lighter week. " + note
        d.work(rounds, 120, [f"{name} {reps}@BW", hollow], note)

    if light:
        d.work(3, 90, ["KB Supported Row 8'@20", "KB Floor Press 8@20+20"])
        d.work(2, 60, ["Ring Face Pull 12@BW", "DB Lateral Raise 12@20lbs", "DB Overhead Extension 10@20lbs"])
        d.fin(["Band Pull-Apart 20@BW"])
        return d.to_json()

    row_bell = "20" if wave == 1 else "24"
    press = {1: "20+20", 2: "24+20", 3: "24+20"}[wave]
    reps = {1: 10, 2: 8, 3: 10}[wave]
    d.work(3 if w in (1, TEST) else 4, 90, [f"KB Supported Row {reps}'@{row_bell}", f"KB Floor Press {reps}@{press}"],
           "Supported row: one hand braced on a box or bench so the lower back rests before leg day. Pause 1s at the top. "
           "Floor press keeps chest volume up. 24+20: switch hands each set.")
    if w != TEST:
        d.work(3, 75, ["KB Gorilla Row 8'@24", "Feet-Up Ring Row 10@BW"],
               "Capped at these reps all block to keep elbow load in check. Squeeze 1s at the top.")
    # Laterals: 20lbs is what you already use, so the load holds and reps build 12 -> 15 -> 20 across waves.
    lat = 12 if w == TEST else {1: 12, 2: 15, 3: 20}[wave]
    d.work(2 if w == TEST else 3, 60, ["Ring Face Pull 15@BW", f"DB Lateral Raise {lat}@20lbs", "DB Overhead Extension 12@20lbs"],
           "Rear delts, side delts, triceps: the shoulder caps and arm size.")
    hold = {1: ":40", 2: ":50", 3: ":60"}[wave]
    d.fin([f"SB Bear Hug Hold {hold}@130lbs"],
          "Load stays at 130lbs; progress time. Hug it high and tight, upper back working hard.")
    return d.to_json()

# ------------------------------------------------------------ D4 KB LEGS


# The leg complex, in the order the bells move: rack -> sit -> stand -> overhead -> floor -> rack -> lunge.
COMPLEX = ["KB Box Squat", "KB Front Squat", "KB Thruster", "KB Dead Clean", "KB Reverse Lunge"]
RUNGS = (10, 8, 6, 4)
L, M, H = "16+16", "20+20", "24+20"

# Week -> (load for each rung 10/8/6/4, rest between rungs).
# The heavier pair creeps one rung earlier each build week; wave 3 holds loads and cuts the rest instead.
LADDER = {
    1: ((L, L, M, M), 120),
    2: ((L, M, M, M), 120),
    3: ((L, M, M, H), 120),
    4: ((L, L, L, L), 120),
    5: ((L, M, M, H), 90),
    6: ((L, M, H, H), 90),
    7: ((M, M, H, H), 90),
    8: ((L, L, M, M), 120),
    9: ((M, M, H, H), 90),
    10: ((M, M, H, H), 75),
    11: ((M, M, H, H), 60),
    12: ((L, L, M, M), 120),
    13: ((L, L, L, L), 120),
}


def ladder_lines(loads):
    load = "/".join(loads)
    return [f"{name} @{load}" for name in COMPLEX]


def day4(w):
    wave, light = wave_of(w), w in DELOAD or w == TEST
    d = Day(4, "KB Legs + Carries")
    d.wu(["RopeFlow :120@BW", "KB Halo 6'@16", "Hindu Squat 10@BW", "KB Goblet Squat 8@16", "Leg Swings :45@BW"])

    loads, rest = LADDER[w]
    d.work("/".join(map(str, RUNGS)), rest, ladder_lines(loads),
           "Clean to the rack once, then run each rung straight through. Box squat: sit, pause 1s. "
           "The last dead clean stays racked for the lunges (alternate legs). Swap bells in the rest; 24+20: switch hands each heavy rung.")

    # Ballistics: the cut block ran 5x12 swings and a 12-minute snatch EMOM every week. Keep both patterns alive
    # and still building; the snatch stays the pace-setter it was, now with a heavier bell in wave 3.
    swings = 10 if light else {1: 12, 2: 15, 3: 15}[wave]
    snatch = "5'@16" if light else {1: "5'@16", 2: "6'@16", 3: "5'@20"}[wave]
    pullups = not light and wave > 1
    lsit = ":15" if light else {1: ":20", 2: ":25", 3: ":30"}[wave]
    moves = [f"KB Swing {swings}@24", f"KB Snatch {snatch}"] + (["Ring Pull-up 3@BW"] if pullups else []) + [f"Ring L-Sit Hold {lsit}@BW"]
    d.work(2 if light else 3, 60, moves,
           "Hard, snappy swings for hamstrings and glutes to balance all that squatting; snatches keep your EMOM engine and lockout. "
           + ("Pull-ups are an easy second exposure: neutral grip, well short of failure. Skip them if Pull day broke the pain rule this week." if pullups else ""))

    if light:
        d.work(2, 60, ["Ring Push-up 10@BW", "DB Overhead Extension 12@20lbs", "Ring Fallout 6@BW"])
    else:
        pu = {1: "RTO Ring Push-up 12@BW", 2: "Feet-Up Ring Push-up 12@BW", 3: "Feet-Up Ring Push-up 15@BW"}[wave]
        fall = {1: 8, 2: 10, 3: 12}[wave]
        d.work(3, 60, [pu, "DB Overhead Extension 12@20lbs", f"Ring Fallout {fall}@BW"],
               "RTO = rings turned out at lockout. Chest and arm size work: 1-2 reps short of failure. Overhead extension: elbows in, slow down.")

    bag = {1: 100, 2: 110, 3: 110}[wave]
    farm = "20+20" if wave == 1 else "24+20"
    if light:
        d.fin(["SB Bear Hug Carry 40@100lbs", "KB Farmer Walk 40@20+20"])
    else:
        d.fin([f"SB Bear Hug Carry 60@{bag}lbs", f"KB Farmer Walk {60 if wave < 3 else 80}@{farm}", "Rest :60",
               f"SB Shoulder Carry 40@{bag}lbs", f"KB Farmer Walk 40@{farm}"],
              "Carry medley with the lighter bag. Smooth distance, not max load.")
    return d.to_json()

# ------------------------------------------------------------------ WEEKS


PHASES = {
    1: ("WAVE 1 / BUILD", "On-ramp. Leave reps in the tank. Pull-ups restart at 3 slow reps; see how elbows and shoulders respond before adding anything."),
    2: ("WAVE 1 / BUILD", "Add reps where the plan says. Eat to grow: bodyweight should trend up."),
    3: ("WAVE 1 / BUILD", "Hardest week of wave 1."),
    4: ("DELOAD", "Lighter week: fewer rounds, lighter loads. Let elbows and shoulders settle."),
    5: ("WAVE 2 / BUILD", "Heavier wave. Mixed 24+20 pair for presses and floor presses. Shouldering goes to 3 each side."),
    6: ("WAVE 2 / BUILD", "Keep pull-ups pain-free."),
    7: ("WAVE 2 / BUILD", "Hardest week of wave 2."),
    8: ("DELOAD + RETEST", "Lighter week with a strict pull-up max test on Pull day."),
    9: ("WAVE 3 / PEAK", "Heaviest wave. The 350 goes to 5 full rounds."),
    10: ("WAVE 3 / PEAK", "More volume on the size work."),
    11: ("WAVE 3 / PEAK", "Last hard week. Test week follows, so sleep and eat."),
    12: ("TEST WEEK", "Test the numbers: ring dip top set, pull-up max, KB press 5@24+20. Sandbag day is an easy maintenance session. Everything else is light. Log everything."),
    13: ("DELOAD / TRANSITION", "Easy week. Recover, then the next block is built from your week 12 numbers."),
}

weeks = {}
for w in range(1, 14):
    phase, goal = PHASES[w]
    weeks[str(w)] = {"phase": phase, "goal": goal, "days": [day1(w), day2(w), day3(w), day4(w)]}

program = {
    "program": {
        "title": "CARL WEATHERS BUILD",
        "subtitle": "13-Week Strength + Size — Sandbag, KB, Rings",
        "notes": (
            "Eating to grow: bodyweight should trend up slowly. Three waves of 3 build weeks plus a lighter week, then test (week 12) and deload (week 13). "
            "Schedule: keep a rest day between Sandbag Lower and Pull (e.g. Mon Push, Tue Sandbag, Thu Pull, Sat Legs). "
            "Sandbag is maintenance: cleans, shouldering and carries hold at 130lbs all block. "
            "Pull-ups restart at bodyweight with a neutral grip on free-rotating rings, and reps only go up when the elbows and shoulders allow. "
            "Pain rule: up to 3/10 that is gone by the next morning is OK. Anything more: band-assisted pull-ups, or KB pullovers if those hurt too. "
            "Elbow or shoulder pain that lasts more than 2 weeks is worth a physio visit. "
            "24+20 means a mixed pair: switch which hand holds the 24 each set. If you buy a second 24, use 24+24. "
            "If top sets stall two weeks in a row, cut accessory sets first."
        ),
        "weeks": weeks,
    }
}

with open(out_path, "w") as f:
    json.dump(program, f, indent=2, ensure_ascii=False)
    f.write("\n")
print("wrote", out_path)
