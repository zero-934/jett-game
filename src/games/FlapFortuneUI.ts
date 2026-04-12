/**
 * @file FlapFortuneUI.ts
 * @purpose Phaser rendering and input for Flap Fortune — player bird, pipe rendering,
 *          distance HUD, multiplier, cash-out button. Delegates logic to FlapFortuneLogic.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import Phaser from 'phaser';
import {
  FlapFortuneState,
  FlapFortuneConfig,
  createFlapFortuneState,
  tickFlapFortune,
  cashOutFlapFortune,
} from './FlapFortuneLogic';

const GOLD = 0xc9a84c;
const PIPE_COLOR = 0x2a4a2a;
const PLAYER_COLOR = 0xc9a84c;

/**
 * Manages all Phaser game objects for Flap Fortune within a given scene.
 *
 * @example
 * const ui = new FlapFortuneUI(scene, { worldWidth: 390, worldHeight: 844 });
 * ui.start(10);
 */
export class FlapFortuneUI {
  private scene: Phaser.Scene;
  private config: FlapFortuneConfig;
  private state: FlapFortuneState | null = null;

  private playerRect: Phaser.GameObjects.Rectangle | null = null;
  private pipeRects: Phaser.GameObjects.Rectangle[] = [];
  private multiplierText: Phaser.GameObjects.Text | null = null;
  private distanceText: Phaser.GameObjects.Text | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private cashOutButton: Phaser.GameObjects.Rectangle | null = null;
  private cashOutLabel: Phaser.GameObjects.Text | null = null;
  private tickTimer: Phaser.Time.TimerEvent | null = null;
  private isFlapping = false;

  constructor(scene: Phaser.Scene, config: FlapFortuneConfig) {
    this.scene = scene;
    this.config = config;
  }

  /**
   * Starts a new Flap Fortune game with the given bet.
   *
   * @param bet - Credit amount wagered.
   * @returns void
   *
   * @example
   * ui.start(10);
   */
  public start(bet: number): void {
    this.cleanup();
    this.state = createFlapFortuneState(bet, this.config);
    this.buildScene();
    this.registerInput();
    this.tickTimer = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: this.onTick,
      callbackScope: this,
    });
  }

  /**
   * Destroys all Phaser game objects managed by this UI.
   *
   * @returns void
   */
  public cleanup(): void {
    this.tickTimer?.remove();
    this.tickTimer = null;
    this.playerRect?.destroy();
    for (const rect of this.pipeRects) rect.destroy();
    this.pipeRects = [];
    this.multiplierText?.destroy();
    this.distanceText?.destroy();
    this.statusText?.destroy();
    this.cashOutButton?.destroy();
    this.cashOutLabel?.destroy();
    this.state = null;
  }

  private buildScene(): void {
    const { worldWidth, worldHeight } = this.config;

    // Player at fixed horizontal position
    this.playerRect = this.scene.add.rectangle(
      80,
      worldHeight / 2,
      this.state!.playerWidth,
      this.state!.playerHeight,
      PLAYER_COLOR
    );

    // HUD
    this.multiplierText = this.scene.add
      .text(16, 16, 'x1.00', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#c9a84c',
      });

    this.distanceText = this.scene.add
      .text(16, 44, 'DIST: 0', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#888888',
      });

    this.statusText = this.scene.add
      .text(worldWidth / 2, worldHeight / 2, '', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Cash-out button
    this.cashOutButton = this.scene.add
      .rectangle(worldWidth - 70, 28, 120, 40, GOLD)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleCashOut());

    this.cashOutLabel = this.scene.add
      .text(worldWidth - 70, 28, 'CASH OUT', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#0d0d0d',
      })
      .setOrigin(0.5);
  }

  private registerInput(): void {
    this.scene.input.on('pointerdown', () => {
      this.isFlapping = true;
    });
    this.scene.input.on('pointerup', () => {
      this.isFlapping = false;
    });
    // Keyboard spacebar support
    this.scene.input.keyboard?.on('keydown-SPACE', () => {
      this.isFlapping = true;
    });
    this.scene.input.keyboard?.on('keyup-SPACE', () => {
      this.isFlapping = false;
    });
  }

  private onTick(): void {
    if (!this.state || !this.state.isAlive || this.state.cashedOut) return;

    tickFlapFortune(this.state, this.isFlapping, this.config);
    // Reset flap to single-frame pulse (tap behavior)
    this.isFlapping = false;
    this.renderFrame();

    if (!this.state.isAlive) {
      this.showResult('CRASHED', '#ff4444');
      this.tickTimer?.remove();
    }
  }

  private renderFrame(): void {
    if (!this.state) return;
    const { worldHeight } = this.config;
    const pipeWidth = 40;

    // Update player Y
    this.playerRect?.setY(this.state.playerY);

    // Clear and redraw pipes
    for (const rect of this.pipeRects) rect.destroy();
    this.pipeRects = [];

    for (const pipe of this.state.pipes) {
      // Top pipe
      const topRect = this.scene.add.rectangle(
        pipe.x + pipeWidth / 2,
        pipe.topHeight / 2,
        pipeWidth,
        pipe.topHeight,
        PIPE_COLOR
      );
      // Bottom pipe
      const bottomRect = this.scene.add.rectangle(
        pipe.x + pipeWidth / 2,
        worldHeight - pipe.bottomHeight / 2,
        pipeWidth,
        pipe.bottomHeight,
        PIPE_COLOR
      );
      this.pipeRects.push(topRect, bottomRect);
    }

    this.multiplierText?.setText(`x${this.state.multiplier.toFixed(2)}`);
    this.distanceText?.setText(`DIST: ${Math.floor(this.state.distanceTravelled)}`);
  }

  private handleCashOut(): void {
    if (!this.state) return;
    const payout = cashOutFlapFortune(this.state);
    this.tickTimer?.remove();
    this.showResult(`PAID OUT: ${payout.toFixed(2)}`, '#c9a84c');
  }

  private showResult(message: string, color: string): void {
    this.statusText?.setText(message).setColor(color);
  }
}
