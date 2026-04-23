/**
 * @file MinesScene.ts
 * @purpose Phaser Scene for Mines — wires MinesUI together.
 * @author Agent 934
 * @date 2026-04-13
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { MinesUI } from '../games/MinesUI';

export class MinesScene extends Phaser.Scene {
  private minesUI: MinesUI | null = null;

  constructor() { super({ key: 'MinesScene' }); }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x050508);

    const grid = this.add.graphics();
    grid.lineStyle(0.3, 0x0d0d1a, 1);
    for (let x = 0; x <= width; x += 40) { grid.beginPath(); grid.moveTo(x, 0); grid.lineTo(x, height); grid.strokePath(); }
    for (let y = 0; y <= height; y += 40) { grid.beginPath(); grid.moveTo(0, y); grid.lineTo(width, y); grid.strokePath(); }

    const bar = this.add.graphics();
    bar.fillStyle(0xc9a84c, 1);
    bar.fillRect(0, 0, width, 3);
    // Nav bar first — always on top
    const navBg = this.add.graphics().setDepth(50);
    navBg.fillStyle(0x000000, 0.8);
    navBg.fillRect(0, 0, width, 36);
    this.add.text(18, 18, '‹', { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: '#c9a84c' })
      .setOrigin(0.5).setDepth(51).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => window.location.href='https://zero-934.github.io/jett-landing/');

    // Title below nav bar
    this.add.text(width / 2, 58, 'MINES', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '26px', color: '#c9a84c', letterSpacing: 6,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(width / 2, 80, 'Reveal tiles · Hit a bomb and lose everything', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '11px', color: '#666677', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(10);

    bar.fillStyle(0xc9a84c, 0.06);
    bar.fillRect(0, 36, width, 54);

    this.minesUI = new MinesUI(this, { houseEdge: 0.03 });
    this.minesUI.start();
  }

  shutdown(): void { this.minesUI?.cleanup(); }
}
