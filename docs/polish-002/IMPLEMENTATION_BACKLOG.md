# JETT-POLISH-002 — Implementation Backlog

**Effort:** XS < 2 h · S ≤ 1 d · M 2–3 d · L ≈ 1 wk.

**Review boundary:**
- **Isolated** — one game's files only.
- **Shared** — touches `src/shared/**` or config used by other games. Needs the full-suite + 13-scene smoke gate.
- **[GAMEPLAY]** — changes difficulty, outcome mapping or payout. Needs product sign-off before merge.

Every item keeps Logic files Phaser-free and preserves existing exports.

---

## Phase 0 — Safety nets (do first)

### B-00 CI test gate · S · Shared (CI)
- **Files:** new `.github/workflows/test.yml` (on `pull_request`, Node 20 and 22, `npm ci && npm test`, `timeout-minutes: 15`); optionally make `deploy.yml` require it.
- **Depends on:** B-01 (otherwise BallDrop and Masquerade time out).
- **Acceptance:** PRs show a test status; the deploy workflow is unchanged unless the owner approves.
- **Note:** do **not** trigger `deploy.yml` while testing; run workflows only on PR branches.

### B-01 RNG v2: 64-bit masked xoroshiro128+ · M · Shared · touches all games
- **Files:** `src/shared/rng/ProvablyFairRNG.ts` (adopt `research/patches/ProvablyFairRNG.masked.ts`); `src/tests/ProvablyFairRNG.test.ts` (add known-answer vectors from a reference implementation, bounded-state test, round-trip test).
- **Depends on:** owner decision for `src/tests/InfernoLogic.test.ts` #8 and `src/tests/SurgeLogic.test.ts` #6. Either pin them with `{version: 1}` or re-select seeds.
- **Acceptance:**
  - full `npm test` < 60 s, all green
  - state ≤ 64 bits after 10⁵ calls
  - adjacent-ms seeds produce distinct first values
  - `getState`/`setState` round-trip
  - public API unchanged
- **Risk:** every game's sequences change. Any externally recorded seeds become invalid (none found in-repo).

### B-02 Promote characterization tests · S · Isolated (tests only)
- **Files:** copy non-defect tests from `research/characterization/*.char.test.ts` into `src/tests/`. Keep `[CURRENT-DEFECT]` tests under `research/` until each fix lands, then invert and move them.
- **Acceptance:** `npm test` includes cash-out guards, tangency and determinism (Flap) tests.

### B-03 Correct unsupported RTP claims · XS · Shared (docs/tests)
- **Files:**
  - `src/tests/ShatterStepLogic.test.ts`: rename "~94–100% RTP" to "≈72.75% RTP (always-cashout)" and tighten bounds to 0.70–0.75.
  - `README.md`, `AGENTS.md`, `docs/rtp_documentation.md`, Logic file headers: remove 96%/97% claims for Jett, Flap and Shatter, or mark them unverified.
- **Acceptance:** no doc asserts an RTP that the tests don't demonstrate.

## Phase 1 — Correctness fixes, behaviour-preserving

### B-10 Jett: coin X from gameplay RNG · XS · Isolated · [GAMEPLAY-minor]
- **File:** `src/games/JettLogic.ts:208`. Replace `Math.random()` with `rng()`. The draw is appended at the coin-spawn step.
- **Acceptance:** `char: jett` "coin X uses Math.random()" inverted (same seed ⇒ same coins).
- **Note:** this shifts the gameplay stream after the first coin spawn, so outcomes for a given seed change. There are no recorded seeds today.

### B-11 Remove per-tick RNG construction · XS · Isolated ×3
- **Files:** `JettLogic.ts:159, 295`; `FlapFortuneLogic.ts:116, 201`; `ShatterStepLogic.ts:89`. Use a lazily created module-level fallback instance.
- **Acceptance:** identical results with an injected RNG; Flap per-tick cost drops (re-run `char: flap` timing).

### B-12 Scene shutdown wiring · XS · Isolated ×3
- **Files:** `src/scenes/{Jett,FlapFortune,ShatterStep}Scene.ts`. Add `this.events.once(Phaser.Scenes.Events.SHUTDOWN, …)` in `create()`.
- **Acceptance:** `scene.start('HomeScene')` from a game releases its timers and audio (extend `probe: restarts`).

### B-13 UI cleanup owns its listeners and arrays · S · Isolated ×3
- **Files:** `JettUI.ts`, `FlapFortuneUI.ts`, `ShatterStepUI.ts` (named handlers, `off()` in `cleanup()`, reset `stars`/pools, round token).
- **Acceptance:** `probe: restarts` `sameInstanceTwice` listeners = 1 and stars = base count.

