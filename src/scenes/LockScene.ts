/**
 * @file LockScene.ts
 * @purpose Password gate — shown before HomeScene. Stores auth in localStorage
 *          so returning visitors on the same device skip it automatically.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import * as Phaser from 'phaser';

const CORRECT_PASSWORD = '9340';
const STORAGE_KEY      = 'jg_auth';
const SESSION_KEY      = 'jg_auth_time';
const GOLD             = 0xc9a84c;
const GOLD_STR         = '#c9a84c';

export class LockScene extends Phaser.Scene {
  private inputCode   = '';
  private dots:  Phaser.GameObjects.Arc[]  = [];
  private errorText: Phaser.GameObjects.Text | null = null;
  private shakeTimer: Phaser.Time.TimerEvent | null = null;

  constructor() { super({ key: 'LockScene' }); }

  create(): void {
    // Use sessionStorage — resets every time the tab/browser is closed
    // Also clear any old localStorage auth that may be lingering
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_KEY);

    if (sessionStorage.getItem(STORAGE_KEY) === 'ok') {
      this.scene.start('HomeScene');
      return;
    }

    const { width, height } = this.scale;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

    // Grid
    const grid = this.add.graphics();
    grid.lineStyle(0.3, 0x0d0d1a, 1);
    for (let x = 0; x <= width; x += 40) {
      grid.beginPath(); grid.moveTo(x, 0); grid.lineTo(x, height); grid.strokePath();
    }
    for (let y = 0; y <= height; y += 40) {
      grid.beginPath(); grid.moveTo(0, y); grid.lineTo(width, y); grid.strokePath();
    }

    // Top gold bar
    const bar = this.add.graphics();
    bar.fillStyle(GOLD, 1);
    bar.fillRect(0, 0, width, 3);
    bar.fillStyle(GOLD, 0.07);
    bar.fillRect(0, 0, width, 32);

    // Logo
    this.add.text(width / 2, height * 0.14, 'JETT', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '56px',
      color: GOLD_STR,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.215, '.GAME', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '22px',
      color: '#cccccc',
    }).setOrigin(0.5);

    // Lock icon (drawn)
    const lockG = this.add.graphics();
    this.drawLock(lockG, width / 2, height * 0.36);

    // Enter code label
    this.add.text(width / 2, height * 0.46, 'ENTER ACCESS CODE', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '16px',
      color: '#444455',
      letterSpacing: 3,
    }).setOrigin(0.5);

    // 4 dot indicators
    this.dots = [];
    const dotSpacing = 28;
    const dotsStartX = width / 2 - dotSpacing * 1.5;
    for (let i = 0; i < 4; i++) {
      const dot = this.add.arc(dotsStartX + i * dotSpacing, height * 0.52, 8, 0, 360, false, 0x1e1e30);
      dot.setStrokeStyle(1.5, GOLD, 0.4);
      this.dots.push(dot);
    }

    // Error text
    this.errorText = this.add.text(width / 2, height * 0.57, '', {
      fontFamily: '"Fredoka One", sans-serif',
      fontSize: '14px',
      color: '#ff4444',
    }).setOrigin(0.5);

    // Numpad
    this.buildNumpad(width, height);
  }

  private buildNumpad(width: number, height: number): void {
    const keys    = ['1','2','3','4','5','6','7','8','9','⌫','0','✓'];
    const cols    = 3;
    const btnW    = 80;
    const btnH    = 64;
    const gapX    = 16;
    const gapY    = 12;
    const totalW  = cols * btnW + (cols - 1) * gapX;
    const startX  = (width - totalW) / 2;
    const startY  = height * 0.615;

    keys.forEach((key, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx  = startX + col * (btnW + gapX) + btnW / 2;
      const cy  = startY + row * (btnH + gapY) + btnH / 2;

      const isAction = key === '⌫' || key === '✓';
      const fillColor = key === '✓' ? GOLD : 0x0d0d1a;
      const textColor = key === '✓' ? '#000000' : GOLD_STR;

      const bg = this.add.graphics();
      bg.fillStyle(fillColor, 1);
      bg.fillRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 10);
      bg.lineStyle(1, GOLD, isAction ? 0.6 : 0.15);
      bg.strokeRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 10);

      this.add.text(cx, cy, key, {
        fontFamily: '"Fredoka One", sans-serif',
        fontSize: key === '⌫' ? '22px' : '28px',
        color: textColor,
      }).setOrigin(0.5);

      // Hit area
      this.add.rectangle(cx, cy, btnW, btnH, 0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.handleKey(key, bg, cx, cy, btnW, btnH, fillColor))
        .on('pointerover', () => {
          bg.clear();
          bg.fillStyle(key === '✓' ? 0xddb83a : 0x141425, 1);
          bg.fillRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 10);
          bg.lineStyle(1, GOLD, 0.5);
          bg.strokeRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 10);
        })
        .on('pointerout', () => {
          bg.clear();
          bg.fillStyle(fillColor, 1);
          bg.fillRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 10);
          bg.lineStyle(1, GOLD, isAction ? 0.6 : 0.15);
          bg.strokeRoundedRect(cx - btnW / 2, cy - btnH / 2, btnW, btnH, 10);
        });
    });
  }

  private handleKey(
    key: string,
    _bg: Phaser.GameObjects.Graphics,
    _cx: number, _cy: number, _w: number, _h: number,
    _fill: number
  ): void {
    if (key === '⌫') {
      this.inputCode = this.inputCode.slice(0, -1);
    } else if (key === '✓') {
      this.submit();
      return;
    } else {
      if (this.inputCode.length >= 4) return;
      this.inputCode += key;
      if (this.inputCode.length === 4) {
        // Auto-submit when 4 digits entered
        this.time.delayedCall(120, () => this.submit());
      }
    }
    this.updateDots();
    this.errorText?.setText('');
  }

  private updateDots(): void {
    for (let i = 0; i < 4; i++) {
      const filled = i < this.inputCode.length;
      this.dots[i].fillColor = filled ? GOLD : 0x1e1e30;
      this.dots[i].setStrokeStyle(1.5, GOLD, filled ? 0.9 : 0.4);
    }
  }

  private submit(): void {
    if (this.inputCode === CORRECT_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, 'ok');
      // Flash gold then go
      this.cameras.main.flash(300, 201, 168, 76);
      this.time.delayedCall(320, () => this.scene.start('HomeScene'));
    } else {
      this.errorText?.setText('incorrect code');
      this.shakeDots();
      this.inputCode = '';
      this.time.delayedCall(500, () => {
        this.updateDots();
        this.errorText?.setText('');
      });
    }
  }

  private shakeDots(): void {
    const originalX = this.dots.map(d => d.x);
    let tick = 0;
    this.shakeTimer?.remove();
    this.shakeTimer = this.time.addEvent({
      delay: 30,
      repeat: 6,
      callback: () => {
        const offset = tick % 2 === 0 ? 6 : -6;
        this.dots.forEach((d, i) => { d.x = originalX[i] + offset; d.fillColor = 0xff3333; });
        tick++;
        if (tick > 6) this.dots.forEach((d, i) => { d.x = originalX[i]; });
      },
    });
  }

  private drawLock(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
    // Lock body
    g.fillStyle(0x111122, 1);
    g.fillRoundedRect(cx - 20, cy, 40, 30, 6);
    g.lineStyle(1.5, GOLD, 0.6);
    g.strokeRoundedRect(cx - 20, cy, 40, 30, 6);

    // Shackle
    g.lineStyle(3, GOLD, 0.8);
    g.beginPath();
    g.arc(cx, cy, 14, Math.PI, 0, false);
    g.strokePath();

    // Keyhole
    g.fillStyle(GOLD, 0.7);
    g.fillCircle(cx, cy + 13, 5);
    g.fillRect(cx - 2, cy + 13, 4, 8);
  }
}
