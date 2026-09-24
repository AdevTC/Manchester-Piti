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
  unlock: (password: string) => Promise<void>;
  lock: () => Promise<void>;
}
const TeamContext = createContext<TeamState | null>(null);
const sessionKey = "piti-vestuario-session";
// A tab-local marker, never the password. Firestore remains the authority.
function rememberedUid() {
  try {
    return sessionStorage.getItem(sessionKey);
  } catch {
    return null;
  }
}
function remember(uid: string | null) {
  try {
    if (uid) sessionStorage.setItem(sessionKey, uid);
    else sessionStorage.removeItem(sessionKey);
  } catch {
    /* Storage can be disabled. */
  }
}
export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
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
        const expiresAt = snap.data()?.expiresAt?.toMillis?.() ?? 0;
        if (!snap.exists() || expiresAt <= Date.now()) {
          setSession(null);
          remember(null);
        } else if (rememberedUid() === user.uid)
          setSession({ uid: user.uid, expiresAt });
      },
      () => setSession(null),
    );
  }, [user]);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () => setSession(null),
      Math.max(0, session.expiresAt - Date.now()),
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
  return (
    <TeamContext.Provider
      value={{
        member: !!user && session?.uid === user.uid,
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
