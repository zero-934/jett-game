import * as Phaser from 'phaser';
import { CasinoAudioManager } from '../shared/audio/CasinoAudioManager';
import { SlotAnimator, THREE_REEL_PRESET } from '../shared/slot-engine/SlotAnimator';
import type { InfernoState, InfernoCluster, InfernoSymbol, InfernoCell } from './InfernoLogic';
import {
  COLOR_SURFACE,
  COLOR_GOLD,
  STR_GOLD,
  STR_TEXT,
  FONT_PRIMARY,
  FONT_DISPLAY,
  FONT_SIZE_XL,
  FONT_SIZE_3XL,
  FONT_SIZE_DISPLAY,
  CANVAS_W,
  CANVAS_H,
  SAFE_TOP,
  drawButton,
  STR_MUTED,
  FONT_SIZE_SM,
} from '../shared/ui/UITheme';

// --- Constants ---
const CANVAS_WIDTH = CANVAS_W; // Using theme constant
const CANVAS_HEIGHT = CANVAS_H; // Using theme constant
const HUD_TEXT_COLOR = STR_TEXT; // Using theme constant
const HUD_FONT_SIZE = FONT_SIZE_XL; // Using theme constant
const WIN_BADGE_FONT_SIZE = FONT_SIZE_3XL; // Using theme constant
const INFERNO_BANNER_FONT_SIZE = FONT_SIZE_DISPLAY; // Using theme constant

const SYMBOL_EMOJI: Record<string, string> = {
  EMBER: '🔥', FLAME: '🌋', COAL: '⚫', ASH: '💨', SMOKE: '🌫️', WILD: '⭐', SCATTER: '💠'
};

const SYMBOL_BG: Record<string, number> = {
  EMBER: 0xff4500, FLAME: 0xff6600, COAL: 0x333333, ASH: 0x888888, SMOKE: 0xaaaaaa,
  WILD: COLOR_GOLD, SCATTER: 0x0055ff // Changed WILD to theme gold
};

const HEAT_METER_SEGMENTS = 5;
const HEAT_METER_WIDTH = THREE_REEL_PRESET.reelsCount * THREE_REEL_PRESET.symbolSize + (THREE_REEL_PRESET.reelsCount - 1) * THREE_REEL_PRESET.reelGap;
const HEAT_METER_HEIGHT = 20;
const HEAT_METER_Y = SAFE_TOP + 20; // Below header, using safe area
const HEAT_METER_INACTIVE_COLOR = COLOR_SURFACE; // Using theme constant
const HEAT_METER_ACTIVE_COLOR_START = 0xff8c00; // Dark Orange (specific to Inferno, not theme)
const HEAT_METER_ACTIVE_COLOR_END = COLOR_GOLD; // Gold (Using theme constant)

// New Crown Flip Modal Constants
const CROWN_MODAL_W = 300;
const CROWN_MODAL_H = 360;
const CROWN_COIN_R = 50;
const CROWN_FLIP_BTN_W = 200;
const CROWN_FLIP_BTN_H = 56;


/**
 * InfernoUI class manages the visual representation and animations for the Inferno slot game.
 * It uses SlotAnimator for core reel animations and handles game-specific UI elements.
 */
export class InfernoUI {
  private scene: Phaser.Scene;
  private animator: SlotAnimator;
  private audioManager = new CasinoAudioManager();

  // HUD elements
  private betText!: Phaser.GameObjects.Text;
  private winText!: Phaser.GameObjects.Text;
  private spinButtonBg: Phaser.GameObjects.Graphics | null = null;
  private spinButtonText: Phaser.GameObjects.Text | null = null;

  // Heat Meter elements
  private heatMeterSegments: Phaser.GameObjects.Graphics[] = [];

  // Crown Flip Modal elements (new fields)
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

  /**
   * Creates an instance of InfernoUI.
   * @param scene The Phaser Scene this UI belongs to.
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.animator = new SlotAnimator(this.scene, THREE_REEL_PRESET);
  }

  /**
   * Initializes the UI elements and sets up the initial game state.
   * Must be called once during the scene's create method.
   * @param initialGrid The initial symbol grid to display.
   * @param onSpin A callback function to be invoked when the spin button is pressed.
   */
  public start(initialGrid: InfernoSymbol[][], onSpin: () => void): void {
    /* _gridX = */ this.animator.buildReels(
      this.drawSymbol.bind(this),
      this.drawBlur.bind(this)
    );
    this.buildGridBorder();
    this.buildHeatMeter();
    this.buildHUD(onSpin);
    this.buildCrownFlipModal();
    // Transpose initialGrid [row][col] -> [reel=col][row]
    const reelGrid: string[][] = [];
    for (let col = 0; col < 3; col++) {
      reelGrid.push((initialGrid as string[][]).map(row => row[col]));
    }
    this.animator.snapReels(reelGrid);
  }

