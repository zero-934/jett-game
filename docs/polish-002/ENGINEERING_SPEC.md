# JETT-POLISH-002 — Engineering Specification

Status: **proposal for review**. Nothing here has been applied to production code. Where a prototype exists under `research/`, it is named.

Constraints honoured throughout:
- Phaser 4 + TypeScript.
- Logic files stay pure TS with no Phaser imports.
- All existing exports are preserved (new APIs are additive).
- 3-file Logic/UI/Scene architecture.
- **No silent gameplay retune.** Any change that alters difficulty or payout is flagged **[GAMEPLAY]** and needs sign-off.

---

## 1. Fixed-step simulation

### Today (measured)
- Each UI owns a looping `TimerEvent(delay 16)`. Phaser's Clock catches up missed repeats inside one `Clock.update`, so ticks per wall-second are correct at steady 60 Hz.
- The smoothed delta is capped at 16.67 ms during TimeStep's 120-frame cool-down and while unfocused. Result: 0.58× speed (30 Hz cold) and 0.50× (30 Hz unfocused).
- Rendering is done inside the tick callback, so 120/144 Hz shows repeated frames and double-tick frames redraw twice.

### Proposal
Prototype: `research/patches/FixedStepRunner.ts`, with tests in `research/characterization/fixedstep.char.test.ts`.

- `STEP_MS = 16` (unchanged 62.5 Hz). **Do not switch to 60 Hz without a pacing analysis.** Every per-tick constant (Jett speed 1.2–3.0/tick, Flap gravity 0.45/tick², scroll 3 px/tick, combustion per-tick probabilities) is tuned to 62.5 Hz. At 60 Hz the same constants make the game 4% slower and change combustion exposure per second by 4%. If 60 Hz is ever wanted, rescale every constant by 62.5/60 (velocities), (62.5/60)² (accelerations) and `1−(1−p)^(62.5/60)` (per-tick probabilities), then re-run the EV probe.
- The runner is driven from `Scene.update(time, delta)` using `this.game.loop.rawDelta` (unsmoothed real time). This removes the cool-down/unfocused slow-motion while keeping a cap: `MAX_TICKS_PER_FRAME = 8` (128 ms). Beyond the cap, time is dropped and counted in `stats.droppedMs`. Freezing deliberately beats spiralling.
- **Integer tick index** `tick: number` is the only clock in Logic. Logic never reads time.
- **Render once per frame** from current state. `alpha = accumulator/STEP_MS` can interpolate positions (`prev + (cur − prev)·alpha`) for 120/144 Hz smoothness. Interpolation is cosmetic only.
- **Pause:** on `Phaser.Core.Events.HIDDEN`/`BLUR` (and the settings sheet opening), call `runner.pause()`, which stops accumulating. On resume, the first frame's delta is discarded. A background tab never catches up gameplay.
- Phaser `TimerEvent`s remain for cosmetic sequencing only (results panel delays), and each one checks the round token (§5).

### Ordering within a tick (deterministic contract)
1. Apply input actions queued for this tick, in arrival order.
2. Integrate movement (player, then hazards in ascending ID order).
3. Spawn and cull (gameplay RNG draws happen only here, in a fixed order).
4. Collision (player against hazards in ascending ID order; first hit wins).
5. Pickups (coins in ascending ID order).
6. Progress and multiplier update.
7. Probabilistic failure (combustion) — one RNG draw per tick, always drawn even when not needed, so the stream position is independent of branch.
8. Settlement check (death, auto cash-out, or a queued cash-out action).

Today's Jett order is: clamp, speed, ascend, drift, spawn, cull, coin spawn, coin collect, multiplier, collision, combustion. That already fits this contract except that coin spawn uses `Math.random`. Flap's order (flap, gravity, boundary, pipes, spawn, clear, multiplier, collision, combustion) also fits, but its boundary check precedes collision, which is intentional for dive cash-out. **Keep these orders**: changing them changes outcomes.

