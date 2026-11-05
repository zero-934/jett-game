# JETT-POLISH-002 — Risk Register

Scope: Jett, Flap Fortune and Shatter Step, plus the shared systems they consume. Commit `616fd82`.

**Severity:** S1 critical, S2 high, S3 medium, S4 low. **Likelihood:** L1 almost certain, L2 likely, L3 possible, L4 unlikely.

"Repro" points to a runnable artifact on this branch:
- `char:` = `npx jest --config research/jest.research.cjs <name>`
- `probe:` = `node research/probes/browser-dynamics.cjs <section>`, which needs `npx vite --port 5199`

---

## A. Determinism and replay

### R-DET-1 — Gameplay is not reproducible from a seed (S2, L1)
- **Evidence:**
  - Unseeded RNGs: `JettUI.start` calls `createRNG()` with a `Date.now()` seed, and `FlapFortuneUI` and `ShatterStepUI` do the same.
  - Jett coin X uses `Math.random()` (`JettLogic.ts:208`).
  - Shatter's reveal uses `Math.random()` (`ShatterStepUI.ts:382`).
  - No seed is displayed or logged.
- **Affected:** `src/games/JettLogic.ts`, `JettUI.ts`, `FlapFortuneUI.ts`, `ShatterStepUI.ts`
- **Repro:** `char: jett` → "coin X uses Math.random()" (same seed, different coin positions)
- **Mitigation:** per-round versioned seed record, `{ seedVersion, seed, configHash }`, created once in the Scene and passed into Logic. Separate gameplay and cosmetic streams (ENGINEERING_SPEC §3).
- **Regression test:** same seed + same tick-indexed actions ⇒ byte-identical final state JSON and payout (pattern in `fixedstep.char.test.ts`).
- **Depends on:** R-RNG-1 fix; fixed-step runner (R-TIME-1)
- **Residual uncertainty:** low

### R-DET-2 — No checkpoint or restore (S3, L1)
- **Evidence:**
  - `JettState.rng` is a function, so `JSON.stringify` drops it.
  - `ProvablyFairRNG` has no state export; `clone()` keeps state in memory only.
- **Repro:** `char: jett` "not JSON-serializable"; `char: rng` "no state export"
- **Mitigation:** keep the RNG outside state; add `getState()`/`setState()` (implemented in `research/patches/ProvablyFairRNG.masked.ts`); add checkpoint `{version, tick, state, rngState}`.
- **Regression test:** `fixedstep.char.test.ts` → "checkpoint … continues identically"
- **Residual uncertainty:** low

## B. Simulation timing and input integrity

### R-TIME-1 — Simulation pacing depends on display rate and focus (S2, L2)
- **Evidence:**
  - All three UIs drive simulation **and rendering** from `scene.time.addEvent({delay:16, loop:true})` (`JettUI.ts:169`, `FlapFortuneUI.ts:83`, `ShatterStepUI.ts:113`).
  - Phaser's Clock catches up multiple repeats per frame, so pacing is correct at steady 60 Hz.
  - TimeStep caps delta at 16.67 ms during its 120-frame cool-down and while unfocused. Measured:
    - 30 Hz cold: **0.58×** speed
    - 30 Hz unfocused: **0.50×** speed
    - 500 ms hitch: dropped, warm speed **0.91×**
    - 120/144 Hz: 48–57% of frames run **no tick**, and rendering sits inside the tick, so frames repeat (judder)
- **Repro:** `probe: pacing` → `evidence/browser-dynamics-pacing.json`
- **Practical impact:**
  - Low-end 30 Hz phones play in slow motion for the first ~4 s of every scene (each restart re-creates the scene, but the TimeStep cool-down applies at boot and resume).
  - Skill difficulty varies by device.
  - High-refresh phones see uneven motion.
  - Outcome math is unaffected (tick-based), but the skill/difficulty experience is not.
