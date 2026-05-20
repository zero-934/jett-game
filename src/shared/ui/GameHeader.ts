/**
 * @file GameHeader.ts
 * @purpose Minimal header matching lobby feel: back button, title, balance
 * @author Agent 934
 * @date 2026-05-20
 * @license Proprietary
 */

import * as Phaser from 'phaser';

export interface GameHeaderConfig {
  scene: Phaser.Scene;
  title: string;
  balance: number;
  onBack: () => void;
}

export class GameHeader {
  private scene: Phaser.Scene;
  private config: GameHeaderConfig;
  private headerBg: Phaser.GameObjects.Graphics;
  private balanceText: Phaser.GameObjects.Text;
  private backButtonDOM: Phaser.GameObjects.DOMElement | null = null;
  private titleText: Phaser.GameObjects.Text;

  private readonly HEADER_HEIGHT = 52;
  private readonly GOLD = '#c9a84c';
  private readonly DARK_BG = 0x050508;

  constructor(config: GameHeaderConfig) {
    this.scene = config.scene;
    this.config = config;

    const { width } = this.scene.scale;

    // Background bar (dark, matching lobby)
    this.headerBg = this.scene.add.graphics().setDepth(100);
    this.headerBg.fillStyle(this.DARK_BG, 1);
    this.headerBg.fillRect(0, 0, width, this.HEADER_HEIGHT);

    // Gold top accent line (matches lobby)
    this.headerBg.fillStyle(0xc9a84c, 1);
    this.headerBg.fillRect(0, 0, width, 3);

    // Back button as DOM element (pill-styled, crisp text)
    this.backButtonDOM = this.scene.add.dom(20, this.HEADER_HEIGHT / 2, 'button', 
      'style="background-color: transparent; border: 2px solid #c9a84c; color: #c9a84c; padding: 6px 12px; border-radius: 20px; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; cursor: pointer; margin: 0;"',
      '← LOBBY'
    );
    this.backButtonDOM.setOrigin(0.5);
    this.backButtonDOM.node.addEventListener('click', () => this.config.onBack());

    // Game title (centered, crisp text)
    this.titleText = this.scene.add.text(width / 2, this.HEADER_HEIGHT / 2, this.config.title, {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: this.GOLD,
    })
      .setOrigin(0.5)
      .setDepth(101);

    // Balance display (right side, clean spacing)
    this.balanceText = this.scene.add.text(width - 20, this.HEADER_HEIGHT / 2, `💰 ${this.config.balance.toFixed(2)}`, {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: this.GOLD,
    })
      .setOrigin(1, 0.5)
      .setDepth(101);
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
    this.titleText.destroy();
    this.backButtonDOM?.destroy();
  }
}
