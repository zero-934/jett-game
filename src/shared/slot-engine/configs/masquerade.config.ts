/**
 * @file masquerade.config.ts
 * @purpose Defines the configuration for the Midnight Masquerade slot game.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary – available for licensing
 */

import type { SlotConfig, SlotPayline, SlotSymbolDef } from '../SlotEngineLogic';

// --- Symbol Definitions ---
const GOLDEN_MASK = 'GOLDEN_MASK';
const CHAMPAGNE = 'CHAMPAGNE';
const PEACOCK = 'PEACOCK';
const GLOVES = 'GLOVES';
const CLOCK = 'CLOCK';
const SLIPPER = 'SLIPPER';
const INVITATION = 'INVITATION';
const MUSIC = 'MUSIC';
const WILD = 'WILD';
const SCATTER = 'SCATTER';

export const MASQUERADE_SYMBOLS: SlotSymbolDef[] = [
  { key: GOLDEN_MASK, weight: 1 },
  { key: CHAMPAGNE, weight: 2 },
  { key: PEACOCK, weight: 3 },
  { key: GLOVES, weight: 4 },
  { key: CLOCK, weight: 5 },
  { key: SLIPPER, weight: 6 },
  { key: INVITATION, weight: 7 },
  { key: MUSIC, weight: 8 },
  { key: WILD, weight: 1, isWild: true },
  { key: SCATTER, weight: 1, isScatter: true },
];

// --- Paylines ---
// These 25 paylines are standard for many 5x3 slots.
const PAYLINES: SlotPayline[] = [
  { positions: [{reel:0,row:1},{reel:1,row:1},{reel:2,row:1},{reel:3,row:1},{reel:4,row:1}] },
  { positions: [{reel:0,row:0},{reel:1,row:0},{reel:2,row:0},{reel:3,row:0},{reel:4,row:0}] },
  { positions: [{reel:0,row:2},{reel:1,row:2},{reel:2,row:2},{reel:3,row:2},{reel:4,row:2}] },
  { positions: [{reel:0,row:0},{reel:1,row:1},{reel:2,row:2},{reel:3,row:1},{reel:4,row:0}] },
  { positions: [{reel:0,row:2},{reel:1,row:1},{reel:2,row:0},{reel:3,row:1},{reel:4,row:2}] },
  { positions: [{reel:0,row:0},{reel:1,row:0},{reel:2,row:1},{reel:3,row:0},{reel:4,row:0}] },
  { positions: [{reel:0,row:2},{reel:1,row:2},{reel:2,row:1},{reel:3,row:2},{reel:4,row:2}] },
  { positions: [{reel:0,row:1},{reel:1,row:0},{reel:2,row:0},{reel:3,row:0},{reel:4,row:1}] },
  { positions: [{reel:0,row:1},{reel:1,row:2},{reel:2,row:2},{reel:3,row:2},{reel:4,row:1}] },
  { positions: [{reel:0,row:0},{reel:1,row:1},{reel:2,row:1},{reel:3,row:1},{reel:4,row:0}] },
  { positions: [{reel:0,row:2},{reel:1,row:1},{reel:2,row:1},{reel:3,row:1},{reel:4,row:2}] },
  { positions: [{reel:0,row:0},{reel:1,row:0},{reel:2,row:1},{reel:3,row:2},{reel:4,row:2}] },
  { positions: [{reel:0,row:2},{reel:1,row:2},{reel:2,row:1},{reel:3,row:0},{reel:4,row:0}] },
  { positions: [{reel:0,row:1},{reel:1,row:0},{reel:2,row:1},{reel:3,row:0},{reel:4,row:1}] },
  { positions: [{reel:0,row:1},{reel:1,row:2},{reel:2,row:1},{reel:3,row:2},{reel:4,row:1}] },
  { positions: [{reel:0,row:0},{reel:1,row:1},{reel:2,row:0},{reel:3,row:1},{reel:4,row:0}] },
  { positions: [{reel:0,row:2},{reel:1,row:1},{reel:2,row:2},{reel:3,row:1},{reel:4,row:2}] },
  { positions: [{reel:0,row:1},{reel:1,row:1},{reel:2,row:0},{reel:3,row:1},{reel:4,row:1}] },
  { positions: [{reel:0,row:1},{reel:1,row:1},{reel:2,row:2},{reel:3,row:1},{reel:4,row:1}] },
  { positions: [{reel:0,row:0},{reel:1,row:2},{reel:2,row:0},{reel:3,row:2},{reel:4,row:0}] },
  { positions: [{reel:0,row:2},{reel:1,row:0},{reel:2,row:2},{reel:3,row:0},{reel:4,row:2}] },
  { positions: [{reel:0,row:0},{reel:1,row:1},{reel:2,row:0},{reel:3,row:0},{reel:4,row:0}] },
  { positions: [{reel:0,row:2},{reel:1,row:1},{reel:2,row:2},{reel:3,row:2},{reel:4,row:2}] },
  { positions: [{reel:0,row:1},{reel:1,row:0},{reel:2,row:2},{reel:3,row:0},{reel:4,row:1}] },
  { positions: [{reel:0,row:0},{reel:1,row:0},{reel:2,row:0},{reel:3,row:1},{reel:4,row:1}] },
];


