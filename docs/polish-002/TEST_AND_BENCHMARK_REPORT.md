# JETT-POLISH-002 — Test and Benchmark Report

Every number here was **observed** in this session on commit `616fd82` (Linux container, Node 22.23.4, HeadlessChrome 153 on SwiftShader). Targets are in §6 and are labelled as targets.

## 1. What was run

| # | Command | Time limit | Result |
|---|---|---|---|
| 1 | `npm ci` | 600 s | OK, 10.7 s |
| 2 | `npm run build` | 300 s | **Pass**, 3.8 s; one 1,543.94 kB chunk (398.75 kB gzip) |
| 3 | `npm audit` / `--json` | — | 22 advisories (1 critical, 7 high, 9 moderate, 5 low), all dev or build tooling |
| 4 | Each `src/tests/*.test.ts` in isolation | 120 s each | 13/15 suites pass; BallDrop and Masquerade time out (`logs/per-suite-durations.txt`) |
| 5 | Same suites with the proposed masked RNG via `research/jest.masked-rng.cjs` | 120 s each | All finish ≤ 7 s; Inferno #8 and Surge #6 fail (seed-pinned) (`logs/per-suite-durations-masked-rng.txt`) |
| 6 | `npx jest --config research/jest.research.cjs` | 300 s | **36/36 pass** (`logs/characterization-summary.txt`, `logs/characterization-results.json`) |
| 7 | `node research/probes/browser-env.cjs` | 180 s | env, renderer, canvas size, 6 ready screenshots (`evidence/browser-env.json`) |
| 8 | `node research/probes/browser-dynamics.cjs pacing` | 400 s | `evidence/browser-dynamics-pacing.json` |
| 9 | `… flap`, `… jett`, `… shatter`, `… restarts` | 300 s each | `evidence/browser-dynamics-{flap,jett,shatter,restarts}.json` + screenshots |
| 10 | `… perf` (CPU 1× and 4×) | 500 s | `evidence/browser-dynamics-perf.json` |
| 11 | `node research/probes/render-mockups.cjs` | 120 s | `mockups/*.png` (proposal images) |

Prerequisite for 7–11: `npx vite --port 5199 --strictPort` from the repo root. The harness URL is `http://localhost:5199/jett-game/research/harness/index.html?scene=<SceneKey>`.

## 2. Existing suites (baseline)

