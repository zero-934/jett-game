import * as Phaser from 'phaser';
import { CasinoAudioManager } from '../shared/audio/CasinoAudioManager';
import { SlotAnimator, THREE_REEL_PRESET } from '../shared/slot-engine/SlotAnimator';
import type { SurgeState, SurgeCluster, SurgeSymbol } from './SurgeLogic';
import {
  COLOR_SURFACE,
  COLOR_GOLD,
  STR_GOLD,
  STR_TEXT,
  STR_MUTED, // ADDED: Import STR_MUTED
  FONT_PRIMARY,
  FONT_DISPLAY,
  FONT_SIZE_SM, // ADDED: Import FONT_SIZE_SM
  FONT_SIZE_LG,
  FONT_SIZE_2XL,
  FONT_SIZE_3XL,
  TEXT_STYLE_LABEL,
  TEXT_STYLE_SEMIBOLD,
  TEXT_STYLE_GOLD_SEMIBOLD,
  TEXT_STYLE_WIN,
  CANVAS_W,
  CANVAS_H,
  drawButton // IMPORTED: drawButton from UITheme
} from '../shared/ui/UITheme';

// --- Constants ---
const GRID_COLS = 3;

const DARK_GREY = 0x222222; // Keep for surge meter inactive color
const ELECTRIC_BLUE_STR = '#00aaff'; // Keep for surge sub-banner
// REMOVED: const LIGHT_BLUE_STR = '#66ccff'; // Was used only for old crown flip flip button

const SYMBOL_EMOJIS: Record<SurgeSymbol, string> = {
  BOLT: '⚡',
  ARC: '🌀',
  COIL: '🔩',
  SPARK: '✨',
  STATIC: '💫',
  WILD: '⭐',
  SCATTER: '💠',
};

const SYMBOL_BG_COLORS: Record<SurgeSymbol, number> = {
  BOLT: 0x0055ff,
  ARC: 0x00aaff,
  COIL: 0x004499,
  SPARK: 0x66ccff,
  STATIC: 0x334466,
  WILD: COLOR_GOLD,
  SCATTER: 0x0000aa,
};

const SURGE_METER_X = CANVAS_W / 2 - 100;
const SURGE_METER_Y = 50;
const SURGE_METER_WIDTH = 200;
const SURGE_METER_HEIGHT = 20;
const SURGE_METER_SEGMENTS = 5;
const SURGE_METER_ACTIVE_COLOR = COLOR_GOLD;
const SURGE_METER_INACTIVE_COLOR = DARK_GREY; // Keep dark grey for surge meter inactive

const SURGE_BANNER_DURATION = 1200;
const SURGE_BANNER_TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONT_DISPLAY,
  fontSize: FONT_SIZE_3XL,
  color: STR_GOLD,
  stroke: '#000000',
  strokeThickness: 8,
};
const SURGE_BANNER_SUB_TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONT_DISPLAY,
  fontSize: FONT_SIZE_2XL,
  color: ELECTRIC_BLUE_STR,
  stroke: '#000000',
  strokeThickness: 6,
};

// ADDED: New Crown Flip Modal Constants
const CROWN_MODAL_W = 300;
const CROWN_MODAL_H = 360;
const CROWN_COIN_R = 50;
const CROWN_FLIP_BTN_W = 200;
const CROWN_FLIP_BTN_H = 56;

// REMOVED: Old Crown Flip Modal Constants
// const CROWN_FLIP_OVERLAY_ALPHA = 0.7;
// const CROWN_FLIP_COIN_SIZE = 150;
// const CROWN_FLIP_BUTTON_WIDTH = 120;
// const CROWN_FLIP_BUTTON_SPACING = 20;

const WIN_BADGE_DURATION = 1000;
const WIN_BADGE_OFFSET_Y = 50;

const SPIN_BUTTON_Y = 606;

const BET_DISPLAY_X = 80;
const WIN_DISPLAY_X = CANVAS_W - 80;
const DISPLAY_Y = 656;

export class SurgeUI {
  private scene: Phaser.Scene;
  private slotAnimator: SlotAnimator;
  private audioManager = new CasinoAudioManager();

  private gridX: number = 0;
  private surgeMeterGraphics: Phaser.GameObjects.Graphics;
  private surgeMeterText: Phaser.GameObjects.Text;
  private surgeSpinsCounterText: Phaser.GameObjects.Text;

