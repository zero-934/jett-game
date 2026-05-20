/**
 * @file MinesScene.ts
 * @purpose Phaser Scene for Mines — uses GameContainer pattern
 * @author Agent 934
 * @date 2026-05-20
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import { MinesUI } from '../games/MinesUI';
import { GameContainer } from '../shared/ui/GameContainer';

export class MinesScene extends Phaser.Scene {
  private minesUI: MinesUI | null = null;
  private gameContainer: GameContainer | null = null;

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

    // Create game container (header + footer + game area)
    this.gameContainer = new GameContainer({
      scene: this,
      gameKey: 'mines',
      title: 'MINES',
      balance: 100.50,
      betOptions: [10, 25, 50, 100],
      selectedBet: 10,
      onBack: () => window.location.href = 'https://zero-934.github.io/jett-landing/',
      onBetChange: (bet) => console.log('Bet changed to:', bet),
      onFairVerify: () => console.log('Fair verification clicked'),
      onTransactionHistory: () => console.log('Transaction history clicked'),
      onWalletConnect: () => console.log('Wallet connect clicked'),
      onSettings: () => console.log('Settings clicked'),
      walletConnected: false,
      walletName: 'Phantom',
      networkName: 'DEVNET',
    });

    // Initialize Mines UI with game area bounds
    this.minesUI = new MinesUI(this, { houseEdge: 0.03 });
    this.minesUI.start();
  }

  shutdown(): void {
    this.minesUI?.cleanup();
    this.gameContainer?.destroy();
  }
}
