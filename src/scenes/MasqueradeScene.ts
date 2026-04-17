/**
 * @file MasqueradeScene.ts
 * @purpose Phaser Scene for Midnight Masquerade — wires MasqueradeUI + MasqueradeLogic.
 * @author Agent 934
 * @date 2026-04-15
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { MasqueradeUI } from '../games/MasqueradeUI';
import { createMasqueradeState, BET_PER_LINE, LINES_COUNT } from '../games/MasqueradeLogic';
import type { MasqueradeSymbol } from '../games/MasqueradeLogic';

const GOLD_STR = '#c9a84c';

export class MasqueradeScene extends Phaser.Scene {
  private masqueradeUI: MasqueradeUI | null = null;

  constructor() { super({ key: 'MasqueradeScene' }); }

  preload(): void { /* all symbols are code-drawn */ }

  create(): void {
    const { width, height } = this.scale;

    // Background gradient: dark purple top → charcoal bottom
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a0033, 0x1a0033, 0x080812, 0x080812, 1);
    bg.fillRect(0, 0, width, height);

    // Outer decorative border
    const border = this.add.graphics();
    border.lineStyle(1, 0xc9a84c, 0.25);
    border.strokeRect(6, 6, width - 12, height - 12);

    // Title — compact, fits above jackpot panel
    this.add.text(width / 2, 22, 'MIDNIGHT MASQUERADE', {
      fontFamily: '"Georgia", serif',
      fontSize:   '22px',
      color:      GOLD_STR,
      stroke:     '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(width / 2, 46, '25 PAYLINES  ·  97% RTP  ·  MASKED FORTUNE', {
      fontFamily: 'Arial, sans-serif',
      fontSize:   '10px',
      color:      GOLD_STR,
    }).setOrigin(0.5).setAlpha(0.65);

    // Thin gold divider below subtitle
    const div = this.add.graphics();
    div.fillStyle(0xc9a84c, 0.3);
    div.fillRect(20, 58, width - 40, 1);

    this.masqueradeUI = new MasqueradeUI(this);
    const initState = createMasqueradeState(BET_PER_LINE * LINES_COUNT, LINES_COUNT);
    const initGrid = initState.reelStops as MasqueradeSymbol[][];
    this.masqueradeUI.start(initGrid, () => {}); // spin handled internally by UI

    // Universal nav bar
    const navBg = this.add.graphics();
    navBg.fillStyle(0x000000, 0.6);
    navBg.fillRect(0, 0, width, 36);
    this.add.text(18, 18, '‹', { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: GOLD_STR })
      .setOrigin(0.5).setDepth(50).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('HomeScene'));
  }

  shutdown(): void {
    this.masqueradeUI?.destroy();
  }
}
