/**
 * @file MasqueradeLogic.ts
 * @purpose Pure game logic for Midnight Masquerade slot — symbols, paylines, reel strips,
 *          win evaluation, masked-symbol mechanic, free spins, and RTP simulation. No Phaser.
 * @author Agent 934
 * @date 2026-04-15
 * @license Proprietary – available for licensing
 */

import { getRandomSeedableRNG } from '../utils/RNG';

// ─── Constants ────────────────────────────────────────────────────────────────
export const REELS_COUNT              = 5;
export const ROWS_COUNT               = 3;
export const BET_PER_LINE             = 1;
export const LINES_COUNT              = 25;
export const WILD_MULTIPLIER_CHANCE   = 0.25; // 25% chance wild contributes x2
export const FREE_SPIN_SCATTER_COUNT  = 3;    // scatters needed to trigger
export const FREE_SPINS_GRANTED       = 10;
export const FREE_SPINS_RETRIGGER     = 5;
export const MASKED_MIN               = 1;
export const MASKED_MAX               = 3;

// ─── Jackpot System ───────────────────────────────────────────────────────────
export type JackpotTier = 'PHANTOM' | 'MARQUIS' | 'VEIL';

export interface JackpotResult {
  tier:   JackpotTier;
  payout: number;
}

/** Bet multipliers per jackpot tier. */
export const JACKPOT_MULTIPLIERS: Record<JackpotTier, number> = {
  PHANTOM: 1000,
  MARQUIS: 250,
  VEIL:    50,
};

/** Per-spin trigger probabilities. PHANTOM checked first (rarest). */
export const JACKPOT_PROBABILITIES: Record<JackpotTier, number> = {
  PHANTOM: 0.0002,  // 1 in 5000
  MARQUIS: 0.002,   // 1 in 500
  VEIL:    0.02,    // 1 in 50
};

export const GOLD     = 0xc9a84c;
export const GOLD_STR = '#c9a84c';
export const DARK     = 0x080812;
export const DARK_STR = '#080812';

// ─── Symbol Type ──────────────────────────────────────────────────────────────
export type MasqueradeSymbol =
  | 'GOLDEN_MASK'
  | 'CHAMPAGNE'
  | 'PEACOCK'
  | 'GLOVES'
  | 'CLOCK'
  | 'SLIPPER'
  | 'INVITATION'
  | 'MUSIC'
  | 'WILD'
  | 'SCATTER'
  | 'MASKED';

const HIGH_PAYING: MasqueradeSymbol[] = ['GOLDEN_MASK', 'CHAMPAGNE', 'PEACOCK'];

// ─── Payout Table ─────────────────────────────────────────────────────────────
type PaySymbol = Exclude<MasqueradeSymbol, 'WILD' | 'SCATTER' | 'MASKED'>;

export const PAYOUT_TABLE: Record<PaySymbol, Record<number, number>> = {
  GOLDEN_MASK: { 3: 10, 4: 50,  5: 200 },
  CHAMPAGNE:   { 3: 8,  4: 30,  5: 100 },
  PEACOCK:     { 3: 5,  4: 20,  5: 75  },
  GLOVES:      { 3: 4,  4: 15,  5: 50  },
  CLOCK:       { 3: 3,  4: 10,  5: 30  },
  SLIPPER:     { 3: 2,  4: 8,   5: 20  },
  INVITATION:  { 3: 2,  4: 6,   5: 15  },
  MUSIC:       { 3: 1,  4: 4,   5: 10  },
};

