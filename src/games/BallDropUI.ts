/**
 * @file BallDropUI.ts
 * @purpose Phaser rendering + input for Ball Drop.
 *          Renders pegs, ball with trail, slot zones, particles, and HUD.
 *          Calls BallDropLogic exclusively — no logic lives here.
 * @author Agent 934
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

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

// ─── Palette ──────────────────────────────────────────────────────────────────

const GOLD      = 0xc9a84c;
const GOLD_STR  = '#c9a84c';
const PEG_BASE  = 0x6677aa;
const PEG_LIT   = 0xffd200;

/** Slot accent colours — edge warm, centre cool. */
const SLOT_COLORS_HEX: number[] = [
  0xe74c3c, 0xe67e22, 0xf1c40f, 0x2ecc71, 0x9b59b6,
  0x2ecc71, 0xf1c40f, 0xe67e22, 0xe74c3c,
];
const SLOT_COLORS_STR: string[] = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#9b59b6',
  '#2ecc71', '#f1c40f', '#e67e22', '#e74c3c',
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
  private dropButton:   Phaser.GameObjects.Rectangle | null = null;
  private dropLabel:    Phaser.GameObjects.Text | null = null;
  private homeButton:   Phaser.GameObjects.Container | null = null;

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
    this.dropButton?.destroy();
    this.dropLabel?.destroy();
    this.homeButton?.destroy();

    this.bgGraphics = this.pegGraphics = this.slotGraphics =
    this.ballGraphics = this.fxGraphics = this.aimLine = null;
    this.scoreText = this.ballsText = this.lastText = this.statusText =
    this.dropButton = this.dropLabel = this.homeButton = null;

    this.state    = null;
    this.particles = [];
  }

  // ─── Build ─────────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const g  = this.bgGraphics!;
    const bw = this.config.boardWidth  ?? 390;
    const bh = this.config.boardHeight ?? 844;

    g.fillGradientStyle(0x090910, 0x090910, 0x0f0f1e, 0x0f0f1e, 1);
    g.fillRect(0, 0, bw, bh);

    // Subtle vertical lane guides (behind pegs)
    g.lineStyle(0.5, 0x14142a, 0.6);
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
      g.fillStyle(col, 0.12);
      g.fillRect(sx + 1, slotY, slotW - 2, SLOT_HEIGHT);

      // Top border accent
      g.fillStyle(col, 1);
      g.fillRect(sx + 1, slotY, slotW - 2, 3);

      // Multiplier label
      this.scene.add
        .text(sx + slotW / 2, slotY + SLOT_HEIGHT / 2 + 4, `×${SLOT_MULTIPLIERS[i]}`, {
          fontFamily: 'monospace',
          fontSize:   '11px',
          color:      '#ffffff',
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
      .text(BOARD_MARGIN_X, 12, 'SCORE  0', {
        fontFamily: 'monospace', fontSize: '15px', color: GOLD_STR,
      })
      .setDepth(10);

    // Balls remaining
    this.ballsText = this.scene.add
      .text(bw - BOARD_MARGIN_X, 12, `BALLS  ${this.state?.ballsRemaining ?? 0}`, {
        fontFamily: 'monospace', fontSize: '15px', color: '#888888',
      })
      .setOrigin(1, 0)
      .setDepth(10);

    // Last result
    this.lastText = this.scene.add
      .text(bw / 2, 12, '', {
        fontFamily: 'monospace', fontSize: '13px', color: '#aaaaaa',
      })
      .setOrigin(0.5, 0)
      .setDepth(10);

    // Status / big message
    this.statusText = this.scene.add
      .text(bw / 2, bh * 0.42, '', {
        fontFamily: 'monospace', fontSize: '22px', color: '#ffffff', align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(12);

    // Drop button
    this.dropButton = this.scene.add
      .rectangle(bw / 2, BOARD_TOP_Y - 30, 140, 38, GOLD)
      .setInteractive({ useHandCursor: true })
      .setDepth(10)
      .on('pointerdown', () => this.handleDrop());

    this.dropLabel = this.scene.add
      .text(bw / 2, BOARD_TOP_Y - 30, 'DROP BALL', {
        fontFamily: 'monospace', fontSize: '11px', color: '#0d0d0d',
      })
      .setOrigin(0.5)
      .setDepth(11);

    // Home
    // HOME button — top-left corner, small and unobtrusive
    const homeBg = this.scene.add.graphics();
    homeBg.fillStyle(0x000000, 0.5);
    homeBg.fillRoundedRect(0, 0, 60, 28, 6);
    const homeLabel = this.scene.add.text(30, 14, '‹', {
      fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#c9a84c',
    }).setOrigin(0.5);
    this.homeButton = this.scene.add.container(10, 10, [homeBg, homeLabel])
      .setSize(60, 28).setDepth(20)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.cleanup(); this.scene.scene.start('HomeScene'); });
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
    const col    = SLOT_COLORS_HEX[slot] ?? GOLD;

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
      g.fillCircle(peg.x, peg.y, peg.radius + (lit > 0.05 ? 2 : 0));
    }
  }

  private renderAimLine(): void {
    const g  = this.aimLine!;
    g.clear();
    if (!this.state || this.state.activeBall) return;

    const dropX = this.state.dropX;
    const br    = this.config.ballRadius ?? 8;

    g.lineStyle(1, GOLD, 0.25);
    g.beginPath();
    g.moveTo(dropX, BOARD_TOP_Y - br - 4);
    g.lineTo(dropX, BOARD_TOP_Y + 24);
    g.strokePath();

    // Ghost ball
    g.fillStyle(GOLD, 0.18);
    g.fillCircle(dropX, BOARD_TOP_Y - br - 6, br);
    g.lineStyle(1.5, GOLD, 0.45);
    g.strokeCircle(dropX, BOARD_TOP_Y - br - 6, br);
  }

  private renderBall(): void {
    const g    = this.ballGraphics!;
    const ball = this.state?.activeBall;
    g.clear();
    if (!ball) return;

    // Trail
    for (let i = 0; i < ball.trailX.length; i++) {
      const alpha = (i / ball.trailX.length) * 0.35;
      const r     = (this.config.ballRadius ?? 8) * (i / ball.trailX.length) * 0.8;
      g.fillStyle(0xffa500, alpha);
      g.fillCircle(ball.trailX[i], ball.trailY[i], r);
    }

    // Ball body (radial gradient faked with two filled circles)
    const br = this.config.ballRadius ?? 8;
    g.fillStyle(0xc0392b, 1);
    g.fillCircle(ball.x, ball.y, br);
    g.fillStyle(0xf7971e, 1);
    g.fillCircle(ball.x - 1, ball.y - 2, br * 0.72);
    g.fillStyle(0xffe066, 1);
    g.fillCircle(ball.x - 2, ball.y - 3, br * 0.38);
    // Shine
    g.fillStyle(0xffffff, 0.38);
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

    const btn = this.scene.add
      .rectangle(bw / 2, bh * 0.55, 180, 50, GOLD)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    this.scene.add
      .text(bw / 2, bh * 0.55, 'PLAY AGAIN', {
        fontFamily: 'monospace', fontSize: '14px', color: '#0d0d0d',
      })
      .setOrigin(0.5)
      .setDepth(21);

    btn.on('pointerdown', () => { this.cleanup(); this.scene.scene.restart(); });
  }
}
