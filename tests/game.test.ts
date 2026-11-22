import { describe, expect, it } from 'vitest';
import { initialProblemState } from '@/lib/learning/reducer';
import { problemXp, sumXp, potentialSolveXp } from '@/lib/game/xp';
import { levelFor, rankTitle, thresholdFor } from '@/lib/game/levels';
import { emptyMastery, performanceScore, updateMastery, isUnlocked } from '@/lib/game/mastery';
import { meetGoal, emptyStreak, displayStreak } from '@/lib/game/streak';
import { evaluateAchievements } from '@/lib/game/achievements';
import { recommend } from '@/lib/learning/recommender';

describe('xp', () => {
  it('scripted problem matches hand calculation', () => {
    const s = { ...initialProblemState('MS-02'), solved: true, hintLevel: 1 as const, selfCorrections: 1, explanation: 'sound' as const };
    s.lines = [
      { text: 'a', result: { status: 'balanced' } as never },
      { text: 'b', result: { status: 'changed' } as never },
      { text: 'c', result: { status: 'balanced' } as never },
    ];
    // 2 steps (20) + solve 50*0.9=45 + self-correct 15 + explain 20 = 100
    expect(sumXp(problemXp(s, [], []))).toBe(100);
  });
  it('hint multipliers', () => {
    expect(potentialSolveXp({ hintLevel: 0, supported: false, compensating: false })).toBe(50);
    expect(potentialSolveXp({ hintLevel: 2, supported: false, compensating: false })).toBe(38);
    expect(potentialSolveXp({ hintLevel: 4, supported: false, compensating: false })).toBe(20);
    expect(potentialSolveXp({ hintLevel: 0, supported: false, compensating: true })).toBe(25);
  });
  it('misconception beaten', () => {
    const s = { ...initialProblemState('TS-07'), solved: true };
    expect(problemXp(s, ['M-SIGN-MOVE'], ['M-SIGN-MOVE']).some((t) => t.reason === 'misconception_beaten')).toBe(true);
  });
  it('no xp for an unsolved problem with no steps', () => expect(sumXp(problemXp(initialProblemState('TS-01'), [], []))).toBe(0));
});

describe('levels', () => {
  it('thresholds', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(99)).toBe(1);
    expect(levelFor(100)).toBe(2);
    expect(levelFor(250)).toBe(3);
    expect(levelFor(1000)).toBe(6);
    expect(thresholdFor(7)).toBe(1350);
    expect(rankTitle(3)).toBe('Explorer');
    expect(rankTitle(7)).toBe('Scholar I');
  });
});

describe('mastery', () => {
  it('worked example from the blueprint', () => {
    let m = { ...emptyMastery(0.48) };
    m = updateMastery(m, 0.85, 1);
    expect(m.value).toBeCloseTo(0.591, 3);
    m = updateMastery(m, 0.95, 0);
    expect(m.value).toBeCloseTo(0.699, 3);
  });
  it('scores', () => {
    const base = { solved: true, hintLevel: 0 as const, supported: false, explanation: 'sound' as const, transfer: null };
    expect(performanceScore(base)).toBe(1);
    expect(performanceScore({ ...base, explanation: 'missing' })).toBe(0.95);
    expect(performanceScore({ ...base, hintLevel: 3 })).toBe(0.5);
    expect(performanceScore({ ...base, solved: false })).toBe(0);
  });
  it('unlock at 60%', () => {
    expect(isUnlocked(['a'], { a: { ...emptyMastery(0.6) } })).toBe(true);
    expect(isUnlocked(['a'], { a: { ...emptyMastery(0.59) } })).toBe(false);
  });
});

describe('streak', () => {
  it('consecutive days count up', () => {
    let s = meetGoal(emptyStreak(), '2026-11-18').streak;
    s = meetGoal(s, '2026-11-19').streak;
    expect(s.count).toBe(2);
  });
  it('same day does not double count', () => {
    const s = meetGoal(meetGoal(emptyStreak(), '2026-11-18').streak, '2026-11-18').streak;
    expect(s.count).toBe(1);
  });
  it('a freeze bridges one missed day', () => {
    const s = meetGoal({ count: 4, lastGoalDate: '2026-11-17', freezes: 1, goalDays: [] }, '2026-11-19');
    expect(s.streak.count).toBe(5);
    expect(s.usedFreezes).toBe(1);
  });
  it('breaks without freezes', () => expect(meetGoal({ count: 4, lastGoalDate: '2026-11-10', freezes: 0, goalDays: [] }, '2026-11-19').streak.count).toBe(1));
  it('display shows broken', () => expect(displayStreak({ count: 4, lastGoalDate: '2026-11-10', freezes: 0, goalDays: [] }, '2026-11-19').broken).toBe(true));
});

describe('achievements', () => {
  const base = { solved: 0, selfCorrections: 0, sessionZeroHintSolves: 0, hintFreeMultiStep: false, beatHighMisconception: false, goalDaysLastWeek: 0, streak: 0, allMastered: false };
  it('first light once only', () => {
    expect(evaluateAchievements({ ...base, solved: 1 }, new Set()).map((a) => a.id)).toEqual(['first-light']);
    expect(evaluateAchievements({ ...base, solved: 2 }, new Set(['first-light']))).toEqual([]);
  });
});

describe('recommender', () => {
  it('new student starts with negative numbers', () => expect(recommend({}).skillId).toBe('neg-numbers'));
  it('prefers misconception-tagged problems', () => {
    const m = (v: number) => ({ ...emptyMastery(v) });
    const r = recommend({ 'neg-numbers': m(0.8), 'order-ops': m(0.75), fractions: m(0.65), 'two-step': m(0.5) }, { 'M-SIGN-MOVE': 4 });
    expect(r.skillId).toBe('two-step');
    expect(r.problemIds.length).toBe(3);
  });
});
