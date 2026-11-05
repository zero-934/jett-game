/**
 * @file InfernoUI.ts
 * @purpose Phaser rendering, presentation timing and input for Inferno (Refined 2D "Ember Workshop").
 *          Plays authoritative `InfernoSpinScript`s produced by InfernoLogic — it never decides
 *          outcomes, payouts or RNG. Symbols and forge background are deterministic code-drawn
 *          textures generated once into a single atlas (no emoji, no external art).
 * @author Agent 934
 * @date 2026-04-16 (rewritten for inferno-polish-001 on 2026-11-05)
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import type { InfernoSpinScript, InfernoCascadeStep, InfernoSymbol } from './InfernoLogic';
import { formatCredits } from './InfernoLogic';
import {
  COLOR_GOLD, STR_GOLD, STR_TEXT, STR_MUTED, FONT_PRIMARY, FONT_SIZE_XS, FONT_SIZE_SM, FONT_SIZE_BASE,
  FONT_SIZE_LG, FONT_SIZE_XL, FONT_SIZE_3XL, CANVAS_W, CANVAS_H, drawButton,
} from '../shared/ui/UITheme';

// ─── Presentation timing (ms) — all tunable; see ART_AUDIO_AND_TIMING.md ─────────────────────
export const INFERNO_TIMING = Object.freeze({
  pressFeedback: 70,
  reelExit: 110,
  reelDrop: 360,
  reelSettle: 80,
  reelStagger: 75,
  identify: 150,
  identifyHold: 160,
  remove: 130,
  fall: 220,
  settle: 80,
  heat: 180,
  finalCount: 350,
  freeSpinGap: 900,
  crownFlip: 460,
  reducedFade: 110,
});
/** Global presentation speed multipliers (Phaser tween/clock timeScale). Never affect outcomes. */
const QUICK_SPIN_TIMESCALE = 1.8;
const SKIP_TIMESCALE = 6;

// ─── Layout (390 × 844 base) ───────────────────────────────────────────────────────────────
const W = CANVAS_W;
const H = CANVAS_H;
const HEADER_H = 64;
const WINDOW_X = 16;
const WINDOW_Y = 72;
const WINDOW_W = W - WINDOW_X * 2;
const WINDOW_H = 444;
const WINDOW_R = 18;
const HOOD_H = 74;
const CELL = 96;
const GAP = 10;
const STEP = CELL + GAP;
const BOARD_W = CELL * 3 + GAP * 2;
const BOARD_X = (W - BOARD_W) / 2;
const BOARD_Y = WINDOW_Y + HOOD_H + 6;
const GRATE_Y = BOARD_Y + BOARD_W + 6;
const HEAT_Y = WINDOW_Y + 44;
const HEAT_SEG_H = 14;
const HEAT_SEG_GAP = 6;
const STATUS_Y = WINDOW_Y + WINDOW_H + 26;
const PANEL_Y = STATUS_Y + 28;
const READOUT_LABEL_Y = PANEL_Y + 14;
const READOUT_VALUE_Y = PANEL_Y + 36;
const STAKE_ROW_Y = PANEL_Y + 84;
const STAKE_CHIP_W = 56;
const STAKE_CHIP_H = 44;
const SPIN_Y = PANEL_Y + 146;
const SPIN_H = 56;
const FOOTNOTE_Y = SPIN_Y + 48;
const PANEL_H = FOOTNOTE_Y - PANEL_Y + 26;
const ICON_BTN = 44;
const MIN_TOUCH = 44;

// ─── Depths ────────────────────────────────────────────────────────────────────────────────
const D_FORGE = 5;
const D_CELLS = 10;
const D_OUTLINE = 12;
const D_PARTICLES = 14;
const D_OCCLUDE = 20;
const D_HUD = 30;
const D_OVERLAY = 100;

// ─── Inferno-local palette (theme accent stays COLOR_GOLD; heat colours are semantic) ────────
const C_SHELL = 0x10141c;
const C_SHELL_LINE = 0x243042;
const C_PANEL = 0x151b26;
const C_FORGE_TOP = 0x1d1714;
const C_FORGE_BOTTOM = 0x2a1c14;
const C_BRICK = 0x2e231d;
const C_BRICK_LINE = 0x3a2c24;
const C_RIB = 0x3b3f47;
const C_SOCKET = 0x120e0c;
const C_HEAT_OFF = 0x2b2522;
const C_HEAT_ON = [0xd9772e, 0xe8862f, 0xf29433, 0xf7a23a, 0xffb347];
const C_WIN_OUTLINE = 0xffb347;
const STR_HEAT = '#ffb347';
const STR_NEUTRAL = '#c8ccd4';

// ─── Textures ──────────────────────────────────────────────────────────────────────────────
const ATLAS_KEY = 'inferno-atlas';
const BG_KEY = 'inferno-forge-bg';
const TEX_SCALE = 2;
const TEX_CELL = CELL * TEX_SCALE;
const SYMBOLS: InfernoSymbol[] = ['EMBER', 'FLAME', 'COAL', 'ASH', 'SMOKE', 'WILD', 'SCATTER'];
const SPARK_FRAME = 'spark';
const SPIN_FACE_KEY = 'inferno-face-spin';
const ICON_FACE_KEY = 'inferno-face-icon';
const HEAT_BASE_KEY = 'inferno-heat-base';
const HEAT_ON_KEY = 'inferno-heat-on-';
const CHIP_KEYS = { selected: 'inferno-chip-sel', selectedLocked: 'inferno-chip-sel-locked', normal: 'inferno-chip', normalLocked: 'inferno-chip-locked' };
const SPARK_SIZE = 16;
const MAX_ACTIVE_PARTICLES = 24;
const SPARKS_PER_CELL = 3;

/** Player-adjustable presentation settings (persisted by the scene). */
export interface InfernoSettings {
  /** 0 = off, 1..3 = low/medium/high. */
  music: number;
  sfx: number;
  reducedMotion: boolean;
  quickSpin: boolean;
}

/** Callbacks from UI input to the scene. The scene owns all state transitions. */
export interface InfernoUICallbacks {
  onSpin(): void;
  onStake(stake: number): void;
  onCollect(roundId: number): void;
  onFlip(roundId: number): void;
  onSettingsChanged(settings: InfernoSettings): void;
  onResetCredits(): void;
  onHome(): void;
}

/** Presentation hooks fired while a script plays (used for audio). Each fires once per event. */
export interface InfernoPresentationHooks {
  onReelStop(col: number): void;
  onClusters(step: InfernoCascadeStep): void;
  onRemove(step: InfernoCascadeStep): void;
  onLand(step: InfernoCascadeStep): void;
  onHeat(level: number, previous: number): void;
  onFeature(kind: 'free-spins' | 'inferno-spin', amount: number): void;
}

/** Presentation sub-phases. `idle` means no script is playing. */
export type InfernoPresentationPhase = 'idle' | 'spinning' | 'evaluating' | 'removing' | 'falling' | 'settling';

/** `bg` is the drawButton() input target (cleared, so it renders nothing); `face` is the baked visual. */
type Button = { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; face?: Phaser.GameObjects.Image };

const cellX = (col: number): number => BOARD_X + CELL / 2 + col * STEP;
const cellY = (row: number): number => BOARD_Y + CELL / 2 + row * STEP;

/**
 * Inferno renderer. Owns only presentation objects; every timed callback is guarded by a playback
 * token that is invalidated by `cancelPlayback()` / `destroy()`, so stale callbacks never run.
 */
export class InfernoUI {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: InfernoUICallbacks;
  private settings: InfernoSettings;
  private stakes: number[] = [];

  private cells: Phaser.GameObjects.Image[][] = [];
  private outline!: Phaser.GameObjects.Graphics;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private heatOn: Phaser.GameObjects.Image[] = [];
  private heatLabel!: Phaser.GameObjects.Text;
  private heatLevel = 0;

  private balanceText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private stakeValue!: Phaser.GameObjects.Text;
  private returnValue!: Phaser.GameObjects.Text;
  private netValue!: Phaser.GameObjects.Text;
  private returnLabel!: Phaser.GameObjects.Text;
  private stakeChips: Button[] = [];
  private spinButton!: Button;
  private settingsButton!: Button;
  private gearIcon: Phaser.GameObjects.Image | null = null;
  private skipZone!: Phaser.GameObjects.Zone;

  private crownObjects: Phaser.GameObjects.GameObject[] = [];
  private crownAmount!: Phaser.GameObjects.Text;
  private crownInfo!: Phaser.GameObjects.Text;
  private crownCoin!: Phaser.GameObjects.Image;
  private crownCollect!: Button;
  private crownFlip!: Button;
  private crownRoundId = 0;
  private crownLocked = true;