// ─── Payline Definitions (25 lines) ──────────────────────────────────────────
export const PAYLINES: { reel: number; row: number }[][] = [
  // Horizontals
  [{ reel:0,row:1},{reel:1,row:1},{reel:2,row:1},{reel:3,row:1},{reel:4,row:1}], // middle
  [{ reel:0,row:0},{reel:1,row:0},{reel:2,row:0},{reel:3,row:0},{reel:4,row:0}], // top
  [{ reel:0,row:2},{reel:1,row:2},{reel:2,row:2},{reel:3,row:2},{reel:4,row:2}], // bottom
  // V-shapes
  [{ reel:0,row:0},{reel:1,row:1},{reel:2,row:2},{reel:3,row:1},{reel:4,row:0}],
  [{ reel:0,row:2},{reel:1,row:1},{reel:2,row:0},{reel:3,row:1},{reel:4,row:2}],
  // More patterns
  [{ reel:0,row:0},{reel:1,row:0},{reel:2,row:1},{reel:3,row:0},{reel:4,row:0}],
  [{ reel:0,row:2},{reel:1,row:2},{reel:2,row:1},{reel:3,row:2},{reel:4,row:2}],
  [{ reel:0,row:1},{reel:1,row:0},{reel:2,row:0},{reel:3,row:0},{reel:4,row:1}],
  [{ reel:0,row:1},{reel:1,row:2},{reel:2,row:2},{reel:3,row:2},{reel:4,row:1}],
  [{ reel:0,row:0},{reel:1,row:1},{reel:2,row:1},{reel:3,row:1},{reel:4,row:0}],
  [{ reel:0,row:2},{reel:1,row:1},{reel:2,row:1},{reel:3,row:1},{reel:4,row:2}],
  [{ reel:0,row:0},{reel:1,row:0},{reel:2,row:1},{reel:3,row:2},{reel:4,row:2}],
  [{ reel:0,row:2},{reel:1,row:2},{reel:2,row:1},{reel:3,row:0},{reel:4,row:0}],
  [{ reel:0,row:1},{reel:1,row:0},{reel:2,row:1},{reel:3,row:0},{reel:4,row:1}],
  [{ reel:0,row:1},{reel:1,row:2},{reel:2,row:1},{reel:3,row:2},{reel:4,row:1}],
  [{ reel:0,row:0},{reel:1,row:1},{reel:2,row:0},{reel:3,row:1},{reel:4,row:0}],
  [{ reel:0,row:2},{reel:1,row:1},{reel:2,row:2},{reel:3,row:1},{reel:4,row:2}],
  [{ reel:0,row:1},{reel:1,row:1},{reel:2,row:0},{reel:3,row:1},{reel:4,row:1}],
  [{ reel:0,row:1},{reel:1,row:1},{reel:2,row:2},{reel:3,row:1},{reel:4,row:1}],
  [{ reel:0,row:0},{reel:1,row:2},{reel:2,row:0},{reel:3,row:2},{reel:4,row:0}],
  [{ reel:0,row:2},{reel:1,row:0},{reel:2,row:2},{reel:3,row:0},{reel:4,row:2}],
  [{ reel:0,row:0},{reel:1,row:1},{reel:2,row:0},{reel:3,row:0},{reel:4,row:0}],
  [{ reel:0,row:2},{reel:1,row:1},{reel:2,row:2},{reel:3,row:2},{reel:4,row:2}],
  [{ reel:0,row:1},{reel:1,row:0},{reel:2,row:2},{reel:3,row:0},{reel:4,row:1}],
  [{ reel:0,row:0},{reel:1,row:0},{reel:2,row:0},{reel:3,row:1},{reel:4,row:1}],
];

