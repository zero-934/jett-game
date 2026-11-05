# JETT-POLISH-002 — Executive Review

**Scope:** Jett, Flap Fortune and Shatter Step. Phaser 4.0.0 + TypeScript.
**Checkout:** `main` @ `616fd82b5a5552ad0ae26a9dbaddb78213d0f96f`. Research branch `research/jett-polish-002` (local). No production code changed.

## Bottom line

**Readiness.** The three games build and their logic tests pass (Jett 15/15, Flap 14/14, Shatter 13/13). They are **not yet commercially presentable demos**.

**Blockers, ranked:**

1. **Trust and claims.**
   - Shatter Step's maximum return is **72.75%** (not 96–97%).
   - Its post-round "reveal" invents outcomes and can mark the pane you just lost on as correct.
   - Jett and Flap have no house edge a skilled player can't beat: perfect-play EV peaks at **62×** and **5×**.
   - The 96% RTP statements are unsupported for all three.
2. **Feel on real devices.**
   - Gameplay slows to **0.5–0.58×** on 30 Hz devices (first ~4 s, and whenever the window is unfocused).
   - It judders at 120/144 Hz (half the frames repeat).
   - Quick taps are dropped in Flap.
   - The canvas renders at **1×** and is pixel-upscaled 3× on modern phones.
3. **Settlement and ownership bugs.**
   - Jett can be "cashed out" before it starts.
   - It shows "PAID OUT 0.00" after combustion, with duplicate buttons.
   - It leaks an AudioContext per round (52 after 50 restarts).
4. **Shared RNG.** It is not the xoroshiro128+ it claims to be. Its state grows ~37 bits per call, which is the **proven cause** of the full test suite's multi-minute runtime. Fixing it is easy, but it changes every game's sequences.

**Path.** Everything above is fixable inside the current Logic/UI/Scene architecture without a rewrite. A prototype fixed-step runner and a corrected RNG are on the branch and pass their tests against the unmodified Flap logic.

## Verification of the earlier (POLISH-001) findings

`docs/polish-001/` **does not exist** in this checkout. The summary was treated as hypotheses and each was re-tested independently.

**How to read the Evidence column:** `char:` = `research/characterization`, `probe:` = `research/probes/browser-dynamics.cjs`.

| # | Hypothesis | Verdict | Source location | Evidence / reproduction | Practical impact |
|---|---|---|---|---|---|
| 1 | Production build passes | **CONFIRMED** | — | `npm run build` 3.8 s (`logs/build.txt`) | One 1.54 MB chunk |
| 2 | Jett + Flap suites 29/29 | **CONFIRMED** | `src/tests` | 15 + 14 pass | — |
| 3 | Full run did not complete in 45 s; not proof of failure | **CONFIRMED, cause found** | `ProvablyFairRNG.ts:25–28,104–105` | BallDrop and Masquerade >120 s; with masked RNG 2.9 s / 3.1 s | CI impractical until fixed |
| 4 | RNG omits 64-bit masking; BigInt grows | **CONFIRMED** | same | s1 7,464 → 747,464 bits over 20k calls; 2.6 → 153 µs/call; diverges from the reference at output index 2 (`probe: rng-growth`) | Algorithm unverifiable; in-game cost modest per round |
| 5 | Jett coin placement uses `Math.random()` | **CONFIRMED** | `JettLogic.ts:208` | `char: jett` coin-X test | Seeds don't reproduce rounds |
| 6 | Flap quick down/up clears flap before tick | **CONFIRMED** | `FlapFortuneUI.ts:211–220` | quick tap in play ⇒ velocity +2.25 (no flap); held ⇒ −7.05 (`probe: flap`) | Missed inputs, unfair-feeling deaths |
| 7 | Flap Space does not leave waiting-to-start | **CONFIRMED** | `FlapFortuneUI.ts:221` | `waitingToStart` still true after 30 frames of Space; plus **new**: key repeat ⇒ 20/20 frames flap | Keyboard unusable to start; held key auto-flaps |
| 8 | UI cleanup misses handlers; same-instance restart doubles listeners and stars | **CONFIRMED** | `JettUI.ts:75,303`; `FlapFortuneUI.ts:73,210` | `start()` ×2 more ⇒ pointerdown 3, stars ×3 (`probe: restarts`) | Latent; normal flow unaffected |
| 9 | Ordinary scene restarts do NOT accumulate pointer listeners | **CONFIRMED** | Phaser `InputPlugin.shutdown` → `removeAllListeners` | 50 restarts: pointerdown 1 → 1 | — |
| 10 | Scene `shutdown()` not subscribed to shutdown events | **CONFIRMED** | `Systems.js:772` only emits `SHUTDOWN` | Code trace; the three Scenes define but never subscribe `shutdown()` | Cleanup depends on the PLAY AGAIN path |
| 11 | Jett audio disposal/initialisation needs investigation | **CONFIRMED (defect)** | `JettUI.ts:61`; `CasinoAudioManager.ts:39–57` | 52 AudioContexts created, 0 closed; `init()`/resume never called. Mobile silence plausible but **UNVERIFIED** on device | Resource leak; possibly silent coin SFX |
| 12 | Asteroid band repeats with negative scatter | **CONFIRMED** | `JettLogic.ts:189–190, 309` | ≈18% of waves land in an occupied band over 50 seeds; constant-low RNG ⇒ a wave every tick | Uneven, sometimes stacked hazards |
| 13 | Flap gate art and logic widths differ | **CONFIRMED** | `FlapFortuneLogic.ts:238` vs `FlapFortuneUI.ts:455,528–536` | 30 px hitbox vs 34 px body / 42 px caps | Visible overlaps without death |
| 14 | Combustion chance 0 still combusts | **CONFIRMED** | `JettLogic.ts:257–258`; `FlapFortuneLogic.ts:176–177` | `char:` floor tests | Config is misleading |
| 15 | Jett multiplier drops 1.0 → ≈0.9711 on first tick | **CONFIRMED** | `JettLogic.ts:242, 358–362` | ticks 1–3: 0.9711/0.9722/0.9733; break-even at altitude ≈32 | Early cash-out pays below stake |
| 16 | First coin at world Y 675.2, initially off-screen; entry ≠ collection | **CONFIRMED** | `JettLogic.ts:125–132` | visible from altitude ≈101.9; collected at altitude 650–700 (≈ tick 520) | Explains the "coins at ~800 m" note in AGENTS.md: the first collectable coin is ~8 s in |
| 17 | Existing RTP tests use broad bounds; no 96% established | **CONFIRMED (and worse)** | `src/tests/*Logic.test.ts` | Jett 0.8–1.5, Flap 0.3–3.0 (hazards removed), Shatter 0.60–2.0 under the title "~94–100%" while theory = 72.75% | Unsupported claims |
| 18 | Asset/character registry less integrated than claimed | **CONFIRMED** | `assetConfig.ts`, `characters.ts`, `CharacterDef.ts` | zero consumers outside `src/shared`; `public/assets` has only a README | Documentation overstates |
| 19 | Both games simulate and render through 16 ms timers | **CONFIRMED** | `JettUI.ts:168`, `FlapFortuneUI.ts:83` (also `ShatterStepUI.ts:113` for animation) | — | See next row |
| 20 | Nuance: Phaser Clock catches up timers | **CONFIRMED** | `Clock.js:394–427` | warm ticks/frame 2–3 at 30 Hz | Not "once per frame"; the real issues are TimeStep's 16.67 ms cap (cool-down / unfocused) and render-in-tick judder |