  // REMOVED: Old Crown Flip UI fields
  // private crownFlipOverlay: Phaser.GameObjects.Graphics;
  // private crownFlipContainer: Phaser.GameObjects.Container;
  // private crownFlipCoin: Phaser.GameObjects.Graphics;
  // private crownFlipWinText: Phaser.GameObjects.Text;
  // private crownFlipFlipBg: Phaser.GameObjects.Graphics;
  // private crownFlipFlipText: Phaser.GameObjects.Text;
  // private crownFlipWalkBg: Phaser.GameObjects.Graphics;
  // private crownFlipWalkText: Phaser.GameObjects.Text;

  // NEW: Crown Flip UI fields
  private crownOverlay: Phaser.GameObjects.Rectangle | null = null;
  private crownModalBg: Phaser.GameObjects.Graphics | null = null;
  private crownCoin: Phaser.GameObjects.Arc | null = null;
  private crownEmoji: Phaser.GameObjects.Text | null = null;
  private crownGambleLabel: Phaser.GameObjects.Text | null = null;
  private crownWinText: Phaser.GameObjects.Text | null = null;
  private crownFlipBg: Phaser.GameObjects.Graphics | null = null;
  private crownFlipBtnText: Phaser.GameObjects.Text | null = null;
  private crownWalkBg: Phaser.GameObjects.Graphics | null = null;
  private crownWalkBtnText: Phaser.GameObjects.Text | null = null;

  private winBadgeText: Phaser.GameObjects.Text;
  private betText: Phaser.GameObjects.Text;
  private winText: Phaser.GameObjects.Text;
  private spinButtonBg: Phaser.GameObjects.Graphics;
  private spinButtonText: Phaser.GameObjects.Text;

