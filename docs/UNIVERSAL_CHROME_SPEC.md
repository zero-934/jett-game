# JETT CASINO — UNIVERSAL HEADER/FOOTER SPEC

**Status:** Approved design. Implementation begins during beta 5 polish.

---

## The Vision

Every game has three zones:

```
┌─────────────────────────────┐
│         HEADER              │  ← back button + wallet balance
├─────────────────────────────┤
│                             │
│       GAME CANVAS           │  ← pure play area, full breathing room
│       (the hero)            │
│                             │
├─────────────────────────────┤
│         FOOTER              │  ← slim bet controls strip only
└─────────────────────────────┘
```

The game canvas is the hero. Header and footer are infrastructure.

---

## Header Spec

| Property | Value |
|----------|-------|
| Left | Back button → returns to lobby |
| Center | Solana wallet balance — prominent, larger than current |
| Height | Visually measure lobby header in browser devtools, hardcode as named constant |
| Background | `#080808` |
| Border bottom | `#222222` |
| Text | `#f0f0f0` |
| Accents | `GOLD = 0xc9a84c` |

---

## Footer Spec

| Property | Value |
|----------|-------|
| Height | Visually measure lobby bottom nav in browser devtools, hardcode as named constant |
| Contents | Bet amount display + ½ and 2× quick bet buttons only |
| Action button | **NOT owned by footer** — see Known Constraints |
| iPhone inset | `SAFE_AREA_BOTTOM = 34` — footer must clear home bar |

**Key difference vs competitors:** Shuffle's bet panel eats 40% of screen. Ours is a slim strip. Game stays the focal point.

---

## UITheme.ts Constants to Add

```ts
// Universal game chrome constants
// Values hardcoded after visually measuring the lobby in browser devtools
// The lobby is a separate React app — do NOT attempt to import from it
const HEADER_HEIGHT = [visually measured px value]
const FOOTER_HEIGHT = [visually measured px value]
const SAFE_AREA_BOTTOM = 34           // iPhone notch/home bar inset
const FOOTER_TOTAL_HEIGHT = FOOTER_HEIGHT + SAFE_AREA_BOTTOM
const GAME_CANVAS_TOP = HEADER_HEIGHT
const GAME_CANVAS_BOTTOM = CANVAS_H - FOOTER_TOTAL_HEIGHT
const GAME_CANVAS_HEIGHT = GAME_CANVAS_BOTTOM - GAME_CANVAS_TOP
```

No magic numbers anywhere. Every game positions itself using these constants only.

---

## UITheme.ts Helpers to Add

```ts
// Draws top bar with back button and wallet balance
drawGameHeader(scene: Phaser.Scene, options: {
  onBack: () => void;
  walletBalance: string;
}): void

// Draws slim footer with bet controls only — NO action button
drawGameFooter(scene: Phaser.Scene, options: {
  betAmount: number;
  onHalf: () => void;
  onDouble: () => void;
}): {
  setBetAmount: (n: number) => void;
}
```

---

## Known Constraints

### Constraint 1 — Separate repos, no shared imports

The lobby is a React app (`jett-landing`). The games are Phaser (`jett-game`). They are separate repos and **cannot share source code or imports**.

Do not attempt to import any constants or components from the lobby into `UITheme.ts` or any game file.

**Correct approach:** Visually measure the lobby header and bottom nav height in browser devtools at `zero-934.github.io/jett-landing`, then hardcode those exact px values as named constants in `UITheme.ts`. They will match visually even though the source is separate.

### Constraint 2 — Action button owned by Scene, not footer

`drawGameFooter()` must **NOT** own the action button. Each game has a completely different action flow:

- **Mines** — action is per-cell tile tap, not a single button
- **Surge** — SPIN button must disable during reel animation, re-enable after
- **Jett** — CASH OUT only available mid-flight, not before launch
- **Flap Fortune** — same as Jett
- **Shatter Step** — button label changes mid-game (CLIMB / CASH OUT)

**Correct pattern:**
- `drawGameFooter()` draws bet controls only (amount display, ½, 2×)
- Each Scene owns its own action button, positioned just above footer using `GAME_CANVAS_BOTTOM` as anchor
- Scene controls enable/disable on its own button based on game state

---

## Technical Rules

- ✅ `UITheme.drawButton()` returns `{bg, text}` — wire `pointerdown` to `bg` only
- ❌ `Container.setInteractive()` does not work in Phaser 4 — never use it
- ❌ `GOLD * 1.1` is not a valid color — never multiply color constants
- ✅ `GOLD = 0xc9a84c` — never hardcode inline
- ✅ No magic numbers — named constants only
- ✅ iPhone Safari safe area bottom = 34px — `FOOTER_TOTAL_HEIGHT` must account for this
- ❌ No Phaser imports in any `Logic.ts` file
- ❌ Do not import anything from `jett-landing` into `jett-game`

---

## Implementation Order

1. Open `zero-934.github.io/jett-landing` in browser devtools — measure lobby header and bottom nav height in px, record both values
2. Add all constants to `UITheme.ts` using measured values
3. Add `drawGameHeader()` to `UITheme.ts`
4. Add `drawGameFooter()` to `UITheme.ts` — bet controls only, no action button
5. Integrate into **Mines first** — test on iPhone Safari
6. Roll out to **Jett → Flap Fortune → Shatter Step → Surge** in order
7. Each game gets its own PR — never batch into one commit

---

## Branch Naming

| Branch | Purpose |
|--------|---------|
| `feat/universal-game-chrome` | UITheme.ts constants + helpers |
| `feat/mines-chrome-integration` | Mines rollout |
| `feat/jett-chrome-integration` | Jett rollout |
| `feat/flapfortune-chrome-integration` | Flap Fortune rollout |
| `feat/shatterstep-chrome-integration` | Shatter Step rollout |
| `feat/surge-chrome-integration` | Surge rollout |

---

## Done Means

- [ ] All 5 games have identical header and footer
- [ ] Game canvas is pure play area with no UI overlap
- [ ] Back button works on all 5
- [ ] Wallet balance displays on all 5
- [ ] Bet controls (amount, ½, 2×) functional on all 5
- [ ] Action button owned by each Scene, anchored to `GAME_CANVAS_BOTTOM`
- [ ] iPhone Safari tested — no notch overlap on footer
- [ ] `npm test` passes
- [ ] No magic numbers anywhere
- [ ] Header and footer heights match lobby visually — verified side by side in browser
- [ ] Session summary written at end

---

## Not In Scope

- Lobby website changes — deferred
- Solana real transactions — display only for now
- Any game logic changes — chrome only, zero logic touch
- Games outside the 5 beta games — do not touch
