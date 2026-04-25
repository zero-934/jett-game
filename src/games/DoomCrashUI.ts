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
const GOLD = 0xc9a84c;
const GOLD_STR = "#c9a84c";
const DANGER = 0xef4444;
const DANGER_STR = "#ef4444";
const BG_COLOR = 0x080808;
const SURFACE = 0x111111;
const TEXT_COLOR = "#f0f0f0";
const CORRIDOR_VANISH_X = CANVAS_W / 2;
const CORRIDOR_VANISH_Y = CANVAS_H * 0.42;
const CORRIDOR_FLOOR_LEFT_X = 0;
const CORRIDOR_FLOOR_RIGHT_X = CANVAS_W;
const CORRIDOR_FLOOR_Y = CANVAS_H * 0.72;
const CORRIDOR_CEIL_Y = CANVAS_H * 0.12;
const ENEMY_MAX_SCALE = 1.4;
const ENEMY_MIN_SCALE = 0.15;
const ENEMY_HITBOX_BASE_SIZE = 80;
const MULTIPLIER_FONT_SIZE = "72px";
const HUD_FONT_SIZE = "18px";
const FLASH_DURATION_MS = 120;
const SHAKE_INTENSITY = 6;
const ENEMY_EMOJI: Record<EnemyType, string> = { IMP: "👿", DEMON: "😈", CACODEMON: "👁️", CYBERDEMON: "💀" };
const ENEMY_COLOR: Record<EnemyType, number> = { IMP: 0xcc3300, DEMON: 0x990000, CACODEMON: 0x660099, CYBERDEMON: 0xff0000 };
// const NAV_BAR_HEIGHT = 60; // reserved for scene wiring
const BET_AMOUNTS = [0.5, 1, 2, 5, 10];

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
    private enemySprites: Map<string, Phaser.GameObjects.Text> = new Map();
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

        // Fill background
        this.graphics.fillStyle(BG_COLOR, 1);
        this.graphics.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Corridor floor/ceiling fill
        this.graphics.fillStyle(0x0d0d0d, 1);
        this.graphics.fillTriangle(
            CORRIDOR_FLOOR_LEFT_X, CORRIDOR_FLOOR_Y,
            CORRIDOR_FLOOR_RIGHT_X, CORRIDOR_FLOOR_Y,
            CORRIDOR_VANISH_X, CORRIDOR_VANISH_Y
        );
        this.graphics.fillStyle(0x151515, 1);
        this.graphics.fillTriangle(
            0, CORRIDOR_CEIL_Y,
            CANVAS_W, CORRIDOR_CEIL_Y,
            CORRIDOR_VANISH_X, CORRIDOR_VANISH_Y
        );

        // Corridor lines
        this.graphics.lineStyle(1, 0x1a1a1a, 0.8);

        // Floor lines
        this.graphics.beginPath();
        this.graphics.moveTo(CORRIDOR_FLOOR_LEFT_X, CORRIDOR_FLOOR_Y);
        this.graphics.lineTo(CORRIDOR_VANISH_X, CORRIDOR_VANISH_Y);
        this.graphics.moveTo(CORRIDOR_FLOOR_RIGHT_X, CORRIDOR_FLOOR_Y);
        this.graphics.lineTo(CORRIDOR_VANISH_X, CORRIDOR_VANISH_Y);
        this.graphics.strokePath();

        // Ceiling lines
        this.graphics.beginPath();
        this.graphics.moveTo(0, CORRIDOR_CEIL_Y);
        this.graphics.lineTo(CORRIDOR_VANISH_X, CORRIDOR_VANISH_Y);
        this.graphics.moveTo(CANVAS_W, CORRIDOR_CEIL_Y);
        this.graphics.lineTo(CORRIDOR_VANISH_X, CORRIDOR_VANISH_Y);
        this.graphics.strokePath();

        // Side wall horizontal lines (perspective grid effect)
        const numLines = 5;
        for (let i = 1; i <= numLines; i++) {
            const depthFactor = i / (numLines + 1);
            const y = Phaser.Math.Linear(CORRIDOR_CEIL_Y, CORRIDOR_FLOOR_Y, depthFactor);

            const leftX = Phaser.Math.Linear(0, CORRIDOR_VANISH_X, depthFactor);
            // rightX unused: line draws symmetrically via CANVAS_W - leftX

            this.graphics.beginPath();
            this.graphics.moveTo(leftX, y);
            this.graphics.lineTo(CANVAS_W - leftX, y);
            this.graphics.strokePath();
        }

        this.multiplierText = this.scene.add.text(
            CANVAS_W / 2,
            CANVAS_H * 0.1,
            "1.00x",
            {
                fontFamily: "Press Start 2P",
                fontSize: MULTIPLIER_FONT_SIZE,
                color: GOLD_STR,
                align: "center",
                stroke: "#000000",
                strokeThickness: 8
            }
        ).setOrigin(0.5).setDepth(10);

        this.statusText = this.scene.add.text(
            CANVAS_W / 2,
            CANVAS_H * 0.22,
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
            const button = this.scene.add.rectangle(currentX, betButtonY, betButtonWidth, betButtonHeight, SURFACE, 1)
                .setOrigin(0.5)
                .setStrokeStyle(1, GOLD)
                .setInteractive({ useHandCursor: true })
                .setDepth(10);
            const text = this.scene.add.text(
                currentX, betButtonY,
                `$${amount.toFixed(2)}`,
                {
                    fontFamily: "Press Start 2P",
                    fontSize: "14px",
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
    }

    updateState(state: DoomCrashState): void {
        this.multiplierText.setText(state.currentMultiplier.toFixed(2) + "x");
        if (state.currentMultiplier > 10) {
            this.multiplierText.setColor(DANGER_STR);
        } else {
            this.multiplierText.setColor(GOLD_STR);
        }

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
            let enemySprite = this.enemySprites.get(enemy.id);

            // Calculate depth (0 = far, 1 = near)
            const depth = Phaser.Math.Clamp(
                (nowMs - enemy.spawnedAt) / (enemy.hitWindowEnd - enemy.spawnedAt),
                0, 1
            );

            const scale = ENEMY_MIN_SCALE + (ENEMY_MAX_SCALE - ENEMY_MIN_SCALE) * depth;

            // Horizontal spread based on ID for variety
            const spreadFactor = ((enemy.id.charCodeAt(0) % 5) - 2) / 2; // -2, -1, 0, 1, 2
            const xOffset = spreadFactor * (CANVAS_W * 0.25) * depth;

            const x = CORRIDOR_VANISH_X + xOffset;
            const y = CORRIDOR_VANISH_Y + (CORRIDOR_FLOOR_Y - CORRIDOR_VANISH_Y) * depth * 0.6; // Enemies appear closer to floor as they approach

            if (!enemySprite) {
                enemySprite = this.scene.add.text(x, y, ENEMY_EMOJI[enemy.type], {
                    fontFamily: "Arial", // Emoji font
                    fontSize: `${ENEMY_HITBOX_BASE_SIZE}px`,
                    color: TEXT_COLOR
                })
                    .setOrigin(0.5)
                    .setInteractive({ useHandCursor: true })
                    .on("pointerdown", () => this.onEnemyTapped(enemy.id));
                this.enemyContainer.add(enemySprite);
                this.enemySprites.set(enemy.id, enemySprite);
            } else {
                enemySprite.setPosition(x, y);
            }

            // Adjust font size directly to change visual size for emojis
            const fontSizePx = ENEMY_HITBOX_BASE_SIZE * scale;
            enemySprite.setFontSize(fontSizePx);
            enemySprite.setTint(ENEMY_COLOR[enemy.type]);
            // Make enemies slightly transparent as they get closer to 1.0 depth, indicating they are about to hit.
            // Or make them pulse, but for now just a tint is sufficient.
            enemySprite.setAlpha(1 - (depth * 0.3)); // Fades out slightly as it gets closer
        });
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
