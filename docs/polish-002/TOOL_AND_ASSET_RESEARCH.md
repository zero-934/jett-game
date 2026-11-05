# JETT-POLISH-002 — Tool and Asset Research

Date checked for every row: **2026-11-05**.

**How facts were gathered:**
- **Licence and maintenance** come from the npm registry (`npm view <pkg> license version time.modified`; raw output in `logs/npm-registry-metadata.txt`) or from the project's own licence page fetched with curl.
- **"Last publish"** is the npm `time.modified` date. It is a proxy for maintenance, not proof.
- **Not collected:** GitHub repository activity, because the GitHub API was refused for repositories not attached to this session.
- **Unreachable here (marked UNVERIFIED):** pixabay.com, sonniss.com, freesound.org and audacityteam.org returned 403, and aseprite.org/eula returned 404.

**Categories:**
- **(a)** open-source software
- **(b)** free proprietary software
- **(c)** asset library with its own licence

**Phaser compatibility:**
- **Bundled guide:** Phaser 4.0.0 ships version-matched guidance in `node_modules/phaser/skills/*` and `node_modules/phaser/docs/*`. That includes "Phaser Compact Texture Atlas Format Specification" and "WebGL Compressed Textures in Phaser" with a `compress-texture.sh`.
- **Format support:** Phaser loaders accept JSON-hash/array atlases (`load.atlas`), multiatlas, spritesheets, Aseprite JSON (`load.aseprite`), bitmap fonts, and compressed textures (`load.texture` with KTX/PVR).
- **Evidence:** these are confirmed by the presence of the corresponding loader files in `node_modules/phaser/src/loader/filetypes/`.

## Principle
**Rule 1 — prefer what's already there.** Phaser 4 already provides particles, tweens, timelines, frame animation, atlases, render textures, filters, sound (with mobile unlock) and a ScaleManager. Recommend a dependency only where nothing in Phaser or the existing browser tooling solves the problem.

**Rule 2 — build-time over runtime.** Most recommendations below are **build-time or desktop tools** and add **zero runtime bytes**.

---

## 1. Texture atlas and sprite-sheet generation

| Option | Cat. | Source | Licence / attribution | Last publish | Solves here | Phaser compat | Effort / cost / risk | Verdict |
|---|---|---|---|---|---|---|---|---|
| **free-tex-packer-core** | a | npm `free-tex-packer-core`; repo github.com/odrick/free-tex-packer-core | MIT, no attribution in output | 0.3.9, 2026-07-24 | Packs PNGs into a Phaser JSON-hash atlas from a Node script (`scripts/pack-atlas.mjs`), so asteroids, coins, gates and UI icons become one batched texture | Has a "Phaser 3" exporter (JSON hash). Phaser 4 `load.atlas` reads the same format (unchanged loader) | S: dev-dependency only, 0 runtime bytes. Risk: low-activity single-maintainer project | **Recommended now** (when the first raster assets land) |
| TexturePacker | b | codeandweb.com/texturepacker | Proprietary; free tier with paid Pro features (download page reached; feature split not re-verified) | n/a | Same, plus polygon trimming | Native Phaser exporter | No cost to try, but Pro features need purchase (not allowed in this phase) | Later / optional |
| Phaser `Graphics.generateTexture` / `RenderTexture` | a (Phaser) | bundled | MIT | 4.0.0 | Bake today's code-drawn asteroids, coins, gates and glass tiles into textures at boot. No art pipeline needed | Native | S | **Recommended now** (no new dependency) |
| Phaser Compact Texture Atlas format | a (Phaser) | `node_modules/phaser/docs/Phaser Compact Texture Atlas Format Specification` | MIT | 4.x | Smaller atlas JSON | Phaser 4 only | Needs an exporter (none evaluated) | Later |

## 2. Sprite and character animation

| Option | Cat. | Source | Licence | Solves | Verdict |
|---|---|---|---|---|---|
| **Phaser frame animations + tweens/timelines** | a | bundled | MIT | Thruster flicker, wizard cloak, broom bob, player idle and impact squash. Characters stay lightweight (3–6 frame cycles plus tweened transforms) | **Recommended now** |
| LibreSprite | a | github.com/LibreSprite/LibreSprite (LICENSE fetched) | **GPL-2.0** (the tool; output art is yours) | Free pixel/sprite editor that exports sheets | Recommended (desktop tool) if a pixel-art style is chosen. Not needed for the vector directions |
| Aseprite | b/source-available | aseprite.org | Paid EULA (page 404 here: **UNVERIFIED**) | Best-in-class sprite editor; Phaser has `load.aseprite` | Later (purchase not allowed now) |
| Spine (+ runtimes) | b | esotericsoftware.com | Runtimes require a **Spine Editor licence** for the product (licence page fetched) | Skeletal animation | **Rejected** (licence cost and runtime weight for 3 simple characters) |
| DragonBones | a | — | not re-verified | Skeletal | **Rejected** (maintenance uncertain; Phaser 4 runtime support not evidenced) |

## 3. Raster and vector art production, reusable UI

