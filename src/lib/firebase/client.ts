import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * True when the web app config is present. Without it the app still runs in "local mode":
 * progress is kept in this browser and Nova uses its authored script (labelled honestly).
 */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let appCheckStarted = false;

export function firebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured || typeof window === 'undefined') return null;
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig as Required<typeof firebaseConfig>);
  if (!appCheckStarted) {
    appCheckStarted = true;
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (process.env.NODE_ENV !== 'production') {
      // Development only (this branch is removed from production builds). A fixed token from .env.local
      // works in every local browser; without one, the SDK prints a per-browser token in the console.
      // Register it in Firebase console > App Check > Apps > Manage debug tokens.
      const fixed = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
      (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN = fixed || true;
    } else if (isLocal) {
      (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    if (siteKey) {
      initializeAppCheck(_app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });
    } else {
      console.warn('[margin] NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY is missing: App Check is not initialised, so Firebase AI Logic will reject requests.');
    }
  }
  return _app;
}

export function firebaseAuth(): Auth | null {
  const app = firebaseApp();
  if (!app) return null;
  return (_auth ??= getAuth(app));
}

export function firestore(): Firestore | null {
  const app = firebaseApp();
  if (!app) return null;
  return (_db ??= initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }));
}
