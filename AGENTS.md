# AGENTS.md — jett.game AI Agent Context

> **Read this first.** This file is the authoritative guide for any AI agent working on this codebase.
> It supersedes all other documentation for build decisions and architectural rules.

---

## 🚨 MANDATORY SESSION START — NON NEGOTIABLE

Every session, every agent, every time. No exceptions:

```bash
git fetch --all && git pull origin main
git branch -r
find src/ -type f -name "*.ts" | sort
```

Do not touch any file until all 3 commands are confirmed complete.
Do not declare any game or file missing until step 3 is complete.
This rule exists because skipping it caused wrong audits and wasted tokens.

---

## 🚨 DEPLOYMENT & GIT ACCESS — CRITICAL

**GitHub Access Token Required**

If git auth breaks locally (common), ask the user for a GitHub Personal Access Token (PAT):

```bash
# User: Go to https://github.com/settings/tokens
# Generate token with: repo + workflow scopes
# Copy token, give to agent
```

**Using the token to deploy:**
```bash
git push https://TOKEN@github.com/zero-934/jett-game.git main --force
```

**Current token:** See TOOLS.md (expires May 16, 2026)

**Deployment Rules (CRITICAL — May 14, 2026 incident)**

1. **NEVER manually push to gh-pages branch** — conflicts with GitHub Actions
2. **Use ONE deployment method only** — GitHub Actions → GitHub Pages, NOT Vercel + Pages
3. **Always uninstall conflicting CI/CD** — Vercel auto-deploy was silently blocking all checks
4. **Force-push resets work** — if deployment gets corrupted, reset to last known good commit + force-push

**If deployment is stuck:**
1. Check GitHub Actions workflow status
2. Verify GitHub Pages source is set to "GitHub Actions" (Settings → Pages)
3. Delete gh-pages branch if it exists (conflicts with Actions)
4. If nothing works, reset to last deployed commit and force-push

**Backup repos before major resets:**
```bash
git clone https://github.com/zero-934/jett-game.git jett-game-backup-YYYY-MM-DD
```

---

## 📁 REPO STRUCTURE

**ACTIVE — build here only:**
- `zero-934/jett-game` → game engine, source of truth
- `zero-934/jett-landing` → React lobby shell

**ARCHIVE — never build here:**
- `zero-934/volt-casino-backup` → read only
- `zero-934/jett-landing-backup` → read only

---

## What Is This Project?

**jett.game** is a mobile-first web casino game platform built with Phaser 3 + TypeScript + Vite.
It is a collection of individual skill-based betting games, each with a cash-out mechanic.
The live site deploys to **GitHub Pages** from the `main` branch via GitHub Actions.

- **Live URL:** https://zero-934.github.io/jett-game/
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
| Deploy | GitHub Pages (auto-deploy on push to `main` via Actions) |

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

| Game | Scene Key | Category |
|------|-----------|----------|
| **Jett** | `JettScene` | Skill |
| **Glass Tile** | `GlassTileScene` | Skill |
| **Flap Fortune** | `FlapFortuneScene` | Skill |
| **Mines** | `MinesScene` | Chance |
| **Ball Drop** | `BallDropScene` | Chance |
| **Dice** | `DiceScene` | Chance |
| **Dice Duel** | `DiceDuelScene` | Chance |
| **Surge** | `SurgeScene` | Slots |
| **Inferno** | `InfernoScene` | Slots |
| **The Alchemist** | `AlchemistScene` | Slots |
| **Midnight Masquerade** | `MasqueradeScene` | Slots |
| **Doom Crash** | `DoomCrashScene` | Deferred — do not touch |

---

## UITheme.ts Rules (CRITICAL)

`UITheme.ts` lives at `src/shared/ui/UITheme.ts`.
It provides shared button drawing and color constants for all games.

**CORRECT usage:**
- Call `drawButton()` which returns `{ bg, text }`
- Wire events on `bg` only — never on a Container or Text
- Example: `const { bg, text } = drawButton(...); bg.on('pointerdown', handler);`

**WRONG usage that breaks games:**
- ❌ Never call `setInteractive()` on a `Container`
- ❌ Never call `setInteractive()` on a `Text` object
- ❌ Never duplicate `drawButton` locally inside a UI file
- ❌ Never multiply color constants (`COLOR_GOLD * 1.1` is not a valid color)

**When UITheme breaks a game the fix is always:**
1. Replace local button code with `UITheme.drawButton()`
2. Move event wiring from the Container/Text to the returned `bg` Graphics

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

## 💰 Cost Rules

