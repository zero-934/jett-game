/**
 * @file DemoLedger.ts
 * @purpose Non-redeemable demo-credit ledger. Integer hundredths, one debit per round start,
 *          one credit per settlement, idempotent by round ID. Pure TS.
 *          Demo credits have no cash value. No real-money, wallet or token integration.
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */

/** Hundredths per demo credit. */
export const HUNDREDTHS_PER_CREDIT = 100;
/** Default starting demo balance in hundredths (1,000.00). */
export const DEFAULT_DEMO_BALANCE_HUNDREDTHS = 100000;

/** Settlement record. */
export interface LedgerSettlement {
  roundId: string;
  stakeHundredths: number;
  returnHundredths: number;
  netHundredths: number;
  reason: string;
}

/**
 * Converts a credit amount with at most two decimals to integer hundredths.
 * @param credits - e.g. 14.5
 * @returns e.g. 1450
 * @example
 * toHundredths(10.57); // 1057
 */
export function toHundredths(credits: number): number {
  return Math.round(credits * HUNDREDTHS_PER_CREDIT);
}

/**
 * Formats hundredths for display with grouping, e.g. 100450 → "1,004.50".
 * @param hundredths - Integer hundredths.
 * @returns Formatted string.
 * @example
 * formatCredits(99000); // '990.00'
 */
export function formatCredits(hundredths: number): string {
  const sign = hundredths < 0 ? '-' : '';
  const abs = Math.abs(hundredths);
  const whole = Math.floor(abs / HUNDREDTHS_PER_CREDIT).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${whole}.${(abs % HUNDREDTHS_PER_CREDIT).toString().padStart(2, '0')}`;
}

/** Ledger change notification (fired only when state actually changes; idempotent repeats are silent). */
export type LedgerEvent =
  | { type: 'start'; roundId: string; stakeHundredths: number; balanceHundredths: number }
  | { type: 'settle'; record: LedgerSettlement; balanceHundredths: number };

/**
 * Demo ledger. Rejects double debits/credits for the same round.
 * @example
 * const ledger = new DemoLedger();
 * ledger.start('r1', 1000);
 * ledger.settle('r1', 1450, 'cashout');
 */
export class DemoLedger {
  private balance: number;
  private readonly open = new Map<string, number>();
  private readonly settled = new Map<string, LedgerSettlement>();
  private readonly observers = new Set<(e: LedgerEvent) => void>();

  /** @param initialHundredths - Starting balance. */
  constructor(initialHundredths: number = DEFAULT_DEMO_BALANCE_HUNDREDTHS) {
    this.balance = initialHundredths;
  }

  /** @returns Balance in hundredths. */
  get balanceHundredths(): number { return this.balance; }

  /**
   * Debits the stake once for a new round.
   * @param roundId - Unique round ID.
   * @param stakeHundredths - Stake.
   * @returns true if debited; false if already started/settled or insufficient balance.
   * @example
   * ledger.start('r1', 1000);
   */
  start(roundId: string, stakeHundredths: number): boolean {
    if (this.open.has(roundId) || this.settled.has(roundId)) return false;
    if (!Number.isInteger(stakeHundredths) || stakeHundredths <= 0 || stakeHundredths > this.balance) return false;
    this.balance -= stakeHundredths;
    this.open.set(roundId, stakeHundredths);
    this.emit({ type: 'start', roundId, stakeHundredths, balanceHundredths: this.balance });
    return true;
  }

  /**
   * Credits the return once.
   * @param roundId - Round started with {@link start}.
   * @param returnHundredths - Amount returned (0 for a loss).
   * @param reason - Settlement reason.
   * @returns The settlement (the original one if already settled), or null for an unknown round.
   * @example
   * ledger.settle('r1', 0, 'crash');
   */
  settle(roundId: string, returnHundredths: number, reason: string): LedgerSettlement | null {
    const prior = this.settled.get(roundId);
    if (prior) return prior;
    const stake = this.open.get(roundId);
    if (stake === undefined) return null;
    const amount = Math.max(0, Math.round(returnHundredths));
    this.balance += amount;
    this.open.delete(roundId);
    const record: LedgerSettlement = { roundId, stakeHundredths: stake, returnHundredths: amount, netHundredths: amount - stake, reason };
    this.settled.set(roundId, record);
    this.emit({ type: 'settle', record, balanceHundredths: this.balance });
    return record;
  }

  /**
   * Observes debits/settlements (read-only; observers cannot change the ledger).
   * @param fn - Observer.
   * @returns Unsubscribe function.
   * @example
   * const off = ledger.observe((e) => console.info(e.type)); off();
   */
  observe(fn: (e: LedgerEvent) => void): () => void {
    this.observers.add(fn);
    return () => this.observers.delete(fn);
  }

  private emit(e: LedgerEvent): void {
    for (const fn of [...this.observers]) { try { fn(e); } catch { /* an observer must never break settlement */ } }
  }

  /**
   * @param roundId - Round ID.
   * @returns Whether that round has settled.
   * @example
   * ledger.isSettled('r1');
   */
  isSettled(roundId: string): boolean {
    return this.settled.has(roundId);
  }
}

let pageLedger: DemoLedger | null = null;

/**
 * The single demo ledger for this page, so the balance persists across rounds, restarts and
 * games within a session. Not persisted to storage; reloading resets demo credits.
 * @returns The page ledger.
 * @example
 * getPageLedger().balanceHundredths;
 */
export function getPageLedger(): DemoLedger {
  if (!pageLedger) pageLedger = new DemoLedger();
  return pageLedger;
}

let roundCounter = 0;

/**
 * Creates a unique round ID for this page.
 * @param game - Game key.
 * @returns e.g. 'flap-3-1730000000000'.
 * @example
 * nextRoundId('jett');
 */
export function nextRoundId(game: string): string {
  roundCounter += 1;
  return `${game}-${roundCounter}-${Date.now()}`;
}
