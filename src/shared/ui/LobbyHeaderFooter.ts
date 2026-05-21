/**
 * @file LobbyHeaderFooter.ts
 * @purpose Exact replica of lobby header/footer for seamless game transitions
 * @author Agent 934
 * @date 2026-05-21
 * @license Proprietary
 */

import * as Phaser from 'phaser';

export interface LobbyHeaderFooterConfig {
  scene: Phaser.Scene;
  onBack?: () => void;
  onConnect?: () => void;
  balance?: number;
  onHome?: () => void;
  onGames?: () => void;
  onHistory?: () => void;
  onRadio?: () => void;
}

export class LobbyHeaderFooter {
  private scene: Phaser.Scene;
  private config: LobbyHeaderFooterConfig;
  private headerBg: Phaser.GameObjects.Graphics | null = null;
  private footerBg: Phaser.GameObjects.Graphics | null = null;

  private readonly HEADER_HEIGHT = 60;
  private readonly FOOTER_HEIGHT = 60;
  private readonly GOLD = 0xc9a84c;
  private readonly GOLD_STR = '#c9a84c';

  constructor(config: LobbyHeaderFooterConfig) {
    this.scene = config.scene;
    this.config = config;
    
    this.buildHeader();
    this.buildFooter();
  }

  private buildHeader(): void {
    const { width } = this.scene.scale;

    // Gold top accent bar
    this.headerBg = this.scene.add.graphics().setDepth(100).setScrollFactor(0);
    this.headerBg.fillStyle(this.GOLD, 1);
    this.headerBg.fillRect(0, 0, width, 3);
    
    // Gradient bar below gold line (exact lobby style)
    this.headerBg.fillGradientStyle(this.GOLD, this.GOLD, 0x050508, 0x050508, 0.15, 0.15, 0, 0);
    this.headerBg.fillRect(0, 3, width, this.HEADER_HEIGHT - 3);

    // JETT logo (left side, exact position)
    this.scene.add.text(20, this.HEADER_HEIGHT / 2, 'JETT', {
      fontFamily: 'Fredoka One, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
      .setOrigin(0, 0.5)
      .setDepth(101);

    // Balance display (center-right, before Connect)
    this.scene.add.text(width - 160, this.HEADER_HEIGHT / 2, `⊙ ${(this.config.balance || 0).toFixed(2)}`, {
      fontFamily: 'Fredoka One, sans-serif',
      fontSize: '15px',
      color: this.GOLD_STR,
      fontStyle: 'bold',
    })
      .setOrigin(1, 0.5)
      .setDepth(101);

    // Connect button background (gold pill, far right)
    const btnBg = this.scene.add.graphics().setDepth(100);
    btnBg.fillStyle(this.GOLD, 1);
    btnBg.fillRoundedRect(width - 135, this.HEADER_HEIGHT / 2 - 18, 120, 36, 18);

    // Connect button text
    this.scene.add.text(width - 75, this.HEADER_HEIGHT / 2, 'Connect', {
      fontFamily: 'Fredoka One, sans-serif',
      fontSize: '13px',
      color: '#000000',
      fontStyle: 'bold',
    })
      .setOrigin(0.5, 0.5)
      .setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.config.onConnect?.());
  }

  private buildFooter(): void {
    const { width, height } = this.scene.scale;
    const footerY = height - this.FOOTER_HEIGHT;

    // Footer background
    this.footerBg = this.scene.add.graphics().setDepth(100).setScrollFactor(0);
    this.footerBg.fillStyle(0x050508, 1);
    this.footerBg.fillRect(0, footerY, width, this.FOOTER_HEIGHT);

    // Gold line separator
    this.footerBg.fillStyle(this.GOLD, 1);
    this.footerBg.fillRect(0, footerY, width, 2);

    // Navigation buttons
    const navItems = [
      { label: 'Home', icon: '🏠', onClick: this.config.onHome },
      { label: 'Games', icon: '🎮', onClick: this.config.onGames },
      { label: 'History', icon: '📊', onClick: this.config.onHistory },
      { label: 'Radio', icon: '📻', onClick: this.config.onRadio },
    ];

    const spacing = width / navItems.length;

    navItems.forEach((item, idx) => {
      const x = spacing * idx + spacing / 2;

      // Icon
      this.scene.add.text(x, footerY + this.FOOTER_HEIGHT / 2 - 10, item.icon, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
      })
        .setOrigin(0.5)
        .setDepth(101)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => item.onClick?.());

      // Label
      this.scene.add.text(x, footerY + this.FOOTER_HEIGHT / 2 + 12, item.label, {
        fontFamily: 'Fredoka, sans-serif',
        fontSize: '11px',
        color: '#888888',
      })
        .setOrigin(0.5)
        .setDepth(101);
    });
  }

  public updateBalance(amount: number): void {
    this.config.balance = amount;
    // Would need to store text reference to update dynamically
  }

  public getHeaderHeight(): number {
    return this.HEADER_HEIGHT;
  }

  public getFooterHeight(): number {
    return this.FOOTER_HEIGHT;
  }

  public destroy(): void {
    this.headerBg?.destroy();
    this.footerBg?.destroy();
  }
}
