/** Session completion: one pure function that produces the batched write and the rewards summary. */
import { getProblem, SKILLS } from '@/content';
import type { MisconceptionId } from '@/content/misconceptions';
import type { ProblemState } from '@/lib/learning/reducer';
import type { CompletionBatch } from '@/lib/data/repo';
import type { AchievementUnlock, LedgerEntry, MisconceptionCount, ProblemSummary, SessionRecord, UserProfile } from '@/types/domain';
import { problemXp, XP, type XpTx } from './xp';
import { levelFor } from './levels';
import { emptyMastery, performanceScore, updateMastery, type MasteryRecord } from './mastery';
import { meetGoal, daysBetween } from './streak';
import { evaluateAchievements, type AchievementDef } from './achievements';

export function summariseProblem(s: ProblemState): ProblemSummary {
  const errors = s.lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.result.status === 'changed')
    .map(({ l, i }) => ({
      line: i + 1,
      misconception: l.result.misconception,
      fixedBySelf: !!l.superseded,
      text: l.text,
      message: l.result.message,
    }));
  return {
    id: s.problemId,
    solved: s.solved,
    hintMax: s.supported ? 4 : s.hintLevel,
    lines: s.lines.length,
    errors,
    explanation: s.explanation,
    transfer: !!s.transfer?.solved,
    secs: Math.round(((s.endedAt ?? Date.now()) - s.startedAt) / 1000),
    supported: s.supported,
  };
}

export interface CompletionSummary {
  tx: XpTx[];
  total: number;
  levelBefore: number;
  levelAfter: number;
  xpBefore: number;
  xpAfter: number;
  masteryDelta: { skillId: string; before: number; after: number; mastered: boolean }[];
  achievements: AchievementDef[];
  goalMet: boolean;
  streak: number;
  usedFreezes: number;
}

