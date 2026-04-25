import * as Phaser from 'phaser';
import type { BallDropConfig, BallDropState } from './BallDropLogic';
import {
  BOARD_MARGIN_X,
  BOARD_TOP_Y,
  SLOT_COUNT,
  SLOT_HEIGHT,
  SLOT_MULTIPLIERS,
  createBallDropState,
  spawnBall,
  tickBallDrop,
} from './BallDropLogic';
import {
  COLOR_BG,
  COLOR_BORDER,
  COLOR_GOLD,
  STR_GOLD,
  STR_TEXT,
  STR_MUTED,
  FONT_SIZE_XS,
  FONT_SIZE_SM,
  FONT_SIZE_LG,
  FONT_SIZE_2XL,
  TEXT_STYLE_LABEL,
  TEXT_STYLE_BODY,
  TEXT_STYLE_SEMIBOLD,
  drawButton
} from '../shared/ui/UITheme';

// ─── Palette (Game Specific) ──────────────────────────────────────────────────

const PEG_BASE = COLOR_BORDER; // Used for unlit pegs
const PEG_LIT  = COLOR_GOLD;   // Used for lit pegs

/** Slot accent colours — edge warm, centre cool. */
const SLOT_COLORS_HEX: number[] = [
  0xef4444, 0xf97316, 0xeab308, 0x22c55e, 0x06b6d4, // Red, Orange, Yellow, Green, Cyan
  0x22c55e, 0xeab308, 0xf97316, 0xef4444,           // Green, Yellow, Orange, Red
];
const SLOT_COLORS_STR: string[] = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#22c55e', '#eab308', '#f97316', '#ef4444',
];

// ─── Particle ────────────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  color: number;
  life: number;  // 0–1
}

// ─── BallDropUI ──────────────────────────────────────────────────────────────

export class BallDropUI {
  private scene:  Phaser.Scene;
  private config: BallDropConfig;

  // Rendering layers
  private bgGraphics:   Phaser.GameObjects.Graphics | null = null;
  private pegGraphics:  Phaser.GameObjects.Graphics | null = null;
  private slotGraphics: Phaser.GameObjects.Graphics | null = null;
  private ballGraphics: Phaser.GameObjects.Graphics | null = null;
  private fxGraphics:   Phaser.GameObjects.Graphics | null = null;

  // HUD
  private scoreText:    Phaser.GameObjects.Text | null = null;
  private ballsText:    Phaser.GameObjects.Text | null = null;
  private lastText:     Phaser.GameObjects.Text | null = null;
  private aimLine:      Phaser.GameObjects.Graphics | null = null;
  private statusText:   Phaser.GameObjects.Text | null = null;
  private dropButtonBg: Phaser.GameObjects.Graphics | null = null;
  private dropLabel:    Phaser.GameObjects.Text | null = null;
  private gameOverButtonBg: Phaser.GameObjects.Graphics | null = null;
  private gameOverButtonLabel: Phaser.GameObjects.Text | null = null;

  // Physics
  private state:       BallDropState | null = null;
  private tickTimer:   Phaser.Time.TimerEvent | null = null;
  private particles:   Particle[] = [];

  // Input
  private nudgeLeft  = false;
  private nudgeRight = false;