- **Mitigation:** an explicit fixed-step runner driven from `scene.update(time, delta)` using raw `game.loop.rawDelta`, not the smoothed delta. Add bounded catch-up, render interpolation, and a pause on hidden/blur (ENGINEERING_SPEC §1). Keep 16 ms (62.5 Hz) to avoid retuning.
- **Regression test:** `fixedstep.char.test.ts`: identical state across 30/60/120/144 Hz, jitter and hitch schedules. Browser: run `probe: pacing` again and assert `simSpeed ∈ [0.98, 1.02]` warm and cold, except where a hitch exceeds the catch-up cap.
- **Depends on:** none (pure TS)
- **Residual uncertainty:** medium. Real-device vsync behaviour (iOS ProMotion throttling, Android 90 Hz) is unmeasured.

### R-INPUT-1 — Quick tap loses the flap (Flap Fortune) (S2, L2)
- **Evidence:** a level flag `isFlapping` is set by `pointerdown` and cleared by `pointerup` (`FlapFortuneUI.ts:211–220`). Phaser dispatches pointer events immediately on the DOM event (`InputManager.onTouchStart`/`onMouseDown`), so a down and up between two 16 ms ticks cancel each other. Measured:
  - in play, velocity after a quick tap = **+2.25** (gravity only; no flap)
  - after a held tap = **−7.05** (flap applied)
  - the first tap starts the round **without** flapping (velocity +0.45)
- **Repro:** `probe: flap` → `quickTap`
- **Mitigation:** edge-triggered action queue: on `pointerdown`, push `{type:'flap'}` to the runner; never clear on up.
- **Regression test:** `fixedstep.char.test.ts` → "quick tap … retained"; browser: down+up without stepping, then 1 step ⇒ velocity −7.05
- **Residual uncertainty:** low

### R-INPUT-2 — Space cannot start Flap; key auto-repeat machine-guns flaps (S3, L2)
- **Evidence:**
  - The `keydown-SPACE` handler sets `isFlapping` but never clears `waitingToStart` (`FlapFortuneUI.ts:221`). Measured: after 30 frames held, `waitingToStart: true`.
  - With no `Key` object, Phaser's KeyboardPlugin emits `keydown-SPACE` on every OS repeat. Measured: 20/20 frames with a fresh flap while held.
- **Repro:** `probe: flap` → `spaceWhileWaiting`, `heldSpaceWithRepeat`
- **Mitigation:** `this.input.keyboard.addKey(SPACE)` and use `Phaser.Input.Keyboard.JustDown`, or ignore `event.repeat`. Route both pointer and Space through the same `start()`/`queue()` API.
- **Regression test:** browser: Space while waiting starts; held Space with repeats yields exactly one flap
- **Residual uncertainty:** low

### R-INPUT-3 — HUD and navigation taps leak into gameplay (S3, L2)
- **Evidence:**
  - **Jett:** global `pointerdown`/`pointermove` set the steering X for any tap, including the CASH OUT button. Measured: `pointerX` 195 → **318** after tapping CASH OUT.
  - **Flap:** global `pointerdown` means tapping the back arrow `‹` starts or flaps before navigation.
  - **Jett, before GO:** CASH OUT stays interactive behind the non-interactive start overlay. Measured: tap CASH OUT before GO ⇒ `cashedOut: true, payout: 10` and status "PAID OUT 10.00 credits". The overlay and GO button remain; GO then starts a tick timer on a settled round (`tickTimerRunningAfterGo: true`).
- **Repro:** `probe: jett` → `cashOutBeforeGo`, `pointerXAfterCashOutTap`; screenshot `evidence/screenshots/jett-cashout-before-go.png`
- **Mitigation:**
  - Gameplay input only from a dedicated full-screen gameplay hit zone below the HUD.
  - HUD objects call `event.stopPropagation()`, or input checks `currentlyOver`.
  - Phase gating: CASH OUT enabled only in `playing`.
- **Regression test:** browser: tap each HUD control ⇒ gameplay input unchanged; CASH OUT in `ready` ⇒ no settlement
- **Residual uncertainty:** low

