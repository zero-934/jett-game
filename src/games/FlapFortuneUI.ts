/**
 * @file FlapFortuneUI.ts
 * @purpose Phaser rendering for Flap Fortune — medieval castle theme with portcullis gates,
 *          wizard on broomstick player, castle background, combustion FX, HUD.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';
import type { FlapFortuneConfig } from './FlapFortuneLogic';
import { createFlapFortuneState, tickFlapFortune } from './FlapFortuneLogic';

const GOLD     = 0xc9a84c;
const GOLD_STR = '#c9a84c';

// Medieval palette
const _SKY_TOP     = 0x1a0a2e; void _SKY_TOP; // kept for reference
const _SKY_BOT     = 0x3d1a0a; void _SKY_BOT;
const STONE_DARK   = 0x3a3530;
const STONE_MID    = 0x5a524a;
const STONE_LIGHT  = 0x7a6e62;
const GATE_IRON    = 0x2a2a2a;
const GATE_RUST    = 0x5a3a1a;
const GATE_BAR     = 0x1a1a1a;
const TORCH_ORANGE = 0xff6600;
const WIZARD_ROBE  = 0x4a0a8a;
const WIZARD_HAT   = 0x2a0a5a;
const BROOM_WOOD   = 0x8b6914;
const _MOON_COL    = 0xffe8a0; void _MOON_COL;

export class FlapFortuneUI {
  private scene:  Phaser.Scene;
  private config: FlapFortuneConfig;
  private state:  ReturnType<typeof createFlapFortuneState> | null = null;

  // Background
  private bgGraphics: Phaser.GameObjects.Graphics | null = null;
  private castleTowers: { x: number; h: number }[] = [];
  private torches: { x: number; y: number; phase: number }[] = [];
  private groundScrollX = 0;
  private stars: { x: number; y: number; r: number; phase: number }[] = [];

  // Wizard player parts
  private wizBody:  Phaser.GameObjects.Rectangle | null = null;
  private wizHead:  Phaser.GameObjects.Arc       | null = null;
  private wizHat:   Phaser.GameObjects.Triangle  | null = null;
  private wizBroom: Phaser.GameObjects.Rectangle | null = null;

  // Gate graphics pool
  private gateGraphics: Phaser.GameObjects.Graphics[] = [];

  // HUD
  private multiplierText: Phaser.GameObjects.Text      | null = null;
  private gatesText:      Phaser.GameObjects.Text      | null = null;
  private statusText:     Phaser.GameObjects.Text      | null = null;
  private exitStrip:      Phaser.GameObjects.Graphics  | null = null;
  private exitLabel:      Phaser.GameObjects.Text      | null = null;


  private isFlapping = false;
  private waitingToStart = true;  // freeze physics until first tap
  private tickTimer:  Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, config: FlapFortuneConfig) {
    this.scene  = scene;
    this.config = config;
  }

  public start(bet: number): void {
    this.cleanup();
    this.state = createFlapFortuneState(bet, this.config);
    this.buildBackground();
    this.buildWizard();
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
    this.waitingToStart = true;
    this.tickTimer?.remove();
    this.tickTimer = null;
    this.bgGraphics?.destroy();
    this.wizBody?.destroy();
    this.wizHead?.destroy();
    this.wizHat?.destroy();
    this.wizBroom?.destroy();
    for (const g of this.gateGraphics) g.destroy();
    this.gateGraphics = [];
    this.multiplierText?.destroy();
    this.gatesText?.destroy();
    this.statusText?.destroy();
    this.exitStrip?.destroy();
    this.exitLabel?.destroy();
    this.state = null;
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  private buildBackground(): void {
    const { worldWidth, worldHeight } = this.config;
    this.bgGraphics = this.scene.add.graphics();

    // Stars
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x:     Math.random() * worldWidth,
        y:     Math.random() * worldHeight * 0.6,
        r:     Math.random() < 0.2 ? 1.5 : 0.7,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Background castle silhouette towers
    this.castleTowers = [];
    const towerCount = 6;
    for (let i = 0; i < towerCount; i++) {
      this.castleTowers.push({
        x: (worldWidth / towerCount) * i + Math.random() * 40,
        h: 80 + Math.random() * 120,
      });
    }

    // Torches on the castle walls
    this.torches = [
      { x: worldWidth * 0.2, y: worldHeight * 0.72, phase: 0 },
      { x: worldWidth * 0.5, y: worldHeight * 0.70, phase: 1.2 },
      { x: worldWidth * 0.8, y: worldHeight * 0.73, phase: 2.4 },
    ];
  }

  private buildWizard(): void {
    const bx = 80;
    const by = this.config.worldHeight / 2;

    // Broomstick
    this.wizBroom = this.scene.add.rectangle(bx - 4, by + 10, 36, 5, BROOM_WOOD).setDepth(4);

    // Robe / body
    this.wizBody = this.scene.add.rectangle(bx, by, 10, 22, WIZARD_ROBE).setDepth(5);

    // Head
    this.wizHead = this.scene.add.arc(bx, by - 16, 8, 0, 360, false, 0xf4c48a).setDepth(5);

    // Hat (triangle)
    this.wizHat = this.scene.add.triangle(
      bx, by - 28,
      -8, 8,
      8,  8,
      0, -18,
      WIZARD_HAT
    ).setDepth(5);
  }

  private buildHUD(): void {
    const { worldWidth, worldHeight } = this.config;

    this.multiplierText = this.scene.add
      .text(16, 46, 'x1.00', {
        fontFamily: 'monospace', fontSize: '22px', color: GOLD_STR,
        stroke: '#000000', strokeThickness: 3,
      }).setDepth(10);

    this.gatesText = this.scene.add
      .text(16, 70, 'GATES: 0', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ddccaa',
        stroke: '#000000', strokeThickness: 2,
      }).setDepth(10);

    this.statusText = this.scene.add
      .text(worldWidth / 2, worldHeight * 0.38, '', {
        fontFamily: 'monospace', fontSize: '22px', color: '#ffffff',
        stroke: '#000000', strokeThickness: 4, align: 'center',
      })
      .setOrigin(0.5).setDepth(10);

    // Gold exit strip at the bottom — hidden until first pipe is cleared
    this.exitStrip = this.scene.add.graphics().setDepth(9).setVisible(false);
    this.exitStrip.fillStyle(GOLD, 0.18);
    this.exitStrip.fillRect(0, worldHeight - 14, worldWidth, 14);
    this.exitStrip.lineStyle(2, GOLD, 0.7);
    this.exitStrip.beginPath();
    this.exitStrip.moveTo(0, worldHeight - 14);
    this.exitStrip.lineTo(worldWidth, worldHeight - 14);
    this.exitStrip.strokePath();

    // Cash out label — hidden until first pipe cleared
    this.exitLabel = this.scene.add
      .text(worldWidth / 2, worldHeight - 7, '▼  DIVE TO CASH OUT  ▼', {
        fontFamily: 'monospace', fontSize: '10px', color: '#c9a84c',
        stroke: '#000000', strokeThickness: 2,
      })
      .setOrigin(0.5).setDepth(10).setVisible(false);

    // Home navigation handled by scene nav bar
  }

  private registerInput(): void {
    this.scene.input.on('pointerdown', () => { this.waitingToStart = false; this.isFlapping = true; });
    this.scene.input.on('pointerup',   () => { this.isFlapping = false; });
    this.scene.input.keyboard?.on('keydown-SPACE', () => { this.isFlapping = true; });
    this.scene.input.keyboard?.on('keyup-SPACE',   () => { this.isFlapping = false; });
  }

  // ─── Tick ─────────────────────────────────────────────────────────────────

  private onTick(): void {
    if (!this.state) return;

    if (this.waitingToStart) return;  // frozen until first tap
    if (this.state.isAlive && !this.state.cashedOut) {
      tickFlapFortune(this.state, this.isFlapping, this.config);
      this.isFlapping   = false;
      this.groundScrollX = (this.groundScrollX + (this.config.scrollSpeed ?? 3)) % this.config.worldWidth;
    }

    this.renderBackground();
    this.renderGates();
    this.renderWizard();
    this.updateHUD();

    if (!this.state.isAlive) {
      this.tickTimer?.remove();
      this.tickTimer = null;
      if (this.state.cashedOut) {
        // Flew out the bottom — successful escape
        this.statusText?.setText(`ESCAPED!\n${this.state.payout.toFixed(2)} credits`).setColor(GOLD_STR);
        this.scene.time.delayedCall(600, () => this.showPlayAgain());
      } else if (this.state.combusted) {
        this.triggerCombustion();
      } else {
        this.statusText?.setText('GATE CRASHED!\nFLY HIGHER').setColor('#ff4444');
        this.scene.time.delayedCall(600, () => this.showPlayAgain());
      }
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  private renderBackground(): void {
    const { worldWidth, worldHeight } = this.config;
    if (!this.bgGraphics) return;
    const t   = this.scene.time.now / 1000;
    const g   = this.bgGraphics;
    const scrollFar  = this.groundScrollX * 0.08; // far parallax
    const scrollMid  = this.groundScrollX * 0.20; // mid parallax
    const scrollNear = this.groundScrollX * 0.45; // near parallax

    g.clear();

    // ── Sky gradient ────────────────────────────────────────────────────────
    g.fillGradientStyle(0x08021a, 0x08021a, 0x2a0e0e, 0x2a0e0e, 1);
    g.fillRect(0, 0, worldWidth, worldHeight);

    // ── Moon with halo ──────────────────────────────────────────────────────
    const moonX = worldWidth * 0.78;
    const moonY = worldHeight * 0.13;
    g.fillStyle(0x4433aa, 0.12);
    g.fillCircle(moonX, moonY, 52);
    g.fillStyle(0xfff0c0, 0.95);
    g.fillCircle(moonX, moonY, 30);
    g.fillStyle(0x08021a, 0.55); // crescent cut
    g.fillCircle(moonX + 12, moonY - 6, 25);

    // ── Stars ───────────────────────────────────────────────────────────────
    for (const star of this.stars) {
      const alpha = 0.4 + 0.5 * Math.sin(star.phase + t * 0.8);
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(star.x, star.y, star.r);
    }

    // ── Far distant mountains / hills ───────────────────────────────────────
    g.fillStyle(0x100820, 1);
    const hillW = worldWidth / 3;
    for (let hi = 0; hi < 5; hi++) {
      const hx = ((hi * hillW * 0.7 - scrollFar) % (worldWidth + hillW) + worldWidth + hillW) % (worldWidth + hillW) - hillW / 2;
      const hh = 55 + (hi % 3) * 25;
      g.fillTriangle(hx, worldHeight * 0.72, hx + hillW * 0.5, worldHeight * 0.72 - hh, hx + hillW, worldHeight * 0.72);
    }

    // ── Mid castle — large background keep ──────────────────────────────────
    const keepX = ((worldWidth * 0.3 - scrollMid) % worldWidth + worldWidth) % worldWidth - 30;
    const keepW = 120;
    const keepH = 160;
    const keepY = worldHeight * 0.72 - keepH;
    g.fillStyle(0x1a1220, 1);
    // Main keep body
    g.fillRect(keepX, keepY, keepW, keepH);
    // Keep battlements
    const mW = 14;
    for (let m = 0; m < 7; m++) {
      if (m % 2 === 0) g.fillRect(keepX + m * (keepW / 7), keepY - 16, mW, 16);
    }
    // Keep windows — arched (two rows)
    g.fillStyle(0xffcc33, 0.55);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const wx = keepX + 18 + col * 36;
        const wy = keepY + 20 + row * 55;
        g.fillRect(wx, wy + 6, 10, 14);
        g.fillTriangle(wx - 1, wy + 6, wx + 11, wy + 6, wx + 5, wy);
      }
    }
    // Side towers of keep
    g.fillStyle(0x1a1220, 1);
    for (const tx of [keepX - 18, keepX + keepW - 2]) {
      const th = keepH + 30;
      g.fillRect(tx, worldHeight * 0.72 - th, 20, th);
      // Tower battlements
      for (let m = 0; m < 3; m++) {
        if (m % 2 === 0) g.fillRect(tx + m * 7, worldHeight * 0.72 - th - 10, 7, 10);
      }
      // Cone roof
      g.fillStyle(0x3a0a0a, 1);
      g.fillTriangle(tx - 2, worldHeight * 0.72 - th, tx + 22, worldHeight * 0.72 - th, tx + 10, worldHeight * 0.72 - th - 35);
      g.fillStyle(0x1a1220, 1);
    }
    // Keep flag
    g.fillStyle(0x880000, 1);
    g.fillRect(keepX + keepW / 2 - 1, keepY - 38, 2, 22);
    g.fillTriangle(keepX + keepW / 2 + 1, keepY - 38, keepX + keepW / 2 + 14, keepY - 31, keepX + keepW / 2 + 1, keepY - 24);

    // ── Foreground castle wall ───────────────────────────────────────────────
    const wallY = worldHeight * 0.78;
    const wallH = worldHeight - wallY;
    g.fillStyle(0x2a2228, 1);
    g.fillRect(0, wallY, worldWidth, wallH);

    // Wall stone blocks (scrolling)
    const bW = 44; const bH = 20;
    g.fillStyle(0x353035, 0.5);
    for (let row = 0; row < 4; row++) {
      const offset2 = (row % 2 === 0) ? 0 : bW / 2;
      const tileOff2 = (scrollNear + offset2) % bW;
      for (let bx2 = -tileOff2; bx2 < worldWidth + bW; bx2 += bW) {
        g.fillRect(bx2, wallY + row * bH, bW - 2, bH - 1);
      }
    }

    // Wall battlements at top
    g.fillStyle(0x2a2228, 1);
    const merlonW = 18;
    const merlonH = 22;
    const merlonGap = 14;
    const merlonPitch = merlonW + merlonGap;
    const merlonOff = scrollNear % merlonPitch;
    for (let mx = -merlonOff - merlonPitch; mx < worldWidth + merlonPitch; mx += merlonPitch) {
      g.fillRect(mx, wallY - merlonH, merlonW, merlonH);
    }

    // Foreground towers
    const fgTowers = [
      { x: ((- scrollNear * 0.6) % (worldWidth * 1.5) + worldWidth * 1.5) % (worldWidth * 1.5) - 30, w: 60, h: 120 },
      { x: ((worldWidth * 0.55 - scrollNear * 0.6) % (worldWidth * 1.5) + worldWidth * 1.5) % (worldWidth * 1.5) - 30, w: 50, h: 100 },
    ];
    for (const ft of fgTowers) {
      if (ft.x > worldWidth + 80) continue;
      g.fillStyle(0x252028, 1);
      g.fillRect(ft.x, wallY - ft.h, ft.w, ft.h + wallH);
      // Tower battlements
      for (let m = 0; m < Math.floor(ft.w / (merlonW + 4)); m++) {
        g.fillRect(ft.x + m * (merlonW + 4), wallY - ft.h - merlonH, merlonW, merlonH);
      }
      // Cone roof
      g.fillStyle(0x5a0808, 1);
      g.fillTriangle(ft.x - 4, wallY - ft.h, ft.x + ft.w + 4, wallY - ft.h, ft.x + ft.w / 2, wallY - ft.h - 48);
      // Arched window with glow
      g.fillStyle(0xffbb22, 0.5 + 0.2 * Math.sin(t * 1.5 + ft.x));
      const wndX = ft.x + ft.w / 2 - 5;
      const wndY = wallY - ft.h + 28;
      g.fillRect(wndX, wndY + 7, 10, 18);
      g.fillTriangle(wndX - 1, wndY + 7, wndX + 11, wndY + 7, wndX + 5, wndY);
      // Flag
      g.fillStyle(0x880000, 1);
      g.fillRect(ft.x + ft.w / 2 - 1, wallY - ft.h - 48 - 20, 2, 20);
      g.fillTriangle(ft.x + ft.w / 2 + 1, wallY - ft.h - 66, ft.x + ft.w / 2 + 13, wallY - ft.h - 59, ft.x + ft.w / 2 + 1, wallY - ft.h - 52);
    }

    // ── Torches on wall ──────────────────────────────────────────────────────
    for (const torch of this.torches) {
      const tx = ((torch.x - scrollNear * 0.3) % worldWidth + worldWidth) % worldWidth;
      const ty = wallY - 12;
      const flicker = 0.7 + 0.3 * Math.sin(torch.phase + t * 9);
      g.fillStyle(GATE_IRON, 1);
      g.fillRect(tx - 2, ty - 2, 4, 14);
      g.fillStyle(TORCH_ORANGE, flicker);
      g.fillTriangle(tx - 5, ty - 2, tx + 5, ty - 2, tx, ty - 18);
      g.fillStyle(0xffee44, flicker * 0.9);
      g.fillTriangle(tx - 3, ty - 2, tx + 3, ty - 2, tx, ty - 12);
      g.fillStyle(TORCH_ORANGE, 0.10 * flicker);
      g.fillCircle(tx, ty - 8, 20);
    }
  }

  private renderGates(): void {
    if (!this.state) return;
    const { worldHeight } = this.config;
    const gateW = 34;
    const t = this.scene.time.now;

    while (this.gateGraphics.length < this.state.pipes.length) {
      this.gateGraphics.push(this.scene.add.graphics().setDepth(6));
    }

    for (let i = 0; i < this.gateGraphics.length; i++) {
      const g = this.gateGraphics[i];
      g.clear();
      if (i >= this.state.pipes.length) continue;

      const pipe = this.state.pipes[i];

      // ── Top portcullis ─────────────────────────────────────────────────
      this.drawPortcullis(g, pipe.x, 0, gateW, pipe.topHeight, true, t);

      // ── Bottom portcullis ──────────────────────────────────────────────
      const botY = worldHeight - pipe.bottomHeight;
      this.drawPortcullis(g, pipe.x, botY, gateW, pipe.bottomHeight, false, t);
    }
  }

  private drawPortcullis(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number,
    w: number, h: number,
    isTop: boolean,
    _t: number
  ): void {
    if (h < 4) return;

    // Stone wall behind gate
    g.fillStyle(STONE_DARK, 1);
    g.fillRect(x, y, w, h);

    // Stone texture blocks
    g.fillStyle(STONE_MID, 0.6);
    const blockH = 18;
    for (let by2 = y; by2 < y + h; by2 += blockH) {
      const offset = ((by2 / blockH) % 2 === 0) ? 0 : w / 2;
      g.fillRect(x + offset,       by2, w / 2 - 1, blockH - 1);
      g.fillRect(x + offset + w / 2, by2, w / 2 - 1, blockH - 1);
    }

    // Iron gate bars (vertical)
    const barCount = 4;
    const barSpacing = w / (barCount + 1);
    g.fillStyle(GATE_BAR, 1);
    for (let b = 1; b <= barCount; b++) {
      g.fillRect(x + barSpacing * b - 2, y, 4, h);
    }

    // Horizontal cross-bars
    g.lineStyle(3, GATE_RUST, 0.8);
    const crossCount = Math.max(1, Math.floor(h / 28));
    for (let c = 1; c <= crossCount; c++) {
      const crossY = isTop ? y + h - (c * h / (crossCount + 1)) : y + (c * h / (crossCount + 1));
      g.beginPath();
      g.moveTo(x, crossY);
      g.lineTo(x + w, crossY);
      g.strokePath();
    }

    // Gate cap / arch at the gap edge
    const capH  = 14;
    const toothW = 7;
    g.fillStyle(STONE_LIGHT, 1);
    if (isTop) {
      g.fillRect(x - 4, y + h - capH, w + 8, capH);
      // Pointed arch teeth
      for (let tx = x - 4; tx < x + w + 4; tx += toothW * 2) {
        g.fillTriangle(tx, y + h, tx + toothW / 2, y + h - 10, tx + toothW, y + h);
      }
    } else {
      g.fillRect(x - 4, y, w + 8, capH);
      // Upward teeth
      for (let tx = x - 4; tx < x + w + 4; tx += toothW * 2) {
        g.fillTriangle(tx, y + capH, tx + toothW / 2, y + capH + 10, tx + toothW, y + capH);
      }
    }

    // Torchlight glow on gate edge
    const glowY = isTop ? y + h : y;
    g.fillStyle(TORCH_ORANGE, 0.07);
    g.fillRect(x - 2, glowY - 8, w + 4, 16);
  }

  private renderWizard(): void {
    if (!this.state || !this.wizBody || !this.wizHead || !this.wizHat || !this.wizBroom) return;

    const by   = this.state.playerY;
    const tilt = Phaser.Math.Clamp(this.state.playerVelocityY * 2.5, -25, 40);
    const t    = this.scene.time.now;

    // Broomstick wobble
    this.wizBroom.setPosition(76, by + 10).setAngle(tilt * 0.6);

    // Body
    this.wizBody.setPosition(80, by).setAngle(tilt);

    // Head
    this.wizHead.setPosition(80, by - 16).setAngle(tilt);

    // Hat bobs slightly
    const hatBob = Math.sin(t / 180) * 1.5;
    this.wizHat.setPosition(80, by - 28 + hatBob).setAngle(tilt);

    // Robe colour pulses slightly with magic glow
    const glow = Math.floor(0x4a + Math.sin(t / 300) * 0x10);
    this.wizBody.fillColor = (glow << 16) | 0x0a8a;
  }

  private updateHUD(): void {
    if (!this.state) return;
    this.multiplierText?.setText(`x${this.state.multiplier.toFixed(2)}`);
    this.gatesText?.setText(`GATES: ${this.state.pipesCleared}`);
    // Show cash-out strip only after first pipe is cleared
    const canCashOut = this.state.pipesCleared >= 1;
    this.exitStrip?.setVisible(canCashOut);
    this.exitLabel?.setVisible(canCashOut);
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  private showPlayAgain(): void {
    const { worldWidth, worldHeight } = this.config;
    const btn = this.scene.add
      .rectangle(worldWidth / 2, worldHeight * 0.55, 180, 50, GOLD)
      .setInteractive({ useHandCursor: true }).setDepth(20);
    this.scene.add
      .text(worldWidth / 2, worldHeight * 0.55, 'PLAY AGAIN', {
        fontFamily: 'monospace', fontSize: '14px', color: '#0d0d0d',
      })
      .setOrigin(0.5).setDepth(21);
    btn.on('pointerdown', () => { this.cleanup(); this.scene.scene.restart(); });
  }

  private triggerCombustion(): void {
    const bx = 80;
    const by = this.state?.playerY ?? this.config.worldHeight / 2;

    for (let ring = 0; ring < 3; ring++) {
      const circle = this.scene.add.arc(bx, by, 10, 0, 360, false, 0xff6600, 0.9).setDepth(8);
      this.scene.tweens.add({
        targets: circle,
        scaleX: (ring + 1) * 4,
        scaleY: (ring + 1) * 4,
        alpha: 0,
        duration: 450 + ring * 120,
        delay: ring * 80,
        onComplete: () => circle.destroy(),
      });
    }

    if (this.wizBody) this.wizBody.fillColor = 0xff4400;

    this.scene.time.delayedCall(250, () => {
      this.statusText?.setText('SPELL BACKFIRED!\nBROOM FAILED').setColor('#ff6600');
      this.scene.time.delayedCall(600, () => this.showPlayAgain());
    });
  }
}
