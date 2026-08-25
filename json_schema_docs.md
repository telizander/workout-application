# Stallone Bridge Program - JSON Schema Documentation

**Version:** 1.0  
**Last Updated:** 2025-11-04

---

## Overview

This document describes the JSON format for workout programs that load into the Stallone Bridge application. The format is designed to be both human-readable and LLM-compatible for easy program generation.

---

## File Structure

The workout data file must be named `current.json` and placed in the same directory as `index.html`.

### Root Structure

```json
{
  "program": {
    "title": "PROGRAM NAME",
    "subtitle": "PROGRAM DESCRIPTION",
    "weeks": {
      "WEEK_NUMBER": { ... }
    }
  }
}
```

---

## Schema Definition

### 1. Program Object

**Required Fields:**
- `title` (string): Main program title (displayed in header)
- `subtitle` (string): Program subtitle/description
- `weeks` (object): Container for week objects

**Optional Fields:**
- `notes` (string): Program-wide guidance — how to run the block, load ceilings,
  autoregulation rules. Rendered as a "PROGRAM NOTES" panel at the top of the
  selection view. The panel is hidden entirely when this field is absent.

**Example:**
```json
{
  "program": {
    "title": "STALLONE BRIDGE",
    "subtitle": "6-WEEK MULTI-TOOL PREPARATION",
    "notes": "Hold primary lifts at tested ceiling. Do not chase progression.",
    "weeks": { ... }
  }
}
```

---

### 2. Week Object

**Key:** String representing week number (e.g., "5", "6", "1")

**Required Fields:**
- `phase` (string): Phase description for this week
- `goal` (string): Training goal/focus for this week
- `days` (array): Array of day objects

**Example:**
```json
"5": {
  "phase": "FULL INTEGRATION + SKILL MASTERY",
  "goal": "Fluid tool transitions, rope flow competency, 100lb sandbag introduction, peak readiness",
  "days": [ ... ]
}
```

---

### 3. Day Object

**Required Fields:**
- `day` (number): Day number (1-7)
- `name` (string): Workout session name
- `blocks` (array): Array of block objects

**Example:**
```json
{
  "day": 1,
  "name": "Power Integration",
  "blocks": [ ... ]
}
```

---

### 4. Block Object

**Required Fields:**
- `header` (string): Block identifier following notation rules
- `exercises` (array): Array of exercise strings

**Optional Fields:**
- `label` (string): Override display label (used when header differs from display)
- `note` (string): Additional context or instructions

**Example:**
```json
{
  "header": "5A90s",
  "exercises": [
    "KB Snatch 5'@24",
    "Ring Dip 6-10@BW"
  ]
}
```

**With Optional Fields:**
```json
{
  "header": "FIN",
  "label": "3D90s",
  "note": "Week 5 variant",
  "exercises": [
    "Mace360 8'@10",
    "RopeFlow :60@BW"
  ]
}
```

---

## Exercise Notation Rules

All exercises must follow the standardized notation format:

### Basic Pattern
```
<Movement Name> <reps/time>@<weight>
```

### Notation Elements

#### Reps and Time
- `5` = 5 reps total
- `5'` = 5 reps each side/direction
- `:30` = 30 seconds (always use `:` prefix for time)
- `:30'` = 30 seconds each side/direction

#### Weight Notation
- `@24` = 24 kilograms
- `@BW` = Bodyweight
- `@+10` = Weighted (+10kg added)
- `@-10` = Assisted (-10kg assistance)
- `@24+24` = Double kettlebell (24kg each)

#### Movement Prefixes
- `KB` = Kettlebell
- `SB` = Sandbag
- No prefix = Standard movement (e.g., "Ring Dip", "Pull-up")

### Exercise Examples

