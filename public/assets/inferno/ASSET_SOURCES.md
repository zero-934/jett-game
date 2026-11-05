# Inferno asset sources and licences

All Inferno assets were created for jett.game in inferno-polish-001 (2026-11-05) by Agent 934 (AI-assisted, Claude Code). No third-party samples, fonts, images or competitor material are included.

| Asset | Path | Source | Author | Licence / terms | Modifications |
|---|---|---|---|---|---|
| Symbol atlas (EMBER, FLAME, COAL, ASH, SMOKE, WILD, SCATTER, Crown coin, spark) | generated at runtime, `inferno-atlas` texture (review copy: `docs/inferno-polish-001/review-artifacts/symbol-atlas.png`) | Deterministic Canvas 2D code in `src/games/InfernoUI.ts` (`drawSymbolTile`, `drawCrownCoin`) | Agent 934 | Proprietary (project) | None (regenerated identically on each load; WILD/SCATTER labels use the system sans-serif font, so glyph shapes vary slightly by platform) |
| Forge window background | runtime `inferno-forge-bg` texture (review copy in `review-artifacts/`) | `drawForgeBackground()` in `src/games/InfernoUI.ts` | Agent 934 | Proprietary | None |
| Shell, heat-meter and button faces | runtime textures `inferno-heat-*`, `inferno-chip-*`, `inferno-face-*`, `inferno-gear` | Phaser Graphics → `generateTexture` in `InfernoUI.ts` | Agent 934 | Proprietary | None |
| Music loop `inferno-forge-loop.ogg` / `.wav` (16 s, 90 BPM, A minor) | `public/assets/inferno/audio/` | Procedural DSP, `research/inferno/audio/render-audio.cjs`; encoded by `encode-audio.sh` (ffmpeg libvorbis q4; WAV 24 kHz 16-bit fallback) | Agent 934 | Proprietary | Peak-normalised to −12 dBFS; tail wrapped circularly for a seamless loop |
| 13 cues (`click`, `reel-stop-1..3`, `cluster-pop`, `cascade-land`, `heat-tick`, `feature-granted`, `crown-flip`, `crown-win`, `crown-loss`, `result-profit`, `result-neutral`) `.ogg` + `.mp3` | `public/assets/inferno/audio/` | Same generator; ffmpeg libvorbis q4 and libmp3lame 96 kbps | Agent 934 | Proprietary | Peak-normalised per cue (−13 … −22 dBFS) |

Regenerate: `research/inferno/audio/encode-audio.sh` (requires Node and ffmpeg). Noise is seeded with a local LCG, so renders are bit-for-bit repeatable for a given Node version. It is unrelated to gameplay RNG.

Audio status: **rendered but not auditioned.** No person or tool has listened to these files during this run.
