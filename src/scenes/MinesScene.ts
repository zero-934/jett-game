/**
 * @file MinesScene.ts
 * @purpose Phaser Scene for Mines — uses exact lobby header/footer for seamless UX
 * @author Agent 934
 * @date 2026-05-21
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { MinesUI } from '../games/MinesUI';
import { LobbyHeaderFooter } from '../shared/ui/LobbyHeaderFooter';

export class MinesScene extends Phaser.Scene {
  private minesUI: MinesUI | null = null;
  private lobbyHeaderFooter: LobbyHeaderFooter | null = null;

  constructor() { super({ key: 'MinesScene' }); }

  create(): void {
    const { width, height } = this.scale;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x050508);

    // Subtle grid pattern
    const grid = this.add.graphics();
    grid.lineStyle(0.3, 0x0d0d1a, 1);
    for (let x = 0; x <= width; x += 40) { grid.beginPath(); grid.moveTo(x, 0); grid.lineTo(x, height); grid.strokePath(); }
    for (let y = 0; y <= height; y += 40) { grid.beginPath(); grid.moveTo(0, y); grid.lineTo(width, y); grid.strokePath(); }

    // Create exact lobby header/footer
    this.lobbyHeaderFooter = new LobbyHeaderFooter({
      scene: this,
      balance: 100.50,
      onBack: () => window.location.href = 'https://zero-934.github.io/jett-landing/',
      onConnect: () => console.log('Connect wallet'),
      onHome: () => window.location.href = 'https://zero-934.github.io/jett-landing/',
      onGames: () => console.log('Games'),
      onHistory: () => console.log('History'),
      onRadio: () => console.log('Radio'),
    });

    // Initialize Mines UI (no GameContainer anymore, just Mines game logic)
    this.minesUI = new MinesUI(this, { houseEdge: 0.03 });
    this.minesUI.start();
  }

  shutdown(): void {
    this.minesUI?.cleanup();
    this.lobbyHeaderFooter?.destroy();
  }
}
