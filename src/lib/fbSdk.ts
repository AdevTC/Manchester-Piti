// Everything of Firebase the pages every visitor opens use, in one module loaded on demand (lib/fb.ts): the
// app's instances and the SDK functions. Nothing on the way to the first paint imports Firebase itself.
export { auth, db, functions, googleProvider } from "../firebase";
export {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  loadBundle,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
export { browserPopupRedirectResolver, getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
export { httpsCallable } from "firebase/functions";