### R-INPUT-4 — Jett horizontal teleport tunnels through asteroids (S3, L2)
- **Evidence:** the player X snaps to the pointer each tick (`JettLogic.ts:165`), and collision is tested only at the end position (`checkAsteroidCollision`). Swiping across an asteroid in one tick passes through it.
- **Repro:** `char: jett` → "horizontal teleport tunnels"
- **Mitigation:** cap horizontal speed per tick (for example 12 px/tick) or use swept circle-vs-circle along the segment. **Gameplay-affecting**, so needs a design sign-off.
- **Regression test:** tunnel test inverted
- **Residual uncertainty:** low

## C. Collision consistency

### R-COL-1 — Flap gate art is wider than its hitbox (S3, L1)
- **Evidence:** logic `pipeW = 30` (`FlapFortuneLogic.ts:238`) versus art `gateW = 34` (`FlapFortuneUI.ts:455`), with caps spanning `x−4 … x+w+4` (42 px). The visible cap overlaps the wizard by up to 4 px on the leading edge and 8 px on the trailing edge without a collision.
- **Repro:** `char: flap` → "gate artwork is wider"
- **Mitigation:** one shared `GATE_HITBOX_W` exported from Logic. The UI draws the body at the hitbox width and keeps decorative caps visually distinct (lighter, no collision implied), or the caps become part of the hitbox. **Changing the hitbox changes difficulty**, so prefer changing the art.
- **Regression test:** UI reads its widths from Logic exports; snapshot test of exported constants
- **Residual uncertainty:** low

### R-COL-2 — Jett player hitbox versus drawn sprite (S4, L1)
- **Evidence:** collision circle r = 12 × 0.8 = 9.6 at the body centre; the head is drawn at y−17 (radius 7) and the pack at x+8. Asteroid hitbox = 0.85 r, while the drawn polygon radius varies 0.72–1.0 r. A head clip produces no death; a hull edge sometimes kills with a visible gap.
- **Mitigation:** document the forgiveness; draw a debug overlay in a dev flag; align sprite art so its visual mass sits inside the hitbox.
- **Residual uncertainty:** medium (perception)

### R-COL-3 — Jett repeat spawn band (S3, L2)
- **Evidence:** `nextWaveY = ceil((highestY+1)/spacing)*spacing` (`JettLogic.ts:190`). When the highest asteroid of the last wave has negative scatter (`yOffset = (rng()−0.5)×40`, line 309), the same band is chosen again. Measured over 50 seeds: **≈18%** of waves land in an already-occupied 20-unit band (approximate metric). With a constant-low RNG, one duplicate wave spawns per tick.
- **Repro:** `char: jett` → "re-spawns the same wave band", "duplicate-band frequency"
- **Mitigation:** track `lastWaveBaseY` in state and compute the next wave from the unscattered base. **Changes hazard density**, so needs a pacing review.
- **Regression test:** no two waves share a base Y; wave count per 1,000 altitude within the designed range
- **Residual uncertainty:** low

## D. Cash-out and credit accounting

### R-CASH-1 — Jett combustion window allows a misleading "PAID OUT 0.00" and duplicate buttons (S2, L3)
- **Evidence:** `triggerCombustion` disables CASH OUT only after a 300 ms `delayedCall` (`JettUI.ts:672`). A tap inside the window runs `handleCashOut` → `cashOutJett` returns 0 (logic guard works). The UI then shows **"PAID OUT 0.00 credits"** and schedules a second PLAY AGAIN. Measured: status "PAID OUT\n0.00 credits", then 2 PLAY AGAIN buttons.
- **Repro:** `probe: jett` → `cashOutDuringCombustionWindow`; screenshot `jett-cashout-during-combustion.png`
- **Mitigation:**
  - The UI acts only on a settlement *result* object (`{settled:boolean, reason, payout}`).
  - Disable cash-out synchronously on any terminal state.
  - A single `showResults()` guarded by a settled-once flag.
