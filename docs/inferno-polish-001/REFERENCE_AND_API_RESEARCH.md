# Inferno polish 001 — Reference and API research

## 1. Focused reference pass (four titles, four studios)

**Method and limits.** I did one focused pass on 2026-11-05 through the official studio pages listed in the brief. I did **not** play any demo, watch any gameplay video or listen to any audio. This cloud session has no audio output or interactive video review, and the Hacksaw page opens behind an 18+ age prompt, which I did not bypass. There are therefore **no first-hand timestamps** for reel stop, win identification, removal, fall or feature intro. The rows below are labelled **R (official page text)** or **H (general genre knowledge, untested)**. No competitor art, sound, mechanic or RTP figure was copied into Inferno. Published RTP figures appear on some pages; they are not used anywhere.

| Title (studio) | Source checked | Page facts (R) |
|---|---|---|
| Fire Joker (Play'n GO) | playngo.com/games/fire-joker, "Fire Joker Slot Demo" | Released 13 Jun 2016. Classic 3-reel style. A Wild substitutes for all symbols. "Respin of Fire" triggers when two reels are stacked without a win; "Wheel of Multipliers" (up to x10) triggers on a full screen of one symbol. |
| Gates of Olympus (Pragmatic Play) | pragmaticplay.com/en/games/gates-of-olympus, "Play Gates of Olympus™ Slot Demo" | No release date on the page. Six tumbling reels, pay-anywhere wins with 8+ matching symbols, random multiplier symbols summed on winning tumbles. 4+ scatters award 15 free spins. **Different rule family from Inferno's adjacency clusters.** |
| Le Bandit (Hacksaw Gaming) | hacksawgaming.com/games/le-bandit, "Le Bandit" | No release date on the page. 6×5 cluster pays; "Super Cascades" also remove matching symbol types; positions in wins leave Golden Squares that later reveal coins. Three bonus tiers. Bonus buy and FeatureSpins exist (**explicitly out of scope for Inferno**). |
| Fire in the Hole (Nolimit City) | nolimitcity.com/games/fire-in-the-hole | Released 02-03-2021. 6 reels from 3 rows expanding to 6; collapses unlock rows; xBomb wild; mining theme. Features are explained with text blocks plus illustrations. Feature buy exists (**out of scope**). |

### Comparison (R where page-stated, H where inferred; nothing measured)

| Aspect | Fire Joker | Gates of Olympus | Le Bandit | Fire in the Hole | Inferno before → now |
|---|---|---|---|---|---|
| Hierarchy | Few symbols, one special (R) | Multiplier symbols are a distinct class (R) | Hero character, symbols, then special squares (R) | Theme-heavy, many features (R) | Emoji with similar weight → 7 distinct silhouettes, with WILD/SCATTER labelled |
| Pacing | Respin is a single, legible event (R) | Tumbles repeat while wins occur (R) | Cascades repeat while new wins form (R) | Each collapse unlocks a row (R) | One flash plus a teleport → identify → remove → real fall → settle (timed) |
| Readability | 3×3 compact board (R) | Large board, pay-anywhere (H: harder to see why it paid) | Golden Square memory of win positions (R) | Expanding grid (H: dense) | Outline plus connector bars over pre-removal coordinates |
| Neutral / loss / win | Not stated | Not stated | Not stated | Not stated | Net shown separately; positive colour and motif only when net > 0 |
| Audio layers | Not stated | Not stated | Not stated | Page doesn't describe sound | Loop plus 13 neutral or outcome-gated cues |
| Motion / skip | Not stated | Not stated | Not stated | Not stated | Tap to speed up, quick spin, reduced motion |
| Mobile weakness (H) | — | Dense pay-anywhere board on small screens | 6×5 board on narrow widths | Grid grows to 6×6 | 3×3 stays at 308 px wide on a 390 base |

### Five patterns to adopt (as applied)

1. **One readable feature event at a time** (Fire Joker's single respin moment). Each cascade step finishes before the next one starts; heat and feature notices are one line each.
2. **Separate the round result from the feature state** (Gates of Olympus separates base and feature, R). "RETURN SO FAR" is shown during a free-spin cycle and "ROUND RETURN" plus NET only after the cycle closes. Crown shows "AMOUNT AT RISK".
3. **Mark where the win was before removing it** (Le Bandit's Golden Squares, R). Winning cells are outlined and connected using pre-removal coordinates, then burn away, and survivors visibly fall.
4. **Features explained in plain text** (Fire in the Hole's text blocks, R). The Settings panel has a short "How it plays" section, including the honest note about the current all-WILD rule.
5. **Consistent material vocabulary** (Nolimit's theme coherence, R/H). Forge material throughout: brick, iron ribs, grate glow, ember sparks, anvil WILD, warm taps instead of bells.

### Five patterns to avoid

1. Bonus buy / FeatureSpins / paid feature odds (Le Bandit, Fire in the Hole). Not offered.
2. Expanding or dense boards that hurt small screens (FitH 6×6, Le Bandit 6×5). Kept at 3×3.
3. Pay-anywhere counting that hides *why* a spin paid (GoO). Inferno keeps adjacency, and the outline shows it.
4. Celebrating provisional or partial returns. No fanfare on cascades, partial returns, break-even or pending cycles.
5. Extreme volatility or max-win marketing. Nothing like that is shown, and observed maxima are reported only in the math report, labelled "observed".

No near-miss staging, spending/retention claims or psychology techniques were used.

## 2. Phaser APIs actually tested (installed package 4.0.0)

Probe: `research/inferno/probes/phaser-api-probe.cjs` → `evidence/run/07-phaser-api-probe.json`. It runs in the real harness page against `node_modules/phaser` (`Phaser.VERSION === "4.0.0"`). Types were checked in `node_modules/phaser/types/phaser.d.ts`.

| API | Result in 4.0.0 | Consequence for Inferno |
|---|---|---|
| `tweens.add({ onComplete })` | Fires once | Used for every awaited phase, with an extra single-call guard |
| `tween.stop()` | Fires **onStop**, not onComplete | Awaited tweens are never stopped. Playback is cancelled with a token so stale callbacks no-op |
| `tweens.killTweensOf()` | Fires neither | Only used on non-awaited tweens (identify pulse, heat segments) |
| `tweens.timeScale`, `time.timeScale` | A 400 ms tween/delay finished in about 101/116 ms at ×4 | Used for quick spin (×1.8) and tap-to-skip (×6). Reset after every round |
| `TimerEvent.remove(false)` | Callback does not fire | Used by `cancelPlayback()` and free-spin timers |
| `add.particles(..., { maxAliveParticles: 24 })` + `explode()` | 40 requested → **24 alive** | Board-wide spark cap enforced by Phaser plus the UI's budget |
| `emitter.destroy()` | Inactive afterwards | Called in `InfernoUI.destroy()` |
| `textures.createCanvas()` + `CanvasTexture.add(frame)` | 9 frames on a 1568×192 source | Single code-drawn atlas (7 symbols, coin, spark) |
| `Graphics.generateTexture()`, `make.graphics({}, false)` | Works | Baked HUD faces and heat segments (performance, see implementation report) |
| `InputManager.inputCandidate` | Skips objects whose `willRender()` is false (alpha 0 or invisible) | Baked buttons keep a *cleared* (empty but visible) `drawButton()` `bg` as the hit target |
| `WebAudioSoundManager` (`sound.context`, `locked`, `'unlocked'`) | One context; locked/suspended until the first gesture; the same object across 5 and 50 restarts | No extra AudioContext. Music starts on the `unlocked` event |
| Game BLUR/FOCUS → `pauseOnBlur` | The context suspended on blur and resumed on focus | Verified in the lifecycle probe |
| Document visibility → game HIDDEN/VISIBLE | Emitted; the loop records `pauseDuration` (433 ms in the test) | A spin completed normally after hide/show |

**Shared components assessed, not reused:**
- `SlotAnimator` can't move individual cells (it has no old→new mapping), and changing it would affect Surge, Alchemist and Masquerade. Inferno therefore uses a local renderer, and `SlotAnimator` is unchanged.
- `GameHeader`/`GameFooter` are HTML overlays with an emoji logo and a gold border, which don't match the approved Refined 2D shell. The Inferno header is drawn in-canvas to match `VISUAL_REVISION_004`.
- `CasinoAudioManager` creates its own AudioContext per instance, so it was replaced *for Inferno only*.

## 3. Tools and licences

| Tool / asset | Use | Licence / terms |
|---|---|---|
| Phaser 4.0.0 | Engine (existing dependency) | MIT |
| Playwright + Chromium (pre-installed) | Harness probes, screenshots, silent video | Apache-2.0 / BSD-style |
| ffmpeg (system) with libvorbis, libmp3lame, libx264 | Encoding, ebur128 loudness, video transcode | LGPL/GPL tools used offline. Output files carry no licence obligation from the tools |
| Node + TypeScript transpile (existing devDependency) | Offline audio generator, simulators | MIT / Apache-2.0 |
| Pillow (system Python) | Contact sheets for review only | HPND |

Aseprite, Vital and REAPER were **not** used. All Inferno art is deterministic code (Canvas 2D in `InfernoUI.ts`), and all audio is original procedural DSP (`research/inferno/audio/render-audio.cjs`). Provenance: `public/assets/inferno/ASSET_SOURCES.md`.
