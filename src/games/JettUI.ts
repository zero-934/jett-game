/**
 * @file JettUI.ts
 * @purpose Phaser rendering and input handling for Jett — player sprite, obstacle rendering,
 *          HUD (multiplier, altitude, cash-out button). Delegates all state changes to JettLogic.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import Phaser from 'phaser';
import {
  JettState,
  JettConfig,
  createJettState,
  tickJett,
  cashOutJett,
} from './JettLogic';

const GOLD = 0xc9a84c;
const CHARCOAL = 0x0d0d0d;
const OBSTACLE_COLOR = 0x3a3a5c;
const PLAYER_COLOR = 0xc9a84c;

/**
 * Manages all Phaser game objects for the Jett game within a given scene.
 *
 * @example
 * const ui = new JettUI(scene, { worldWidth: 390, worldHeight: 844 });
 * ui.start(10);
 */
export class JettUI {
  private scene: Phaser.Scene;
  private config: JettConfig;
  private state: JettState | null = null;

  private playerRect: Phaser.GameObjects.Rectangle | null = null;
  private obstacleGroup: Phaser.GameObjects.Group | null = null;
  private multiplierText: Phaser.GameObjects.Text | null = null;
  private altitudeText: Phaser.GameObjects.Text | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private cashOutButton: Phaser.GameObjects.Rectangle | null = null;
  private cashOutLabel: Phaser.GameObjects.Text | null = null;
  private pointerX: number;
  private tickTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, config: JettConfig) {
    this.scene = scene;
    this.config = config;
    this.pointerX = config.worldWidth / 2;
  }

  /**
   * Starts a new Jett game with the given bet.
   *
   * @param bet - Credit amount wagered.
   * @returns void
   *
   * @example
   * ui.start(10);
   */
  public start(bet: number): void {
    this.cleanup();
    this.state = createJettState(bet, this.config);
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
   * Stops the game and removes all game objects from the scene.
   *
   * @returns void
   *
   * @example
   * ui.cleanup();
   */
  public cleanup(): void {
    this.tickTimer?.remove();
    this.tickTimer = null;
    this.playerRect?.destroy();
    this.obstacleGroup?.destroy(true);
    this.multiplierText?.destroy();
    this.altitudeText?.destroy();
    this.statusText?.destroy();
    this.cashOutButton?.destroy();
    this.cashOutLabel?.destroy();
    this.state = null;
  }

  private buildScene(): void {
    const { worldWidth, worldHeight } = this.config;

    this.obstacleGroup = this.scene.add.group();

    this.playerRect = this.scene.add.rectangle(
      worldWidth / 2,
      worldHeight - 60,
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

    this.altitudeText = this.scene.add
      .text(16, 44, 'ALT: 0', {
        fontFamily: 'monospace',
        fontSize: '14px',
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
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.pointerX = pointer.x;
    });
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.pointerX = pointer.x;
    });
  }

  private onTick(): void {
    if (!this.state || !this.state.isAlive || this.state.cashedOut) return;

    tickJett(this.state, this.pointerX, 2, this.config);
    this.renderFrame();

    if (!this.state.isAlive) {
      this.showResult('CRASHED', '#ff4444');
      this.tickTimer?.remove();
    }
  }

  private renderFrame(): void {
    if (!this.state) return;

    // Update player position
    this.playerRect?.setPosition(this.state.playerX, this.state.playerY);

    // Sync obstacles
    this.obstacleGroup?.clear(true, true);
    for (const obstacle of this.state.obstacles) {
      this.scene.add.rectangle(
        obstacle.x + obstacle.width / 2,
        obstacle.y + obstacle.height / 2,
        obstacle.width,
        obstacle.height,
        OBSTACLE_COLOR
      );
    }

    // HUD
    this.multiplierText?.setText(`x${this.state.multiplier.toFixed(2)}`);
    this.altitudeText?.setText(`ALT: ${Math.floor(this.state.altitude)}`);
  }

  private handleCashOut(): void {
    if (!this.state) return;
    const payout = cashOutJett(this.state);
    this.tickTimer?.remove();
    this.showResult(`PAID OUT: ${payout.toFixed(2)}`, '#c9a84c');
  }

  private showResult(message: string, color: string): void {
    this.statusText?.setText(message).setColor(color);
  }
}