  private settingsObjects: Phaser.GameObjects.GameObject[] = [];
  private settingsButtons: { music: Button; sfx: Button; motion: Button; quick: Button; reset: Button } | null = null;

  private playbackToken = 0;
  private phase: InfernoPresentationPhase = 'idle';
  private skipping = false;
  private destroyed = false;
  private controlsLocked = false;
  private timers: Phaser.Time.TimerEvent[] = [];
  private countTween: Phaser.Tweens.Tween | null = null;

  /**
   * @param scene Owning scene.
   * @param callbacks Input callbacks.
   * @param settings Initial settings.
   * @example
   * const ui = new InfernoUI(this, callbacks, settings);
   */
  constructor(scene: Phaser.Scene, callbacks: InfernoUICallbacks, settings: InfernoSettings) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.settings = { ...settings };
  }

  // ═══ Build ══════════════════════════════════════════════════════════════════════════════

  /**
   * Builds all static objects. Call once from the scene's `create()`.
   * @param initialGrid Board to show while idle, `[row][col]`.
   * @param stakes Selectable stakes.
   * @param selectedStake Initially selected stake.
   * @example
   * ui.build(IDLE_BOARD, [1, 5, 10, 25, 50], 10);
   */
  public build(initialGrid: InfernoSymbol[][], stakes: number[], selectedStake: number): void {
    this.stakes = stakes.slice();
    InfernoUI.ensureTextures(this.scene);
    this.buildShell();
    this.buildBoard(initialGrid);
    this.buildHUD(selectedStake);
    this.buildCrown();
    this.buildSettings();
    this.applySpeed();
  }

  /**
   * Generates the symbol atlas and cached forge background once per texture manager.
   * @param scene Any scene of the game.
   * @example
   * InfernoUI.ensureTextures(this);
   */
  public static ensureTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists(ATLAS_KEY)) {
      const atlasW = TEX_CELL * (SYMBOLS.length + 1) + SPARK_SIZE * TEX_SCALE;
      const tex = scene.textures.createCanvas(ATLAS_KEY, atlasW, TEX_CELL);
      if (tex) {
        const ctx = tex.context;
        SYMBOLS.forEach((sym, i) => {
          ctx.save();
          ctx.translate(i * TEX_CELL, 0);
          drawSymbolTile(ctx, sym, TEX_CELL);
          ctx.restore();
          tex.add(sym, 0, i * TEX_CELL, 0, TEX_CELL, TEX_CELL);
        });
        ctx.save();
        ctx.translate(SYMBOLS.length * TEX_CELL, 0);
        drawCrownCoin(ctx, TEX_CELL);
        ctx.restore();
        tex.add('coin', 0, SYMBOLS.length * TEX_CELL, 0, TEX_CELL, TEX_CELL);
        const sx = TEX_CELL * (SYMBOLS.length + 1);
        const sr = SPARK_SIZE * TEX_SCALE;
        const g = ctx.createRadialGradient(sx + sr / 2, sr / 2, 0, sx + sr / 2, sr / 2, sr / 2);
        g.addColorStop(0, 'rgba(255,236,190,1)');
        g.addColorStop(0.4, 'rgba(255,170,80,0.9)');
        g.addColorStop(1, 'rgba(255,110,40,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx, 0, sr, sr);
        tex.add(SPARK_FRAME, 0, sx, 0, sr, sr);
        tex.refresh();
      }
    }
    if (!scene.textures.exists(BG_KEY)) {
      const tex = scene.textures.createCanvas(BG_KEY, WINDOW_W, WINDOW_H);
      if (tex) {
        drawForgeBackground(tex.context, WINDOW_W, WINDOW_H);
        tex.refresh();
      }
    }
  }

  private buildShell(): void {
    const s = this.scene;
    s.cameras.main.setBackgroundColor(C_SHELL); // instead of a full-screen rectangle (fill-rate)
    // forge window (cached texture) — behind the cells
    s.add.image(WINDOW_X, WINDOW_Y, BG_KEY).setOrigin(0, 0).setDepth(D_FORGE);
    // Shell art stays a live Graphics (rects are cheap to tessellate). Baking it into full-width
    // textures measured slower on software WebGL (fill rate); small rounded HUD faces ARE baked.
    drawShellArt(s.add.graphics().setDepth(D_OCCLUDE));
  }

  /** Draws `draw` into a texture once (cached by key). */
  private bake(key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void): string {
    if (!this.scene.textures.exists(key)) {
      const g = this.scene.make.graphics({}, false);
      draw(g);
      g.generateTexture(key, w, h);
      g.destroy();
    }
    return key;
  }

  /** drawButton() for input + a baked face image for visuals. */
  private facedButton(x: number, y: number, w: number, h: number, label: string, faceKey: string, depth: number): Button {
    const btn = drawButton(this.scene, x, y, w, h, label, 'secondary', depth);
    btn.bg.clear(); // keeps its hit area and input; renders nothing
    const face = this.scene.add.image(x, y, faceKey).setDepth(depth);
    return { ...btn, face };
  }

  private bakeButtonFaces(): void {
    const chip = (key: string, selected: boolean, locked: boolean) => this.bake(key, STAKE_CHIP_W, STAKE_CHIP_H, (g) => {
      if (selected) g.fillStyle(COLOR_GOLD, locked ? 0.55 : 1).fillRoundedRect(0, 0, STAKE_CHIP_W, STAKE_CHIP_H, 8);
      else g.fillStyle(C_PANEL, 1).fillRoundedRect(1, 1, STAKE_CHIP_W - 2, STAKE_CHIP_H - 2, 8).lineStyle(1.5, COLOR_GOLD, locked ? 0.3 : 0.8).strokeRoundedRect(1, 1, STAKE_CHIP_W - 2, STAKE_CHIP_H - 2, 8);
    });
    chip(CHIP_KEYS.selected, true, false); chip(CHIP_KEYS.selectedLocked, true, true);
    chip(CHIP_KEYS.normal, false, false); chip(CHIP_KEYS.normalLocked, false, true);
    this.bake(SPIN_FACE_KEY, BOARD_W, SPIN_H, (g) => g.fillStyle(COLOR_GOLD, 1).fillRoundedRect(0, 0, BOARD_W, SPIN_H, 10));
    this.bake(ICON_FACE_KEY, ICON_BTN, ICON_BTN, (g) => g.fillStyle(C_PANEL, 1).fillRoundedRect(1, 1, ICON_BTN - 2, ICON_BTN - 2, 8).lineStyle(1.5, COLOR_GOLD, 1).strokeRoundedRect(1, 1, ICON_BTN - 2, ICON_BTN - 2, 8));
  }

  private buildBoard(grid: InfernoSymbol[][]): void {
    for (let r = 0; r < 3; r++) {
      const row: Phaser.GameObjects.Image[] = [];
      for (let c = 0; c < 3; c++) {
        row.push(this.scene.add.image(cellX(c), cellY(r), ATLAS_KEY, grid[r][c]).setDisplaySize(CELL, CELL).setDepth(D_CELLS));
      }
      this.cells.push(row);
    }
    this.outline = this.scene.add.graphics().setDepth(D_OUTLINE);
    this.emitter = this.scene.add.particles(0, 0, ATLAS_KEY, {
      frame: SPARK_FRAME,
      emitting: false,
      lifespan: { min: 260, max: 420 },
      speed: { min: 40, max: 120 },
      angle: { min: 200, max: 340 },
      gravityY: 160,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      maxAliveParticles: MAX_ACTIVE_PARTICLES,
      blendMode: 'ADD',
    }).setDepth(D_PARTICLES);
    // tap on the board during presentation = skip (speed up); never changes outcomes
    this.skipZone = this.scene.add.zone(BOARD_X, BOARD_Y, BOARD_W, BOARD_W).setOrigin(0, 0).setDepth(D_HUD).setInteractive();
    this.skipZone.on('pointerdown', () => this.requestSkip());
  }

  private buildHUD(selectedStake: number): void {
    const s = this.scene;
    this.bakeButtonFaces();
    // header: home (44px), title, demo credits, settings (44px)
    this.iconButton(12 + ICON_BTN / 2, HEADER_H / 2, '‹', () => this.callbacks.onHome());
    s.add.text(64, HEADER_H / 2, 'INFERNO', { fontFamily: FONT_PRIMARY, fontSize: FONT_SIZE_LG, color: STR_TEXT, fontStyle: 'bold' })
      .setOrigin(0, 0.5).setDepth(D_HUD).setLetterSpacing(1.5);
    s.add.text(W - 66, HEADER_H / 2 - 9, 'DEMO CREDITS', { fontFamily: FONT_PRIMARY, fontSize: FONT_SIZE_XS, color: STR_MUTED })
      .setOrigin(1, 0.5).setDepth(D_HUD).setLetterSpacing(1);
    this.balanceText = s.add.text(W - 66, HEADER_H / 2 + 9, '—', { fontFamily: FONT_PRIMARY, fontSize: FONT_SIZE_LG, color: STR_TEXT, fontStyle: 'bold' })
      .setOrigin(1, 0.5).setDepth(D_HUD);
    this.settingsButton = this.iconButton(W - 12 - ICON_BTN / 2, HEADER_H / 2, '', () => this.openSettings());
    // vector gear (no platform emoji glyph), baked once
    const gx = W - 12 - ICON_BTN / 2; const gy = HEADER_H / 2;
    this.bake('inferno-gear', 28, 28, (g) => {
      g.fillStyle(0xe8e3d6, 1);
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; g.fillCircle(14 + Math.cos(a) * 8, 14 + Math.sin(a) * 8, 2.6); }
      g.fillCircle(14, 14, 8).fillStyle(C_PANEL, 1).fillCircle(14, 14, 3.4);
    });
    const gear = s.add.image(gx, gy, 'inferno-gear').setDepth(D_HUD + 1);
    this.gearIcon = gear;

    // heat meter on the hood
    s.add.text(BOARD_X, WINDOW_Y + 22, 'HEAT', { fontFamily: FONT_PRIMARY, fontSize: FONT_SIZE_XS, color: STR_HEAT, fontStyle: 'bold' })
      .setOrigin(0, 0.5).setDepth(D_HUD).setLetterSpacing(2);
    this.heatLabel = s.add.text(BOARD_X + BOARD_W, WINDOW_Y + 22, 'INFERNO SPIN AT 5', { fontFamily: FONT_PRIMARY, fontSize: FONT_SIZE_XS, color: STR_MUTED })
      .setOrigin(1, 0.5).setDepth(D_HUD).setLetterSpacing(1);
    const segW = (BOARD_W - HEAT_SEG_GAP * 4) / 5;
    this.bake(HEAT_BASE_KEY, BOARD_W, HEAT_SEG_H, (g) => {
      for (let i = 0; i < 5; i++) {
        const x = i * (segW + HEAT_SEG_GAP);
        g.fillStyle(C_HEAT_OFF, 1).fillRoundedRect(x, 0, segW, HEAT_SEG_H, 4);
        g.lineStyle(1, 0x3a312c, 1).strokeRoundedRect(x + 0.5, 0.5, segW - 1, HEAT_SEG_H - 1, 4);
      }
    });
    s.add.image(BOARD_X, HEAT_Y, HEAT_BASE_KEY).setOrigin(0, 0).setDepth(D_HUD);
    for (let i = 0; i < 5; i++) {
      const x = BOARD_X + i * (segW + HEAT_SEG_GAP);
      const key = this.bake(`${HEAT_ON_KEY}${i}`, Math.ceil(segW), HEAT_SEG_H, (g) => {
        g.fillStyle(C_HEAT_ON[i], 1).fillRoundedRect(0, 0, segW, HEAT_SEG_H, 4);
        g.fillStyle(0xffe2b0, 0.35).fillRoundedRect(3, 2, segW - 6, 3, 1.5);
      });
      this.heatOn.push(s.add.image(x, HEAT_Y, key).setOrigin(0, 0).setDepth(D_HUD + 1).setAlpha(0));
    }

    // status line
    this.statusText = s.add.text(W / 2, STATUS_Y, 'Match 3+ touching symbols — up, down, left or right', {
      fontFamily: FONT_PRIMARY, fontSize: FONT_SIZE_SM, color: STR_NEUTRAL, align: 'center', wordWrap: { width: WINDOW_W - 20 },
    }).setOrigin(0.5).setDepth(D_HUD);

    // readouts
    const lab = { fontFamily: FONT_PRIMARY, fontSize: FONT_SIZE_XS, color: STR_MUTED };
    const val = { fontFamily: FONT_PRIMARY, fontSize: FONT_SIZE_XL, color: STR_TEXT, fontStyle: 'bold' };
    const x0 = BOARD_X; const x1 = W / 2; const x2 = BOARD_X + BOARD_W;
    s.add.text(x0, READOUT_LABEL_Y, 'DEMO STAKE', lab).setOrigin(0, 0.5).setDepth(D_HUD).setLetterSpacing(1);
    this.returnLabel = s.add.text(x1, READOUT_LABEL_Y, 'ROUND RETURN', lab).setOrigin(0.5).setDepth(D_HUD).setLetterSpacing(1);
    s.add.text(x2, READOUT_LABEL_Y, 'NET', lab).setOrigin(1, 0.5).setDepth(D_HUD).setLetterSpacing(1);
    this.stakeValue = s.add.text(x0, READOUT_VALUE_Y, formatCredits(selectedStake * 1000), val).setOrigin(0, 0.5).setDepth(D_HUD);
    this.returnValue = s.add.text(x1, READOUT_VALUE_Y, '0.00', val).setOrigin(0.5).setDepth(D_HUD);
    this.netValue = s.add.text(x2, READOUT_VALUE_Y, '—', { ...val, color: STR_MUTED }).setOrigin(1, 0.5).setDepth(D_HUD);

    // stake chips (44px tall)
    const n = this.stakes.length;
    const chipGap = (BOARD_W - n * STAKE_CHIP_W) / Math.max(1, n - 1);
    this.stakes.forEach((stake, i) => {
      const cx = BOARD_X + STAKE_CHIP_W / 2 + i * (STAKE_CHIP_W + chipGap);
      const btn = this.facedButton(cx, STAKE_ROW_Y, STAKE_CHIP_W, STAKE_CHIP_H, String(stake), CHIP_KEYS.normal, D_HUD);
      btn.bg.on('pointerup', () => { if (!this.controlsLocked) this.callbacks.onStake(stake); });
      this.stakeChips.push(btn);
    });
    this.setStake(selectedStake, false);

    this.spinButton = this.facedButton(W / 2, SPIN_Y, BOARD_W, SPIN_H, 'SPIN', SPIN_FACE_KEY, D_HUD);
    this.spinButton.text.setFontSize(FONT_SIZE_LG).setLetterSpacing(2).setColor('#000000');
    this.spinButton.bg.on('pointerdown', () => this.pressFeedback(this.spinButton));
    this.spinButton.bg.on('pointerup', () => this.callbacks.onSpin());
    s.add.text(W / 2, FOOTNOTE_Y, 'DEMO CREDITS HAVE NO CASH VALUE', { fontFamily: FONT_PRIMARY, fontSize: FONT_SIZE_XS, color: STR_MUTED })
      .setOrigin(0.5).setDepth(D_HUD).setLetterSpacing(1);
  }

  private iconButton(x: number, y: number, glyph: string, onUp: () => void): Button {
    const btn = this.facedButton(x, y, ICON_BTN, ICON_BTN, glyph, ICON_FACE_KEY, D_HUD);
    btn.text.setFontSize(FONT_SIZE_XL).setColor(STR_TEXT);
    btn.bg.on('pointerup', onUp);
    return btn;
  }

  private pressFeedback(btn: Button): void {
    if (this.destroyed) return;
    this.scene.tweens.add({ targets: [btn.text], scale: 0.94, duration: INFERNO_TIMING.pressFeedback / 2, yoyo: true });
  }

  // ═══ Public state setters ══════════════════════════════════════════════════════════════

  /**
   * @param balanceMilli Balance in milli-credits.
   * @example ui.setBalance(990000);
   */
  public setBalance(balanceMilli: number): void {
    this.balanceText.setText(formatCredits(balanceMilli));
  }

  /**
   * Highlights the selected stake; `locked` disables changes (paid/free/decision phases).
   * @param stake Selected or cycle stake.
   * @param locked Whether stake changes are locked.
   * @example ui.setStake(10, true);
   */
  public setStake(stake: number, locked: boolean): void {
    this.stakeValue?.setText(formatCredits(stake * 1000));
    this.stakeChips.forEach((chip, i) => {
      const selected = this.stakes[i] === stake;
      chip.text.setColor(selected ? '#0d0d0d' : STR_GOLD);
      chip.face?.setTexture(selected ? (locked ? CHIP_KEYS.selectedLocked : CHIP_KEYS.selected) : (locked ? CHIP_KEYS.normalLocked : CHIP_KEYS.normal));
      chip.text.setAlpha(locked && !selected ? 0.4 : 1);
    });
  }

  /**
   * Locks or unlocks stake/settings controls during a round.
   * @param locked True while a round, award cycle or decision is open.
   * @example ui.lockControls(true);
   */
  public lockControls(locked: boolean): void {
    this.controlsLocked = locked;
    this.settingsButton.face?.setAlpha(locked ? 0.5 : 1);
    this.settingsButton.text.setAlpha(locked ? 0.5 : 1);
    this.gearIcon?.setAlpha(locked ? 0.5 : 1);
  }

  /**
   * Sets the SPIN button label and enabled state.
   * @param label e.g. "SPIN", "FREE SPIN · 4 LEFT".
   * @param enabled Whether pressing it does anything.
   * @example ui.setSpinButton('SPIN', true);
   */
  public setSpinButton(label: string, enabled: boolean): void {
    this.spinButton.text.setText(label);
    this.spinButton.face?.setAlpha(enabled ? 1 : 0.55);
    this.spinButton.text.setAlpha(enabled ? 1 : 0.7);
  }

  /**
   * Updates stake / return / net readouts. Net is shown only when meaningful.
   * @param label Return label (e.g. "ROUND RETURN", "AT RISK").
   * @param returnMilli Gross return of the current paid cycle so far.
   * @param netMilli Net (return − paid stake) or null to hide.
   * @param instant Skip the count-up.
   * @example ui.setReadout('ROUND RETURN', 12500, 2500, false);
   */
  public setReadout(label: string, returnMilli: number, netMilli: number | null, instant = true): void {
    this.returnLabel.setText(label);
    this.countTween?.stop();
    this.countTween = null;
    const target = returnMilli;
    const shown = { v: Number(this.returnValue.getData('milli') ?? 0) };
    const apply = (v: number) => { this.returnValue.setText(formatCredits(Math.round(v))); };
    this.returnValue.setData('milli', target);
    if (instant || this.settings.reducedMotion || this.skipping || shown.v === target) apply(target);
    else {
      this.countTween = this.scene.tweens.add({ targets: shown, v: target, duration: INFERNO_TIMING.finalCount, ease: 'Cubic.easeOut', onUpdate: () => apply(shown.v), onComplete: () => apply(target) });
    }
    if (netMilli === null) this.netValue.setText('—').setColor(STR_MUTED);
    else this.netValue.setText(`${netMilli > 0 ? '+' : netMilli < 0 ? '−' : ''}${formatCredits(Math.abs(netMilli))}`).setColor(netMilli > 0 ? STR_GOLD : STR_NEUTRAL);
  }

  /**
   * Shows a one-line status message.
   * @param text Message.
   * @param tone `neutral`, `heat` (feature info) or `positive` (net profit only).
   * @example ui.setStatus('No paying cluster', 'neutral');
   */
  public setStatus(text: string, tone: 'neutral' | 'heat' | 'positive' = 'neutral'): void {
    this.statusText.setText(text).setColor(tone === 'positive' ? STR_GOLD : tone === 'heat' ? STR_HEAT : STR_NEUTRAL);
  }

  /**
   * Updates the heat meter. Only changed segments animate (one short tween each, never repeating).
   * @param level 0..5.
   * @param animate Animate changed segments.
   * @example ui.setHeat(3, true);
   */
  public setHeat(level: number, animate: boolean): void {
    const prev = this.heatLevel;
    this.heatLevel = level;
    this.heatOn.forEach((seg, i) => {
      const on = i < level;
      const was = i < prev;
      if (on === was && animate) return;
      this.scene.tweens.killTweensOf(seg);
      if (!animate || this.settings.reducedMotion) { seg.setAlpha(on ? 1 : 0).setScale(1); return; }
      this.scene.tweens.add({ targets: seg, alpha: on ? 1 : 0, duration: INFERNO_TIMING.heat, ease: 'Sine.easeOut' });
    });
    this.heatLabel.setText(level >= 5 ? 'FULL · NEXT SPIN IS ALL WILD' : `${level} / 5 · INFERNO SPIN AT 5`).setColor(level >= 5 ? STR_HEAT : STR_MUTED);
  }

  /** @returns Current presentation sub-phase (for harness/tests). @example ui.getPhase(); */
  public getPhase(): InfernoPresentationPhase { return this.phase; }

  /**
   * Snaps the board to a grid without animation.
   * @param grid `[row][col]`.
   * @example ui.snapBoard(script.initialGrid);
   */
  public snapBoard(grid: InfernoSymbol[][]): void {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const img = this.cells[r][c];
      this.scene.tweens.killTweensOf(img);
      img.setFrame(grid[r][c]).setPosition(cellX(c), cellY(r)).setAlpha(1).setDisplaySize(CELL, CELL).clearTint();
    }
  }

  // ═══ Script playback ═════════════════════════════════════════════════════════════════

  /**
   * Plays a complete spin script: reel entry → for each step (identify → remove → fall → settle)
   * → done. Calls `onDone` exactly once unless playback is cancelled.
   * @param script Authoritative script from InfernoLogic.
   * @param hooks Presentation hooks (audio).
   * @param onDone Called once when the presentation completes.
   * @example ui.playScript(script, hooks, () => scene.finish(roundId));
   */
  public playScript(script: InfernoSpinScript, hooks: InfernoPresentationHooks, onDone: () => void): void {
    this.cancelPlayback();
    const token = ++this.playbackToken;
    this.skipping = false;
    this.applySpeed();
    this.phase = 'spinning';
    this.outline.clear();
    if (script.isInfernoSpin) {
      hooks.onFeature('inferno-spin', 0);
      this.setStatus('INFERNO SPIN · every symbol lands WILD', 'heat');
    }
    if (script.heatAtLanding !== this.heatLevel) { hooks.onHeat(script.heatAtLanding, this.heatLevel); this.setHeat(script.heatAtLanding, true); }
    this.animateEntry(token, script.initialGrid, hooks, () => {
      if (script.freeSpinsAwardedAtLanding > 0) hooks.onFeature('free-spins', script.freeSpinsAwardedAtLanding);
      this.playStep(token, script, 0, hooks, onDone);
    });
  }

  private playStep(token: number, script: InfernoSpinScript, index: number, hooks: InfernoPresentationHooks, onDone: () => void): void {
    if (!this.alive(token)) return;
    const step = script.steps[index];
    if (!step) {
      this.phase = 'idle';
      this.outline.clear();
      onDone();
      return;
    }
    this.phase = 'evaluating';
    hooks.onClusters(step);
    this.showClusters(step);
    this.setStatus(index === 0 ? `Cluster pays ${formatCredits(Math.round(step.stepWin * 1000))}` : `Cascade ${index} · pays ${formatCredits(Math.round(step.stepWin * 1000))}`, 'neutral');
    this.wait(token, INFERNO_TIMING.identify + INFERNO_TIMING.identifyHold, () => {
      this.phase = 'removing';
      hooks.onRemove(step);
      this.animateRemoval(token, step, () => {
        this.phase = 'falling';
        this.animateFall(token, step, () => {
          hooks.onLand(step);
          if (step.heatAfter !== step.heatBefore) { hooks.onHeat(step.heatAfter, step.heatBefore); this.setHeat(step.heatAfter, true); }
          if (step.freeSpinsAwarded > 0) hooks.onFeature('free-spins', step.freeSpinsAwarded);
          this.phase = 'settling';
          this.wait(token, INFERNO_TIMING.settle, () => this.playStep(token, script, index + 1, hooks, onDone));
        });
      });
    });
  }

  private animateEntry(token: number, grid: InfernoSymbol[][], hooks: InfernoPresentationHooks, done: () => void): void {
    const T = INFERNO_TIMING;
    let landed = 0;
    for (let c = 0; c < 3; c++) {
      this.wait(token, c * T.reelStagger, () => {
        const column = [0, 1, 2].map((r) => this.cells[r][c]);
        if (this.settings.reducedMotion) {
          column.forEach((img, r) => { img.setFrame(grid[r][c]).setAlpha(0).setPosition(cellX(c), cellY(r)); });
          this.tween(token, { targets: column, alpha: 1, duration: T.reducedFade }, () => { hooks.onReelStop(c); if (++landed === 3) done(); });
          return;
        }
        this.tween(token, { targets: column, alpha: 0, y: `+=${CELL * 0.3}`, duration: T.reelExit, ease: 'Quad.easeIn' }, () => {
          column.forEach((img, r) => { img.setFrame(grid[r][c]).setAlpha(1).setPosition(cellX(c), cellY(r) - STEP * 3); });
          this.tween(token, { targets: column, y: `+=${STEP * 3}`, duration: T.reelDrop, ease: 'Quad.easeIn' }, () => {
            hooks.onReelStop(c);
            this.squash(token, column, T.reelSettle, () => { if (++landed === 3) done(); });
          });
        });
      });
    }
  }

  private showClusters(step: InfernoCascadeStep): void {
    this.outline.clear();
    const pad = 3;
    step.clusters.forEach((cl) => {
      cl.cells.forEach(({ row, col }) => {
        this.outline.lineStyle(3, C_WIN_OUTLINE, 1).strokeRoundedRect(cellX(col) - CELL / 2 - pad, cellY(row) - CELL / 2 - pad, CELL + pad * 2, CELL + pad * 2, 14);
      });
    });
    // connect adjacent winning cells so the cluster reads as one shape (non-colour cue)
    step.clusters.forEach((cl) => {
      const set = new Set(cl.cells.map((p) => `${p.row},${p.col}`));
      cl.cells.forEach(({ row, col }) => {
        if (set.has(`${row},${col + 1}`)) this.outline.fillStyle(C_WIN_OUTLINE, 1).fillRect(cellX(col) + CELL / 2, cellY(row) - 3, GAP, 6);
        if (set.has(`${row + 1},${col}`)) this.outline.fillStyle(C_WIN_OUTLINE, 1).fillRect(cellX(col) - 3, cellY(row) + CELL / 2, 6, GAP);
      });
    });
    this.outline.setAlpha(0);
    this.scene.tweens.add({ targets: this.outline, alpha: 1, duration: INFERNO_TIMING.identify * 0.5 });
    if (!this.settings.reducedMotion) {
      const imgs = step.winningCells.map(({ row, col }) => this.cells[row][col]);
      this.scene.tweens.add({ targets: imgs, scaleX: (CELL * 1.06) / TEX_CELL, scaleY: (CELL * 1.06) / TEX_CELL, duration: INFERNO_TIMING.identify / 2, yoyo: true, ease: 'Sine.easeInOut' });
    }
  }

  private animateRemoval(token: number, step: InfernoCascadeStep, done: () => void): void {
    const imgs = step.winningCells.map(({ row, col }) => this.cells[row][col]);
    this.scene.tweens.killTweensOf(imgs);
    imgs.forEach((img) => img.setDisplaySize(CELL, CELL));
    if (!this.settings.reducedMotion && this.emitter) {
      const budget = Math.max(0, MAX_ACTIVE_PARTICLES - this.emitter.getAliveParticleCount());
      const perCell = Math.min(SPARKS_PER_CELL, Math.floor(budget / Math.max(1, imgs.length)));
      if (perCell > 0) imgs.forEach((img) => this.emitter?.explode(perCell, img.x, img.y));
    }
    this.tween(token, {
      targets: imgs, alpha: 0, scaleX: (CELL * 0.6) / TEX_CELL, scaleY: (CELL * 0.6) / TEX_CELL,
      duration: this.settings.reducedMotion ? INFERNO_TIMING.reducedFade : INFERNO_TIMING.remove, ease: 'Quad.easeIn',
    }, () => { this.outline.clear(); done(); });
  }

  private animateFall(token: number, step: InfernoCascadeStep, done: () => void): void {
    const T = INFERNO_TIMING;
    const next: (Phaser.GameObjects.Image | null)[][] = [[null, null, null], [null, null, null], [null, null, null]];
    const freed: Phaser.GameObjects.Image[][] = [[], [], []];
    step.winningCells.forEach(({ row, col }) => freed[col].push(this.cells[row][col]));
    const moving: Phaser.GameObjects.Image[] = [];
    step.moves.forEach((m) => {
      const img = this.cells[m.fromRow][m.col];
      next[m.toRow][m.col] = img;
      if (m.toRow !== m.fromRow) moving.push(img);
    });
    step.refills.forEach((f) => {
      const img = freed[f.col].pop() as Phaser.GameObjects.Image;
      img.setFrame(f.symbol).setDisplaySize(CELL, CELL).setAlpha(1).setPosition(cellX(f.col), cellY(f.toRow) - f.slotsAbove * STEP - (this.settings.reducedMotion ? 0 : STEP * 0.5));
      next[f.toRow][f.col] = img;
      moving.push(img);
    });
    this.cells = next as Phaser.GameObjects.Image[][];
    if (this.settings.reducedMotion) {
      // crossfade in place: no travel
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) this.cells[r][c].setPosition(cellX(c), cellY(r));
      const refills = step.refills.map((f) => this.cells[f.toRow][f.col]);
      refills.forEach((img) => img.setAlpha(0));
      this.tween(token, { targets: refills.length ? refills : [this.outline], alpha: 1, duration: T.reducedFade }, done);
      return;
    }
    let pending = 0;
    let finished = false;
    const finish = () => { if (!finished && --pending <= 0) { finished = true; this.squash(token, moving, T.settle, done); } };
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const img = this.cells[r][c];
      if (!moving.includes(img)) continue;
      pending++;
      this.tween(token, { targets: img, y: cellY(r), duration: T.fall, ease: 'Quad.easeIn' }, finish);
    }
    if (pending === 0) { finished = true; done(); }
  }

  private squash(token: number, imgs: Phaser.GameObjects.Image[], duration: number, done: () => void): void {
    if (imgs.length === 0 || this.settings.reducedMotion) { this.wait(token, 0, done); return; }
    const sx = CELL / TEX_CELL;
    imgs.forEach((img) => img.setScale(sx * 1.03, sx * 0.94));
    this.tween(token, { targets: imgs, scaleX: sx, scaleY: sx, duration, ease: 'Back.easeOut' }, done);
  }

  // ═══ Speed / skip ════════════════════════════════════════════════════════════════════

  /**
   * Speeds up the remainder of the current presentation (tap board or SPIN while playing).
   * Presentation only — the outcome was resolved before playback started.
   * @example ui.requestSkip();
   */
  public requestSkip(): void {
    if (this.phase === 'idle' || this.skipping) return;
    this.skipping = true;
    this.applySpeed();
  }

  private applySpeed(): void {
    const scale = this.skipping ? SKIP_TIMESCALE : this.settings.quickSpin ? QUICK_SPIN_TIMESCALE : 1;
    this.scene.tweens.timeScale = scale;
    this.scene.time.timeScale = scale;
  }

  /**
   * Resets presentation speed once a round has finished.
   * @example ui.endPresentationSpeed();
   */
  public endPresentationSpeed(): void {
    this.skipping = false;
    this.applySpeed();
  }

  // ═══ Guarded timing helpers ══════════════════════════════════════════════════════════

  private alive(token: number): boolean {
    return !this.destroyed && token === this.playbackToken;
  }

  private wait(token: number, ms: number, fn: () => void): void {
    const ev = this.scene.time.delayedCall(ms, () => {
      this.timers = this.timers.filter((t) => t !== ev);
      if (this.alive(token)) fn();
    });
    this.timers.push(ev);
  }

  private tween(token: number, config: Phaser.Types.Tweens.TweenBuilderConfig, done: () => void): void {
    let called = false;
    this.scene.tweens.add({ ...config, onComplete: () => { if (!called && this.alive(token)) { called = true; done(); } } });
  }

  /**
   * Invalidates the current playback (stale callbacks become no-ops) and stops its timers.
   * @example ui.cancelPlayback();
   */
  public cancelPlayback(): void {
    this.playbackToken++;
    this.timers.forEach((t) => t.remove(false));
    this.timers = [];
    this.phase = 'idle';
  }

  // ═══ Crown decision ══════════════════════════════════════════════════════════════════

  private buildCrown(): void {
    const s = this.scene;
    const pw = WINDOW_W - 24; const ph = 330; const px = W / 2 - pw / 2; const py = H / 2 - ph / 2 - 30;
    const shade = s.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72).setDepth(D_OVERLAY).setInteractive();
    const panel = s.add.graphics().setDepth(D_OVERLAY);
    panel.fillStyle(C_PANEL, 1).fillRoundedRect(px, py, pw, ph, 16).lineStyle(1, C_SHELL_LINE, 1).strokeRoundedRect(px, py, pw, ph, 16);
    const title = s.add.text(W / 2, py + 26, 'CROWN FLIP · OPTIONAL', { fontFamily: FONT_PRIMARY, fontSize: FONT_SIZE_SM, color: STR_MUTED, fontStyle: 'bold' }).setOrigin(0.5).setDepth(D_OVERLAY).setLetterSpacing(1.5);
    this.crownCoin = s.add.image(W / 2, py + 82, ATLAS_KEY, 'coin').setDisplaySize(64, 64).setDepth(D_OVERLAY);
    const atRisk = s.add.text(W / 2, py + 128, 'AMOUNT AT RISK', { fontFamily: FONT_PRIMARY, fontSize: FONT_SIZE_XS, color: STR_MUTED }).setOrigin(0.5).setDepth(D_OVERLAY).setLetterSpacing(1);
    this.crownAmount = s.add.text(W / 2, py + 158, '0.00', { fontFamily: FONT_PRIMARY, fontSize: FONT_SIZE_3XL, color: STR_TEXT, fontStyle: 'bold' }).setOrigin(0.5).setDepth(D_OVERLAY);
    this.crownInfo = s.add.text(W / 2, py + 194, 'Flip: 50% double, 50% lose it all.\nCollect keeps this amount.', { fontFamily: FONT_PRIMARY, fontSize: FONT_SIZE_SM, color: STR_NEUTRAL, align: 'center', wordWrap: { width: pw - 40 } }).setOrigin(0.5).setDepth(D_OVERLAY);
    this.crownCollect = drawButton(s, W / 2, py + 250, pw - 40, 52, 'COLLECT', 'primary', D_OVERLAY + 1);
    this.crownFlip = drawButton(s, W / 2, py + 302, pw - 40, 44, 'FLIP (DOUBLE OR NOTHING)', 'secondary', D_OVERLAY + 1);
    this.crownCollect.bg.on('pointerup', () => this.crownPress('collect'));
    this.crownFlip.bg.on('pointerup', () => this.crownPress('flip'));
    this.crownObjects = [shade, panel, title, this.crownCoin, atRisk, this.crownAmount, this.crownInfo, this.crownCollect.bg, this.crownCollect.text, this.crownFlip.bg, this.crownFlip.text];
    this.crownObjects.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
  }

  private crownPress(kind: 'collect' | 'flip'): void {
    if (this.crownLocked || this.destroyed) return;
    this.setCrownLocked(true); // one action per prompt; the scene re-enables after resolving
    if (kind === 'collect') this.callbacks.onCollect(this.crownRoundId);
    else this.callbacks.onFlip(this.crownRoundId);
  }

  private setCrownLocked(locked: boolean): void {
    this.crownLocked = locked;
    [this.crownCollect, this.crownFlip].forEach((b) => { b.bg.setAlpha(locked ? 0.45 : 1); b.text.setAlpha(locked ? 0.6 : 1); });
  }

  /**
   * Shows (or refreshes) the Crown decision. Input handlers are bound once at build time, so
   * repeated calls never accumulate listeners. COLLECT is the primary/default action.
   * @param roundId Round the decision belongs to.
   * @param amountMilli Amount at risk.
   * @param flipsWon Flips won so far in this chain.
   * @example ui.showCrown(roundId, 20000, 0);
   */
  public showCrown(roundId: number, amountMilli: number, flipsWon: number): void {
    this.crownRoundId = roundId;
    this.crownAmount.setText(formatCredits(amountMilli));
    this.crownCollect.text.setText(`COLLECT ${formatCredits(amountMilli)}`);
    this.crownInfo.setText(flipsWon > 0 ? `Flips won: ${flipsWon}. Flip again: 50% double, 50% lose it all. Collect keeps this amount.` : 'Flip: 50% double, 50% lose it all.\nCollect keeps this amount.');
    this.crownObjects.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(true));
    this.crownCoin.setDisplaySize(64, 64).setAngle(0);
    this.setCrownLocked(false);
  }

  /**
   * Animates the coin then reveals a resolved flip. Outcome already decided by Logic.
   * @param won Whether the flip doubled.
   * @param amountMilli New amount (0 on loss).
   * @param onRevealed Called once when the result becomes visible (audio cue).
   * @param then Called once after the reveal hold.
   * @example ui.revealCrownFlip(true, 40000, () => cue(), () => next());
   */
  public revealCrownFlip(won: boolean, amountMilli: number, onRevealed: () => void, then: () => void): void {
    const token = this.playbackToken;
    const half = INFERNO_TIMING.crownFlip / 4;
    const reveal = () => {
      onRevealed();
      this.crownAmount.setText(formatCredits(amountMilli));
      this.crownInfo.setText(won ? 'Doubled.' : 'Lost. This spin returns 0.');
      this.wait(token, INFERNO_TIMING.crownFlip, then);
    };
    if (this.settings.reducedMotion) { reveal(); return; }
    this.tween(token, { targets: this.crownCoin, scaleX: 0, duration: half, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' }, () => { this.crownCoin.setDisplaySize(64, 64); reveal(); });
  }

  /** Hides the Crown decision. @example ui.hideCrown(); */
  public hideCrown(): void {
    this.setCrownLocked(true);
    this.crownObjects.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
  }

  // ═══ Settings ════════════════════════════════════════════════════════════════════════

  private buildSettings(): void {
    const s = this.scene;
    const pw = WINDOW_W - 24; const ph = 700; const px = W / 2 - pw / 2; const py = 78;
    const shade = s.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72).setDepth(D_OVERLAY).setInteractive();
    const panel = s.add.graphics().setDepth(D_OVERLAY);
    panel.fillStyle(C_PANEL, 1).fillRoundedRect(px, py, pw, ph, 16).lineStyle(1, C_SHELL_LINE, 1).strokeRoundedRect(px, py, pw, ph, 16);
    const title = s.add.text(px + 20, py + 28, 'SETTINGS', { fontFamily: FONT_PRIMARY, fontSize: FONT_SIZE_BASE, color: STR_TEXT, fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(D_OVERLAY).setLetterSpacing(1.5);
    const close = drawButton(s, px + pw - 20 - 22, py + 28, ICON_BTN, ICON_BTN, '✕', 'secondary', D_OVERLAY + 1);
    close.bg.on('pointerup', () => this.closeSettings());
    const objs: Phaser.GameObjects.GameObject[] = [shade, panel, title, close.bg, close.text];
    const row = (i: number, label: string, onUp: () => void): Button => {
      const y = py + 82 + i * 56;
      objs.push(s.add.text(px + 20, y, label, { fontFamily: FONT_PRIMARY, fontSize: FONT_SIZE_BASE, color: STR_TEXT }).setOrigin(0, 0.5).setDepth(D_OVERLAY));
      const b = drawButton(s, px + pw - 20 - 60, y, 120, MIN_TOUCH, '', 'secondary', D_OVERLAY + 1);
      b.bg.on('pointerup', onUp);
      objs.push(b.bg, b.text);
      return b;
    };
    const cycle = (v: number) => (v + 1) % 4;
    const music = row(0, 'Music', () => this.updateSettings({ music: cycle(this.settings.music) }));
    const sfx = row(1, 'Sound effects', () => this.updateSettings({ sfx: cycle(this.settings.sfx) }));
    const motion = row(2, 'Reduced motion', () => this.updateSettings({ reducedMotion: !this.settings.reducedMotion }));
    const quick = row(3, 'Quick spin', () => this.updateSettings({ quickSpin: !this.settings.quickSpin }));
    const reset = drawButton(s, W / 2, py + 82 + 4 * 56, pw - 40, MIN_TOUCH, 'RESET DEMO CREDITS', 'secondary', D_OVERLAY + 1);
    reset.bg.on('pointerup', () => this.callbacks.onResetCredits());
    objs.push(reset.bg, reset.text);
    const rules = s.add.text(px + 20, py + 82 + 4 * 56 + 40,
      'HOW IT PLAYS\n' +
      '• 3+ matching symbols touching up, down, left or right pay. Diagonals do not connect.\n' +
      '• WILD joins any symbol cluster. Paying symbols burn away; the rest fall and new ones drop in.\n' +
      '• Every cascade adds 1 heat. At 5 heat the next spin lands all WILD (current rules: an all-WILD board has no paying cluster).\n' +
      '• 3 SCATTER after a cascade award 5 free spins at the same stake.\n' +
      '• Crown Flip is optional: 50/50 double or nothing. Collect is the default.\n' +
      '• Tap the board to speed up. Outcomes are decided before animation.',
      { fontFamily: FONT_PRIMARY, fontSize: FONT_SIZE_XS, color: STR_NEUTRAL, wordWrap: { width: pw - 40 }, lineSpacing: 3 }).setOrigin(0, 0).setDepth(D_OVERLAY);
    objs.push(rules);
    this.settingsObjects = objs;
    this.settingsButtons = { music, sfx, motion, quick, reset };
    this.refreshSettingsLabels();
    objs.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
  }

  private refreshSettingsLabels(): void {
    if (!this.settingsButtons) return;
    const lvl = ['OFF', 'LOW', 'MEDIUM', 'HIGH'];
    this.settingsButtons.music.text.setText(lvl[this.settings.music] ?? 'OFF');
    this.settingsButtons.sfx.text.setText(lvl[this.settings.sfx] ?? 'OFF');
    this.settingsButtons.motion.text.setText(this.settings.reducedMotion ? 'ON' : 'OFF');
    this.settingsButtons.quick.text.setText(this.settings.quickSpin ? 'ON' : 'OFF');
  }

  private updateSettings(patch: Partial<InfernoSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.refreshSettingsLabels();
    this.applySpeed();
    this.callbacks.onSettingsChanged({ ...this.settings });
  }

  /**
   * Opens the settings panel (only while no round is open).
   * @example ui.openSettings();
   */
  public openSettings(): void {
    if (this.controlsLocked) return;
    this.settingsObjects.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(true));
  }

  /** Closes the settings panel. @example ui.closeSettings(); */
  public closeSettings(): void {
    this.settingsObjects.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
  }

  /** @returns Whether a modal (settings or crown) is visible. @example ui.isModalOpen(); */
  public isModalOpen(): boolean {
    return (this.settingsObjects[0] as unknown as Phaser.GameObjects.Components.Visible | undefined)?.visible === true
      || (this.crownObjects[0] as unknown as Phaser.GameObjects.Components.Visible | undefined)?.visible === true;
  }

  /**
   * Counts presentation resources owned by this UI (harness diagnostics only).
   * @returns Counts of tweens, timers and live particles.
   * @example ui.getResourceCounts();
   */
  public getResourceCounts(): { tweens: number; timers: number; particles: number } {
    return { tweens: this.scene.tweens.getTweens().length, timers: this.timers.length, particles: this.emitter?.getAliveParticleCount() ?? 0 };
  }

  /**
   * Cancels playback, stops tweens/timers and destroys owned emitter. Scene shutdown destroys the
   * display list; this makes sure no stale callback or particle outlives the UI.
   * @example ui.destroy();
   */
  public destroy(): void {
    if (this.destroyed) return;
    this.cancelPlayback();
    this.destroyed = true;
    this.countTween?.stop();
    this.scene.tweens.killAll();
    this.scene.tweens.timeScale = 1;
    this.scene.time.timeScale = 1;
    this.emitter?.destroy();
    this.emitter = null;
  }
}

// ═══ Deterministic code-drawn art (Canvas 2D) ═══════════════════════════════════════════

const TILE_STYLE: Record<InfernoSymbol, { top: string; bottom: string; edge: string }> = {
  EMBER: { top: '#4a2016', bottom: '#2a120d', edge: '#a8452a' },
  FLAME: { top: '#47301a', bottom: '#2a1a0e', edge: '#b07a33' },
  COAL: { top: '#2a2e35', bottom: '#181b20', edge: '#4d5562' },
  ASH: { top: '#3a3936', bottom: '#24231f', edge: '#77736b' },
  SMOKE: { top: '#26303a', bottom: '#171d24', edge: '#4f6272' },
  WILD: { top: '#4a3f22', bottom: '#2b2413', edge: STR_GOLD },
  SCATTER: { top: '#163a3c', bottom: '#0d2224', edge: '#3fb6b0' },
};

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws one symbol tile (background + icon) into a `size`² area at the origin. */
function drawSymbolTile(ctx: CanvasRenderingContext2D, sym: InfernoSymbol, size: number): void {
  const st = TILE_STYLE[sym];
  const inset = size * 0.03; const r = size * 0.12;
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, st.top); g.addColorStop(1, st.bottom);
  roundRectPath(ctx, inset, inset, size - inset * 2, size - inset * 2, r);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = size * 0.02; ctx.strokeStyle = st.edge; ctx.stroke();
  // single thin inner top highlight (no tab-like sheen block)
  ctx.beginPath(); ctx.moveTo(inset + r, inset + size * 0.025); ctx.lineTo(size - inset - r, inset + size * 0.025);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = size * 0.012; ctx.stroke();
  const cx = size / 2; const cy = size / 2;
  const u = size / 100;
  ctx.save();
  switch (sym) {
    case 'EMBER': { // round glowing ember with cracks — circle silhouette
      const rg = ctx.createRadialGradient(cx - 6 * u, cy - 8 * u, 4 * u, cx, cy, 30 * u);
      rg.addColorStop(0, '#ffe3a6'); rg.addColorStop(0.45, '#ff7a2a'); rg.addColorStop(1, '#8c240f');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, 30 * u, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4a1209'; ctx.lineWidth = 3 * u; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 18 * u, cy + 4 * u); ctx.lineTo(cx - 4 * u, cy - 2 * u); ctx.lineTo(cx + 6 * u, cy + 12 * u);
      ctx.moveTo(cx - 4 * u, cy - 2 * u); ctx.lineTo(cx + 4 * u, cy - 20 * u); ctx.moveTo(cx + 6 * u, cy + 12 * u); ctx.lineTo(cx + 20 * u, cy + 6 * u); ctx.stroke();
      break;
    }
    case 'FLAME': { // tall teardrop flame — pointed silhouette
      const fl = (s: number, col: string) => {
        ctx.fillStyle = col; ctx.beginPath();
        ctx.moveTo(cx, cy - 36 * u * s);
        ctx.bezierCurveTo(cx + 10 * u * s, cy - 18 * u * s, cx + 28 * u * s, cy - 4 * u * s, cx + 24 * u * s, cy + 16 * u * s);
        ctx.bezierCurveTo(cx + 20 * u * s, cy + 34 * u * s, cx - 20 * u * s, cy + 34 * u * s, cx - 24 * u * s, cy + 16 * u * s);
        ctx.bezierCurveTo(cx - 27 * u * s, cy - 2 * u * s, cx - 8 * u * s, cy - 12 * u * s, cx, cy - 36 * u * s);
        ctx.fill();
      };
      ctx.translate(0, 4 * u); fl(1, '#ff8f2e'); ctx.translate(0, 9 * u); fl(0.6, '#ffd27a'); ctx.translate(0, 6 * u); fl(0.28, '#fff3d6');
      break;
    }
    case 'COAL': { // angular faceted lump — polygon silhouette
      const pts = [[-26, -6], [-12, -26], [14, -24], [28, -2], [20, 22], [-8, 26], [-28, 12]];
      ctx.fillStyle = '#20242a'; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * u, cy + y * u) : ctx.moveTo(cx + x * u, cy + y * u))); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#69737f'; ctx.lineWidth = 2.5 * u; ctx.stroke();
      ctx.fillStyle = '#3a414b'; ctx.beginPath(); ctx.moveTo(cx - 12 * u, cy - 26 * u); ctx.lineTo(cx + 14 * u, cy - 24 * u); ctx.lineTo(cx + 2 * u, cy - 4 * u); ctx.lineTo(cx - 26 * u, cy - 6 * u); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff8a3a'; ctx.beginPath(); ctx.arc(cx + 10 * u, cy + 10 * u, 3 * u, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'ASH': { // flat filled heap with flecks — wide low silhouette
      ctx.fillStyle = '#b8b3aa'; ctx.beginPath(); ctx.moveTo(cx - 32 * u, cy + 20 * u);
      ctx.quadraticCurveTo(cx - 18 * u, cy - 6 * u, cx - 6 * u, cy - 14 * u); ctx.quadraticCurveTo(cx + 4 * u, cy - 22 * u, cx + 14 * u, cy - 8 * u);
      ctx.quadraticCurveTo(cx + 26 * u, cy + 4 * u, cx + 32 * u, cy + 20 * u); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e6e1d8'; ctx.fillRect(cx - 32 * u, cy + 18 * u, 64 * u, 4 * u);
      ctx.fillStyle = '#7d786f'; [[-14, 6], [0, -4], [10, 10], [-4, 12], [18, 14]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(cx + x * u, cy + y * u, 2.2 * u, 0, Math.PI * 2); ctx.fill(); });
      break;
    }
    case 'SMOKE': { // open rising curls (stroke only) — contrasts with ASH's filled heap
      ctx.strokeStyle = '#a9bccb'; ctx.lineWidth = 5 * u; ctx.lineCap = 'round';
      [-14, 0, 14].forEach((dx, i) => {
        ctx.globalAlpha = 1 - i * 0.18; ctx.beginPath(); ctx.moveTo(cx + dx * u, cy + 28 * u);
        ctx.bezierCurveTo(cx + (dx - 12) * u, cy + 10 * u, cx + (dx + 12) * u, cy - 4 * u, cx + dx * u, cy - 18 * u);
        ctx.quadraticCurveTo(cx + (dx - 6) * u, cy - 28 * u, cx + (dx + 4) * u, cy - 32 * u); ctx.stroke();
      });
      ctx.globalAlpha = 1;
      break;
    }
    case 'WILD': { // anvil + hammer mark + label
      ctx.fillStyle = '#1b160c';
      ctx.beginPath(); ctx.moveTo(cx - 30 * u, cy - 14 * u); ctx.lineTo(cx + 22 * u, cy - 14 * u); ctx.quadraticCurveTo(cx + 34 * u, cy - 12 * u, cx + 34 * u, cy - 4 * u);
      ctx.lineTo(cx + 12 * u, cy - 2 * u); ctx.lineTo(cx + 8 * u, cy + 8 * u); ctx.lineTo(cx + 16 * u, cy + 14 * u); ctx.lineTo(cx - 16 * u, cy + 14 * u); ctx.lineTo(cx - 8 * u, cy + 8 * u);
      ctx.lineTo(cx - 12 * u, cy - 2 * u); ctx.lineTo(cx - 30 * u, cy - 6 * u); ctx.closePath(); ctx.fill();
      ctx.fillStyle = STR_GOLD; ctx.fillRect(cx - 26 * u, cy - 13 * u, 46 * u, 3 * u);
      ctx.fillStyle = '#f3dfa5'; ctx.font = `bold ${17 * u}px "Inter", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('WILD', cx, cy + 30 * u);
      ctx.fillStyle = 'rgba(243,223,165,0.9)'; ctx.beginPath(); ctx.moveTo(cx, cy - 36 * u); ctx.lineTo(cx + 4 * u, cy - 26 * u); ctx.lineTo(cx, cy - 22 * u); ctx.lineTo(cx - 4 * u, cy - 26 * u); ctx.closePath(); ctx.fill();
      break;
    }
    case 'SCATTER': { // four-point spark in a ring + label
      ctx.strokeStyle = '#3fb6b0'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(cx, cy - 6 * u, 24 * u, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#d9fffb'; ctx.beginPath();
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4 - Math.PI / 2; const rr = k % 2 === 0 ? 20 * u : 6 * u; const x = cx + Math.cos(a) * rr; const y = cy - 6 * u + Math.sin(a) * rr; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#bff3ef'; ctx.font = `bold ${13 * u}px "Inter", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('SCATTER', cx, cy + 32 * u);
      break;
    }
    default: break;
  }
  ctx.restore();
}

