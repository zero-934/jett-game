/**
 * @file src/shared/slot-engine/SlotAnimator.ts
 * @purpose A reusable Phaser animation helper for any slot game on the platform. Pure Phaser — no game logic.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary
 */

import * as Phaser from 'phaser';

// --- Constants ---
const GOLD_STR = '#c9a84c';
const WIN_PULSE_DURATION = 160; // ms
const WIN_PULSE_SCALE = 1.15;
const WIN_PULSE_REPEATS = 3;
const CELL_FLASH_DURATION = 150; // ms for fade out, then fade in
const FLASH_IN_DURATION = 180; // ms
const FLASH_OUT_DURATION = 200; // ms

// --- Interfaces and Presets ---

export interface SlotAnimatorConfig {
  reelsCount: number;       // 3 or 5
  rowsCount: number;        // 3
  symbolSize: number;       // px (66 for 5-reel, 100 for 3-reel)
  reelGap: number;          // px between reels
  spinRows: number;         // off-screen buffer rows (e.g., 8 for 5-reel, 6 for 3-reel)
  reelDelay: number;        // ms stagger between reels stopping
  baseDuration: number;     // ms for reel 0 spin duration
  gridTop: number;          // y position of grid top
}

/**
 * Preset configuration for a 5-reel, 3-row slot game (e.g., MasqueradeUI).
 */
export const FIVE_REEL_PRESET: SlotAnimatorConfig = {
  reelsCount: 5,
  rowsCount: 3,
  symbolSize: 66,
  reelGap: 4,
  spinRows: 8,
  reelDelay: 120,
  baseDuration: 700,
  gridTop: 190,
};

/**
 * Preset configuration for a 3-reel, 3-row slot game (e.g., InfernoUI, SurgeUI).
 */
export const THREE_REEL_PRESET: SlotAnimatorConfig = {
  reelsCount: 3,
  rowsCount: 3,
  symbolSize: 100,
  reelGap: 6,
  spinRows: 6,
  reelDelay: 100,
  baseDuration: 600,
  gridTop: 277, // Centered on 390x844 canvas: (844 - (3*100 + 2*6)) / 2 = (844 - 312) / 2 = 532 / 2 = 266. Let's adjust slightly for header/footer.
                // (844 - (3*100)) / 2 = (844 - 300) / 2 = 272. Let's use 277 for a bit more top padding.
};

/**
 * A reusable Phaser animation helper for any slot game on the platform.
 * Pure Phaser — no game logic.
 */
export class SlotAnimator {
  private scene: Phaser.Scene;
  private config: SlotAnimatorConfig;

  private reelColumns: Phaser.GameObjects.Container[] = [];
  private symbolContainers: Phaser.GameObjects.Container[][] = []; // [reel][symbolIndex]

  private drawSymbolCallback!: (container: Phaser.GameObjects.Container, symbolKey: string) => void;
  private drawBlurCallback!: (container: Phaser.GameObjects.Container) => void;

  private flashOverlayRect: Phaser.GameObjects.Rectangle;
  private flashOverlayMessage: Phaser.GameObjects.Text;
  private flashOverlaySub: Phaser.GameObjects.Text;
  private flashOverlayContainer: Phaser.GameObjects.Container;

  /**
   * Creates an instance of SlotAnimator.
   * @param scene The Phaser Scene this animator belongs to.
   * @param config Configuration for the slot grid and animations.
   */
  constructor(scene: Phaser.Scene, config: SlotAnimatorConfig) {
    this.scene = scene;
    this.config = config;

    // Initialize flash overlay, hidden by default
    this.flashOverlayContainer = this.scene.add.container(0, 0).setDepth(1000).setVisible(false);
    this.flashOverlayRect = this.scene.add.rectangle(
      this.scene.scale.width / 2,
      this.scene.scale.height / 2,
      this.scene.scale.width,
      this.scene.scale.height,
      0x000000,
      0.8
    ).setAlpha(0);
    this.flashOverlayMessage = this.scene.add.text(
      this.scene.scale.width / 2,
      this.scene.scale.height / 2 - 40,
      '',
      { font: 'bold 48px Arial', color: GOLD_STR, align: 'center' }
    ).setOrigin(0.5).setAlpha(0);
    this.flashOverlaySub = this.scene.add.text(
      this.scene.scale.width / 2,
      this.scene.scale.height / 2 + 20,
      '',
      { font: '24px Arial', color: '#ffffff', align: 'center' }
    ).setOrigin(0.5).setAlpha(0);

    this.flashOverlayContainer.add([this.flashOverlayRect, this.flashOverlayMessage, this.flashOverlaySub]);
  }

