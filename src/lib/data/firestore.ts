/** Firestore repository. Everything per-user lives under users/{uid}, so one rule protects it. */
import {
  collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, writeBatch, type Firestore,
} from 'firebase/firestore';
import type { Repo } from './repo';
import type { MasteryRecord } from '@/lib/game/mastery';
import type { AchievementUnlock, Insight, LedgerEntry, MisconceptionCount, SessionRecord, UserProfile } from '@/types/domain';

/** Firestore rejects `undefined`; strip it recursively. */
function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, val) => (val === undefined ? null : val)));
}

export function firestoreRepo(db: Firestore): Repo {
  const userRef = (uid: string) => doc(db, 'users', uid);
  const sub = (uid: string, name: string) => collection(db, 'users', uid, name);

  async function readMap<T>(uid: string, name: string): Promise<Record<string, T>> {
    const snap = await getDocs(sub(uid, name));
    const out: Record<string, T> = {};
    snap.forEach((d) => { out[d.id] = d.data() as T; });
    return out;
  }

  return {
    kind: 'firestore',
    async getUser(uid) {
      const s = await getDoc(userRef(uid));
      return s.exists() ? (s.data() as UserProfile) : null;
    },
    async createUser(profile) { await setDoc(userRef(profile.uid), clean(profile)); },
    async updateUser(uid, patch) { await updateDoc(userRef(uid), clean(patch) as Record<string, unknown>); },
    async getMastery(uid) { return readMap<MasteryRecord>(uid, 'mastery'); },
    async setMastery(uid, records) {
      const b = writeBatch(db);
      for (const [id, rec] of Object.entries(records)) b.set(doc(sub(uid, 'mastery'), id), clean({ ...rec, updatedAt: Date.now() }));
      await b.commit();
    },
    async getMisconceptions(uid) { return readMap<MisconceptionCount>(uid, 'misconceptions'); },
    async setMisconceptionSeverity(uid, id, severity) {
      await setDoc(doc(sub(uid, 'misconceptions'), id), { severity }, { merge: true });
    },
    async getAchievements(uid) { return readMap<AchievementUnlock>(uid, 'achievements'); },
    async saveSession(uid, session) { await setDoc(doc(sub(uid, 'sessions'), session.id), clean(session)); },
    async recentSessions(uid, n) {
      const snap = await getDocs(query(sub(uid, 'sessions'), orderBy('startedAt', 'desc'), limit(n)));
      return snap.docs.map((d) => d.data() as SessionRecord);
    },
    async addInsight(uid, insight) { await setDoc(doc(sub(uid, 'insights'), insight.id), clean(insight)); },
    async latestInsight(uid) {
      const snap = await getDocs(query(sub(uid, 'insights'), orderBy('createdAt', 'desc'), limit(1)));
      return snap.empty ? null : (snap.docs[0].data() as Insight);
    },
    async recentLedger(uid, n) {
      const snap = await getDocs(query(sub(uid, 'xpLedger'), orderBy('createdAt', 'desc'), limit(n)));
      return snap.docs.map((d) => d.data() as LedgerEntry);
    },
    async completeSession(uid, b) {
      const batch = writeBatch(db);
      batch.set(doc(sub(uid, 'sessions'), b.session.id), clean(b.session));
      batch.update(userRef(uid), clean(b.userPatch) as Record<string, unknown>);
      for (const tx of b.ledger) batch.set(doc(sub(uid, 'xpLedger'), tx.id), clean(tx));
      for (const [id, rec] of Object.entries(b.mastery)) batch.set(doc(sub(uid, 'mastery'), id), clean({ ...rec, updatedAt: Date.now() }));
      for (const [id, m] of Object.entries(b.misconceptions)) batch.set(doc(sub(uid, 'misconceptions'), id), clean(m));
      for (const [id, a] of Object.entries(b.achievements)) batch.set(doc(sub(uid, 'achievements'), id), clean(a));
      await batch.commit();
    },
  };
}