- **Gemini handles all file writes**, renames, deletes, boilerplate
- **Claude reviews PRs and architecture only**
- Never read a file twice in the same session
- Never re-audit what was already audited this session
- Batch all file operations into single tool calls
- Do not explain code unless asked
- One confirmation per task — not per file

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
│   │   ├── DiceDuelScene.ts
│   │   ├── MinesScene.ts
│   │   ├── BallDropScene.ts
│   │   ├── SurgeScene.ts
│   │   ├── InfernoScene.ts
│   │   ├── AlchemistScene.ts
│   │   ├── MasqueradeScene.ts
│   │   └── DoomCrashScene.ts      ← Deferred — do not touch
│   ├── games/
│   │   ├── JettLogic.ts / JettUI.ts
│   │   ├── ShatterStepLogic.ts / ShatterStepUI.ts
│   │   ├── FlapFortuneLogic.ts / FlapFortuneUI.ts
│   │   ├── DiceLogic.ts / DiceUI.ts
│   │   ├── DiceDuelLogic.ts / DiceDuelUI.ts
│   │   ├── MinesLogic.ts / MinesUI.ts
│   │   ├── BallDropLogic.ts / BallDropUI.ts
│   │   ├── SurgeLogic.ts / SurgeUI.ts
│   │   ├── InfernoLogic.ts / InfernoUI.ts
│   │   ├── AlchemistLogic.ts / AlchemistUI.ts
│   │   └── MasqueradeLogic.ts / MasqueradeUI.ts
│   ├── tests/
│   │   ├── JettLogic.test.ts
│   │   ├── ShatterStepLogic.test.ts
│   │   ├── FlapFortuneLogic.test.ts
│   │   ├── DiceLogic.test.ts
│   │   ├── DiceDuelLogic.test.ts
│   │   ├── MinesLogic.test.ts
│   │   ├── BallDropLogic.test.ts
│   │   ├── SurgeLogic.test.ts
│   │   ├── InfernoLogic.test.ts
│   │   ├── AlchemistLogic.test.ts
│   │   └── MasqueradeLogic.test.ts
│   └── shared/
│       ├── rng/
│       │   └── ProvablyFairRNG.ts ← xoroshiro128+ PRNG, Solana VRF-ready
│       ├── slot-engine/
│       │   ├── SlotEngineLogic.ts ← Pure TS slot engine (96% RTP, reel strips)
│       │   ├── SlotEngineUI.ts    ← Phaser renderer for slots
│       │   ├── SlotAnimator.ts    ← Shared reel animation (3-reel + 5-reel presets)
│       │   └── configs/
│       │       ├── masquerade.config.ts
│       │       └── alchemist.config.ts
│       ├── ui/
│       │   └── UITheme.ts         ← Shared colors, fonts, drawButton() — import in all UI files
│       └── audio/
│           ├── audioConfig.ts     ← C Major/G Major scales, 84 BPM base
│           ├── ShepardToneGenerator.ts ← 8-oscillator procedural climb
│           └── CasinoAudioManager.ts   ← onWin, onNearMiss, playSurgeRise
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
2. Host it (GitHub Pages `/public`, CDN, or IPFS for NFTs)
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

This project uses a **two-agent system** optimised for cost efficiency (~70–90% credit savings vs. Claude-only):

| Agent | Role | Uses |
|-------|------|------|
| **Claude Sonnet (AgentX)** | Architect · Reviewer · QA · Git | Specs, code review, integration, user comms |
| **Gemini 2.5 Flash** | Worker · Boilerplate Generator | High-volume tasks: 10k+ spin simulations, new file boilerplate, log analysis |

**Cost rule:** If a task is repetitive, high-volume, or templated — delegate to Gemini. Claude handles decisions, reviews, and fixes only.

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
5. Phaser 4 audio: use `this.sound.add(key, config)` only — no legacy Phaser 3 sound APIs.
6. Named constants for everything — no magic numbers inline.
7. All existing exports must remain — never remove or rename.
8. File header on **every** file — `@file`, `@purpose`, `@author Agent 934`, `@date`, `@license Proprietary`. No exceptions.
9. New public functions need JSDoc: `@param`, `@returns`, `@example`.
10. **Ethical audio constraint:** NEVER trigger celebratory audio on a net loss. Always check `if (winAmount > betAmount)` before playing win sounds. A spin that returns less than the bet is a loss — treat it as one.

---

## 🚨 CRITICAL ISSUE: Jett Coin Spawn Not Deploying (May 14, 19:18)

**Status:** UNRESOLVED - npm cache fix worked for Flap, but Jett coins still wrong

**Problem:**
- Changed `lastCoinSpawnAltitude: -150` to spawn coins at 150m
- Even test value `-50` (should be very early) did NOT deploy
- Coins STILL spawn at ~800m in deployed game

**What DID work today:**
- Flap Fortune HUD visibility fix ✅ (cache fix deployed this)
- Gravity fix ✅
- Text fixes ✅

**What DIDN'T work:**
- Jett coin spawn initialization ❌ (no value changes deploy)

**Why this is odd:**
- Same codebase
- Same workflow (cache disabled)
- Same git push process
- But Flap changes deploy, Jett changes don't

**Hypothesis for next session:**
- Coin spawn might be hardcoded elsewhere in codebase
- Runtime override happening somewhere
- Different cache for JettLogic specifically
- Value is being reset after initialization

**For Gemini/next agent:**
1. Search codebase: `grep -r "lastCoinSpawnAltitude" src/`
2. Check if coin spawning has separate logic path
3. Verify deployed bundle actually contains `-50` value
4. Check JettLogic.ts full tick logic for coin resets
5. May need to add debug logging to see what value is actually used at runtime

**Blocking issue:** Game is unpolished without early coin spawn. Coins at 800m feels too late for engagement.

