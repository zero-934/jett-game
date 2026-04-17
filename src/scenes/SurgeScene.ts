/**
 * @file SurgeScene.ts
 * @purpose Defines the Phaser Scene for the Surge slot game, wiring logic and UI components.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary
 */

import * as Phaser from 'phaser';
import type { SurgeState } from '../games/SurgeLogic';
import { createSurgeState, spinSurge, flipCrown, walkCrown } from '../games/SurgeLogic';
import { SurgeUI } from '../games/SurgeUI';
import { createRNG } from '../shared/rng/ProvablyFairRNG';

// --- Constants ---
const SCENE_KEY = 'SurgeScene';
const HOME_SCENE_KEY = 'HomeScene'; // Assuming a HomeScene exists

const CANVAS_WIDTH = 390;
const CANVAS_HEIGHT = 844;

const INITIAL_BALANCE = 1000;
const INITIAL_BET = 10;
const BET_OPTIONS = [1, 5, 10, 25, 50];

const GOLD_STR = '#c9a84c';
const DARK_GREY = 0x222222;

const UI_TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Arial Black',
  fontSize: '24px',
  color: GOLD_STR,
  stroke: '#000000',
  strokeThickness: 4,
};

const SMALL_TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'Arial',
  fontSize: '16px',
  color: GOLD_STR,
  stroke: '#000000',
  strokeThickness: 2,
};

export class SurgeScene extends Phaser.Scene {
  private surgeState: SurgeState;
  private surgeUI!: SurgeUI;
  private balance: number;
  private currentBet: number;
  private rng = createRNG(); // Main RNG for the scene

  private balanceText!: Phaser.GameObjects.Text;
  private betButtons: Phaser.GameObjects.Text[] = [];
  private backButton!: Phaser.GameObjects.Text;

  /**
   * Creates an instance of SurgeScene.
   */
  constructor() {
    super({ key: SCENE_KEY });
    this.balance = INITIAL_BALANCE;
    this.currentBet = INITIAL_BET;
    this.surgeState = createSurgeState(this.currentBet);
  }

  /**
   * Phaser's create lifecycle method. Initializes the scene's game objects and logic.
   */
  create(): void {
    // Background
    this.add.rectangle(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      DARK_GREY
    );

    // Initialize UI
    this.surgeUI = new SurgeUI(this);
    this.surgeUI.start();
    this.surgeUI.setOnSpin(() => this.handleSpin());

    // Balance Display
    this.balanceText = this.add.text(
      CANVAS_WIDTH / 2,
      10,
      `BALANCE: ${this.balance.toFixed(2)}`,
      UI_TEXT_STYLE
    ).setOrigin(0.5);

    // Bet Buttons
    const betButtonY = CANVAS_HEIGHT - 180;
    const betButtonSpacing = 60;
    const startX = CANVAS_WIDTH / 2 - (BET_OPTIONS.length - 1) * betButtonSpacing / 2;

    BET_OPTIONS.forEach((bet, index) => {
      const button = this.add.text(
        startX + index * betButtonSpacing,
        betButtonY,
        `${bet}`,
        SMALL_TEXT_STYLE
      ).setOrigin(0.5).setInteractive({ useHandCursor: true });
      button.setBackgroundColor(this.currentBet === bet ? GOLD_STR : '#333333').setPadding(5, 10, 5, 10);
      button.on('pointerdown', () => this.setBet(bet));
      this.betButtons.push(button);
    });

    // Back Button
    this.backButton = this.add.text(
      20,
      18,
      '< BACK',
      SMALL_TEXT_STYLE
    ).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    this.backButton.on('pointerdown', () => this.scene.start(HOME_SCENE_KEY));

    // Initial UI updates
    this.updateBalanceDisplay();
    this.surgeUI.updateBet(this.currentBet);
    this.surgeUI.updateWin(0);
    this.surgeUI.updateSurgeMeter(this.surgeState.surgeMeter, this.surgeState.surgeSpinsRemaining);
    this.surgeUI.renderGrid(this.surgeState); // Render initial empty grid
  }

  /**
   * Sets the current bet amount and updates the UI.
   * @param newBet The new bet amount.
   */
  private setBet(newBet: number): void {
    if (this.surgeState.isInCrownFlip || !this.surgeState.isComplete) {
      return; // Cannot change bet during active game or crown flip
    }
    this.currentBet = newBet;
    this.surgeState.bet = newBet;
    this.betButtons.forEach(button => {
      const betValue = parseFloat(button.text);
      button.setBackgroundColor(betValue === newBet ? GOLD_STR : '#333333');
    });
    this.surgeUI.updateBet(newBet);
  }

  /**
   * Updates the balance display text.
   */
  private updateBalanceDisplay(): void {
    this.balanceText.setText(`BALANCE: ${this.balance.toFixed(2)}`);
  }

