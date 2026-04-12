# AGENT_RULES.md — jett.game Build Rules

## Project
- **Name:** jett.game
- **Aesthetic:** Midnight Luxury (charcoal `#0d0d0d`, gold `#c9a84c`)
- **Stack:** Phaser 3 + TypeScript (strict mode), Vite
- **Platform:** Mobile-first web (390×844 base, FIT scaling)

## Architecture: Every Game = 3 Files

| File | Purpose |
|------|---------|
| `src/games/<Name>Logic.ts` | Pure TypeScript. No Phaser. Exports game state, RNG, multipliers, collision/outcome logic. Self-contained — licensable standalone. |
| `src/games/<Name>UI.ts` | Phaser rendering, input handling, animation. Calls Logic. |
| `src/scenes/<Name>Scene.ts` | Wires Logic + UI. Registered in Phaser game config. |

## Code Standards

- TypeScript **strict mode** (`"strict": true` in tsconfig)
- Every file starts with header comment: purpose, author, date, `@license Proprietary – available for licensing`
- Every public function has JSDoc: `@param`, `@returns`, `@example`
- Descriptive variable names — `playerAltitude` not `pA`
- No `any` types unless absolutely unavoidable (comment why)

## Testing

- Logic files must have unit tests in `src/tests/<Name>Logic.test.ts`
- Use Jest (already in devDependencies or install it)
- Tests must verify RTP / house edge behavior

## Git / PR Rules

- One PR per game
- Branch naming: `feat/<game-name>`
- PR title: `feat(<game-name>): initial prototype`
- PR body: summary of work + note that logic file is ready for standalone licensing

## The Three Games

### 1. Jett
- Auto-ascending player (vertical)
- Horizontal mouse/touch movement
- Random obstacles appear
- Collision ends game
- Cash-out button available at any time
- Multiplier increases with altitude

### 2. Shatter Step
- 10-row ladder, pick left or right tile each row
- 50/50 chance each pick
- Correct pick: advance row, multiplier ×1.5
- Wrong pick: game over
- Can cash out after any correct row

### 3. Flap Fortune
- Horizontal scroller
- Tap/click to ascend against gravity
- Random pipe gaps
- Collision ends game
- Distance-based multiplier
- Cash-out button available at any time

## Placeholder Graphics
No visual polish needed. Use colored rectangles (`Phaser.GameObjects.Rectangle`), lines, and text only.

## House Edge (default)
- RTP target: **97%** (3% house edge)
- This must be reflected in logic files and proven in tests