export function computeCompletion(args: {
  user: UserProfile;
  mastery: Record<string, MasteryRecord>;
  misconceptions: Record<string, MisconceptionCount>;
  unlocked: Set<string>;
  session: SessionRecord;
  states: ProblemState[];
  watchIds: string[];
  highSeverityIds: string[];
  today: string;
  now?: number;
}): { batch: CompletionBatch; summary: CompletionSummary } {
  const { user, session, states, today } = args;
  const now = args.now ?? Date.now();
  const tx: XpTx[] = [];
  const masteryOut: Record<string, MasteryRecord> = {};
  const before: Record<string, number> = {};
  const misconceptionsOut: Record<string, MisconceptionCount> = {};

  for (const s of states) {
    const p = getProblem(s.problemId);
    if (!p) continue;
    const targets = p.tags.filter((t) => t.startsWith('M-'));
    tx.push(...problemXp(s, targets, args.watchIds as MisconceptionId[]));
    // mastery: every attempted problem counts (unsolved scores 0)
    const cur = masteryOut[p.skillId] ?? args.mastery[p.skillId] ?? emptyMastery();
    before[p.skillId] ??= cur.value;
    masteryOut[p.skillId] = updateMastery(cur, performanceScore(s), s.supported ? 4 : s.hintLevel);
    for (const m of s.misconceptions) {
      const prev = misconceptionsOut[m] ?? args.misconceptions[m] ?? { count: 0, sessions: [], lastSeen: 0, beaten: false, severity: null };
      const errorsThisProblem = s.lines.filter((l) => l.result.misconception === m).length;
      misconceptionsOut[m] = {
        ...prev,
        count: prev.count + errorsThisProblem,
        sessions: prev.sessions.includes(session.id) ? prev.sessions : [...prev.sessions, session.id].slice(-10),
        lastSeen: now,
        beaten: false,
      };
    }
  }

  const solvedNow = states.filter((s) => s.solved).length;
  const todayCount = (user.todaySolved.date === today ? user.todaySolved.count : 0) + solvedNow;
  const goalAlreadyMet = user.streak.lastGoalDate === today;
  const goalMet = !goalAlreadyMet && todayCount >= user.dailyGoal;
  let streak = user.streak;
  let usedFreezes = 0;
  if (goalMet) {
    const r = meetGoal(user.streak, today);
    streak = r.streak;
    usedFreezes = r.usedFreezes;
    tx.push({ amount: XP.dailyGoal, reason: 'daily_goal', detail: 'Daily goal met' });
  }

  // beaten misconceptions (Comeback Learner): solved a targeted problem cleanly
  let beatHigh = false;
  for (const s of states) {
    const p = getProblem(s.problemId);
    if (!p || !s.solved) continue;
    for (const id of args.highSeverityIds) {
      if (p.tags.includes(id) && !s.misconceptions.includes(id as MisconceptionId)) {
        beatHigh = true;
        const prev = misconceptionsOut[id] ?? args.misconceptions[id];
        if (prev) misconceptionsOut[id] = { ...prev, beaten: true };
      }
    }
  }

  const allMastery = { ...args.mastery, ...masteryOut };
  const zeroHint = states.filter((s) => s.solved && s.hintLevel === 0 && !s.supported).length;
  const stats = {
    solved: user.stats.solved + solvedNow,
    independent: user.stats.independent + states.filter((s) => s.solved && s.hintLevel <= 1 && !s.supported).length,
    selfCorrections: user.stats.selfCorrections + states.reduce((a, s) => a + s.selfCorrections, 0),
    sessions: user.stats.sessions + 1,
  };
  const newAchievements = evaluateAchievements({
    solved: stats.solved,
    selfCorrections: stats.selfCorrections,
    sessionZeroHintSolves: zeroHint,
    hintFreeMultiStep: states.some((s) => {
      const p = getProblem(s.problemId);
      return s.solved && s.hintLevel === 0 && !s.supported && !!p && (p.steps.length >= 2 || p.skillId === 'multi-step');
    }),
    beatHighMisconception: beatHigh,
    goalDaysLastWeek: streak.goalDays.filter((d) => daysBetween(d, today) < 7).length,
    streak: streak.count,
    allMastered: SKILLS.every((k) => allMastery[k.id]?.mastered),
  }, args.unlocked);
  for (const a of newAchievements) tx.push({ amount: a.reward, reason: 'achievement', detail: a.name });

  const total = tx.reduce((a, t) => a + t.amount, 0);
  const xpAfter = user.xp + total;
  const levelAfter = levelFor(xpAfter);
  const ledger: LedgerEntry[] = tx.flatMap((t, i) => splitTx(t).map((amount, j) => ({
    id: `${session.id}_${i}_${j}`, amount, reason: t.reason, detail: t.detail, sessionId: session.id, createdAt: now,
  })));
  const achievements: Record<string, AchievementUnlock> = Object.fromEntries(newAchievements.map((a) => [a.id, { unlockedAt: now, sessionId: session.id }]));

  const finished: SessionRecord = {
    ...session,
    status: 'complete',
    endedAt: now,
    currentState: null,
    problems: states.map(summariseProblem),
    xpEarned: total,
  };

  return {
    batch: {
      session: finished,
      userPatch: { xp: xpAfter, level: levelAfter, streak, todaySolved: { date: today, count: todayCount }, stats },
      ledger,
      mastery: masteryOut,
      misconceptions: misconceptionsOut,
      achievements,
    },
    summary: {
      tx, total, levelBefore: user.level, levelAfter, xpBefore: user.xp, xpAfter,
      masteryDelta: Object.entries(masteryOut).map(([skillId, m]) => ({ skillId, before: before[skillId] ?? 0, after: m.value, mastered: m.mastered })),
      achievements: newAchievements, goalMet, streak: streak.count, usedFreezes,
    },
  };
}

/** Ledger rules cap one entry at 200; split larger awards into several auditable rows. */
function splitTx(t: XpTx): number[] {
  const out: number[] = [];
  let left = t.amount;
  while (left > 200) { out.push(200); left -= 200; }
  if (left > 0) out.push(left);
  return out;
}
