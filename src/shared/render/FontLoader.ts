/**
 * @file FontLoader.ts
 * @purpose Loads the self-hosted Inter faces (public/fonts/inter, SIL OFL 1.1) before the game
 *          boots so canvas glyphs are never rasterised with a fallback face. Records real
 *          FontFace status for diagnostics — `document.fonts.check()` alone is not evidence
 *          (it returns true when no face for the family exists at all).
 * @author Agent 934
 * @date 2026-11-06
 * @license Proprietary – available for licensing
 */

/** Weights shipped in public/fonts/inter. */
export const INTER_WEIGHTS = [400, 600, 700, 800] as const;
/** Max wait before booting with fallbacks (slow networks must not block play). */
export const FONT_TIMEOUT_MS = 2500;
/** Sample covering digits, caps and the multiplier sign so the Latin subset is fetched. */
const SAMPLE = 'Aa0123456789×·−';

/** Diagnostic result. */
export interface FontStatus {
  family: 'Inter';
  requested: number[];
  loaded: number[];
  timedOut: boolean;
  ms: number;
}

let status: FontStatus | null = null;

/**
 * Returns the last load result (null before loadShellFonts resolved).
 * @returns Status.
 * @example
 * getFontStatus()?.loaded; // [400, 600, 700, 800]
 */
export function getFontStatus(): FontStatus | null { return status; }

/**
 * Injects the Inter stylesheet (once) and waits for every weight or the timeout.
 * @param baseUrl - Vite BASE_URL (e.g. '/jett-game/').
 * @returns Status (also exposed on window.__fontStatus).
 * @example
 * await loadShellFonts(import.meta.env.BASE_URL);
 */
export async function loadShellFonts(baseUrl: string): Promise<FontStatus> {
  const t0 = performance.now();
  if (typeof document === 'undefined' || !document.fonts) {
    status = { family: 'Inter', requested: [...INTER_WEIGHTS], loaded: [], timedOut: false, ms: 0 };
    return status;
  }
  const href = `${baseUrl}fonts/inter/inter.css`;
  if (!document.querySelector(`link[data-font="inter"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; link.dataset.font = 'inter';
    const ready = new Promise<void>((resolve) => { link.onload = () => resolve(); link.onerror = () => resolve(); });
    document.head.appendChild(link);
    await ready;
  }
  let timedOut = false;
  const loads = Promise.all(INTER_WEIGHTS.map((w) => document.fonts.load(`${w} 16px Inter`, SAMPLE).catch(() => [])));
  await Promise.race([loads, new Promise<void>((r) => setTimeout(() => { timedOut = true; r(); }, FONT_TIMEOUT_MS))]);
  const loaded = new Set<number>();
  document.fonts.forEach((f) => { if (/Inter/i.test(f.family) && f.status === 'loaded') loaded.add(Number(f.weight)); });
  status = { family: 'Inter', requested: [...INTER_WEIGHTS], loaded: [...loaded].sort((a, b) => a - b), timedOut, ms: Math.round(performance.now() - t0) };
  (window as unknown as Record<string, unknown>).__fontStatus = status;
  return status;
}