// --- Reel Strips ---
// Same strips as MasqueradeLogic.ts, balanced for ~96% RTP.
// More mid/high symbols = more frequent wins at 96% target.
const MASQUERADE_REEL_STRIPS: string[][] = [
  // Reel 1
  [MUSIC,INVITATION,SLIPPER,CLOCK,GLOVES,PEACOCK,CHAMPAGNE,GOLDEN_MASK,WILD,SCATTER,
   SLIPPER,CLOCK,GLOVES,PEACOCK,CHAMPAGNE,WILD,
   MUSIC,INVITATION,CLOCK,GLOVES,PEACOCK,CHAMPAGNE,
   SLIPPER,CLOCK,GLOVES,WILD,SCATTER,PEACOCK,MUSIC,INVITATION],
  // Reel 2
  [MUSIC,INVITATION,SLIPPER,CLOCK,GLOVES,PEACOCK,CHAMPAGNE,GOLDEN_MASK,WILD,SCATTER,
   CLOCK,GLOVES,PEACOCK,CHAMPAGNE,GOLDEN_MASK,WILD,
   MUSIC,SLIPPER,CLOCK,GLOVES,PEACOCK,CHAMPAGNE,
   INVITATION,CLOCK,GLOVES,WILD,SCATTER,PEACOCK,MUSIC,SLIPPER],
  // Reel 3
  [MUSIC,INVITATION,SLIPPER,CLOCK,GLOVES,PEACOCK,CHAMPAGNE,GOLDEN_MASK,WILD,SCATTER,
   SLIPPER,CLOCK,GLOVES,PEACOCK,CHAMPAGNE,GOLDEN_MASK,WILD,
   MUSIC,INVITATION,GLOVES,PEACOCK,CHAMPAGNE,
   CLOCK,GLOVES,WILD,SCATTER,PEACOCK,CHAMPAGNE,MUSIC,SLIPPER],
  // Reel 4
  [MUSIC,INVITATION,SLIPPER,CLOCK,GLOVES,PEACOCK,CHAMPAGNE,GOLDEN_MASK,WILD,SCATTER,
   CLOCK,GLOVES,PEACOCK,CHAMPAGNE,WILD,
   MUSIC,SLIPPER,CLOCK,GLOVES,PEACOCK,CHAMPAGNE,
   INVITATION,GLOVES,WILD,SCATTER,PEACOCK,MUSIC,SLIPPER,CLOCK],
  // Reel 5
  [MUSIC,INVITATION,SLIPPER,CLOCK,GLOVES,PEACOCK,CHAMPAGNE,GOLDEN_MASK,WILD,SCATTER,
   SLIPPER,CLOCK,GLOVES,PEACOCK,CHAMPAGNE,WILD,
   MUSIC,INVITATION,CLOCK,GLOVES,PEACOCK,CHAMPAGNE,
   CLOCK,WILD,SCATTER,PEACOCK,GLOVES,MUSIC,SLIPPER,INVITATION],
];

// --- Pay Table ---
export const MASQUERADE_PAYTABLE: Record<string, Record<number, number>> = {
  [GOLDEN_MASK]: { 3: 10, 4: 50, 5: 200 },
  [CHAMPAGNE]: { 3: 8, 4: 30, 5: 100 },
  [PEACOCK]: { 3: 5, 4: 20, 5: 75 },
  [GLOVES]: { 3: 4, 4: 15, 5: 50 },
  [CLOCK]: { 3: 3, 4: 10, 5: 30 },
  [SLIPPER]: { 3: 2, 4: 8, 5: 20 },
  [INVITATION]: { 3: 2, 4: 6, 5: 15 },
  [MUSIC]: { 3: 1, 4: 4, 5: 10 },
  // WILD symbols typically don't have their own payout unless they form a line of only WILDs.
  // The engine logic handles WILD substitution. If a line of only WILDs forms, it pays the highest symbol it could substitute.
  // For simplicity, we can define a WILD payout if it's meant to be a high-paying symbol on its own.
  // Here, we'll assume WILDs substitute and don't have a direct payout unless explicitly defined.
  // If WILDs form a line, they will pay as the highest paying symbol they can substitute.
  // For this config, we'll let WILD substitute and not have its own direct payout.
};

// --- Slot Configuration ---
export const MASQUERADE_CONFIG: SlotConfig = {
  reelsCount: 5,
  rowsCount: 3,
  symbols: MASQUERADE_SYMBOLS,
  paylines: PAYLINES,
  payTable: MASQUERADE_PAYTABLE,
  freeSpinScatterCount: 3,
  freeSpinsGranted: 10,
  freeSpinsRetrigger: 5,
  wildMultiplierChance: 0.25,
  reelStrips: MASQUERADE_REEL_STRIPS,
};

// --- Emoji Mapping for UI ---
export const MASQUERADE_EMOJI: Record<string, string> = {
  [GOLDEN_MASK]: '🎭',
  [CHAMPAGNE]: '🍾',
  [PEACOCK]: '🦚',
  [GLOVES]: '🧤',
  [CLOCK]: '🕰️',
  [SLIPPER]: '👠',
  [INVITATION]: '✉️',
  [MUSIC]: '🎶',
  [WILD]: '✨',
  [SCATTER]: '💎',
};