/** Static shell art in world coordinates (header, hood, grate, bottom panel). */
function drawShellArt(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(C_SHELL, 1).fillRect(0, 0, W, WINDOW_Y);
  g.lineStyle(1, C_SHELL_LINE, 1).lineBetween(0, HEADER_H, W, HEADER_H);
  // hood: dark iron band with two rivets lines; heat meter sits on it
  g.fillStyle(0x17120f, 1).fillRoundedRect(WINDOW_X, WINDOW_Y, WINDOW_W, HOOD_H, { tl: WINDOW_R, tr: WINDOW_R, bl: 0, br: 0 });
  g.fillStyle(C_RIB, 1).fillRect(WINDOW_X, WINDOW_Y + HOOD_H - 4, WINDOW_W, 4);
  g.fillStyle(0x4a4f58, 1);
  for (let x = WINDOW_X + 22; x < WINDOW_X + WINDOW_W - 10; x += 38) g.fillCircle(x, WINDOW_Y + HOOD_H - 2, 1.5);
  // grate: iron bars with a warm glow showing between them (the "small warm glow below the board")
  const grateH = WINDOW_Y + WINDOW_H - GRATE_Y;
  g.fillStyle(0x1a1310, 1).fillRoundedRect(WINDOW_X, GRATE_Y, WINDOW_W, grateH, { tl: 0, tr: 0, bl: WINDOW_R, br: WINDOW_R });
  for (let i = 0; i < 9; i++) {
    const gx = BOARD_X + 6 + i * (BOARD_W - 12) / 8;
    g.fillStyle(0xff7a33, 0.18).fillRect(gx - 9, GRATE_Y + 12, 18, grateH - 22);
    g.fillStyle(0xffa24d, 0.22).fillRect(gx - 4, GRATE_Y + 16, 8, grateH - 30);
  }
  g.fillStyle(C_RIB, 1).fillRect(WINDOW_X, GRATE_Y, WINDOW_W, 4);
  // bottom panel
  g.fillStyle(C_PANEL, 1).fillRoundedRect(WINDOW_X, PANEL_Y - 6, WINDOW_W, PANEL_H, 16);
  g.lineStyle(1, C_SHELL_LINE, 1).strokeRoundedRect(WINDOW_X, PANEL_Y - 6, WINDOW_W, PANEL_H, 16);
}

