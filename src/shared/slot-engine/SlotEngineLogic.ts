/**
 * @file SlotEngineLogic.ts
 * @purpose Provides the pure TypeScript logic for a slot machine engine, including spin, win evaluation, and RTP simulation.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary – available for licensing
 */
// Part of Jett Casino — raising $500k pre-seed. Contact: zero60851@gmail.com


import { ProvablyFairRNG } from '../rng/ProvablyFairRNG';

/**
 * Defines a single symbol type for the slot machine.
 */
export interface SlotSymbolDef {
  key: string;         // e.g. 'WILD', 'SCATTER', 'HIGH_A'
  weight: number;      // Relative weight for reel strip generation
  isWild?: boolean;
  isScatter?: boolean;
}

/**
 * Defines a single payline across the reels.
 */
export interface SlotPayline {
  positions: { reel: number; row: number }[];  // Exactly 5 positions for a 5-reel slot
}

/**
 * Configuration for the slot machine engine.
 */
export interface SlotConfig {
  reelsCount: number;          // Always 5
  rowsCount: number;           // Always 3
  symbols: SlotSymbolDef[];    // All available symbols
  paylines: SlotPayline[];     // Defined paylines
  payTable: Record<string, Record<number, number>>;  // symbol key -> count -> multiplier
  freeSpinScatterCount: number;  // Scatters needed to trigger free spins
  freeSpinsGranted: number;      // Number of free spins awarded
  freeSpinsRetrigger: number;    // Number of additional free spins on retrigger
  wildMultiplierChance: number;  // Probability (0-1) for a wild-contributed win to be multiplied
  /**
   * Optional reel strips for each reel. If provided, spins pick a random start
   * index on each strip and take rowsCount consecutive symbols (wrapping).
   * This produces correlated rows per reel, giving realistic RTP.
   * If omitted, each cell is picked independently by weight (rarely correct).
   */
  reelStrips?: string[][];
}

/**
 * Represents a single winning line detected after a spin.
 */
export interface SlotWinLine {
  paylineIndex: number;
  symbol: string;
  count: number;
  payout: number;
  positions: { reel: number; row: number }[];
  isWildContributed: boolean; // True if a WILD symbol was part of forming this win
  isWildMultiplied?: boolean; // True if this win was multiplied by a WILD
}

/**
 * Represents the current state of the slot machine after a spin.
 */
export interface SlotSpinState {
  bet: number;                   // Total bet for the spin
  linesBet: number;              // Number of lines bet (usually 25)
  reelStops: string[][];         // [reel][row] symbol keys displayed
  totalWin: number;              // Total payout for the spin
  winLines: SlotWinLine[];       // Details of all winning lines
  scatterCount: number;          // Number of scatter symbols landed
  freeSpinsRemaining: number;    // Number of free spins left
  isFreeSpinTriggered: boolean;  // True if free spins were triggered by this spin
  isFreeSpinRetriggered: boolean; // True if free spins were retriggered by this spin
  isComplete: boolean;           // True if the spin sequence (including free spins) is complete
  lastSpinSeed: string;          // The seed used for the RNG for this spin, for provable fairness
}

/**
 * Creates the initial state for the slot machine.
 * @param bet The total bet amount for a single spin.
 * @param linesBet The number of lines being bet on.
 * @returns An initial `SlotSpinState` object.
 * @example
 * const initialState = createSlotState(100, 25);
 */
export function createSlotState(bet: number, linesBet: number): SlotSpinState {
  return {
    bet,
    linesBet,
    reelStops: [],
    totalWin: 0,
    winLines: [],
    scatterCount: 0,
    freeSpinsRemaining: 0,
    isFreeSpinTriggered: false,
    isFreeSpinRetriggered: false,
    isComplete: false,
    lastSpinSeed: '',
  };
}

/**
 * Selects a random symbol based on weights from the provided symbol definitions.
 * @param symbols An array of `SlotSymbolDef` to choose from.
 * @param rng The `ProvablyFairRNG` instance to use for randomness.
 * @returns The key of the randomly selected symbol.
 */
function getRandomSymbol(symbols: SlotSymbolDef[], rng: ProvablyFairRNG): string {
  const totalWeight = symbols.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight <= 0) {
    // Fallback if no weights or all weights are zero/negative
    const validSymbols = symbols.filter(s => s.weight > 0);
    if (validSymbols.length > 0) {
      return validSymbols[rng.randomInt(0, validSymbols.length - 1)].key;
    }
    throw new Error('Cannot select a random symbol: total weight is zero or negative.');
  }

  let r = rng.random() * totalWeight;
  for (const symbolDef of symbols) {
    if (symbolDef.weight > 0 && r < symbolDef.weight) {
      return symbolDef.key;
    }
    r -= Math.max(0, symbolDef.weight); // Ensure we don't subtract negative weights
  }

  // Fallback, should ideally not be reached if totalWeight > 0
  // Return the symbol with the highest weight as a last resort
  const highestWeightSymbol = symbols.reduce((prev, current) =>
    (prev.weight > current.weight ? prev : current), symbols[0]);
  return highestWeightSymbol.key;
}