  constructor(scene: Phaser.Scene, config: BallDropConfig) {
    this.scene  = scene;
    this.config = config;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Starts a new Ball Drop game.
   *
   * @param bet - Wager in credits per ball.
   *
   * @example
   * ui.start(10);
   */
  public start(bet: number): void {
    this.cleanup();

    this.state = createBallDropState(bet, this.config);

    this.bgGraphics   = this.scene.add.graphics().setDepth(0);
    this.pegGraphics  = this.scene.add.graphics().setDepth(2);
    this.slotGraphics = this.scene.add.graphics().setDepth(1);
    this.ballGraphics = this.scene.add.graphics().setDepth(5);
    this.fxGraphics   = this.scene.add.graphics().setDepth(6);
    this.aimLine      = this.scene.add.graphics().setDepth(4);

    this.drawBackground();
    this.drawSlots();
    this.buildHUD();
    this.registerInput();

    this.tickTimer = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: this.onTick,
      callbackScope: this,
    });
  }

  /**
   * Destroys all Phaser objects and stops the game loop.
   *
   * @example
   * ui.cleanup();
   */
  public cleanup(): void {
    this.tickTimer?.remove();
    this.tickTimer = null;

    this.bgGraphics?.destroy();
    this.pegGraphics?.destroy();
    this.slotGraphics?.destroy();
    this.ballGraphics?.destroy();
    this.fxGraphics?.destroy();
    this.aimLine?.destroy();
    this.scoreText?.destroy();
    this.ballsText?.destroy();
    this.lastText?.destroy();
    this.statusText?.destroy();
    this.dropButtonBg?.destroy();
    this.dropLabel?.destroy();
    this.gameOverButtonBg?.destroy();
    this.gameOverButtonLabel?.destroy();

    this.bgGraphics = this.pegGraphics = this.slotGraphics =
    this.ballGraphics = this.fxGraphics = this.aimLine = null;
    this.scoreText = this.ballsText = this.lastText = this.statusText =
    this.dropButtonBg = this.dropLabel = this.gameOverButtonBg = this.gameOverButtonLabel = null;

    this.state    = null;
    this.particles = [];
  }

  // ─── Build ─────────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const g  = this.bgGraphics!;
    const bw = this.config.boardWidth  ?? 390;
    const bh = this.config.boardHeight ?? 844;

    g.fillStyle(COLOR_BG, 1);
    g.fillRect(0, 0, bw, bh);

    // Subtle vertical lane guides (behind pegs)
    g.lineStyle(0.5, COLOR_BORDER, 0.6);
    const slotW = (bw - BOARD_MARGIN_X * 2) / SLOT_COUNT;
    for (let i = 1; i < SLOT_COUNT; i++) {
      const lx = BOARD_MARGIN_X + i * slotW;
      g.beginPath();
      g.moveTo(lx, BOARD_TOP_Y);
      g.lineTo(lx, bh - SLOT_HEIGHT);
      g.strokePath();
    }
  }

  private drawSlots(): void {
    const g  = this.slotGraphics!;
    const bw = this.config.boardWidth  ?? 390;
    const bh = this.config.boardHeight ?? 700;

    g.clear();

    const slotW = (bw - BOARD_MARGIN_X * 2) / SLOT_COUNT;
    const slotY = bh - SLOT_HEIGHT;

    for (let i = 0; i < SLOT_COUNT; i++) {
      const sx  = BOARD_MARGIN_X + i * slotW;
      const col = SLOT_COLORS_HEX[i];

      // Slot background tint
      g.fillStyle(col, 0.08); // Reduced opacity
      g.fillRect(sx + 1, slotY, slotW - 2, SLOT_HEIGHT);

      // Top border accent
      g.fillStyle(col, 1);
      g.fillRect(sx + 1, slotY, slotW - 2, 2); // Thinner accent line

      // Multiplier label
      this.scene.add
        .text(sx + slotW / 2, slotY + SLOT_HEIGHT / 2 + 4, `×${SLOT_MULTIPLIERS[i]}`, {
          ...TEXT_STYLE_LABEL, // Use theme label style
          fontSize:   FONT_SIZE_XS,
          color:      STR_TEXT, // Make multiplier text primary color
        })
        .setOrigin(0.5, 0.5)
        .setDepth(3);
    }
  }

  private buildHUD(): void {
    const bw = this.config.boardWidth  ?? 390;
    const bh = this.config.boardHeight ?? 700;

    // Score
    this.scoreText = this.scene.add
      .text(BOARD_MARGIN_X + 12, 18, 'SCORE  0', {
        ...TEXT_STYLE_SEMIBOLD,
        fontSize: FONT_SIZE_LG,
        color: STR_GOLD,
      })
      .setDepth(10);

    // Balls remaining
    this.ballsText = this.scene.add
      .text(bw - BOARD_MARGIN_X - 12, 18, `BALLS  ${this.state?.ballsRemaining ?? 0}`, {
        ...TEXT_STYLE_BODY,
        fontSize: FONT_SIZE_LG,
        color: STR_MUTED,
      })
      .setOrigin(1, 0)
      .setDepth(10);

    // Last result
    this.lastText = this.scene.add
      .text(bw / 2, 20, '', {
        ...TEXT_STYLE_LABEL,
        fontSize: FONT_SIZE_SM,
        color: STR_MUTED,
      })
      .setOrigin(0.5, 0)
      .setDepth(10);

    // Status / big message
    this.statusText = this.scene.add
      .text(bw / 2, bh * 0.42, '', {
        ...TEXT_STYLE_SEMIBOLD,
        fontSize: FONT_SIZE_2XL,
        color: STR_GOLD,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(12);

    // Drop button
    const { bg, text } = drawButton(
      this.scene,
      bw / 2, BOARD_TOP_Y - 30,
      140, 38,
      'DROP BALL',
      'primary',
      10
    );
    this.dropButtonBg = bg;
    this.dropLabel    = text;
    this.dropButtonBg.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleDrop());

    // Home
    // Home navigation handled by scene nav bar
  }

  private registerInput(): void {
    const bw = this.config.boardWidth ?? 390;

    // Mouse/touch: move aim line + tap to drop
    this.scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.state && !this.state.activeBall) {
        const clampedX = Phaser.Math.Clamp(
          p.x,
          BOARD_MARGIN_X + (this.config.ballRadius ?? 8),
          bw - BOARD_MARGIN_X - (this.config.ballRadius ?? 8)
        );
        this.state.dropX = clampedX;
      }
    });

    // Keyboard nudge
    const kb = this.scene.input.keyboard;
    if (kb) {
      kb.on('keydown-LEFT',  () => { this.nudgeLeft  = true; });
      kb.on('keyup-LEFT',    () => { this.nudgeLeft  = false; });
      kb.on('keydown-A',     () => { this.nudgeLeft  = true; });
      kb.on('keyup-A',       () => { this.nudgeLeft  = false; });
      kb.on('keydown-RIGHT', () => { this.nudgeRight = true; });
      kb.on('keyup-RIGHT',   () => { this.nudgeRight = false; });
      kb.on('keydown-D',     () => { this.nudgeRight = true; });
      kb.on('keyup-D',       () => { this.nudgeRight = false; });
      kb.on('keydown-SPACE', () => { this.handleDrop(); });
    }
  }

  // ─── Tick ──────────────────────────────────────────────────────────────────

  private onTick(): void {
    if (!this.state) return;

    const nudge = this.nudgeLeft ? 'left' : this.nudgeRight ? 'right' : 'none';

    const prevLanded = this.state.activeBall?.justLanded ?? false;

    tickBallDrop(this.state, nudge, this.config);

    // Ball just landed this tick?
    if (!prevLanded && this.state.activeBall?.justLanded) {
      this.onBallLanded();
    }

    // After justLanded tick clears activeBall
    this.renderAll();
    this.updateHUD();

    if (this.state.gameOver && !this.state.activeBall) {
      this.tickTimer?.remove();
      this.tickTimer = null;
      this.scene.time.delayedCall(600, () => this.showGameOver());
    }
  }

  private onBallLanded(): void {
    if (!this.state) return;
    const slot   = this.state.lastSlotIndex;
    const col    = SLOT_COLORS_HEX[slot] ?? COLOR_GOLD;

    this.burst(
      BOARD_MARGIN_X + ((this.config.boardWidth ?? 390) - BOARD_MARGIN_X * 2) / SLOT_COUNT * slot +
      ((this.config.boardWidth ?? 390) - BOARD_MARGIN_X * 2) / SLOT_COUNT / 2,
      (this.config.boardHeight ?? 700) - SLOT_HEIGHT,
      col, 24
    );

    const mult = SLOT_MULTIPLIERS[slot];
    const msg  = mult >= 5  ? '🎉 JACKPOT!' :
                 mult >= 2  ? '🔥  NICE!'   :
                 mult >= 1  ? '✨  GOOD!'   : '';
    if (msg) this.flashStatus(msg, 900);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  private renderAll(): void {
    this.renderPegs();
    this.renderAimLine();
    this.renderBall();
    this.renderParticles();
  }

  private renderPegs(): void {
    const g = this.pegGraphics!;
    g.clear();

    for (const peg of this.state!.pegs) {
      const lit   = peg.litLevel;
      const color = lit > 0.05
        ? Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.IntegerToColor(PEG_BASE),
            Phaser.Display.Color.IntegerToColor(PEG_LIT),
            100, Math.floor(lit * 100)
          )
        : null;

      const fillColor = color
        ? Phaser.Display.Color.GetColor(color.r, color.g, color.b)
        : PEG_BASE;

      g.fillStyle(fillColor, 1);
      g.fillCircle(peg.x, peg.y, peg.radius + (lit > 0.05 ? 1 : 0)); // Smaller lit effect
    }
  }

  private renderAimLine(): void {
    const g  = this.aimLine!;
    g.clear();
    if (!this.state || this.state.activeBall) return;

    const dropX = this.state.dropX;
    const br    = this.config.ballRadius ?? 8;

    g.lineStyle(1.5, COLOR_GOLD, 0.4); // Thicker, more opaque line
    g.beginPath();
    g.moveTo(dropX, BOARD_TOP_Y - br - 4);
    g.lineTo(dropX, BOARD_TOP_Y + 24);
    g.strokePath();

    // Ghost ball
    g.fillStyle(COLOR_GOLD, 0.15); // Lighter, more transparent
    g.fillCircle(dropX, BOARD_TOP_Y - br - 6, br);
    g.lineStyle(1, COLOR_GOLD, 0.35); // Thinner outline
    g.strokeCircle(dropX, BOARD_TOP_Y - br - 6, br);
  }

  private renderBall(): void {
    const g    = this.ballGraphics!;
    const ball = this.state?.activeBall;
    g.clear();
    if (!ball) return;

    // Trail
    for (let i = 0; i < ball.trailX.length; i++) {
      const alpha = (i / ball.trailX.length) * 0.2; // Softer trail
      const r     = (this.config.ballRadius ?? 8) * (i / ball.trailX.length) * 0.7; // Smaller trail dots
      g.fillStyle(COLOR_GOLD, alpha); // Gold trail
      g.fillCircle(ball.trailX[i], ball.trailY[i], r);
    }

    // Ball body (radial gradient faked with two filled circles)
    const br = this.config.ballRadius ?? 8;
    g.fillStyle(COLOR_GOLD, 1); // Solid gold base
    g.fillCircle(ball.x, ball.y, br);
    g.fillStyle(0xf8d773, 1); // Lighter gold highlight
    g.fillCircle(ball.x - 1, ball.y - 2, br * 0.72);
    g.fillStyle(0xffe8a0, 1); // Even lighter highlight
    g.fillCircle(ball.x - 2, ball.y - 3, br * 0.38);
    // Shine
    g.fillStyle(0xffffff, 0.45); // Brighter shine
    g.fillCircle(ball.x - br * 0.32, ball.y - br * 0.36, br * 0.28);
  }

  private renderParticles(): void {
    const g = this.fxGraphics!;
    g.clear();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.12;
      p.life -= 0.028;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }

      const alpha = Math.min(1, p.life * 2);
      g.fillStyle(p.color, alpha);
      g.fillCircle(p.x, p.y, p.r * p.life + 0.5);
    }
  }

  // ─── HUD helpers ───────────────────────────────────────────────────────────

  private updateHUD(): void {
    if (!this.state) return;
    this.scoreText?.setText(`SCORE  ${Math.floor(this.state.score)}`);
    this.ballsText?.setText(`BALLS  ${this.state.ballsRemaining}`);

    if (this.state.lastSlotIndex >= 0) {
      const mult = SLOT_MULTIPLIERS[this.state.lastSlotIndex];
      const col  = SLOT_COLORS_STR[this.state.lastSlotIndex];
      this.lastText?.setText(`LAST ×${mult}  +${this.state.lastPayout}`)
                    .setColor(col);
    }
  }

  private flashStatus(text: string, durationMs: number): void {
    this.statusText?.setText(text).setAlpha(1);
    this.scene.time.delayedCall(durationMs, () => {
      this.scene.tweens.add({
        targets: this.statusText,
        alpha: 0,
        duration: 300,
      });
    });
  }

  // ─── Particles ─────────────────────────────────────────────────────────────

  /**
   * Spawns a burst of particles at a world position.
   *
   * @param x - World x.
   * @param y - World y.
   * @param color - Phaser integer colour.
   * @param count - Number of particles.
   *
   * @example
   * this.burst(200, 300, 0xffd200, 16);
   */
  private burst(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.4 + Math.random() * 3.2;
      this.particles.push({
        x, y,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed - 1,
        r:     2 + Math.random() * 3,
        color,
        life:  1,
      });
    }
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  private handleDrop(): void {
    if (!this.state || this.state.activeBall || this.state.gameOver) return;
    spawnBall(this.state, this.config);
  }

  private showGameOver(): void {
    const bw = this.config.boardWidth  ?? 390;
    const bh = this.config.boardHeight ?? 844;

    this.statusText
      ?.setText(`GAME OVER\n${Math.floor(this.state?.score ?? 0)} credits`)
      .setAlpha(1);

    const { bg, text } = drawButton(
      this.scene,
      bw / 2, bh * 0.55,
      180, 50,
      'PLAY AGAIN',
      'primary',
      20
    );
    this.gameOverButtonBg = bg;
    this.gameOverButtonLabel = text;

    this.gameOverButtonBg.on('pointerdown', () => { this.cleanup(); this.scene.scene.restart(); });
  }
}
