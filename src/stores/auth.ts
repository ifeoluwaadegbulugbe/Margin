import { create } from 'zustand';
import {
  GoogleAuthProvider, linkWithPopup, onAuthStateChanged, signInAnonymously, signInWithPopup, signOut as fbSignOut,
} from 'firebase/auth';
import { firebaseAuth, firestore, isFirebaseConfigured } from '@/lib/firebase/client';
import { firestoreRepo } from '@/lib/data/firestore';
import { localRepo } from '@/lib/data/local';
import type { Repo } from '@/lib/data/repo';

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  uid: string | null;
  isAnonymous: boolean;
  displayName: string | null;
  repo: Repo;
  error: string | null;
  init: () => () => void;
  signInGuest: () => Promise<void>;
  signInGoogle: () => Promise<void>;
  linkGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const LOCAL_UID_KEY = 'margin.localUid';
const readLocalUid = () => {
  try {
    return window.localStorage.getItem(LOCAL_UID_KEY);
  } catch {
    return null;
  }
};

function friendly(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  if (code === 'auth/popup-blocked') return 'Your browser blocked the sign-in popup. Allow popups for this site and try again.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'Sign-in was cancelled.';
  if (code === 'auth/network-request-failed') return 'Network problem. Check your connection and retry.';
  if (code === 'auth/unauthorized-domain') return 'This domain is not authorised for sign-in. Add it in Firebase console > Authentication > Settings.';
  if (code === 'auth/operation-not-allowed') return 'That sign-in method is not enabled in the Firebase console.';
  return e instanceof Error ? e.message : String(e);
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  uid: null,
  isAnonymous: true,
  displayName: null,
  repo: localRepo,
  error: null,

  init: () => {
    const auth = firebaseAuth();
    const db = firestore();
    if (!auth || !db) {
      const uid = readLocalUid();
      set({ status: uid ? 'signedIn' : 'signedOut', uid, isAnonymous: true, repo: localRepo });
      return () => {};
    }
    set({ repo: firestoreRepo(db) });
    return onAuthStateChanged(auth, (u) => {
      if (u) set({ status: 'signedIn', uid: u.uid, isAnonymous: u.isAnonymous, displayName: u.displayName });
      else set({ status: 'signedOut', uid: null, isAnonymous: true, displayName: null });
    });
  },

  signInGuest: async () => {
    set({ error: null });
    const auth = firebaseAuth();
    if (!auth) {
      const uid = `local_${Math.random().toString(36).slice(2, 10)}`;
      try {
        window.localStorage.setItem(LOCAL_UID_KEY, uid);
      } catch {
        /* memory only */
      }
      set({ status: 'signedIn', uid, isAnonymous: true });
      return;
    }
    try {
      await signInAnonymously(auth);
    } catch (e) {
      set({ error: friendly(e) });
      throw e;
    }
  },

  signInGoogle: async () => {
    set({ error: null });
    const auth = firebaseAuth();
    if (!auth) {
      set({ error: 'Google sign-in needs Firebase to be configured. Continue as a guest for now.' });
      return;
    }
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      set({ error: friendly(e) });
      throw e;
    }
  },

  /** Upgrade a guest to Google, keeping the same uid and data. */
  linkGoogle: async () => {
    const auth = firebaseAuth();
    if (!auth?.currentUser) return 'Google linking needs Firebase to be configured.';
    try {
      const cred = await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
      set({ isAnonymous: false, displayName: cred.user.displayName });
      return null;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/credential-already-in-use') {
        return 'That Google account already has Lodestar progress. Your guest progress stays on this guest account.';
      }
      return friendly(e);
    }
  },

  signOut: async () => {
    const auth = firebaseAuth();
    if (auth) await fbSignOut(auth);
    else {
      try {
        window.localStorage.removeItem(LOCAL_UID_KEY);
      } catch {
        /* ignore */
      }
      set({ status: 'signedOut', uid: null });
    }
    void get;
  },
}));

export { isFirebaseConfigured };
