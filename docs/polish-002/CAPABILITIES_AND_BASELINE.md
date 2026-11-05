# JETT-POLISH-002 — Capabilities and Baseline

Date checked: 2026-11-05. Everything in this file was observed in this session unless marked otherwise.

## 1. Checkout

| Item | Value |
|---|---|
| Repository | `zero-934/jett-game` (anonymous git read via session proxy; not attached for API/push) |
| Base branch / commit | `main` @ `616fd82b5a5552ad0ae26a9dbaddb78213d0f96f` ("fix: footer to EXACT jett-landing code") — the same commit as the prior POLISH-001 review |
| Research branch | `research/jett-polish-002` (local only, not pushed) |
| Session-start procedure | `git fetch --all && git pull origin main` → "Already up to date"; `git branch -r` → 28 remote branches; `find src -name "*.ts"` → 76 files. No local work was overwritten (fresh clone). |
| `docs/polish-001/` | **Absent** in this checkout. The prior review's docs/evidence were local-only, so its summary was treated as hypotheses. |

## 2. Toolchain and dependency versions

| Component | Declared | Installed (from lockfile via `npm ci`) | Notes |
|---|---|---|---|
| Node | — | v22.23.4 (session) | **CI uses Node 20** (`.github/workflows/deploy.yml`). Builds passed here on 22; 20 not tested. |
| npm | — | 10.9.9 | |
| phaser | `^4.0.0` | **4.0.0** | Latest on npm: 4.2.1 (2026-07-09). 4.2.1 fixes "ScaleManager not resizing to parent container" and tween `startDelay` state. |
| typescript | `~6.0.2` | 6.0.2 | `tsconfig.json` does **not** set `"strict": true` although AGENTS.md mandates it. `tsc --noEmit --strict` reports **0 errors**, so enabling it is cheap. |
| vite | `^8.0.4` | 8.0.8 | npm audit: high-severity dev-server advisories (see risk register). |
| jest | `^30.3.0` | 30.3.0 (`jest --version` reports 30.2.0 for jest-cli) | |
| ts-jest | `^29.4.9` | 29.4.9 | ts-jest 29 paired with Jest 30; works today but outside ts-jest's tested matrix. |
| @types/jest | `^30.0.0` | 30.0.0 | |
| Extraneous | — | `@emnapi/*`, `@tybys/wasm-util`, `tslib` | Listed as extraneous by `npm ls`; harmless. |

Raw logs: `logs/build.txt`, `logs/npm-audit.txt`, `logs/npm-audit.json`.

## 3. Capability matrix

| Capability | Status | Evidence / limits |
|---|---|---|
| Web search | **Available** | WebSearch tool returned results (used for game-feel and accessibility references). |
| Fetch known URLs (WebFetch tool) | **Unavailable** | `getaddrinfo ENOTFOUND example.com` even after the network change — the tool appears to hold the session's original settings. |
| Outbound HTTP from shell (curl) | **Available** | google.com, example.com and wikipedia.org returned 200 after the user widened network access. Used to read license pages and Phaser changelogs. Some sites returned 403 (pixabay.com, sonniss.com, freesound.org, audacityteam.org), so those licenses are **unverified** here. |
| npm registry | **Available** | `npm view` used for license, version and modification dates. |
| GitHub REST API for third-party repos | **Unavailable** | `gh api repos/...` is refused for repos not attached to this session, so repo stars and push dates were not collected. npm metadata was used instead. |
| Push to `zero-934/jett-game` | **Unavailable / not attempted** | Read-only anonymous access; not requested. |
| Browser automation | **Available** | Playwright 1.63.0 + Chromium (HeadlessChrome/153.0.8010.12). |
| WebKit / Firefox | **Unavailable** | Only Chromium is installed. **iOS Safari behaviour is unverified.** |
| GPU | **Unavailable** | WebGL runs on SwiftShader (software rasteriser): `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))`. Absolute frame costs are not representative of phones. |
| Screenshots | **Available** | `evidence/screenshots/*.png` |
| CPU throttling, heap and GC (CDP) | **Available** | `Emulation.setCPUThrottlingRate`, `HeapProfiler.collectGarbage`, `performance.memory` |
| Real mobile devices | **Unavailable** | No device lab. No mobile performance claims are made. |
| Paid model or API jobs | **Not used** | The Gemini workflow in AGENTS.md was not invoked, as instructed. |

## 4. Build baseline

`npm ci` took 10.7 s. `npm run build` (`tsc && vite build`) **passed** in 3.8 s wall time.