## 2. Tick-indexed input and replay

```ts
// Pure TS (new file proposal: src/shared/sim/InputLog.ts)
export interface TickAction { tick: number; type: 'flap' | 'steer' | 'cashOut' | 'pick'; value?: number; }
```

- UI handlers never mutate Logic state. They call `runner.queue({type, value})`. The runner stamps the action with the **next** tick index.
- Edge-triggered actions (`flap`, `cashOut`, `pick`) are events, so a press and release between ticks is retained (fixes R-INPUT-1).
- Continuous input (Jett steering): sample the pointer once per tick into a `steer` action carrying the target X, quantised to an integer pixel, so replays are exact. Only record it when the value changes.
- Keyboard: `addKey(SPACE)` + `JustDown`, or ignore `event.repeat`. Multi-touch: the first active pointer steers (Jett); any new pointerdown flaps (Flap).
- Blur or `pointercancel`: release held state (Jett keeps its last steer target; nothing auto-fires).
- Replay = `FixedStepRunner.replay(simulate, log, ticks)`. A replay file holds `{ replayVersion, simVersion, seedVersion, seed, configHash, actions[] }`.

## 3. Random streams

| Stream | Source | Used for | Recorded |
|---|---|---|---|
| `gameplay` | `ProvablyFairRNG` v2 (64-bit masked, SplitMix64 seeding; `research/patches/ProvablyFairRNG.masked.ts`) seeded per round | spawns, gate heights, combustion, Shatter safe sides | yes (seed + version; state in checkpoints) |
| `cosmetic` | separate RNG seeded from `gameplay` seed XOR a constant, or `Math.random` | stars, particles, shard angles, flicker | no |

Rules:
- Logic receives an `rng: () => number` (existing signature) bound to the gameplay stream. **No `Math.random` in Logic** (fixes Jett coin X, `JettLogic.ts:208`).
- Remove per-tick `new ProvablyFairRNG()` construction (`JettLogic.ts:159`, `FlapFortuneLogic.ts:116`, `ShatterStepLogic.ts:89`). When no RNG is supplied, fall back to a single module-level instance, or throw in dev builds.
- Seed creation: `crypto.getRandomValues(new Uint32Array(2))`, formatted as a hex string. Display it in a debug overlay and attach it to results.
- Cosmetic settings (reduced motion, particles off, high contrast) **must not** draw from `gameplay`. Test: the same seed and actions with all cosmetic toggles flipped give an identical payout.

### RNG v2 migration (cross-game)
- Keep the class name and API. Add `getState`/`setState`.
- Constructor option `{ version: 1 | 2 }` defaults to 2. v1 is retained only if a consumer needs the legacy sequence.
- Inferno #8 and Surge #6 are seed-pinned and fail under v2. Either pin them with `{version:1}` or re-select seeds (owner decision; those games are out of scope).
- Add known-answer vectors from a reference xoroshiro128+ implementation to `ProvablyFairRNG.test.ts`.

## 4. Versioned seeds, config and checkpoints

```ts
interface RoundRecord {
  roundId: string;          // uuid
  game: 'jett' | 'flap' | 'shatter';
  simVersion: number;       // bump on any outcome-affecting change
  seedVersion: 2;
  seed: string;
  configHash: string;       // stable hash of the gameplay config object
  bet: number;              // integer minor units (demo credits × 100)
}
interface Checkpoint { version: 1; round: RoundRecord; tick: number; state: unknown; rng: RNGStateSnapshot; }
```

- Logic state must be JSON-safe: move `rng?: () => number` out of `JettState`. Keep the field optional for backward compatibility, but stop using it.
- `restore(checkpoint)` followed by N ticks with identical actions must equal an uninterrupted run (prototype test passes for Flap).

## 5. Phases, settlement and stale callbacks

```ts
type Phase = 'ready' | 'playing' | 'settled';
interface Settlement { roundId: string; reason: 'cashout' | 'dive' | 'top' | 'crash' | 'combust' | 'shatter'; multiplier: number; payout: number; tick: number; }
```

