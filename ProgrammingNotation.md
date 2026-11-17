# [title:Programming Notation]# Training Log Style Guide

Version 1.1 | Last Updated: 2025-11-04

---

## 1. Log Header

Start each log with date and session name:

```
# 2025-11-04 | Upper A
```

---

## 2. Block Header

```
<rounds><block><rest in seconds>
```

Examples:
- `5A90s` → 5 rounds, block A, 90 seconds rest
- `4B120s` → 4 rounds, block B, 120 seconds rest

---

## 3. Reps and Time

- `'` always means **each side / direction**
- `:` always means **time in seconds** (use `:90` not `1:30`)

Rules:
- `5` = 5 reps total
- `5'` = 5 reps each side/direction
- `:30` = 30 seconds
- `:30'` = 30 seconds each side/direction

---

## 4. Weight

Use `@<number>` after each movement

Numbers are in kilograms by default

Always explicit—no block-level weight shortcuts

**Double Kettlebells**: Use `@<weight>+<weight>` notation

Examples:
```
- KB Swing 15@24
- KB Clean 5'@20
- KB Halo 5'@8
- KB Clean 5@24+24        # double KB, 24kg each
- KB Swing 15@20+24       # double KB, 20kg and 24kg
- KB Press 5@16+16        # double KB, 16kg each
```

---

## 5. Bodyweight Movements

**Unweighted**: Use `@BW`
```
- Ring Row 8@BW
- Ring Dip 5@BW
```

**Assisted**: Use negative numbers
```
- Ring Dip 5@-10    # assisted with 10kg
```

**Weighted**: Use positive numbers
```
- Ring Dip 5@+10    # weighted with 10kg
- Pull-up 8@+15
```

---

## 6. Movement Syntax

```
- <Movement> <reps/time>@<weight>
```

Examples:
```
- KB Swing 15@24
- KB Clean 5'@20
- KB Halo 5'@8
- KB Press 5@24+24        # double KB
- Mace360 :30'@10
- Ring Row 8@BW
- Ring Dip 5@-10
- RopeFlow :60@BW
- SB Shouldering 3'@100
```

**Prefixes**:
- `KB` = Kettlebell
- `SB` = Sandbag
- No prefix needed for standard barbell/dumbbell movements

---

## 7. Warmups and Finishers

Label warmups with `WU:` and finishers with `FIN:`

```
WU:
  - RopeFlow :60@BW
  - KB Halo 5'@8

FIN:
  - RopeFlow :90@BW
  - KB Snatch :30'@16
```

---

## 8. Complexes / Circuits

Use indentation for clarity:

```
5A90s:
  - KB Swing 15@24
  - KB Clean 5'@20
  - KB Press 5'@20

4B120s:
  - Mace360 :30'@10
  - SB Shouldering 3'@100
  - Ring Row 8@BW
```

---

## 8a. Ladders

Put the rep ladder in the block header in place of the round count. Separate the rungs with `/`.
Each rung is one round; rest is taken between rungs. Exercises inside drop their reps and do the rung's reps.

```
10/8/6/4A90s:
  - KB Box Squat @16+16/20+20/20+20/24+20
  - KB Thruster @16+16/20+20/20+20/24+20
  - KB Reverse Lunge @16+16/20+20/20+20/24+20
```

Rung 1 is 10 reps @16+16, rung 2 is 8 @20+20, and so on. Separate loads with `/` to change them per rung; a single load (`@20+20`) holds for every rung.
An exercise that keeps its own reps (`Ring L-Sit Hold :20@BW`) does those every rung.

---

## 9. Complete Example

```
# 2025-11-04 | Full Body A

WU:
  - RopeFlow :60@BW
  - KB Halo 5'@8
  - Arm Circles :30'@BW

5A90s:
  - KB Swing 15@24+24
  - KB Clean 5'@20
  - KB Press 5'@20

4B120s:
  - Mace360 :30'@10
  - SB Shouldering 3'@100
  - Ring Row 8@BW

3C60s:
  - Ring Dip 5@-10
  - Pull-up 5@+5
  - Hanging Knee Raise 10@BW

FIN:
  - RopeFlow :90@BW
  - KB Snatch :30'@16
```

---

## Quick Reference Card

| Notation | Meaning |
|----------|---------|
| `5` | 5 reps total |
| `5'` | 5 reps each side |
| `:30` | 30 seconds |
| `:30'` | 30 seconds each side |
| `@24` | 24kg weight |
| `@24+24` | Double KB, 24kg each |
| `@BW` | Bodyweight |
| `@+10` | Weighted (+10kg) |
| `@-10` | Assisted (-10kg) |
| `5A90s:` | 5 rounds, block A, 90s rest |
| `10/8/6/4A90s:` | Ladder block: rungs of 10, 8, 6, 4 reps, 90s rest |
| `@16/20/20/24` | Load per rung (inside a ladder block) |

---

## Training Log Cheatsheet

### 1. Block Header

```
<rounds><block><rest>
```

- `5A90` → 5 rounds, block A, 90s rest
- `4B120` → 4 rounds, block B, 120s rest

Optional weight for the block:
```
5A90: @24
```

---

### 2. Reps and Sides

- `5` = 5 reps total
- `5'` = 5 reps each side
- `:30` = 30 seconds
- `:30'` = 30 seconds each side

---

### 3. Weight

Use `@<number>`; numbers are in kg by default.

Examples: `@24`, `@8`, `@24+24` (double KB)

Only include deviations for rings or bodyweight-assumed movements.

---

### 4. Movement Syntax

```
- <Movement> <reps/time>@<weight>
```

Examples:
```
- KB Swing 15@24
- KB Clean 5'@20
- KB Halo 5'@8
- KB Press 5@24+24      # double KB
- Mace360 :30'
- Ring Row 8'           # BW default
- Ring Dip 5            # BW default
- RopeFlow :60
- SB Shouldering 3'@100
```

---

### 5. Warmups and Finishers

Label warmups with `WU:` and finishers with `FIN:`

Example:
```
WU:
  - RopeFlow :60
  - KB Halo 5'@8

FIN:
  - RopeFlow :90
  - KB Snatch :30'
```

---

### 6. Complexes / Circuits

Use YAML-like indentation for clarity:

```
5A90s:
  - KB Swing 15@24
  - KB Clean 5'@20
  - KB Press 5'@20

4B120s:
  - Mace360 :30'
  - SB Shouldering 3'@100
  - Ring Row 8'
```

---

### 7. Notes / LLM Guidance

- `'` always means each side / direction
- `:` always means time in seconds
- Block headers dictate rounds, block label, and rest
- Weights are numeric-only, kilograms assumed
- BW is default for rings, add `@` only if weighted or assisted
- Sandbag movements are prefixed with `SB`
- **Double KB**: Use `@<weight>+<weight>` notation (e.g., `@24+24`)