/**
 * @file ShatterStepScene.ts
 * @purpose Phaser Scene for Shatter Step — glass ladder with 2D player and shatter FX.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { ShatterStepUI } from '../games/ShatterStepUI';

const DEFAULT_BET = 10;

export class ShatterStepScene extends Phaser.Scene {
  private shatterUI: ShatterStepUI | null = null;

  constructor() {
    super({ key: 'ShatterStepScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d0d0d);

    // Stars
    for (let i = 0; i < 40; i++) {
      const sx = Phaser.Math.Between(0, width);
      const sy = Phaser.Math.Between(0, height);
      this.add.arc(sx, sy, Math.random() < 0.2 ? 1.5 : 0.7, 0, 360, false, 0xffffff, Math.random() * 0.5 + 0.1);
    }

    // Title removed — HUD shows multiplier + row info

    this.shatterUI = new ShatterStepUI(this, width, height);
    this.shatterUI.start(DEFAULT_BET);

    // Universal nav bar
    const navBg = this.add.graphics();
    navBg.fillStyle(0x000000, 0.6);
    navBg.fillRect(0, 0, width, 36);
    this.add.text(18, 18, '‹', { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#c9a84c' })
      .setOrigin(0.5).setDepth(50).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.shatterUI?.cleanup(); window.location.href='https://zero-934.github.io/jett-landing/'; });
  }

  shutdown(): void {
    this.shatterUI?.cleanup();
  }
}
