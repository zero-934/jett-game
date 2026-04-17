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

- **RTP target: 96%** (4% house edge on all games)
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

- ❌ Do NOT use `Math.random()` directly — always use `ProvablyFairRNG` from `src/shared/rng/ProvablyFairRNG.ts`
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
│   └── shared/
│       ├── rng/
│       │   └── ProvablyFairRNG.ts ← xoroshiro128+ PRNG, Solana VRF-ready
│       └── slot-engine/
│           ├── SlotEngineLogic.ts ← Pure TS slot engine (96% RTP, reel strips)
│           ├── SlotEngineUI.ts    ← Phaser renderer for slots
│           └── configs/
│               ├── masquerade.config.ts
│               └── alchemist.config.ts
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

## Character System (NFT-Ready)

Characters are defined in `src/shared/`:

| File | Purpose |
|------|---------|
| `src/shared/CharacterDef.ts` | The `CharacterDef` interface — the universal character "socket" |
| `src/shared/characters.ts` | Central registry of all characters (one per game) |

### How it works
- Every game has a character entry in `characters.ts`
- Characters are currently **placeholders** (code-drawn in each UI file)
- When AI-generated art is ready: set `imageUrl` on the character — done
- When NFTs are ready: set `nftId` + `nftContractAddress` — done

### To swap a character for real art
1. Generate image (128×128 or 256×256 transparent PNG recommended)
2. Host it (Vercel `/public`, CDN, or IPFS for NFTs)
3. Open `src/shared/characters.ts`
4. Set `imageUrl` on the relevant character object
5. That's it — the game uses it automatically via `renderCharacter()`

### CharacterDef fields
```ts
{
  key: string                // unique Phaser texture key
  name: string               // display name
  imageUrl?: string          // AI art / NFT image URL (set when ready)
  fallbackDraw?: Function    // code-drawn placeholder renderer
  tint?: number              // palette swap tint (Phaser hex)
  nftId?: string             // NFT token ID (future)
  nftContractAddress?: string // NFT contract (future)
  walletAddress?: string     // owner wallet (future)
  meta?: Record<string, unknown> // design notes, traits, etc.
}
```

### AI Agent rule
- Do NOT hardcode character visuals deep in game logic
- Always check `CHARACTER_REGISTRY` before drawing a character
- New games must add an entry to `characters.ts`

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

---

## AI Agent Workflow (Multi-Agent Coding)

This project uses a **two-agent system**:

- **Primary agent (AgentX / Claude Sonnet)** — architect, reviewer, QA, git. Talks to the user. Never writes boilerplate from scratch.
- **Secondary agent (Gemini 2.5 Flash)** — writes boilerplate code from specs. Cheap and fast. Does NOT review its own output.

### The Workflow

```
User request → AgentX writes detailed spec → Gemini writes code → AgentX reviews & fixes → tests pass → PR → merge
```

**Step 1 — AgentX writes the spec for Gemini.**
The spec must include:
- Exact file names, export names, and TypeScript types
- A copy of every rule Gemini must not break (see Critical Rules below)
- Existing constants/interfaces to reuse (paste them verbatim)
- A list of what NOT to do (Gemini invents things if not constrained)
- Expected function signatures with JSDoc
- Output format instruction: "Output complete files only — no diffs, no truncation, no '// rest unchanged'"

**Step 2 — AgentX calls Gemini via the API.**
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
Key: stored in ~/.openclaw/.env as GEMINI_API_KEY
```
Use a JSON prompt file to avoid shell escaping issues. Max tokens: 65536.

**Step 3 — AgentX reviews Gemini output BEFORE writing any file.**
Common Gemini failure modes to check for:
- Rewrote the entire file instead of adding to it (destroys existing logic)
- Invented new RNG interfaces / types that don't exist in the codebase
- Called `spinMasquerade(state, Math.random)` instead of `spinMasquerade(state, config)`
- Called `Container.setOrigin()` (doesn't exist in Phaser 4)
- Left placeholder stubs instead of real code ("// implement later")
- Wrong import paths in test files
- Duplicate logic already handled elsewhere

**Step 4 — AgentX integrates the good parts.**
If Gemini's output is mostly correct: write the file.
If Gemini trashed existing code: surgically add only the new pieces to the existing working file using `edit`.
Never overwrite a working file with Gemini output without reading it line by line first.

**Step 5 — Tests + build must pass before commit.**
```bash
npm test       # all suites green
npm run build  # no TypeScript errors
```

**Step 6 — Branch + PR (mandatory).**
```bash
git checkout -b feat/<name>   # or fix/<name>
git add -A && git commit -m "feat(<scope>): description"
git push origin feat/<name>
gh pr create --title "..." --body "..." --base main --head feat/<name>
gh pr merge <number> --merge
git checkout main && git pull
```
**Never push directly to `main`.** Always via a named branch and PR.

### Critical Rules (paste these into every Gemini spec)
1. Logic files: ZERO Phaser imports. Pure TypeScript only.
2. UI files import from Logic — never the other way.
3. No `any` without a comment explaining why.
4. Phaser 4: `Container` does NOT have `setOrigin()`. Never call it.
5. Named constants for everything — no magic numbers inline.
6. All existing exports must remain — never remove or rename.
7. File header: `@file`, `@purpose`, `@author Agent 934`, `@date`, `@license Proprietary`
8. New public functions need JSDoc: `@param`, `@returns`, `@example`.
