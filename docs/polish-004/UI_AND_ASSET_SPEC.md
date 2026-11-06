# polish-004 — UI and asset specification

## 1. Who draws what

| Layer | Owner | Why |
|---|---|---|
| Playfield (sky, hazards, pipes, glass, characters, effects, in-world hints and row labels) | **Phaser canvas** at render scale ≤ 3 (`RenderScaleController`) | Gameplay geometry, interpolation and collisions stay in one coordinate system (390×844 logical) |
| Shell surfaces (header/footer fills, stage frame and fillets, HUD scrim) | Phaser canvas | Must sit exactly behind and around the playfield, at the same density |
| **All interface text and controls**: back, title and brand wordmark, demo balance, HUD (phase, multiplier, progress), stake, return, CTA, no-cash-value label, result card, pause message, settings dialog | **Native DOM** (`SoftDepthShell`) | Browser-native density and hinting, Inter, reflow for narrow and landscape layouts, accessibility, one authoritative control |

**One control per action.** The canvas CTA, the canvas hit zones and the Phaser settings panel have been removed. Stage actions (Shatter panes, Flap "flap") remain canvas gameplay input. Their DOM buttons are keyboard and screen-reader focus targets with `pointer-events: none`. They accept pointers only once they move off-canvas into the landscape rail.

**Documented exception to the UITheme `drawButton` rule.** The shell's controls are DOM `<button>`s, not `drawButton` graphics. AGENTS.md's rule exists to stop Phaser Containers or Text being made interactive, and that is still respected: no Phaser Text or Container is interactive anywhere. Other games still use `drawButton`, unchanged.

## 2. Typography

- **Inter 4.x** (SIL OFL 1.1), self-hosted from `@fontsource/inter` 5.3.0: `public/fonts/inter/` holds weights 400, 600, 700 and 800 in the Latin and Latin-Ext subsets (8 × woff2, 240 KB on disk; a Latin page loads only the four Latin files ≈ 97 KB). Licence file: `public/fonts/inter/OFL.txt`.
- **Loading.** `loadShellFonts()` injects `inter.css`, then awaits `document.fonts.load()` for every weight with a 2.5 s cap before Phaser boots. Success is recorded from the FontFace `status` of each face, never from `fonts.check()`. Release evidence shows `loaded: [400,600,700,800]`, `timedOut: false`.
- Fonts not covered by the Latin subsets (the ← → arrows) fall back to the system face. This is acceptable for a hint.
- **Sizes** (`max(minimum, k × design size)`, where k = CSS px per logical px):

| Role | Design px | Min CSS px | Weight | Notes |
|---|---|---|---|---|
| Title | 14 | 12 | 700 | caps, may wrap to 2 lines on narrow phones |
| Caps labels (DEMO CREDITS, DEMO STAKE, phase) | 11 | 11 | 600–700 | tracking .10em (.05em compact) |
| Balance | 15 | 13 | 700 | tabular numerals |
| Multiplier | 34/37 | 22 | 800 | tabular |
| Progress line | 12 | 11 | 500 | wraps on narrow screens |
| Stake / return value | 19 / 16 | 14 / 13 | 700 | tabular |
| CTA | 14 | 13 | 700 | caps, .08em |
| Settings rows | 15 | 15 | 500 | dialog uses fixed CSS sizes |
| Result amount | 36 | 28 | 800 | tabular |

[Observed: `targets` test] All visible interface text measures ≥ 11 CSS px on 320×568, 390×844, 430×932, 667×375 and 844×390.

## 3. Components and states

- **CTA:** flat brand fill with a 1-px inner highlight; radius = brand radius × k. States:
  - pressed: 1 px translate and 92 % brightness;
  - focus: 3 px focus-token ring with 2 px offset;
  - disabled: raised surface with a hairline border and muted label.

  It activates on `pointerdown` for responsive cash-out timing, and the trailing click echo is ignored for 700 ms. Keyboard and assistive-technology activation arrives as a click with no preceding pointerdown. Its height is at least 44 CSS px at every scale.
- **Icon buttons:** 66×66 logical (44 CSS at k = 0.667), Lucide-style inline SVG, `aria-label`.
- **Settings:** a modal DOM dialog (`role=dialog`, `aria-modal`). The backdrop swallows pointers, focus is trapped, and Escape closes it. Five switch rows (`input[type=checkbox][role=switch]`, ≥ 44 px rows), theme radios (44×44 swatches, hidden when a brand fixes the accent), and a Close button (≥ 48 px). The round pauses while it is open and resumes only on a player action.
- **Result card:** DOM, pointer-transparent, fades in 160 ms (instant under reduced motion). Only an actual net win (return > stake) is coloured success.
- **Layouts:**
  - *Compact* (k < 0.8): tighter tracking.
  - *Compact immersive footer:* label and value inline with short labels; values never truncate.
  - *Rail* (k < 0.6 with side space): info panel on the left with the title, balance, HUD, stake, return and no-cash-value label; controls on the right with CTA, Shatter panes, Settings and Back at 176×48.
- **Shatter panes:** only the current row is live. Its touch band grows to ≥ 44 CSS px (cap 72 logical) without overlapping any other *live* target. Under the rail layout the canvas bands may be 32–33 CSS px tall, because the same choice is offered by ≥ 44 px rail buttons (the WCAG 2.5.8 "equivalent" exception). This is the **only target-size exception**.

## 4. Overlays: the owner's question

**Would premium overlays help?** Not for the blur. The blur was a framebuffer problem (see SHARPNESS_DIAGNOSIS). A downloaded "premium overlay" pack rasterises static decoration. It cannot sharpen a 390-px framebuffer, and it must never carry changing values (balance, multiplier, CTA labels).