```json
"exercises": [
  "KB Snatch 5'@24",           // KB snatch, 5 reps each side, 24kg
  "Ring Dip 10@BW",            // Ring dips, 10 reps, bodyweight
  "SB Shouldering 4'@75",       // Sandbag shouldering, 4 each side, 75kg
  "KB Swing 15@24+24",         // Double KB swing, 15 reps, 24kg each
  "RopeFlow :60@BW",           // Rope flow, 60 seconds, bodyweight
  "Pull-up 8@+15",             // Weighted pull-ups, 8 reps, +15kg
  "Ring Row 12@BW",            // Ring rows, 12 reps, bodyweight
  "Mace360 8'@10",             // Mace 360s, 8 each direction, 10kg
  "Rest :30"                   // Rest period, 30 seconds
]
```

---

## Block Header Notation

### Format
```
<rounds><block><rest>
```

- **Rounds:** Number (1-9)
- **Block:** Letter (A-Z)
- **Rest:** Time in seconds (no colon)

### Special Headers
- `WU` = Warm-up (displays with blue theme)
- `FIN` = Finisher (displays with green theme)
- All others = Work blocks (display with orange theme)

### Examples
- `5A90s` = 5 rounds, block A, 90 seconds rest
- `4B120s` = 4 rounds, block B, 120 seconds rest
- `3C60s` = 3 rounds, block C, 60 seconds rest
- `WU` = Warm-up block
- `FIN` = Finisher block

---

## Complete Example

```json
{
  "program": {
    "title": "STALLONE BRIDGE",
    "subtitle": "6-WEEK MULTI-TOOL PREPARATION",
    "weeks": {
      "5": {
        "phase": "FULL INTEGRATION + SKILL MASTERY",
        "goal": "Fluid tool transitions, rope flow competency, 100lb sandbag introduction",
        "days": [
          {
            "day": 1,
            "name": "Power Integration",
            "blocks": [
              {
                "header": "WU",
                "exercises": [
                  "RopeFlow :150@BW"
                ]
              },
              {
                "header": "5A90s",
                "exercises": [
                  "KB Snatch 5'@24"
                ]
              },
              {
                "header": "4B90s",
                "exercises": [
                  "Ring Dip 6-10@BW"
                ]
              },
              {
                "header": "FIN",
                "label": "3C90s",
                "exercises": [
                  "Mace360 8'@10",
                  "RopeFlow :60@BW"
                ]
              }
            ]
          },
          {
            "day": 2,
            "name": "Lower Body Focus",
            "blocks": [
              {
                "header": "WU",
                "exercises": [
                  "RopeFlow :120@BW",
                  "Hip Mobility :90@BW"
                ]
              },
              {
                "header": "5A120s",
                "note": "Focus on form",
                "exercises": [
                  "SB Clean + Squat 8@75"
                ]
              }
            ]
          }
        ]
      },
      "6": {
        "phase": "FULL INTEGRATION + SKILL MASTERY",
        "goal": "Peak readiness for 13-week program",
        "days": [
          {
            "day": 1,
            "name": "Power Integration",
            "blocks": [
              {
                "header": "WU",
                "exercises": [
                  "RopeFlow :150@BW"
                ]
              }
            ]
          }
        ]
      }
    }
  }
}
```

---

## Validation Rules

### Required Validations
1. ✅ File must be named `current.json`
2. ✅ Must have root `program` object
3. ✅ Must have `title`, `subtitle`, and `weeks` in program
4. ✅ Each week must have `phase`, `goal`, and `days`
5. ✅ Each day must have `day` (number), `name`, and `blocks`
6. ✅ Each block must have `header` and `exercises` array
7. ✅ Exercises array cannot be empty

### Recommended Validations
- Week numbers should be sequential or logical
- Day numbers should be 1-7
- Exercise notation should follow standard format
- Block headers should follow notation rules
- Time values should use `:` prefix (`:60` not `60`)

---

## Common Mistakes to Avoid

### ❌ Wrong
```json
{
  "header": "5A90",  // Missing 's' for seconds
  "exercises": [
    "KB Snatch 5@24'",  // Wrong order: '@' before '''
    "RopeFlow 60@BW"    // Missing ':' for time
  ]
}
```

### ✅ Correct
```json
{
  "header": "5A90s",
  "exercises": [
    "KB Snatch 5'@24",
    "RopeFlow :60@BW"
  ]
}
```

---

