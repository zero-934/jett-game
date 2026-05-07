# CIPHER WHEEL — GAME DESIGN DOCUMENT

**File:** docs/games/CipherWheel_concept.md
**Status:** Designed, not yet built. Build after beta 5 games complete.

---

## Overview

- **Game Name:** Cipher Wheel
- **Scene Key:** `CipherWheelScene`
- **Files:** `CipherWheelLogic.ts` / `CipherWheelUI.ts` / `CipherWheelScene.ts`
- **Category:** CHANCE

---

## Core Mechanic

When player taps **SPIN**, `ProvablyFairRNG` immediately determines the final outcome and stores it. When player taps **STOP**, only a cosmetic deceleration animation plays, landing precisely on the predetermined result.

> **The Stop button NEVER affects outcome under any circumstances.**

Maintains exact house edge while preserving skill feel.

---

## Segments

| Segment | Multiplier | Probability | Count |
|---------|-----------|-------------|-------|
| Standard | 1.5× | 35% | 12 |
| Double | 2× | 25% | 8 |
| High | 5× | 15% | 5 |
| Rare | 10× | 10% | 3 |
| Ultra | 25× | 5% | 2 |
| Legendary | 50× | 2% | 1 |
| **Cipher** | **100×** | **0.8%** | **1** |
| Void (loss) | 0× | 7.2% | 4 |

**Combined RTP: approximately 96%**

---

## Visual Design

- **Aesthetic:** Midnight Luxury
- Charcoal wheel background: `#0d0d0d`
- Gold segment borders: `#c9a84c`
- Segments progressively lighter toward rare outcomes
- Void segments: dark red `#1a0000`
- Gold pointer at top
- Wheel fills 80% of screen width
- Large gold SPIN / STOP button at bottom center

---

## Animations

- **Spinning:** Fast — 8 rotations per second
- **Deceleration:** Over 3–4 seconds
- **Landing:** Subtle bounce
- **2× and above:** Gold particle burst
- **25× and above:** Full-screen gold flash
- **Void:** Red flash, no celebratory sound

---

## The Cipher Segment

100× at 0.8% probability.

Instant viral moment when hit on stream. Named after the platform. Your marketing moment built directly into the game mechanics.

---

## Legal Classification

Perceived skill mechanic with mathematically guaranteed house edge. RNG seed published and player-verifiable. Fully compliant **Interactive Risk Management Gaming** classification.

---

## Architecture Requirements

- Strict AGENTS.md 3-file rule
- Never `Math.random()` — always `ProvablyFairRNG.ts`
- `simulateCipherWheelRTP()` function required in Logic file
- Full Jest test suite: `src/tests/CipherWheelLogic.test.ts`
- File headers: `@file` `@purpose` `@author Agent 934` `@date` `@license Proprietary`
- JSDoc on all public functions
- `GOLD = 0xc9a84c` — never hardcode
- `Container` has no `setOrigin()` in Phaser 4 — never call it
