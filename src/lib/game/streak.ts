/** Daily goal and streak, keyed by the student's local date (YYYY-MM-DD). */
export interface Streak {
  count: number;
  lastGoalDate: string | null;
  freezes: number;
  /** Local dates on which the goal was met (last 14). */
  goalDays: string[];
}

export const emptyStreak = (): Streak => ({ count: 0, lastGoalDate: null, freezes: 0, goalDays: [] });

export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysBetween(a: string, b: string): number {
  const ms = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  return Math.round(ms / 86400000);
}

/** Call when the daily goal is met today. Uses freezes to bridge missed days (max 2 banked). */
export function meetGoal(s: Streak, today: string): { streak: Streak; usedFreezes: number; earnedFreeze: boolean } {
  if (s.lastGoalDate === today) return { streak: s, usedFreezes: 0, earnedFreeze: false };
  let count = s.count;
  let freezes = s.freezes;
  let usedFreezes = 0;
  if (!s.lastGoalDate) count = 1;
  else {
    const gap = daysBetween(s.lastGoalDate, today);
    const missed = gap - 1;
    if (missed <= 0) count += 1;
    else if (missed <= freezes) {
      freezes -= missed;
      usedFreezes = missed;
      count += 1;
    } else count = 1;
  }
  const goalDays = [...s.goalDays.filter((d) => daysBetween(d, today) < 14), today];
  const lastWeek = goalDays.filter((d) => daysBetween(d, today) < 7).length;
  // meeting the goal 5 times in a rolling week earns one freeze (only on the 5th day, max 2)
  const earnedFreeze = lastWeek === 5 && freezes < 2;
  if (earnedFreeze) freezes += 1;
  return { streak: { count, lastGoalDate: today, freezes, goalDays }, usedFreezes, earnedFreeze };
}

/** Streak as it should be displayed today (0 if it has lapsed beyond the freezes). */
export function displayStreak(s: Streak, today: string): { count: number; broken: boolean } {
  if (!s.lastGoalDate) return { count: 0, broken: false };
  const missed = daysBetween(s.lastGoalDate, today) - 1;
  if (missed <= s.freezes) return { count: s.count, broken: false };
  return { count: 0, broken: s.count > 0 };
}