/**
 * Executes one spin of the slot machine.
 * @param state The current `SlotSpinState`.
 * @param config The `SlotConfig` for the game.
 * @param rng The `ProvablyFairRNG` instance to use for all random operations.
 * @param forcedReelStops Optional: A predefined 2D array of symbol keys to force reel outcomes (for testing/debugging).
 * @returns A new `SlotSpinState` object reflecting the outcome of the spin.
 * @example
 * const rng = new ProvablyFairRNG('spin-1');
 * const config = MASQUERADE_CONFIG; // Assuming MASQUERADE_CONFIG is imported
 * let state = createSlotState(100, 25);
 * state = spinSlot(state, config, rng);
 * console.log(state.totalWin);
 */
export function spinSlot(
  state: SlotSpinState,
  config: SlotConfig,
  rng: ProvablyFairRNG,
  forcedReelStops?: string[][]
): SlotSpinState {
  const newState: SlotSpinState = { ...state };
  newState.lastSpinSeed = rng.getSeed(); // Record the seed for provable fairness

  // Determine if this is a free spin
  const isCurrentlyFreeSpin = newState.freeSpinsRemaining > 0;

  // Generate reel stops
  if (forcedReelStops) {
    newState.reelStops = forcedReelStops;
  } else if (config.reelStrips && config.reelStrips.length >= config.reelsCount) {
    // Strip-based spinning: pick random start on each strip, take rowsCount consecutive symbols.
    // This is how real slots work — rows on the same reel are correlated, not independent.
    newState.reelStops = [];
    for (let reelIndex = 0; reelIndex < config.reelsCount; reelIndex++) {
      const strip = config.reelStrips[reelIndex];
      const startIndex = rng.randomInt(0, strip.length - 1);
      const reelSymbols: string[] = [];
      for (let rowIndex = 0; rowIndex < config.rowsCount; rowIndex++) {
        reelSymbols.push(strip[(startIndex + rowIndex) % strip.length]);
      }
      newState.reelStops.push(reelSymbols);
    }
  } else {
    // Fallback: independent weight-based pick per cell (use only when no strips defined)
    newState.reelStops = [];
    for (let reelIndex = 0; reelIndex < config.reelsCount; reelIndex++) {
      const reelSymbols: string[] = [];
      for (let rowIndex = 0; rowIndex < config.rowsCount; rowIndex++) {
        reelSymbols.push(getRandomSymbol(config.symbols, rng));
      }
      newState.reelStops.push(reelSymbols);
    }
  }

  newState.totalWin = 0;
  newState.winLines = [];
  newState.scatterCount = 0;
  newState.isFreeSpinTriggered = false;
  newState.isFreeSpinRetriggered = false;

  const betPerLine = newState.bet / newState.linesBet;

  // Get symbol definitions for quick lookup
  const symbolDefs = new Map<string, SlotSymbolDef>(
    config.symbols.map(s => [s.key, s])
  );

  // Count scatters
  for (let reelIndex = 0; reelIndex < config.reelsCount; reelIndex++) {
    for (let rowIndex = 0; rowIndex < config.rowsCount; rowIndex++) {
      const symbolKey = newState.reelStops[reelIndex][rowIndex];
      if (symbolDefs.get(symbolKey)?.isScatter) {
        newState.scatterCount++;
      }
    }
  }

  // Evaluate paylines
  config.paylines.forEach((payline, paylineIndex) => {
    if (payline.positions.length !== config.reelsCount) {
      // Skip invalid paylines (should always be 5 positions for 5 reels)
      return;
    }

    const lineSymbols: string[] = payline.positions.map(
      pos => newState.reelStops[pos.reel][pos.row]
    );

    let currentSymbolKey: string | null = null;
    let consecutiveCount = 0;
    let wildCount = 0;
    let isWildContributed = false;

    // Find the first non-wild, non-scatter symbol to establish the winning symbol for the line
    // Or if all are wild, then the wild itself.
    for (let i = 0; i < config.reelsCount; i++) {
      const symbol = lineSymbols[i];
      const def = symbolDefs.get(symbol);

      if (def?.isScatter) {
        // Scatters don't form paylines, skip this line evaluation
        currentSymbolKey = null;
        break;
      }

      if (def?.isWild) {
        wildCount++;
        isWildContributed = true;
      } else {
        currentSymbolKey = symbol;
        consecutiveCount = i + 1; // Count up to this point
        break;
      }
    }

    // If all symbols up to the first reel are wild, then the winning symbol is WILD itself
    if (currentSymbolKey === null && wildCount > 0) {
      currentSymbolKey = config.symbols.find(s => s.isWild)?.key || ''; // Use the actual WILD key
      if (!currentSymbolKey) return; // No wild symbol defined, cannot form a win
      consecutiveCount = wildCount;
    } else if (currentSymbolKey === null) {
      // No non-scatter symbols, no wild symbols, no win
      return;
    }

    // Now, extend the count for the determined currentSymbolKey
    for (let i = consecutiveCount; i < config.reelsCount; i++) {
      const symbol = lineSymbols[i];
      const def = symbolDefs.get(symbol);

      if (def?.isScatter) {
        break; // Scatters break the line
      }

      if (symbol === currentSymbolKey || def?.isWild) {
        consecutiveCount++;
        if (def?.isWild) {
          isWildContributed = true;
        }
      } else {
        break; // Mismatch, line ends
      }
    }

    // Check for payout
    if (currentSymbolKey && consecutiveCount >= 3) { // Minimum 3 for a win
      const payTableForSymbol = config.payTable[currentSymbolKey];
      if (payTableForSymbol && payTableForSymbol[consecutiveCount]) {
        let multiplier = payTableForSymbol[consecutiveCount];
        let isWildMultiplied = false;

        // Apply wild multiplier during free spins
        if (isCurrentlyFreeSpin && isWildContributed && rng.random() < config.wildMultiplierChance) {
          multiplier *= 2; // Double the win
          isWildMultiplied = true;
        }

        const payout = multiplier * betPerLine;
        newState.totalWin += payout;
        newState.winLines.push({
          paylineIndex,
          symbol: currentSymbolKey,
          count: consecutiveCount,
          payout,
          positions: payline.positions.slice(0, consecutiveCount),
          isWildContributed,
          isWildMultiplied,
        });
      }
    }
  });

  // Handle free spin triggers/retriggers
  if (newState.scatterCount >= config.freeSpinScatterCount) {
    if (isCurrentlyFreeSpin) {
      newState.freeSpinsRemaining += config.freeSpinsRetrigger;
      newState.isFreeSpinRetriggered = true;
    } else {
      newState.freeSpinsRemaining += config.freeSpinsGranted;
      newState.isFreeSpinTriggered = true;
    }
  }

  // Decrement free spins if this was a free spin round
  if (isCurrentlyFreeSpin) {
    newState.freeSpinsRemaining--;
  }

  // Mark as complete if no free spins remaining and not triggered/retriggered
  newState.isComplete = newState.freeSpinsRemaining <= 0 && !newState.isFreeSpinTriggered && !newState.isFreeSpinRetriggered;

  return newState;
}

