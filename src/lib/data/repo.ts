import type { MasteryRecord } from '@/lib/game/mastery';
import type { AchievementUnlock, Insight, LedgerEntry, MisconceptionCount, SessionRecord, UserProfile } from '@/types/domain';

export interface CompletionBatch {
  session: SessionRecord;
  userPatch: Partial<UserProfile>;
  ledger: LedgerEntry[];
  mastery: Record<string, MasteryRecord>;
  misconceptions: Record<string, MisconceptionCount>;
  achievements: Record<string, AchievementUnlock>;
}

/** Repository interface; Firestore in production, this browser's storage in local mode. */
export interface Repo {
  kind: 'firestore' | 'local';
  getUser(uid: string): Promise<UserProfile | null>;
  createUser(profile: UserProfile): Promise<void>;
  updateUser(uid: string, patch: Partial<UserProfile>): Promise<void>;
  getMastery(uid: string): Promise<Record<string, MasteryRecord>>;
  setMastery(uid: string, records: Record<string, MasteryRecord>): Promise<void>;
  getMisconceptions(uid: string): Promise<Record<string, MisconceptionCount>>;
  setMisconceptionSeverity(uid: string, id: string, severity: MisconceptionCount['severity']): Promise<void>;
  getAchievements(uid: string): Promise<Record<string, AchievementUnlock>>;
  saveSession(uid: string, session: SessionRecord): Promise<void>;
  recentSessions(uid: string, n: number): Promise<SessionRecord[]>;
  addInsight(uid: string, insight: Insight): Promise<void>;
  latestInsight(uid: string): Promise<Insight | null>;
  recentLedger(uid: string, n: number): Promise<LedgerEntry[]>;
  completeSession(uid: string, batch: CompletionBatch): Promise<void>;
}
