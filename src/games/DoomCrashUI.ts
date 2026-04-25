/**
 * @file DoomCrashUI.ts
 * @purpose Phaser 3 UI for Doom Crash 2.0 — corridor visuals, enemy sprites, multiplier HUD
 * @author Agent 934
 * @date 2026-04-24
 * @license Proprietary
 */

import * as Phaser from "phaser";
import type { DoomCrashState, Enemy, EnemyType } from "./DoomCrashLogic";

const CANVAS_W = 390;
const CANVAS_H = 844;

// Colors for Doom-style UI
const GOLD = 0xc9a84c;
const GOLD_STR = "#c9a84c";
const DANGER = 0xef4444;
const DANGER_STR = "#ef4444";
const BG_COLOR = 0x080808;
// const SURFACE = 0x111111; // unused
const TEXT_COLOR = "#f0f0f0";

// Doom Corridor Colors (Hex Estimates from Visual Analysis)
const CORRIDOR_WALL_BASE = 0x604428;        // Darker brownish-orange
const CORRIDOR_WALL_LIGHT = 0x9c7c54;       // Lighter brownish-orange
const CORRIDOR_FLOOR_BASE = 0x443828;       // Dark brown
const CORRIDOR_CEILING_BASE = 0x484840;     // Dark brownish-grey
const CORRIDOR_GRID_LINE = 0x201810;        // Very dark brown/grey for mortar

// Doom UI Colors
const HUD_TOP_BG = 0x202020;
const HUD_TOP_INNER = 0x404040;
const HUD_HEALTH_GREEN = 0x00ff00;
const HUD_HEALTH_GRID = 0x101010;
const HUD_CONTROL_BG = 0x303030;
const HUD_CONTROL_BORDER = 0x505050;

// Gun Colors
const GUN_SKIN_BASE = 0x9c6040;
const GUN_BODY_BASE = 0x303030;
const GUN_BODY_HIGHLIGHT = 0x505050;

// Perspective Constants
const CORRIDOR_VANISH_X = CANVAS_W / 2;
const CORRIDOR_VANISH_Y = 360; // Slightly above center for portrait
const PROJECTION_FACTOR = 200; // Adjust for FOV/scaling (smaller = wider FOV)
const CAMERA_Z = 0.1; // Small value to prevent division by zero near camera

// Enemy Rendering
const ENEMY_MAX_SCALE = 1.4;
const ENEMY_MIN_SCALE = 0.15;
const ENEMY_HITBOX_BASE_SIZE = 80;
// const MULTIPLIER_FONT_SIZE = "72px"; // unused
const HUD_FONT_SIZE = "18px";
const FLASH_DURATION_MS = 120;
const SHAKE_INTENSITY = 6;
// const ENEMY_EMOJI: Record<EnemyType, string> = { IMP: "👿", DEMON: "😈", CACODEMON: "👁️", CYBERDEMON: "💀" }; // Replaced by pixel art
const ENEMY_COLOR: Record<EnemyType, number> = { IMP: 0xcc3300, DEMON: 0x990000, CACODEMON: 0x660099, CYBERDEMON: 0xff0000 };
const BET_AMOUNTS = [0.5, 1, 2, 5, 10];

// 3D to 2D Projection Helper
function project3DTo2D(x3D: number, y3D: number, z3D: number, vanishX: number, vanishY: number): { x: number, y: number } {
    let relZ = z3D + CAMERA_Z;
    let perspectiveScale = PROJECTION_FACTOR / relZ;
    let sx = vanishX + (x3D * perspectiveScale);
    let sy = vanishY + (y3D * perspectiveScale);
    return { x: sx, y: sy };
}

