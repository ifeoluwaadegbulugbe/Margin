/** Transparent mastery: exponentially weighted average of per-problem performance scores. */
import type { ProblemState } from '@/lib/learning/reducer';

export const ALPHA = 0.3;
export const UNLOCK_AT = 0.6;
export const MASTERED_AT = 0.8;

export interface MasteryRecord {
  value: number;
  attempts: number;
  lastTwoHint: number[];
  mastered: boolean;
  history: number[];
}

export const emptyMastery = (value = 0): MasteryRecord => ({ value, attempts: 0, lastTwoHint: [], mastered: false, history: [] });

export function performanceScore(p: Pick<ProblemState, 'solved' | 'hintLevel' | 'supported' | 'explanation' | 'transfer'>): number {
  if (!p.solved) return 0;
  let s: number;
  if (p.supported || p.hintLevel >= 4) s = 0.3;
  else if (p.hintLevel === 3) s = 0.5;
  else if (p.hintLevel === 2) s = 0.7;
  else if (p.hintLevel === 1) s = 0.85;
  else s = p.explanation === 'sound' ? 1.0 : 0.95;
  if (p.transfer?.solved) s = Math.min(1, s + 0.05);
  return s;
}

export function updateMastery(m: MasteryRecord, score: number, hintLevel: number): MasteryRecord {
  const value = round3(m.value + ALPHA * (score - m.value));
  const attempts = m.attempts + 1;
  const lastTwoHint = [...m.lastTwoHint, hintLevel].slice(-2);
  const history = [...m.history, score].slice(-10);
  const mastered = value >= MASTERED_AT && attempts >= 3 && lastTwoHint.length === 2 && lastTwoHint.every((h) => h <= 2);
  return { value, attempts, lastTwoHint, history, mastered };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function isUnlocked(prereqs: string[], mastery: Record<string, MasteryRecord | undefined>): boolean {
  return prereqs.every((p) => (mastery[p]?.value ?? 0) >= UNLOCK_AT);
}

/** Plain-language explanation of a mastery number. */
export function explainMastery(m: MasteryRecord): string {
  if (m.attempts === 0) return m.value > 0 ? `Seeded from calibration at ${Math.round(m.value * 100)}%.` : 'No problems yet.';
  const last = m.history.slice(-3).map((s) => s.toFixed(2)).join(', ');
  return `Your last problems scored ${last}. Recent problems count most (each new score moves mastery 30% of the way).`;
}
