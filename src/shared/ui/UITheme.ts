/**
 * @file UITheme.ts
 * @purpose Shared UI theme constants for all Jett Casino games.
 *          Matches the lobby aesthetic — clean, modern, Midnight Luxury.
 *          Import this in every UI.ts file. Never hardcode fonts, colors, or button styles.
 * @author Agent 934
 * @date 2026-04-24
 * @license Proprietary — available for licensing
 * @contact zero60851@gmail.com — Part of Jett Casino, raising $500k pre-seed
 */

// ─── Palette ────────────────────────────────────────────────────────────────
export const COLOR_BG         = 0x0d0d0d;   // Charcoal background
export const COLOR_SURFACE    = 0x111111;   // Card/panel surface
export const COLOR_BORDER     = 0x222222;   // Subtle borders
export const COLOR_GOLD       = 0xc9a84c;   // Primary gold accent
export const COLOR_DANGER     = 0xef4444;   // Red for crashes/losses
export const COLOR_SUCCESS    = 0x22c55e;   // Green for wins
export const COLOR_TEXT       = 0xf0f0f0;   // Primary text
export const COLOR_MUTED      = 0x888888;   // Secondary/muted text

export const STR_BG           = '#0d0d0d';
export const STR_SURFACE      = '#111111';
export const STR_BORDER       = '#222222';
export const STR_GOLD         = '#c9a84c';
export const STR_DANGER       = '#ef4444';
export const STR_SUCCESS      = '#22c55e';
export const STR_TEXT         = '#f0f0f0';
export const STR_MUTED        = '#888888';

// ─── Typography ─────────────────────────────────────────────────────────────
// Primary font — matches lobby (system-ui, clean, modern)
export const FONT_PRIMARY     = '"Inter", system-ui, -apple-system, sans-serif';
// Use for large multiplier/win numbers only
export const FONT_DISPLAY     = '"Inter", system-ui, sans-serif';

export const FONT_SIZE_XS     = '11px';
export const FONT_SIZE_SM     = '13px';
export const FONT_SIZE_BASE   = '15px';
export const FONT_SIZE_LG     = '18px';
export const FONT_SIZE_XL     = '22px';
export const FONT_SIZE_2XL    = '28px';
export const FONT_SIZE_3XL    = '36px';
export const FONT_SIZE_DISPLAY= '52px';  // Win amounts, multipliers

// Phaser text style objects — use these directly
export const TEXT_STYLE_LABEL: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONT_PRIMARY,
  fontSize: FONT_SIZE_SM,
  color: STR_MUTED,
  fontStyle: 'normal',
};

export const TEXT_STYLE_BODY: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONT_PRIMARY,
  fontSize: FONT_SIZE_BASE,
  color: STR_TEXT,
};

export const TEXT_STYLE_SEMIBOLD: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONT_PRIMARY,
  fontSize: FONT_SIZE_BASE,
  color: STR_TEXT,
  fontStyle: 'bold',
};

export const TEXT_STYLE_GOLD_SEMIBOLD: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONT_PRIMARY,
  fontSize: FONT_SIZE_BASE,
  color: STR_GOLD,
  fontStyle: 'bold',
};

export const TEXT_STYLE_DISPLAY: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONT_DISPLAY,
  fontSize: FONT_SIZE_DISPLAY,
  color: STR_GOLD,
  fontStyle: 'bold',
};

export const TEXT_STYLE_WIN: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONT_DISPLAY,
  fontSize: FONT_SIZE_3XL,
  color: STR_GOLD,
  fontStyle: 'bold',
};

// ─── Button Styles ───────────────────────────────────────────────────────────
// Primary CTA (PLAY, SPIN, CASH OUT) — gold fill, black text, rounded 10px
export const BTN_PRIMARY_BG      = COLOR_GOLD;
export const BTN_PRIMARY_TEXT    = '#000000';
export const BTN_PRIMARY_RADIUS  = 10;

// Secondary button (BET, option buttons) — dark surface, gold border
export const BTN_SECONDARY_BG     = COLOR_SURFACE;
export const BTN_SECONDARY_BORDER = COLOR_GOLD;
export const BTN_SECONDARY_TEXT   = STR_GOLD;
export const BTN_SECONDARY_RADIUS = 8;

// Danger button (e.g. cancel) — dark, red border
export const BTN_DANGER_BG     = COLOR_SURFACE;
export const BTN_DANGER_BORDER = COLOR_DANGER;
export const BTN_DANGER_TEXT   = STR_DANGER;

// Button text style
export const TEXT_STYLE_BTN_PRIMARY: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONT_PRIMARY,
  fontSize: FONT_SIZE_BASE,
  color: BTN_PRIMARY_TEXT,
  fontStyle: 'bold',
};

export const TEXT_STYLE_BTN_SECONDARY: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONT_PRIMARY,
  fontSize: FONT_SIZE_SM,
  color: BTN_SECONDARY_TEXT,
  fontStyle: 'bold',
};

// ─── Layout ──────────────────────────────────────────────────────────────────
export const CANVAS_W = 390;
export const CANVAS_H = 844;
export const NAV_HEIGHT = 60;        // Bottom nav bar
export const HUD_HEIGHT = 48;        // Top HUD bar
export const SAFE_TOP = HUD_HEIGHT;
export const SAFE_BOTTOM = CANVAS_H - NAV_HEIGHT;

// ─── Helper: draw a rounded pill button using Graphics + Text ────────────────
/**
 * Draws a primary (gold) or secondary (outlined) button.
 * Returns the Graphics and Text objects for easy positioning.
 */
export function drawButton(
  scene: Phaser.Scene,
  x: number, y: number,
  width: number, height: number,
  label: string,
  variant: 'primary' | 'secondary' | 'danger' = 'primary',
  depth = 10
): { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text } {
  const bg = scene.add.graphics().setDepth(depth);
  const radius = variant === 'primary' ? BTN_PRIMARY_RADIUS : BTN_SECONDARY_RADIUS;

  if (variant === 'primary') {
    bg.fillStyle(BTN_PRIMARY_BG, 1);
    bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
  } else if (variant === 'secondary') {
    bg.fillStyle(BTN_SECONDARY_BG, 1);
    bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    bg.lineStyle(1.5, BTN_SECONDARY_BORDER, 1);
    bg.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius);
  } else {
    bg.fillStyle(BTN_DANGER_BG, 1);
    bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    bg.lineStyle(1.5, BTN_DANGER_BORDER, 1);
    bg.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius);
  }

  const textStyle = variant === 'primary' ? TEXT_STYLE_BTN_PRIMARY : TEXT_STYLE_BTN_SECONDARY;
  const text = scene.add.text(x, y, label, textStyle)
    .setOrigin(0.5)
    .setDepth(depth + 1);

  return { bg, text };
}