  /**
   * Builds reel containers. Must be called once during scene create().
   * This method creates all the necessary Phaser.GameObjects.Container objects
   * for the reels and their individual symbol cells.
   * It also sets up the initial state with blur symbols.
   *
   * @param drawSymbol A callback function to draw a specific symbol into a container.
   *                   The container is cleared before drawing.
   * @param drawBlur A callback function to draw a blur placeholder into a container.
   *                 The container is cleared before drawing.
   * @returns The calculated X position of the left edge of the grid, useful for positioning other UI elements.
   */
  public buildReels(
    drawSymbol: (container: Phaser.GameObjects.Container, symbolKey: string) => void,
    drawBlur: (container: Phaser.GameObjects.Container) => void
  ): number {
    this.drawSymbolCallback = drawSymbol;
    this.drawBlurCallback = drawBlur;

    const { reelsCount, rowsCount, symbolSize, reelGap, spinRows, gridTop } = this.config;
    const totalGridWidth = reelsCount * symbolSize + (reelsCount - 1) * reelGap;
    const gridX = (this.scene.scale.width - totalGridWidth) / 2;

    const totalSymbolsPerReel = spinRows + rowsCount;

    for (let r = 0; r < reelsCount; r++) {
      const reelColumn = this.scene.add.container(
        gridX + r * (symbolSize + reelGap),
        gridTop
      ).setDepth(10); // Reels should be above background, below HUD

      this.reelColumns.push(reelColumn);
      this.symbolContainers.push([]);

      for (let s = 0; s < totalSymbolsPerReel; s++) {
        const symbolContainer = this.scene.add.container(0, (s - spinRows) * symbolSize);
        this.symbolContainers[r].push(symbolContainer);
        reelColumn.add(symbolContainer);

        // Initially draw blur symbols for all cells
        this.drawBlurCallback(symbolContainer);
      }
    }

    return gridX;
  }

  /**
   * Instantly snaps all reels to the given symbol grid (no animation).
   * This method clears existing symbols and draws the final symbols in their correct positions.
   * Off-screen symbols are hidden.
   *
   * @param grid A 2D array representing the final symbol layout. `grid[reel][row]` = symbol key string.
   */
  public snapReels(grid: string[][]): void {
    const { reelsCount, rowsCount, spinRows } = this.config;

    for (let r = 0; r < reelsCount; r++) {
      // Ensure reel column is at its base position
      this.reelColumns[r].y = this.config.gridTop;

      const finalSymbolsForReel = grid[r];
      if (!finalSymbolsForReel || finalSymbolsForReel.length !== rowsCount) {
        console.warn(`SlotAnimator: Invalid final grid for reel ${r}. Expected ${rowsCount} symbols, got ${finalSymbolsForReel?.length || 0}.`);
        continue;
      }

      // Draw visible symbols
      for (let row = 0; row < rowsCount; row++) {
        const symbolContainer = this.symbolContainers[r][spinRows + row];
        symbolContainer.setVisible(true);
        this.clearContainer(symbolContainer);
        this.drawSymbolCallback(symbolContainer, finalSymbolsForReel[row]);
      }

      // Hide and clear off-screen symbols
      for (let s = 0; s < spinRows; s++) {
        const symbolContainer = this.symbolContainers[r][s];
        symbolContainer.setVisible(false);
        this.clearContainer(symbolContainer);
      }
      for (let s = spinRows + rowsCount; s < this.symbolContainers[r].length; s++) {
        const symbolContainer = this.symbolContainers[r][s];
        symbolContainer.setVisible(false);
        this.clearContainer(symbolContainer);
      }
    }
  }

