/**
 * @file BallDropScene.ts
 * @purpose Phaser Scene that wires BallDropLogic + BallDropUI together.
 *          Registered in Phaser game config and accessible from HomeScene.
 * @author Agent 934
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { BallDropUI } from '../games/BallDropUI';

const DEFAULT_BET = 10;

export class BallDropScene extends Phaser.Scene {
  private ui: BallDropUI | null = null;

  constructor() {
    super({ key: 'BallDropScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.ui = new BallDropUI(this, {
      boardWidth:    width,
      boardHeight:   height,
      pegRows:       9,
      ballRadius:    8,
      pegRadius:     5,
      gravity:       0.28,
      bounceDampen:  0.52,
      friction:      0.994,
      nudgeForce:    0.22,
      maxNudgeVx:    3.8,
      ballsPerRound: 5,
      houseEdge:     0.03,
    });

    this.ui.start(DEFAULT_BET);

    // Universal nav bar
    const navBg = this.add.graphics();
    navBg.fillStyle(0x000000, 0.6);
    navBg.fillRect(0, 0, width, 36);
    this.add.text(18, 18, '‹', { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#c9a84c' })
      .setOrigin(0.5).setDepth(50).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('HomeScene'));
  }

  shutdown(): void {
    this.ui?.cleanup();
  }
}
