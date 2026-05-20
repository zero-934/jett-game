/**
 * @file GameFooter.ts
 * @purpose Footer for game scenes: fair verification, transaction history, wallet state, settings
 * @author Agent 934
 * @date 2026-05-20
 * @license Proprietary
 */

import * as Phaser from 'phaser';

export interface GameFooterConfig {
  scene: Phaser.Scene;
  gameKey: string; // 'mines', 'dice', etc. for fair verification lookup
  onFairVerify?: () => void;
  onTransactionHistory?: () => void;
  onWalletConnect?: () => void;
  onSettings?: () => void;
  walletConnected?: boolean;
  walletName?: string; // 'Phantom', 'Solflare', etc.
  networkName?: string; // 'Mainnet', 'Devnet', 'Testnet'
}

export class GameFooter {
  private scene: Phaser.Scene;
  private config: GameFooterConfig;
  private footerBg: Phaser.GameObjects.Graphics;
  private walletText: Phaser.GameObjects.Text;

  private readonly FOOTER_HEIGHT = 56;
  private readonly GOLD = '#c9a84c';
  private readonly DARK_BG = 0x000000;

  constructor(config: GameFooterConfig) {
    this.scene = config.scene;
    this.config = {
      walletConnected: false,
      walletName: 'Phantom',
      networkName: 'Devnet',
      ...config,
    };

    const { width, height } = this.scene.scale;
    const footerY = height - this.FOOTER_HEIGHT;

    // Background bar
    this.footerBg = this.scene.add.graphics().setDepth(100);
    this.footerBg.fillStyle(this.DARK_BG, 0.9);
    this.footerBg.fillRect(0, footerY, width, this.FOOTER_HEIGHT);

    // Gold bottom accent line
    this.footerBg.fillStyle(0xc9a84c, 1);
    this.footerBg.fillRect(0, footerY, width, 3);

    // Calculate button positions
    const btnY = footerY + this.FOOTER_HEIGHT / 2;
    const btnSpacing = width / 5; // 5 buttons/areas
    let btnX = btnSpacing / 2;

    // Fair Verification Button (⚡)
    this.scene.add.text(btnX, btnY, '⚡', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
    })
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.config.onFairVerify?.());

    this.scene.add.text(btnX, btnY + 18, 'FAIR', {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: this.GOLD,
    })
      .setOrigin(0.5)
      .setDepth(101);

    btnX += btnSpacing;

    // Transaction History Button (📊)
    this.scene.add.text(btnX, btnY, '📊', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
    })
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.config.onTransactionHistory?.());

    this.scene.add.text(btnX, btnY + 18, 'TXN', {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: this.GOLD,
    })
      .setOrigin(0.5)
      .setDepth(101);

    btnX += btnSpacing;

    // Wallet State Button (🔗)
    this.scene.add.text(btnX, btnY, '🔗', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
    })
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.config.onWalletConnect?.());

    const walletStatus = this.config.walletConnected ? `${this.config.walletName}` : 'Connect';
    this.walletText = this.scene.add.text(btnX, btnY + 18, walletStatus, {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: this.config.walletConnected ? this.GOLD : '#ff6b6b',
    })
      .setOrigin(0.5)
      .setDepth(101);

    btnX += btnSpacing;

    // Network Indicator (no click, just display)
    this.scene.add.text(btnX, btnY, '🌐', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
    })
      .setOrigin(0.5)
      .setDepth(101);

    this.scene.add.text(btnX, btnY + 18, this.config.networkName || 'DEVNET', {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#888888',
    })
      .setOrigin(0.5)
      .setDepth(101);

    btnX += btnSpacing;

    // Settings Button (⚙️)
    this.scene.add.text(btnX, btnY, '⚙️', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
    })
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.config.onSettings?.());

    this.scene.add.text(btnX, btnY + 18, 'SETTINGS', {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: this.GOLD,
    })
      .setOrigin(0.5)
      .setDepth(101);
  }

  public updateWalletState(connected: boolean, walletName?: string): void {
    this.config.walletConnected = connected;
    if (walletName) this.config.walletName = walletName;

    const status = connected ? `${walletName || 'Connected'}` : 'Connect';
    const color = connected ? this.GOLD : '#ff6b6b';

    this.walletText.setText(status);
    this.walletText.setColor(color);
  }

  public getHeight(): number {
    return this.FOOTER_HEIGHT;
  }

  public destroy(): void {
    this.footerBg.destroy();
    this.walletText.destroy();
  }
}
