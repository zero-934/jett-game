/**
 * @file src/shared/slot-engine/SlotAnimator.ts
 * @purpose Reusable Phaser reel animation system for all slot games.
 *          Architecture copied directly from the working MasqueradeUI:
 *          symbol containers sit in world space (no parent reel container),
 *          spin stacks them above the viewport then tweens them all downward,
 *          each reel stops with a configurable stagger delay.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';

// ─── Visual constants ────────────────────────────────────────────────────────
const GOLD_STR           = '#c9a84c';
const WIN_PULSE_SCALE    = 1.15;
const WIN_PULSE_DURATION = 160;   // ms
const WIN_PULSE_REPEATS  = 3;
const CELL_FLASH_OUT     = 100;   // ms fade-out for cell flash
const FLASH_IN_DURATION  = 180;   // ms for overlay fade in
const FLASH_HOLD_DIM     = 0.65;  // flash overlay alpha
const FLASH_OUT_DURATION = 200;   // ms for overlay fade out

// ─── Interfaces & Presets ────────────────────────────────────────────────────

export interface SlotAnimatorConfig {
  reelsCount:   number;  // 3 or 5
  rowsCount:    number;  // always 3
  symbolSize:   number;  // px — cell width & height
  reelGap:      number;  // px gap between reels (also used as row gap)
  spinRows:     number;  // extra off-screen symbol buffer above grid
  reelDelay:    number;  // ms stagger before each successive reel starts
  baseDuration: number;  // ms for reel 0 spin
  gridTop:      number;  // y of the top-left cell in world space
}

/** Matches MasqueradeUI timing exactly — use for all 5-reel games. */
export const FIVE_REEL_PRESET: SlotAnimatorConfig = {
  reelsCount:   5,
  rowsCount:    3,
  symbolSize:   66,
  reelGap:      4,
  spinRows:     8,
  reelDelay:    120,
  baseDuration: 700,
  gridTop:      190,
};

/** For 3-reel games (Inferno, Surge). Slightly tighter timing. */
export const THREE_REEL_PRESET: SlotAnimatorConfig = {
  reelsCount:   3,
  rowsCount:    3,
  symbolSize:   100,
  reelGap:      6,
  spinRows:     6,
  reelDelay:    100,
  baseDuration: 600,
  gridTop:      220,
};

// ─── SlotAnimator ────────────────────────────────────────────────────────────

/**
 * Handles all reel animation for a slot game.
 * Each symbol cell is a Phaser Container placed directly in world space
 * (no parent reel container) — the same pattern used in MasqueradeUI.
 *
 * Usage:
 *   const animator = new SlotAnimator(scene, THREE_REEL_PRESET);
 *   const gridX = animator.buildReels(drawSymbol, drawBlur);
 *   animator.snapReels(grid);
 *   // on spin button:
 *   animator.spinReels(finalGrid, () => { ... });
 */
export class SlotAnimator {
  private readonly scene:  Phaser.Scene;
  private readonly config: SlotAnimatorConfig;

  /** reelCols[reel][symbolIndex] — world-space containers, (spinRows + rowsCount) per reel */
  private reelCols: Phaser.GameObjects.Container[][] = [];

  /** Cached grid X so snapReels / spinReel can use it */
  private gridX = 0;

  private drawSymbolFn!: (c: Phaser.GameObjects.Container, key: string) => void;
  private drawBlurFn!:   (c: Phaser.GameObjects.Container) => void;