export class DoomCrashUI {
    private scene: Phaser.Scene;
    private graphics!: Phaser.GameObjects.Graphics;
    private multiplierText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private cashOutButton!: Phaser.GameObjects.Rectangle;
    private cashOutText!: Phaser.GameObjects.Text;
    private betButtons: Phaser.GameObjects.Rectangle[] = [];
    private betButtonTexts: Phaser.GameObjects.Text[] = [];
    private currentBetText!: Phaser.GameObjects.Text;
    private enemyContainer!: Phaser.GameObjects.Container;
    private screenFlashRect!: Phaser.GameObjects.Rectangle;
    private crashOverlay!: Phaser.GameObjects.Rectangle;
    private crashText!: Phaser.GameObjects.Text;
    // For pixel art enemies, we'll store Graphics objects instead of Text
    private enemySprites: Map<string, Phaser.GameObjects.Graphics> = new Map();
    private currentBetAmount: number = BET_AMOUNTS[0];

    onCashOutPressed: () => void = () => {};
    onEnemyTapped: (enemyId: string) => void = () => {};
    onBetSelected: (amount: number) => void = () => {};

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    create(): void {
        this.graphics = this.scene.add.graphics();
        this.graphics.setDepth(-1); // Background elements

        // Fill background (very dark for distant fog)
        this.graphics.fillStyle(BG_COLOR, 1);
        this.graphics.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // --- CORRIDOR DRAWING ---
        // Pure Phaser4 beginPath/moveTo/lineTo/closePath/fillPath
        // Doom-style one-point perspective corridor

        const VX = CORRIDOR_VANISH_X;
        const VY = CORRIDOR_VANISH_Y;

        // Helper: draw a filled quad using 4 corners
        const fillQuad = (x1: number, y1: number, x2: number, y2: number,
                          x3: number, y3: number, x4: number, y4: number) => {
            this.graphics.beginPath();
            this.graphics.moveTo(x1, y1);
            this.graphics.lineTo(x2, y2);
            this.graphics.lineTo(x3, y3);
            this.graphics.lineTo(x4, y4);
            this.graphics.closePath();
            this.graphics.fillPath();
        };

        // ---- BASE FILLS ----
        // Ceiling (top of screen → vanish line)
        this.graphics.fillStyle(CORRIDOR_CEILING_BASE, 1);
        fillQuad(0, 0, CANVAS_W, 0, CANVAS_W, VY, 0, VY);

        // Floor (vanish line → bottom of screen)
        this.graphics.fillStyle(CORRIDOR_FLOOR_BASE, 1);
        fillQuad(0, VY, CANVAS_W, VY, CANVAS_W, CANVAS_H, 0, CANVAS_H);

        // Left wall (left edge → vanish point)
        this.graphics.fillStyle(CORRIDOR_WALL_BASE, 1);
        fillQuad(0, 0, VX, VY, VX, VY, 0, CANVAS_H);

        // Right wall
        this.graphics.fillStyle(CORRIDOR_WALL_BASE, 1);
        fillQuad(VX, VY, CANVAS_W, 0, CANVAS_W, CANVAS_H, VX, VY);

        // ---- WALL PANEL SHADING (depth sections) ----
        // Each section = horizontal band on left/right walls, darker as they approach edges
        const NUM_PANELS = 6;
        for (let i = 0; i < NUM_PANELS; i++) {
            const t0 = i / NUM_PANELS;       // near edge of this band (0=screen edge, 1=vanish)
            const t1 = (i + 1) / NUM_PANELS;
            // Lerp between screen edge and vanish point
            const leftX0 = Phaser.Math.Linear(0, VX, t0);
            const leftX1 = Phaser.Math.Linear(0, VX, t1);
            const topY0 = Phaser.Math.Linear(0, VY, t0);
            const topY1 = Phaser.Math.Linear(0, VY, t1);
            const botY0 = Phaser.Math.Linear(CANVAS_H, VY, t0);
            const botY1 = Phaser.Math.Linear(CANVAS_H, VY, t1);

            const panelColor = (i % 2 === 0) ? CORRIDOR_WALL_LIGHT : CORRIDOR_WALL_BASE;
            this.graphics.fillStyle(panelColor, 0.7);

            // Left wall panel strip
            fillQuad(leftX0, topY0, leftX1, topY1, leftX1, botY1, leftX0, botY0);

            // Right wall panel strip (mirror)
            const rightX0 = CANVAS_W - leftX0;
            const rightX1 = CANVAS_W - leftX1;
            fillQuad(rightX1, topY1, rightX0, topY0, rightX0, botY0, rightX1, botY1);
        }

        // ---- FLOOR GRID LINES ----
        this.graphics.lineStyle(1, CORRIDOR_GRID_LINE, 0.6);
        const NUM_FLOOR_LINES = 8;
        for (let i = 1; i <= NUM_FLOOR_LINES; i++) {
            const t = Math.pow(i / (NUM_FLOOR_LINES + 1), 0.7); // exponential spacing
            const y = Phaser.Math.Linear(CANVAS_H, VY, t);
            const xLeft = Phaser.Math.Linear(0, VX, t);
            const xRight = CANVAS_W - xLeft;
            this.graphics.beginPath();
            this.graphics.moveTo(xLeft, y);
            this.graphics.lineTo(xRight, y);
            this.graphics.strokePath();
        }

        // ---- CEILING GRID LINES ----
        for (let i = 1; i <= NUM_FLOOR_LINES; i++) {
            const t = Math.pow(i / (NUM_FLOOR_LINES + 1), 0.7);
            const y = Phaser.Math.Linear(0, VY, t);
            const xLeft = Phaser.Math.Linear(0, VX, t);
            const xRight = CANVAS_W - xLeft;
            this.graphics.beginPath();
            this.graphics.moveTo(xLeft, y);
            this.graphics.lineTo(xRight, y);
            this.graphics.strokePath();
        }

        // ---- VERTICAL CONVERGING LINES (floor + ceiling) ----
        const vLines = [-2, -1, 0, 1, 2];
        for (const lane of vLines) {
            const xNear = VX + lane * 65;
            this.graphics.lineStyle(1, CORRIDOR_GRID_LINE, 0.4);
            // Floor: near bottom → vanish
            this.graphics.beginPath();
            this.graphics.moveTo(xNear, CANVAS_H);
            this.graphics.lineTo(VX, VY);
            this.graphics.strokePath();
            // Ceiling: near top → vanish
            this.graphics.beginPath();
            this.graphics.moveTo(xNear, 0);
            this.graphics.lineTo(VX, VY);
            this.graphics.strokePath();
        }

        // ---- DEPTH FOG (far end darkens) ----
        for (let i = 0; i < 5; i++) {
            const t = i / 4;
            const fogAlpha = Phaser.Math.Linear(0.0, 0.45, t);
            const y = Phaser.Math.Linear(VY, VY - 20, t); // thin band near vanish
            const x = Phaser.Math.Linear(VX, VX, t);
            const halfW = Phaser.Math.Linear(0, 30, 1 - t);
            const halfH = Phaser.Math.Linear(0, 15, 1 - t);
            this.graphics.fillStyle(0x000000, fogAlpha);
            this.graphics.fillRect(x - halfW, y - halfH, halfW * 2, halfH * 2);
        }

        // ---- PIXEL-ART GUN (bottom center) ----
        const gunX = CANVAS_W / 2 - 30;
        const gunY = CANVAS_H - 140;
        // Hand
        this.graphics.fillStyle(0x9c6040, 1);
        this.graphics.fillRect(gunX + 10, gunY + 60, 50, 70);   // fist
        this.graphics.fillStyle(0x7a4c30, 1);
        this.graphics.fillRect(gunX + 10, gunY + 110, 50, 20);   // wrist shadow
        // Gun barrel
        this.graphics.fillStyle(0x2a2a2a, 1);
        this.graphics.fillRect(gunX + 15, gunY + 20, 30, 50);   // body
        this.graphics.fillRect(gunX + 22, gunY, 16, 25);         // barrel
        this.graphics.fillStyle(0x444444, 1);
        this.graphics.fillRect(gunX + 15, gunY + 20, 8, 20);     // slide highlight
        this.graphics.fillStyle(0x111111, 1);
        this.graphics.fillRect(gunX + 22, gunY + 2, 4, 18);      // barrel hole

        // ---- VIGNETTE (dark edges) ----
        this.graphics.fillStyle(0x000000, 0.35);
        this.graphics.fillRect(0, 0, 40, CANVAS_H);          // left
        this.graphics.fillRect(CANVAS_W - 40, 0, 40, CANVAS_H); // right
        this.graphics.fillStyle(0x000000, 0.2);
        this.graphics.fillRect(0, 0, CANVAS_W, 50);           // top
        this.graphics.fillRect(0, CANVAS_H - 80, CANVAS_W, 80); // bottom

        // --- HUD ELEMENTS ---

        // Top bar background
        this.graphics.fillStyle(HUD_TOP_BG, 1);
        this.graphics.fillRect(0, 0, CANVAS_W, 40);
        this.graphics.fillStyle(HUD_TOP_INNER, 1);
        this.graphics.fillRect(2, 2, CANVAS_W - 4, 36);

        // Multiplier display (styled as a "health bar" in the top HUD)
        const healthBarWidth = 120;
        const healthBarHeight = 24;
        const healthBarX = 10;
        const healthBarY = 8;

        this.graphics.lineStyle(1, HUD_HEALTH_GRID, 1);
        this.graphics.fillStyle(HUD_HEALTH_GRID, 1);

        // Grid background for the health-style bar
        for (let x = 0; x < healthBarWidth; x += 10) {
            this.graphics.beginPath(); this.graphics.moveTo(healthBarX + x, healthBarY); this.graphics.lineTo(healthBarX + x, healthBarY + healthBarHeight); this.graphics.strokePath();
        }
        for (let y = 0; y < healthBarHeight; y += 8) {
            this.graphics.beginPath(); this.graphics.moveTo(healthBarX, healthBarY + y); this.graphics.lineTo(healthBarX + healthBarWidth, healthBarY + y); this.graphics.strokePath();
        }
        this.graphics.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

        // Multiplier bar (will be updated dynamically)
        this.graphics.fillStyle(HUD_HEALTH_GREEN, 1);
        this.graphics.fillRect(healthBarX + 2, healthBarY + 2, healthBarWidth - 4, healthBarHeight - 4); // Placeholder

        this.multiplierText = this.scene.add.text(
            CANVAS_W / 2,
            CANVAS_H * 0.05, // Positioned within the top bar
            "1.00x",
            {
                fontFamily: "Press Start 2P",
                fontSize: "24px", // Smaller for HUD
                color: GOLD_STR,
                align: "center",
                stroke: "#000000",
                strokeThickness: 4
            }
        ).setOrigin(0.5).setDepth(10);

        this.statusText = this.scene.add.text(
            CANVAS_W / 2,
            CANVAS_H * 0.1, // Below the multiplier for status
            "PLACE YOUR BET",
            {
                fontFamily: "Press Start 2P",
                fontSize: HUD_FONT_SIZE,
                color: TEXT_COLOR,
                align: "center"
            }
        ).setOrigin(0.5).setDepth(10);

        // Bet amount selection
        const betButtonY = CANVAS_H * 0.82;
        const betButtonWidth = 50;
        const betButtonHeight = 40;
        const betButtonSpacing = 10;
        const totalBetButtonsWidth = (BET_AMOUNTS.length * betButtonWidth) + ((BET_AMOUNTS.length - 1) * betButtonSpacing);
        let currentX = (CANVAS_W - totalBetButtonsWidth) / 2 + betButtonWidth / 2;

        BET_AMOUNTS.forEach((amount, _index) => {
            const button = this.scene.add.rectangle(currentX, betButtonY, betButtonWidth, betButtonHeight, HUD_CONTROL_BG, 1)
                .setOrigin(0.5)
                .setStrokeStyle(2, HUD_CONTROL_BORDER)
                .setInteractive({ useHandCursor: true })
                .setDepth(10);
            const text = this.scene.add.text(
                currentX, betButtonY,
                `$${amount.toFixed(2)}`,
                {
                    fontFamily: "Press Start 2P",
                    fontSize: "12px",
                    color: TEXT_COLOR
                }
            ).setOrigin(0.5).setDepth(11);

            button.on("pointerdown", () => this.onBetSelected(amount));
            this.betButtons.push(button);
            this.betButtonTexts.push(text);

            currentX += betButtonWidth + betButtonSpacing;
        });

        this.currentBetText = this.scene.add.text(
            CANVAS_W / 2,
            CANVAS_H * 0.77,
            `BET: $${this.currentBetAmount.toFixed(2)}`,
            {
                fontFamily: "Press Start 2P",
                fontSize: HUD_FONT_SIZE,
                color: TEXT_COLOR,
                align: "center"
            }
        ).setOrigin(0.5).setDepth(10);

        // Cash out button
        this.cashOutButton = this.scene.add.rectangle(
            CANVAS_W / 2,
            CANVAS_H * 0.88,
            CANVAS_W * 0.7,
            50,
            GOLD, 1
        )
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(10)
            .setVisible(false);

        this.cashOutText = this.scene.add.text(
            CANVAS_W / 2,
            CANVAS_H * 0.88,
            "CASH OUT",
            {
                fontFamily: "Press Start 2P",
                fontSize: HUD_FONT_SIZE,
                color: "#080808",
                align: "center",
                stroke: "#000000",
                strokeThickness: 2
            }
        )
            .setOrigin(0.5)
            .setDepth(11)
            .setVisible(false);

        this.cashOutButton.on("pointerdown", () => this.onCashOutPressed());

        // Enemy Container
        this.enemyContainer = this.scene.add.container(0, 0).setDepth(5);

        // Screen flash rectangle
        this.screenFlashRect = this.scene.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0xffffff, 0)
            .setOrigin(0, 0)
            .setDepth(100);