/** Draws the Crown coin: champagne disc with a simple three-point crown. */
function drawCrownCoin(ctx: CanvasRenderingContext2D, size: number): void {
  const c = size / 2; const u = size / 100;
  const g = ctx.createRadialGradient(c - 10 * u, c - 12 * u, 4 * u, c, c, 46 * u);
  g.addColorStop(0, '#f3dfa5'); g.addColorStop(0.6, STR_GOLD); g.addColorStop(1, '#7a6327');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, 46 * u, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#5c4a1c'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(c, c, 38 * u, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#3d3112'; ctx.beginPath();
  ctx.moveTo(c - 22 * u, c + 14 * u); ctx.lineTo(c - 24 * u, c - 12 * u); ctx.lineTo(c - 10 * u, c); ctx.lineTo(c, c - 20 * u);
  ctx.lineTo(c + 10 * u, c); ctx.lineTo(c + 24 * u, c - 12 * u); ctx.lineTo(c + 22 * u, c + 14 * u); ctx.closePath(); ctx.fill();
}

/** Draws the cached forge window: warm charcoal gradient, brick courses, ribs, sockets, glow. */
function drawForgeBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const toCss = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  roundRectPath(ctx, 0, 0, w, h, WINDOW_R);
  ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, toCss(C_FORGE_TOP)); g.addColorStop(1, toCss(C_FORGE_BOTTOM));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // brick courses (two tones) — simple deliberate shapes, sparse
  const bh = 18; const bw = 44;
  for (let y = 0, row = 0; y < h; y += bh, row++) {
    for (let x = (row % 2) * -bw / 2; x < w; x += bw) {
      ctx.fillStyle = (row + Math.floor(x / bw)) % 3 === 0 ? toCss(C_BRICK_LINE) : toCss(C_BRICK);
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
    }
  }
  ctx.globalAlpha = 1;
  // furnace arch silhouette behind the board
  const bx = BOARD_X - WINDOW_X; const by = BOARD_Y - WINDOW_Y;
  ctx.fillStyle = '#140f0c';
  ctx.beginPath(); ctx.moveTo(bx - 10, h); ctx.lineTo(bx - 10, by + 40); ctx.quadraticCurveTo(bx - 10, by - 22, w / 2, by - 26); ctx.quadraticCurveTo(bx + BOARD_W + 10, by - 22, bx + BOARD_W + 10, by + 40); ctx.lineTo(bx + BOARD_W + 10, h); ctx.closePath(); ctx.fill();
  // straight structural ribs at the sides
  ctx.fillStyle = toCss(C_RIB);
  [8, w - 14].forEach((x) => ctx.fillRect(x, 0, 6, h));
  // warm glow rising from below the board
  const glow = ctx.createRadialGradient(w / 2, h + 30, 10, w / 2, h + 30, h * 0.75);
  glow.addColorStop(0, 'rgba(255,128,48,0.45)'); glow.addColorStop(0.5, 'rgba(255,110,40,0.12)'); glow.addColorStop(1, 'rgba(255,100,30,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  // empty sockets for each cell (visible when a symbol is removed)
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    roundRectPath(ctx, bx + c * STEP + 2, by + r * STEP + 2, CELL - 4, CELL - 4, 12);
    ctx.fillStyle = toCss(C_SOCKET); ctx.fill();
    ctx.strokeStyle = 'rgba(255,140,60,0.10)'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();
  roundRectPath(ctx, 0.5, 0.5, w - 1, h - 1, WINDOW_R);
  ctx.strokeStyle = toCss(C_SHELL_LINE); ctx.lineWidth = 1; ctx.stroke();
}
