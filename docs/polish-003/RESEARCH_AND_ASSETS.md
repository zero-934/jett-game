# Research basis, tools and asset provenance

## What informed this direction

The layout study considered crash/instant/choice games across several studios. This handoff uses their information hierarchy and product patterns, not copied artwork or a claim that all games share the same mathematics. Public product pages can change; rules differ by operator/version. No operator skin is a design specification for our game.

| Reference | Useful observation / application |
|---|---|
| [SmartSoft JetX](https://www.smartsoftgaming.com/games/jetx) | The flight is readable at a glance; keep multiplier and return controls separate from decorative flight art. |
| [SPRIBE Aviator](https://www.spribe.co/games/aviator), [public rules reference](https://yesplay.bet/assets/documents/spribe-Aviator.pdf) | Distinct betting/playing/settled states and an explicit cash-out action. Our skill games need their own state rules; do not transplant its chance model or double-bet panel. |
| [Pragmatic Play Spaceman](https://www.pragmaticplay.com/en/games/spaceman/), [rules reference](https://yesplay.bet/assets/documents/pragmatic-play-spaceman-rules.pdf) | A compact character can coexist with a restrained multiplier-first HUD. Public rules PDF is a historical reference, not proof of the latest operator version. |
| [Stake Crash](https://stake.com/casino/games/crash) and [Mines](https://stake.com/casino/games/mines) | Clear separation between playfield and stake/action controls; explicit phase and payout information. Do not add social feeds or desktop panels to our mobile shell. |
| [BGaming Space XY](https://bgaming.com/games/space-xy) and [Aviamasters](https://bgaming.com/games/aviamasters) | Compact theme-led action with reusable assets. Aviamasters is not equivalent to our manual cash-out games; landing/outcome mechanics must not be copied. |
| [SPRIBE Pilot Chicken](https://spribe.co/games/pilot-chicken), [Evoplay Long Ball](https://evoplay.games/game/long-ball/), [Galaxsys Cash Show](https://galaxsys.co/games/cash-show/) | Different themes can retain familiar controls, clear progress and a single dominant decision. These are adjacent references, not crash-game classification claims. |
| [BGaming exclusive games](https://bgaming.com/marketing/exclusive-games), [Evoplay branded games](https://evoplay.games/branded-games-by-evoplay/) | Studio branding offerings support separating visual skins from core game behaviour. They do not prove that our own integration/theming API is implemented. |

The preceding visual research covered 11 products across eight brands, including custom-brand offerings. This document preserves the reference trail; the detailed independent tool/asset evaluation is [polish-002/TOOL_AND_ASSET_RESEARCH.md](../polish-002/TOOL_AND_ASSET_RESEARCH.md). We have not reverse-engineered their private cash-out implementations, measured their internal latency or certified their fairness. The proposed interaction rules are ours and must be tested locally.

For universal casino fit, keep the game recognisable while changing accent/logo/background through semantic tokens. Favour modern text, neutral surfaces, a crisp central multiplier, readable materials and an anchored CTA. Avoid making “premium” synonymous with black-and-gold ornament. Do not introduce auto-bet, dual wagers, chat, real-money currency selectors or aggressive retention prompts because competitors have them.

## Practical tool choices

Use Phaser's existing tweens, texture atlases, particle emitters and sound service first; profile before adding effects. [Phaser rendering concepts](https://phaser.io/tutorials/phaser-4-rendering-concepts) is a starting reference; check exact installed-version APIs. Suggested **dev-only**, separately reviewed additions: Playwright for deterministic browser captures/input/lifecycle tests; Sharp or an atlas packer for texture processing; SVGO for original vectors. Verify supported Phaser atlas schema rather than assuming a Phaser3 exporter is compatible. Desktop asset editing can use Inkscape, Krita, Audacity and ffmpeg.

Optional asset sources: [Kenney](https://kenney.nl/assets) (check each pack's CC0 notice), [Lucide](https://lucide.dev/license) (ISC), [Inter](https://github.com/rsms/inter) (OFL). Keep license files and source URLs when actually vendoring. These are recommendations; no third-party packs/fonts/icons were installed by this handoff. Do not add Spine, DragonBones, a second audio engine or a runtime shader framework for this pilot. Check [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) against actual rendered UI.

## Included asset manifest

| File | Origin / purpose | Production status |
|---|---|---|
| `assets/approved-direction-b-reference.png` | Earlier generated A/B/C comparison supplied in this task; **only B** is selected | Direction reference; do not use screenshot/UI as a texture |
| `assets/jett-pilot-study.png` | Generated with the built-in image tool for this task: one isolated compact ivory-suit pilot, gold visor, small rear jetpack and short warm exhaust, soft shaded2D, transparent background | Usable study; requires downsample/readability and atlas QA; no collision geometry implied |
| `assets/flap-wizard-study.png` | Generated with the built-in image tool for this task: isolated side-view wizard facing right on broom, purple robe/hat, pale beard, soft shaded2D, transparent background | Usable study; animation frames and small-size simplification still needed |
| `renders/*.svg` | Original code-authored layouts/material approximations from `render-mockups.cjs`, embedding the two studies | Editable art/layout references, not browser gameplay evidence |
| `renders/*-board.jpg` and `renders/glass-sequence.jpg` | Local browser captures of the SVG reference viewer | Review images only; full-resolution SVGs remain authoritative |
| `renders/before-after.jpg` | Existing Opus baseline screenshots next to proposed SVGs | Clearly labelled actual baseline versus concept; not a measured after implementation |

No competitor image was copied into these assets. Preserve this provenance and obtain the project's normal rights review before external commercial distribution; generated art is not a warranty of exclusivity. Keep PNGs as source masters in docs, not as huge full-size runtime textures. Export reviewed game sprites to the game's normal public asset path in a later implementation commit.

Pilot atlas targets (proposals): character128×128 cells, 3–4 poses; asteroids64×64 cells ×4; coin32×32 ×4; glass surface/bevel/reflection stretchable parts, crack patterns and shard textures32–64px. Maximum sheet2048×2048 unless mobile profiling supports more. Trim transparent margins but retain documented origin/pivot; add2px extrusion to avoid bleeding; use linear filtering. Keep hitboxes in Logic, never derive them from PNG alpha. Bake high-res source to stable small runtime sizes and check DPR1/2/3 without forced pixelation.
