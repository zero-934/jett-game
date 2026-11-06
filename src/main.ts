/**
 * @file main.ts
 * @purpose Phaser entry point — boots HomeScene first, all three game scenes registered.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { LockScene } from './scenes/LockScene';
import { HomeScene } from './scenes/HomeScene';
import { JettScene } from './scenes/JettScene';
import { ShatterStepScene } from './scenes/ShatterStepScene';
import { FlapFortuneScene } from './scenes/FlapFortuneScene';
import { DiceScene } from './scenes/DiceScene';
import { MinesScene } from './scenes/MinesScene';
import { BallDropScene } from './scenes/BallDropScene';
import { MasqueradeScene } from './scenes/MasqueradeScene';
import { AlchemistScene } from './scenes/AlchemistScene';
import { InfernoScene } from './scenes/InfernoScene';
import { SurgeScene } from './scenes/SurgeScene';
import { DiceDuelScene } from './scenes/DiceDuelScene';
import { DoomCrashScene } from './scenes/DoomCrashScene';
import { loadShellFonts } from './shared/render/FontLoader';

const config = {
  type: Phaser.AUTO,
  width: 390,
  height: 844,
  backgroundColor: '#000000',
  // polish-004: Phaser 4 has no game-level `resolution`; the pilots use RenderScaleController.
  scene: [LockScene, HomeScene, JettScene, ShatterStepScene, FlapFortuneScene, DiceScene, MinesScene, BallDropScene, MasqueradeScene, AlchemistScene, InfernoScene, SurgeScene, DiceDuelScene, DoomCrashScene],
  parent: 'app',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  dom: {
    createContainer: true,
  },
} as Phaser.Types.Core.GameConfig;

// polish-004: wait (bounded) for the self-hosted Inter faces so no glyph is rasterised with a
// fallback face, then boot.
void loadShellFonts(import.meta.env.BASE_URL).then(() => {
  const game = new Phaser.Game(config);
  // Read-only diagnostics for release-build QA (`?diag=1`): exposes the game for scene checks.
  if (new URLSearchParams(window.location.search).get('diag') === '1') (window as unknown as Record<string, unknown>).__game = game;
});
// Deep-link and auth handled by LockScene