- **Regression test:** cash-out after death ⇒ no payout text and exactly one results panel
- **Residual uncertainty:** low

### R-CASH-2 — Jett early cash-out pays below the stake (S3, L1)
- **Evidence:** the multiplier drops 1.0 → **0.9711** on tick 1 (`computeMultiplier` applies the 0.97 house factor to `1.1^(alt/100)`). Break-even is at altitude ≈ 32 (about 27 ticks, ~0.43 s). Cash-out at tick 1 pays 9.71 for a 10-credit bet, and the HUD shows "x0.97".
- **Repro:** `char: jett` → "multiplier drops below 1.0"; `probe: jett` → `firstTicks`
- **Mitigation:** product decision. Either (a) disable CASH OUT until multiplier ≥ 1.00, as Flap and Shatter effectively do, or (b) display it honestly as a loss. **Do not** silently change the curve.
- **Residual uncertainty:** none (it is a design question)

### R-CASH-3 — Cash-out before start (Jett) settles a round that never began (S3, L2)
- See R-INPUT-3. Logic returns the full bet. With demo credits there is no economic harm, but the round state is incoherent.

### R-CASH-4 — No credit ledger; bet is hard-coded (S3, L1)
- **Evidence:** `DEFAULT_BET = 10` in each Scene. Nothing debits or credits a balance. Payouts are display-only text.
- **Mitigation:** a demo-only `DemoWallet` (non-redeemable, local, resettable) with idempotent `settle(roundId, payout)` keyed by round ID (ENGINEERING_SPEC §6). No real-money integration.
- **Residual uncertainty:** low

## E. Ownership: restart, events, audio and memory