- **ready:** world rendered, gameplay input ignored, CASH OUT hidden or disabled. START comes from the GO button (Jett), first tap or Space (Flap) or first pick (Shatter).
- **playing:** the runner advances. CASH OUT is enabled (Jett: only when multiplier ≥ 1.00 if product chooses R-CASH-2 option a).
- **settled:** exactly one `Settlement` is produced; `settle()` returns `true` once and `false` afterwards (prototype `FixedStepRunner.settle`). All inputs are ignored and the results panel is shown once.
- **Idempotent cash-out:**
  - A `cashOut` action is processed at a tick boundary like any other action.
  - If the same tick also produces a death, the order in §1 decides: cash-out is applied in step 1, before movement. The player banks the pre-tick multiplier, so a tap is never punished by the tick it arrives in.
  - This is a **[GAMEPLAY]** decision to confirm. Today, cash-out is immediate, between ticks.
- **Stale callback protection:** every `delayedCall`/tween `onComplete` captures `const token = this.roundToken` and returns early if `token !== this.roundToken`. `cleanup()` increments the token.
- Boundary cases to test:
  - cash-out repeated
  - cash-out after death (no "PAID OUT 0.00")
  - cash-out before start (ignored)
  - cash-out on the same tick as a collision (pre-tick multiplier)
  - Shatter: cash-out during the 180/900 ms loss animation (ignored)
  - Shatter: pick during the reveal (ignored)

## 6. Demo credit wallet (non-redeemable)

- `DemoWallet` (pure TS): `balance`, `stake(roundId, amount)`, `settle(roundId, payout)` (idempotent per `roundId`), `reset()`.
- Persist to `localStorage` only as a convenience.
- Copy: "Demo credits — no cash value, not redeemable".
- Integer minor units. Display with `Intl.NumberFormat`.
- **No** real-money, crypto, token or wallet-connect integrations.

## 7. Shutdown and restart ownership

Each Scene:
```ts
create() {
  this.ui = new XUI(this, cfg);
  this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.ui?.cleanup(); this.ui = null; });
  this.ui.start(bet);
}
```

Each UI:
- Stores every listener it registers (`scene.input.on(...)`, `keyboard.on(...)`, `scale.on('resize')`, `game.events.on(HIDDEN)`) as named handlers, and `off()`s them in `cleanup()`.
- Resets arrays (`stars`, pools) in `cleanup()`.
- Owns no AudioContext. Audio goes through a single app-level service (Phaser `this.sound`, preferred, or a singleton `CasinoAudioManager` resumed on the first gesture).
- `cleanup()` is idempotent.

Acceptance:
- 50 restarts: listener counts, timers, display list and AudioContexts constant; heap after forced GC within ±2 MB. The harness probe already measures all of these (`probe: restarts`).

## 8. Shared demo HUD, results, accessibility and settings contract

New shared module proposal: `src/shared/ui/DemoHud.ts` (Phaser) + `src/shared/ui/hudContract.ts` (pure types).

```ts
interface HudModel {
  phase: Phase;
  multiplier: number;            // formatted ×0.00, tabular figures
  secondary: string;             // "ALTITUDE 412 m" | "NEXT GATE 1.49×" | "ROW 4 / 10"
  actionLabel: string | null;    // "CASH OUT 14.80" | null when not available
  actionEnabled: boolean;
  balance: number;               // demo credits
}
interface ResultModel { outcome: 'win' | 'loss' | 'push'; payout: number; bet: number; reason: Settlement['reason']; seed: string; }
interface Settings { sound: boolean; music: boolean; haptics: boolean; reducedMotion: boolean; highContrast: boolean; }
```

