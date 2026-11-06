# polish-004 — Implementation and test report

**Branch:** `opus/polish-004-sharpness`, built from `origin/opus/polish-003-controls` @ `148a09419455c96fbd1e88c8b09d6929a020ad4e`. The handoff docs and evidence came from `origin/research/polish-004-sharpness` @ `20bcfdf` (its base `97c5797` is an ancestor of `148a094`; the controls branch had two newer commits, REBOOT.md and the capture scripts, which are kept).
**Not done:** merge, push to main, deployment, or public preview. No PR opened.

## 1. Commits (in order, kept in reviewable layers)

| Commit | Layer | Summary |
|---|---|---|
| `5dd08dfec4b0fe3f1b41c7236b3facbdff61be50` | renderer | High-density rendering, self-hosted Inter, dense generated textures, harness key routing, baseline evidence |
| `9eedda7e23bba0a1afe21585cf2921a5b8a89c64` | UI | Native DOM shell (text and controls), settings dialog, narrow and landscape reflow, Shatter touch bands |
| `28591cb3449dc66724fbde15fbebb6c0e10bd3e6` | artwork | Export pipeline, flame removal, lean, flap response, glass feedback |
| `18826379a2b7888529ca2bc54520b4bf4e30e6c0` | renderer fix | Shatter world uses logical 390×844 |
| `20c179ab2604f9a7244cd3e5f8bb958aaf9ff87d` | host/brand | Host contract, demo adapter, fictional brands, fake host, unit tests |
| `e0a15cfb31f534994135baefebfa86d3430ba71a` | renderer + QA | Adaptive governor, restart crash fix, polish-004 browser suite and scripts |
| `32b80f26c810cce8ccfb1cf7e9ced1db87de9fe4` | UI fix + evidence | Compact footer for narrow immersive layouts, captures |
| (this report's commit) | docs | Four reports and the final test reports |

## 2. What visibly changed

- **Text and buttons are crisp.** Header, HUD, footer, CTA, result card, pause message and settings are native text in self-hosted Inter, so they render at device density regardless of the canvas. Compare `evidence/crops/*-{header,hud,footer}-before-after@3x.png`.
- **The playfield is crisp.** It renders at 1170×2532 on a 390-wide DPR 3 screen (was 390×844). Rocks, coins, skyline, glass panes and shards use 3× textures, and the Jett stars are vector.
- **Characters:** re-exported cleanly from the masters with no faint-alpha halo, fringe-free premultiplied downsampling and a subtle outline. The duplicated jet flame is gone; a single animated flame sits at the nozzle. The Jett lean is eased. The Flap wizard has a flap squash-stretch and a bristle puff. On-screen size and centre are exactly as before.
- **Shatter:** specular pane edge, lit shards, a selected-pane glow on safe steps, and ≥ 44 px live pane bands on 320-px phones.
- **Layouts:**
  - 320×568: no label collisions; compact inline footer for Jett and Flap.
  - Short landscape: an info panel left of the canvas and a control rail on the right, so text no longer squeezes into a 180-px canvas.
- **Branding:** two fictional brands switch live (wordmark, accent, surfaces, radius, font) with no restart.

## 3. Rendering approach and why

A **hybrid**: high-density Phaser for the playfield, DOM for interface text and controls. The evidence is in SHARPNESS_DIAGNOSIS §6:
- A alone fixes the 390-wide portrait view but leaves text tied to canvas density and unreadable in narrow and landscape layouts.
- B alone leaves the characters soft.
- A+B keeps text crisp even when the adaptive governor lowers canvas density on slow devices.

## 4. Tests and builds (exact results from this session)

| Command | Result |
|---|---|
| `npm run build` (tsc + vite build) | **Pass.** `dist/assets/index-*.js` 1,618,674 B (gzip 421,555 B), vs baseline 1,587,199 B (gzip 410,741 B): +10.8 KB gzip. Pre-existing >500 kB chunk warning unchanged. |
| `npm test` (jest) | **354/354 passed, 20 suites** (baseline at start: 317/317 in 17 suites). New: RenderScalePolicy (13), Brand (11), HostProtocol (13). |
| `npx jest --config research/jest.research.cjs` | **36/36 passed** (unchanged) |
| `node tests/browser/polish003.browser.cjs` (existing suite, updated for DOM internals) | **138/138 passed.** Report: `evidence/browser-report-polish003-rerun.json` (baseline at start: 138/138) |
| `node tests/browser/polish004.browser.cjs` (new) | **__P4_RESULT__.** Report: `evidence/browser-report-polish004.json` |

Coverage map of the new browser suite against the brief:

| Brief item | Section |
|---|---|
| Pointer mapping after resizing and DPR changes | `pointer`: resize to 360×700, live CDP DPR 2→3, rotation to the 844×390 rail; ±1 CSS px |
| Cash-out never steers Jett or flaps the wizard | `inputs`: real touch double-tap → one settlement, no steer/flap, target unchanged |
| One action per input | `inputs`: touch tap = one debit / one `roundStarted`; Enter on a pane = one pick |
| Settings and overlay isolation | `overlays`: backdrop taps over the stage and the CTA add nothing; Escape keeps the round paused; rows ≥ 44 px |
| Restart and event cleanup | `restarts`: 30× flat DOM, display list, scene/scale/window listeners and textures; density kept |
| Correct game selection in the minified release | `release`: 11 scenes, exactly the requested one active; pilots at 1170×2532, others at 390×844; size restored on exit |
| Host message validation | `host` + unit tests |
| Theme switching without restart or corruption | `theming`: identical state hash at the same tick with and without brand/settings switches |
| Unchanged replay and settlement | `replay`: identical state and settlement at render scale 1 / 3 / 1.5 for all three games; Logic files byte-identical to base (`git diff 148a094 -- src/games/*Logic.ts src/shared/rng src/shared/sim/FixedStepRunner.ts src/shared/sim/Replay.ts` is empty) |
| Density and fonts | `density`: ≥ 0.99 backing px per physical px where the target ≤ 3, otherwise `cap`; four Inter weights loaded; `image-rendering:auto` |
| Targets | `targets`: every visible control ≥ 44×44 CSS px on 5 viewports; text ≥ 11 px; Shatter runner centred at every scale |
| Adaptive governor | `governor`: high → balanced → low under slow frames; round untouched |

**Smoke of the other registered games** (shared boot changed: font wait and `diag` flag). `release` checks that DiceScene, MinesScene, BallDropScene, MasqueradeScene, AlchemistScene, InfernoScene, SurgeScene and DiceDuelScene each boot alone in the minified build with no page errors at 390×844. The polish-003 `smoke` section also passes. No Inferno file was modified.

## 5. Performance (and its limits)

`tests/browser/polish004/perf.cjs` → `evidence/perf-render-scale.json`. Same viewport (390×844), emulated DPR 3, headless Chromium 153 with **SwiftShader software WebGL** on a shared cloud CPU. **These are not phone frame rates.** Only the relative scaling means anything.

| Game | Render scale | Backing | Framebuffer est. | Active frame interval p50 / p95 / p99 (ms) | Active main-thread step p50 / p95 (ms) | JS heap (MB) |
|---|---|---|---|---|---|---|
| Jett | 1 | 390×844 | 2.5 MB | 16.7 / 16.9 / 18.4 | 1.3 / 1.8 | 21.5 |
| Jett | 2 | 780×1688 | 10 MB | 36.4 / 44.0 / 74.4 | 1.6 / 3.2 | 23.1 |
| Jett | 3 | 1170×2532 | 22.6 MB | 80.9 / 94.2 / 120.5 | 2.3 / 2.9 | 21.2 |
| Flap | 1 | 390×844 | 2.5 MB | 16.7 / 16.9 / 17.3 | 0.7 / 1.0 | 23.9 |
| Flap | 3 | 1170×2532 | 22.6 MB | 91.9 / 108.3 / 141.7 | 1.4 / 4.9 | 22.5 |
| Shatter | 1 | 390×844 | 2.5 MB | 16.7 / 16.9 / 17.2 | 0.4 / 0.5 | 22.9 |
| Shatter | 3 | 1170×2532 | 22.6 MB | 90.9 / 112.4 / 116.1 | 0.7 / 1.4 | 21.2 |

(Scale-2 rows for Flap and Shatter are in the JSON.)

Readings:
- [Observed] JavaScript cost barely changes. The frame interval in this environment is dominated by **software rasterisation of 9× the pixels** (fill cost grows with the square of the scale).
- [Inference] A phone GPU composites its native resolution every frame. Whether 1170×2532 holds 60 fps on the owner's device is **unknown** and is the main item for physical testing.
- [Observed] The safety net is the governor (§SHARPNESS 7). It drops to 2× and then 1.5×, and keeps DOM text crisp.
- **Downloads:**
  - Inter adds ≈ 97 KB (four Latin files; Latin-Ext loads only if needed).
  - Character PNGs: 23.7 + 25.9 KB (r3), versus 26.5 + 21.8 KB before.
  - JS: +10.8 KB gzip.
- **Memory:**
  - Framebuffer +20 MB at scale 3 (estimate).
  - Generated textures ≈ 4.8 MB GPU across all three games, created only for the scene in use and cached.
  - Character textures are smaller than before (64.7 + 76.0 KB GPU versus 120.7 + 116.8 KB).
- **Presentation timing:** Phaser's scene clock advances by capped frame deltas, so the Shatter break timeline slows when frames are slow. That is pre-existing behaviour, and it became visible here only because software WebGL is slow at 3×. Settlement uses the fixed-step runner and the ledger, not this clock.

## 6. Gameplay differences

**None intended, and none detected.**
- No changes to Logic, RNG, runner, replay, scene configs, world dimensions, pipe spacing or gaps, hitboxes, payout or settlement rules.
- Character visible-body size and centre are reproduced from polish-003 (`characterManifest.ts`).
- Presentation-only additions: lean, flame, flap pulse and puff, pick glow, and the current-row touch band height. The touch band is input geometry for the live row only, sized ≥ 44 CSS px. It never overlaps another live target, and it does not change which pane a correct tap on the glass selects.

## 7. Remaining risks and incomplete work

1. **No physical-device evidence.** Frame rate at 1170×2532, governor behaviour, Safari/Android text rendering, safe areas, audio unlock and rotation all need the owner's phone (model and browser still unknown), plus iPhone Safari and a mid-range Android.
2. **New artwork poses were not produced.** There is no wizard flap cycle, pilot lean frames or hurt pose; the animation is procedural on the single approved pose. An illustrator spec is in UI_AND_ASSET_SPEC §6.
3. Short-landscape Shatter canvas pane bands are 32–33 CSS px. This is the documented WCAG "equivalent control" exception, because ≥ 44 px rail buttons offer the same choice.
4. On 320-px phones, Flap's pre-gate footer label abbreviates to "RE…" (the value stays intact).
5. Localisation: English only. The DOM layout tolerates longer strings (wrap or ellipsis on labels), but no translations exist.
6. MDN, W3C, Hub88 and ST8 pages could not be fetched (network policy); claims from them are marked unverified.
7. The pre-existing large-chunk build warning is still present.
8. The host interface is a demo seam. See CASINO_INTEGRATION_READINESS §8 for the server and partner work.

## 8. How to reproduce

```bash
npm ci && npm run build && npm test
npx jest --config research/jest.research.cjs
npx vite --port 5199 --strictPort &                    # dev: harness + host page
npx vite preview --port 4173 --strictPort &            # release build
node tests/browser/polish003.browser.cjs
node tests/browser/polish004.browser.cjs
node tests/browser/polish004/perf.cjs
BASE_URL=http://localhost:4173/jett-game LABEL=after node tests/browser/polish004/capture-release.cjs
python3 -I research/art/export_characters.py           # regenerates character exports + manifest
```

Note: `polish003.browser.cjs` rewrites files under `docs/polish-003/implementation/evidence/` when it runs; `git checkout -- docs/polish-003` restores them.

Diagnostics:
- `?adaptive=0` fixes the density; `?quality=low|balanced` and `?rs=1` are QA overrides.
- `?debug=1` shows hitboxes.
- `?diag=1` exposes `window.__game` in release builds.
- In the harness, `__renderScale()`, `__fontStatus` and `__host.getTrace()` are available.

## 9. Recommended next milestone

**"Device truth and art frames."**
1. Run the physical-phone checklist on the owner's phone, an iPhone and a mid-range Android, and record frame-time percentiles at scales 3, 2 and 1.5. Tune the governor thresholds from that data.
2. Commission or produce a small authored pose set from the masters (wizard 3-frame flap, pilot 2 lean frames plus hurt), then swap it into the existing manifest placement.
3. Decide whether the result card and settings use a textured nine-slice frame or stay flat.
4. Only after that, scope a server-authoritative prototype round service for **one** game, to learn what the RGS layer requires.