```
dist/index.html                    5.57 kB │ gzip:   1.40 kB
dist/assets/index-BLubKIkA.js  1,543.94 kB │ gzip: 398.75 kB
(!) Some chunks are larger than 500 kB after minification.
```

The whole platform (13 scenes plus Phaser) ships as one chunk. There is no code-splitting per game.

## 5. Test baseline (per suite, isolated, 120 s limit each)

Command: `timeout 120 npx jest --config jest.config.cjs <file>` (log: `logs/per-suite-durations.txt`)

| Suite | Result | Wall time |
|---|---|---|
| AlchemistLogic | 11/11 pass | 32.2 s |
| **BallDropLogic** | **did not finish (timeout)** | >120 s |
| CasinoAudioManager | 10/10 | 2.8 s |
| DiceDuelLogic | 12/12 | 10.2 s |
| DiceLogic | 13/13 | 72.7 s |
| DoomCrashLogic | 55/55 | 3.2 s |
| **FlapFortuneLogic** | **14/14** | 6.9 s |
| InfernoLogic | 16/16 | 8.2 s |
| **JettLogic** | **15/15** | 10.6 s |
| **MasqueradeLogic** | **did not finish (timeout)** | >120 s |
| MinesLogic | 14/14 | 3.6 s |
| ProvablyFairRNG | 7/7 | 3.8 s |
| **ShatterStepLogic** | **13/13** | 5.0 s |
| SlotEngineLogic | 9/9 | 6.6 s |
| SurgeLogic | 16/16 | 4.6 s |