  /**
   * Animates spinning all reels, then snaps to finalGrid.
   * Calls onComplete when all reels have stopped.
   * Uses staggered stop: reel 0 stops first, reel N last.
   *
   * @param finalGrid A 2D array representing the final symbol layout. `finalGrid[reel][row]` = symbol key string.
   * @param onComplete Callback function to be executed when all reels have finished spinning.
   */
  public spinReels(finalGrid: string[][], onComplete: () => void): void {
    const { reelsCount, rowsCount, symbolSize, spinRows, reelDelay, baseDuration } = this.config;
    const spinPromises: Promise<void>[] = [];

    for (let r = 0; r < reelsCount; r++) {
      const reelColumn = this.reelColumns[r];
      const spinDuration = baseDuration + r * reelDelay; // Staggered duration

      // Prepare reel for spin: draw blur symbols in all cells
      for (const symbolContainer of this.symbolContainers[r]) {
        this.clearContainer(symbolContainer);
        this.drawBlurCallback(symbolContainer);
        symbolContainer.setVisible(true); // Make sure all blur symbols are visible during spin
      }

      // Reset reel column Y to 0 relative to its parent (gridTop)
      reelColumn.y = this.config.gridTop;

      const totalDist = (spinRows + rowsCount) * symbolSize;

      const spinPromise = new Promise<void>(resolve => {
        this.scene.time.delayedCall(r * reelDelay, () => {
          this.scene.tweens.add({
            targets: reelColumn,
            y: `+=${totalDist}`, // Scroll down
            duration: spinDuration,
            ease: 'Cubic.easeOut',
            onComplete: () => {
              // Reset reel column Y to its original position
              reelColumn.y = this.config.gridTop;
              // Snap this specific reel to its final symbols
              this.snapReel(r, finalGrid[r]);
              resolve();
            },
          });
        });
      });
      spinPromises.push(spinPromise);
    }

    Promise.all(spinPromises).then(() => {
      onComplete();
    });
  }

