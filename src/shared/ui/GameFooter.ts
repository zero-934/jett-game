/**
 * @file GameFooter.ts
 * @purpose Footer for game scenes: bet selector, fair verification, wallet, etc.
 * @author Agent 934
 * @date 2026-05-20
 * @license Proprietary
 */

import * as Phaser from 'phaser';

export interface GameFooterConfig {
  scene: Phaser.Scene;
  gameKey: string;
  betOptions?: number[];
  selectedBet?: number;
  onBetChange?: (bet: number) => void;
  onFairVerify?: () => void;
  onTransactionHistory?: () => void;
  onWalletConnect?: () => void;
  onSettings?: () => void;
  walletConnected?: boolean;
  walletName?: string;
  networkName?: string;
}

export class GameFooter {
  private scene: Phaser.Scene;
  private config: GameFooterConfig;
  private footerBg: Phaser.GameObjects.Graphics;
  private walletText: Phaser.GameObjects.Text;
  private betButton: Phaser.GameObjects.Text;
  private betDropdown: Phaser.GameObjects.Container | null = null;

  private readonly FOOTER_HEIGHT = 60;
  private readonly GOLD = '#c9a84c';
  private readonly DARK_BG = 0x050508;

  constructor(config: GameFooterConfig) {
    this.scene = config.scene;
    this.config = {
      betOptions: [10, 25, 50, 100],
      selectedBet: 10,
      walletConnected: false,
      walletName: 'Phantom',
      networkName: 'DEVNET',
      ...config,
    };

    const { width, height } = this.scene.scale;
    const footerY = height - this.FOOTER_HEIGHT;

    // Background bar (dark, matching lobby)
    this.footerBg = this.scene.add.graphics().setDepth(100);
    this.footerBg.fillStyle(this.DARK_BG, 1);
    this.footerBg.fillRect(0, footerY, width, this.FOOTER_HEIGHT);

    // Gold bottom accent line
    this.footerBg.fillStyle(0xc9a84c, 1);
    this.footerBg.fillRect(0, footerY, width, 3);

    const btnY = footerY + this.FOOTER_HEIGHT / 2;
    const spacing = 70; // Cleaner spacing
    let btnX = 20;

    // Bet Selector
    this.betButton = this.scene.add.text(btnX, btnY, `BET: ${this.config.selectedBet}`, {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: this.GOLD,
    })
      .setOrigin(0, 0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggleBetDropdown());

    btnX += spacing;

    // Fair Verification (⚡)
    this.scene.add.text(btnX, btnY, '⚡ FAIR', {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: this.GOLD,
    })
      .setOrigin(0, 0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.config.onFairVerify?.());

    btnX += spacing;

    // Transaction History (📊)
    this.scene.add.text(btnX, btnY, '📊 TXN', {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: this.GOLD,
    })
      .setOrigin(0, 0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.config.onTransactionHistory?.());

    btnX += spacing + 10;

    // Wallet State (🔗)
    const walletStatus = this.config.walletConnected ? `${this.config.walletName}` : 'CONNECT';
    const walletColor = this.config.walletConnected ? this.GOLD : '#ff6b6b';

    this.walletText = this.scene.add.text(btnX, btnY, `🔗 ${walletStatus}`, {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: walletColor,
    })
      .setOrigin(0, 0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.config.onWalletConnect?.());

    // Settings (right aligned)
    this.scene.add.text(width - 20, btnY, '⚙️', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
    })
      .setOrigin(1, 0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.config.onSettings?.());
  }

  private toggleBetDropdown(): void {
    if (this.betDropdown) {
      this.betDropdown.destroy();
      this.betDropdown = null;
      return;
    }

    const { height } = this.scene.scale;
    const dropdownY = height - this.FOOTER_HEIGHT - 10;
    const betOptions = this.config.betOptions || [10, 25, 50, 100];

    this.betDropdown = this.scene.add.container(20, dropdownY).setDepth(102);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a1f, 0.95);
    bg.fillRoundedRect(0, -betOptions.length * 32 - 8, 80, betOptions.length * 32 + 8, 6);
    bg.lineStyle(2, 0xc9a84c, 0.8);
    bg.strokeRoundedRect(0, -betOptions.length * 32 - 8, 80, betOptions.length * 32 + 8, 6);
    this.betDropdown.add(bg);

    // Options
    betOptions.forEach((bet, idx) => {
      const y = -betOptions.length * 32 + idx * 32 + 16;
      const txt = this.scene.add.text(40, y, `${bet}`, {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: bet === this.config.selectedBet ? '#c9a84c' : '#ffffff',
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.selectBet(bet));

      this.betDropdown!.add(txt);
    });
  }

  private selectBet(bet: number): void {
    this.config.selectedBet = bet;
    this.betButton.setText(`BET: ${bet}`);

    if (this.betDropdown) {
      this.betDropdown.destroy();
      this.betDropdown = null;
    }

    if (this.config.onBetChange) {
      this.config.onBetChange(bet);
    }
  }

  public updateWalletState(connected: boolean, walletName?: string): void {
    this.config.walletConnected = connected;
    if (walletName) this.config.walletName = walletName;

    const status = connected ? `${walletName || 'CONNECTED'}` : 'CONNECT';
    const color = connected ? this.GOLD : '#ff6b6b';

    this.walletText.setText(`🔗 ${status}`);
    this.walletText.setColor(color);
  }

  public getHeight(): number {
    return this.FOOTER_HEIGHT;
  }

  public destroy(): void {
    this.footerBg.destroy();
    this.walletText.destroy();
    this.betButton.destroy();
    if (this.betDropdown) this.betDropdown.destroy();
  }
}
