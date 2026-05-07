# SUMMIT RUSH — GAME DESIGN DOCUMENT

**File:** docs/games/SummitRush_concept.md
**Status:** Designed, not yet built. Build after beta 5 games complete.

---

## Overview

- **Game Name:** Summit Rush
- **Scene Key:** `SummitRushScene`
- **Files:** `SummitRushLogic.ts` / `SummitRushUI.ts` / `SummitRushScene.ts`
- **Category:** SKILL

---

## Origin

Inspired by the **Acey High** rope-pulling arcade machine discovered during real-world casino research at Roundhouse Park, Toronto. Translated directly into a mobile-first crash game mechanic.

---

## Core Mechanic

Player alternates tapping the left and right side of the screen to simulate rope-pulling climbing motion. Tap speed **directly and genuinely** affects climb rate and multiplier velocity. Faster tapping = faster climbing = higher multiplier potential.

This is a **genuine, measurable skill layer.**

`ProvablyFairRNG` triggers an inevitable avalanche terminal event ending the session regardless of player skill. Player can cash out anytime before the avalanche hits.

---

## Gameplay Loop

1. Player places bet
2. Player taps **CLIMB** to start
3. Player alternates left/right taps rapidly
4. Character climbs dark mountain
5. Multiplier climbs in real time based on altitude
6. Storm clouds build visibly as player climbs higher — visual tension
7. Player decides when to cash out
8. RNG avalanche hits → game over

---

## Skill Layer — Legal Argument

- Tap speed genuinely and measurably affects climb rate and multiplier velocity
- Better players statistically reach higher multipliers
- Avalanche is certified provably fair RNG — inevitable but unpredictable timing
- Skill influences but cannot prevent the terminal event
- Identical legal classification to arcade redemption games
- **Classifies as: Interactive Risk Management Gaming**

---

## Visual Design

- **Aesthetic:** Midnight Luxury
- Dark jagged mountain silhouette against deep black night sky
- Gold stars clustered at summit
- Storm clouds (dark grey) building from the sides as multiplier climbs
- Small gold climber character with rope animation
- **Multiplier:** Large gold, top center — most prominent UI element
- **Cash Out button:** Top right, always visible
- Subtle parallax scrolling dark rock texture as player climbs

---

## Animations

- Climbing motion synced to tap alternation
- Multiplier pulses gold on each successful tap
- Storm clouds animate inward as multiplier climbs
- **Avalanche:** Dramatic white/grey particle cascade from top + screen shake
- **Cash Out:** Gold particle burst + satisfying chime

---

## House Edge

- **RTP: 96%**
- Avalanche timing: entirely `ProvablyFairRNG.ts`
- Skill affects multiplier velocity — **never** terminal event timing
- House edge mathematically guaranteed regardless of tap speed

---

## Architecture Requirements

- Strict AGENTS.md 3-file rule
- Never `Math.random()` — always `ProvablyFairRNG.ts`
- `simulateSummitRushRTP()` function required in Logic file
- Full Jest test suite: `src/tests/SummitRushLogic.test.ts`
- File headers: `@file` `@purpose` `@author Agent 934` `@date` `@license Proprietary`
- JSDoc on all public functions
- `GOLD = 0xc9a84c` — never hardcode
- `Container` has no `setOrigin()` in Phaser 4 — never call it
