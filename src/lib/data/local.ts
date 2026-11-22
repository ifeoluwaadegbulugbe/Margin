/** Local mode: everything in this browser's localStorage (used when Firebase is not configured). */
import type { Repo, CompletionBatch } from './repo';
import type { MasteryRecord } from '@/lib/game/mastery';
import type { AchievementUnlock, Insight, LedgerEntry, MisconceptionCount, SessionRecord, UserProfile } from '@/types/domain';

interface LocalDb {
  user: UserProfile | null;
  mastery: Record<string, MasteryRecord>;
  misconceptions: Record<string, MisconceptionCount>;
  achievements: Record<string, AchievementUnlock>;
  sessions: Record<string, SessionRecord>;
  insights: Insight[];
  ledger: LedgerEntry[];
}

const empty = (): LocalDb => ({ user: null, mastery: {}, misconceptions: {}, achievements: {}, sessions: {}, insights: [], ledger: [] });
const key = (uid: string) => `margin.db.${uid}`;
const memory = new Map<string, LocalDb>();

function load(uid: string): LocalDb {
  try {
    const raw = window.localStorage.getItem(key(uid));
    if (raw) return { ...empty(), ...JSON.parse(raw) };
  } catch {
    /* blocked storage: fall through to memory */
  }
  return memory.get(uid) ?? empty();
}

function save(uid: string, db: LocalDb) {
  memory.set(uid, db);
  try {
    window.localStorage.setItem(key(uid), JSON.stringify(db));
  } catch {
    /* in-memory only */
  }
}

function mutate(uid: string, fn: (db: LocalDb) => void) {
  const db = load(uid);
  fn(db);
  save(uid, db);
}

export const localRepo: Repo = {
  kind: 'local',
  async getUser(uid) { return load(uid).user; },
  async createUser(profile) { mutate(profile.uid, (db) => { db.user = profile; }); },
  async updateUser(uid, patch) { mutate(uid, (db) => { if (db.user) db.user = { ...db.user, ...patch }; }); },
  async getMastery(uid) { return load(uid).mastery; },
  async setMastery(uid, records) { mutate(uid, (db) => { db.mastery = { ...db.mastery, ...records }; }); },
  async getMisconceptions(uid) { return load(uid).misconceptions; },
  async setMisconceptionSeverity(uid, id, severity) {
    mutate(uid, (db) => {
      const cur = db.misconceptions[id];
      if (cur) db.misconceptions[id] = { ...cur, severity };
    });
  },
  async getAchievements(uid) { return load(uid).achievements; },
  async saveSession(uid, session) { mutate(uid, (db) => { db.sessions[session.id] = session; }); },
  async recentSessions(uid, n) {
    return Object.values(load(uid).sessions).sort((a, b) => b.startedAt - a.startedAt).slice(0, n);
  },
  async addInsight(uid, insight) { mutate(uid, (db) => { db.insights = [insight, ...db.insights].slice(0, 20); }); },
  async latestInsight(uid) { return load(uid).insights[0] ?? null; },
  async recentLedger(uid, n) { return [...load(uid).ledger].sort((a, b) => b.createdAt - a.createdAt).slice(0, n); },
  async completeSession(uid, b: CompletionBatch) {
    mutate(uid, (db) => {
      db.sessions[b.session.id] = b.session;
      if (db.user) db.user = { ...db.user, ...b.userPatch };
      db.ledger.push(...b.ledger);
      db.mastery = { ...db.mastery, ...b.mastery };
      db.misconceptions = { ...db.misconceptions, ...b.misconceptions };
      db.achievements = { ...db.achievements, ...b.achievements };
    });
  },
};