## LLM Generation Instructions

When generating workout JSON programmatically:

### 1. Structure First
```
- Start with program wrapper
- Add all weeks as keys
- Fill in phase/goal for each week
- Add days array for each week
```

### 2. Exercise Notation
```
- Always use ' for each side/direction
- Always use : for time
- Always use @ for weight
- Follow prefix rules (KB, SB)
- Default to @BW for bodyweight
```

### 3. Block Headers
```
- Work blocks: <number><letter><rest>s (e.g., "5A90s")
- Special blocks: "WU" or "FIN"
- Optional label for custom display
```

### 4. Validation
```
- Verify all required fields present
- Check notation consistency
- Ensure arrays not empty
- Validate time format (:XX not XX)
```

---

## Extension Examples

### Adding a New Week

```json
"7": {
  "phase": "DELOAD WEEK",
  "goal": "Active recovery and skill refinement",
  "days": [
    {
      "day": 1,
      "name": "Light Flow",
      "blocks": [
        {
          "header": "WU",
          "exercises": ["RopeFlow :180@BW"]
        },
        {
          "header": "3A60s",
          "exercises": [
            "KB Halo 8'@8",
            "Mace360 5'@10"
          ]
        },
        {
          "header": "FIN",
          "exercises": ["RopeFlow :120@BW"]
        }
      ]
    }
  ]
}
```

### Adding Complex Exercises

```json
{
  "header": "4A90s",
  "exercises": [
    "KB Clean + Press 5@24+24",
    "Mace Flow 5'@10: 360 → Pressout → Pendulum",
    "KB Farmer Walk 60 steps@24+24",
    "Rest :30"
  ]
}
```

### Adding Notes

```json
{
  "header": "5A120s",
  "note": "Focus on explosive hip extension",
  "exercises": [
    "KB Snatch 6'@24",
    "Rest :45"
  ]
}
```

---

## Testing Your JSON

### Quick Validation Checklist

- [ ] File named `current.json`
- [ ] Valid JSON syntax (use validator like jsonlint.com)
- [ ] All required fields present at each level
- [ ] Exercise notation follows rules
- [ ] Block headers follow format
- [ ] No empty arrays
- [ ] Consistent use of `'` for each side
- [ ] Consistent use of `:` for time
- [ ] Consistent use of `@` for weight

### Testing Process

1. Validate JSON syntax online (jsonlint.com)
2. Check against schema requirements
3. Place in app directory as `current.json`
4. Load application in browser
5. Check browser console for errors
6. Verify all weeks/days appear correctly
7. Test clicking through all workouts

---

## Troubleshooting

### Application Shows "Error loading workout data"
- Check that file is named exactly `current.json`
- Verify JSON syntax is valid
- Check browser console for specific error
- Ensure file is in same directory as index.html

### Week or Day Not Appearing
- Verify week number is string ("5" not 5)
- Check day number is number (1 not "1")
- Ensure all required fields present

### Exercise Display Issues
- Check notation follows rules exactly
- Verify `'` is used for each side
- Verify `:` is used for time
- Ensure `@` is used for weight

---

## Quick Reference Card

### Notation Cheatsheet
```
REPS:     5, 5', 10, 8-12
TIME:     :30, :60, :90, :120
WEIGHT:   @24, @BW, @+10, @-10, @24+24
PREFIX:   KB, SB, (none for standard)
BLOCK:    5A90s, 4B120s, WU, FIN
```

### Minimal Valid Structure
```json
{
  "program": {
    "title": "PROGRAM NAME",
    "subtitle": "DESCRIPTION",
    "weeks": {
      "1": {
        "phase": "PHASE NAME",
        "goal": "GOAL DESCRIPTION",
        "days": [
          {
            "day": 1,
            "name": "DAY NAME",
            "blocks": [
              {
                "header": "WU",
                "exercises": ["RopeFlow :60@BW"]
              }
            ]
          }
        ]
      }
    }
  }
}
```

---

## Version History

- **1.0** (2025-11-04): Initial schema documentation

---

**For questions or issues, refer to the style guide and example files in the repository.**