### R-OWN-1 — Jett leaks one AudioContext per round (S2, L1)
- **Evidence:** `private audioManager = new CasinoAudioManager()` (`JettUI.ts:61`) constructs an `AudioContext` in its constructor, and `destroy()` is never called. Measured: 50 restarts ⇒ **52 created, 0 closed**. `init()` is never called, so on browsers that start contexts suspended (mobile autoplay policy) **coin audio is likely silent**. That is unverified on device; headless Chrome autoplay policy differs.
- **Repro:** `probe: restarts`
- **Mitigation:** one app-level audio owner (prefer Phaser's `this.sound`, which already manages unlock and one context), or a singleton `CasinoAudioManager` resumed on the first gesture. UI `cleanup()` must release what it acquired.
- **Regression test:** 50 restarts ⇒ AudioContexts created ≤ 1
- **Residual uncertainty:** medium (device autoplay behaviour)

### R-OWN-2 — Scene `shutdown()` methods are never called by Phaser (S3, L1)
- **Evidence:** Phaser 4 `Systems.shutdown` only emits `Events.SHUTDOWN` (`node_modules/phaser/src/scene/Systems.js:772`). It never invokes a Scene method named `shutdown`. The three Scenes define `shutdown()` but never subscribe it. Cleanup happens only because the PLAY AGAIN handler calls `cleanup()` explicitly. Back navigation leaves the page entirely, which hides the issue.
- **Mitigation:** in `create()`: `this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.ui?.cleanup())`.
- **Regression test:** `scene.start('Other')` from a game scene ⇒ the UI's timers, audio and listeners are released
- **Residual uncertainty:** low

### R-OWN-3 — `UI.cleanup()` does not remove its own listeners or reset arrays (S4, L3)
- **Evidence:** calling `start()` twice on one instance gives 3× `pointerdown` (and 3× `keydown-SPACE` in Flap) and 3× stars. Normal scene restarts are **not** affected (Phaser clears scene input listeners). Measured in `probe: restarts` → `sameInstanceTwice`.
- **Mitigation:** register with named handlers and `off()` them in `cleanup()`; reset `stars` and similar arrays.
- **Residual uncertainty:** low

### R-OWN-4 — Stale delayed callbacks (S4, L3)
- **Evidence:** `delayedCall`s (Jett 300/600 ms, Shatter 180/900/1300 ms, flash 400 ms) capture `this` and run after state changes. Within a scene they can act on a settled or replaced state (R-CASH-1). Phaser clears them on scene shutdown.
- **Mitigation:** a round token (`roundId`) checked in every callback; use the scene-owned timeline.
- **Residual uncertainty:** low

## F. RNG correctness and predictability

### R-RNG-1 — `ProvablyFairRNG` is not xoroshiro128+ and grows without bound (S1 for any fairness claim, S2 for performance; L1)
- **Evidence:** `rotl` and `s1 << 16n` are never masked to 64 bits (`ProvablyFairRNG.ts:25–28, 104–105`). Measured:
  - s1 = 7,464 bits after the first call; 747,464 bits after 20,000 calls
  - cost 2.6 → 153 µs per call
  - output diverges from a masked reference at index 2
  - long-running test suites time out because of it
- **Repro:** `probe: rng-growth` (`research/probes/rng-growth.probe.ts`), `char: rng`
- **Practical impact in-game:** Jett and Flap create a new RNG per round, so a typical round (≲2,000 calls) costs ≲20 µs per call. That is acceptable today, but a marathon round degrades. Statistical quality is unknown because the algorithm is not a published generator.
- **Mitigation:** `research/patches/ProvablyFairRNG.masked.ts`:
  - masks all state to 64 bits
  - SplitMix64 seeding
  - uses the high 53 bits
  - adds `getState()`/`setState()`
  - keeps the public API intact
- **Regression test:** state ≤ 64 bits after 10k calls; known-answer vectors from a reference implementation; chi-square smoke check (`char: rng`)
- **Depends on:** R-RNG-3 coordination
- **Residual uncertainty:** low (the fix); medium (whether any external party already relies on the current sequence)

### R-RNG-2 — Predictable seeds (S2 for any future wagering; S4 for demo; L1)
- **Evidence:**
  - Seeds are `Date.now()`.
  - Consecutive-millisecond seeds yield near-identical first outputs (spread < 1e−3; `char: rng`).
  - Flap's first gate height is that first output, so it is nearly constant across sessions.
  - Shatter's UI LCG seeds from `Date.now()`, loses precision (`seed × 1664525 > 2^53`), and can return exactly 1.0.
- **Mitigation (demo):** seed from `crypto.getRandomValues` and record the seed. **Never** present client RNG as provably fair (see §M).
- **Residual uncertainty:** low

### R-RNG-3 — Fixing the shared RNG changes every game's sequences (S2, L1)
- **Evidence:** with the masked RNG substituted, Inferno test #8 ("flipCrown loses win on unlucky flip") and Surge test #6 ("surgeMeter increments on winning spin") fail. Those tests pin outcomes to specific seeds. 36 source files import the shared RNG, theme or audio.
- **Mitigation:**
  - Ship the fix as `ProvablyFairRNG` v2 behind `seedVersion`, or update those two tests to search for a seed that produces the required outcome.
  - Coordinate with the owner, since the affected games are out of scope.
  - Run the full suite (now ~45 s total) as a gate.
- **Residual uncertainty:** low

## G. Unsupported fairness, RTP and readiness claims

### R-CLAIM-1 — Shatter Step RTP is at most 72.75%, not 96–97% (S1 for claims, L1)
- **Evidence:** p = 0.5 per row and ×1.5 per row ⇒ stopping after k rows returns 0.75^k × 0.97. The maximum is k = 1, giving **72.75%**; go-to-top gives 5.46%. The existing test title says "~94–100% RTP", but its bounds are 0.60–2.0 and its own comment says ≈0.7275.
- **Repro:** `char: shatter` → "theoretical RTP is at most 72.75%"
- **Mitigation:** product decision. A 96% target at p = 0.5 needs about ×2 per row with a single 0.96 settlement factor (illustrated, **not** applied). Correct the test names and docs now.
- **Residual uncertainty:** none

### R-CLAIM-2 — Jett and Flap have no measurable RTP; skill play beats the house (S1 for claims, L1)
- **Evidence:** with perfect dodging, combustion alone gives expected return:
  - **Jett:** 1.00× at altitude 100, 1.50× at 1,000, peak **62×** at about 12,800
  - **Flap:** 1.02× after gate 1, peak **5.08×** after gate 55
  - Existing RTP tests use bounds 0.8–1.5 (Jett) and 0.3–3.0 (Flap) with hazards removed.
- **Repro:** `research/probes/skill-ev.probe.ts`; `logs/skill-ev.txt`
- **Practical impact:** the "96% RTP / 4% house edge" statements in AGENTS.md, README, `docs/rtp_documentation.md` and file comments are **unsupported** for these skill games. RTP depends on player skill and on automation (a bot reading the deterministic state could approach the bound).
- **Mitigation:** remove numeric RTP claims for Jett and Flap from demo-facing text. If a house edge is ever required, it must come from settlement math independent of skill (see §M), not from per-tick failure.
- **Residual uncertainty:** low for the bound; actual human RTP unmeasured

### R-CLAIM-3 — Combustion configuration is ignored (S3, L1)
- **Evidence:** floors `max(0.0008, …)` (Jett, `JettLogic.ts:258`) and `max(0.0005, …)` (Flap, `FlapFortuneLogic.ts:177`) override configured values, including 0. Flap's configured 0.0003 only matters after 14 gates.
- **Repro:** `char: jett`/`flap` → "combustion floor"
- **Mitigation:** make the floor an explicit config value (`combustionFloorPerTick`) with today's numbers as defaults, so behaviour is unchanged but honest.

### R-CLAIM-4 — Shatter Step reveal shows invented outcomes (S2, L2)
- **Evidence:** outcomes are rolled at pick time and the side picked has no effect (`ShatterStepLogic.ts:96`). After settlement, `revealAllTiles` colours every unplayed row, **including the row just lost**, using `Math.random()` (`ShatterStepUI.ts:382`). With the forced reveal, the player picked left, lost, and the shattered left tile is painted **green as "correct"**. In natural play this contradiction occurs on 50% of losses.
- **Repro:** `probe: shatter`; screenshot `evidence/screenshots/shatter-loss-reveal-contradiction.png`
- **Mitigation:** either pre-commit the board at round start (`safeSides[]` from the gameplay RNG, so picks are compared against it and the reveal is truthful) or remove the reveal. Pre-commitment is the honest design and matches player expectation. **This changes the outcome mapping**, though not the probabilities.
- **Residual uncertainty:** none

### R-CLAIM-5 — Asset and character registry is described as integrated but is not (S4, L1)
- **Evidence:** `assetConfig.ts`, `characters.ts` and `renderCharacter()` have **zero** consumers outside `src/shared`. `ASSET_MODE = 'placeholder'`. `public/assets` contains only a README. AGENTS.md says "set imageUrl … the game uses it automatically".
- **Mitigation:** either wire through a texture-key contract (ENGINEERING_SPEC §8) or mark it as not integrated.

## H. Performance and low-end mobile

### R-PERF-1 — Canvas renders at 1× on high-DPR screens, then CSS upscales with `pixelated` (S2 visual, L1)
- **Evidence:** backing store 390×844 at DPR 3 (3× upscale); `src/main.ts:30` `resolution` is ignored by Phaser 4; `index.html:34–35` `image-rendering: pixelated`. Screenshot: `ready-JettScene-dpr3.png`.
- **Mitigation:**
  - Short term: remove `pixelated`, a one-line CSS change; the output is softer but not blocky.
  - Proper fix: render at `LOGICAL × min(DPR, 2)` with camera zoom and a logical-coordinate contract, and `Text.setResolution`.
  - Fill cost rises up to 4×, so measure.
- **Regression test:** visual snapshot at DPR 3 with edge-sharpness threshold; canvas.width ≥ 780 at DPR ≥ 2
- **Residual uncertainty:** medium (fill-rate on low-end GPUs)

### R-PERF-2 — Full Graphics redraw per tick; draw cost scales with objects (S3, L2)
- **Evidence:**
  - Jett clears and redraws the background (130 stars + grid), every asteroid polygon and every coin each tick.
  - Flap redraws the entire castle background each tick.
  - Shatter's static board costs 3.2 ms p50 per frame on SwiftShader (47.7 fps).
  - At 4× CPU throttle, Jett active ran at 30 fps (p95 22.6 ms).
- **Mitigation:**
  - Pre-render static layers to textures (`generateTexture` / RenderTexture) or atlas images.
  - Use pooled Sprites/Images for asteroids and coins.
  - Use TileSprite for parallax.
  - Use Phaser particles for FX.
  - Render once per frame from interpolated state, not per tick.
- **Residual uncertainty:** high until measured on a device

### R-PERF-3 — Single 1.54 MB JS chunk (S3, L1)
- **Evidence:** the build output shows one chunk; gzip 399 kB.
- **Mitigation:** dynamic `import()` per scene; preload only the selected game.
- **Residual uncertainty:** low

## I. Accessibility and usability

### R-A11Y-1 — Small or low-contrast HUD; no settings, motion reduction or captions (S3, L1)
- **Evidence:**
  - Back arrow `‹`: a 22 px glyph with a hit box roughly the glyph size, under the WCAG 2.2 SC 2.5.8 minimum of 24×24 CSS px.
  - Flap HUD: 10–13 px monospace, and "DIVE TO CASH OUT" at 10 px.
  - Jett: muted #888 labels at 13 px on near-black.
  - There is no mute, reduced-motion, colour-blind or haptics setting. Camera flash on a Shatter max win; flicker effects.
  - Shatter relies on red versus green alone.
- **Mitigation:** shared HUD contract with 44 px targets, ≥ 14 px body text, 4.5:1 contrast, a settings sheet (sound, haptics, reduced motion, high contrast), non-colour cues (icons, patterns).
- **Residual uncertainty:** medium (no screen-reader story for canvas; see VISUAL_DIRECTIONS)

### R-A11Y-2 — Layout ignores safe areas and the dynamic toolbar (S3, L2)
- **Evidence:**
  - `index.html` `height: 100vh`, and the viewport meta has no `viewport-fit=cover`.
  - HUD positions are fixed constants (`SAFE_TOP = 48`, nav bar 36 px).
  - The Flap ceiling-death zone (y < 14) sits under the nav bar.
- **Mitigation:** `100dvh`, `viewport-fit=cover`, read `env(safe-area-inset-*)` into the game via CSS variables, and lay out the HUD from those insets.
- **Residual uncertainty:** high (iOS untested here)

### R-A11Y-3 — Fonts are not loaded deterministically (S4, L2)
- **Evidence:**
  - The UITheme font is `"Inter"`, but `index.html` loads only Fredoka from Google Fonts. Inter falls back to system-ui.
  - Phaser Text rasterises at creation, so any font that loads later is not applied (FOUT baked into textures).
  - Using Google Fonts is a third-party request.
- **Mitigation:** self-host Inter and Fredoka (OFL-1.1) via Fontsource or a woff2 subset; `await document.fonts.load(...)` before first scene create.

## J. Dependencies and supply chain

### R-DEP-1 — 22 npm audit advisories, all in dev or build tooling (S4 runtime / S3 dev; L3)
- **Evidence:** 1 critical (handlebars via the jest reporters chain), 7 high (vite dev server, postcss, nanoid, source-map-js, js-yaml, brace-expansion, browserslist), 9 moderate, 5 low. **No advisory affects `phaser`**, the only runtime dependency.
- **Exploitability:** these are **advisories, not demonstrated runtime vulnerabilities**. The production bundle contains only Phaser plus app code. The vite advisories affect the *dev server* (several Windows-only); exposure needs `vite --host` on an untrusted network. Handlebars is reached only by Jest's coverage reporters.
- **Mitigation:** `npm audit fix` (non-breaking) on a separate dependency PR; bump Vite ≥ 8.1.6; never run `vite --host` on shared networks.
- **Residual uncertainty:** low

### R-DEP-2 — Phaser 4.0.0 is behind 4.2.1 (S4, L2)
- **Evidence:** the npm registry and the official changelog. 4.2.1 fixes ScaleManager parent resize and tween `startDelay` state.
- **Mitigation:** a separate upgrade PR after the characterization tests land; full-platform smoke run (all 13 scenes) through the harness.

## K. Asset provenance and licensing

### R-LIC-1 — Future assets with incompatible licences (S2, L3)
- **Evidence:** today all art is code-drawn (no third-party assets). Risks arise when adding packs:
  - game-icons.net is CC BY 3.0 (attribution required)
  - OpenGameArt licences vary per asset (including GPL and CC-BY-SA)
  - Freesound varies per sound (including CC-BY-NC)
  - Pixabay has its own content licence (page unreachable here, so unverified)
- **Mitigation:** an `ASSET_LEDGER.md` row per file (source URL, licence, author, date, attribution text, modifications). CI check that every file under `public/assets` has a ledger row. Prefer CC0 (Kenney) or self-made.
- **Residual uncertainty:** low

## L. CI and accidental deployment

### R-CI-1 — Every push to `main` deploys, with no test gate (S2, L2)
- **Evidence:** `.github/workflows/deploy.yml` runs on `push: [main]` and `workflow_dispatch`, and does `npm ci` then build then deploy. **No `npm test` step.** AGENTS.md also instructs agents to `git push … main --force` with a PAT. That instruction conflicts with this task's rules and was **not followed**.
- **Mitigation:**
  - Add a `test.yml` on pull requests (logic suites + characterization, with a 10-minute timeout).
  - Make deploy depend on it.
  - Branch protection on `main`.
  - Remove force-push and token instructions from AGENTS.md (owner decision).
- **Residual uncertainty:** low

### R-CI-2 — Client-side access gate presented as auth (S4, L1)
- **Evidence:** `LockScene.ts` compares a hard-coded code in the public bundle and stores `sessionStorage` `jg_auth`. This is not access control, and the code value is readable by anyone. Not reproduced in these docs.
- **Mitigation:** treat it as cosmetic; use host-level protection if real gating is needed.

## M. Future server-side wagering boundary (design only; nothing implemented)

The current client RNG, client simulation and client settlement **cannot** support real-value wagering, whatever the RNG quality, because the client controls every input. If real-value play is ever considered, these properties are required. They are listed only to mark the boundary.

1. **Server authority.** The server owns the round: it creates `roundId` and stake, and it decides the outcome and the settlement. The client sends only intents (tick-indexed actions).
2. **Secure randomness.** Outcomes come from a CSPRNG on the server (OS entropy / `crypto.randomBytes`). Optional commit-reveal: the server publishes `H(serverSeed)` before the round, the client contributes `clientSeed`, the outcome is `HMAC(serverSeed, clientSeed‖nonce)`, and the server reveals `serverSeed` after settlement. That gives *verifiability*, not security against a malicious operator who controls payouts.
3. **Unbiased mapping.** Map random bytes to outcomes by rejection sampling (no `% n` modulo bias and no float rounding at boundaries). Use integer or fixed-point money (minor units), never JS floats with `toFixed`.
4. **Skill games.** A skill outcome cannot be computed server-side from randomness alone. The server must either re-simulate the deterministic game from the replay (seed + tick-indexed actions), which needs the fixed-step deterministic core in ENGINEERING_SPEC, or the product must not offer skill games for value. Anti-automation becomes a requirement.
5. **Auditable settlement.** Append-only ledger: `(roundId, stake, outcome, payout, rngProof, simVersion, configHash)`, idempotent settlement keyed by `roundId`, and settlement versioned with the simulation build.
6. **Out of scope here:** wallets, deposits, withdrawals, KYC, licensing, responsible-gambling tooling.
