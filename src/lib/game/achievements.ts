/** Achievements are decided by pure functions over deterministic stats, never by AI. */
export interface AchievementDef {
  id: string;
  name: string;
  meaning: string;
  reward: number;
  icon: 'sparkle' | 'brain' | 'feather' | 'wrench' | 'rocket' | 'calendar' | 'flame' | 'crown';
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-light', name: 'First Discovery', meaning: 'You solved your first challenge.', reward: 20, icon: 'sparkle' },
  { id: 'independent-thinker', name: 'Independent Thinker', meaning: 'Three problems in one session with zero hints.', reward: 50, icon: 'brain' },
  { id: 'hint-free', name: 'Clean Page', meaning: 'A multi-step problem solved with no hints at all.', reward: 30, icon: 'feather' },
  { id: 'self-corrector', name: 'Eraser Expert', meaning: 'You caught and fixed your own mistake five times.', reward: 40, icon: 'wrench' },
  { id: 'comeback', name: 'The Comeback', meaning: 'You beat a mistake you used to make.', reward: 60, icon: 'rocket' },
  { id: 'consistency', name: 'Consistency Club', meaning: 'Daily goal met on 5 days in a week.', reward: 50, icon: 'calendar' },
  { id: 'seven-day', name: 'Seven-Day Streak', meaning: 'Seven goal days in a row.', reward: 70, icon: 'flame' },
  { id: 'concept-master', name: 'Concept Collector', meaning: 'Every topic in Algebra foundations mastered.', reward: 150, icon: 'crown' },
];

export interface AchievementStats {
  solved: number;
  selfCorrections: number;
  sessionZeroHintSolves: number;
  /** Solved a multi-step (difficulty ≥ 2 or multi-step skill) problem with zero hints this session. */
  hintFreeMultiStep: boolean;
  beatHighMisconception: boolean;
  goalDaysLastWeek: number;
  streak: number;
  allMastered: boolean;
}

export function evaluateAchievements(stats: AchievementStats, unlocked: Set<string>): AchievementDef[] {
  const checks: Record<string, boolean> = {
    'first-light': stats.solved >= 1,
    'independent-thinker': stats.sessionZeroHintSolves >= 3,
    'hint-free': stats.hintFreeMultiStep,
    'self-corrector': stats.selfCorrections >= 5,
    comeback: stats.beatHighMisconception,
    consistency: stats.goalDaysLastWeek >= 5,
    'seven-day': stats.streak >= 7,
    'concept-master': stats.allMastered,
  };
  return ACHIEVEMENTS.filter((a) => checks[a.id] && !unlocked.has(a.id));
}
