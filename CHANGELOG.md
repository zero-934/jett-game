# CHANGELOG

## Month 1: April 2026 - Rapid Prototyping & Core Product Launch

### Features & Games Shipped:
*   **11 Core Games Shipped**:
    *   `Jett`: Flagship crash game.
    *   `Shatter Step`: Strategic tile-reveal game.
    *   `Flap Fortune`: Skill-based arcade game.
    *   `Dice`: Classic provably fair dice.
    *   `Mines`: Strategic minefield.
    *   `Ball Drop`: Physics-based plinko.
    *   `Midnight Masquerade`: 5x3 themed slot with bonus.
    *   `The Alchemist`: 5x3 cascading slot with jackpot system.
    *   **WORLD-FIRST**: `Doom Crash`: Revolutionary FPS crash game with skill-influenced outcomes.
    *   **NOVEL CATEGORY**: `Surge`: Unique cluster pays slot with energy mechanics.
    *   **NOVEL CATEGORY**: `Inferno`: Innovative cluster pays slot with cascading symbols.
*   **Provably Fair RNG (xoroshiro128+)**: Integrated across all 11 games, ensuring transparent and verifiable outcomes. Ready for Solana VRF integration.
*   **Modular 3-file Architecture**: Established `Logic.ts / UI.ts / Scene.ts` separation for all games, ensuring zero coupling and high reusability for B2B licensing.
*   **Shared Slot Engine Logic**: Implemented `SlotEngineLogic` for rapid development of new slot games.
*   **Shared Slot Animator**: Developed `SlotAnimator` for consistent, asset-swappable slot animations.
*   **React Lobby Shell**: Deployed a basic, functional lobby (`jett-landing`) for game access.
*   **PIN-Gated Lobby Access**: Added a basic security layer for demo access.
*   **Deep-Link Routing**: Enabled direct navigation to individual games via URL.

### Technical & Infrastructure:
*   **Full Jest Test Coverage**: Achieved high test coverage for all core game logic, ensuring reliability and maintainability.
*   **GitHub Actions CI/CD**: Established continuous integration and deployment pipelines for automated testing and GitHub Pages updates.
*   **TypeScript Strict Mode**: Enforced strict TypeScript standards for robust codebase quality.
*   **Vite Development Environment**: Utilized Vite for extremely fast development cycles.
*   **Phaser 3 Game Engine**: Standardized on Phaser 3 for efficient 2D game rendering and interaction.
*   **RTP Documentation**: Simulated 100k rounds for all games, documenting 96% average RTP.

### Summary:
Month 1 saw an unparalleled pace of development, delivering a fully functional, provably fair crypto casino with 11 original games, including world-first and novel category innovations. The robust, modular architecture lays a strong foundation for rapid scaling and future B2B opportunities.