None of the prior hypotheses was rejected. New findings beyond POLISH-001 are listed below.

## New findings (this review)

- **Shatter Step:**
  - max RTP 72.75%; the pick side is irrelevant to the outcome
  - the reveal is fabricated via `Math.random` and contradicts the loss ~50% of the time (screenshot evidence)
  - its UI uses a separate unrecorded LCG that can return 1.0
  - the idle board is the most expensive state measured (47.7 fps on SwiftShader)
- **Pacing:** TimeStep cool-down and unfocused capping give 0.50–0.58× speed at 30 Hz; 120/144 Hz frames repeat.
- **Jett settlement:**
  - CASH OUT works before GO
  - within the 300 ms combustion window it shows "PAID OUT 0.00" and creates two PLAY AGAIN buttons
  - tapping CASH OUT also steers the ship
  - horizontal teleport tunnels through asteroids
  - exact-tangency collision depends on float rounding
- **Skill economics:** perfect-play EV > 1 almost immediately (Jett peak 62×, Flap 5.08×).
- **Rendering:** `resolution` config is ignored by Phaser 4, so the backing store stays 390×844 at DPR 3; `image-rendering: pixelated`; Inter font never loaded.
- **Project hygiene:**
  - CI deploys every push to `main` without running tests
  - `tsconfig` lacks `strict` (it would pass with 0 errors)
  - Phaser 4.0.0 is behind 4.2.1
  - 22 npm advisories, all dev or build tooling (none in Phaser)
- **Cross-game:** fixing the RNG breaks seed-pinned Inferno #8 and Surge #6.

## Recommended tools
- **Phaser built-ins first:** ParticleEmitter, tweens, Sound, `generateTexture`/RenderTexture, atlases.
- **Dev only:** `@playwright/test` (stepping + screenshots, as prototyped), `sharp`, `free-tex-packer-core` (Phaser3 exporter verified), `svgo`, `@fontsource/inter` + `@fontsource/fredoka` (OFL-1.1).
- **Desktop:** Inkscape, Krita, Audacity, ffmpeg.
- **Assets:** Kenney (CC0, verified), Lucide (ISC). game-icons.net only with attribution.
- **Rejected:** Spine, DragonBones, howler.js, stats.js, Tone.js (for now).

Details: TOOL_AND_ASSET_RESEARCH.md.

## Recommended visual direction
**Direction A, Midnight Luxury, for all three games first:** restrained charcoal and gold, gold line-art characters, rim-lit hazards, a shared HUD with thumb-zone CTA and demo-credit labelling. About 6.5 artist-days plus 2–3 dev-days per game.

Then pilot **Direction B, Illustrated Night,** on Flap Fortune only, and measure it on a low-end Android device before expanding.

Mockups (proposal only): `mockups/direction-A-midnight-luxury.png`, `mockups/direction-B-illustrated-night.png`.

## Highest-priority risks and fixes
1. **R-CLAIM-1/2/4:** correct RTP claims, and make the Shatter reveal truthful (pre-committed board). B-03, B-18.
2. **R-RNG-1/3:** RNG v2 with a cross-game decision on Inferno and Surge. B-01.
3. **R-TIME-1 + R-INPUT-1/2:** fixed-step runner with edge-triggered input. B-20, B-16.
4. **R-CASH-1/3 + R-INPUT-3:** phase-gated, idempotent settlement UI and HUD input isolation. B-15, B-17.
5. **R-OWN-1/2:** a single audio owner; subscribe scene shutdown. B-14, B-12.
6. **R-PERF-1:** resolution (CSS quick win now, zoom approach later). B-23.
7. **R-CI-1:** add a PR test gate. B-00.

## Explicitly not done
- No production edits, pushes, PRs, deployments, purchases, paid API jobs or real-money work.
- No real-device, Safari or GPU measurements. Every performance number is relative (SwiftShader).