  /**
   * Creates an instance of SurgeUI.
   * @param scene The Phaser Scene this UI belongs to.
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Initialize SlotAnimator with 3x3 preset
    this.slotAnimator = new SlotAnimator(this.scene, THREE_REEL_PRESET);

    // Build reels and get the container
    this.gridX = this.slotAnimator.buildReels(
      this.drawSymbol.bind(this),
      this.drawBlur.bind(this)
    );
    // gridX is the left edge of the grid, positioning handled by SlotAnimator
    void this.gridX; // suppress unused warning
    // SlotAnimator handles positioning internally

    // Grid border
    const _gridW = THREE_REEL_PRESET.reelsCount * THREE_REEL_PRESET.symbolSize + (THREE_REEL_PRESET.reelsCount - 1) * THREE_REEL_PRESET.reelGap;
    const _gridH = THREE_REEL_PRESET.rowsCount * THREE_REEL_PRESET.symbolSize + (THREE_REEL_PRESET.rowsCount - 1) * THREE_REEL_PRESET.reelGap;
    const _gx = (CANVAS_W - _gridW) / 2 - 10;
    const _gy = THREE_REEL_PRESET.gridTop - 10;
    const border = this.scene.add.graphics().setDepth(5);
    border.lineStyle(3, COLOR_GOLD, 1);
    border.strokeRoundedRect(_gx, _gy, _gridW + 20, _gridH + 20, 12);
    border.lineStyle(1, COLOR_GOLD, 0.35);
    border.strokeRoundedRect(_gx + 4, _gy + 4, _gridW + 12, _gridH + 12, 9);
    [[_gx, _gy], [_gx + _gridW + 20, _gy], [_gx, _gy + _gridH + 20], [_gx + _gridW + 20, _gy + _gridH + 20]].forEach(([cx, cy]) => {
      border.fillStyle(COLOR_GOLD, 1);
      border.fillRect(cx - 3, cy - 3, 6, 6);
    });

    // Surge Meter
    this.surgeMeterGraphics = this.scene.add.graphics();
    this.surgeMeterText = this.scene.add.text(
      SURGE_METER_X + SURGE_METER_WIDTH / 2,
      SURGE_METER_Y + SURGE_METER_HEIGHT + 6,
      'SURGE METER',
      TEXT_STYLE_LABEL
    ).setOrigin(0.5);
    this.surgeSpinsCounterText = this.scene.add.text(
      SURGE_METER_X + SURGE_METER_WIDTH + 10,
      SURGE_METER_Y + SURGE_METER_HEIGHT / 2,
      '',
      TEXT_STYLE_GOLD_SEMIBOLD
    ).setOrigin(0, 0.5);

    // Crown Flip UI (NEW IMPLEMENTATION)
    this.crownOverlay = this.scene.add.rectangle(CANVAS_W/2, CANVAS_H/2, CANVAS_W, CANVAS_H, 0x000000, 0.75)
      .setDepth(200).setVisible(false).setAlpha(0);

    this.crownModalBg = this.scene.add.graphics()
      .setDepth(201).setVisible(false).setAlpha(0);
    this.crownModalBg.fillStyle(COLOR_SURFACE, 1);
    this.crownModalBg.fillRoundedRect(CANVAS_W/2 - CROWN_MODAL_W/2, CANVAS_H/2 - CROWN_MODAL_H/2, CROWN_MODAL_W, CROWN_MODAL_H, 16);
    this.crownModalBg.lineStyle(2, COLOR_GOLD, 1);
    this.crownModalBg.strokeRoundedRect(CANVAS_W/2 - CROWN_MODAL_W/2, CANVAS_H/2 - CROWN_MODAL_H/2, CROWN_MODAL_W, CROWN_MODAL_H, 16);

    this.crownCoin = this.scene.add.arc(CANVAS_W/2, CANVAS_H/2 - 120, CROWN_COIN_R, 0, 360, false, COLOR_GOLD, 1)
      .setDepth(202).setVisible(false).setAlpha(0);

    this.crownEmoji = this.scene.add.text(CANVAS_W/2, CANVAS_H/2 - 120, '👑', {
      fontSize: '36px',
      color: STR_TEXT,
      align: 'center'
    }).setOrigin(0.5).setDepth(203).setVisible(false).setAlpha(0);

    this.crownGambleLabel = this.scene.add.text(CANVAS_W/2, CANVAS_H/2 - 55, 'GAMBLE', {
      fontFamily: FONT_PRIMARY,
      fontSize: FONT_SIZE_SM,
      color: STR_MUTED,
      align: 'center'
    }).setOrigin(0.5).setDepth(202).setVisible(false).setAlpha(0);

    this.crownWinText = this.scene.add.text(CANVAS_W/2, CANVAS_H/2 - 25, '0', {
      fontFamily: FONT_PRIMARY,
      fontSize: FONT_SIZE_3XL,
      color: STR_GOLD,
      align: 'center',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202).setVisible(false).setAlpha(0);

    // FLIP button
    const { bg: flipBg, text: flipText } = drawButton(this.scene, CANVAS_W/2, CANVAS_H/2 + 50, CROWN_FLIP_BTN_W, CROWN_FLIP_BTN_H, 'FLIP', 'primary', 202);
    this.crownFlipBg = flipBg.setVisible(false).setAlpha(0);
    this.crownFlipBtnText = flipText.setVisible(false).setAlpha(0);

    // WALK button
    const { bg: walkBg, text: walkText } = drawButton(this.scene, CANVAS_W/2, CANVAS_H/2 + 120, CROWN_FLIP_BTN_W, CROWN_FLIP_BTN_H, 'WALK', 'secondary', 202);
    this.crownWalkBg = walkBg.setVisible(false).setAlpha(0);
    this.crownWalkBtnText = walkText.setVisible(false).setAlpha(0);

    // Win Badge
    this.winBadgeText = this.scene.add.text(
      CANVAS_W / 2,
      CANVAS_H / 2,
      '',
      TEXT_STYLE_WIN
    ).setOrigin(0.5).setDepth(10).setVisible(false);

    // Bet/Win displays
    this.betText = this.scene.add.text(BET_DISPLAY_X, DISPLAY_Y, 'BET: 0', TEXT_STYLE_SEMIBOLD).setOrigin(0, 0.5);
    this.betText.setFontSize(FONT_SIZE_LG);
    this.winText = this.scene.add.text(WIN_DISPLAY_X, DISPLAY_Y, 'WIN: 0', TEXT_STYLE_SEMIBOLD).setOrigin(1, 0.5);
    this.winText.setFontSize(FONT_SIZE_LG);

    // Spin Button (using drawButton from UITheme)
    const { bg: spinBtnBg, text: spinBtnText } = drawButton(
      this.scene,
      CANVAS_W / 2,
      SPIN_BUTTON_Y,
      140, // width
      60, // height
      'SPIN',
      'primary'
    );
    this.spinButtonBg = spinBtnBg;
    this.spinButtonText = spinBtnText;
  }

  /**
   * Sets the callback for when the spin button is pressed.
   * @param onSpin Callback function to invoke on spin.
   */
  public setOnSpin(onSpin: () => void): void {
    this.spinButtonBg.removeAllListeners();
    this.spinButtonBg.on('pointerdown', () => { this.audioManager.init(); onSpin(); });
  }