| Option | Cat. | Licence | Solves | Verdict |
|---|---|---|---|---|
| **Inkscape** | a | GPL (tool) | Vector source for both directions (the mockups in `docs/polish-002/mockups` are SVG). Export PNG at 1×/2× | **Recommended now** |
| **Krita** | a | GPL-3 (krita.org licence page: "free to use … including commercial work") | Painted backdrops for Direction B | Recommended for B |
| **svgo** | a | MIT, 4.1.0 (2026-08-24) | Optimise SVG sources before rasterising | Recommended (build-time) |
| **sharp** | a | Apache-2.0, 0.35.5 (2026-09-27) | Scripted SVG→PNG/WebP rasterisation at 1×/2×, resizing and atlas inputs | **Recommended now** (dev-dependency) |
| **Lucide (lucide-static)** | c/a | ISC, 1.69.0 (2026-11-05) | Back, settings, sound, haptics and info icons for the shared HUD (the lobby already uses Lucide outlines per git history) | **Recommended now** (copy individual SVGs; keep the ISC notice) |
| game-icons.net | c | **CC BY 3.0, attribution required** (about page: credit "Icons made by {author}. Available on https://game-icons.net") | Coin, gem and shield pictograms | Later, only with an attribution screen |

## 4. Particles and procedural effects

| Option | Cat. | Solves | Verdict |
|---|---|---|---|
| **Phaser 4 ParticleEmitter** | a (bundled) | Thruster trail, coin sparkle, combustion burst, glass shards (Shatter today uses 10 tweened Rectangles per break) | **Recommended now.** The v4 config format is documented in `node_modules/phaser/skills/particles/SKILL.md`; 44 official v4.1 examples at phaser.io/oss/examples/v4.1.0/game objects/particle emitter. No dependency |
| Phaser 4 filters (glow, blur, colour matrix) | a | Gold rim-light, win glow, danger vignette | Recommended with a fallback tier (filters cost fill-rate) |
| Third-party particle libraries | — | — | **Rejected** (redundant) |

## 5. Audio: editing, generation, browser management

| Option | Cat. | Licence | Solves | Verdict |
|---|---|---|---|---|
| **Phaser Sound Manager** (`this.sound`) | a (bundled) | MIT | One shared AudioContext, mobile unlock on first gesture, mute and volume, pause on hidden. Fixes R-OWN-1 | **Recommended now** |
| Audacity | a | GPL (page 403: **UNVERIFIED** here; widely documented as GPL-2/3) | Trim, normalise and loudness-match SFX | Recommended (desktop tool) |
| **jsfxr** | a | npm metadata lists **no licence field**; LICENSE file 404 at the path tried: **UNVERIFIED** | Procedural retro SFX generator | Use the web UI to *author* sounds only (generated audio output is yours); **do not** bundle the library until the licence is confirmed |
| ChipTone (SFB Games) | b | "free tool for generating sound effects" (itch.io page fetched); commercial-use terms not stated on the page | Same | Optional; confirm terms before shipping its output |
| Kenney audio packs | c | **CC0** ("all game assets on the asset pages are public domain licensed (CC0) … even in commercial projects": kenney.nl/support) | UI clicks, coin and impact SFX | **Recommended now** |
| howler.js | a | MIT, last publish 2023-09-19 | Audio playback | **Rejected** (Phaser Sound already covers it; stale) |
| Tone.js | a | MIT, 15.1.22 (2026-10-31) | Synthesis | **Rejected** for now (adds ~100 kB+ runtime; the existing CasinoAudioManager covers procedural tones) |
| Freesound / Sonniss GDC bundle / Pixabay audio | c | Per-sound or custom licences; sites 403 here: **UNVERIFIED** | — | Later, per-file review only (Freesound includes CC-BY-NC sounds, which are not usable commercially) |
| ffmpeg | a | LGPL/GPL (tool) | Encode `.webm`/Opus + `.m4a`/AAC pairs for Safari | Recommended (build-time) |

## 6. WebGL and frame profiling, texture and memory inspection

| Option | Cat. | Licence | Solves | Verdict |
|---|---|---|---|---|
| **Chrome DevTools Performance + Memory, CDP via Playwright** | b (free) | — | Frame timeline, heap snapshots, forced GC, CPU throttling. Used in this research (`probe: perf`, `probe: restarts`) | **Recommended now** |
| **Spector.js** | a | MIT, 0.9.33 (2026-09-14) | Capture one WebGL frame: draw calls, textures, state changes. Verifies atlas batching gains | Recommended (browser extension or dev-only import; never shipped) |
| stats.js | a | MIT, last publish 2022-06-27 | FPS overlay | **Rejected.** Use a 20-line in-house overlay reading `game.loop.actualFps` and timing hooks (`prestep`/`postrender`) |
| Android `chrome://inspect` + Safari Web Inspector | b | — | Real-device profiling | **Required** before any mobile performance claim |

## 7. Browser automation, replay and visual regression

