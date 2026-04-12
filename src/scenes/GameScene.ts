import * as Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Assets loaded here
  }

  create() {
    const { width, height } = this.scale;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d0d0d);

    // Title
    this.add
      .text(width / 2, height * 0.15, 'SHATTER STEP', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#c9a84c',
        letterSpacing: 6,
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(width / 2, height * 0.22, 'jett.game', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#888888',
        letterSpacing: 3,
      })
      .setOrigin(0.5);

    // Placeholder ladder grid (10 rows, 2 tiles each)
    this.buildLadder(width, height);
  }

  private buildLadder(width: number, height: number) {
    const rows = 10;
    const tileW = width * 0.35;
    const tileH = 44;
    const gap = 8;
    const startY = height * 0.35;
    const centerX = width / 2;

    for (let i = 0; i < rows; i++) {
      const y = startY + i * (tileH + gap);
      const rowLabel = rows - i;

      // Left tile
      this.makeTile(centerX - tileW / 2 - 8, y, tileW, tileH, rowLabel, 'L');
      // Right tile
      this.makeTile(centerX + tileW / 2 + 8, y, tileW, tileH, rowLabel, 'R');
    }
  }

  private makeTile(
    x: number,
    y: number,
    w: number,
    h: number,
    row: number,
    side: string
  ) {
    const bg = this.add
      .rectangle(x, y, w, h, 0x1a1a2e)
      .setStrokeStyle(1, 0xc9a84c, 0.4)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(x, y, `${row}${side}`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#c9a84c',
      })
      .setOrigin(0.5);

    bg.on('pointerover', () => { bg.fillColor = 0x2a2a4e; });
    bg.on('pointerout', () => { bg.fillColor = 0x1a1a2e; });
    bg.on('pointerdown', () => {
      console.log(`Selected: Row ${row} - ${side === 'L' ? 'Left' : 'Right'}`);
    });
  }
}
