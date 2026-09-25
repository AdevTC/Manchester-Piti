import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import { useAuth } from "./AuthContext";
import { enterTeam, leaveTeam } from "../lib/clubApi";
interface TeamState {
  member: boolean;
  /** False while we still don't know whether this device is inside (avoids flashing the gate). */
  ready: boolean;
  unlock: (password: string) => Promise<void>;
  lock: () => Promise<void>;
}
const TeamContext = createContext<TeamState | null>(null);
const sessionKey = "piti-vestuario-session";
const MAX_TIMER_MS = 2 ** 31 - 1;
// A device marker (every tab of this browser), never the password: the key was typed
// here. Firestore remains the authority: teamMembers/{uid} expires and the rules check it.
function rememberedUid() {
  try {
    return localStorage.getItem(sessionKey);
  } catch {
    return null;
  }
}
function remember(uid: string | null) {
  try {
    if (uid) localStorage.setItem(sessionKey, uid);
    else localStorage.removeItem(sessionKey);
  } catch {
    /* Storage can be disabled. */
  }
}
export function TeamProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [checked, setChecked] = useState<string | null>(null);
  const [session, setSession] = useState<{
    uid: string;
    expiresAt: number;
  } | null>(null);
  useEffect(
    () =>
      onAuthStateChanged(auth, (current) => {
        setSession(null);
        if (!current || rememberedUid() !== current.uid) remember(null);
      }),
    [],
  );
  useEffect(() => {
    if (!user || user.uid === "preview") return;
    return onSnapshot(
      doc(db, "teamMembers", user.uid),
      (snap) => {
        setChecked(user.uid);
        const expiresAt = snap.data()?.expiresAt?.toMillis?.() ?? 0;
        if (!snap.exists() || expiresAt <= Date.now()) {
          setSession(null);
          remember(null);
        } else if (rememberedUid() === user.uid)
          setSession({ uid: user.uid, expiresAt });
      },
      () => {
        setChecked(user.uid);
        setSession(null);
      },
    );
  }, [user]);
  useEffect(() => {
    if (!session) return;
    // setTimeout overflows past ~24.8 days (2^31 ms) and would fire at once: re-check instead.
    const timer = setTimeout(
      () => setSession((s) => (s && s.expiresAt <= Date.now() ? null : s ? { ...s } : s)),
      Math.min(MAX_TIMER_MS, Math.max(0, session.expiresAt - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [session]);
  const unlock = async (password: string) => {
    const result = await enterTeam({ password });
    if (user) {
      remember(user.uid);
      setSession({ uid: user.uid, expiresAt: result.data.expiresAt });
    }
  };
  const lock = async () => {
    remember(null);
    setSession(null);
    if (user && user.uid !== "preview") await leaveTeam();
  };
  const ready = !loading && (!user || user.uid === "preview" || rememberedUid() !== user.uid || checked === user.uid);
  return (
    <TeamContext.Provider
      value={{
        member: !!user && session?.uid === user.uid,
        ready,
        unlock,
        lock,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("TeamProvider requerido");
  return ctx;
}
