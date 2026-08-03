import Constants from 'expo-constants';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

type FirebaseExtra = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

function readFirebaseConfig(): FirebaseExtra {
  const extra = (Constants.expoConfig?.extra?.firebase ?? {}) as FirebaseExtra;
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || extra.apiKey,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || extra.authDomain,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || extra.projectId,
    storageBucket:
      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || extra.storageBucket,
    messagingSenderId:
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
      extra.messagingSenderId,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || extra.appId,
  };
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  const config = readFirebaseConfig();
  if (!config.apiKey || !config.projectId) {
    console.warn(
      '[firebase] Missing EXPO_PUBLIC_FIREBASE_* env vars. Firestore disabled.'
    );
    return null;
  }

  if (!app) {
    app = !getApps().length
      ? initializeApp({
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          storageBucket: config.storageBucket,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId,
        })
      : getApp();
  }
  return app;
}

export function getDb(): Firestore | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!db) db = getFirestore(firebaseApp);
  return db;
}

export { app, db };
