/**
 * @file FruitFiestaUI.ts
 * @purpose Phaser rendering and input handling for the Tropical Fruit Fiesta slot game.
 * @author Agent 934
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import Phaser from 'phaser';
import { FruitFiestaState, spinFruitFiesta, createFruitFiestaState, FruitFiestaConfig, WheelBonusOutcome } from './FruitFiestaLogic';
import { CHARACTER_REGISTRY } from '../shared/characters';

const GOLD = 0xc9a84c;

/**
 * Renders the character for Tropical Fruit Fiesta.
 * This function adheres to the CHARACTER_REGISTRY rules.
 * @param scene The Phaser scene.
 * @param x X coordinate.
 * @param y Y coordinate.
 */
function renderFruitFiestaCharacter(scene: Phaser.Scene, x: number, y: number) {
  const character = CHARACTER_REGISTRY.fruitFiesta; // Assuming a key 'fruitFiesta'
  if (character && character.imageUrl) {
    // Assuming the image is preloaded and has a key matching character.key
    scene.add.image(x, y, character.key);
  } else if (character && character.fallbackDraw) {
    character.fallbackDraw(scene, x, y, character.tint);
  } else {
    // Default placeholder if no specific fallback is provided
    scene.add.star(x, y, 5, 20, 30, GOLD).setStrokeStyle(2, 0xffffff);
    scene.add.text(x, y, 'FF', { fontSize: '24px', color: '#c9a84c' }).setOrigin(0.5);
  }
}

/**
 * Manages the UI elements and interactions for the Tropical Fruit Fiesta game.
 */
export class FruitFiestaUI {
  private scene: Phaser.Scene;
  private state: FruitFiestaState;
  private spinButton: Phaser.GameObjects.Text;
  private reelsDisplay: Phaser.GameObjects.Text[][]; // Placeholder for reel visuals
  private winText: Phaser.GameObjects.Text;
  private freeSpinsText: Phaser.GameObjects.Text;
  private gameConfig: FruitFiestaConfig;
  private wheelBonusText: Phaser.GameObjects.Text; // New: for displaying wheel bonus outcome

  constructor(scene: Phaser.Scene, bet: number, linesBet: number, gameConfig: FruitFiestaConfig = {}) {
    this.scene = scene;
    this.gameConfig = gameConfig;
    this.state = createFruitFiestaState(bet, linesBet);

    this.reelsDisplay = Array(5).fill(null).map(() => 
      Array(3).fill(null).map(() => 
        scene.add.text(0, 0, ' ', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5)
      )
    );

    this.spinButton = scene.add.text(scene.sys.game.canvas.width / 2, scene.sys.game.canvas.height - 50, 'SPIN', {
      fontSize: '36px',
      color: '#0d0d0d',
      backgroundColor: `#${GOLD.toString(16)}`,
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive();

    this.winText = scene.add.text(scene.sys.game.canvas.width / 2, 50, 'WIN: 0', { fontSize: '32px', color: '#c9a84c' }).setOrigin(0.5);
    this.freeSpinsText = scene.add.text(scene.sys.game.canvas.width / 2, 90, 'Free Spins: 0', { fontSize: '24px', color: '#c9a84c' }).setOrigin(0.5);
    this.wheelBonusText = scene.add.text(scene.sys.game.canvas.width / 2, 130, '', { fontSize: '24px', color: '#c9a84c' }).setOrigin(0.5);
    this.wheelBonusText.setVisible(false); // Hidden by default

    this.spinButton.on('pointerdown', this.handleSpin, this);

    // Initial render of reels and character
    this.updateUI();
    renderFruitFiestaCharacter(scene, 100, 100); // Example position
  }

  /**
   * Handles the spin button click, triggering game logic and updating UI.
   */
  private handleSpin() {
    if (this.state.isComplete === false || this.state.freeSpinsRemaining > 0) {
      spinFruitFiesta(this.state, this.gameConfig);
      this.updateUI();
    } else {
      // Game complete and no free spins, perhaps offer a 'Play Again' or reset
      console.log('Game over, no free spins remaining.');
    }
  }

  /**
   * Updates all UI elements based on the current game state.
   */
  private updateUI() {
    // Update reel display (placeholder - actual rendering will involve sprites)
    this.state.reelStops.forEach((reel, reelIdx) => {
      reel.forEach((symbol, rowIdx) => {
        const x = this.scene.sys.game.canvas.width / 2 - 150 + (reelIdx * 75);
        const y = this.scene.sys.game.canvas.height / 2 - 50 + (rowIdx * 50);
        this.reelsDisplay[reelIdx][rowIdx].setText(symbol).setPosition(x, y);
      });
    });

    this.winText.setText(`WIN: ${this.state.totalWin.toFixed(2)}`);
    this.freeSpinsText.setText(`Free Spins: ${this.state.freeSpinsRemaining}`);

    // Display wheel bonus outcome if triggered
    if (this.state.wheelBonusTriggered && this.state.wheelBonusOutcome) {
      this.wheelBonusText.setText(`WHEEL BONUS: ${this.state.wheelBonusOutcome}`).setVisible(true);
    } else {
      this.wheelBonusText.setVisible(false);
    }

    // Enable/disable spin button based on game state
    if (this.state.isComplete && this.state.freeSpinsRemaining === 0 && !this.state.wheelBonusTriggered) {
      this.spinButton.setAlpha(0.5).disableInteractive();
    } else {
      this.spinButton.setAlpha(1).setInteractive();
    }
  }

  /**
   * Returns the current game state.
   * @returns The current FruitFiestaState.
   */
  public getState(): FruitFiestaState {
    return this.state;
  }

  /**
   * Allows setting a new game configuration.
   * @param config The new FruitFiestaConfig.
   */
  public setConfig(config: FruitFiestaConfig) {
    this.gameConfig = config;
  }
}