  /**
   * Pulses winning cells (scaleX/Y bounce).
   *
   * @param positions An array of {reel, row} objects indicating which cells to highlight.
   */
  public animateWin(positions: { reel: number; row: number }[]): void {
    const { spinRows: _spinRows } = this.config;

    for (const pos of positions) {
      const cellContainer = this.getCellContainer(pos.reel, pos.row);
      if (cellContainer) {
        this.scene.tweens.add({
          targets: cellContainer,
          scaleX: WIN_PULSE_SCALE,
          scaleY: WIN_PULSE_SCALE,
          duration: WIN_PULSE_DURATION,
          yoyo: true,
          repeat: WIN_PULSE_REPEATS,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            cellContainer.setScale(1); // Ensure it returns to normal scale
          },
        });
      }
    }
  }

  /**
   * Returns the Phaser Container for a given reel/row visible cell.
   * Useful for adding overlays or badges on specific cells.
   *
   * @param reel The reel index (0-based).
   * @param row The row index (0-based, visible rows only).
   * @returns The Phaser.GameObjects.Container for the specified cell, or null if invalid.
   */
  public getCellContainer(reel: number, row: number): Phaser.GameObjects.Container | null {
    const { reelsCount, rowsCount, spinRows } = this.config;
    if (reel < 0 || reel >= reelsCount || row < 0 || row >= rowsCount) {
      console.warn(`SlotAnimator: Invalid reel (${reel}) or row (${row}) requested.`);
      return null;
    }
    // Visible rows start after spinRows buffer
    return this.symbolContainers[reel][spinRows + row];
  }

  /**
   * Animates a cell fading out and back in (for cascade/transmute effects).
   *
   * @param reel The reel index (0-based).
   * @param row The row index (0-based, visible rows only).
   * @param onComplete Callback function to be executed after the flash animation finishes.
   */
  public animateCellFlash(reel: number, row: number, onComplete: () => void): void {
    const cellContainer = this.getCellContainer(reel, row);
    if (cellContainer) {
      this.scene.tweens.add({
        targets: cellContainer,
        alpha: 0,
        duration: CELL_FLASH_DURATION,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: cellContainer,
            alpha: 1,
            duration: CELL_FLASH_DURATION,
            ease: 'Sine.easeIn',
            onComplete: onComplete,
          });
        },
      });
    } else {
      onComplete(); // Call onComplete immediately if cell is invalid
    }
  }

  /**
   * Shows a full-screen flash overlay with message + sub-text.
   * Fade in 180ms → hold durationMs → fade out 200ms → onDone().
   *
   * @param message The main message to display.
   * @param sub The sub-text message to display.
   * @param durationMs The duration in milliseconds to hold the flash overlay visible.
   * @param onDone Callback function to be executed after the flash animation completes.
   */
  public showFlash(message: string, sub: string, durationMs: number, onDone: () => void): void {
    this.flashOverlayMessage.setText(message);
    this.flashOverlaySub.setText(sub);
    this.flashOverlayContainer.setVisible(true);

    this.scene.tweens.chain({
      tweens: [
        {
          targets: [this.flashOverlayRect, this.flashOverlayMessage, this.flashOverlaySub],
          alpha: 1,
          duration: FLASH_IN_DURATION,
          ease: 'Sine.easeOut',
        },
        {
          targets: [], // Placeholder for hold duration
          duration: durationMs,
        },
        {
          targets: [this.flashOverlayRect, this.flashOverlayMessage, this.flashOverlaySub],
          alpha: 0,
          duration: FLASH_OUT_DURATION,
          ease: 'Sine.easeIn',
          onComplete: () => {
            this.flashOverlayContainer.setVisible(false);
            onDone();
          },
        },
      ],
    });
  }

  /**
   * Cleanup — destroy all Phaser objects created by this instance.
   */
  public destroy(): void {
    this.reelColumns.forEach(col => col.destroy());
    this.symbolContainers.forEach(reelSymbols => reelSymbols.forEach(sym => sym.destroy()));
    this.flashOverlayContainer.destroy();

    this.reelColumns = [];
    this.symbolContainers = [];
  }

  /**
   * Clears all children from a Phaser.GameObjects.Container.
   * @param container The container to clear.
   */
  private clearContainer(container: Phaser.GameObjects.Container): void {
    container.removeAll(true); // true to destroy children
  }

  /**
   * Snaps a single reel to its final symbols.
   * This is a helper for spinReels' onComplete.
   * @param reelIndex The index of the reel to snap.
   * @param finalSymbolsForReel An array of symbol keys for the visible rows of this reel.
   */
  private snapReel(reelIndex: number, finalSymbolsForReel: string[]): void {
    const { rowsCount, spinRows } = this.config;

    if (!finalSymbolsForReel || finalSymbolsForReel.length !== rowsCount) {
      console.warn(`SlotAnimator: Invalid final symbols for reel ${reelIndex}. Expected ${rowsCount} symbols, got ${finalSymbolsForReel?.length || 0}.`);
      return;
    }

    // Draw visible symbols
    for (let row = 0; row < rowsCount; row++) {
      const symbolContainer = this.symbolContainers[reelIndex][spinRows + row];
      symbolContainer.setVisible(true);
      this.clearContainer(symbolContainer);
      this.drawSymbolCallback(symbolContainer, finalSymbolsForReel[row]);
    }

    // Hide and clear off-screen symbols
    for (let s = 0; s < spinRows; s++) {
      const symbolContainer = this.symbolContainers[reelIndex][s];
      symbolContainer.setVisible(false);
      this.clearContainer(symbolContainer);
    }
    for (let s = spinRows + rowsCount; s < this.symbolContainers[reelIndex].length; s++) {
      const symbolContainer = this.symbolContainers[reelIndex][s];
      symbolContainer.setVisible(false);
      this.clearContainer(symbolContainer);
    }
  }
}
