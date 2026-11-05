/**
 * @file SoftDepthTheme.ts
 * @purpose Semantic design tokens for the polish-003 "Soft Depth / Refined 2D" shell.
 *          Pure TS (no Phaser). Casino branding swaps only the brand tokens (accent, CTA, focus,
 *          background tint). Success/loss semantics, geometry, contrast and all game math are
 *          locked and never vary by theme. Source: docs/polish-003/design-tokens.json + revision 004.
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */

/** Theme identifiers available to casino partners. */
export type ThemeName = 'gold' | 'emerald' | 'violet';

/** Fully resolved token set (hex strings `#rrggbb`). */
export interface SoftDepthTokens {
  name: ThemeName;
  highContrast: boolean;
  /** Page/app background behind the shell. */
  background: string;
  /** Header/footer panels and cards. */
  surface: string;
  /** Raised surface (results card, settings). */
  surfaceRaised: string;
  /** Hairline separators. */
  line: string;
  /** Default stage fill (games paint their own world on top). */
  stage: string;
  text: string;
  muted: string;
  success: string;
  loss: string;
  /** Brand accent (multiplier, current-row outline, highlights). */
  accent: string;
  /** Primary CTA fill. Flat. */
  cta: string;
  /** Text on the CTA. */
  ctaText: string;
  /** Keyboard focus ring. */
  focus: string;
}

/** Locked base tokens (not brandable). */
const BASE = {
  background: '#0d121a',
  surface: '#131c27',
  surfaceRaised: '#1a2635',
  line: '#26344a',
  stage: '#1b2940',
  text: '#e8edf4',
  muted: '#a6b3c4',
  success: '#75d6b1',
  loss: '#ebbfaa',
} as const;

/** Brandable tokens per theme. CTA text is dark ink on all three accents (contrast-tested). */
const BRAND: Record<ThemeName, Pick<SoftDepthTokens, 'accent' | 'cta' | 'ctaText' | 'focus'>> = {
  gold:    { accent: '#d6b76f', cta: '#d6b76f', ctaText: '#1a1408', focus: '#f0d896' },
  emerald: { accent: '#64d6b2', cta: '#64d6b2', ctaText: '#06201a', focus: '#a8f0d8' },
  violet:  { accent: '#b4a1f0', cta: '#b4a1f0', ctaText: '#170f33', focus: '#d8cdfb' },
};

/** High-contrast overrides applied on top of any theme. */
const HIGH_CONTRAST = { muted: '#d4dce6', line: '#5a6d88', text: '#ffffff' } as const;

/** Names in display order. */
export const THEME_NAMES: readonly ThemeName[] = ['gold', 'emerald', 'violet'];

/**
 * Resolves tokens for a theme.
 * @param name - Theme name.
 * @param highContrast - Apply the high-contrast overrides.
 * @returns Token set.
 * @example
 * const t = resolveTheme('emerald');
 */
export function resolveTheme(name: ThemeName = 'gold', highContrast = false): SoftDepthTokens {
  const brand = BRAND[name] ?? BRAND.gold;
  return { name: BRAND[name] ? name : 'gold', highContrast, ...BASE, ...brand, ...(highContrast ? HIGH_CONTRAST : {}) };
}

/**
 * Converts `#rrggbb` to a Phaser-style 0xRRGGBB number.
 * @param hex - Colour string.
 * @returns Integer colour.
 * @example
 * hexToInt('#d6b76f'); // 0xd6b76f
 */
export function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * WCAG 2.x relative luminance.
 * @param hex - `#rrggbb`.
 * @returns Luminance in [0, 1].
 * @example
 * relativeLuminance('#ffffff'); // 1
 */
export function relativeLuminance(hex: string): number {
  const n = hexToInt(hex);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/**
 * WCAG contrast ratio between two opaque colours.
 * @param a - Foreground.
 * @param b - Background.
 * @returns Ratio in [1, 21].
 * @example
 * contrastRatio('#000000', '#ffffff'); // 21
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a); const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Shell geometry in the 390×844 logical viewport (docs/polish-003/ART_AND_LAYOUT.md). */
export const SHELL = {
  width: 390,
  height: 844,
  headerBottom: 56,
  hudBottom: 136,
  stage: { x: 16, y: 136, width: 358, height: 544, radius: 14 },
  controlsTop: 692,
  cta: { x: 20, y: 754, width: 350, height: 52 },
  iconHit: 44,
  fontPx: { title: 14, label: 11, progress: 12, multiplier: 37, stake: 19, cta: 14, demoLabel: 11 },
} as const;

/** Persistent no-cash-value copy. */
export const DEMO_CREDITS_LABEL = 'Demo credits have no cash value';
