/**
 * @file GameContainer.ts
 * @purpose Reusable container for all games (header + footer + game area)
 * @author Agent 934
 * @date 2026-05-20
 * @license Proprietary
 */

import * as Phaser from 'phaser';
import type { GameHeaderConfig } from './GameHeader';
import type { GameFooterConfig } from './GameFooter';
import { GameHeader } from './GameHeader';
import { GameFooter } from './GameFooter';

export interface GameContainerConfig extends GameHeaderConfig, GameFooterConfig {
  gameKey: string;
}

export interface GameAreaBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class GameContainer {
  private scene: Phaser.Scene;
  private config: GameContainerConfig;
  private header: GameHeader;
  private footer: GameFooter;

  constructor(config: GameContainerConfig) {
    this.scene = config.scene;
    this.config = config;

    // Create header (minimal, like lobby)
    this.header = new GameHeader({
      scene: this.scene,
      title: config.title,
      balance: config.balance,
      onBack: config.onBack,
    });

    // Create footer
    this.footer = new GameFooter({
      scene: this.scene,
      gameKey: config.gameKey,
      onFairVerify: config.onFairVerify,
      onTransactionHistory: config.onTransactionHistory,
      onWalletConnect: config.onWalletConnect,
      onSettings: config.onSettings,
      walletConnected: config.walletConnected,
      walletName: config.walletName,
      networkName: config.networkName,
    });
  }

  /**
   * Get the safe bounds for the game area (between header and footer)
   */
  public getGameAreaBounds(): GameAreaBounds {
    const { width } = this.scene.scale;
    const headerHeight = this.header.getHeight();
    const footerHeight = this.footer.getHeight();
    const { height } = this.scene.scale;

    return {
      x: 0,
      y: headerHeight,
      width: width,
      height: height - headerHeight - footerHeight,
    };
  }

  /**
   * Update the balance displayed in the header
   */
  public updateBalance(amount: number): void {
    this.header.updateBalance(amount);
  }

  /**
   * Update the bet amount
   */
  public updateBet(bet: number): void {
    this.config.selectedBet = bet;
  }

  /**
   * Get current selected bet
   */
  public getSelectedBet(): number {
    return this.config.selectedBet || 10;
  }

  /**
   * Update wallet connection state
   */
  public updateWalletState(connected: boolean, walletName?: string): void {
    this.footer.updateWalletState(connected, walletName);
  }

  /**
   * Clean up all components
   */
  public destroy(): void {
    this.header.destroy();
    this.footer.destroy();
  }
}
