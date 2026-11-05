/**
 * @file DemoSettings.ts
 * @purpose Player settings shared by the polish-003 games: sound, music, reduced motion,
 *          high contrast, haptics and theme. Pure TS; persistence goes through an injected
 *          storage so tests and private windows work. Cosmetic only: no setting may affect
 *          gameplay RNG, timing or payout.
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
import type { ThemeName } from './SoftDepthTheme';
import { THEME_NAMES } from './SoftDepthTheme';

/** Persisted settings. */
export interface DemoSettings {
  sound: boolean;
  music: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  haptics: boolean;
  theme: ThemeName;
}

/** Minimal storage interface (window.localStorage-compatible). */
export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** localStorage key. */
export const SETTINGS_STORAGE_KEY = 'jett.demo.settings.v1';

/**
 * Defaults. Reduced motion follows the OS preference when known.
 * @param prefersReducedMotion - Result of `matchMedia('(prefers-reduced-motion: reduce)')`.
 * @returns Default settings.
 * @example
 * defaultSettings(false);
 */
export function defaultSettings(prefersReducedMotion = false): DemoSettings {
  return { sound: true, music: false, reducedMotion: prefersReducedMotion, highContrast: false, haptics: false, theme: 'gold' };
}

/**
 * Loads settings, tolerating missing/corrupt storage.
 * @param storage - Storage or null.
 * @param prefersReducedMotion - OS preference.
 * @returns Settings.
 * @example
 * loadSettings(window.localStorage, false);
 */
export function loadSettings(storage: SettingsStorage | null, prefersReducedMotion = false): DemoSettings {
  const base = defaultSettings(prefersReducedMotion);
  if (!storage) return base;
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<DemoSettings>;
    const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
    return {
      sound: bool(parsed.sound, base.sound),
      music: bool(parsed.music, base.music),
      reducedMotion: bool(parsed.reducedMotion, base.reducedMotion),
      highContrast: bool(parsed.highContrast, base.highContrast),
      haptics: bool(parsed.haptics, base.haptics),
      theme: THEME_NAMES.includes(parsed.theme as ThemeName) ? (parsed.theme as ThemeName) : base.theme,
    };
  } catch {
    return base;
  }
}

/**
 * Saves settings; ignores storage failures.
 * @param storage - Storage or null.
 * @param settings - Settings to save.
 * @returns void
 * @example
 * saveSettings(window.localStorage, s);
 */
export function saveSettings(storage: SettingsStorage | null, settings: DemoSettings): void {
  if (!storage) return;
  try { storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); } catch { /* private mode / quota */ }
}
