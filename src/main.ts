/**
 * @file main.ts
 * @purpose Phaser game entry point — registers all scenes and boots the engine.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import Phaser from 'phaser';
import { JettScene } from './scenes/JettScene';
import { ShatterStepScene } from './scenes/ShatterStepScene';
import { FlapFortuneScene } from './scenes/FlapFortuneScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 390,
  height: 844,
  backgroundColor: '#0d0d0d',
  scene: [ShatterStepScene, JettScene, FlapFortuneScene],
  parent: 'app',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
