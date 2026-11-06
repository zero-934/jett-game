/**
 * @file Brand.ts
 * @purpose Operator branding for the shared game shell (pure TS, no Phaser). A brand may change
 *          ONLY presentation: accent/CTA/focus colours, surface tint, control radius, font
 *          family (from the self-hosted allowlist), wordmark and an allowlisted logo URL.
 *          Locked and never brandable: success/loss semantics, demo-credit labelling, layout,
 *          hit targets, game math. Every brand is validated (contrast ≥ 4.5:1 for text and CTA
 *          label) and rejected as a whole if invalid, falling back to the approved default.
 *          The two non-default brands are FICTIONAL examples for configurability tests only.
 * @author Agent 934
 * @date 2026-11-06
 * @license Proprietary – available for licensing
 */
import { contrastRatio, resolveTheme } from '../ui/SoftDepthTheme';
import type { SoftDepthTokens, ThemeName } from '../ui/SoftDepthTheme';

/** Fonts that are actually shipped (public/fonts). Anything else falls back to the system stack. */
export const ALLOWED_FONT_FAMILIES = ['Inter', 'system'] as const;
export type BrandFont = typeof ALLOWED_FONT_FAMILIES[number];

/** Operator brand configuration (presentation only). */
export interface BrandConfig {
  id: string;
  /** Shown in the header next to the game title (short, plain text). */
  wordmark: string;
  /** Optional logo: relative path under the app or https URL on an allowlisted host. */
  logoUrl?: string;
  /** If set, these replace the player's theme accent (the in-game theme picker is hidden). */
  colors?: Partial<Pick<SoftDepthTokens, 'accent' | 'cta' | 'ctaText' | 'focus' | 'surface' | 'surfaceRaised' | 'background' | 'line'>>;
  font?: BrandFont;
  /** Control corner radius in logical px (clamped 4–16). */
  controlRadius?: number;
}

/** Hosts a brand logo may be loaded from (empty = only relative app paths). */
export const LOGO_HOST_ALLOWLIST: readonly string[] = [];

const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[a-z0-9-]{2,32}$/;
const MAX_WORDMARK = 24;

/** The approved default (polish-003 Refined2D). Player theme picker stays available. */
export const DEFAULT_BRAND: BrandConfig = { id: 'jett-default', wordmark: '', font: 'Inter', controlRadius: 12 };

/** FICTIONAL example A — cool teal, squarer controls. Not a real operator. */
export const EXAMPLE_BRAND_HARBOR: BrandConfig = {
  id: 'example-harbor-lights', wordmark: 'HARBOR LIGHTS', font: 'Inter', controlRadius: 6,
  colors: { accent: '#5fd0d8', cta: '#5fd0d8', ctaText: '#04191b', focus: '#b5f1f4', surface: '#10202a', surfaceRaised: '#16303c', background: '#0a161d', line: '#244656' },
};

/** FICTIONAL example B — warm coral, rounder controls, system font. Not a real operator. */
export const EXAMPLE_BRAND_ORCHID: BrandConfig = {
  id: 'example-orchid-club', wordmark: 'ORCHID CLUB', font: 'system', controlRadius: 16,
  colors: { accent: '#f2a07b', cta: '#f2a07b', ctaText: '#2a1006', focus: '#ffd2bd', surface: '#1f1620', surfaceRaised: '#2a1e2b', background: '#150f16', line: '#3e2d40' },
};

/** Registry of known brands (by id). */
export const BRANDS: Record<string, BrandConfig> = {
  [DEFAULT_BRAND.id]: DEFAULT_BRAND,
  [EXAMPLE_BRAND_HARBOR.id]: EXAMPLE_BRAND_HARBOR,
  [EXAMPLE_BRAND_ORCHID.id]: EXAMPLE_BRAND_ORCHID,
};

/**
 * Validates a logo URL: relative app paths, or https on an allowlisted host. Rejects
 * javascript:, data:, blob:, protocol-relative and credentials-bearing URLs.
 * @param url - Untrusted string.
 * @param allowlist - Allowed https hosts.
 * @returns Whether it is safe to use as an <img src>.
 * @example
 * isSafeLogoUrl('assets/brand/logo.svg'); // true
 * isSafeLogoUrl('javascript:alert(1)'); // false
 */
export function isSafeLogoUrl(url: unknown, allowlist: readonly string[] = LOGO_HOST_ALLOWLIST): boolean {
  if (typeof url !== 'string' || url.length === 0 || url.length > 300) return false;
  if (/^\s|[\u0000-\u001f\\]/.test(url)) return false;
  if (url.startsWith('//')) return false;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  if (!scheme) return /^[A-Za-z0-9_./-]+\.(svg|png|webp)$/.test(url) && !url.includes('..');
  if (scheme[1].toLowerCase() !== 'https') return false;
  try {
    const u = new URL(url);
    return !u.username && !u.password && allowlist.includes(u.hostname);
  } catch { return false; }
}

