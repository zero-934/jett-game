# jett.game

> Mobile-first web casino game platform — Midnight Luxury aesthetic.

**Live:** https://dist-omega-henna.vercel.app

---

## Games

| Game | Description |
|------|-------------|
| 🚀 **Jett** | Dodge asteroids, go higher, cash out before you combust |
| 🪟 **Shatter Step** | Pick left or right each row — one path shatters |
| 🧙 **Flap Fortune** | Flap the wizard through gates, cash out mid-run |
| 🎲 **Dice** | Roll for 2×, 5×, or 10× — instant result |
| 💣 **Mines** | Reveal safe tiles on a 5×5 grid before you hit a bomb |
| 🟡 **Ball Drop** | Drop & nudge a ball through pegs — edge slots pay ×5 |

All games feature a **cash-out mechanic** and a **3% house edge** (97% RTP).

---

## Stack

- **[Phaser 3](https://phaser.io)** — game engine
- **TypeScript** (strict mode) — type-safe everywhere
- **Vite** — dev server + builds
- **Jest + ts-jest** — unit testing

---

## Getting Started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build → dist/
npm test          # run all tests
```

---

## Architecture

Every game is split into 3 files:

```
src/games/<Name>Logic.ts    ← Pure TypeScript. No Phaser. All game math + state.
src/games/<Name>UI.ts       ← Phaser rendering + input. Calls Logic only.
src/scenes/<Name>Scene.ts   ← Wires Logic + UI into a Phaser Scene.
```

This keeps game logic **independently licensable** and **easily testable** without mocking Phaser.

---

## Project Structure

```
src/
├── main.ts              ← Phaser entry point, scene list
├── scenes/              ← One Scene per game + HomeScene + LockScene
├── games/               ← Logic.ts + UI.ts per game
└── tests/               ← Jest unit tests (Logic files only)
```

---

## For AI Agents

If you are an AI assistant working on this codebase:

- Read **[AGENTS.md](./AGENTS.md)** — the full AI-readable project guide
- Read **[llms.txt](./llms.txt)** — token-efficient summary for LLMs
- Run `npm test` to verify current state before making changes
- Never import Phaser into a `Logic.ts` file
- Never push to `main` directly — always via branch + PR

---

## Deployment

Deployed to **Vercel**. Push to `main` → auto-deploy.

For new games: build a PR on `feat/<game-name>`, merge to `main` when ready.

---

## License

Proprietary. Game logic files are available for separate licensing.
Contact the repository owner for details.
