# AGENTS.md — jett.game AI Agent Context

> **Read this first.** This file is the authoritative guide for any AI agent working on this codebase.
> It supersedes all other documentation for build decisions and architectural rules.

---

## What Is This Project?

**jett.game** is a mobile-first web casino game platform built with Phaser 3 + TypeScript + Vite.
It is a collection of individual skill-based betting games, each with a cash-out mechanic.
The live site deploys to Vercel from the `main` branch.

- **Live URL:** https://dist-omega-henna.vercel.app
- **Repo owner:** zero-934 (GitHub)
- **Aesthetic:** Midnight Luxury — charcoal `#0d0d0d`, gold `#c9a84c`
- **Platform:** Mobile-first web (390×844 base, Phaser FIT scaling)

---

## Project Owner

The user who owns this project goes by **C Lee** (GitHub: zero-934).
They are a first-time developer. Be patient, thorough, and explain what you changed and why.
Never make breaking changes silently. Always summarise your work at the end.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Game engine | Phaser 3 (v4.x) |
| Language | TypeScript (strict mode) |
| Build tool | Vite |
| Test runner | Jest + ts-jest |
| Deploy | Vercel (auto-deploy on push to `main`) |

**Install deps:** `npm install`
**Dev server:** `npm run dev`
**Build:** `npm run build`
**Tests:** `npm test`

---

## Architecture — The 3-File Rule (MANDATORY)

Every game must be split into exactly 3 files:

```
src/games/<Name>Logic.ts     ← Pure TypeScript. NO Phaser imports. Game state, RNG, math.
src/games/<Name>UI.ts        ← Phaser rendering + input. Calls Logic only.
src/scenes/<Name>Scene.ts    ← Wires Logic + UI. Registered in Phaser game config.
```

### Why this matters
- `Logic.ts` files are **licensable standalone** — they can be sold/licensed independently
- `UI.ts` files can be swapped out without touching game logic
- This separation makes unit testing trivial (no Phaser mocking needed)

### Registering a new game
1. Create the 3 files
2. Import the Scene in `src/main.ts` and add it to the `scene: [...]` array
3. Add a card to `HomeScene.ts` in the `cards` array (with a `drawIcon` method)
4. Add a unit test file at `src/tests/<Name>Logic.test.ts`

---

## Games (current)

| Game | Scene Key | Description |
|------|-----------|-------------|
| **Jett** | `JettScene` | Vertical scroller — dodge asteroids, cash out before combustion |
| **Shatter Step** | `ShatterStepScene` | Ladder game — pick left or right, 50/50 each row |
| **Flap Fortune** | `FlapFortuneScene` | Horizontal scroller — flap through pipe gaps |
| **Dice** | `DiceScene` | Single-roll dice — pick 2×, 5×, or 10× odds |
| **Mines** | `MinesScene` | 5×5 grid — reveal safe tiles, avoid bombs |
| **Ball Drop** | `BallDropScene` | Peg-board drop — nudge mid-fall, edge slots pay ×5 |

---

## Code Standards (enforce strictly)

- **TypeScript strict mode** — `"strict": true` in tsconfig. No `any` without a comment.
- **File header comment** on every file:
  ```ts
  /**
   * @file <Name>.ts
   * @purpose ...
   * @author Agent 934
   * @date YYYY-MM-DD
   * @license Proprietary – available for licensing
   */
  ```
- **JSDoc on every public function:** `@param`, `@returns`, `@example`
- **Descriptive names:** `playerAltitude` not `pA`, `slotMultiplier` not `sm`
- **No magic numbers** — extract to named constants at the top of the file
- **Palette:** use `GOLD = 0xc9a84c` / `GOLD_STR = '#c9a84c'` — never hardcode gold hex inline

---

## House Edge Rules

- **RTP target: 97%** (3% house edge on all games)
- House edge must be applied in the Logic file, not the UI
- Every Logic file must have an RTP simulation function (e.g. `simulateJettRTP`)
- Tests must verify RTP is reasonable (not >100%, not <50% for standard play)

---

## Testing Rules

- Every `Logic.ts` file must have a corresponding `src/tests/<Name>Logic.test.ts`
- Tests run with Jest + ts-jest (headless, no Phaser)
- Test coverage must include:
  - State creation
  - Happy-path gameplay (win condition)
  - Loss condition
  - Payout/multiplier correctness
  - RTP simulation sanity check

---

## Git / PR Rules

- **Branch naming:** `feat/<game-name>` for new games, `fix/<description>` for bugs
- **PR title format:** `feat(<game-name>): initial prototype`
- **One game per PR**
- **Never push directly to `main`** — always via PR
- **PR body must include:** what was built, what tests pass, any known issues

---

## What NOT to Do

- ❌ Do NOT import Phaser into a `Logic.ts` file — ever
- ❌ Do NOT put game math/RNG in a `UI.ts` or `Scene.ts` file
- ❌ Do NOT use `console.log` debugging in committed code
- ❌ Do NOT change the Midnight Luxury colour palette without explicit instruction
- ❌ Do NOT modify `HomeScene.ts` structure — only add cards to the existing `cards[]` array
- ❌ Do NOT break existing games when adding new ones
- ❌ Do NOT push to `main` directly

---

## File Map

```
jett-game/
├── src/
│   ├── main.ts                    ← Phaser boot, scene registration
│   ├── scenes/
│   │   ├── HomeScene.ts           ← Game selection screen
│   │   ├── LockScene.ts           ← Auth gate (prototype lock)
│   │   ├── JettScene.ts
│   │   ├── ShatterStepScene.ts
│   │   ├── FlapFortuneScene.ts
│   │   ├── DiceScene.ts
│   │   ├── MinesScene.ts
│   │   └── BallDropScene.ts
│   ├── games/
│   │   ├── JettLogic.ts / JettUI.ts
│   │   ├── ShatterStepLogic.ts / ShatterStepUI.ts
│   │   ├── FlapFortuneLogic.ts / FlapFortuneUI.ts
│   │   ├── DiceLogic.ts / DiceUI.ts
│   │   ├── MinesLogic.ts / MinesUI.ts
│   │   └── BallDropLogic.ts / BallDropUI.ts
│   ├── tests/
│   │   ├── JettLogic.test.ts
│   │   ├── ShatterStepLogic.test.ts
│   │   ├── FlapFortuneLogic.test.ts
│   │   ├── DiceLogic.test.ts
│   │   ├── MinesLogic.test.ts
│   │   └── BallDropLogic.test.ts
│   └── shared/                    ← Shared utilities (if any)
├── public/                        ← Static assets
├── AGENTS.md                      ← YOU ARE HERE (AI agent guide)
├── AGENT_RULES.md                 ← Legacy rules (defer to AGENTS.md)
├── llms.txt                       ← LLM-optimised project summary
├── README.md                      ← Human-readable project overview
├── package.json
├── tsconfig.json
└── vite.config (implicit)
```

---

## Context Recovery Checklist

If you are an AI agent that lost context, do this in order:

1. Read `AGENTS.md` (this file) ✅
2. Read `AGENT_RULES.md` for original build rules
3. Run `npm test` to see current test status
4. Read `src/main.ts` to see all registered scenes
5. Read `src/scenes/HomeScene.ts` to see all game cards
6. Read any `Logic.ts` file to understand the coding style
7. Ask the user what they want to work on next

You are now fully oriented. Go build something great.