### B-14 Jett audio ownership · S · Shared (`CasinoAudioManager`) or Isolated (if switched to `this.sound`)
- **Files:** `JettUI.ts:61`; `src/shared/audio/CasinoAudioManager.ts` (singleton accessor + `init()` on the first gesture).
- **Acceptance:** 50 restarts ⇒ ≤ 1 AudioContext created; coin chime audible on an Android Chrome device after GO (manual check).

### B-15 Jett settlement UI coherence · S · Isolated
- **Files:** `JettUI.ts`:
  - disable CASH OUT synchronously in `onTick` when `!isAlive`
  - `handleCashOut` returns early unless `payout > 0 && state.cashedOut`
  - a single `showResults()` guarded by a settled flag
  - CASH OUT disabled until GO
- **Acceptance:** `probe: jett` after fix → before GO: no settlement; combustion window: no "PAID OUT 0.00"; exactly 1 PLAY AGAIN.

### B-16 Flap input: edge-triggered flaps; Space starts; no auto-repeat · S · Isolated
- **File:** `FlapFortuneUI.ts:210–222`. Queue a flap on down (counter or array consumed per tick); never clear on up; `addKey(SPACE)` + `JustDown`; Space clears `waitingToStart`.
- **Acceptance:** `probe: flap` → quick tap ⇒ −7.05; Space starts; held Space ⇒ 1 flap.

### B-17 Input zones / HUD propagation · S · Isolated ×2
- **Files:** `JettUI.ts:303–306` (steer only from pointers over the playfield, not HUD); `FlapFortuneUI.ts` (ignore pointerdown whose `currentlyOver` includes a HUD/nav object); Scenes' back-arrow handlers call `event.stopPropagation()`.
- **Acceptance:** tapping CASH OUT or back does not alter `pointerX` or flap.

### B-18 Shatter Step: truthful reveal · M · Isolated · [GAMEPLAY: outcome mapping]
- **Files:**
  - `ShatterStepLogic.ts`: additive `createShatterBoard(rng, rows): TileSide[]`; `pickTile` accepts an optional `board` (existing signature still works).
  - `ShatterStepUI.ts`: generate the board at round start from the gameplay RNG; reveal `board[row]`; delete `Math.random()` at :382; replace the `_rng` LCG with the seeded gameplay RNG.
- **Acceptance:** after a loss, the chosen pane is always shown as wrong; the reveal matches the board; win probability per row still 0.5 (10⁵-round sim within ±0.5%).

### B-19 Make combustion floors explicit config · XS · Isolated ×2 · behaviour-preserving
- **Files:** `JettLogic.ts:257`, `FlapFortuneLogic.ts:176`. Add `combustionFloorPerTick?` with defaults 0.0008 and 0.0005 (unchanged).
- **Acceptance:** current tests unchanged; `char:` floor tests updated to show that floor 0 honours chance 0.

## Phase 2 — Shared foundation

### B-20 Fixed-step runner · M · Shared (new `src/shared/sim/FixedStepRunner.ts`)
- **Source:** `research/patches/FixedStepRunner.ts` + tests.
- **Then per game (Isolated):** replace `time.addEvent({delay:16})` with `runner.advance(this.game.loop.rawDelta)` in `Scene.update`; render once per frame; pause on HIDDEN/BLUR.
- **Depends on:** B-13, B-16.
- **Acceptance:**
  - `probe: pacing` warm and cold simSpeed 0.98–1.02 for 30/60/120/144 Hz, focused and unfocused
  - no repeated frames at 120 Hz with interpolation on
  - outcome tests unchanged (16 ms step kept)

### B-21 Tick-indexed input log + replay + checkpoint · M · Shared
- **Files:** `src/shared/sim/InputLog.ts`, `RoundRecord`/`Checkpoint` types, debug overlay showing the seed.
- **Depends on:** B-01, B-10, B-20.
- **Acceptance:** for each game: a recorded replay re-simulates to an identical settlement; checkpoint at tick N + replay = uninterrupted run.

### B-22 Shared demo HUD / results / settings · L · Shared (new `src/shared/ui/DemoHud.ts`, `hudContract.ts`, `Settings.ts`, `DemoWallet.ts`)
- **Depends on:** B-15, B-17.
- **Acceptance:**
  - 44 px targets
  - contrast ≥ 4.5:1
  - reduced motion respected
  - `aria-live` mirror announces results
  - celebratory feedback only if payout > bet
  - credits labelled non-redeemable
  - Mines (an existing consumer of `GameHeader`/`GameFooter`) untouched

