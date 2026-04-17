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

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 390,
  height: 844,
  backgroundColor: '#000000',
  scene: [LockScene, HomeScene, JettScene, ShatterStepScene, FlapFortuneScene, DiceScene, MinesScene, BallDropScene, MasqueradeScene, AlchemistScene, InfernoScene],
  parent: 'app',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
