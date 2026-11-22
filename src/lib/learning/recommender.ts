/** Deterministic next-expedition recommender: fallback for, and sanity check on, the Strategist. */
import { SKILLS, coreProblems, getProblem, getSkill } from '@/content';
import { isUnlocked, type MasteryRecord } from '@/lib/game/mastery';

export interface Expedition {
  skillId: string;
  problemIds: string[];
  reason: string;
  focus: string;
  source: 'strategist' | 'rules';
  type: 'next' | 'fix-it' | 'calibration' | 'single';
}

export type MasteryMap = Record<string, MasteryRecord | undefined>;

export function unlockedSkills(mastery: MasteryMap) {
  return SKILLS.filter((s) => isUnlocked(s.prerequisites, mastery));
}

function difficultyBand(m: number): number[] {
  if (m < 0.4) return [1, 2];
  if (m <= 0.7) return [2];
  return [2, 3];
}

/**
 * Pick the unlocked, unmastered skill with the lowest mastery; prefer problems tagged with the
 * student's most frequent misconception; choose difficulty from mastery.
 */
export function recommend(
  mastery: MasteryMap,
  misconceptionCounts: Record<string, number> = {},
  recentProblemIds: string[] = [],
  difficultyAdjustment: 'easier' | 'same' | 'harder' = 'same',
): Expedition {
  const open = unlockedSkills(mastery).filter((s) => !mastery[s.id]?.mastered);
  const pool = open.length ? open : unlockedSkills(mastery);
  const skill = [...pool].sort((a, b) => (mastery[a.id]?.value ?? 0) - (mastery[b.id]?.value ?? 0))[0] ?? SKILLS[0];
  const m = mastery[skill.id]?.value ?? 0;
  let band = difficultyBand(m);
  if (difficultyAdjustment === 'easier') band = [1, 2];
  if (difficultyAdjustment === 'harder') band = [2, 3];
  const topMisconception = Object.entries(misconceptionCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const name = getSkill(skill.id)?.name ?? skill.id;
  return {
    skillId: skill.id,
    problemIds: pickProblems(skill.id, band, topMisconception, recentProblemIds),
    reason: m === 0 ? `Start your first page of ${name}.` : `${name} is your least practised open topic at ${Math.round(m * 100)}%.`,
    focus: topMisconception ? 'Watch each step keeps both sides balanced.' : 'Explain each move to yourself as you go.',
    source: 'rules',
    type: 'next',
  };
}

/** A practice expedition for one chosen skill (from the star map). */
export function expeditionForSkill(skillId: string, mastery: MasteryMap, misconceptionCounts: Record<string, number> = {}): Expedition {
  const top = Object.entries(misconceptionCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const name = getSkill(skillId)?.name ?? skillId;
  return {
    skillId,
    problemIds: pickProblems(skillId, difficultyBand(mastery[skillId]?.value ?? 0), top, []),
    reason: `Practise ${name}.`,
    focus: 'Explain each move to yourself as you go.',
    source: 'rules',
    type: 'next',
  };
}

function pickProblems(skillId: string, band: number[], topMisconception: string | undefined, recentProblemIds: string[]): string[] {
  const candidates = coreProblems(skillId);
  const score = (id: string) => {
    const p = getProblem(id)!;
    let s = 0;
    if (band.includes(p.difficulty)) s += 4;
    if (topMisconception && p.tags.includes(topMisconception)) s += 3;
    if (recentProblemIds.includes(id)) s -= 5;
    return s - p.difficulty * 0.1;
  };
  return candidates
    .map((p) => p.id)
    .sort((a, b) => score(b) - score(a))
    .slice(0, 3)
    .sort((a, b) => getProblem(a)!.difficulty - getProblem(b)!.difficulty);
}
