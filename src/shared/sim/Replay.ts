/**
 * @file Replay.ts
 * @purpose Versioned replay records and canonical state hashing for deterministic demo rounds.
 *          Pure TS. A replay is: header (versions, seed, tick length, immutable config) +
 *          tick-stamped actions + end (reason, tick, amount, canonical state hash).
 *          Client replays never contain server secrets; none exist in this demo.
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
import type { TickAction } from './FixedStepRunner';
import type { RNGAlgorithm } from '../rng/ProvablyFairRNG';

/** Current replay schema version. */
export const REPLAY_SCHEMA_VERSION = 1;

/** Replay header. */
export interface ReplayHeader {
  schema: number;
  game: 'jett' | 'flap' | 'shatter';
  /** Bump whenever an outcome-affecting rule changes. */
  simVersion: number;
  rngAlgorithm: RNGAlgorithm;
  seed: string;
  tickMs: number;
  /** Immutable gameplay config (no functions). */
  config: Record<string, unknown>;
}

/** Settlement summary at the end of a replay. */
export interface ReplayEnd {
  reason: string;
  tick: number;
  /** Return in integer demo-credit hundredths. */
  returnHundredths: number;
  stateHash: string;
}

/** A complete replay record. */
export interface ReplayRecord {
  header: ReplayHeader;
  actions: TickAction[];
  end?: ReplayEnd;
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK64 = (1n << 64n) - 1n;

/**
 * Canonical JSON: sorted keys, no functions/undefined, finite numbers only.
 * @param value - Any JSON-like value.
 * @returns Canonical string.
 * @example
 * canonicalJSON({ b: 1, a: 2 }); // '{"a":2,"b":1}'
 */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('canonicalJSON: non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map((v) => canonicalJSON(v === undefined || typeof v === 'function' ? null : v)).join(',') + ']';
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined && typeof obj[k] !== 'function').sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJSON(obj[k])).join(',') + '}';
  }
  return 'null';
}

/**
 * 64-bit FNV-1a hash of the canonical JSON of `value`, as 16 hex digits.
 * Integrity check for tests and replays, not a security primitive.
 * @param value - State to hash.
 * @returns Hex hash.
 * @example
 * hashState({ tick: 3 });
 */
export function hashState(value: unknown): string {
  const text = canonicalJSON(value);
  let h = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i));
    h = (h * FNV_PRIME) & MASK64;
  }
  return h.toString(16).padStart(16, '0');
}

/**
 * Throws unless `header` matches the versions this build can replay.
 * @param header - Header to check.
 * @param expected - The running build's versions.
 * @returns void
 * @example
 * assertReplayCompatible(replay.header, { game: 'flap', simVersion: 2, rngAlgorithm: 'xoroshiro128plus-v2', tickMs: 16 });
 */
export function assertReplayCompatible(header: ReplayHeader, expected: Pick<ReplayHeader, 'game' | 'simVersion' | 'rngAlgorithm' | 'tickMs'>): void {
  if (header.schema !== REPLAY_SCHEMA_VERSION) throw new Error(`Replay schema ${header.schema} unsupported (expected ${REPLAY_SCHEMA_VERSION})`);
  for (const key of ['game', 'simVersion', 'rngAlgorithm', 'tickMs'] as const) {
    if (header[key] !== expected[key]) throw new Error(`Replay ${key} mismatch: ${String(header[key])} vs ${String(expected[key])}`);
  }
}
