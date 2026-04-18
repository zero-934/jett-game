/**
 * @file Central audio controller for jett.game, using Web Audio API.
 * @purpose Manages game sounds like wins, losses, near-misses, and dynamic surge effects.
 * @author Agent 934
 * @date 2026-04-18
 * @license Proprietary
 */

import { ShepardToneGenerator } from './ShepardToneGenerator';
import {
  MASTER_GAIN,
  C_MAJOR_SCALE,
  WIN_ARPEGGIO_NOTES,
  WIN_NOTE_DURATION_MS,
  NOTE_PEAK_GAIN,
  NOTE_ATTACK_TIME_SEC,
  NOTE_DECAY_TIME_SEC,
  NOTE_RELEASE_TIME_SEC,
  NEAR_MISS_FREQUENCIES,
  NEAR_MISS_NOTE_DURATION_MS,
  LOSS_FREQUENCIES,
  LOSS_SOUND_DURATION_MS,
  BIG_WIN_MULTIPLIER,
} from './audioConfig';

/**
 * Manages all in-game audio using the Web Audio API.
 * Provides methods for playing various game sounds and controlling overall audio state.
 */
export class CasinoAudioManager {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private shepardGenerator: ShepardToneGenerator | null = null;
  private _enabled: boolean = true; // Audio is enabled by default

  /**
   * Creates an instance of CasinoAudioManager.
   */
  constructor() {
    // Attempt to initialize AudioContext immediately, but it might be suspended.
    // init() must be called from a user gesture to resume it.
    try {
      const AC = (globalThis as unknown as Record<string,unknown>).AudioContext as (new() => AudioContext) | undefined;
        if (!AC) throw new Error('AudioContext not available');
        this.audioCtx = new AC(); // eslint-disable-line @typescript-eslint/no-explicit-any
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = this._enabled ? MASTER_GAIN : 0;
      this.masterGain.connect(this.audioCtx.destination);
      this.shepardGenerator = new ShepardToneGenerator(this.audioCtx);
    } catch (e) {
      console.error('Web Audio API is not supported or failed to initialize:', e);
      this.audioCtx = null;
      this.masterGain = null;
      this.shepardGenerator = null;
      this._enabled = false; // Disable audio if context fails
    }
  }

