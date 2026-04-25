/**
 * @file DoomCrashScene.ts
 * @purpose Phaser Scene for Doom Crash 2.0 — wires Logic and UI, drives game loop
 * @author Agent 934
 * @date 2026-04-24
 * @license Proprietary
 */

import * as Phaser from "phaser";
import {
  createInitialState,
  startSession,
  tick,
  shoot,
  cashOut,
  getSessionResult,
  MULTIPLIER_TICK_RATE_MS,
} from "../games/DoomCrashLogic";
import type { DoomCrashState } from "../games/DoomCrashLogic";
import { DoomCrashUI } from "../games/DoomCrashUI";
import { createRNG } from "../shared/rng/ProvablyFairRNG";
import type { ProvablyFairRNG } from "../shared/rng/ProvablyFairRNG";

const SCENE_KEY = "DoomCrashScene";
const INITIAL_BALANCE = 1000;
const DEFAULT_BET = 1;
const TICK_INTERVAL_MS = MULTIPLIER_TICK_RATE_MS;

export class DoomCrashScene extends Phaser.Scene {
  private gameState!: DoomCrashState;
  private ui!: DoomCrashUI;
  private rng!: ProvablyFairRNG;
  private balance: number = INITIAL_BALANCE;
  private currentBet: number = DEFAULT_BET;
  private tickTimer!: Phaser.Time.TimerEvent;
  private sessionActive: boolean = false;
  private balanceText!: Phaser.GameObjects.Text;
  private playButton!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENE_KEY });
  }

  /**
   * Initializes the scene, sets up UI, event listeners, and initial game state.
   */
  /** Adapter wrapping ProvablyFairRNG.random() as nextFloat() for Logic compatibility */
  private get rngAdapter(): { nextFloat(): number } {
    return { nextFloat: () => this.rng.random() };
  }

  create(): void {
    this.rng = createRNG();

    this.ui = new DoomCrashUI(this);
    this.ui.create();

    this.ui.onCashOutPressed = () => this.handleCashOut();
    this.ui.onEnemyTapped = (id) => this.handleEnemyTap(id);
    this.ui.onBetSelected = (amount) => this.handleBetSelected(amount);

    this.balanceText = this.add
      .text(
        this.cameras.main.width - 20,
        20,
        `◎ ${this.balance.toFixed(2)}`,
        {
          fontFamily: "Arial",
          fontSize: "16px",
          color: "#FFD700",
        }
      )
      .setOrigin(1, 0);

    this.playButton = this.add
      .text(
        this.cameras.main.width / 2,
        this.cameras.main.height - 50,
        "PLAY",
        {
          fontFamily: "Arial",
          fontSize: "24px",
          color: "#000000",
          backgroundColor: "#FFD700",
          padding: { x: 20, y: 10 },
        }
      )
      .setOrigin(0.5)
      .setInteractive()
      .on("pointerdown", () => this.handlePlay());

    this.gameState = createInitialState(this.currentBet);
    this.ui.updateState(this.gameState);
  }

  /**
   * Handles the 'PLAY' button press, starting a new game session.
   */
  private handlePlay(): void {
    if (this.sessionActive) {
      return;
    }

    if (this.balance < this.currentBet) {
      this.ui.showCrashEffect(); // insufficient funds feedback
      return;
    }

    this.balance -= this.currentBet;
    this.balanceText.setText(`◎ ${this.balance.toFixed(2)}`);

    this.gameState = createInitialState(this.currentBet);
    this.gameState = startSession(this.gameState, this.rngAdapter, Date.now());
    this.sessionActive = true;

    this.playButton.setVisible(false);
    this.tickTimer = this.time.addEvent({
      delay: TICK_INTERVAL_MS,
      callback: this.gameTick,
      callbackScope: this,
      loop: true,
    });

    this.ui.updateState(this.gameState);
  }

  /**
   * Called repeatedly by the game loop during an active session to advance game state.
   */
  private gameTick(): void {
    if (!this.sessionActive) {
      return;
    }

    this.gameState = tick(this.gameState, this.rngAdapter, Date.now());
    this.ui.renderEnemies(this.gameState.activeEnemies, Date.now());
    this.ui.updateState(this.gameState);

    if (this.gameState.isCrashed) {
      this.tickTimer.remove();
      this.sessionActive = false;
      this.ui.showCrashEffect();
      this.time.delayedCall(2000, this.showPlayButton, [], this);
    }

    if (this.gameState.isCashedOut) {
      // This is an edge case primarily for auto-cashout features if implemented
      this.tickTimer.remove();
      this.sessionActive = false;
    }
  }

  /**
   * Handles the 'Cash Out' action, ending the current session and calculating payout.
   */
  private handleCashOut(): void {
    if (!this.sessionActive) {
      return;
    }

    this.gameState = cashOut(this.gameState);
    this.tickTimer.remove();
    this.sessionActive = false;

    const result = getSessionResult(this.gameState);
    this.balance += result.payout;
    this.balanceText.setText(`◎ ${this.balance.toFixed(2)}`);
    this.ui.showCashOutEffect(result.multiplier);

    this.time.delayedCall(1500, this.showPlayButton, [], this);
  }

  /**
   * Handles an enemy being tapped/shot by the player.
   * @param enemyId The unique identifier of the enemy that was tapped.
   */
  private handleEnemyTap(enemyId: string): void {
    if (!this.sessionActive) {
      return;
    }

    this.gameState = shoot(this.gameState, enemyId, Date.now());
    this.ui.showHitFlash();
    this.ui.updateState(this.gameState);
  }

  /**
   * Handles the player selecting a new bet amount.
   * @param amount The new bet amount.
   */
  private handleBetSelected(amount: number): void {
    if (this.sessionActive) {
      return;
    }
    this.currentBet = amount;
    this.gameState = createInitialState(this.currentBet);
    this.ui.updateState(this.gameState);
  }

  /**
   * Helper method to reset the UI and game state for a new round and show the PLAY button.
   */
  private showPlayButton(): void {
    this.playButton.setVisible(true);
    this.ui.resetForNewRound();
    this.gameState = createInitialState(this.currentBet);
    this.ui.updateState(this.gameState);
  }
}
