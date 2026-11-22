/** Starlight: earned only by learning behaviour. Every award is a ledger transaction. */
import type { ProblemState } from '@/lib/learning/reducer';
import type { MisconceptionId } from '@/content/misconceptions';

export const HINT_MULTIPLIER = [1.0, 0.9, 0.75, 0.6, 0.4] as const;

export type XpReason =
  | 'step' | 'solve' | 'explain_sound' | 'explain_partial' | 'transfer' | 'self_correct'
  | 'misconception_beaten' | 'daily_goal' | 'swift_solve' | 'achievement';

export interface XpTx {
  amount: number;
  reason: XpReason;
  detail: string;
  problemId?: string;
}

export const XP = {
  step: 10,
  solve: 50,
  explainSound: 20,
  explainPartial: 10,
  transfer: 30,
  selfCorrect: 15,
  misconceptionBeaten: 40,
  dailyGoal: 25,
  swift: 20,
} as const;

export function solveMultiplier(p: Pick<ProblemState, 'hintLevel' | 'supported' | 'compensating'>): number {
  const base = p.supported ? HINT_MULTIPLIER[4] : HINT_MULTIPLIER[p.hintLevel];
  return p.compensating ? base * 0.5 : base;
}

/** Potential Starlight for solving now (shown live in the workspace meter). */
export const potentialSolveXp = (p: Pick<ProblemState, 'hintLevel' | 'supported' | 'compensating'>) =>
  Math.round(XP.solve * solveMultiplier(p));

/**
 * Transactions for one finished (or abandoned) problem.
 * @param watchIds recurring misconceptions from the Strategist; solving a problem that targets one, error-free, beats it.
 */
export function problemXp(p: ProblemState, targets: string[], watchIds: MisconceptionId[]): XpTx[] {
  const tx: XpTx[] = [];
  const id = p.problemId;
  const steps = p.lines.filter((l) => l.result.status === 'balanced').length;
  if (steps > 0) tx.push({ amount: steps * XP.step, reason: 'step', detail: `${steps} balanced step${steps > 1 ? 's' : ''}`, problemId: id });
  if (p.solved) {
    const m = solveMultiplier(p);
    tx.push({ amount: Math.round(XP.solve * m), reason: 'solve', detail: `Solved × ${m.toFixed(2)}`, problemId: id });
  }
  if (p.selfCorrections > 0) {
    tx.push({ amount: p.selfCorrections * XP.selfCorrect, reason: 'self_correct', detail: `Fixed your own mistake${p.selfCorrections > 1 ? ` ×${p.selfCorrections}` : ''}`, problemId: id });
  }
  if (p.explanation === 'sound') tx.push({ amount: XP.explainSound, reason: 'explain_sound', detail: 'Clear explanation', problemId: id });
  if (p.explanation === 'partial') tx.push({ amount: XP.explainPartial, reason: 'explain_partial', detail: 'Partial explanation', problemId: id });
  if (p.transfer?.solved) tx.push({ amount: XP.transfer, reason: 'transfer', detail: 'Transfer challenge', problemId: id });
  if (p.swift && p.solved) tx.push({ amount: XP.swift, reason: 'swift_solve', detail: 'Swift solve', problemId: id });
  if (p.solved) {
    const beaten = watchIds.filter((w) => targets.includes(w) && !p.misconceptions.includes(w));
    for (const b of beaten) tx.push({ amount: XP.misconceptionBeaten, reason: 'misconception_beaten', detail: `Beat ${b}`, problemId: id });
  }
  return tx;
}

export const sumXp = (tx: XpTx[]) => tx.reduce((a, t) => a + t.amount, 0);