  /**
   * Starts the UI, ensuring all elements are in their initial state.
   */
  public start(initialState?: import('./SurgeLogic').SurgeState): void {
    if (initialState) {
      const reelGrid: string[][] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        reelGrid.push(initialState.grid.map(row => row[col].symbol as string));
      }
      this.slotAnimator.snapReels(reelGrid);
    }
    this.updateSurgeMeter(0, 0);
    this.hideCrownFlip();
    this.winBadgeText.setVisible(false);
    this.updateBet(0);
    this.updateWin(0);
    this.setSpinButtonEnabled(true);
    this.setSpinButtonText('SPIN');
  }

  /**
   * Draws a symbol within a given container. This is a callback for SlotAnimator.
   * @param container The Phaser Container for the cell.
   * @param symbolKey The key of the symbol to draw.
   */
  private drawSymbol(container: Phaser.GameObjects.Container, symbolKey: string): void {
    const symbol = symbolKey as SurgeSymbol;
    const symbolSize = THREE_REEL_PRESET.symbolSize;

    // Clear existing children
    container.removeAll(true);

    // Background rectangle
    const bg = this.scene.add.graphics();
    bg.fillStyle(SYMBOL_BG_COLORS[symbol] || DARK_GREY, 1);
    bg.fillRect(0, 0, symbolSize, symbolSize);
    container.add(bg);

    // Symbol text (emoji)
    const text = this.scene.add.text(
      symbolSize / 2,
      symbolSize / 2,
      SYMBOL_EMOJIS[symbol],
      {
        fontFamily: FONT_PRIMARY,
        fontSize: `${symbolSize * 0.7}px`,
        color: STR_TEXT,
        align: 'center',
        stroke: '#000000',
        strokeThickness: 6,
      }
    ).setOrigin(0.5);
    container.add(text);
  }

  /**
   * Draws a blur effect within a given container. This is a callback for SlotAnimator.
   * @param container The Phaser Container for the cell.
   */
  private drawBlur(container: Phaser.GameObjects.Container): void {
    const symbolSize = THREE_REEL_PRESET.symbolSize;
    container.removeAll(true);
    const blurRect = this.scene.add.graphics();
    blurRect.fillStyle(0x000000, 0.5);
    blurRect.fillRect(0, 0, symbolSize, symbolSize);
    container.add(blurRect);
    const blurText = this.scene.add.text(
      symbolSize / 2,
      symbolSize / 2,
      '⚡',
      {
        fontFamily: FONT_PRIMARY,
        fontSize: `${symbolSize * 0.7}px`,
        color: STR_TEXT,
        align: 'center',
        stroke: '#000000',
        strokeThickness: 6,
      }
    ).setOrigin(0.5);
    container.add(blurText);
  }

  /**
   * Renders the current game grid, updating symbol visuals and highlighting winning cells.
   * @param state The current SurgeState.
   */
  public renderGrid(state: SurgeState): void {
    // Transpose [row][col] -> [reel=col][row] for SlotAnimator
    const reelGrid: string[][] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      reelGrid.push(state.grid.map(row => row[col].symbol as string));
    }
    this.slotAnimator.snapReels(reelGrid);
  }

  /**
   * Animates the reels spinning to their final positions.
   * @param finalGrid The final grid of symbols (as string keys).
   * @param onComplete Callback function to execute when the animation finishes.
   */
  public animateSpin(finalGrid: string[][], onComplete: () => void): void {
    this.slotAnimator.spinReels(finalGrid, onComplete);
  }

  /**
   * Animates winning clusters, typically by flashing the involved cells.
   * @param clusters An array of SurgeCluster objects.
   * @param onComplete Callback function to execute when all cluster animations finish.
   */
  public animateClusters(clusters: SurgeCluster[], onComplete: () => void): void {
    if (clusters.length === 0) {
      onComplete();
      return;
    }

    let animationsCompleted = 0;
    const totalAnimations = clusters.reduce((sum, cluster) => sum + cluster.cells.length, 0);

    if (totalAnimations === 0) {
      onComplete();
      return;
    }

    const onCellAnimationComplete = () => {
      animationsCompleted++;
      if (animationsCompleted === totalAnimations) {
        onComplete();
      }
    };

    clusters.forEach((cluster) => {
      cluster.cells.forEach((cell) => {
        this.slotAnimator.animateCellFlash(cell.col, cell.row, onCellAnimationComplete);
      });
    });
  }

  /**
   * Updates the visual representation of the Surge Meter.
   * @param level The current charge level of the Surge Meter (0-5).
   * @param surgeSpinsRemaining The number of surge spins left.
   */
  public updateSurgeMeter(level: number, surgeSpinsRemaining: number): void {
    this.surgeMeterGraphics.clear();
    const segmentWidth = SURGE_METER_WIDTH / SURGE_METER_SEGMENTS;

    for (let i = 0; i < SURGE_METER_SEGMENTS; i++) {
      const color = i < level ? SURGE_METER_ACTIVE_COLOR : SURGE_METER_INACTIVE_COLOR;
      this.surgeMeterGraphics.fillStyle(color, 1);
      this.surgeMeterGraphics.fillRect(
        SURGE_METER_X + i * segmentWidth,
        SURGE_METER_Y,
        segmentWidth - 2, // Small gap between segments
        SURGE_METER_HEIGHT
      );
    }

    if (surgeSpinsRemaining > 0) {
      this.surgeSpinsCounterText.setText(`SURGE x${surgeSpinsRemaining}`).setVisible(true);
    } else {
      this.surgeSpinsCounterText.setVisible(false);
    }
  }

  /**
   * Displays a banner indicating a Surge Spin is active.
   * @param wildReel The index of the reel that is wild (0, 1, or 2).
   * @param onComplete Callback function to execute when the banner animation finishes.
   */
  public showSurgeBanner(wildReel: number, onComplete: () => void): void {
    const bannerText = this.scene.add.text(
      CANVAS_W / 2,
      CANVAS_H / 2 - 50,
      'SURGE SPIN!',
      SURGE_BANNER_TEXT_STYLE
    ).setOrigin(0.5).setDepth(1000).setScale(0).setAlpha(0);

    const subText = this.scene.add.text(
      CANVAS_W / 2,
      CANVAS_H / 2 + 20,
      `Reel ${wildReel + 1} is WILD!`,
      SURGE_BANNER_SUB_TEXT_STYLE
    ).setOrigin(0.5).setDepth(1000).setScale(0).setAlpha(0);

    this.scene.tweens.chain({
      tweens: [
        {
          targets: [bannerText, subText],
          scale: 1,
          alpha: 1,
          ease: 'Back.easeOut',
          duration: SURGE_BANNER_DURATION / 3,
        },
        {
          targets: [bannerText, subText],
          scale: 1.1,
          duration: SURGE_BANNER_DURATION / 3,
          yoyo: true,
          repeat: 0,
        },
        {
          targets: [bannerText, subText],
          scale: 0,
          alpha: 0,
          ease: 'Back.easeIn',
          duration: SURGE_BANNER_DURATION / 3,
          onComplete: () => {
            bannerText.destroy();
            subText.destroy();
            onComplete();
          },
        },
      ],
    });
  }

  /**
   * Displays the Crown Flip modal.
   * @param currentWin The current potential win amount in the Crown Flip.
   * @param onFlip Callback for when the 'FLIP' button is pressed.
   * @param onWalk Callback for when the 'WALK' button is pressed.
   */
  public showCrownFlip(currentWin: number, onFlip: () => void, onWalk: () => void): void {
    if (this.crownWinText) {
      this.crownWinText.setText(currentWin.toFixed(2));
    }

    const allElements = [
      this.crownOverlay, this.crownModalBg, this.crownCoin, this.crownEmoji,
      this.crownGambleLabel, this.crownWinText,
      this.crownFlipBg, this.crownFlipBtnText,
      this.crownWalkBg, this.crownWalkBtnText
    ] as any[];

    allElements.forEach((e: any) => e.setVisible(true));
    this.scene.tweens.add({
      targets: allElements,
      alpha: 1,
      duration: 200,
      ease: 'Linear'
    });

    this.crownFlipBg?.once('pointerdown', onFlip);
    this.crownWalkBg?.once('pointerdown', onWalk);
  }

  /**
   * Hides the Crown Flip modal.
   */
  public hideCrownFlip(): void {
    const allElements = [
      this.crownOverlay, this.crownModalBg, this.crownCoin, this.crownEmoji,
      this.crownGambleLabel, this.crownWinText,
      this.crownFlipBg, this.crownFlipBtnText,
      this.crownWalkBg, this.crownWalkBtnText
    ].filter(Boolean) as Phaser.GameObjects.GameObject[];

    this.scene.tweens.add({
      targets: allElements,
      alpha: 0,
      duration: 200,
      ease: 'Linear',
      onComplete: () => {
        (allElements as any[]).forEach((e: any) => e.setVisible(false));
      },
    });

    // Remove any lingering event listeners
    this.crownFlipBg?.removeAllListeners();
    this.crownWalkBg?.removeAllListeners();
  }

  /**
   * Shows a floating win badge animation.
   * @param amount The amount won to display.
   */
  public showWinBadge(amount: number): void {
    if (amount <= 0) return;

    this.winBadgeText.setText(`+${amount.toFixed(2)}`);
    this.winBadgeText.setPosition(CANVAS_W / 2, CANVAS_H / 2);
    this.winBadgeText.setAlpha(1).setScale(1).setVisible(true);

    this.scene.tweens.add({
      targets: this.winBadgeText,
      y: this.winBadgeText.y - WIN_BADGE_OFFSET_Y,
      alpha: 0,
      duration: WIN_BADGE_DURATION,
      ease: 'Power1',
      onComplete: () => {
        this.winBadgeText.setVisible(false);
      },
    });
  }

  /**
   * Updates the displayed bet amount.
   * @param bet The new bet amount.
   */
  public updateBet(bet: number): void {
    this.betText.setText(`BET: ${bet.toFixed(2)}`);
  }

  /**
   * Updates the displayed win amount.
   * @param win The new win amount.
   */
  public triggerAudio(win: number, bet: number): void {
    this.audioManager.onWin(win, bet);
  }

  public updateWin(win: number): void {
    this.winText.setText(`WIN: ${win.toFixed(2)}`);
  }

  /**
   * Sets the enabled state of the spin button.
   * @param enabled True to enable, false to disable.
   */
  public setSpinButtonEnabled(enabled: boolean): void {
    this.spinButtonBg.setInteractive(enabled ? { useHandCursor: true } : false);
    this.spinButtonBg.setAlpha(enabled ? 1 : 0.5);
    this.spinButtonText.setAlpha(enabled ? 1 : 0.5);
  }

  /**
   * Sets the text of the spin button.
   * @param text The new text for the spin button.
   */
  public setSpinButtonText(text: string): void {
    this.spinButtonText.setText(text);
  }

  /**
   * Shows a general flash message on the screen.
   * @param message The main message.
   * @param sub The sub-message.
   * @param durationMs The duration of the flash message in milliseconds.
   * @param onDone Callback function when the flash message disappears.
   */
  public showFlash(message: string, sub: string, durationMs: number, onDone: () => void): void {
    this.slotAnimator.showFlash(message, sub, durationMs, onDone);
  }

  /**
   * Destroys all UI elements and the SlotAnimator.
   */
  public destroy(): void {
    this.slotAnimator.destroy();
    this.surgeMeterGraphics.destroy();
    this.surgeMeterText.destroy();
    this.surgeSpinsCounterText.destroy();

    // NEW: Destroy Crown Flip UI fields
    this.crownOverlay?.destroy();
    this.crownModalBg?.destroy();
    this.crownCoin?.destroy();
    this.crownEmoji?.destroy();
    this.crownGambleLabel?.destroy();
    this.crownWinText?.destroy();
    this.crownFlipBg?.destroy();
    this.crownFlipBtnText?.destroy();
    this.crownWalkBg?.destroy();
    this.crownWalkBtnText?.destroy();

    this.winBadgeText.destroy();
    this.betText.destroy();
    this.winText.destroy();
    this.spinButtonBg.destroy();
    this.spinButtonText.destroy();
  }
}
