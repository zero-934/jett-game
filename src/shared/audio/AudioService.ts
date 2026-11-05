/**
 * @file AudioService.ts
 * @purpose App-owned audio for the polish-003 games: exactly one CasinoAudioManager (one
 *          AudioContext) per page, created lazily on the first user gesture and reused by every
 *          scene and round. Fixes R-OWN-1 (Jett created a context per round and never closed it).
 *          Also enforces the ethical rule: celebratory sound only when return > stake.
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
import { CasinoAudioManager } from './CasinoAudioManager';

/** Sound cues the games may request. */
export type AudioCue = 'coin' | 'crash' | 'glassCrack' | 'tap';

let manager: CasinoAudioManager | null = null;
let enabled = true;
let createdCount = 0;

function ensure(): CasinoAudioManager | null {
  if (!enabled) return null;
  if (!manager) {
    manager = new CasinoAudioManager();
    createdCount++;
  }
  return manager;
}

/**
 * Shared audio facade. All methods are safe without Web Audio.
 * @example
 * AudioService.unlock();           // from a pointerdown/keydown handler
 * AudioService.cue('coin');
 * AudioService.settle(1450, 1000); // plays win jingle only because 14.50 > 10.00
 */
export const AudioService = {
  /**
   * Creates (once) and resumes the context. Call from a user gesture.
   * @returns void
   */
  unlock(): void {
    const m = ensure();
    if (m) void m.init();
  },

  /**
   * Enables or mutes all sound effects.
   * @param on - Sound setting.
   * @returns void
   */
  setEnabled(on: boolean): void {
    enabled = on;
    manager?.setEnabled(on);
  },

  /**
   * Plays a short non-celebratory cue.
   * @param name - Cue name.
   * @returns void
   */
  cue(name: AudioCue): void {
    if (!enabled || !manager) return;
    if (name === 'coin') manager.playCoinCollect();
    else if (name === 'glassCrack') manager.playGlassBreak();
    else if (name === 'crash') manager.onWin(0, 1);
  },

  /**
   * Settlement sound. Win jingle only when return > stake; otherwise neutral/loss.
   * @param returnHundredths - Credits returned (hundredths).
   * @param stakeHundredths - Stake (hundredths).
   * @returns void
   */
  settle(returnHundredths: number, stakeHundredths: number): void {
    if (!enabled || !manager) return;
    manager.onWin(returnHundredths, stakeHundredths);
  },

  /**
   * Test/diagnostic: number of managers (AudioContexts) ever created by this service.
   * @returns Count (0 or 1 in a healthy page).
   */
  get contextsCreated(): number {
    return createdCount;
  },
};
