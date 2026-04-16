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

    // Title
    this.add
      .text(width / 2, height * 0.05, 'SHATTER STEP', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#aaddff',
        letterSpacing: 4,
      })
      .setOrigin(0.5);

    this.shatterUI = new ShatterStepUI(this, width, height);
    this.shatterUI.start(DEFAULT_BET);

    // HOME button — top-left corner, small and unobtrusive
    const homeBg = this.add.graphics();
    homeBg.fillStyle(0x000000, 0.5);
    homeBg.fillRoundedRect(0, 0, 60, 28, 6);
    const homeLabel = this.add.text(30, 14, '‹', {
      fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#c9a84c',
    }).setOrigin(0.5);
    this.add.container(10, 10, [homeBg, homeLabel])
      .setSize(60, 28).setDepth(20)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.shatterUI?.cleanup(); this.scene.start('HomeScene'); });
  }

  shutdown(): void {
    this.shatterUI?.cleanup();
  }
}