  // Flash overlay
  private flashOverlay: Phaser.GameObjects.Container | null = null;
  private flashMsg:     Phaser.GameObjects.Text | null = null;
  private flashSub:     Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, config: SlotAnimatorConfig) {
    this.scene  = scene;
    this.config = config;
  }

  // ─── Derived layout helpers ────────────────────────────────────────────────

  private get cellStep(): number {
    return this.config.symbolSize + this.config.reelGap;
  }

  private get gridW(): number {
    return this.config.reelsCount * this.config.symbolSize +
           (this.config.reelsCount - 1) * this.config.reelGap;
  }

  private get gridH(): number {
    return this.config.rowsCount * this.config.symbolSize +
           (this.config.rowsCount - 1) * this.config.reelGap;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Creates all symbol containers in world space and calls drawBlur on each.
   * Must be called once during scene create().
   *
   * @param drawSymbol  Callback to render a named symbol into a container.
   * @param drawBlur    Callback to render a blur placeholder into a container.
   * @returns gridX — left edge of the grid (useful for positioning HUD elements).
   *
   * @example
   * const gridX = animator.buildReels(
   *   (c, key) => drawMySymbol(c, key),
   *   (c)      => drawMyBlur(c)
   * );
   */
  public buildReels(
    drawSymbol: (c: Phaser.GameObjects.Container, key: string) => void,
    drawBlur:   (c: Phaser.GameObjects.Container) => void
  ): number {
    this.drawSymbolFn = drawSymbol;
    this.drawBlurFn   = drawBlur;

    const { reelsCount, rowsCount, spinRows, symbolSize } = this.config;
    this.gridX = (this.scene.scale.width - this.gridW) / 2;

    const totalPerReel = spinRows + rowsCount;

    for (let r = 0; r < reelsCount; r++) {
      this.reelCols[r] = [];
      const reelX = this.gridX + r * this.cellStep;

      for (let i = 0; i < totalPerReel; i++) {
        // All containers start invisible far above viewport (same as MasqueradeUI)
        const c = this.scene.add.container(reelX, -9999);
        c.setSize(symbolSize, symbolSize);
        c.setAlpha(0);
        this.reelCols[r].push(c);
      }
    }

    this.buildFlashOverlay();
    return this.gridX;
  }

  /**
   * Instantly positions all reels to show grid[][].
   * grid[reel][row] = symbol key string.
   *
   * @param grid 2-D array: grid[reel][row] = symbol key.
   *
   * @example
   * animator.snapReels([['BOLT','BOLT','WILD'], ['ARC','SCATTER','COIL'], ['BOLT','ARC','SPARK']]);
   */
  public snapReels(grid: string[][]): void {
    const { reelsCount, rowsCount, spinRows, gridTop } = this.config;
    const totalPerReel = spinRows + rowsCount;

    for (let r = 0; r < reelsCount; r++) {
      const reelX = this.gridX + r * this.cellStep;

      for (let i = 0; i < totalPerReel; i++) {
        const visRow  = i - spinRows; // negative = off-screen above
        const c       = this.reelCols[r][i];

        if (visRow >= 0 && visRow < rowsCount) {
          c.setPosition(reelX, gridTop + visRow * this.cellStep);
          c.setAlpha(1);
          c.removeAll(true);
          this.drawSymbolFn(c, grid[r][visRow]);
        } else {
          c.setPosition(reelX, -9999);
          c.setAlpha(0);
        }
      }
    }
  }

  /**
   * Animates all reels spinning then snaps to finalGrid.
   * Reel 0 stops first; each subsequent reel stops reelDelay ms later.
   * Calls onComplete when the last reel has stopped.
   *
   * @param finalGrid  2-D array of final symbol keys (same shape as snapReels).
   * @param onComplete Called once all reels have settled.
   *
   * @example
   * animator.spinReels(newGrid, () => evaluateWins());
   */
  public spinReels(finalGrid: string[][], onComplete: () => void): void {
    const { reelsCount, reelDelay, baseDuration } = this.config;
    let resolved = 0;

    for (let r = 0; r < reelsCount; r++) {
      const duration = baseDuration + r * reelDelay;

      this.scene.time.delayedCall(r * reelDelay, () => {
        this.spinReel(r, finalGrid[r], duration).then(() => {
          resolved++;
          if (resolved === reelsCount) onComplete();
        });
      });
    }
  }

  /**
   * Pulses winning cells with a scale bounce (same as MasqueradeUI.animateWin).
   *
   * @param positions Array of {reel, row} to highlight.
   *
   * @example
   * animator.animateWin([{ reel: 0, row: 1 }, { reel: 1, row: 1 }]);
   */
  public animateWin(positions: { reel: number; row: number }[]): void {
    for (const pos of positions) {
      const c = this.getCellContainer(pos.reel, pos.row);
      if (!c) continue;
      this.scene.tweens.add({
        targets:  c,
        scaleX:   WIN_PULSE_SCALE,
        scaleY:   WIN_PULSE_SCALE,
        duration: WIN_PULSE_DURATION,
        yoyo:     true,
        repeat:   WIN_PULSE_REPEATS,
        ease:     'Sine.easeInOut',
        onComplete: () => c.setScale(1),
      });
    }
  }

  /**
   * Returns the world-space container for a specific visible cell.
   *
   * @param reel  Reel index (0-based).
   * @param row   Row index within visible rows (0-based).
   * @returns Container or null if out of bounds.
   *
   * @example
   * const cell = animator.getCellContainer(2, 1);
   */
  public getCellContainer(reel: number, row: number): Phaser.GameObjects.Container | null {
    const { reelsCount, rowsCount, spinRows } = this.config;
    if (reel < 0 || reel >= reelsCount || row < 0 || row >= rowsCount) return null;
    return this.reelCols[reel][spinRows + row] ?? null;
  }

  /**
   * Fades a cell out then back in — used for cascade / transmute reveals.
   *
   * @param reel       Reel index.
   * @param row        Row index.
   * @param onComplete Called after the full flash cycle.
   *
   * @example
   * animator.animateCellFlash(1, 0, () => redrawCell());
   */
  public animateCellFlash(reel: number, row: number, onComplete: () => void): void {
    const c = this.getCellContainer(reel, row);
    if (!c) { onComplete(); return; }

    this.scene.tweens.add({
      targets:  c,
      alpha:    0.2,
      duration: CELL_FLASH_OUT,
      yoyo:     true,
      repeat:   3,
      onComplete: () => {
        c.setAlpha(1);
        onComplete();
      },
    });
  }

  /**
   * Shows a full-screen flash overlay.
   * Fade in → hold → fade out → onDone().
   * Same visual pattern as MasqueradeUI.showFlash().
   *
   * @param message    Large headline text.
   * @param sub        Smaller sub-text.
   * @param durationMs How long to hold the overlay (excluding fade in/out).
   * @param onDone     Called when the overlay has fully faded out.
   *
   * @example
   * animator.showFlash('BIG WIN', '+500 credits', 1200, () => resumeGame());
   */
  public showFlash(message: string, sub: string, durationMs: number, onDone: () => void): void {
    if (!this.flashOverlay || !this.flashMsg || !this.flashSub) { onDone(); return; }

    this.flashMsg.setText(message);
    this.flashSub.setText(sub);
    this.flashOverlay.setVisible(true).setAlpha(0);

    this.scene.tweens.add({
      targets:  this.flashOverlay,
      alpha:    1,
      duration: FLASH_IN_DURATION,
      onComplete: () => {
        this.scene.time.delayedCall(durationMs, () => {
          this.scene.tweens.add({
            targets:  this.flashOverlay,
            alpha:    0,
            duration: FLASH_OUT_DURATION,
            onComplete: () => {
              this.flashOverlay?.setVisible(false);
              onDone();
            },
          });
        });
      },
    });
  }

  /**
   * Destroys all Phaser objects owned by this animator.
   * Call from the scene's shutdown() or destroy().
   */
  public destroy(): void {
    this.reelCols.forEach(col => col.forEach(c => c.destroy()));
    this.reelCols = [];
    this.flashOverlay?.destroy();
    this.flashOverlay = null;
    this.flashMsg     = null;
    this.flashSub     = null;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Spins one reel and resolves when it stops.
   * Copies MasqueradeUI.spinReel() exactly:
   *   1. Stack all containers above the viewport with blur symbols.
   *   2. Tween them all down by totalDist.
   *   3. onUpdate: alpha-fade containers outside the grid area.
   *   4. onComplete: snap final symbols, hide off-screen containers.
   */
  private spinReel(reelIndex: number, finalSymbols: string[], duration: number): Promise<void> {
    return new Promise(resolve => {
      const col        = this.reelCols[reelIndex];
      const totalRows  = col.length;
      const reelX      = this.gridX + reelIndex * this.cellStep;
      const { gridTop, rowsCount } = this.config;

      // Stack all containers above viewport, draw blur
      col.forEach((c, i) => {
        c.removeAll(true);
        this.drawBlurFn(c);
        c.setPosition(reelX, gridTop - (totalRows - i) * this.cellStep);
        c.setAlpha(1);
      });

      const totalDist = totalRows * this.cellStep;

      this.scene.tweens.add({
        targets:    col,
        y:          `+=${totalDist}`,
        duration,
        ease:       'Cubic.easeOut',
        onUpdate:   () => {
          // Fade containers that are outside the visible grid area
          col.forEach(c => {
            const relY    = c.y - gridTop;
            const inGrid  = relY >= -this.config.symbolSize && relY <= this.gridH;
            c.setAlpha(
              inGrid ? 1
                     : Math.max(0, 1 - Math.abs(relY - this.gridH / 2) / (this.gridH * 0.8))
            );
          });
        },
        onComplete: () => {
          // Snap final visible rows
          for (let row = 0; row < rowsCount; row++) {
            const c = col[totalRows - rowsCount + row];
            c.removeAll(true);
            this.drawSymbolFn(c, finalSymbols[row]);
            c.setPosition(reelX, gridTop + row * this.cellStep);
            c.setAlpha(1);
          }
          // Hide off-screen containers
          for (let i = 0; i < totalRows - rowsCount; i++) {
            col[i].setAlpha(0);
          }
          resolve();
        },
      });
    });
  }

  /** Builds the full-screen flash overlay (called once in buildReels). */
  private buildFlashOverlay(): void {
    const { width, height } = this.scene.scale;

    const dim = this.scene.add.graphics();
    dim.fillStyle(0x000000, FLASH_HOLD_DIM);
    dim.fillRect(0, 0, width, height);

    this.flashMsg = this.scene.add.text(width / 2, height / 2, '', {
      fontFamily: '"Georgia", serif',
      fontSize:   '52px',
      color:      GOLD_STR,
      stroke:     '#000000',
      strokeThickness: 8,
      align:      'center',
    }).setOrigin(0.5);

    this.flashSub = this.scene.add.text(width / 2, height / 2 + 68, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize:   '24px',
      color:      '#ffffff',
      align:      'center',
    }).setOrigin(0.5);

    this.flashOverlay = this.scene.add.container(0, 0, [dim, this.flashMsg, this.flashSub]);
    this.flashOverlay.setVisible(false);
    this.flashOverlay.setDepth(100);
  }
}
