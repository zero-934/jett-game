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

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 390,
  height: 844,
  backgroundColor: '#000000',
  scene: [LockScene, HomeScene, JettScene, ShatterStepScene, FlapFortuneScene, DiceScene, MinesScene, BallDropScene, MasqueradeScene, AlchemistScene, InfernoScene, SurgeScene, DiceDuelScene],
  parent: 'app',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);

// Deep-link support: ?scene=JettScene launches that scene directly
game.events.on('ready', () => {
  const params = new URLSearchParams(window.location.search);
  const targetScene = params.get('scene');
  if (targetScene) {
    game.scene.start(targetScene);
    game.scene.stop('LockScene');
  }
});
