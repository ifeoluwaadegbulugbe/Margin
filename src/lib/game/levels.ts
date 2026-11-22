export const RANKS = ['Doodler', 'Note-taker', 'Explorer', 'Curious Mind', 'Problem Solver', 'Deep Thinker'] as const;
const THRESHOLDS = [0, 100, 250, 450, 700, 1000];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Cumulative Starlight needed to reach a level (1-based). */
export function thresholdFor(level: number): number {
  if (level <= THRESHOLDS.length) return THRESHOLDS[level - 1];
  return 1000 + (level - 6) * 350;
}

export function levelFor(xp: number): number {
  let level = 1;
  while (xp >= thresholdFor(level + 1)) level++;
  return level;
}

export function rankTitle(level: number): string {
  if (level <= RANKS.length) return RANKS[level - 1];
  const n = level - RANKS.length;
  return `Scholar ${ROMAN[n - 1] ?? n}`;
}

export function levelProgress(xp: number) {
  const level = levelFor(xp);
  const lo = thresholdFor(level);
  const hi = thresholdFor(level + 1);
  return { level, rank: rankTitle(level), into: xp - lo, span: hi - lo, toNext: hi - xp, pct: (xp - lo) / (hi - lo) };
}
