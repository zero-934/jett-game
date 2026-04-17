/**
 * @file InfernoScene.ts
 * @purpose Manages the game flow, UI interaction, and logic integration for the Inferno slot game.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import {
  createInfernoState,
  spinInferno,
  evaluateClusters,
  cascadeInferno,
  flipCrown,
  walkCrown,
} from '../games/InfernoLogic';
import type { InfernoState } from '../games/InfernoLogic';
import { InfernoUI } from '../games/InfernoUI';
import { ProvablyFairRNG, createRNG } from '../shared/rng/ProvablyFairRNG';

// --- Constants ---
const SCENE_KEY = 'InfernoScene';
const INITIAL_BALANCE = 1000;
const DEFAULT_BET = 10;
const BET_OPTIONS = [1, 5, 10, 25, 50];
const CHARCOAL_BG = 0x0d0d0d;
const GOLD_STR = '#c9a84c';

export class InfernoScene extends Phaser.Scene {
  private infernoState!: InfernoState;
  private infernoUI!: InfernoUI;
  private rng!: ProvablyFairRNG;
  private balance: number = INITIAL_BALANCE;
  private currentBet: number = DEFAULT_BET;
  private isSpinning: boolean = false;
  private balanceText!: Phaser.GameObjects.Text;
  private spinButton!: Phaser.GameObjects.Text;
  private betButtons: Phaser.GameObjects.Text[] = [];

  /**
   * Constructor for InfernoScene.
   * Sets the scene key.
   * @example
   * new InfernoScene();
   */
  constructor() {
    super({ key: SCENE_KEY });
  }

  /**
   * Phaser's create lifecycle method.
   * Initializes game state, UI, and sets up interactive elements.
   * @example
   * // Called automatically by Phaser when the scene starts.
   */
  create(): void {
    // Initialize RNG
    this.rng = createRNG();

    // Set background
    this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      CHARCOAL_BG,
    );

    // Initialize game state
    this.infernoState = createInfernoState(this.currentBet);

    // Initialize UI
    this.infernoUI = new InfernoUI(this);
    this.infernoUI.renderGrid(this.infernoState);
    this.infernoUI.updateHeatMeter(this.infernoState.heatMeter);
    this.infernoUI.updateBet(this.currentBet);
    this.infernoUI.updateWin(this.infernoState.totalWin);

    // Balance display
    this.balanceText = this.add
      .text(this.scale.width * 0.5, this.scale.height * 0.02, `BALANCE: $${this.balance}`, {
        fontFamily: 'Arial',
        fontSize: '28px',
        color: GOLD_STR,
      })
      .setOrigin(0.5, 0)
      .setDepth(10);

    // Bet selector buttons
    const betButtonY = this.scale.height * 0.85;
    const betButtonStartX = this.scale.width / 2 - (BET_OPTIONS.length - 1) * 60; // Center buttons
    BET_OPTIONS.forEach((betAmount, index) => {
      const button = this.add
        .text(betButtonStartX + index * 120, betButtonY, `$${betAmount}`, {
          fontFamily: 'Arial',
          fontSize: '24px',
          color: GOLD_STR,
          backgroundColor: '#333333',
          padding: { x: 15, y: 8 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.updateBet(betAmount))
        .setDepth(10);
      this.betButtons.push(button);
    });
    this.updateBetButtonHighlight();

    // Spin button
    this.spinButton = this.add
      .text(this.scale.width / 2, this.scale.height * 0.95, 'SPIN', {
        fontFamily: 'Arial Black',
        fontSize: '40px',
        color: GOLD_STR,
        backgroundColor: '#555555',
        padding: { x: 30, y: 15 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.handleSpin, this)
      .setDepth(10);

    // Back button
    this.add
      .text(this.scale.width * 0.05, this.scale.height * 0.02, '< BACK', {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: GOLD_STR,
      })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.goHome, this)
      .setDepth(10);
  }

  /**
   * Updates the visual highlight for the currently selected bet button.
   * @private
   */
  private updateBetButtonHighlight(): void {
    this.betButtons.forEach((button) => {
      const betAmount = parseInt(button.text.replace('$', ''), 10);
      if (betAmount === this.currentBet) {
        button.setStyle({ backgroundColor: GOLD_STR, color: CHARCOAL_BG });
      } else {
        button.setStyle({ backgroundColor: '#333333', color: GOLD_STR });
      }
    });
  }

  /**
   * Handles the player's choice to update their bet.
   *
   * @param newBet The new bet amount selected by the player.
   * @example
   * this.updateBet(25);
   */
  private updateBet(newBet: number): void {
    if (this.isSpinning) return;
    this.currentBet = newBet;
    this.infernoState.bet = newBet;
    this.infernoUI.updateBet(newBet);
    this.updateBetButtonHighlight();
  }

  /**
   * Initiates a new spin sequence.
   * Deducts the bet, triggers the spin logic, and starts the cascade processing.
   * @example
   * this.handleSpin(); // Called when the spin button is pressed.
   */
  private handleSpin(): void {
    if (this.isSpinning || this.infernoState.isInCrownFlip) {
      return;
    }

    if (this.balance < this.currentBet) {
      // TODO: Show "Insufficient funds" message
      console.warn('Insufficient funds!');
      return;
    }

    this.isSpinning = true;
    this.spinButton.disableInteractive().setAlpha(0.5);
    this.betButtons.forEach((btn) => btn.disableInteractive().setAlpha(0.5));

    this.balance -= this.currentBet;
    this.balanceText.setText(`BALANCE: $${this.balance}`);
    this.infernoUI.updateWin(0); // Reset win display for new spin

    // Check if the next spin should be an Inferno Spin based on previous state's heat meter
    const willBeInfernoSpin = this.infernoState.heatMeter === 5;

    const startSpinProcess = () => {
      // Store previous state for cascade animation
      const previousState = { ...this.infernoState };

      this.infernoState = spinInferno(this.infernoState, { rng: this.rng });
      this.infernoUI.renderGrid(this.infernoState); // Initial grid render

      // If it was an Inferno Spin, the heat meter was reset in logic, update UI
      if (previousState.heatMeter === 5) {
        this.infernoUI.updateHeatMeter(this.infernoState.heatMeter);
      }

      this.processSpinResult(previousState);
    };

    if (willBeInfernoSpin) {
      this.infernoUI.showInfernoBanner(startSpinProcess);
    } else {
      startSpinProcess();
    }
  }

  /**
   * Recursively processes the spin results, handling cluster evaluation and cascades.
   * This function uses a callback chain to manage asynchronous animations.
   *
   * @param previousState The state of the game *before* the current cascade step.
   * @private
   */
  private processSpinResult(_previousState: InfernoState): void {
    // Evaluate clusters for the current grid state
    this.infernoState = evaluateClusters(this.infernoState);

    if (this.infernoState.clusters.length > 0) {
      // If clusters are found, animate them
      this.infernoUI.animateClusters(this.infernoState.clusters, () => {
        // Show win badge for this cascade's win
        const currentCascadeWin = this.infernoState.clusters.reduce(
          (sum, cluster) => sum + cluster.payout,
          0,
        );
        if (currentCascadeWin > 0) {
          this.infernoUI.showWinBadge(currentCascadeWin);
        }

        // Update total win display
        this.infernoUI.updateWin(this.infernoState.totalWin);

        // Perform cascade logic to get the next state
        const stateAfterCascadeLogic = cascadeInferno(this.infernoState, { rng: this.rng });

        // Animate cells exploding and new ones falling in
        this.infernoUI.animateCascade(stateAfterCascadeLogic, () => {
          this.infernoState = stateAfterCascadeLogic; // Update scene's state to the new cascaded state
          this.infernoUI.updateHeatMeter(this.infernoState.heatMeter);

          // Recursively call to evaluate new grid after cascade
          this.processSpinResult(this.infernoState); // Pass the current state as previous for the next cascade
        });
      });
    } else {
      // No more clusters, spin sequence ends
      this.infernoState = { ...this.infernoState, isComplete: true };

      if (this.infernoState.isFreeSpinTriggered) {
        // TODO: Show "Free Spins Awarded" message
        console.log(`Awarded ${this.infernoState.freeSpinsRemaining} free spins!`);
      }

      if (this.infernoState.totalWin > 0 && this.infernoState.freeSpinsRemaining === 0) {
        // Only offer Crown Flip if there's a win and no free spins are pending
        this.infernoState = {
          ...this.infernoState,
          isInCrownFlip: true,
          crownFlipWin: this.infernoState.totalWin,
        };
        this.infernoUI.showCrownFlip(
          this.infernoState.crownFlipWin,
          this.handleCrownFlip,
          this.handleCrownWalk,
        );
      } else if (this.infernoState.freeSpinsRemaining > 0) {
        // If free spins are remaining, automatically trigger the next one
        this.endSpin(); // Finalize current spin, then next spin will be a free spin
        this.time.delayedCall(1000, () => this.handleSpin()); // Auto-spin for free spin
      } else {
        this.endSpin();
      }
    }
  }

  /**
   * Handles the player's decision to attempt a Crown Flip.
   * Updates the game state and UI based on the flip outcome.
   * @private
   */
  private handleCrownFlip = (): void => {
    this.infernoState = flipCrown(this.infernoState, { rng: this.rng });
    this.infernoUI.updateWin(this.infernoState.crownFlipWin); // Update win display immediately

    if (this.infernoState.crownFlipWin > 0) {
      // If won, re-show Crown Flip with new amount
      this.infernoUI.showCrownFlip(
        this.infernoState.crownFlipWin,
        this.handleCrownFlip,
        this.handleCrownWalk,
      );
    } else {
      // If lost, hide Crown Flip and end spin
      this.infernoUI.hideCrownFlip();
      this.endSpin();
    }
  };

  /**
   * Handles the player's decision to walk away from the Crown Flip.
   * Finalizes the win and ends the spin.
   * @private
   */
  private handleCrownWalk = (): void => {
    this.infernoState = walkCrown(this.infernoState);
    this.infernoUI.hideCrownFlip();
    this.endSpin();
  };

  /**
   * Finalizes the current spin, adds winnings to balance, and resets UI elements.
   * @private
   */
  private endSpin(): void {
    this.balance += this.infernoState.totalWin;
    this.balanceText.setText(`BALANCE: $${this.balance}`);
    this.infernoUI.updateWin(0); // Reset win display for next spin

    this.isSpinning = false;
    this.spinButton.setInteractive({ useHandCursor: true }).setAlpha(1);
    this.betButtons.forEach((btn) => btn.setInteractive({ useHandCursor: true }).setAlpha(1));

    // If there are free spins remaining, the next spin should be a free spin
    if (this.infernoState.freeSpinsRemaining > 0) {
      // The auto-spin for free spins is handled in processSpinResult
    }
  }

  /**
   * Navigates back to the HomeScene.
   * @example
   * this.goHome(); // Called when the back button is pressed.
   */
  private goHome(): void {
    this.scene.start('HomeScene'); // Assuming 'HomeScene' is the key for your home scene
  }
}
