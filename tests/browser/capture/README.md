# Seeded capture scripts (QA only, not part of npm test)

These produced the screenshots in `docs/polish-003/implementation/` (segments, comparisons, scale-pass, responsive-pass).
Start the dev server first: `npx vite --port 5199 --strictPort`. Output goes to `$OUT` (default `./capture-out`, create it first).

| Script | Usage | Produces |
|---|---|---|
| `jettplay.cjs` | `OUT=dir node jettplay.cjs <debug 0/1> review-jett-06` | Jett ready/playing/cashed (seeded coin pickup → cash-out) |
| `flapplay.cjs` | `OUT=dir node flapplay.cjs <debug 0/1>` | Flap two gates → cash-out (seed `review-flap-01`) |
| `flapshot.cjs` | `node flapshot.cjs` | Flap ready screen |
| `shatterplay.cjs` | `node shatterplay.cjs ready\|playing\|cashout\|break <ms> [rm]` | Shatter states and break frames (seed `review-shatter-01`) |
| `shattertimeline.cjs` | `node shattertimeline.cjs` | Per-frame glass-break timeline JSON (full + reduced motion) |
| `narrow.cjs` | `node narrow.cjs <outdir>` | 320×568 captures with real DOM targets outlined |
| `svgshot.cjs` | `node svgshot.cjs <outdir> <svg...>` | PNG renders of the reference SVGs |

They step Phaser's loop manually for determinism; tweens use wall-clock time, so scripts wake the loop briefly before stills that show fades.
