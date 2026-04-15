/**
 * @file MasqueradeScene.ts
 * @purpose Phaser Scene for Midnight Masquerade — wires MasqueradeUI + MasqueradeLogic.
 * @author Agent 934
 * @date 2026-04-15
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { MasqueradeUI } from '../games/MasqueradeUI';

const GOLD_STR = '#c9a84c';

export class MasqueradeScene extends Phaser.Scene {
  private masqueradeUI: MasqueradeUI | null = null;

  constructor() { super({ key: 'MasqueradeScene' }); }

  preload(): void {
    // All symbols are code-drawn — no assets to load.
  }

  create(): void {
    const { width, height } = this.scale;

    // Gradient background: dark purple → charcoal
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a0033, 0x1a0033, 0x080812, 0x080812, 1);
    bg.fillRect(0, 0, width, height);

    // Decorative top separator
    const sep = this.add.graphics();
    sep.fillStyle(0xc9a84c, 0.4);
    sep.fillRect(0, 188, width, 1);

    // Title
    this.add.text(width / 2, 60, 'MIDNIGHT MASQUERADE', {
      fontFamily: '"Georgia", serif',
      fontSize:   '38px',
      color:      GOLD_STR,
      stroke:     '#000000',
      strokeThickness: 6,
      shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 4, fill: true, stroke: true },
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(width / 2, 108, '25 PAYLINES  ·  97% RTP  ·  MASKED FORTUNE', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize:   '14px',
      color:      GOLD_STR,
    }).setOrigin(0.5).setAlpha(0.75);

    // Decorative mask icon (simple code-drawn ornament)
    const orn = this.add.graphics();
    orn.lineStyle(1, 0xc9a84c, 0.3);
    orn.strokeRect(8, 8, width - 16, height - 16);

    this.masqueradeUI = new MasqueradeUI(this, { houseEdge: 0.03 });
    this.masqueradeUI.start();
  }

  shutdown(): void {
    this.masqueradeUI?.cleanup();
  }
}
