import { initializeApp } from "firebase/app";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// E2E-only switch: when VITE_USE_FIREBASE_EMULATOR === "1" the SDK is pointed at
// the local Firebase Emulator Suite (see firebase.json `emulators` + e2e/).
// Normal dev (`pnpm dev`) and production builds leave this unset, so they are
// completely unaffected — no emulator connection is ever attempted.
const USE_EMULATOR = import.meta.env.VITE_USE_FIREBASE_EMULATOR === "1";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const functions = getFunctions(app, "us-central1");
if (USE_EMULATOR) connectFunctionsEmulator(functions, "127.0.0.1", 5001);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Persistent IndexedDB cache: instant warm loads + fewer reads (free-tier friendly).
// Multi-tab manager keeps several open tabs consistent. Under the emulator we
// skip the persistent cache so each E2E run starts from a clean, predictable
// in-memory state (no stale IndexedDB bleeding across runs).
export const db = USE_EMULATOR
  ? initializeFirestore(app, {})
  : initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });

if (USE_EMULATOR) {
  // Ports must match firebase.json `emulators`. Connect BEFORE any read/write.
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

googleProvider.setCustomParameters({ prompt: "select_account" });