- Jett + Flap = **29/29 pass**, which matches the prior review. Shatter Step = **13/13 pass**.
- **Root cause of the slow full suite, identified (not just a timeout):** the shared `ProvablyFairRNG` never masks its state to 64 bits. State grows by about 37 bits per call, so cost per call rises roughly linearly (2.6 µs → 153 µs at 20,000 calls; `research/probes/rng-growth.probe.ts`). Long RTP simulations therefore run in quadratic time.
- **Causation check:** the *existing* suites were run with a 64-bit-masked drop-in RNG substituted by a research-only Jest `moduleNameMapper` (`research/jest.masked-rng.cjs`). BallDrop >120 s → **2.9 s**, Masquerade >120 s → **3.1 s**, Dice 72.7 s → **2.9 s**, Alchemist 32.2 s → **3.1 s**. Two seed-pinned assertions then fail in **Inferno** (#8) and **Surge** (#6), which are outside this task's scope; see the risk register (R-RNG-3). Log: `logs/per-suite-durations-masked-rng.txt`.

## 6. Browser baseline

Harness: `research/harness/index.html` + `harness-main.ts`. It boots the **unmodified** production scenes with the same game config as `src/main.ts`, skips LockScene, and exposes `window.__game`. Served by `npx vite --port 5199`.

| Item | Observed |
|---|---|
| Browser | HeadlessChrome 153.0.8010.12, Linux x86_64 |
| Renderer | WEBGL (Phaser AUTO) on SwiftShader |
| Viewports | 390×844 CSS at DPR 1 and DPR 3 (`isMobile`, `hasTouch` emulated at DPR 3) |
| **Canvas backing store** | **390×844 at both DPR 1 and DPR 3**. `resolution: devicePixelRatio` in `src/main.ts` is not read by Phaser 4's Config (no `resolution` key exists in `src/core/Config.js`). At DPR 3 the canvas is upscaled **3.0×** by CSS, and `index.html` sets `image-rendering: pixelated`, which produces blocky text and vector edges. |
| Console | Jett at DPR 1 logged 4 driver warnings: "GPU stall due to ReadPixels" (SwiftShader, harness-specific). No page errors in any scene. |
| Ready screenshots | `evidence/screenshots/ready-<Scene>-dpr{1,3}.png` |

### Frame-schedule pacing (real Phaser TimeStep + Clock + render, manually stepped)

Method: `research/probes/browser-dynamics.cjs pacing`. The rAF loop is put to sleep and `game.loop.step(t)` is called with synthetic timestamps, so Phaser's own delta smoothing (`smoothStep`, 10-frame history, `panicMax` 120-frame cool-down, 200 ms clamp) and Clock catch-up are exercised exactly. Hazards were removed by the probe so the round stays alive. `simSpeed` = simulated ticks ÷ (wall ms / 16).

| Schedule | Cold (first 120 frames) simSpeed | Warm simSpeed | Ticks per frame (warm) |
|---|---|---|---|
| 30 Hz | **0.58** | 0.98–1.00 | 2–3 |
| 60 Hz | 0.99–1.00 | 1.00 | 1 (4% of frames do 2) |
| 120 Hz | 1.04 | 1.00 | **0 or 1 (≈48% of frames do 0)** |
| 144 Hz | 1.06 | 1.00 | **0 or 1 (≈57% of frames do 0)** |
| 60 Hz ±8 ms jitter | 0.90 | 1.00 | 0–2 |
| 60 Hz + one 500 ms hitch | 0.99 | **0.91** (hitch time dropped) | 1–2 |
| 30 Hz, window unfocused | **0.50** | **0.50** | 1–2 |

Interpretation:

- **Catch-up:** Phaser's Clock does catch up. A 16 ms looping TimerEvent fires several times in one frame (`Clock.update` while-loop), so the games do **not** advance only once per rendered frame.
- **Slowed time:** the TimeStep caps each delta at 16.67 ms during the 120-frame cool-down and whenever the window is unfocused. So on 30 Hz devices, gameplay runs at about half speed for the first ~4 s and indefinitely while unfocused. Deltas over 200 ms are replaced by the last sane delta, which drops time.
- **Judder:** at 120 and 144 Hz many frames contain no tick. Rendering happens *inside* the tick, so those frames repeat the previous image; there is no interpolation. At 60 Hz about 1 frame in 25 does a double tick.

### Coarse frame cost (real rAF, SwiftShader; **not** representative of phones)

`research/probes/browser-dynamics.cjs perf`. "Step" = `prestep` → `postrender` CPU time per frame.

| Scene / state | CPU 1× fps | step p50 / p95 ms | CPU 4× throttle fps | step p50 / p95 ms |
|---|---|---|---|---|
| Jett ready | 60.0 | 0.8 / 1.2 | 45.3 | 3.9 / 7.4 |
| Jett active (harness: collisions disabled, hazards rendered) | 60.2 | 2.3 / 3.2 | **30.0** | 12.4 / 22.6 |
| Flap ready | 60.3 | 1.4 / 2.0 | 43.3 | 6.6 / 10.4 |
| Flap active (round ended mid-sample by combustion) | 59.6 | 1.2 / 1.8 | 40.2 | 5.8 / 10.6 |
| **Shatter Step idle board** | **47.7** | 3.2 / 5.2 | **23.7** | 14.8 / 24.2 |

Shatter Step's idle board, with 110 display objects (20 Graphics, 20 Text, 40 Arc stars, 20 hit rectangles), is the most expensive state measured. It redraws nothing per frame, so the cost is draw-call and fill bound on the software rasteriser. **Verify on a real low-end Android device before drawing conclusions.**

Capture overhead: timing hooks add two `performance.now()` calls per frame. Screenshots were taken outside measured windows.

## 7. Restart / ownership baseline (50 restart cycles through the PLAY AGAIN code path)

`research/probes/browser-dynamics.cjs restarts`

| Scene | pointerdown listeners | keydown-SPACE | timers | display list | AudioContexts created / closed | Heap after forced GC |
|---|---|---|---|---|---|---|
| Jett | 1 → 1 | 0 | 0 → 0 | 21 → 21 | **2 → 52 / 0** | 17.0 → 18.0 MB |
| Flap | 1 → 1 | 1 → 1 | 1 → 1 | 12 → 12 | 1 → 1 / 0 | 17.0 → 17.9 MB |
| Shatter | 0 → 0 | 0 | 1 → 1 | 110 → 110 | 1 → 1 / 0 | 17.3 → 18.1 MB |
| Jett, `UI.start()` twice on same instance | **3** | — | — | — | — | — |
| Flap, `UI.start()` twice on same instance | **3** | **3** | — | — | — | — |

Stars arrays also tripled (Jett 130 → 390, Flap 80 → 240). Scene restarts do **not** accumulate listeners, because Phaser's InputPlugin and KeyboardPlugin `removeAllListeners()` on scene shutdown. Jett leaks one native AudioContext per round (`new CasinoAudioManager()` per JettUI; `destroy()` never called).

## 8. Assumptions

1. "Mobile-first" targets: 390×844 logical portrait, DPR 2–3, 60 Hz and 120 Hz panels, low-end Android at roughly 4× slower than desktop CPU. These are emulation targets, not measurements.
2. Demo credits only. No real-money flows exist or are proposed.
3. Inferno, Surge, Dice, BallDrop, Masquerade, Alchemist, Mines and DoomCrash are out of scope. They were inspected only as shared-system consumers.
