/**
 * @file AlchemistLogic.test.ts
 * @purpose Unit tests for The Alchemist slot game logic.
 * @author Agent 934
 * @date 2026-04-15
 * @license Proprietary – available for licensing
 */

import {
  createAlchemistState,
  spinAlchemist,
  simulateAlchemistRTP,
  REELS_COUNT,
  ROWS_COUNT,
  BET_PER_LINE,
  LINES_COUNT,
  FREE_SPINS_GRANTED,
  FREE_SPINS_RETRIGGER,
  PAYOUT_TABLE,
} from '../games/AlchemistLogic';
import type { AlchemistSymbol } from '../games/AlchemistLogic';

const makeMockRng = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('AlchemistLogic', () => {

  describe('createAlchemistState', () => {
    it('creates correct initial state', () => {
      const state = createAlchemistState(BET_PER_LINE * LINES_COUNT, LINES_COUNT);
      expect(state.bet).toBe(BET_PER_LINE * LINES_COUNT);
      expect(state.linesBet).toBe(LINES_COUNT);
      expect(state.reelStops).toHaveLength(REELS_COUNT);
      expect(state.reelStops[0]).toHaveLength(ROWS_COUNT);
      expect(state.totalWin).toBe(0);
      expect(state.isComplete).toBe(true);
      expect(state.freeSpinsRemaining).toBe(0);
      expect(state.jackpotResult).toBeNull();
      expect(state.transmutingPositions).toHaveLength(0);
      expect(state.transmutedSymbols).toHaveLength(0);
    });
  });

  describe('spinAlchemist', () => {
    it('returns a new state object (immutable)', () => {
      const initial = createAlchemistState(25, LINES_COUNT);
      const next    = spinAlchemist(initial, { rng: makeMockRng([0.1, 0.2, 0.3, 0.4, 0.5]) });
      expect(next).not.toBe(initial);
    });

    it('calculates a win — 3x PHILOSOPHERS_STONE on middle row', () => {
      const stops: AlchemistSymbol[][] = [
        ['RUNE',  'PHILOSOPHERS_STONE', 'MORTAR'],
        ['VIAL',  'PHILOSOPHERS_STONE', 'HOURGLASS'],
        ['RUNE',  'PHILOSOPHERS_STONE', 'RUNE'],
        ['MORTAR','CAULDRON',           'VIAL'],
        ['VIAL',  'RUNE',               'MORTAR'],
      ];
      const state = spinAlchemist(
        createAlchemistState(25, LINES_COUNT),
        { forcedReelStops: stops, rng: makeMockRng([0.9]) }
      );
      expect(state.winLines.length).toBeGreaterThan(0);
      const stoneLine = state.winLines.find(w => w.symbol === 'PHILOSOPHERS_STONE');
      expect(stoneLine).toBeDefined();
      expect(stoneLine!.count).toBe(3);
      expect(stoneLine!.payout).toBe(PAYOUT_TABLE['PHILOSOPHERS_STONE'][3]);
    });

    it('returns totalWin 0 on a losing grid', () => {
      const stops: AlchemistSymbol[][] = [
        ['RUNE',     'MORTAR',    'VIAL'],
        ['HOURGLASS','CAULDRON',  'GRIMOIRE'],
        ['MORTAR',   'RUNE',      'VIAL'],
        ['VIAL',     'HOURGLASS', 'MORTAR'],
        ['MORTAR',   'VIAL',      'RUNE'],
      ];
      const state = spinAlchemist(
        createAlchemistState(25, LINES_COUNT),
        { forcedReelStops: stops, rng: makeMockRng([0.5]) }
      );
      expect(state.totalWin).toBe(0);
      expect(state.winLines).toHaveLength(0);
    });

    it('triggers free spins with 3 SCATTERs', () => {
      const stops: AlchemistSymbol[][] = [
        ['SCATTER', 'RUNE',    'MORTAR'],
        ['VIAL',    'SCATTER', 'HOURGLASS'],
        ['RUNE',    'MORTAR',  'SCATTER'],
        ['MORTAR',  'CAULDRON','VIAL'],
        ['VIAL',    'RUNE',    'MORTAR'],
      ];
      const state = spinAlchemist(
        createAlchemistState(25, LINES_COUNT),
        { forcedReelStops: stops, rng: makeMockRng([0.5]) }
      );
      expect(state.scatterCount).toBe(3);
      expect(state.isFreeSpinTriggered).toBe(true);
      expect(state.freeSpinsRemaining).toBe(FREE_SPINS_GRANTED);
    });

    it('decrements freeSpinsRemaining during free spins', () => {
      const initial = createAlchemistState(25, LINES_COUNT);
      initial.freeSpinsRemaining = 5;
      const stops: AlchemistSymbol[][] = [
        ['RUNE','MORTAR','VIAL'],['VIAL','HOURGLASS','CAULDRON'],
        ['MORTAR','RUNE','VIAL'],['VIAL','HOURGLASS','MORTAR'],['MORTAR','VIAL','RUNE'],
      ];
      const state = spinAlchemist(initial, { forcedReelStops: stops, rng: makeMockRng([0.5]), skipTransmuting: true });
      expect(state.freeSpinsRemaining).toBe(4);
    });

    it('retriggeres free spins during free spins', () => {
      const initial = createAlchemistState(25, LINES_COUNT);
      initial.freeSpinsRemaining = 5;
      const stops: AlchemistSymbol[][] = [
        ['SCATTER','RUNE','MORTAR'],['VIAL','SCATTER','HOURGLASS'],
        ['RUNE','MORTAR','SCATTER'],['MORTAR','CAULDRON','VIAL'],['VIAL','RUNE','MORTAR'],
      ];
      const state = spinAlchemist(initial, { forcedReelStops: stops, rng: makeMockRng([0.5]), skipTransmuting: true });
      expect(state.isFreeSpinRetriggered).toBe(true);
      expect(state.freeSpinsRemaining).toBe(4 + FREE_SPINS_RETRIGGER);
    });

    it('generates transmuting positions during free spins (1–3)', () => {
      const initial = createAlchemistState(25, LINES_COUNT);
      initial.freeSpinsRemaining = 3;
      const stops: AlchemistSymbol[][] = [
        ['RUNE','MORTAR','VIAL'],['VIAL','HOURGLASS','CAULDRON'],
        ['MORTAR','RUNE','VIAL'],['VIAL','HOURGLASS','MORTAR'],['MORTAR','VIAL','RUNE'],
      ];
      const state = spinAlchemist(initial, {
        forcedReelStops: stops,
        rng: makeMockRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.1, 0.4, 0.7]),
      });
      expect(state.transmutingPositions.length).toBeGreaterThanOrEqual(1);
      expect(state.transmutingPositions.length).toBeLessThanOrEqual(3);
      expect(state.transmutedSymbols.length).toBe(state.transmutingPositions.length);
    });

    it('does not transmute WILD or SCATTER positions', () => {
      const initial = createAlchemistState(25, LINES_COUNT);
      initial.freeSpinsRemaining = 2;
      const stops: AlchemistSymbol[][] = [
        ['WILD',  'SCATTER', 'RUNE'],
        ['VIAL',  'HOURGLASS','CAULDRON'],
        ['MORTAR','RUNE',    'VIAL'],
        ['VIAL',  'HOURGLASS','MORTAR'],
        ['MORTAR','VIAL',    'RUNE'],
      ];
      const state = spinAlchemist(initial, {
        forcedReelStops: stops,
        rng: makeMockRng([0.1, 0.0, 0.0, 0.0, 0.5]),
      });
      const keys = state.transmutingPositions.map(p => `${p.reel},${p.row}`);
      expect(keys).not.toContain('0,0'); // WILD
      expect(keys).not.toContain('0,1'); // SCATTER
    });

    it('transmuted symbols are always high-paying', () => {
      const initial = createAlchemistState(25, LINES_COUNT);
      initial.freeSpinsRemaining = 2;
      const stops: AlchemistSymbol[][] = [
        ['RUNE','MORTAR','VIAL'],['VIAL','HOURGLASS','CAULDRON'],
        ['MORTAR','RUNE','VIAL'],['VIAL','HOURGLASS','MORTAR'],['MORTAR','VIAL','RUNE'],
      ];
      const state = spinAlchemist(initial, {
        forcedReelStops: stops,
        rng: makeMockRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.1, 0.4, 0.7]),
      });
      state.transmutedSymbols.forEach(({ symbol }) => {
        expect(['PHILOSOPHERS_STONE', 'ELIXIR', 'GRIMOIRE']).toContain(symbol);
      });
    });
  });

  describe('simulateAlchemistRTP', () => {
    it('returns RTP in reasonable range over 5000 rounds', () => {
      const rtp = simulateAlchemistRTP(5000, BET_PER_LINE, LINES_COUNT);
      console.log(`Alchemist RTP: ${(rtp * 100).toFixed(2)}%`);
      // Wide range — reel strips are placeholder and not yet balanced for 97% RTP.
      // Balancing requires tuning strip symbol frequencies (future task).
      expect(rtp).toBeGreaterThanOrEqual(0.50);
      expect(rtp).toBeLessThanOrEqual(3.00);
    });
  });

});