| Suite | Tests | Time (baseline RNG) | Time (masked RNG) |
|---|---|---|---|
| JettLogic | 15/15 | 10.6 s | 10.9 s |
| FlapFortuneLogic | 14/14 | 6.9 s | 6.8 s |
| ShatterStepLogic | 13/13 | 5.0 s | 2.8 s |
| ProvablyFairRNG | 7/7 | 3.8 s | 3.0 s |
| BallDropLogic | **timeout** | >120 s | 2.9 s (24/24) |
| MasqueradeLogic | **timeout** | >120 s | 3.1 s (11/11) |
| DiceLogic | 13/13 | 72.7 s | 2.9 s |
| AlchemistLogic | 11/11 | 32.2 s | 3.1 s |
| InfernoLogic | 16/16 | 8.2 s | **15/16** (#8 seed-pinned) |
| SurgeLogic | 16/16 | 4.6 s | **15/16** (#6 seed-pinned) |
| Others (CasinoAudio, DiceDuel, DoomCrash, Mines, SlotEngine) | all pass | 2.8–10.2 s | all pass, ≤ 3.1 s |

Conclusion: **the full-repository slowness is caused by `ProvablyFairRNG` state growth.** This was confirmed by substitution, not inferred.

The Jett and Flap suites stay at 7–11 s with either RNG. A plausible but **unprofiled** cause is the `new ProvablyFairRNG()` constructed every tick inside long loops, plus ts-jest compile time.

## 3. Characterization tests (research only, all passing against current code)

Location: `research/characterization/*.char.test.ts` and `research/probes/*.probe.ts`. Tests tagged **[CURRENT-DEFECT]** assert today's defective behaviour. When the defect is fixed, invert the assertion and move it into `src/tests/` as a regression test.

| File | Tests | Highlights |
|---|---|---|
| `jett.char.test.ts` | 11 | multiplier 0.9711 on tick 1; first coin worldY 675.2, visible from altitude ≈101.9, collected at 650–700; `Math.random` coin X breaks seed determinism; combustion floor overrides 0; duplicate wave bands (≈18% over 50 seeds); horizontal tunnelling; state not JSON-safe; FP-dependent tangency |
| `flap.char.test.ts` | 7 | art 34/42 px vs hitbox 30 px; floor 0.0005 overrides 0.0003; per-tick RNG construction (2.68 µs/tick); deterministic with a seeded RNG; dive rules; edge tangency |
| `shatter.char.test.ts` | 5 | max RTP 72.75%; side irrelevant to outcome; cash-out guards (top payout 559.35); re-entrancy; UI LCG range [0,1] and precision loss |
| `rng.char.test.ts` | 5 | state growth; near-identical first values for adjacent-ms seeds; no state export; masked RNG bounded, distinct and round-trips; chi-square 10-bucket smoke < 30 |
| `fixedstep.char.test.ts` | 6 | **proposed runner**: identical final state at 30/60/120/144 Hz, jitter and hitch; replay exact; quick tap retained; checkpoint continues identically; idempotent settle; ready-phase input ignored |
| `rng-growth.probe.ts` | 1 | s1 bits: 7,464 → 747,464 over 20k calls; 2.6 → 153 µs/call |
| `skill-ev.probe.ts` | 1 | perfect-play EV: Jett peak 62.11× (altitude ≈ 12,843), Flap peak 5.08× (gate 55) |

Fixed-step runner output (`fixedstep.char.test.ts`, Flap autopilot, seed `fixed-step-demo`):

```
hz30:   ticks=260 zeroTickFrames=0   maxTicks/frame=3
hz60:   ticks=260 zeroTickFrames=0   maxTicks/frame=2
hz120:  ticks=260 zeroTickFrames=240 maxTicks/frame=1
hz144:  ticks=260 zeroTickFrames=340 maxTicks/frame=1
jitter: ticks=260 zeroTickFrames=39  maxTicks/frame=2
hitch:  ticks=260 zeroTickFrames=0   maxTicks/frame=7
```

The final state was byte-identical in all six schedules.

## 4. Browser experiments (unmodified production scenes via research harness)

### 4.1 Pacing
Results and interpretation are in CAPABILITIES_AND_BASELINE §6. Headline figures:
- 30 Hz cold: 0.58× speed
- 30 Hz unfocused: 0.50×
- 120/144 Hz: 48–57% of frames run zero ticks
- 500 ms hitch: dropped

### 4.2 Input (Flap)

| Experiment | Observed | Expected after fix |
|---|---|---|
| Quick tap while waiting (down+up, then 1 step) | `waitingToStart=false`, velocity **+0.45** (no flap) | −7.05 |
| Quick tap in play | velocity **+2.25** (flap lost) | −7.05 |
| Tap held across a frame | −7.05 | −7.05 |
| Space held 30 frames while waiting | `waitingToStart=true`, distance 0 | game starts |
| Space held, 19 OS repeats over 20 frames | **20/20** frames with a fresh flap | 1 flap |

### 4.3 Settlement (Jett)

| Experiment | Observed |
|---|---|
| CASH OUT before GO | `cashedOut=true`, payout 10, status "PAID OUT 10.00 credits", start overlay still shown; GO afterwards starts a tick timer on a settled round |
| CASH OUT within 300 ms after combustion | status **"PAID OUT 0.00 credits"**, then "COMBUSTION! JETPACK FAILED"; **2** PLAY AGAIN buttons |
| First 3 ticks | multiplier 0.9711 / 0.9722 / 0.9733; HUD "x0.97" |
| Tap on CASH OUT steers ship | `pointerX` 195 → 318 |

### 4.4 Shatter Step reveal
- Forced setup: UI RNG → loss; `Math.random` → reveal says left.
- Result: player picked **left**, status "✗ SHATTERED", and the reveal paints the shattered left pane **green (correct)**.
- PLAY AGAIN restarts correctly.
- Screenshot: `evidence/screenshots/shatter-loss-reveal-contradiction.png`.
- In unforced play the reveal is an independent coin flip, so this contradiction appears on ~50% of losses.

### 4.5 Restarts (50 cycles)
See CAPABILITIES_AND_BASELINE §7. Key points:
- Jett AudioContexts 52 created / 0 closed.
- Listener counts stable across scene restarts; 3× on same-instance `start()`.
- Heap after forced GC flat (+0.8–1.0 MB).

### 4.6 Frame cost
See CAPABILITIES_AND_BASELINE §6. These are **SwiftShader numbers, not device numbers.**

## 5. Coverage of the required regression cases

| Required case | Status |
|---|---|
| Same seed/actions ⇒ same state and payout | Prototyped (Flap, logic layer). Jett blocked by `Math.random` coin X (pinned). Shatter UI uses its own unrecorded LCG |
| Checkpoint serialization/restoration | Prototyped (Flap + masked RNG) |
| 30/60/120/144 Hz and irregular deltas | Measured (browser) + prototyped (runner) |
| Hitches, pause/resume, background tab | Hitch and unfocused measured; **hidden/visible resume not yet exercised** (add `game.events.emit('hidden'/'visible')` steps) |
| Quick taps, held keys, key repeat | Measured |
| Cancellation, blur, multi-touch | **Not yet exercised** (needs `pointercancel` dispatch and a second touch pointer via CDP `Input.dispatchTouchEvent`) |
| HUD/settings/back/retry never leak into gameplay | Measured for Jett CASH OUT; Flap back arrow inferred from code (navigates away, so not automated) |
| Cash-out repeated / after death / before start / boundary | Logic guards tested; UI after-death and before-start measured; same-tick boundary specified (ENGINEERING_SPEC §5) but not testable until the runner exists |
| Collision tangency, epsilon, corners, fast movement | Jett tangency (FP-dependent), Flap edges, Jett tunnelling tested; Flap corner (cap) is art-only |
| Fifty restart cycles | Measured |
| Shatter selection, re-entrancy, progression, loss, cash-out | Logic tested; UI reveal measured; multi-touch double-pick: **code-inspected only** (row check rejects the second pick) |
| Cosmetic settings never affect outcomes | **Not testable yet**: no settings exist. Specified (ENGINEERING_SPEC §3) |

## 6. Proposed targets (NOT measurements)

| Metric | Target | How to measure |
|---|---|---|
| Sim speed vs wall clock | 0.98–1.02 at 30/60/90/120/144 Hz, cold and warm, focused or not | `probe: pacing` |
| Frames with 0 ticks at 120 Hz | allowed, but rendered positions interpolate (no repeated image) | visual diff of consecutive frames |
| Low-end Android (e.g. 4 GB RAM, 2019 mid-tier SoC) active gameplay | p95 frame ≤ 20 ms at 60 Hz; no frame > 50 ms during 60 s | `chrome://inspect` trace on device |
| Restart × 50 | listeners, timers, AudioContexts constant; heap after GC ±2 MB | `probe: restarts` |
| Initial load (lobby → first game) | ≤ 400 kB gzip JS for one game; fonts ≤ 60 kB | `vite build` report |
| Full `npm test` | < 60 s total | CI job |

## 7. Honest gaps
- No real mobile device, no WebKit/Safari, no GPU. All performance numbers are relative only.
- WebFetch was unavailable; the curl/npm substitutes cover licences, but some sites returned 403 (listed in TOOL_AND_ASSET_RESEARCH).
- Human RTP for Jett and Flap is unmeasured. Only a perfect-play upper bound and the existing hazard-free sims exist.
- The audio-silent-on-mobile hypothesis (R-OWN-1) is not verified on a device.
