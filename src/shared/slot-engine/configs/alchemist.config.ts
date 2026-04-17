/**
 * @file alchemist.config.ts
 * @purpose Defines the configuration for The Alchemist slot game.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary – available for licensing
 */

import type { SlotConfig, SlotPayline, SlotSymbolDef } from '../SlotEngineLogic';

// --- Symbol Definitions ---
const PHILOSOPHERS_STONE = 'PHILOSOPHERS_STONE';
const ELIXIR = 'ELIXIR';
const GRIMOIRE = 'GRIMOIRE';
const CAULDRON = 'CAULDRON';
const HOURGLASS = 'HOURGLASS';
const VIAL = 'VIAL';
const MORTAR = 'MORTAR';
const RUNE = 'RUNE';
const WILD = 'WILD';
const SCATTER = 'SCATTER';

export const ALCHEMIST_SYMBOLS: SlotSymbolDef[] = [
  { key: PHILOSOPHERS_STONE, weight: 1 },
  { key: ELIXIR, weight: 2 },
  { key: GRIMOIRE, weight: 3 },
  { key: CAULDRON, weight: 4 },
  { key: HOURGLASS, weight: 4 },
  { key: VIAL, weight: 5 },
  { key: MORTAR, weight: 5 },
  { key: RUNE, weight: 4 },
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
// Derived from AlchemistLogic.ts BASE_REEL_STRIP — each strip is a pre-shuffled ordering.
// Balanced for ~96% RTP. Counts: PHILOSOPHERS_STONE:1, ELIXIR:2, GRIMOIRE:3,
// CAULDRON:4, HOURGLASS:4, VIAL:5, MORTAR:5, RUNE:4, WILD:1, SCATTER:1
const ALCHEMIST_REEL_STRIPS: string[][] = [
  // Reel 1 — balanced, ~30 symbols
  [RUNE,MORTAR,VIAL,HOURGLASS,CAULDRON,GRIMOIRE,ELIXIR,PHILOSOPHERS_STONE,WILD,SCATTER,
   VIAL,HOURGLASS,CAULDRON,GRIMOIRE,ELIXIR,WILD,
   RUNE,MORTAR,HOURGLASS,CAULDRON,GRIMOIRE,ELIXIR,
   VIAL,HOURGLASS,CAULDRON,WILD,SCATTER,GRIMOIRE,RUNE,MORTAR],
  // Reel 2
  [RUNE,MORTAR,VIAL,HOURGLASS,CAULDRON,GRIMOIRE,ELIXIR,PHILOSOPHERS_STONE,WILD,SCATTER,
   HOURGLASS,CAULDRON,GRIMOIRE,ELIXIR,PHILOSOPHERS_STONE,WILD,
   RUNE,VIAL,HOURGLASS,CAULDRON,GRIMOIRE,ELIXIR,
   MORTAR,HOURGLASS,CAULDRON,WILD,SCATTER,GRIMOIRE,RUNE,VIAL],
  // Reel 3
  [RUNE,MORTAR,VIAL,HOURGLASS,CAULDRON,GRIMOIRE,ELIXIR,PHILOSOPHERS_STONE,WILD,SCATTER,
   VIAL,HOURGLASS,CAULDRON,GRIMOIRE,ELIXIR,PHILOSOPHERS_STONE,WILD,
   RUNE,MORTAR,CAULDRON,GRIMOIRE,ELIXIR,
   HOURGLASS,CAULDRON,WILD,SCATTER,GRIMOIRE,ELIXIR,RUNE,VIAL],
  // Reel 4
  [RUNE,MORTAR,VIAL,HOURGLASS,CAULDRON,GRIMOIRE,ELIXIR,PHILOSOPHERS_STONE,WILD,SCATTER,
   HOURGLASS,CAULDRON,GRIMOIRE,ELIXIR,WILD,
   RUNE,VIAL,HOURGLASS,CAULDRON,GRIMOIRE,ELIXIR,
   MORTAR,CAULDRON,WILD,SCATTER,GRIMOIRE,RUNE,VIAL,HOURGLASS],
  // Reel 5
  [RUNE,MORTAR,VIAL,HOURGLASS,CAULDRON,GRIMOIRE,ELIXIR,PHILOSOPHERS_STONE,WILD,SCATTER,
   VIAL,HOURGLASS,CAULDRON,GRIMOIRE,ELIXIR,WILD,
   RUNE,MORTAR,HOURGLASS,CAULDRON,GRIMOIRE,ELIXIR,
   HOURGLASS,WILD,SCATTER,GRIMOIRE,CAULDRON,RUNE,VIAL,MORTAR],
];

// --- Pay Table ---
export const ALCHEMIST_PAYTABLE: Record<string, Record<number, number>> = {
  [PHILOSOPHERS_STONE]: { 3: 10, 4: 50, 5: 200 },
  [ELIXIR]: { 3: 8, 4: 30, 5: 100 },
  [GRIMOIRE]: { 3: 5, 4: 20, 5: 75 },
  [CAULDRON]: { 3: 4, 4: 15, 5: 50 },
  [HOURGLASS]: { 3: 3, 4: 10, 5: 30 },
  [VIAL]: { 3: 2, 4: 8, 5: 20 },
  [MORTAR]: { 3: 2, 4: 6, 5: 15 },
  [RUNE]: { 3: 1, 4: 4, 5: 10 },
};

// --- Slot Configuration ---
export const ALCHEMIST_CONFIG: SlotConfig = {
  reelsCount: 5,
  rowsCount: 3,
  symbols: ALCHEMIST_SYMBOLS,
  paylines: PAYLINES,
  payTable: ALCHEMIST_PAYTABLE,
  freeSpinScatterCount: 3,
  freeSpinsGranted: 10,
  freeSpinsRetrigger: 5,
  wildMultiplierChance: 0.25,
  reelStrips: ALCHEMIST_REEL_STRIPS,
};

// --- Emoji Mapping for UI ---
export const ALCHEMIST_EMOJI: Record<string, string> = {
  [PHILOSOPHERS_STONE]: '🪨',
  [ELIXIR]: '🧪',
  [GRIMOIRE]: '📜',
  [CAULDRON]: '🍲',
  [HOURGLASS]: '⏳',
  [VIAL]: '⚗️',
  [MORTAR]: '🥣',
  [RUNE]: ' runes', // Using text for rune as emoji is less clear
  [WILD]: '✨',
  [SCATTER]: '💎',
};
