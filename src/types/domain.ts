import type { Streak } from '@/lib/game/streak';
import type { MasteryRecord } from '@/lib/game/mastery';
import type { ProblemState } from '@/lib/learning/reducer';
import type { StrategistOutput } from '@/lib/ai/schemas';
import type { XpReason } from '@/lib/game/xp';
import type { Expedition } from '@/lib/learning/recommender';

export type YearGroup = 7 | 8 | 9 | 10 | 11 | 12 | 13 | 'adult';
export type Tone = 'encouraging' | 'direct';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  isAnonymous: boolean;
  createdAt: number;
  yearGroup: YearGroup;
  tone: Tone;
  dailyGoal: 1 | 2 | 3;
  onboardingStep: number;
  calibrated: boolean;
  activeConstellation: string;
  xp: number;
  level: number;
  streak: Streak;
  todaySolved: { date: string; count: number };
  stats: { solved: number; independent: number; selfCorrections: number; sessions: number };
  sound: boolean;
}

export interface ProblemSummary {
  id: string;
  solved: boolean;
  hintMax: number;
  lines: number;
  errors: { line: number; misconception: string | null; fixedBySelf: boolean; text: string; message: string }[];
  explanation: string;
  transfer: boolean;
  secs: number;
  supported: boolean;
}

export interface SessionRecord {
  id: string;
  expeditionType: Expedition['type'];
  skillId: string;
  problemIds: string[];
  reason: string;
  focus: string;
  status: 'active' | 'complete' | 'abandoned';
  startedAt: number;
  endedAt: number | null;
  currentIndex: number;
  currentState: ProblemState | null;
  problems: ProblemSummary[];
  inferenceCounts: { onDevice: number; cloud: number; scripted: number };
  xpEarned: number;
}

export interface MisconceptionCount {
  count: number;
  sessions: string[];
  lastSeen: number;
  beaten: boolean;
  severity: 'low' | 'medium' | 'high' | null;
}

export interface Insight {
  id: string;
  type: 'post_session' | 'weekly' | 'first_route';
  createdAt: number;
  source: string;
  latencyMs: number;
  model: string;
  output: StrategistOutput;
  adjustments: string[];
}

export interface LedgerEntry {
  id: string;
  amount: number;
  reason: XpReason;
  detail: string;
  sessionId: string;
  createdAt: number;
}

export interface AchievementUnlock {
  unlockedAt: number;
  sessionId: string;
}

export type MasteryMapStrict = Record<string, MasteryRecord>;
