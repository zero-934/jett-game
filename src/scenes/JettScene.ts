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
      combustionChancePerTick: 0.0004,
    });

    this.jettUI.start(DEFAULT_BET);

    // Universal nav bar
    const navBg = this.add.graphics();
    navBg.fillStyle(0x000000, 0.6);
    navBg.fillRect(0, 0, width, 36);
    this.add.text(18, 18, '‹', { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#c9a84c' })
      .setOrigin(0.5).setDepth(50).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => window.location.href='https://zero-934.github.io/jett-landing/');
  }

  shutdown(): void {
    this.jettUI?.cleanup();
  }
}
