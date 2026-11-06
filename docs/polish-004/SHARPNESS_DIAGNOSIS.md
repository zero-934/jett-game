# polish-004 — Sharpness diagnosis

Branch `opus/polish-004-sharpness` (base `opus/polish-003-controls` @ `148a094`). Date 2026-11-06.

**Evidence labels used throughout:** **[Observed]** measured or seen in this session · **[Docs]** backed by documentation or installed source code · **[Inference]** my reasoning from the above · **[Unverified]** assumption not checked.

**Scope of the evidence:** every measurement here comes from headless Chromium 153.0.8010.12 in a cloud container. DPR was **emulated** with Playwright `deviceScaleFactor`. WebGL ran on **SwiftShader (software)**. **Nothing here was measured on a physical phone.** The owner's phone model and browser are still unknown.

## 1. Answer in one paragraph

The blur came from the **canvas framebuffer**. It was not caused by the character textures or the font files. Every pilot rendered into a **390×844 backing store at every device pixel ratio**. A DPR 3 phone therefore upscaled the whole frame 3× in the compositor: text, buttons, vector art and sprites alike. Two smaller problems sat on top of that. **Inter was never loaded**, so canvas glyphs used a fallback face. The character exports also carried large **faint-alpha padding** that wasted texels. The fix is a hybrid. The Phaser playfield now renders at device density, capped at 3×. All interface text and controls are native DOM, which the browser draws at native density with a self-hosted, verified Inter.

## 2. Runtime and package facts

| Item | Value | Label |
|---|---|---|
| Phaser | 4.0.0 (`node_modules/phaser/package.json`) | [Observed] |
| Game-level `resolution` config | Not read by Phaser 4. `ScaleManager.setGameSize/resize` set `canvas.width = baseSize.width` (`src/scale/ScaleManager.js` ~L796, L861). No DPR term appears anywhere in the scale or core code. `devicePixelRatio` occurs only in `device/OS.js` (`OS.pixelRatio`) and Matter's debug renderer. | [Docs: installed source] |
| `Text.setResolution(n)` | Rasterises the glyph texture at n×, but the texture is still drawn into the 390×844 framebuffer, so the extra pixels are thrown away. | [Docs: Phaser `skills/text-and-bitmaptext`] + [Observed: before crops] |
| Scale mode | `Phaser.Scale.FIT`, `CENTER_BOTH`. The CSS size comes from the parent and the aspect ratio only. | [Docs: source] |
| Texture filtering | LINEAR without mipmaps by default; `pixelArt` would select NEAREST. | [Docs: "Phaser 4 Rendering Concepts"] |
| Vite | 8.0.8; TypeScript ~6.0 | [Observed] |

## 3. Measured baseline (release build of `148a094`)

Script: `tests/browser/polish004/measure.cjs` → `evidence/render-measurement-before-release.json` (45 rows: 3 games × 5 viewports × DPR 1/2/3).

| Viewport (CSS) | DPR | Canvas CSS | Backing store | Backing px per physical px |
|---|---|---|---|---|
| 390×844 | 1 | 390×844 | 390×844 | 1.00 |
| 390×844 | 2 | 390×844 | 390×844 | **0.50** |
| 390×844 | 3 | 390×844 | 390×844 | **0.33** |
| 430×932 | 3 | 430×930.6 | 390×844 | **0.30** |
| 320×568 | 3 | 262.4×568 | 390×844 | **0.50** |
| 844×390 | 3 | 180.2×390 | 390×844 | 0.72 |

[Observed] The values are identical for Jett, Flap Fortune and Shatter Step. `image-rendering` was `auto`, with no CSS transform on the canvas.

**Fonts [Observed]:** the production HTML requested Google Fredoka, and its 7 FontFace entries were all `unloaded`. No Inter face existed anywhere. The shell asked for `"Inter", system-ui…`, so the canvas used the system fallback. `document.fonts.check('600 16px Inter')` returned **`true`** even though no Inter face existed. This is the documented trap: `check()` reports true when no face matches. It proves nothing. [Docs: CSS Font Loading semantics, as stated in the brief; MDN could not be fetched here, see §8]

## 4. Resampling chain, stage by stage

| Stage | Before | Limiting? | Evidence |
|---|---|---|---|
| Glyph raster → text texture | `setResolution(min(3,DPR))`, so 3× at DPR 3, using a **fallback face** | Face wrong; density fine | [Observed] fonts |
| Text texture → framebuffer | Downsampled 3:1 into 390×844 | **Yes: the information is discarded here** | [Observed] crops |
| Framebuffer → CSS → physical | Upscaled 3× by the compositor (bilinear) | **Yes: the visible softness** | [Observed] `evidence/crops/jett-header-before-A-B@3x.png` |
| Character source → runtime PNG | 1079×1458 master → 154×196 PNG, with the visible body only 104×156 inside it (faint alpha > 0 spans 1024×1311 of the master; alpha > 8 spans 703×1063) | Wasted texels; the body still had ≈1.07 texels per physical px at DPR 3 | [Observed] `export_characters.py` manifest |
| Sprite → framebuffer | ~39 logical px body → 39 framebuffer px | **Yes**: 39 framebuffer px against 117 physical px | [Observed] `jett-character-actual-size-dpr123.png` |
| Generated textures (rocks, panes, skyline, stars) | Drawn at 1× logical size | Would have become the next limit once the framebuffer was fixed | [Observed] stars stayed soft in prototype A until made vector |

**Conclusion [Inference from Observed]:** the framebuffer was the dominant limit. A larger source PNG alone would have changed nothing visible, because the sprite was already downsampled into a 390-px-wide buffer. Shipping font files alone would have changed the face but not the softness.

## 5. Source vs release vs harness differences

