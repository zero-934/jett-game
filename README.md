# 🎰 Jett Casino
![Tests](https://github.com/zero-934/jett-game/actions/workflows/test.yml/badge.svg)
[![Live Demo](https://img.shields.io/badge/▶_PLAY_NOW-jett.game-c9a84c?style=for-the-badge)](https://zero-934.github.io/jett-game/)

## "We invented new game categories. We are raising $500k pre-seed."
Jett Casino is a crypto-native skill-based gaming platform built on Solana. First-mover in Interactive Risk Management Gaming — a legally defensible category combining genuine skill mechanics with provably fair RNG outcomes.

## 🎮 The Games (11 Original Titles)
*   Jett: Our flagship rocket-crash game, climb the multiplier before it explodes.
*   Shatter Step: A strategic tile-based game where players reveal multipliers or bombs.
*   Flap Fortune: A 'Flappy Bird' inspired game where flight duration determines multiplier.
*   Dice: Classic dice game with adjustable odds and provably fair rolls.
*   Mines: Uncover gems while avoiding mines on a customizable grid.
*   Ball Drop: A Peggle-like physics game where balls drop into prize bins.
*   Midnight Masquerade: A luxurious 5x3 slot with a hidden bonus round.
*   The Alchemist: A thematic 5x3 slot featuring cascading wins and a jackpot system.
*   **Inferno**: A truly novel cluster pays slot where symbols ignite for cascading wins.
*   **Surge**: A unique cluster pays slot where energy surges create new winning opportunities.
*   **Doom Crash**: World-first FPS crash game where shooting accuracy influences crash probability.

## ⚙️ The Technology
*   **ProvablyFairRNG (xoroshiro128+, Solana VRF-ready)** — powering all 11 games with verifiable outcomes.
*   **3-file licensable architecture (Logic.ts / UI.ts / Scene.ts)** — pure separation of concerns, zero coupling for easy white-labeling and integration.
*   **Shared SlotEngineLogic and SlotAnimator** — a robust, asset-swappable slot engine for rapid game development.
*   **96% RTP documented and simulated** across all games (100k round Monte Carlo simulation).
*   **TypeScript strict, Vite, Phaser 3, Jest full test coverage** — modern, reliable, and test-driven development.
*   **GitHub Actions CI/CD → GitHub Pages** — continuous integration and deployment for rapid iterations and a live demo.

## 🌍 The Market
Targeting English-speaking Africa (Nigeria, Kenya, Ghana) and Asia (Philippines, India). This represents a 500M+ addressable user base with smartphone and crypto access. Jett Casino operates on crypto-only payments. Anjouan B2C license in progress. No restrictive app store required, directly accessible via web browser.

## 📊 The Numbers
*   Built in under 1 month.
*   Under $300 total development cost.
*   11 production-ready games.
*   Full Jest test coverage.
*   Provably fair at its core.
*   Live and playable now.

## 💰 The Ask
Raising $500k pre-seed. Use of funds:
*   **Casino Audio Pack ($50k)**: Professional sound design for an immersive experience.
*   **Supabase/PostHog Analytics ($20k)**: Robust analytics for user behavior and game performance.
*   **Solana Mainnet Integration ($80k)**: Full on-chain game state, wallet integration, and JETT token functionality.
*   **Anjouan B2C License ($150k)**: Securing a reputable gaming license for operational legality.
*   **Marketing & User Acquisition ($200k)**: Targeted campaigns to drive initial user growth in key markets.

Contact: invest@jett.game

## 🏗️ Architecture
```
┌──────────────────────────────────────┐             ┌───────────────────────────────┐
│     jett.game (React Lobby)          │             │    GitHub Actions CI/CD     │
│  (zero-934.github.io/jett-landing)   ├───┐         │    → GitHub Pages Deploy    │
└──────────────────────────────────────┘   │         └───────────────────────────────┘
                                           │
┌────────────────────────────┐             │         ┌───────────────────────────────┐
│  ProvablyFairRNG.ts        │             │         │      Solana VRF Layer       │
│  (xoroshiro128+, seed)     ├─────────────┼─────────►   (on-chain randomness)   │
└────────────────────────────┘             │         └───────────────────────────────┘
                                           │
┌────────────────────────────┐             │
│   Shared SlotEngineLogic   │             │
│    (asset-swappable)       ├─────────────┘
└────────────────────────────┘
                                           │
┌────────────────────────────┐             │
│        Game Logic.ts       │             │
│  (e.g., DoomCrashLogic.ts) ├─────────┐
└────────────────────────────┘         │
                                       ▼
┌────────────────────────────┐   ┌────────────────────────────┐
│         Game UI.ts         │   │       Game Scene.ts        │
│    (Phaser 3 UI elements)  │   │  (Phaser 3 game rendering) │
└────────────────────────────┘   └────────────────────────────┘

Built for licensing, built for scale.
```