/**
 * Simulates N rounds of the slot machine and returns the estimated RTP (Return To Player).
 * @param config The `SlotConfig` for the game.
 * @param rounds The number of simulation rounds to run.
 * @param betPerLine The bet amount per line for each round.
 * @param linesBet The number of lines bet for each round.
 * @returns The estimated RTP as a number between 0 and 1.
 * @example
 * const config = MASQUERADE_CONFIG;
 * const estimatedRTP = simulateSlotRTP(config, 100000, 1, 25);
 * console.log(`Estimated RTP: ${estimatedRTP * 100}%`); // e.g., 96.1%
 */
export function simulateSlotRTP(
  config: SlotConfig,
  rounds: number,
  betPerLine: number,
  linesBet: number
): number {
  let totalBet = 0;
  let totalWin = 0;
  const initialBet = betPerLine * linesBet;

  // Use a fixed seed for simulation to ensure reproducibility of the simulation itself
  const simulationRNG = new ProvablyFairRNG('rtp-simulation-seed');

  let currentState = createSlotState(initialBet, linesBet);

  for (let i = 0; i < rounds; i++) {
    totalBet += initialBet; // Each spin costs the initial bet

    // Simulate a spin
    currentState = spinSlot(currentState, config, simulationRNG);
    totalWin += currentState.totalWin;

    // If free spins were triggered, play them out
    let freeSpinSafetyCounter = 0;
    const FREE_SPIN_LOOP_LIMIT = 500; // prevent runaway retriggers
    while (currentState.freeSpinsRemaining > 0 && freeSpinSafetyCounter < FREE_SPIN_LOOP_LIMIT) {
      freeSpinSafetyCounter++;
      // Free spins don't cost additional bet
      currentState = spinSlot(currentState, config, simulationRNG);
      totalWin += currentState.totalWin;
    }

    // Reset state for the next base game spin
    currentState = createSlotState(initialBet, linesBet);
  }

  return totalBet > 0 ? totalWin / totalBet : 0;
}