// ─── Reel Strips ──────────────────────────────────────────────────────────────
// Strips are weighted to target ~97% RTP. More mid/high symbols = more frequent wins.
export const REEL_STRIPS: MasqueradeSymbol[][] = [
  // Reel 1
  ['MUSIC','INVITATION','SLIPPER','CLOCK','GLOVES','PEACOCK','CHAMPAGNE','GOLDEN_MASK','WILD','SCATTER',
   'SLIPPER','CLOCK','GLOVES','PEACOCK','CHAMPAGNE','WILD',
   'MUSIC','INVITATION','CLOCK','GLOVES','PEACOCK','CHAMPAGNE',
   'SLIPPER','CLOCK','GLOVES','WILD','SCATTER','PEACOCK','MUSIC','INVITATION'],
  // Reel 2
  ['MUSIC','INVITATION','SLIPPER','CLOCK','GLOVES','PEACOCK','CHAMPAGNE','GOLDEN_MASK','WILD','SCATTER',
   'CLOCK','GLOVES','PEACOCK','CHAMPAGNE','GOLDEN_MASK','WILD',
   'MUSIC','SLIPPER','CLOCK','GLOVES','PEACOCK','CHAMPAGNE',
   'INVITATION','CLOCK','GLOVES','WILD','SCATTER','PEACOCK','MUSIC','SLIPPER'],
  // Reel 3
  ['MUSIC','INVITATION','SLIPPER','CLOCK','GLOVES','PEACOCK','CHAMPAGNE','GOLDEN_MASK','WILD','SCATTER',
   'SLIPPER','CLOCK','GLOVES','PEACOCK','CHAMPAGNE','GOLDEN_MASK','WILD',
   'MUSIC','INVITATION','GLOVES','PEACOCK','CHAMPAGNE',
   'CLOCK','GLOVES','WILD','SCATTER','PEACOCK','CHAMPAGNE','MUSIC','SLIPPER'],
  // Reel 4
  ['MUSIC','INVITATION','SLIPPER','CLOCK','GLOVES','PEACOCK','CHAMPAGNE','GOLDEN_MASK','WILD','SCATTER',
   'CLOCK','GLOVES','PEACOCK','CHAMPAGNE','WILD',
   'MUSIC','SLIPPER','CLOCK','GLOVES','PEACOCK','CHAMPAGNE',
   'INVITATION','GLOVES','WILD','SCATTER','PEACOCK','MUSIC','SLIPPER','CLOCK'],
  // Reel 5
  ['MUSIC','INVITATION','SLIPPER','CLOCK','GLOVES','PEACOCK','CHAMPAGNE','GOLDEN_MASK','WILD','SCATTER',
   'SLIPPER','CLOCK','GLOVES','PEACOCK','CHAMPAGNE','WILD',
   'MUSIC','INVITATION','CLOCK','GLOVES','PEACOCK','CHAMPAGNE',
   'CLOCK','WILD','SCATTER','PEACOCK','GLOVES','MUSIC','SLIPPER','INVITATION'],
];

// ─── Interfaces ───────────────────────────────────────────────────────────────
export interface MasqueradeConfig {
  houseEdge?:       number;
  rng?:             () => number;
  /** For testing: bypass RNG reel generation with fixed stops. */
  forcedReelStops?: MasqueradeSymbol[][];
  /** Skip masked-symbol logic (used in RTP simulation for speed). */
  skipUnmasking?:   boolean;
}

export interface WinLine {
  paylineIndex:      number;
  symbol:            PaySymbol;
  count:             number;
  payout:            number;
  positions:         { reel: number; row: number }[];
  isWildContributed: boolean;
}

export interface MasqueradeState {
  bet:                  number;
  linesBet:             number;
  reelStops:            MasqueradeSymbol[][];
  maskedPositions:      { reel: number; row: number }[];
  revealedSymbols:      { reel: number; row: number; symbol: MasqueradeSymbol }[];
  totalWin:             number;
  winLines:             WinLine[];
  isComplete:           boolean;
  freeSpinsRemaining:   number;
  lastWinMultiplier:    number;
  scatterCount:         number;
  isFreeSpinTriggered:  boolean;
  isFreeSpinRetriggered: boolean;
  /** Jackpot won this spin, or null if none triggered. */
  jackpotResult: JackpotResult | null;
}

// ─── Win Calculation ──────────────────────────────────────────────────────────

/**
 * Evaluates all active paylines and returns winning lines + total payout.
 * @param grid - 5×3 symbol grid to evaluate (MASKED symbols treated as no-win).
 * @param rng  - RNG function used to roll wild multiplier chance.
 */