/** Validation result. */
export interface BrandValidation { ok: boolean; errors: string[] }

/**
 * Validates a brand against the locked rules (tokens resolved over `theme`).
 * @param brand - Candidate (untrusted).
 * @param theme - Player theme used underneath.
 * @returns Result with reasons.
 * @example
 * validateBrand(EXAMPLE_BRAND_HARBOR).ok; // true
 */
export function validateBrand(brand: unknown, theme: ThemeName = 'gold'): BrandValidation {
  const errors: string[] = [];
  const b = brand as BrandConfig;
  if (!b || typeof b !== 'object') return { ok: false, errors: ['not an object'] };
  if (typeof b.id !== 'string' || !ID.test(b.id)) errors.push('id');
  if (typeof b.wordmark !== 'string' || b.wordmark.length > MAX_WORDMARK || /[<>&"'`]/.test(b.wordmark)) errors.push('wordmark');
  if (b.logoUrl !== undefined && !isSafeLogoUrl(b.logoUrl)) errors.push('logoUrl');
  if (b.font !== undefined && !ALLOWED_FONT_FAMILIES.includes(b.font)) errors.push('font');
  if (b.controlRadius !== undefined && (typeof b.controlRadius !== 'number' || !Number.isFinite(b.controlRadius))) errors.push('controlRadius');
  if (b.colors !== undefined) {
    if (typeof b.colors !== 'object' || b.colors === null) errors.push('colors');
    else for (const [k, v] of Object.entries(b.colors)) if (typeof v !== 'string' || !HEX.test(v)) errors.push(`colors.${k}`);
  }
  if (errors.length === 0) {
    const t = applyBrandTokens(resolveTheme(theme), b);
    if (contrastRatio(t.text, t.surface) < 4.5) errors.push('contrast text/surface');
    if (contrastRatio(t.text, t.surfaceRaised) < 4.5) errors.push('contrast text/surfaceRaised');
    if (contrastRatio(t.muted, t.surface) < 4.5) errors.push('contrast muted/surface');
    if (contrastRatio(t.ctaText, t.cta) < 4.5) errors.push('contrast ctaText/cta');
    if (contrastRatio(t.accent, t.background) < 3) errors.push('contrast accent/background');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Overlays brand colours on resolved theme tokens (locked semantics untouched).
 * @param tokens - Theme tokens.
 * @param brand - Brand (assumed validated).
 * @returns New token set.
 * @example
 * applyBrandTokens(resolveTheme('gold'), EXAMPLE_BRAND_ORCHID).accent; // '#f2a07b'
 */
export function applyBrandTokens(tokens: SoftDepthTokens, brand: BrandConfig): SoftDepthTokens {
  const c = brand.colors ?? {};
  // High contrast keeps its own text/muted/line overrides on top of any brand.
  const out = { ...tokens, ...c };
  if (tokens.highContrast) { out.text = tokens.text; out.muted = tokens.muted; out.line = tokens.line; }
  return out;
}

/** @returns Whether the brand fixes the accent (in-game theme picker hidden). */
export function brandLocksAccent(brand: BrandConfig): boolean { return !!brand.colors?.accent; }

/** @returns Clamped control radius in logical px. */
export function brandRadius(brand: BrandConfig): number { return Math.max(4, Math.min(16, brand.controlRadius ?? 12)); }

/** @returns CSS font stack for the brand. */
export function brandFontStack(brand: BrandConfig): string {
  return brand.font === 'system' ? 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' : '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
}

// ─── Active brand (set by the host adapter at launch; shells subscribe for live switching) ──

let activeBrand: BrandConfig = DEFAULT_BRAND;
const listeners = new Set<(b: BrandConfig) => void>();

/** @returns The active brand. */
export function getActiveBrand(): BrandConfig { return activeBrand; }

/**
 * Activates a brand if valid; otherwise keeps the current one.
 * @param brand - Candidate.
 * @returns Validation result.
 * @example
 * setActiveBrand(EXAMPLE_BRAND_HARBOR);
 */
export function setActiveBrand(brand: unknown): BrandValidation {
  const v = validateBrand(brand);
  if (!v.ok) return v;
  activeBrand = brand as BrandConfig;
  for (const fn of [...listeners]) fn(activeBrand);
  return v;
}

/**
 * Subscribes to brand changes.
 * @param fn - Listener.
 * @returns Unsubscribe function.
 * @example
 * const off = onBrandChange((b) => repaint(b)); off();
 */
export function onBrandChange(fn: (b: BrandConfig) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