### B-23 Rendering resolution · M · Shared (`src/main.ts`, `index.html`) + Isolated layout edits ×3
- **Step 1 (XS):** remove `image-rendering: pixelated`; `height: 100dvh`; `viewport-fit=cover`.
- **Step 2 (M):** logical-size constants + camera zoom ×min(DPR, 2) + `Text.setResolution`.
- **Acceptance:** DPR 3 screenshot shows no stair-stepping on text (visual review); canvas.width ≥ 780 at DPR ≥ 2; fps on the 4×-throttled harness not worse than −10%.

### B-24 Self-host fonts and await load · S · Shared
- **Files:** `index.html`, `src/main.ts` (`@fontsource/inter`, `@fontsource/fredoka`; `document.fonts.load` before `new Phaser.Game`).
- **Acceptance:** no requests to fonts.googleapis.com; HUD text rendered in Inter on first frame.

### B-25 Code-split per game · S · Shared (`src/main.ts`)
- **Acceptance:** build shows separate chunks; lobby → game loads ≤ 400 kB gzip.

## Phase 3 — Visual Direction A (after review)

| ID | Item | Files | Effort | Boundary |
|---|---|---|---|---|
| B-30 | Bake static layers to textures (Jett stars/grid, Flap castle) + TileSprite parallax | `JettUI.ts`, `FlapFortuneUI.ts` | M | Isolated |
| B-31 | Atlas pipeline (`scripts/build-atlas.mjs` with sharp + free-tex-packer-core); `ASSET_LEDGER.md` + CI check | new scripts, `public/assets` | M | Shared (build) |
| B-32 | Jett Direction A art + particles (thruster, coin ring, combustion) | `JettUI.ts` | M | Isolated |
| B-33 | Flap Direction A art; gate art width = hitbox (R-COL-1) | `FlapFortuneUI.ts`, export `GATE_HITBOX_W` from Logic | M | Isolated |
| B-34 | Shatter Direction A panes, ladder preview, shard particles | `ShatterStepUI.ts` | M | Isolated |
| B-35 | Audio pass via Phaser Sound (Kenney CC0 + self-made) | 3 UIs + shared SFX map | M | Shared (audio) |
| B-36 | Phaser 4.0.0 → 4.2.1 upgrade | `package.json`, lockfile | S | Shared (13 scenes smoke) |

## Phase 4 — Product decisions required (no code until decided)

| ID | Decision | Evidence |
|---|---|---|
| D-1 | Jett early cash-out below stake (0.9711×): disable CASH OUT until ≥1.00× or show as loss? | R-CASH-2 |
| D-2 | Shatter Step economics: keep ×1.5 (max RTP 72.75%) or redesign? | R-CLAIM-1 |
| D-3 | Remove numeric RTP claims for skill games? | R-CLAIM-2 |
| D-4 | Jett horizontal speed cap / swept collision | R-INPUT-4 |
| D-5 | Jett duplicate wave band fix (changes density) | R-COL-3 |
| D-6 | Same-tick cash-out precedence (pre-tick multiplier) | ENGINEERING_SPEC §5 |
| D-7 | RNG v2 handling of Inferno/Surge seed-pinned tests | R-RNG-3 |

## Representative review segments (one per game)

Use these as the acceptance walkthrough for every phase, recorded with the harness (seeded, stepped) and on one real phone.

1. **Jett** (seed `review-jett-01`, 60 Hz):
   - Ready → tap GO.
   - Steer to the centre and collect the first coin (≈ tick 520, altitude 650–700).
   - Dodge the first two asteroid waves.
   - CASH OUT at ≥ 1.20×; result card shows the payout once.
   - PLAY AGAIN; verify a fresh round (altitude 0, listeners 1, AudioContexts unchanged).
2. **Flap Fortune** (seed `review-flap-01`):
   - Ready → Space (or tap) starts with a flap.
   - Traverse 3 gates with quick taps (every flap registers).
   - Exit-open band appears after gate 1.
   - Dive below the line → "ESCAPED" with the gate-3 multiplier.
   - PLAY AGAIN.
3. **Shatter Step** (seed `review-shatter-01`):
   - Pick row 1 (win) and row 2 (win); the ladder preview highlights the next multiplier.
   - Row 3: pick and lose → the chosen pane shatters and the reveal shows it as wrong; remaining rows come from the pre-committed board.
   - PLAY AGAIN → new board; win twice and CASH OUT (status shows once; tiles locked).
