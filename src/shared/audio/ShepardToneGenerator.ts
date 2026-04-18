/**
 * @file Implements a Shepard Tone generator using Web Audio API.
 * @purpose Creates a psychoacoustic illusion of an endlessly rising pitch for game tension.
 * @author Agent 934
 * @date 2026-04-18
 * @license Proprietary
 */

import {
  SHEPARD_BASE_FREQUENCIES,
  SHEPARD_OSCILLATOR_PEAK_GAIN,
  SHEPARD_GAIN_RAMP_DURATION_SEC,
} from './audioConfig';

/**
 * Generates a Shepard tone, creating the illusion of an endlessly rising pitch.
 * This is achieved by playing 8 oscillators, each an octave apart, and
 * cycling their volumes such that higher octaves fade out as lower octaves fade in.
 */
export class ShepardToneGenerator {
  private audioCtx: AudioContext;
  private oscillators: OscillatorNode[] = [];
  private gainNodes: GainNode[] = [];
  private masterGain: GainNode;
  private _isPlaying: boolean = false;
  private _currentStep: number = 0; // 0-7, position in the rise cycle

  /**
   * Creates an instance of ShepardToneGenerator.
   * @param audioCtx - The Web Audio API AudioContext to use.
   */
  constructor(audioCtx: AudioContext) {
    this.audioCtx = audioCtx;
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 0; // Start muted
    this.masterGain.connect(this.audioCtx.destination);

    SHEPARD_BASE_FREQUENCIES.forEach((freq) => {
      const oscillator = this.audioCtx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = freq;

      const gainNode = this.audioCtx.createGain();
      gainNode.gain.value = 0; // All oscillators start muted
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);

      this.oscillators.push(oscillator);
      this.gainNodes.push(gainNode);
    });
  }

  /**
   * Starts the Shepard tone rise. Oscillators begin and volume envelopes cycle.
   * If already playing, it will reset the step and apply new gains.
   * @param initialStep - Step to start from (0 = base, 7 = near-top). Defaults to 0.
   * @example
   * generator.start(0);
   */
  public start(initialStep: number = 0): void {
    if (!this.audioCtx) return;

    // Resume AudioContext if suspended
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(e => console.error('Failed to resume AudioContext:', e));
    }

    if (!this._isPlaying) {
      this.oscillators.forEach(osc => osc.start(0));
      this._isPlaying = true;
    }

    this.setStep(initialStep);
    this.masterGain.gain.linearRampToValueAtTime(SHEPARD_OSCILLATOR_PEAK_GAIN, this.audioCtx.currentTime + SHEPARD_GAIN_RAMP_DURATION_SEC);
  }

  /**
   * Sets the current step of the Shepard tone. This will immediately apply
   * the gain envelopes corresponding to the given step.
   * @param step - The desired step (0-7). Will be clamped and wrapped.
   * @example
   * generator.setStep(3);
   */
  public setStep(step: number): void {
    if (!this.audioCtx || !this._isPlaying) return;

    this._currentStep = Math.max(0, Math.min(7, step % 8)); // Clamp and wrap 0-7

    const now = this.audioCtx.currentTime;
    const rampDuration = SHEPARD_GAIN_RAMP_DURATION_SEC;

    this.gainNodes.forEach((gainNode, index) => {
      // Calculate gain based on a sine curve, centered around currentStep
      // The (index - this._currentStep + 8) % 8 ensures a cyclic progression
      // Math.pow(..., 2) creates a more bell-shaped curve for the gain.
      const phase = ((index - this._currentStep + 8) % 8) / 8; // 0 to 1 over 8 steps
      const targetGain = Math.pow(Math.sin(phase * Math.PI), 2) * SHEPARD_OSCILLATOR_PEAK_GAIN;

      gainNode.gain.linearRampToValueAtTime(targetGain, now + rampDuration);
    });
  }

  /**
   * Advances the Shepard tone one step. Creates the illusion of rising pitch.
   * This method should be called on each surge meter increment.
   * @example
   * generator.step();
   */
  public step(): void {
    if (!this.audioCtx || !this._isPlaying) return;
    this.setStep(this._currentStep + 1);
  }

  /**
   * Smoothly stops all oscillators and resets the generator state.
   * @example
   * generator.stop();
   */
  public stop(): void {
    if (!this.audioCtx || !this._isPlaying) return;

    const now = this.audioCtx.currentTime;
    const rampDuration = SHEPARD_GAIN_RAMP_DURATION_SEC;

    this.masterGain.gain.linearRampToValueAtTime(0, now + rampDuration);

    // Stop oscillators after the master gain has faded out
    setTimeout(() => {
      this.oscillators.forEach(osc => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {
          // Oscillator might already be stopped if stop() was called multiple times
          console.warn('Error stopping oscillator:', e);
        }
      });
      this.gainNodes.forEach(gn => gn.disconnect());
      this.masterGain.disconnect();
      this.oscillators = [];
      this.gainNodes = [];
      this._isPlaying = false;
      this._currentStep = 0;
    }, rampDuration * 1000 + 50); // Add a small buffer
  }

  /**
   * Returns true if the generator is currently active.
   * @returns True if the Shepard tone is playing, false otherwise.
   */
  public get playing(): boolean {
    return this._isPlaying;
  }
}