- [Observed] The research harness (`research/harness/index.html`) forced `image-rendering: pixelated`. Production uses `auto`. The override is now removed, so both entry points match.
- [Observed] The harness ordered scenes by `class.name`, which minification can rename. It now routes by scene key. The production `LockScene` already deep-links by key. The release test (`release` section) checks that the minified build activates exactly the requested scene for all 11 registered games.
- [Observed] Production loads Fredoka for the other (non-pilot) scenes. That is unchanged. Inter is now self-hosted and loaded before boot in both entries.

## 6. The two prototypes (real Jett/Flap/Shatter scenes, not mockups)

**A — high-density Phaser output** (commit `5dd08df`). `RenderScaleController` enlarges the game size through the Scale Manager, so Phaser keeps ownership of the canvas. It zooms the main camera from the top-left and re-rasterises Text at the matching resolution. Logical coordinates stay 390×844. Pointers are mapped through the camera (`pointer.x` is in backing px).
**B — native DOM interface** (commit `9eedda7`). The shell's text, CTA, icons, result card, pause message and settings become visible DOM. Phaser keeps the playfield and the panel surfaces.

| | Before | A (Phaser text @3×) | B only (DOM text, canvas 1×) | **A+B (chosen)** |
|---|---|---|---|---|
| Header/footer text @ DPR 3 | soft | crisp | crisp | crisp |
| Pilot/playfield @ DPR 3 | soft | crisp | **soft** | crisp |
| Text when the governor drops canvas density | n/a | soft again | crisp | **crisp** |
| Narrow 320×568 | labels ≈7 px | labels ≈7 px | ≥ 11 px, reflowed | ≥ 11 px, reflowed |
| Short landscape 844×390 | text ≈5–6 px | same | readable in the side panel | readable in the side panel |
| Controls | canvas zone + hidden DOM twin | same | one real `<button>` each | one real `<button>` each |
| Pointer accuracy | ok | ok (camera-mapped) | ok | ok (tests: resize, DPR 2→3, rotation) |
| Main-thread step (Jett, p50) | 1.3 ms | 2.3 ms | — | 2.3 ms |

Evidence for the table: `evidence/prototypes/{A-phaser-highdpi,B-dom-shell-canvas-rs1,B-dom-shell}/` and `evidence/crops/jett-{header,footer,pilot}-before-A-B@3x.png` (native pixels, no resampling).

**Decision [Inference from Observed]:** use **A+B**. A is required for the playfield and characters. B gives crisp text that does not depend on canvas density, works with narrow and landscape reflow, provides accessibility, and gives one authoritative control per action. The tradeoff: DOM text is positioned over the canvas, so it must track the canvas rectangle. `layoutDom` follows Phaser's RESIZE event, window resize and DPR changes, and the pointer/rotation tests cover it.

## 7. Density policy (chosen)

`decideRenderScale(cssWidth, dpr)` in `src/shared/render/RenderScalePolicy.ts`:
- target = CSS width × DPR / 390. It rounds **up** to a 1/8 step, so the compositor slightly downsamples rather than upsamples.
- cap 3 (`high`), 2 (`balanced`) or 1.5 (`low`). The budget is 1170×2532 px. The floor is 1.
- [Observed] after-release values: 390×844@3 → **1170×2532 (1.00 per physical px)**; 320×568@2 → 536×1161 (1.02); 430×932@3 → 1170×2532 (capped, 0.91); 844×390@3 → 585×1266 (1.08). See `evidence/render-measurement-after-release.json`.
- **Adaptive governor:** it steps down one way (high → balanced → low) after two consecutive 90-frame windows with a median interval above 25 ms, and never steps back up. [Observed] In SwiftShader it stepped 1170×2532 → 585×1266 without touching the round. DOM text stays crisp throughout.
- Non-pilot scenes are untouched. The game size returns to 390×844 when a pilot shuts down. [Observed: `release` test: Jett → Dice restores 390×844.]

## 8. Research performed and its limits (access date 2026-11-06)

| Source | Role | Access |
|---|---|---|
| Phaser 4.0.0 installed source (`src/scale/ScaleManager.js`, `src/cameras/2d/*`, `src/gameobjects/graphics/Graphics.js`, TileSprite) and bundled docs (`docs/Phaser 4 Rendering Concepts`, `skills/scale-and-responsive`, `skills/text-and-bitmaptext`) | Primary for engine behaviour | Read locally |
| Search: "Phaser 4 high DPI canvas devicePixelRatio blurry text": results incl. phaser editor issue #15, html5gamedevs threads on resolution, kirupa high-DPI canvas guide | Secondary, general canvas practice | Search snippets only |
| W3C WCAG 2.2 Understanding 2.5.8 Target Size (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html | 24×24 AA minimum, 44×44 for 2.5.5 Enhanced (AAA), and the "equivalent control" exception | Search snippets only; direct fetch blocked |
| MDN `devicePixelRatio` / Optimising canvas / `postMessage` | Canvas DPR scaling, postMessage origin checks | **Blocked by this environment's network policy** (developer.mozilla.org not allowlisted). The guidance applied here is standard and matches the brief, but it was not re-read this session. **[Unverified this session]** |

Not done: no claim about how other studios render their UI. I could not observe or play competitor games here.

## 9. Physical-phone validation still required

Confirm on the owner's actual phone (model and browser to be supplied), then iPhone Safari and an Android Chrome mid-range device:
1. Backing size and DPR. Run in the console: `__renderScale()` (harness) or `?diag=1` (release).
2. Whether the governor triggers (`__renderScale().downgrades`) and the frame times at 1170×2532.
3. Text crispness of the header, footer, CTA, result card and settings.
4. Safe areas, rotation, audio unlock, and the touch feel of steering, flapping and pane taps.
