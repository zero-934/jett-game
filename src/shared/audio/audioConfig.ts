/**
 * @file Audio configuration constants for jett.game.
 * @purpose Defines musical scales, tempos, and audio parameters for Web Audio API.
 * @author Agent 934
 * @date 2026-04-18
 * @license Proprietary
 */

/** Base tempo in BPM */
export const BASE_BPM = 84;

/** Base beat duration in milliseconds */
export const BEAT_MS = 60000 / BASE_BPM;

// Frequencies for musical notes (standard A4 = 440 Hz tuning)
// C4 = 261.63 Hz
// C#4 = 277.18 Hz
// D4 = 293.66 Hz
// D#4 = 311.13 Hz
// E4 = 329.63 Hz
// F4 = 349.23 Hz
// F#4 = 369.99 Hz
// G4 = 392.00 Hz
// G#4 = 415.30 Hz
// A4 = 440.00 Hz
// A#4 = 466.16 Hz
// B4 = 493.88 Hz
// C5 = 523.25 Hz
// D5 = 587.33 Hz
// E5 = 659.25 Hz
// F#5 = 739.99 Hz
// G5 = 783.99 Hz

/** C Major scale frequencies (C4–C5) in Hz */
export const C_MAJOR_SCALE: readonly number[] = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  349.23, // F4
  392.00, // G4
  440.00, // A4
  493.88, // B4
  523.25, // C5
];

/** G Major scale frequencies (G4–G5) in Hz */
export const G_MAJOR_SCALE: readonly number[] = [
  392.00, // G4
  440.00, // A4
  493.88, // B4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  739.99, // F#5
  783.99, // G5
];

/** Win jingle: ascending arpeggio note indices into C_MAJOR_SCALE */
export const WIN_ARPEGGIO_NOTES: readonly number[] = [0, 2, 4, 7]; // C4, E4, G4, C5

/** Near-miss: descending half-step slide frequencies (A4, G#4, G4) */
export const NEAR_MISS_FREQUENCIES: readonly number[] = [
  440.00, // A4
  415.30, // G#4
  392.00, // G4
];

/** Loss sound: descending minor third frequencies (E4, C#4) */
export const LOSS_FREQUENCIES: readonly number[] = [
  329.63, // E4
  277.18, // C#4
];

/** Shepard tone: 8 oscillator frequencies, each an octave apart starting at C2 */
export const SHEPARD_BASE_FREQUENCIES: readonly number[] = [
  65.41,  // C2
  130.81, // C3
  261.63, // C4
  523.25, // C5
  1046.50, // C6
  2093.00, // C7
  4186.01, // C8
  8372.02, // C9
];

/** Audio context sample rate (standard) */
export const SAMPLE_RATE = 44100;

/** Master gain level (0–1) */
export const MASTER_GAIN = 0.4;

/** Win sound duration in ms */
export const WIN_SOUND_DURATION_MS = 800;

/** Near-miss sound duration in ms */
export const NEAR_MISS_DURATION_MS = 600;

/** Loss sound duration in ms */
export const LOSS_SOUND_DURATION_MS = 300;

/** Surge rise ramp duration in ms per step */
export const SURGE_RAMP_STEP_MS = 400;

/** Duration of a single note in the win jingle (fraction of BEAT_MS) */
export const WIN_NOTE_DURATION_MS = BEAT_MS / 4;

/** Duration of a single note in the near-miss sound (fraction of BEAT_MS) */
export const NEAR_MISS_NOTE_DURATION_MS = BEAT_MS / 6;

/** Peak gain for individual notes (0-1) */
export const NOTE_PEAK_GAIN = 0.6;

/** Attack time for notes in seconds */
export const NOTE_ATTACK_TIME_SEC = 0.02;

/** Decay time for notes in seconds */
export const NOTE_DECAY_TIME_SEC = 0.1;

/** Release time for notes in seconds */
export const NOTE_RELEASE_TIME_SEC = 0.05;

/** Shepard tone oscillator peak gain (0-1) */
export const SHEPARD_OSCILLATOR_PEAK_GAIN = 0.1;

/** Shepard tone gain ramp duration in seconds */
export const SHEPARD_GAIN_RAMP_DURATION_SEC = SURGE_RAMP_STEP_MS / 1000;

/** Threshold for a "big win" multiplier (e.g., 5x bet) */
export const BIG_WIN_MULTIPLIER = 5;
