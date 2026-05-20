/**
 * @file GameHeader.ts
 * @purpose Minimal header for game scenes: back button, title, bet selector, balance
 * @author Agent 934
 * @date 2026-05-20
 * @license Proprietary
 */

import * as Phaser from 'phaser';

export interface GameHeaderConfig {
  scene: Phaser.Scene;
  title: string;
  balance: number;
  betOptions?: number[]; // Default: [10, 25, 50, 100]
  selectedBet?: number;
  onBack: () => void;
  onBetChange?: (bet: number) => void;
}

export class GameHeader {
  private scene: Phaser.Scene;
  private config: GameHeaderConfig;
  private headerBg: Phaser.GameObjects.Graphics;
  private balanceText: Phaser.GameObjects.Text;
  private betButton: Phaser.GameObjects.Text;
  private betDropdown: Phaser.GameObjects.Container | null = null;

  private readonly HEADER_HEIGHT = 48;
  private readonly GOLD = '#c9a84c';
  private readonly DARK_BG = 0x000000;

  constructor(config: GameHeaderConfig) {
    this.scene = config.scene;
    this.config = {
      betOptions: [10, 25, 50, 100],
      selectedBet: 10,
      ...config,
    };

    const { width } = this.scene.scale;

    // Background bar
    this.headerBg = this.scene.add.graphics().setDepth(100);
    this.headerBg.fillStyle(this.DARK_BG, 0.9);
    this.headerBg.fillRect(0, 0, width, this.HEADER_HEIGHT);

    // Gold top accent line
    this.headerBg.fillStyle(0xc9a84c, 1);
    this.headerBg.fillRect(0, 0, width, 3);

    // Back button (← style, like lobby)
    this.scene.add.text(18, this.HEADER_HEIGHT / 2, '←', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: this.GOLD,
    })
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.config.onBack());

    // Game title (centered)
    this.scene.add.text(width / 2, this.HEADER_HEIGHT / 2, this.config.title, {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: this.GOLD,
    })
      .setOrigin(0.5)
      .setDepth(101);

    // Bet selector button
    this.betButton = this.scene.add.text(width - 120, this.HEADER_HEIGHT / 2, `BET: ${this.config.selectedBet}`, {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffffff',
    })
      .setOrigin(0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggleBetDropdown());

    // Balance display (top right)
    this.balanceText = this.scene.add.text(width - 18, this.HEADER_HEIGHT / 2, `💰 ${this.config.balance.toFixed(2)}`, {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: this.GOLD,
    })
      .setOrigin(1, 0.5)
      .setDepth(101);
  }

  private toggleBetDropdown(): void {
    if (this.betDropdown) {
      this.betDropdown.destroy();
      this.betDropdown = null;
      return;
    }

    const { width } = this.scene.scale;
    const dropdownX = width - 120;
    const dropdownY = this.HEADER_HEIGHT + 10;
    const betOptions = this.config.betOptions || [10, 25, 50, 100];

    this.betDropdown = this.scene.add.container(dropdownX, dropdownY).setDepth(102);

    // Background for dropdown
    const dropdownBg = this.scene.add.graphics();
    dropdownBg.fillStyle(0x1a1a1f, 0.95);
    dropdownBg.fillRoundedRect(-60, 0, 120, betOptions.length * 36 + 8, 6);
    dropdownBg.lineStyle(2, 0xc9a84c, 0.8);
    dropdownBg.strokeRoundedRect(-60, 0, 120, betOptions.length * 36 + 8, 6);
    this.betDropdown.add(dropdownBg);

    // Bet options
    betOptions.forEach((bet, idx) => {
      const y = 12 + idx * 36;
      const txt = this.scene.add.text(0, y, `${bet}`, {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
        fontSize: '14px',
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

  public updateBalance(amount: number): void {
    this.config.balance = amount;
    this.balanceText.setText(`💰 ${amount.toFixed(2)}`);
  }

  public getHeight(): number {
    return this.HEADER_HEIGHT;
  }

  public destroy(): void {
    this.headerBg.destroy();
    this.balanceText.destroy();
    this.betButton.destroy();
    if (this.betDropdown) this.betDropdown.destroy();
  }
}
