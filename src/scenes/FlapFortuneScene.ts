/**
 * @file FlapFortuneScene.ts
 * @purpose Phaser Scene for Flap Fortune — Mario-style red pipes, scrolling landscape.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { FlapFortuneUI } from '../games/FlapFortuneUI';

const DEFAULT_BET = 10;

export class FlapFortuneScene extends Phaser.Scene {
  private flapUI: FlapFortuneUI | null = null;

  constructor() {
    super({ key: 'FlapFortuneScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.flapUI = new FlapFortuneUI(this, {
      worldWidth: width,
      worldHeight: height,
      gravity: 0.45,
      flapStrength: -7.5,
      pipeSpacing: 230,
      pipeGapHeight: 170,
      scrollSpeed: 3,
      houseEdge: 0.03,
      combustionChancePerTick: 0.0003,
    });

    this.flapUI.start(DEFAULT_BET);
  }

  shutdown(): void {
    this.flapUI?.cleanup();
  }
}