  /**
   * Initializes the AudioContext. Must be called from a user gesture (click/tap)
   * to ensure the context is in a 'running' state. Safe to call multiple times.
   * @example
   * audioManager.init();
   */
  public async init(): Promise<void> {
    if (!this.audioCtx) {
      console.warn('AudioContext not available, audio initialization skipped.');
      return;
    }

    if (this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
        console.log('AudioContext resumed successfully.');
      } catch (e) {
        console.error('Failed to resume AudioContext:', e);
        this._enabled = false; // Disable if resume fails
      }
    }
  }

  /**
   * Called after every spin resolves.
   * Plays a celebratory win jingle ONLY if winAmount > betAmount (ethical LDW check).
   * Plays a neutral near-miss sound if winAmount > 0 but winAmount <= betAmount.
   * Plays a loss sound if winAmount === 0.
   *
   * @param winAmount - Credits returned this spin (0 if loss)
   * @param betAmount - Credits wagered this spin
   * @example
   * audioManager.onWin(150, 25); // plays win jingle — genuine profit
   * audioManager.onWin(20, 25);  // plays near-miss — LDW, no celebration
   * audioManager.onWin(0, 25);   // plays loss sound
   */
  public onWin(winAmount: number, betAmount: number): void {
    if (!this.audioCtx || !this._enabled) return;

    // ETHICAL CHECK: LDW (Loss Disguised as Win) prevention
    if (winAmount > 0 && winAmount <= betAmount) {
      // Returned less than or equal to bet, but not zero — this is a net loss or break-even.
      // Treat as a near-miss or loss, NOT a celebration.
      this.onNearMiss();
      return;
    }
    if (winAmount === 0) {
      this.playLoss();
      return;
    }
    // Genuine profit — play ascending win jingle
    this.playWinJingle(winAmount, betAmount);
  }

  /**
   * Plays a near-miss tension sound (descending half-step).
   * Used internally by onWin() for LDW cases.
   * @example
   * audioManager.onNearMiss();
   */
  public onNearMiss(): void {
    if (!this.audioCtx || !this._enabled) return;

    const now = this.audioCtx.currentTime;
    let startTime = now;

    NEAR_MISS_FREQUENCIES.forEach((freq) => {
      const oscillator = this.audioCtx!.createOscillator();
      const gainNode = this.audioCtx!.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, startTime);
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain!);

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(NOTE_PEAK_GAIN * 0.5, startTime + NOTE_ATTACK_TIME_SEC);
      gainNode.gain.linearRampToValueAtTime(0, startTime + (NEAR_MISS_NOTE_DURATION_MS / 1000) + NOTE_DECAY_TIME_SEC);

      oscillator.start(startTime);
      oscillator.stop(startTime + (NEAR_MISS_NOTE_DURATION_MS / 1000) + NOTE_DECAY_TIME_SEC + NOTE_RELEASE_TIME_SEC);

      startTime += NEAR_MISS_NOTE_DURATION_MS / 1000;
    });
  }

  /**
   * Starts or advances the Shepard tone for Surge game.
   * Call once when Surge Meter starts filling, then on each meter increment.
   * @param step - Current surge meter level (0–7, maps to ShepardToneGenerator's internal steps)
   * @example
   * audioManager.playSurgeRise(3);
   */
  public playSurgeRise(step: number): void {
    if (!this.audioCtx || !this._enabled || !this.shepardGenerator) return;

    if (!this.shepardGenerator.playing) {
      this.shepardGenerator.start(step);
    } else {
      this.shepardGenerator.setStep(step);
    }
  }

  /**
   * Stops the Shepard tone (call when Surge Spins end or game exits).
   * @example
   * audioManager.stopSurgeRise();
   */
  public stopSurgeRise(): void {
    if (!this.shepardGenerator) return;
    this.shepardGenerator.stop();
  }

  /**
   * Enables or disables all audio output.
   * @param enabled - True to enable, false to mute.
   * @example
   * audioManager.setEnabled(false); // Mute audio
   */
  public setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (this.masterGain) {
      this.masterGain.gain.value = enabled ? MASTER_GAIN : 0;
    }
    if (!enabled && this.shepardGenerator?.playing) {
      this.shepardGenerator.stop(); // Stop continuous sounds when muted
    }
  }

  /**
   * Returns true if audio is enabled.
   * @returns True if audio is enabled, false otherwise.
   */
  public get isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Cleans up audio resources. Call when scene shuts down or application exits.
   * @example
   * audioManager.destroy();
   */
  public destroy(): void {
    this.stopSurgeRise();
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    if (this.audioCtx) {
      if (this.audioCtx.state !== 'closed') {
        this.audioCtx.close().catch((e: unknown) => console.error('Error closing AudioContext:', e));
      }
      this.audioCtx = null;
    }
  }

  /**
   * Plays a celebratory ascending arpeggio for genuine wins.
   * @param winAmount - The amount won.
   * @param betAmount - The amount bet.
   * @private
   */
  private playWinJingle(winAmount: number, betAmount: number): void {
    if (!this.audioCtx || !this._enabled) return;

    const now = this.audioCtx.currentTime;
    let startTime = now;
    const notesToPlay = [...WIN_ARPEGGIO_NOTES];

    // For big wins, add a second ascending octave run
    if (winAmount >= betAmount * BIG_WIN_MULTIPLIER) {
      notesToPlay.push(...WIN_ARPEGGIO_NOTES.map(n => n + 7)); // Add an octave higher
    }

    notesToPlay.forEach((noteIndex) => {
      const frequency = C_MAJOR_SCALE[noteIndex % C_MAJOR_SCALE.length];
      const oscillator = this.audioCtx!.createOscillator();
      const gainNode = this.audioCtx!.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startTime);
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain!);

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(NOTE_PEAK_GAIN, startTime + NOTE_ATTACK_TIME_SEC);
      gainNode.gain.linearRampToValueAtTime(0, startTime + (WIN_NOTE_DURATION_MS / 1000) + NOTE_DECAY_TIME_SEC);

      oscillator.start(startTime);
      oscillator.stop(startTime + (WIN_NOTE_DURATION_MS / 1000) + NOTE_DECAY_TIME_SEC + NOTE_RELEASE_TIME_SEC);

      startTime += WIN_NOTE_DURATION_MS / 1000;
    });
  }

  /**
   * Plays a short, descending minor third for a loss.
   * @private
   */
  private playLoss(): void {
    if (!this.audioCtx || !this._enabled) return;

    const now = this.audioCtx.currentTime;
    let startTime = now;

    LOSS_FREQUENCIES.forEach((freq) => {
      const oscillator = this.audioCtx!.createOscillator();
      const gainNode = this.audioCtx!.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, startTime);
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain!);

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(NOTE_PEAK_GAIN * 0.3, startTime + NOTE_ATTACK_TIME_SEC); // Softer gain
      gainNode.gain.linearRampToValueAtTime(0, startTime + (LOSS_SOUND_DURATION_MS / 1000) / LOSS_FREQUENCIES.length + NOTE_DECAY_TIME_SEC);

      oscillator.start(startTime);
      oscillator.stop(startTime + (LOSS_SOUND_DURATION_MS / 1000) / LOSS_FREQUENCIES.length + NOTE_DECAY_TIME_SEC + NOTE_RELEASE_TIME_SEC);

      startTime += (LOSS_SOUND_DURATION_MS / 1000) / LOSS_FREQUENCIES.length;
    });
  }
}