| Option | Cat. | Licence | Solves | Verdict |
|---|---|---|---|---|
| **@playwright/test** | a | Apache-2.0, 1.64.1 (2026-11-05) | Promote `research/probes/*.cjs` into specs: deterministic stepping via `game.loop.step`, screenshot assertions (`toHaveScreenshot`), device emulation, CDP | **Recommended now** (dev-dependency). The session's preinstalled Playwright is 1.63.0, so pin a matching version or install browsers in CI |
| pixelmatch | a | ISC, 8.0.0 (2026-10-06) | Image diff if not using Playwright's built-in comparator | Not needed (Playwright includes comparison) |
| Lighthouse / @lhci/cli | a | Apache-2.0, 13.6.0 / 0.16.0 | Load performance, bundle weight, accessibility basics of the HTML shell | Later (canvas content is opaque to it) |

## 8. Accessibility and mobile viewport testing

| Option | Cat. | Licence | Solves | Verdict |
|---|---|---|---|---|
| **axe-core** (via @axe-core/playwright or direct) | a | MPL-2.0, 4.14.0 (2026-11-05) | Audits the DOM shell, the proposed `aria-live` mirror and the settings sheet. **Cannot audit canvas pixels** | Recommended with the DOM HUD mirror |
| Playwright device emulation | a | Apache-2.0 | Viewports, DPR, touch, `prefers-reduced-motion`, colour scheme | **Recommended now** |
| Manual checks against WCAG 2.2 SC 2.5.8 (24×24 min target; fetched from w3.org) and Game Accessibility Guidelines (gameaccessibilityguidelines.com basic tier) | — | — | Target size, contrast, motion, speed options | **Recommended now** |

## 9. Asset compression, font delivery and loading

| Option | Cat. | Licence | Solves | Verdict |
|---|---|---|---|---|
| **sharp** (WebP/AVIF/PNG output) | a | Apache-2.0 | WebP atlases (Phaser loads via the browser image decoder) | **Recommended now** |
| oxipng (`oxipng-bin` wrapper) | a | MIT wrapper; last publish 2023-01-22 | Lossless PNG | Optional (sharp's PNG output is adequate) |
| pngquant (`pngquant-bin`) | a | **GPL-3.0+** | Lossy PNG palette reduction | Optional; build-time use only (GPL does not attach to the output images) |
| KTX2/Basis compressed textures | a | Phaser docs + `compress-texture.sh` bundled | GPU memory savings | **Later.** Only if atlas sizes exceed ~4 MB decoded; adds a transcoder |
| **@fontsource/inter, @fontsource/fredoka** | c/a | **OFL-1.1** (Inter LICENSE fetched: SIL OFL 1.1) | Self-host the two fonts the UI uses (Inter is referenced by UITheme but **never loaded** today). Removes the Google Fonts third-party request | **Recommended now** |
| subset-font / glyphhanger | a | BSD-3 / MIT | Subset to Latin + digits + × → ~15–25 kB woff2 each (estimate) | Recommended (build-time) |
| vite-plugin-image-optimizer | a | MIT, 2.0.3 | Automatic compression in `vite build` | Optional (a sharp script is simpler and explicit) |
| Code-splitting with dynamic `import()` per scene | a (Vite) | — | 1.54 MB single chunk → lobby + per-game chunks | **Recommended** (no dependency) |

## 10. Reusable asset libraries (licences evaluated individually)

| Library | Licence evidence | Commercial reuse | Attribution | Use |
|---|---|---|---|---|
| **Kenney** (kenney.nl/assets) | Support page: "all game assets on the asset pages are public domain licensed (CC0) … even in commercial projects" | Yes | Not required (credit appreciated) | **Preferred source**: UI audio, particle sprites, generic space props. Verify each pack's bundled `License.txt` when downloading |
| game-icons.net | CC BY 3.0 (about page) | Yes | **Required** | Icons only with a credits screen |
| OpenGameArt | FAQ: licences vary per submission (CC0, CC-BY, CC-BY-SA, GPL, OGA-BY) | Depends | Depends | Per-asset review only; avoid CC-BY-SA and GPL art in proprietary builds |
| Lucide | ISC | Yes | Keep notice | HUD icons |
| Inter / Fredoka | OFL-1.1 | Yes (fonts cannot be sold standalone) | Keep licence file | Fonts |
| Freesound, Pixabay, Sonniss | **UNVERIFIED** (403 here) | — | — | Do not use until reviewed per file |

"Free download" was not treated as proof of reuse rights anywhere above. Nothing was purchased or subscribed to.

## Summary: what to adopt now

1. Phaser built-ins (particles, tweens, Sound, `generateTexture`): **no new dependencies**.
2. Dev-only:
   - `@playwright/test` (pin the version)
   - `sharp`
   - `free-tex-packer-core`
   - `svgo`
   - `@fontsource/inter` and `@fontsource/fredoka` (the font files are shipped, ~50 kB)
3. Desktop tools: Inkscape and Krita (and LibreSprite if a pixel style is chosen), Audacity, ffmpeg.
4. Assets: Kenney CC0 audio and particle sprites, Lucide icons, self-made vector art per VISUAL_DIRECTIONS.
5. Explicitly rejected: Spine, DragonBones, howler.js, stats.js, third-party particle libraries, Tone.js (for now).
