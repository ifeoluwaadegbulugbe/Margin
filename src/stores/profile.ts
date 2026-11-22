import { create } from 'zustand';
import type { MasteryRecord } from '@/lib/game/mastery';
import { emptyStreak } from '@/lib/game/streak';
import type { AchievementUnlock, Insight, MisconceptionCount, SessionRecord, UserProfile } from '@/types/domain';
import { useAuth } from './auth';
import { useToast } from './toast';

interface ProfileState {
  loaded: boolean;
  loading: boolean;
  user: UserProfile | null;
  mastery: Record<string, MasteryRecord>;
  misconceptions: Record<string, MisconceptionCount>;
  achievements: Record<string, AchievementUnlock>;
  insight: Insight | null;
  sessions: SessionRecord[];
  strategistPending: boolean;
  load: (uid: string) => Promise<void>;
  ensureUser: () => Promise<UserProfile>;
  update: (patch: Partial<UserProfile>) => Promise<void>;
  setMastery: (records: Record<string, MasteryRecord>) => Promise<void>;
  setInsight: (i: Insight) => Promise<void>;
  refreshSessions: () => Promise<void>;
  setStrategistPending: (v: boolean) => void;
  reset: () => void;
}

export function newProfile(uid: string, isAnonymous: boolean, displayName: string | null): UserProfile {
  return {
    uid, displayName, isAnonymous, createdAt: Date.now(), yearGroup: 10, tone: 'encouraging', dailyGoal: 2,
    onboardingStep: 0, calibrated: false, activeConstellation: 'algebra-foundations', xp: 0, level: 1,
    streak: emptyStreak(), todaySolved: { date: '', count: 0 }, stats: { solved: 0, independent: 0, selfCorrections: 0, sessions: 0 }, sound: false,
  };
}

const repo = () => useAuth.getState().repo;
const fail = (what: string) => (e: unknown) => {
  console.error(`[margin] ${what}`, e);
  useToast.getState().push({ kind: 'error', text: `Couldn't ${what}. Your progress is kept on this device.`, persist: true });
};

export const useProfile = create<ProfileState>((set, get) => ({
  loaded: false,
  loading: false,
  user: null,
  mastery: {},
  misconceptions: {},
  achievements: {},
  insight: null,
  sessions: [],
  strategistPending: false,

  load: async (uid) => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const r = repo();
      const [user, mastery, misconceptions, achievements, insight, sessions] = await Promise.all([
        r.getUser(uid), r.getMastery(uid), r.getMisconceptions(uid), r.getAchievements(uid), r.latestInsight(uid), r.recentSessions(uid, 8),
      ]);
      set({ user, mastery, misconceptions, achievements, insight, sessions, loaded: true });
    } catch (e) {
      fail('load your progress')(e);
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  ensureUser: async () => {
    const existing = get().user;
    if (existing) return existing;
    const { uid, isAnonymous, displayName } = useAuth.getState();
    if (!uid) throw new Error('not signed in');
    const profile = newProfile(uid, isAnonymous, displayName);
    await repo().createUser(profile).catch(fail('create your profile'));
    set({ user: profile });
    return profile;
  },

  update: async (patch) => {
    const u = get().user;
    if (!u) return;
    set({ user: { ...u, ...patch } });
    await repo().updateUser(u.uid, patch).catch(fail('save your settings'));
  },

  setMastery: async (records) => {
    const u = get().user;
    set({ mastery: { ...get().mastery, ...records } });
    if (u) await repo().setMastery(u.uid, records).catch(fail('save mastery'));
  },

  setInsight: async (insight) => {
    const u = get().user;
    set({ insight });
    if (!u) return;
    await repo().addInsight(u.uid, insight).catch(fail('save the Cartographer report'));
    const m = { ...get().misconceptions };
    for (const r of insight.output.recurring_misconceptions) {
      if (m[r.id]) {
        m[r.id] = { ...m[r.id], severity: r.severity };
        await repo().setMisconceptionSeverity(u.uid, r.id, r.severity).catch(() => {});
      }
    }
    set({ misconceptions: m });
  },

  refreshSessions: async () => {
    const u = get().user;
    if (!u) return;
    const sessions = await repo().recentSessions(u.uid, 8).catch(() => get().sessions);
    set({ sessions });
  },

  setStrategistPending: (strategistPending) => set({ strategistPending }),

  reset: () => set({ loaded: false, user: null, mastery: {}, misconceptions: {}, achievements: {}, insight: null, sessions: [] }),
}));