        // Crash Overlay
        this.crashOverlay = this.scene.add.rectangle(0, 0, CANVAS_W, CANVAS_H, BG_COLOR, 0)
            .setOrigin(0, 0)
            .setDepth(90)
            .setVisible(false);

        this.crashText = this.scene.add.text(
            CANVAS_W / 2,
            CANVAS_H / 2,
            "GAME OVER",
            {
                fontFamily: "Press Start 2P",
                fontSize: "48px",
                color: DANGER_STR,
                align: "center",
                stroke: "#000000",
                strokeThickness: 8
            }
        )
            .setOrigin(0.5)
            .setDepth(91)
            .setVisible(false);

        // Draw Gun (pixel art)
        this.drawGun();

        // Vignette (dark semi-transparent bands at screen edges)
        this.graphics.fillStyle(0x000000, 0.3); // Medium dark for vignette

        // Top band
        this.graphics.fillRect(0, 0, CANVAS_W, 60);
        // Bottom band
        this.graphics.fillRect(0, CANVAS_H - 100, CANVAS_W, 100);
        // Left band (overlaps top/bottom)
        this.graphics.fillRect(0, 0, 40, CANVAS_H);
        // Right band (overlaps top/bottom)
        this.graphics.fillRect(CANVAS_W - 40, 0, 40, CANVAS_H);
    }

    private drawGun(): void {
        const gunGraphics = this.scene.add.graphics().setDepth(15);
        const gunBaseX = CANVAS_W / 2;
        const gunBaseY = CANVAS_H * 0.98; // Slightly off screen for perspective

        // Chunky fist/hand shape (simplified)
        gunGraphics.fillStyle(GUN_SKIN_BASE, 1);
        gunGraphics.fillRect(gunBaseX - 30, gunBaseY - 100, 60, 80); // Palm
        gunGraphics.fillRect(gunBaseX - 50, gunBaseY - 120, 20, 40); // Thumb
        gunGraphics.fillRect(gunBaseX + 30, gunBaseY - 120, 20, 40); // Finger base

        // Pistol barrel (simple rectangles)
        gunGraphics.fillStyle(GUN_BODY_BASE, 1);
        gunGraphics.fillRect(gunBaseX - 20, gunBaseY - 160, 40, 80); // Main body
        gunGraphics.fillStyle(GUN_BODY_HIGHLIGHT, 1);
        gunGraphics.fillRect(gunBaseX - 18, gunBaseY - 158, 36, 6); // Top highlight
        gunGraphics.fillStyle(GUN_BODY_BASE, 1);
        gunGraphics.fillRect(gunBaseX - 10, gunBaseY - 200, 20, 40); // Barrel
        gunGraphics.fillStyle(GUN_BODY_HIGHLIGHT, 1);
        gunGraphics.fillRect(gunBaseX - 8, gunBaseY - 198, 16, 4); // Barrel highlight

        // Trigger guard
        gunGraphics.fillStyle(GUN_BODY_BASE, 1);
        gunGraphics.fillRect(gunBaseX - 10, gunBaseY - 110, 20, 20);

        // Magazine (bottom part)
        gunGraphics.fillStyle(GUN_BODY_BASE, 1);
        gunGraphics.fillRect(gunBaseX - 15, gunBaseY - 60, 30, 40);
        gunGraphics.fillStyle(GUN_BODY_HIGHLIGHT, 1);
        gunGraphics.fillRect(gunBaseX - 13, gunBaseY - 58, 26, 4);
    }

    updateState(state: DoomCrashState): void {
        this.multiplierText.setText(state.currentMultiplier.toFixed(2) + "x");
        if (state.currentMultiplier > 10) {
            this.multiplierText.setColor(DANGER_STR);
        } else {
            this.multiplierText.setColor(GOLD_STR);
        }

        // Update multiplier "health" bar
        const healthBarX = 10;
        const healthBarY = 8;
        const healthBarWidth = 120;
        const healthBarHeight = 24;
        const multiplierProgress = Math.min(1, state.currentMultiplier / 100); // Max at 100x for progress bar example
        const filledWidth = (healthBarWidth - 4) * multiplierProgress;

        // Redraw the multiplier bar
        this.graphics.setDepth(0); // Ensure it's above corridor but below text
        this.graphics.fillStyle(HUD_HEALTH_GRID, 1);
        this.graphics.fillRect(healthBarX + 2, healthBarY + 2, healthBarWidth - 4, healthBarHeight - 4); // Clear previous fill
        this.graphics.fillStyle(HUD_HEALTH_GREEN, 1);
        this.graphics.fillRect(healthBarX + 2, healthBarY + 2, filledWidth, healthBarHeight - 4);


        this.currentBetText.setText(`BET: $${this.currentBetAmount.toFixed(2)}`);

        if (state.isCashedOut) {
            this.statusText.setText("CASHED OUT");
        } else if (state.isCrashed) {
            this.statusText.setText("CRASHED");
        } else if (state.isRunning) {
            this.statusText.setText("RUNNING");
        } else {
            this.statusText.setText("PLACE YOUR BET");
        }

        this.cashOutButton.setVisible(state.isRunning);
        this.cashOutText.setVisible(state.isRunning);

        this.betButtons.forEach(btn => btn.setVisible(!state.isRunning));
        this.betButtonTexts.forEach(txt => txt.setVisible(!state.isRunning));
        this.currentBetText.setVisible(!state.isRunning || state.isCashedOut);

        if (state.isRunning) {
            this.renderEnemies(state.activeEnemies, this.scene.time.now);
        } else {
            // Clear all enemies if game is not running
            this.enemySprites.forEach(sprite => sprite.destroy());
            this.enemySprites.clear();
            this.enemyContainer.removeAll(true);
        }
    }

    renderEnemies(enemies: Enemy[], nowMs: number): void {
        const activeEnemyIds = new Set(enemies.map(e => e.id));

        // Remove old enemies
        this.enemySprites.forEach((sprite, id) => {
            if (!activeEnemyIds.has(id)) {
                sprite.destroy();
                this.enemySprites.delete(id);
            }
        });

        // Add/update new/existing enemies
        enemies.forEach(enemy => {
            let enemyGraphics = this.enemySprites.get(enemy.id);

            // Calculate depth (0 = far, 1 = near)
            const depth = Phaser.Math.Clamp(
                (nowMs - enemy.spawnedAt) / (enemy.hitWindowEnd - enemy.spawnedAt),
                0, 1
            );

            const scale = ENEMY_MIN_SCALE + (ENEMY_MAX_SCALE - ENEMY_MIN_SCALE) * depth;

            // Horizontal spread based on ID for variety
            const spreadFactor = ((enemy.id.charCodeAt(0) % 5) - 2) / 2; // -2, -1, 0, 1, 2
            const x3D_offset = spreadFactor * 50; // Smaller 3D offset for perspective
            const y3D_offset = depth * 100; // Enemies appear lower as they approach

            const projected = project3DTo2D(x3D_offset, y3D_offset, 1 - depth, CORRIDOR_VANISH_X, CORRIDOR_VANISH_Y);
            const x = projected.x;
            const y = projected.y;

            if (!enemyGraphics) {
                enemyGraphics = this.scene.add.graphics();
                enemyGraphics.setInteractive(new Phaser.Geom.Rectangle(-ENEMY_HITBOX_BASE_SIZE / 2, -ENEMY_HITBOX_BASE_SIZE / 2, ENEMY_HITBOX_BASE_SIZE, ENEMY_HITBOX_BASE_SIZE), Phaser.Geom.Rectangle.Contains)
                    .on("pointerdown", () => this.onEnemyTapped(enemy.id));
                this.enemyContainer.add(enemyGraphics);
                this.enemySprites.set(enemy.id, enemyGraphics);
            } else {
                enemyGraphics.clear(); // Clear to redraw for scaling/position
            }
            
            enemyGraphics.x = x;
            enemyGraphics.y = y;
            enemyGraphics.setScale(scale);
            enemyGraphics.setAlpha(1 - (depth * 0.3)); // Fades out slightly as it gets closer
            
            this.drawPixelEnemy(enemyGraphics, enemy.type, ENEMY_COLOR[enemy.type]);
        });
    }

    private drawPixelEnemy(graphics: Phaser.GameObjects.Graphics, type: EnemyType, color: number): void {
        graphics.clear();
        const baseSize = ENEMY_HITBOX_BASE_SIZE; // Enemy "pixel" art will be scaled by this
        const halfSize = baseSize / 2;
        graphics.fillStyle(color, 1);
        
        // Ensure fillRects are relative to graphics origin (0,0) before scaling
        graphics.save();
        graphics// .translate( // not available - -halfSize, -halfSize); // Center the drawing around (0,0) before scaling

        switch (type) {
            case "IMP":
                // Simple red/orange demon face (skull shape with eyes/mouth)
                graphics.fillRect(halfSize - 20, halfSize - 30, 40, 40); // Head base
                graphics.fillStyle(0x000000, 1);
                graphics.fillRect(halfSize - 10, halfSize - 20, 8, 8); // Left Eye
                graphics.fillRect(halfSize + 2, halfSize - 20, 8, 8); // Right Eye
                graphics.fillRect(halfSize - 10, halfSize + 5, 20, 5); // Mouth
                graphics.fillStyle(color, 1);
                graphics.fillRect(halfSize - 30, halfSize - 50, 6, 20); // Left Horn
                graphics.fillRect(halfSize + 24, halfSize - 50, 6, 20); // Right Horn
                break;
            case "DEMON":
                // Medium pink blob shape
                graphics.fillStyle(0x990000, 1); // Darker pink/red
                graphics.fillRect(halfSize - 30, halfSize - 20, 60, 50); // Body
                graphics.fillRect(halfSize - 40, halfSize - 10, 10, 30); // Left arm
                graphics.fillRect(halfSize + 30, halfSize - 10, 10, 30); // Right arm
                graphics.fillStyle(0x000000, 1);
                graphics.fillRect(halfSize - 15, halfSize - 5, 5, 5); // Left eye
                graphics.fillRect(halfSize + 10, halfSize - 5, 5, 5); // Right eye
                graphics.fillRect(halfSize - 10, halfSize + 10, 20, 5); // Mouth
                break;
            case "CACODEMON":
                // Large round eye-ball shape
                graphics.fillStyle(0x660099, 1); // Purple
                graphics.fillCircle(halfSize, halfSize, halfSize * 0.8); // Main body
                graphics.fillStyle(0xffffff, 1);
                graphics.fillCircle(halfSize, halfSize, halfSize * 0.4); // Sclera
                graphics.fillStyle(0x000000, 1);
                graphics.fillCircle(halfSize, halfSize, halfSize * 0.2); // Pupil
                break;
            case "CYBERDEMON":
                // Tall dark robotic shape
                graphics.fillStyle(0x303030, 1); // Dark grey
                graphics.fillRect(halfSize - 25, halfSize - 40, 50, 80); // Torso
                graphics.fillRect(halfSize - 15, halfSize + 40, 30, 40); // Legs
                graphics.fillStyle(0x101010, 1); // Darkest
                graphics.fillRect(halfSize - 30, halfSize - 50, 60, 10); // Shoulder line
                graphics.fillRect(halfSize - 10, halfSize - 60, 20, 20); // Head
                graphics.fillStyle(0xff0000, 1); // Red eyes
                graphics.fillRect(halfSize - 6, halfSize - 55, 4, 4);
                graphics.fillRect(halfSize + 2, halfSize - 55, 4, 4);
                graphics.fillStyle(0x808080, 1); // Metallic highlights
                graphics.fillRect(halfSize - 20, halfSize - 35, 40, 4);
                break;
        }
        graphics.restore();
    }

    showHitFlash(): void {
        this.screenFlashRect.setFillStyle(0xffffff, 0.4);
        this.scene.tweens.add({
            targets: this.screenFlashRect,
            alpha: 0,
            duration: FLASH_DURATION_MS,
            ease: "Quad.easeOut",
            onComplete: () => this.screenFlashRect.setAlpha(0)
        });
    }

    showCrashEffect(): void {
        this.scene.cameras.main.shake(400, SHAKE_INTENSITY / 1000);
        this.crashOverlay.setVisible(true);
        this.scene.tweens.add({
            targets: this.crashOverlay,
            alpha: 0.85,
            duration: 300,
            ease: "Quad.easeOut"
        });
        this.crashText.setText("GAME OVER");
        this.crashText.setColor(DANGER_STR);
        this.crashText.setVisible(true);
        this.screenFlashRect.setFillStyle(DANGER, 0.6);
        this.scene.tweens.add({
            targets: this.screenFlashRect,
            alpha: 0,
            duration: FLASH_DURATION_MS * 2,
            ease: "Quad.easeOut",
            onComplete: () => this.screenFlashRect.setAlpha(0)
        });
    }

    showCashOutEffect(multiplier: number): void {
        this.crashOverlay.setVisible(true);
        this.scene.tweens.add({
            targets: this.crashOverlay,
            alpha: 0.75,
            duration: 300,
            ease: "Quad.easeOut"
        });
        this.crashText.setText(`CASHED OUT\n${multiplier.toFixed(2)}x`);
        this.crashText.setColor(GOLD_STR);
        this.crashText.setVisible(true);
        this.screenFlashRect.setFillStyle(GOLD, 0.6);
        this.scene.tweens.add({
            targets: this.screenFlashRect,
            alpha: 0,
            duration: FLASH_DURATION_MS * 2,
            ease: "Quad.easeOut",
            onComplete: () => this.screenFlashRect.setAlpha(0)
        });
    }

    resetForNewRound(): void {
        this.crashOverlay.setVisible(false).setAlpha(0);
        this.crashText.setVisible(false);
        this.enemyContainer.removeAll(true);
        this.enemySprites.clear();
        this.multiplierText.setText("1.00x").setColor(GOLD_STR);
        this.statusText.setText("PLACE YOUR BET");
        this.cashOutButton.setVisible(false);
        this.cashOutText.setVisible(false);
        this.betButtons.forEach(btn => btn.setVisible(true));
        this.betButtonTexts.forEach(txt => txt.setVisible(true));
        this.currentBetText.setVisible(true);
    }
}