  /**
   * Renders the current game grid instantly without animation.
   * @param state The current game state, containing the reel stops.
   */
  public renderGrid(state: InfernoState): void {
    // InfernoState.grid is [row][col], SlotAnimator expects [reel=col][row]
    const reelGrid: string[][] = [];
    for (let col = 0; col < 3; col++) {
      reelGrid.push(state.grid.map(row => row[col].symbol));
    }
    this.animator.snapReels(reelGrid);
  }

  /**
   * Animates the reels spinning and then snapping to the final grid.
   * @param finalGrid The final symbol grid after the spin.
   * @param onComplete Callback function to be executed after the spin animation finishes.
   */
  public animateSpin(finalGrid: InfernoCell[][], onComplete: () => void): void {
    // Transpose [row][col] → [reel=col][row] for SlotAnimator
    const reelGrid: string[][] = [];
    for (let col = 0; col < 3; col++) {
      reelGrid.push(finalGrid.map(row => row[col].symbol as string));
    }
    this.animator.spinReels(reelGrid, onComplete);
  }

  /**
   * Animates winning clusters by pulsing the winning cells.
   * @param clusters An array of winning clusters.
   * @param onComplete Callback function to be executed after the win animation finishes.
   */
  public animateClusters(clusters: InfernoCluster[], onComplete: () => void): void {
    const positions = clusters.flatMap(cluster =>
      cluster.cells.map((cell: { row: number; col: number }) => ({ reel: cell.col, row: cell.row }))
    );
    this.animator.animateWin(positions);
    this.scene.time.delayedCall(600, onComplete); // Wait for win pulse to complete
  }

  /**
   * Animates a cascade effect, where winning cells flash, then the grid updates.
   * @param state The new game state after the cascade.
   * @param onComplete Callback function to be executed after the cascade animation finishes.
   */
  public animateCascade(state: InfernoState, onComplete: () => void): void {
    const winningPositions = state.clusters.flatMap(cluster => cluster.cells);
    let completedFlashes = 0;
    const totalFlashes = winningPositions.length;

    if (totalFlashes === 0) {
      this.renderGrid(state);
      this.scene.time.delayedCall(300, onComplete);
      return;
    }

    winningPositions.forEach(pos => {
      this.animator.animateCellFlash(pos.col, pos.row, () => {
        completedFlashes++;
        if (completedFlashes === totalFlashes) {
          this.renderGrid(state);
          this.scene.time.delayedCall(300, onComplete); // Short delay after grid update
        }
      });
    });
  }

  /**
   * Shows the Crown Flip modal, allowing the player to choose to flip a coin or walk away.
   * @param currentWin The amount won that can be gambled.
   * @param onFlip Callback when the player chooses to flip.
   * @param onWalk Callback when the player chooses to walk away.
   */
  public showCrownFlip(currentWin: number, onFlip: () => void, onWalk: () => void): void {
    this.crownWinText?.setText(currentWin.toFixed(2));

    const elements = [
      this.crownOverlay,
      this.crownModalBg,
      this.crownCoin,
      this.crownEmoji,
      this.crownGambleLabel,
      this.crownWinText,
      this.crownFlipBg,
      this.crownFlipBtnText,
      this.crownWalkBg,
      this.crownWalkBtnText
    ] as any[];

    elements.forEach((element: any) => element.setVisible(true));

    this.scene.tweens.add({
      targets: elements,
      alpha: 1,
      duration: 200,
      ease: 'Sine.easeOut'
    });

    this.crownFlipBg?.once('pointerup', onFlip);
    this.crownWalkBg?.once('pointerup', onWalk);
  }

  /**
   * Hides the Crown Flip modal.
   */
  public hideCrownFlip(): void {
    const elements = [
      this.crownOverlay,
      this.crownModalBg,
      this.crownCoin,
      this.crownEmoji,
      this.crownGambleLabel,
      this.crownWinText,
      this.crownFlipBg,
      this.crownFlipBtnText,
      this.crownWalkBg,
      this.crownWalkBtnText
    ].filter(e => e !== null) as Phaser.GameObjects.GameObject[];

    this.scene.tweens.add({
      targets: elements,
      alpha: 0,
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: () => {
        (elements as any[]).forEach((element: any) => element.setVisible(false));
      }
    });

    this.crownFlipBg?.removeAllListeners();
    this.crownWalkBg?.removeAllListeners();
  }