function calculateWins(
  grid: MasqueradeSymbol[][],
  rng: () => number
): { winLines: WinLine[]; totalWin: number } {
  const winLines: WinLine[] = [];
  let totalWin = 0;

  for (let i = 0; i < PAYLINES.length; i++) {
    const payline = PAYLINES[i];
    const lineSymbols = payline.map(p => grid[p.reel][p.row]);

    // Find effective primary symbol (first non-WILD, non-SCATTER, non-MASKED)
    let primarySymbol: PaySymbol | null = null;
    let wildContributed = false;
    let count = 0;

    for (let j = 0; j < lineSymbols.length; j++) {
      const sym = lineSymbols[j];
      // Skip SCATTER and MASKED — they break winning streaks
      if ((sym as string) === 'SCATTER' || (sym as string) === 'MASKED') break;

      if (j === 0) {
        if (sym === 'WILD') { wildContributed = true; count = 1; continue; }
        primarySymbol = sym as PaySymbol;
        count = 1;
        continue;
      }

      if (sym === 'WILD') {
        wildContributed = true;
        count++;
      } else if (!primarySymbol) {
        // First non-wild encountered — lock in primary symbol
        primarySymbol = sym as PaySymbol;
        count++;
      } else if (sym === primarySymbol) {
        count++;
      } else {
        break;
      }
    }

    if (!primarySymbol || count < 3) continue;

    const payoutEntry = PAYOUT_TABLE[primarySymbol];
    if (!payoutEntry || !payoutEntry[count]) continue;

    let payout = payoutEntry[count];
    // Wild multiplier roll
    if (wildContributed && rng() < WILD_MULTIPLIER_CHANCE) {
      payout *= 2;
    }

    winLines.push({
      paylineIndex: i,
      symbol:       primarySymbol,
      count,
      payout,
      positions:    payline.slice(0, count),
      isWildContributed: wildContributed,
    });
    totalWin += payout;
  }

  return { winLines, totalWin };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Rolls for a mystery jackpot on every spin.
 * Checked in order: PHANTOM → MARQUIS → VEIL (rarest first).
 * Any spin can trigger regardless of payline outcome.
 *
 * @param bet - Total bet for this spin (used to calculate payout).
 * @param rng - RNG function returning [0, 1).
 * @returns JackpotResult if triggered, null otherwise.
 * @example
 * const jp = rollJackpot(25, myRng);
 * if (jp) console.log(jp.tier, jp.payout);
 */
export function rollJackpot(bet: number, rng: () => number): JackpotResult | null {
  const tiers: JackpotTier[] = ['PHANTOM', 'MARQUIS', 'VEIL'];
  for (const tier of tiers) {
    if (rng() < JACKPOT_PROBABILITIES[tier]) {
      return { tier, payout: JACKPOT_MULTIPLIERS[tier] * bet };
    }
  }
  return null;
}

/**
 * Creates a fresh Midnight Masquerade game state.
 * @param bet      - Total bet per spin (BET_PER_LINE × linesBet).
 * @param linesBet - Number of active paylines.
 * @returns Initial MasqueradeState.
 * @example
 * const state = createMasqueradeState(25, 25);
 */
export function createMasqueradeState(bet: number, linesBet: number): MasqueradeState {
  return {
    bet,
    linesBet,
    reelStops:             Array.from({ length: REELS_COUNT }, () => Array(ROWS_COUNT).fill('MUSIC') as MasqueradeSymbol[]),
    maskedPositions:       [],
    revealedSymbols:       [],
    totalWin:              0,
    winLines:              [],
    isComplete:            true,
    freeSpinsRemaining:    0,
    lastWinMultiplier:     1,
    scatterCount:          0,
    isFreeSpinTriggered:   false,
    isFreeSpinRetriggered: false,
    jackpotResult:         null,
  };
}

/**
 * Executes one spin of Midnight Masquerade.
 * Mutates nothing — returns a new state object.
 *
 * @param state  - Current game state.
 * @param config - Spin configuration (rng, forcedReelStops, etc.).
 * @returns Updated MasqueradeState.
 * @example
 * const next = spinMasquerade(state, { rng: myRng });
 */
export function spinMasquerade(state: MasqueradeState, config: MasqueradeConfig = {}): MasqueradeState {
  const rng = config.rng ?? getRandomSeedableRNG();

  const next: MasqueradeState = {
    ...state,
    totalWin:              0,
    winLines:              [],
    lastWinMultiplier:     1,
    scatterCount:          0,
    isFreeSpinTriggered:   false,
    isFreeSpinRetriggered: false,
    revealedSymbols:       [],
    maskedPositions:       [],
    isComplete:            false,
    jackpotResult:         null,
  };

  // ── Decrement free spin counter ──────────────────────────────────────────
  const inFreeSpin = state.freeSpinsRemaining > 0;
  if (inFreeSpin) next.freeSpinsRemaining = state.freeSpinsRemaining - 1;

  // ── Generate reel stops ───────────────────────────────────────────────────
  let stops: MasqueradeSymbol[][];
  if (config.forcedReelStops) {
    stops = config.forcedReelStops;
  } else {
    stops = REEL_STRIPS.map(strip => {
      const start = Math.floor(rng() * strip.length);
      return Array.from({ length: ROWS_COUNT }, (_, i) => strip[(start + i) % strip.length]);
    });
  }

  // ── Masked-symbol mechanic (free spins only) ─────────────────────────────
  const grid = stops.map(reel => [...reel]); // working copy for win calc

  if (inFreeSpin && !config.skipUnmasking) {
    // Collect maskable positions (not WILD, not SCATTER)
    const maskable: { reel: number; row: number }[] = [];
    for (let r = 0; r < REELS_COUNT; r++) {
      for (let c = 0; c < ROWS_COUNT; c++) {
        if (stops[r][c] !== 'WILD' && stops[r][c] !== 'SCATTER') {
          maskable.push({ reel: r, row: c });
        }
      }
    }

    const numMasked = Math.floor(rng() * (MASKED_MAX - MASKED_MIN + 1)) + MASKED_MIN;
    const masked: { reel: number; row: number }[] = [];

    for (let i = 0; i < numMasked && maskable.length > 0; i++) {
      const idx = Math.floor(rng() * maskable.length);
      const pos = maskable.splice(idx, 1)[0];
      masked.push(pos);
      // Mark for display (UI shows '?')
      stops[pos.reel][pos.row] = 'MASKED';
      // Reveal a high-paying symbol for win calculation
      const revealed = HIGH_PAYING[Math.floor(rng() * HIGH_PAYING.length)];
      grid[pos.reel][pos.row] = revealed;
      next.revealedSymbols.push({ ...pos, symbol: revealed });
    }
    next.maskedPositions = masked;
  }

  next.reelStops = stops;

  // ── Jackpot roll (mystery — any spin can trigger) ─────────────────────────
  const jackpot = rollJackpot(state.bet, rng);
  next.jackpotResult = jackpot;
  if (jackpot) next.totalWin += jackpot.payout;

  // ── Win calculation (uses revealed grid) ────────────────────────────────
  const { winLines, totalWin } = calculateWins(grid, rng);
  next.winLines  = winLines;
  next.totalWin  = totalWin;

  // ── Scatter check ─────────────────────────────────────────────────────────
  let scatterCount = 0;
  for (let r = 0; r < REELS_COUNT; r++) {
    for (let c = 0; c < ROWS_COUNT; c++) {
      if (stops[r][c] === 'SCATTER') scatterCount++;
    }
  }
  next.scatterCount = scatterCount;

  if (scatterCount >= FREE_SPIN_SCATTER_COUNT) {
    if (inFreeSpin) {
      next.freeSpinsRemaining += FREE_SPINS_RETRIGGER;
      next.isFreeSpinRetriggered = true;
    } else {
      next.freeSpinsRemaining = FREE_SPINS_GRANTED;
      next.isFreeSpinTriggered = true;
    }
  }

  next.isComplete = false; // Scene sets true after animations finish
  return next;
}

/**
 * Simulates many rounds and returns estimated RTP.
 * @param rounds     - Number of base-game rounds.
 * @param betPerLine - Credit bet per line.
 * @param linesBet   - Active paylines.
 * @param config     - Optional config (e.g., custom rng seed).
 * @returns RTP as a fraction, e.g. 0.97 = 97%.
 * @example
 * const rtp = simulateMasqueradeRTP(100000, 1, 25);
 */
export function simulateMasqueradeRTP(
  rounds:     number,
  betPerLine: number,
  linesBet:   number,
  config:     MasqueradeConfig = {}
): number {
  const rng = getRandomSeedableRNG();
  const cfg: MasqueradeConfig = { rng, skipUnmasking: true, ...config };
  let totalBet = 0;
  let totalWin = 0;
  let state    = createMasqueradeState(betPerLine * linesBet, linesBet);

  for (let i = 0; i < rounds; i++) {
    totalBet += state.bet;
    state = spinMasquerade(state, cfg);
    totalWin += state.totalWin;

    while (state.freeSpinsRemaining > 0) {
      state = spinMasquerade(state, cfg);
      totalWin += state.totalWin;
    }
  }

  return totalWin / totalBet;
}
