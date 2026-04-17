/**
 * @file AlchemistScene.ts
 * @purpose Phaser Scene for The Alchemist — wires AlchemistUI + AlchemistLogic.
 * @author Agent 934
 * @date 2026-04-15
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { AlchemistUI } from '../games/AlchemistUI';

const GOLD_STR   = '#c9a84c';
const COPPER_STR = '#b87333';

export class AlchemistScene extends Phaser.Scene {
  private alchemistUI: AlchemistUI | null = null;

  constructor() { super({ key: 'AlchemistScene' }); }

  preload(): void { /* all symbols are code-drawn */ }

  create(): void {
    const { width, height } = this.scale;

    // Background: deep near-black with amber-tinted gradient
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0800, 0x0a0800, 0x080812, 0x080812, 1);
    bg.fillRect(0, 0, width, height);

    // Copper accent border
    const border = this.add.graphics();
    border.lineStyle(1, 0xb87333, 0.25);
    border.strokeRect(6, 6, width - 12, height - 12);

    // Thin copper divider below subtitle
    const div = this.add.graphics();
    div.fillStyle(0xb87333, 0.3);
    div.fillRect(20, 58, width - 40, 1);

    // Title
    this.add.text(width / 2, 22, 'THE ALCHEMIST', {
      fontFamily: '"Georgia", serif',
      fontSize:   '22px',
      color:      COPPER_STR,
      stroke:     '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(width / 2, 46, '25 PAYLINES  ·  97% RTP  ·  TRANSMUTATION', {
      fontFamily: 'Arial, sans-serif',
      fontSize:   '10px',
      color:      GOLD_STR,
    }).setOrigin(0.5).setAlpha(0.65);

    this.alchemistUI = new AlchemistUI(this, { houseEdge: 0.03 });
    this.alchemistUI.start();

    // Universal nav bar
    const navBg = this.add.graphics();
    navBg.fillStyle(0x000000, 0.6);
    navBg.fillRect(0, 0, width, 36);
    this.add.text(18, 18, '‹', { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: COPPER_STR })
      .setOrigin(0.5).setDepth(50).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('HomeScene'));
  }

  shutdown(): void {
    this.alchemistUI?.cleanup();
  }
}
