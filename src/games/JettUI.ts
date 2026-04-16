/**
 * @file JettUI.ts
 * @purpose Phaser rendering for Jett — space background, stick figure with jetpack,
 *          individual asteroid rendering with rotation, endless vertical scroll,
 *          combustion FX, HUD.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import type { JettConfig } from './JettLogic';
import { createJettState, tickJett, cashOutJett } from './JettLogic';

const GOLD     = 0xc9a84c;
const GOLD_STR = '#c9a84c';

export class JettUI {
  private scene:  Phaser.Scene;
  private config: JettConfig;

  // Player parts (screen-space, fixed Y)
  private playerHead: Phaser.GameObjects.Arc       | null = null;
  private playerBody: Phaser.GameObjects.Rectangle | null = null;
  private playerPack: Phaser.GameObjects.Rectangle | null = null;
  private playerScreenY = 0;

  // Background
  private bgGraphics: Phaser.GameObjects.Graphics | null = null;
  private stars: { x: number; y: number; r: number; phase: number }[] = [];
  private bgPlanet:  Phaser.GameObjects.Arc | null = null;
  private bgPlanet2: Phaser.GameObjects.Arc | null = null;

  // Asteroid graphics pool — keyed by asteroid id
  private asteroidGraphics: Map<number, Phaser.GameObjects.Graphics> = new Map();

  // Flame
  private flameGraphics: Phaser.GameObjects.Graphics | null = null;

  // HUD
  private multiplierText: Phaser.GameObjects.Text      | null = null;
  private altitudeText:   Phaser.GameObjects.Text      | null = null;
  private statusText:     Phaser.GameObjects.Text      | null = null;
  private cashOutButton:  Phaser.GameObjects.Rectangle | null = null;
  private cashOutLabel:   Phaser.GameObjects.Text      | null = null;
  private homeButton:     Phaser.GameObjects.Container | null = null;

  private pointerX  = 0;
  private tickTimer: Phaser.Time.TimerEvent | null = null;
  private state: ReturnType<typeof createJettState> | null = null;

  constructor(scene: Phaser.Scene, config: JettConfig) {
    this.scene   = scene;
    this.config  = config;
    this.pointerX     = config.worldWidth / 2;
    this.playerScreenY = config.screenHeight * 0.62;
  }

  public start(bet: number): void {
    this.cleanup();
    this.state = createJettState(bet, this.config);
    this.buildBackground();
    this.buildPlayer();
    this.buildHUD();
    this.registerInput();
    this.tickTimer = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: this.onTick,
      callbackScope: this,
    });
  }

  public cleanup(): void {
    this.tickTimer?.remove();
    this.tickTimer = null;
    this.playerHead?.destroy();
    this.playerBody?.destroy();
    this.playerPack?.destroy();
    this.bgGraphics?.destroy();
    this.bgPlanet?.destroy();
    this.bgPlanet2?.destroy();
    this.flameGraphics?.destroy();
    for (const g of this.asteroidGraphics.values()) g.destroy();
    this.asteroidGraphics.clear();
    this.multiplierText?.destroy();
    this.altitudeText?.destroy();
    this.statusText?.destroy();
    this.cashOutButton?.destroy();
    this.cashOutLabel?.destroy();
    this.homeButton?.destroy();
    this.state = null;
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  private buildBackground(): void {
    const { worldWidth, screenHeight } = this.config;
    this.bgGraphics = this.scene.add.graphics();

    for (let i = 0; i < 130; i++) {
      this.stars.push({
        x:     Math.random() * worldWidth,
        y:     Math.random() * screenHeight,
        r:     Math.random() < 0.15 ? 1.8 : 0.8,
        phase: Math.random() * Math.PI * 2,
      });
    }

    this.bgPlanet = this.scene.add.arc(
      worldWidth * 0.78, screenHeight * 0.18, 42, 0, 360, false, 0x2244aa, 0.45
    );
    this.bgPlanet2 = this.scene.add.arc(
      worldWidth * 0.14, screenHeight * 0.38, 22, 0, 360, false, 0x773322, 0.4
    );
  }

  private buildPlayer(): void {
    const x = this.config.worldWidth / 2;
    const y = this.playerScreenY;
    this.playerPack = this.scene.add.rectangle(x + 8, y + 2, 10, 22, 0x4455aa).setDepth(5);
    this.playerBody = this.scene.add.rectangle(x, y,      8, 22, GOLD).setDepth(5);
    this.playerHead = this.scene.add.arc(x, y - 17, 7, 0, 360, false, GOLD).setDepth(5);
    this.flameGraphics = this.scene.add.graphics().setDepth(4);
  }

  private buildHUD(): void {
    const { worldWidth, screenHeight } = this.config;

    this.multiplierText = this.scene.add
      .text(16, 16, 'x1.00', { fontFamily: 'monospace', fontSize: '24px', color: GOLD_STR })
      .setDepth(10);

    this.altitudeText = this.scene.add
      .text(16, 48, 'ALT: 0m', { fontFamily: 'monospace', fontSize: '13px', color: '#888888' })
      .setDepth(10);

    this.statusText = this.scene.add
      .text(worldWidth / 2, screenHeight * 0.35, '', {
        fontFamily: 'monospace', fontSize: '22px', color: '#ffffff', align: 'center',
      })
      .setOrigin(0.5).setDepth(10);

    this.cashOutButton = this.scene.add
      .rectangle(worldWidth - 70, 30, 124, 44, GOLD)
      .setInteractive({ useHandCursor: true }).setDepth(10)
      .on('pointerdown', () => this.handleCashOut());

    this.cashOutLabel = this.scene.add
      .text(worldWidth - 70, 30, 'CASH OUT', { fontFamily: 'monospace', fontSize: '11px', color: '#0d0d0d' })
      .setOrigin(0.5).setDepth(10);

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
    this.scene.input.on('pointermove', (p: Phaser.Input.Pointer) => { this.pointerX = p.x; });
    this.scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.pointerX = p.x; });
  }

  // ─── Tick ─────────────────────────────────────────────────────────────────

  private onTick(): void {
    if (!this.state) return;

    if (this.state.isAlive && !this.state.cashedOut) {
      tickJett(this.state, this.pointerX, this.config);
    }

    this.renderBackground();
    this.renderAsteroids();
    this.renderPlayer();
    this.renderFlame();
    this.updateHUD();

    if (!this.state.isAlive) {
      this.tickTimer?.remove();
      this.tickTimer = null;
      this.state.combusted ? this.triggerCombustion() : this.showCrash();
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  private renderBackground(): void {
    const { worldWidth, screenHeight } = this.config;
    const altitude = this.state?.altitude ?? 0;
    const t = this.scene.time.now / 1000;

    if (!this.bgGraphics) return;
    this.bgGraphics.clear();

    // Deep space gradient
    this.bgGraphics.fillGradientStyle(0x00000a, 0x00000a, 0x050518, 0x050518, 1);
    this.bgGraphics.fillRect(0, 0, worldWidth, screenHeight);

    // Twinkling stars with parallax
    for (const star of this.stars) {
      const alpha  = 0.35 + 0.45 * Math.sin(star.phase + t * 1.1);
      const parallaxY = ((star.y - altitude * 0.04) % screenHeight + screenHeight) % screenHeight;
      this.bgGraphics.fillStyle(0xffffff, alpha);
      this.bgGraphics.fillCircle(star.x, parallaxY, star.r);
    }

    // Subtle grid
    this.bgGraphics.lineStyle(0.4, 0x1a1a3a, 0.35);
    const gridSize = 70;
    const gridOff  = (altitude * 0.25) % gridSize;
    for (let gy = -gridOff; gy < screenHeight + gridSize; gy += gridSize) {
      this.bgGraphics.beginPath();
      this.bgGraphics.moveTo(0, gy);
      this.bgGraphics.lineTo(worldWidth, gy);
      this.bgGraphics.strokePath();
    }
    for (let gx = 0; gx < worldWidth + gridSize; gx += gridSize) {
      this.bgGraphics.beginPath();
      this.bgGraphics.moveTo(gx, 0);
      this.bgGraphics.lineTo(gx, screenHeight);
      this.bgGraphics.strokePath();
    }

    // Planets drift slowly upward
    if (this.bgPlanet)  this.bgPlanet.y  = ((screenHeight * 0.18 - altitude * 0.018) % screenHeight + screenHeight) % screenHeight;
    if (this.bgPlanet2) this.bgPlanet2.y = ((screenHeight * 0.38 - altitude * 0.013) % screenHeight + screenHeight) % screenHeight;
  }

  private renderAsteroids(): void {
    if (!this.state) return;
    const altitude     = this.state.altitude;
    const screenHeight = this.config.screenHeight;

    // Remove stale graphics
    const activeIds = new Set(this.state.asteroids.map(a => a.id));
    for (const [id, g] of this.asteroidGraphics) {
      if (!activeIds.has(id)) { g.destroy(); this.asteroidGraphics.delete(id); }
    }

    for (const ast of this.state.asteroids) {
      // World → screen Y: player is at playerScreenY at altitude `altitude`
      const screenY = this.playerScreenY - (ast.worldY - altitude);
      if (screenY < -50 || screenY > screenHeight + 50) continue;

      let g = this.asteroidGraphics.get(ast.id);
      if (!g) {
        g = this.scene.add.graphics().setDepth(3);
        this.asteroidGraphics.set(ast.id, g);
      }

      this.drawAsteroid(g, ast.x, screenY, ast.radius, ast.rotationAngle);
    }
  }

  private drawAsteroid(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    radius: number,
    angleDeg: number
  ): void {
    g.clear();
    const angleRad = (angleDeg * Math.PI) / 180;
    const points   = 8;
    const verts: { x: number; y: number }[] = [];

    // Irregular rock polygon
    for (let i = 0; i < points; i++) {
      const a   = angleRad + (i / points) * Math.PI * 2;
      // Vary radius per vertex for rocky look (seeded by i for stable shape)
      const r   = radius * (0.72 + 0.28 * Math.sin(i * 2.3 + angleDeg * 0.01));
      verts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }

    // Shadow / depth fill
    g.fillStyle(0x221100, 1);
    g.beginPath();
    g.moveTo(verts[0].x + 2, verts[0].y + 2);
    for (let i = 1; i < verts.length; i++) g.lineTo(verts[i].x + 2, verts[i].y + 2);
    g.closePath();
    g.fillPath();

    // Main rock fill
    g.fillStyle(0x887755, 1);
    g.beginPath();
    g.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) g.lineTo(verts[i].x, verts[i].y);
    g.closePath();
    g.fillPath();

    // Highlight face
    g.fillStyle(0xbbaa88, 0.55);
    g.beginPath();
    g.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < Math.floor(points / 2); i++) g.lineTo(verts[i].x, verts[i].y);
    g.closePath();
    g.fillPath();

    // Outline
    g.lineStyle(1, 0x554433, 1);
    g.beginPath();
    g.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) g.lineTo(verts[i].x, verts[i].y);
    g.closePath();
    g.strokePath();

    // Small crater detail
    g.fillStyle(0x554433, 0.7);
    g.fillCircle(cx - radius * 0.25, cy - radius * 0.15, radius * 0.18);
    g.fillCircle(cx + radius * 0.3,  cy + radius * 0.2,  radius * 0.12);
  }

  private renderPlayer(): void {
    if (!this.state) return;
    const { worldWidth } = this.config;
    const screenX = this.config.worldWidth / 2 + (this.state.playerX - worldWidth / 2);
    const tilt    = Phaser.Math.Clamp((this.state.playerX - worldWidth / 2) / 80, -15, 15);

    this.playerBody?.setPosition(screenX, this.playerScreenY).setAngle(tilt);
    this.playerHead?.setPosition(screenX, this.playerScreenY - 17).setAngle(tilt);
    this.playerPack?.setPosition(screenX + 8, this.playerScreenY + 2).setAngle(tilt);
  }

  private renderFlame(): void {
    if (!this.state || !this.flameGraphics) return;
    this.flameGraphics.clear();
    if (!this.state.isAlive) return;

    const { worldWidth } = this.config;
    const screenX = this.config.worldWidth / 2 + (this.state.playerX - worldWidth / 2);
    const t       = this.scene.time.now;
    const flameH  = 12 + Math.sin(t / 55) * 6;
    const flameW  = 5  + Math.sin(t / 35) * 2;
    const baseY   = this.playerScreenY + 13;

    // Outer flame
    this.flameGraphics.fillStyle(0xff6600, 0.9);
    this.flameGraphics.fillTriangle(
      screenX + 8 - flameW, baseY,
      screenX + 8 + flameW, baseY,
      screenX + 8,           baseY + flameH
    );
    // Inner flame
    this.flameGraphics.fillStyle(0xffdd00, 0.95);
    this.flameGraphics.fillTriangle(
      screenX + 8 - flameW * 0.5, baseY,
      screenX + 8 + flameW * 0.5, baseY,
      screenX + 8,                  baseY + flameH * 0.55
    );
  }

  private updateHUD(): void {
    if (!this.state) return;
    this.multiplierText?.setText(`x${this.state.multiplier.toFixed(2)}`);
    this.altitudeText?.setText(`ALT: ${Math.floor(this.state.altitude)}m`);
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  private handleCashOut(): void {
    if (!this.state) return;
    const payout = cashOutJett(this.state);
    this.tickTimer?.remove();
    this.tickTimer = null;
    this.statusText?.setText(`PAID OUT\n${payout.toFixed(2)} credits`).setColor(GOLD_STR);
    this.scene.time.delayedCall(600, () => this.showPlayAgain());
  }

  private showPlayAgain(): void {
    const { worldWidth, screenHeight } = this.config;
    const btn = this.scene.add
      .rectangle(worldWidth / 2, screenHeight * 0.55, 180, 50, GOLD)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    this.scene.add
      .text(worldWidth / 2, screenHeight * 0.55, 'PLAY AGAIN', {
        fontFamily: 'monospace', fontSize: '14px', color: '#0d0d0d',
      })
      .setOrigin(0.5).setDepth(21);
    btn.on('pointerdown', () => { this.cleanup(); this.scene.scene.restart(); });
  }

  private showCrash(): void {
    this.statusText?.setText('ASTEROID HIT!\nGAME OVER').setColor('#ff4444');
    this.scene.time.delayedCall(600, () => this.showPlayAgain());
  }

  private triggerCombustion(): void {
    if (!this.state) return;
    const { worldWidth } = this.config;
    const sx = this.config.worldWidth / 2 + (this.state.playerX - worldWidth / 2);
    const sy = this.playerScreenY;

    for (let ring = 0; ring < 3; ring++) {
      const circle = this.scene.add.arc(sx, sy, 10, 0, 360, false, 0xff6600, 0.85).setDepth(8);
      this.scene.tweens.add({
        targets: circle,
        scaleX: (ring + 1) * 3.5,
        scaleY: (ring + 1) * 3.5,
        alpha: 0,
        duration: 500 + ring * 140,
        delay: ring * 75,
        onComplete: () => circle.destroy(),
      });
    }

    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const spark = this.scene.add.rectangle(sx, sy, 4, 4, 0xffaa00).setDepth(8);
      this.scene.tweens.add({
        targets: spark,
        x: sx + Math.cos(angle) * Phaser.Math.Between(40, 110),
        y: sy + Math.sin(angle) * Phaser.Math.Between(40, 110),
        alpha: 0,
        duration: Phaser.Math.Between(400, 750),
        onComplete: () => spark.destroy(),
      });
    }

    if (this.playerBody) this.playerBody.fillColor = 0xff4400;
    if (this.playerHead) this.playerHead.fillColor = 0xff4400;

    this.scene.time.delayedCall(300, () => {
      this.statusText?.setText('COMBUSTION!\nJETPACK FAILED').setColor('#ff6600');
      this.scene.time.delayedCall(600, () => this.showPlayAgain());
    });
  }
}
