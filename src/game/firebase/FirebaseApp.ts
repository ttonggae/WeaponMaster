import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

export interface FirebaseServices {
  app: FirebaseApp;
  db: Firestore;
}

export function getFirebaseServices(): FirebaseServices | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  const app =
    getApps()[0] ??
    initializeApp({
      apiKey,
      authDomain,
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined,
      projectId,
      appId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
    });

  return {
    app,
    db: getFirestore(app),
  };
}
