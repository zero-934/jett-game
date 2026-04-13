/**
 * @file DiceScene.ts
 * @purpose Phaser Scene for Dice — wires DiceUI together.
 * @author Agent 934
 * @date 2026-04-13
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { DiceUI } from '../games/DiceUI';

export class DiceScene extends Phaser.Scene {
  private diceUI: DiceUI | null = null;

  constructor() { super({ key: 'DiceScene' }); }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x050508);

    // Grid
    const grid = this.add.graphics();
    grid.lineStyle(0.3, 0x0d0d1a, 1);
    for (let x = 0; x <= width; x += 40) { grid.beginPath(); grid.moveTo(x, 0); grid.lineTo(x, height); grid.strokePath(); }
    for (let y = 0; y <= height; y += 40) { grid.beginPath(); grid.moveTo(0, y); grid.lineTo(width, y); grid.strokePath(); }

    // Top gold bar
    const bar = this.add.graphics();
    bar.fillStyle(0xc9a84c, 1);
    bar.fillRect(0, 0, width, 3);
    bar.fillStyle(0xc9a84c, 0.06);
    bar.fillRect(0, 0, width, 30);

    this.add.text(width / 2, height * 0.10, 'DICE', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '48px', color: '#c9a84c', letterSpacing: 8,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.17, 'PICK YOUR ODDS', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '13px', color: '#333344', letterSpacing: 3,
    }).setOrigin(0.5);

    this.diceUI = new DiceUI(this, { houseEdge: 0.03 });
    this.diceUI.start();
  }

  shutdown(): void { this.diceUI?.cleanup(); }
}