  /**
   * Shows a win badge animation (e.g., "+1000") floating upwards and fading.
   * @param amount The win amount to display.
   */
  public showWinBadge(amount: number): void {
    const winBadge = this.scene.add.text(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      `+${amount}`,
      { fontFamily: FONT_PRIMARY, fontSize: WIN_BADGE_FONT_SIZE, color: STR_GOLD, fontStyle: 'bold' } // Themed
    ).setOrigin(0.5).setDepth(100);

    this.scene.tweens.add({
      targets: winBadge,
      y: winBadge.y - 100,
      alpha: 0,
      duration: 1500,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        winBadge.destroy();
      }
    });
  }

  /**
   * Shows an "INFERNO SPIN!" banner animation.
   * @param onComplete Callback function to be executed after the banner animation finishes.
   */
  public showInfernoBanner(onComplete: () => void): void {
    const bannerText = this.scene.add.text(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      'INFERNO SPIN!',
      {
        fontFamily: FONT_DISPLAY, // Using display font for large titles
        fontSize: INFERNO_BANNER_FONT_SIZE,
        color: STR_GOLD,
        align: 'center',
        fontStyle: 'bold',
        stroke: '#ff0000', // Inferno specific
        strokeThickness: 8,
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: '#ff8c00', // Inferno specific
          blur: 16,
          stroke: true,
          fill: true
        }
      }
    ).setOrigin(0.5).setScale(0).setDepth(100);

    this.scene.tweens.chain({
      tweens: [
        {
          targets: bannerText,
          scale: 1.2,
          duration: 300,
          ease: 'Back.easeOut'
        },
        {
          targets: bannerText,
          scale: 1.0,
          duration: 150,
          ease: 'Sine.easeIn'
        },
        {
          targets: bannerText,
          duration: 1200, // Hold duration
        },
        {
          targets: bannerText,
          scale: 0,
          alpha: 0,
          duration: 300,
          ease: 'Back.easeIn',
          onComplete: () => {
            bannerText.destroy();
            onComplete();
          }
        },
      ]
    });
  }

  /**
   * Updates the visual representation of the heat meter.
   * @param level The current heat level (0-5).
   */
  public updateHeatMeter(level: number): void {
    this.heatMeterSegments.forEach((segment, index) => {
      const isActive = index < level;
      segment.clear();
      const color = isActive
        ? Phaser.Display.Color.Interpolate.ColorWithColor(
            new Phaser.Display.Color(HEAT_METER_ACTIVE_COLOR_START),
            new Phaser.Display.Color(HEAT_METER_ACTIVE_COLOR_END),
            HEAT_METER_SEGMENTS,
            index + 1
          ).color
        : HEAT_METER_INACTIVE_COLOR;
      segment.fillStyle(color, 1);
      const sw = HEAT_METER_WIDTH / HEAT_METER_SEGMENTS;
      segment.fillRoundedRect(0, 0, sw - 2, HEAT_METER_HEIGHT, 4); // -2 for small gap

      if (isActive) {
        // Add a subtle glow tween
        this.scene.tweens.add({
          targets: segment,
          alpha: { from: 1, to: 0.8 },
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      } else {
        this.scene.tweens.killTweensOf(segment);
        segment.setAlpha(1);
      }
    });
  }

  /**
   * Updates the displayed bet amount in the HUD.
   * @param bet The new bet amount.
   */
  public updateBet(bet: number): void {
    if (this.betText) {
      this.betText.setText(`BET: ${bet}`);
    }
  }

  /**
   * Updates the displayed win amount in the HUD.
   * @param win The new win amount.
   */
  public triggerAudio(win: number, bet: number): void {
    this.audioManager.onWin(win, bet);
  }

  public updateWin(win: number): void {
    if (this.winText) {
      this.winText.setText(`WIN: ${win}`);
    }
  }

  /**
   * Cleans up all Phaser objects created by this UI instance.
   */
  public destroy(): void {
    this.animator.destroy();
    this.betText?.destroy();
    this.winText?.destroy();
    this.spinButtonBg?.destroy();
    this.spinButtonText?.destroy();

    this.heatMeterSegments.forEach(s => s.destroy());

    // Destroy all new crown flip fields
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
  }

  /**
   * Draws a specific symbol into a given container.
   * This method is passed to SlotAnimator as a callback.
   * @param container The Phaser.GameObjects.Container to draw into.
   * @param symbolKey The key of the symbol to draw.
   */
  private drawSymbol(container: Phaser.GameObjects.Container, symbolKey: string): void {
    container.removeAll(true);
    const { symbolSize } = THREE_REEL_PRESET;
    const inset = 3;

    const bg = this.scene.add.graphics();
    bg.fillStyle(SYMBOL_BG[symbolKey] || COLOR_SURFACE, 1); // Using theme surface for fallback
    bg.fillRoundedRect(inset, inset, symbolSize - inset * 2, symbolSize - inset * 2, 8);
    bg.lineStyle(2, COLOR_GOLD, 0.8); // Using theme gold
    bg.strokeRoundedRect(inset, inset, symbolSize - inset * 2, symbolSize - inset * 2, 8);
    container.add(bg);

    const emoji = SYMBOL_EMOJI[symbolKey] || '?';
    const text = this.scene.add.text(symbolSize / 2, symbolSize / 2, emoji, {
      fontFamily: FONT_PRIMARY,
      fontSize: `${Math.floor(symbolSize * 0.5)}px`,
      color: STR_TEXT, // Using theme text color
      align: 'center',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(text);
  }

  /**
   * Draws a blur placeholder into a given container.
   * This method is passed to SlotAnimator as a callback.
   * @param container The Phaser.GameObjects.Container to draw into.
   */
  private drawBlur(container: Phaser.GameObjects.Container): void {
    container.removeAll(true);
    const { symbolSize } = THREE_REEL_PRESET;
    const bg = this.scene.add.graphics();
    bg.fillStyle(COLOR_SURFACE, 0.75); // Using theme surface
    bg.fillRoundedRect(3, 3, symbolSize - 6, symbolSize - 6, 7);
    container.add(bg);
  }

  /**
   * Builds the Heat Meter UI element.
   */
  private buildGridBorder(): void {
    const { symbolSize, reelsCount, rowsCount, reelGap, gridTop } = THREE_REEL_PRESET;
    const gridW = reelsCount * symbolSize + (reelsCount - 1) * reelGap;
    const gridH = rowsCount * symbolSize + (rowsCount - 1) * reelGap;
    const canvasW = this.scene.game.config.width as number || CANVAS_W;
    const gx = (canvasW - gridW) / 2 - 10;
    const gy = gridTop - 10;
    const gw = gridW + 20;
    const gh = gridH + 20;

    const border = this.scene.add.graphics().setDepth(5);
    border.lineStyle(3, COLOR_GOLD, 1); // Using theme gold
    border.strokeRoundedRect(gx, gy, gw, gh, 12);
    border.lineStyle(1, COLOR_GOLD, 0.35); // Using theme gold
    border.strokeRoundedRect(gx + 4, gy + 4, gw - 8, gh - 8, 9);
    const corners = [[gx, gy], [gx+gw, gy], [gx, gy+gh], [gx+gw, gy+gh]];
    corners.forEach(([cx, cy]) => {
      border.fillStyle(COLOR_GOLD, 1); // Using theme gold
      border.fillRect(cx - 3, cy - 3, 6, 6);
    });
  }

  private buildHeatMeter(): void {
    const segmentWidth = HEAT_METER_WIDTH / HEAT_METER_SEGMENTS;
    const meterX = (CANVAS_WIDTH - HEAT_METER_WIDTH) / 2;

    for (let i = 0; i < HEAT_METER_SEGMENTS; i++) {
      const segment = this.scene.add.graphics();
      segment.x = meterX + i * segmentWidth;
      segment.y = HEAT_METER_Y;
      segment.fillStyle(HEAT_METER_INACTIVE_COLOR, 1); // Using theme constant
      segment.fillRoundedRect(0, 0, segmentWidth - 2, HEAT_METER_HEIGHT, 4); // -2 for small gap
      this.heatMeterSegments.push(segment);
    }
  }

  /**
   * Builds the Head-Up Display (HUD) elements like bet, win, and spin button.
   * @param onSpin Callback function for the spin button.
   */
  private buildHUD(onSpin: () => void): void {
    // BUG FIX: Removed duplicate bet selector buttons.
    // The Bet Text, Win Text, and Spin button remain.

    // Bet Text
    this.betText = this.scene.add.text(
      CANVAS_WIDTH * 0.1,
      656,
      'BET: 100',
      { fontFamily: FONT_PRIMARY, fontSize: HUD_FONT_SIZE, color: HUD_TEXT_COLOR } // Themed
    ).setOrigin(0, 0.5).setDepth(100);

    // Win Text
    this.winText = this.scene.add.text(
      CANVAS_WIDTH * 0.9,
      656,
      'WIN: 0',
      { fontFamily: FONT_PRIMARY, fontSize: HUD_FONT_SIZE, color: HUD_TEXT_COLOR } // Themed
    ).setOrigin(1, 0.5).setDepth(100);

    // Spin Button
    const buttonWidth = 120;
    const buttonHeight = 60;
    const { bg: spinBg, text: spinText } = drawButton(
      this.scene,
      CANVAS_WIDTH / 2,
      606,
      buttonWidth,
      buttonHeight,
      'SPIN',
      'primary',
      100
    );
    this.spinButtonBg = spinBg;
    this.spinButtonText = spinText;
    this.spinButtonBg.on('pointerup', () => { this.audioManager.init(); onSpin(); });
  }

  /**
   * Builds the Crown Flip modal, initially hidden.
   */
  private buildCrownFlipModal(): void {
    // Dark overlay
    this.crownOverlay = this.scene.add.rectangle(CANVAS_W/2, CANVAS_H/2, CANVAS_W, CANVAS_H, 0x000000, 0.75)
      .setDepth(200).setVisible(false).setAlpha(0);

    // Modal background
    this.crownModalBg = this.scene.add.graphics()
      .setDepth(201).setVisible(false).setAlpha(0);
    this.crownModalBg.fillStyle(COLOR_SURFACE, 1);
    this.crownModalBg.fillRoundedRect(CANVAS_W/2-CROWN_MODAL_W/2, CANVAS_H/2-CROWN_MODAL_H/2, CROWN_MODAL_W, CROWN_MODAL_H, 16);
    this.crownModalBg.lineStyle(2, COLOR_GOLD, 1);
    this.crownModalBg.strokeRoundedRect(CANVAS_W/2-CROWN_MODAL_W/2, CANVAS_H/2-CROWN_MODAL_H/2, CROWN_MODAL_W, CROWN_MODAL_H, 16);

    // Coin
    this.crownCoin = this.scene.add.arc(CANVAS_W/2, CANVAS_H/2-120, CROWN_COIN_R, 0, 360, false, COLOR_GOLD, 1)
      .setDepth(202).setVisible(false).setAlpha(0);

    // Emoji on coin
    this.crownEmoji = this.scene.add.text(CANVAS_W/2, CANVAS_H/2-120, '👑', {
      fontFamily: FONT_PRIMARY,
      fontSize: '36px',
      color: STR_TEXT // Use theme text color
    }).setOrigin(0.5).setDepth(203).setVisible(false).setAlpha(0);

    // Gamble Label
    this.crownGambleLabel = this.scene.add.text(CANVAS_W/2, CANVAS_H/2-55, 'GAMBLE', {
      fontFamily: FONT_PRIMARY,
      fontSize: FONT_SIZE_SM,
      color: STR_MUTED
    }).setOrigin(0.5).setDepth(202).setVisible(false).setAlpha(0);

    // Win Text
    this.crownWinText = this.scene.add.text(CANVAS_W/2, CANVAS_H/2-25, '0', {
      fontFamily: FONT_PRIMARY,
      fontSize: FONT_SIZE_3XL,
      color: STR_GOLD,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202).setVisible(false).setAlpha(0);

    // FLIP button
    const { bg: flipBg, text: flipText } = drawButton(
      this.scene,
      CANVAS_W/2,
      CANVAS_H/2+50,
      CROWN_FLIP_BTN_W,
      CROWN_FLIP_BTN_H,
      'FLIP',
      'primary',
      202
    );
    this.crownFlipBg = flipBg;
    this.crownFlipBtnText = flipText;
    this.crownFlipBg.setVisible(false).setAlpha(0);
    this.crownFlipBtnText.setVisible(false).setAlpha(0);

    // WALK button
    const { bg: walkBg, text: walkText } = drawButton(
      this.scene,
      CANVAS_W/2,
      CANVAS_H/2+120,
      CROWN_FLIP_BTN_W,
      CROWN_FLIP_BTN_H,
      'WALK',
      'secondary',
      202
    );
    this.crownWalkBg = walkBg;
    this.crownWalkBtnText = walkText;
    this.crownWalkBg.setVisible(false).setAlpha(0);
    this.crownWalkBtnText.setVisible(false).setAlpha(0);
  }
}