What does help, and what this pass did instead:

| Problem | Fix class | Done here |
|---|---|---|
| Soft text and buttons | Rendering + typography | DOM text, Inter, density policy |
| Soft characters and effects | Rendering + asset preparation | Render scale, dense generated textures, cleaner exports |
| Cramped narrow and landscape layouts | Layout | Flex rows, compact footer, rail info panel |
| "Generic" feel of the buttons | Component design | States, radius tokens, consistent dialog |

Reusable assets that *would* add value later, in priority order:
1. A small authored icon set (SVG) for back, settings, sound and info.
2. A nine-slice result/settings panel frame, if the art direction wants texture. It can be CSS today.
3. Authored character pose atlases (§6).

Paid packs are not needed for the pilot, and no purchase was made.

## 5. Generated (code-drawn) textures

These are drawn at `TEXTURE_DENSITY = 3` and displayed at 1/3 scale (`makeDenseTexture`). Tile positions are multiplied by the density because Phaser 4 TileSprite `tilePosition` is in texture px [Observed: 30 → 10 px shift at tileScale 1/3].

| Texture | Size (px) | GPU bytes |
|---|---|---|
| Jett rocks ×4 | 288² | 1.33 MB |
| Jett coin | 96² | 37 KB |
| Flap far skyline | 1074×360 | 1.55 MB |
| Flap near skyline | 1074×258 | 1.11 MB |
| Shatter pane + 2 frames | 447×132 each | 0.71 MB |
| Shatter shards ×5 + runner | ≤ 66×93 | < 0.1 MB |

The Jett star field changed from a 358×664 tile texture to two vector Graphics copies, which are crisp at any scale and use no large texture. Atlases were **not** introduced: each scene uses one character image, and the generated textures are built at runtime, so an atlas would not reduce draw calls or downloads meaningfully. [Inference]

## 6. Character exports

Pipeline: `research/art/export_characters.py`, which also writes `public/assets/polish-004/manifest.json` and `src/shared/render/characterManifest.ts`. Provenance: `public/assets/polish-004/PROVENANCE.md`.

1. Alpha bounds (α > 8) are measured **before** edits, so the crop and aspect are identical to polish-003.
2. Pilot only: the baked-in jet flame (11,199 px) is erased. The game draws an animated flame at the manifest `nozzle` anchor.
3. Faint alpha (≤ 8) is cleared. This removes the large ghost padding: α > 0 spanned 1024×1311 of the master versus a 703×1063 visible body.
4. Premultiplied-alpha Lanczos downsample, so no dark or colour fringes.
5. A restrained dark contact outline, 2–2.2 px at ≈ 50–55 % alpha.
6. 4 px transparent padding.

| Export | Size | Download | GPU | vs polish-003 |
|---|---|---|---|---|
| `jett-pilot-r3.png` | 105×154 | 23.7 KB | 64.7 KB | was 154×196, 26.5 KB, 120.7 KB GPU |
| `jett-pilot-r2.png` | 72×105 | 12.3 KB | 30.2 KB | — |
| `flap-wizard-r3.png` | 152×125 | 25.9 KB | 76.0 KB | was 178×164, 21.8 KB, 116.8 KB GPU |
| `flap-wizard-r2.png` | 104×86 | 13.8 KB | 35.8 KB | — |

**Placement.** `characterPlacement()` reproduces polish-003's on-screen *visible-body* height (pilot 38.823 logical, wizard 31.085 logical) and its centre offset exactly. Collision boxes and gameplay footprint are unchanged; no enlargement was made. The r2 variant is used at render scale ≤ 2.25 and r3 above. Both give ≈ 1.25 texels per physical px. That density was chosen because LINEAR filtering without mipmaps aliases when a texture is ≥ 2× oversampled.

**Animation (presentation only; no RNG; respects reduced motion):**
- *Jett:* an eased lean of up to 12° (5° under reduced motion). The tapered vector flame has three lengths at 70 ms each, sits at the nozzle and rotates with the lean. Under reduced motion it is static.
- *Flap:* a 150 ms squash-stretch (+7 % / −4 %) on each accepted flap. A bristle puff emits from the broom anchor and follows the tilt. Both are off under reduced motion.
- *Shatter:*
  - a specular top edge on the panes;
  - one lit edge per shard;
  - a 220 ms selected-pane glow on safe steps (static under reduced motion);
  - the existing crack → shards → fall timeline, unchanged.

**Not done (honest gap).** This pass made no new poses. A real wizard flap cycle (2–3 wing/cape poses), a pilot lean frame set and a hurt pose need an illustrator working from the masters. Transforming the single master into "frames" would be fabricated animation. The production spec for that artwork:
- frames at identical pivots, using the manifest body box;
- 4 px padding;
- ≥ 160 px visible-body height in the master export;
- the same outline treatment;
- an atlas of ≤ 1024² per character.

## 7. Contact sheets and captures

| File(s) | What it shows |
|---|---|
| `evidence/crops/{jett,flap,shatter}-{header,hud,footer}-before-after@{1,2,3}x.png` | Native pixels, no resampling |
| `evidence/crops/{jett,flap}-character-actual-size-dpr123.png` | Characters at gameplay size, DPR 1/2/3 |
| `evidence/crops/jett-{header,footer,pilot}-before-A-B@3x.png` | Prototype comparison |
| `evidence/crops/overview-*-DOWNSCALED.png` | **Layout only; downscaled, not a sharpness proof** |
| `evidence/release/{before,after}/` | Full release screenshots with `capture-log.json` (CSS size, backing size, DPR, loaded faces, commit) |
