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
    bar.fillStyle(0xc9a84c, 0.06);
    bar.fillRect(0, 0, width, 30);

    this.add.text(width / 2, height * 0.10, 'MINES', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '48px', color: '#c9a84c', letterSpacing: 8,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.17, 'AVOID THE BOMBS', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '13px', color: '#333344', letterSpacing: 3,
    }).setOrigin(0.5);

    this.minesUI = new MinesUI(this, { houseEdge: 0.03 });
    this.minesUI.start();
  }

  shutdown(): void { this.minesUI?.cleanup(); }
}