  /**
   * Handles the spin action, deducting bet, triggering spin logic, and animating UI.
   */
  private handleSpin(): void {
    if (!this.surgeState.isComplete || this.surgeState.isInCrownFlip) {
      return; // Prevent multiple spins or spins during crown flip
    }

    this.surgeUI.setSpinButtonEnabled(false);
    this.surgeUI.updateWin(0); // Reset win display for new spin

    // Deduct bet if not a free spin
    if (this.surgeState.freeSpinsRemaining === 0) {
      if (this.balance < this.currentBet) {
        this.surgeUI.showFlash('NOT ENOUGH CREDITS!', 'Please adjust your bet or add funds.', 1500, () => {
          this.surgeUI.setSpinButtonEnabled(true);
        });
        return;
      }
      this.balance -= this.currentBet;
      this.updateBalanceDisplay();
    }

    // Determine spin button text
    if (this.surgeState.surgeSpinsRemaining > 0) {
      this.surgeUI.setSpinButtonText('SURGE');
    } else if (this.surgeState.freeSpinsRemaining > 0) {
      this.surgeUI.setSpinButtonText('FREE SPIN');
    } else {
      this.surgeUI.setSpinButtonText('SPIN');
    }

    // Trigger surge banner if a surge spin is about to happen
    const isAboutToSurge = this.surgeState.surgeSpinsRemaining > 0;
    const wildReel = this.surgeState.surgeWildReel; // Will be set by spinSurge if it's a surge spin

    const performSpin = () => {
      this.surgeState = spinSurge(this.surgeState, { rng: this.rng });

      const finalGridSymbols = this.surgeState.grid.map((row) =>
        row.map((cell) => cell.symbol)
      );

      this.surgeUI.animateSpin(finalGridSymbols, () => {
        this.surgeUI.renderGrid(this.surgeState);
        this.handlePostSpinAnimations();
      });
    };

    if (isAboutToSurge && wildReel !== -1) {
      this.surgeUI.showSurgeBanner(wildReel, performSpin);
    } else {
      performSpin();
    }
  }

  /**
   * Handles animations and logic after the reels have stopped spinning.
   */
  private handlePostSpinAnimations(): void {
    this.surgeUI.updateSurgeMeter(this.surgeState.surgeMeter, this.surgeState.surgeSpinsRemaining);

    if (this.surgeState.clusters.length > 0) {
      this.surgeUI.animateClusters(this.surgeState.clusters, () => {
        this.surgeUI.showWinBadge(this.surgeState.totalWin);
        this.balance += this.surgeState.totalWin;
        this.updateBalanceDisplay();
        this.surgeUI.updateWin(this.surgeState.totalWin);
        this.handlePostSpinLogic();
      });
    } else {
      this.surgeUI.updateWin(0); // No win
      this.handlePostSpinLogic();
    }
  }

  /**
   * Handles post-spin logic such as crown flip, free spin triggers, and enabling the spin button.
   */
  private handlePostSpinLogic(): void {
    if (this.surgeState.isInCrownFlip) {
      this.surgeUI.showCrownFlip(
        this.surgeState.crownFlipWin,
        () => this.handleCrownFlip(true),
        () => this.handleCrownFlip(false)
      );
    } else if (this.surgeState.isFreeSpinTriggered) {
      this.surgeUI.showFlash(
        'FREE SPINS!',
        `${this.surgeState.freeSpinsRemaining} spins`,
        1500,
        () => {
          this.surgeUI.setSpinButtonEnabled(true);
          this.surgeUI.setSpinButtonText('FREE SPIN');
          this.surgeState.isComplete = true; // Allow next spin
        }
      );
    } else if (this.surgeState.surgeSpinsRemaining > 0 && this.surgeState.surgeMeter === 0) {
      // Surge meter just filled, show banner for next spin
      this.surgeUI.showFlash(
        'SURGE METER FULL!',
        `${this.surgeState.surgeSpinsRemaining} Surge Spins`,
        1500,
        () => {
          this.surgeUI.setSpinButtonEnabled(true);
          this.surgeUI.setSpinButtonText('SURGE');
          this.surgeState.isComplete = true; // Allow next spin
        }
      );
    } else {
      this.surgeUI.setSpinButtonEnabled(true);
      this.surgeUI.setSpinButtonText('SPIN');
      this.surgeState.isComplete = true; // Mark as complete
    }
  }

  /**
   * Handles the Crown Flip decision (flip or walk).
   * @param doFlip True to flip, false to walk.
   */
  private handleCrownFlip(doFlip: boolean): void {
    if (doFlip) {
      this.surgeState = flipCrown(this.surgeState, { rng: this.rng });
      if (this.surgeState.isInCrownFlip) {
        // Still in crown flip, show updated win
        this.surgeUI.showCrownFlip(
          this.surgeState.crownFlipWin,
          () => this.handleCrownFlip(true),
          () => this.handleCrownFlip(false)
        );
      } else {
        // Crown flip lost or ended
        this.surgeUI.hideCrownFlip();
        this.balance += this.surgeState.totalWin; // Add final win (could be 0)
        this.updateBalanceDisplay();
        this.surgeUI.updateWin(this.surgeState.totalWin);
        if (this.surgeState.totalWin > 0) {
          this.surgeUI.showWinBadge(this.surgeState.totalWin);
        }
        this.surgeUI.setSpinButtonEnabled(true);
        this.surgeUI.setSpinButtonText('SPIN');
      }
    } else {
      this.surgeState = walkCrown(this.surgeState);
      this.surgeUI.hideCrownFlip();
      this.balance += this.surgeState.totalWin;
      this.updateBalanceDisplay();
      this.surgeUI.updateWin(this.surgeState.totalWin);
      if (this.surgeState.totalWin > 0) {
        this.surgeUI.showWinBadge(this.surgeState.totalWin);
      }
      this.surgeUI.setSpinButtonEnabled(true);
      this.surgeUI.setSpinButtonText('SPIN');
    }
  }

  /**
   * Phaser's shutdown lifecycle method. Cleans up resources.
   */
  shutdown(): void {
    this.surgeUI.destroy();
    this.balanceText.destroy();
    this.betButtons.forEach(btn => btn.destroy());
    this.backButton.destroy();
  }
}
