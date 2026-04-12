/**
 * @file JettScene.ts
 * @purpose Phaser Scene for Jett — space endless vertical scroller with android obstacles.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { JettUI } from '../games/JettUI';

const DEFAULT_BET = 10;

export class JettScene extends Phaser.Scene {
  private jettUI: JettUI | null = null;

  constructor() {
    super({ key: 'JettScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Deep space background
    this.add.rectangle(width / 2, height / 2, width, height, 0x00000a);

    this.jettUI = new JettUI(this, {
      worldWidth: width,
      screenHeight: height,
      houseEdge: 0.03,
      obstacleSpacing: 200,
      obstacleGapWidth: 150,
      combustionChancePerTick: 0.0004,
    });

    this.jettUI.start(DEFAULT_BET);
  }

  shutdown(): void {
    this.jettUI?.cleanup();
  }
}
