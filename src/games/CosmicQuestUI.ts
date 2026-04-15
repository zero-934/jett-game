/**
 * @file CosmicQuestUI.ts
 * @purpose Phaser rendering and input handling for the Cosmic Quest slot game.
 * @author Agent 934
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import Phaser from 'phaser';
import { CosmicQuestState, spinCosmicQuest, createCosmicQuestState, CosmicQuestConfig } from './CosmicQuestLogic';
import { CHARACTER_REGISTRY } from '../shared/characters';

const GOLD = 0xc9a84c;

/**
 * Renders the character for Cosmic Quest.
 * This function adheres to the CHARACTER_REGISTRY rules.
 * @param scene The Phaser scene.
 * @param x X coordinate.
 * @param y Y coordinate.
 */
function renderCosmicQuestCharacter(scene: Phaser.Scene, x: number, y: number) {
  const character = CHARACTER_REGISTRY.cosmicQuest; // Assuming a key 'cosmicQuest'
  if (character && character.imageUrl) {
    // Assuming the image is preloaded and has a key matching character.key
    scene.add.image(x, y, character.key);
  } else if (character && character.fallbackDraw) {
    character.fallbackDraw(scene, x, y, character.tint);
  } else {
    // Default placeholder if no specific fallback is provided
    scene.add.circle(x, y, 30, GOLD).setStrokeStyle(2, 0xffffff);
    scene.add.text(x, y, 'CQ', { fontSize: '24px', color: '#c9a84c' }).setOrigin(0.5);
  }
}

/**
 * Manages the UI elements and interactions for the Cosmic Quest game.
 */
export class CosmicQuestUI {
  private scene: Phaser.Scene;
  private state: CosmicQuestState;
  private spinButton: Phaser.GameObjects.Text;
  private reelsDisplay: Phaser.GameObjects.Text[][]; // Placeholder for reel visuals
  private winText: Phaser.GameObjects.Text;
  private freeSpinsText: Phaser.GameObjects.Text;
  private gameConfig: CosmicQuestConfig;

  constructor(scene: Phaser.Scene, bet: number, linesBet: number, gameConfig: CosmicQuestConfig = {}) {
    this.scene = scene;
    this.gameConfig = gameConfig;
    this.state = createCosmicQuestState(bet, linesBet);

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

    this.spinButton.on('pointerdown', this.handleSpin, this);

    // Initial render of reels and character
    this.updateUI();
    renderCosmicQuestCharacter(scene, 100, 100); // Example position
  }

  /**
   * Handles the spin button click, triggering game logic and updating UI.
   */
  private handleSpin() {
    if (this.state.isComplete === false || this.state.freeSpinsRemaining > 0) {
      spinCosmicQuest(this.state, this.gameConfig);
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

    // Enable/disable spin button based on game state
    if (this.state.isComplete && this.state.freeSpinsRemaining === 0) {
      this.spinButton.setAlpha(0.5).disableInteractive();
    } else {
      this.spinButton.setAlpha(1).setInteractive();
    }
  }

  /**
   * Returns the current game state.
   * @returns The current CosmicQuestState.
   */
  public getState(): CosmicQuestState {
    return this.state;
  }

  /**
   * Allows setting a new game configuration.
   * @param config The new CosmicQuestConfig.
   */
  public setConfig(config: CosmicQuestConfig) {
    this.gameConfig = config;
  }
}