Layout rules (mobile portrait, 390-pt logical width):
- **Top bar** (inside `safe-area-inset-top`): back (44×44), demo balance (centre), settings (44×44).
- **Multiplier** centred under the top bar, with a dark scrim behind the HUD band.
- **Primary action** in the bottom thumb zone (64 px tall pill, 24 px side margins, above `safe-area-inset-bottom`).
- **Gameplay input zone** = the area between the HUD bands. HUD controls stop propagation.
- **Results** appear once per round. Celebratory audio and animation only when `payout > bet` (existing ethical rule); a push or partial return uses neutral feedback.
- **Accessibility:**
  - targets ≥ 44×44 (WCAG 2.2 SC 2.5.8 minimum is 24×24)
  - text ≥ 14 px (HUD secondary ≥ 12 px caps with tracking)
  - contrast ≥ 4.5:1
  - non-colour cues for win/loss (icon + text)
  - `prefers-reduced-motion` honoured by default
  - no flashes > 3 per second
  - settings persist per device
- **Canvas semantics:** mirror the HUD model into a visually hidden DOM `aria-live="polite"` region (phase changes, cash-out result). The canvas itself gets `role="img"` and an `aria-label`.

## 9. Rendering approach

- **Resolution:**
  - Short term: remove `image-rendering: pixelated` (`index.html:35`).
  - Proper fix: logical size 390×844 constants (`LOGICAL_W/H`) used by every layout. Game size = logical × `min(devicePixelRatio, 2)`; main camera `setZoom(scaleFactor)` and `centerOn`; text `setResolution(scaleFactor)`.
  - **All three UIs currently read `this.scale.width`**, so the change is mechanical but touches every layout line. Gate it behind a flag and visual snapshots.
- **Static layers to textures:** Jett starfield and grid, and the Flap castle backdrop, are drawn once (`Graphics.generateTexture` or authored PNG/WebP) and scrolled with `TileSprite`. Today they are redrawn every tick.
- **Pooled game objects:** asteroids, coins and gates become `Image`s from an atlas (one texture, batched), recycled from a pool instead of `Graphics` objects created and destroyed.
- **FX:** Phaser 4 `ParticleEmitter` (built in; no dependency) for thruster, coin sparkle, combustion and glass shards; capped particle counts; reduced-motion reduces them.
- **Fallback tier:** if the median frame time over 120 frames exceeds 20 ms, disable particles, parallax layers and glow and halve the star count. Never touch gameplay.

## 10. Test plan (maps to required regression cases)

| Case | Layer | Prototype / location |
|---|---|---|
| Same seed + actions ⇒ same state and payout | Logic (Jest) | `fixedstep.char.test.ts` (Flap); extend to Jett after the `Math.random` fix and to Shatter |
| Checkpoint restore continues identically | Logic | `fixedstep.char.test.ts` |
| 30/60/120/144 Hz + irregular deltas | Logic (runner) + browser | `fixedstep.char.test.ts`; `probe: pacing` |
| Hitch, pause/resume, background tab | runner + browser | add `game.events.emit('hidden')`/`'visible'` steps to `probe: pacing` |
| Quick taps, held keys, repeat, cancel, blur, multi-touch | browser | `probe: flap` (quick tap, Space, repeat); add `pointercancel`, blur and a second pointer |
| HUD/settings/back/retry never leak into gameplay | browser | `probe: jett` (`pointerXAfterCashOutTap`); add Flap back arrow |
| Cash-out repeated / after death / before start / boundary | Logic + browser | `char: jett/flap/shatter` cash-out guards; `probe: jett` |
| Collision tangency, epsilon, corners, fast movement | Logic | `char: jett` tunnelling; add exact tangency (`dist == pr + r·0.85` ⇒ no hit, since strict `<`) and Flap edge (`pr == pipe.x` ⇒ no hit, `<=` continue) |
| 50 restart cycles | browser | `probe: restarts` |
| Shatter selection, re-entrancy, progression, loss, cash-out | Logic + browser | `char: shatter`; `probe: shatter` |
| Cosmetic settings never affect outcomes | Logic | after §3: same seed with cosmetic stream reseeded ⇒ identical settlement |
