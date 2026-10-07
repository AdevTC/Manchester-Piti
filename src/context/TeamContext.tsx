// Who is inside the vestuario. There is no shared key any more: a Google account is a member while
// teamMembers/{uid} exists (an invitation or a captain let them in; an admin can remove them), on
// every device, with no expiry to renew. accessRequests/{uid} tells the door what to show to
// someone who asked to come in (pending / rejected / removed).
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useAuth } from "./AuthContext";
import { startWelcome } from "../lib/doorWelcome";

export type DoorRequest =
  | { status: "pending"; playerId?: string; playerName?: string; name?: string; at?: number }
  | { status: "rejected" | "removed" };
interface TeamState {
  member: boolean;
  /** False while we still don't know whether this account is inside (avoids flashing the door). */
  ready: boolean;
  /** This account's access request, if it asked to come in. */
  request: DoorRequest | null;
  /** Sign out on this device only; the account keeps its access everywhere else. */
  exit: () => Promise<void>;
}
const TeamContext = createContext<TeamState | null>(null);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [state, setState] = useState<{ uid: string; member: boolean } | null>(null);
  const [request, setRequest] = useState<{ uid: string; value: DoorRequest | null } | null>(null);
  const uid = user?.uid;
  // Let in while waiting at the door: the welcome starts in the same update that makes them a member,
  // so the layout keeps the door up for it (an effect in the door would run too late: it is gone).
  const waited = useRef(false);
  useEffect(() => {
    if (!uid || uid === "preview") return;
    return onSnapshot(
      doc(db, "teamMembers", uid),
      (snap) => {
        const member = snap.exists() && (snap.data()?.expiresAt?.toMillis?.() ?? 0) > Date.now();
        if (member && waited.current) {
          waited.current = false;
          startWelcome({ name: "", num: "", phase: "ok" });
          try {
            navigator.vibrate?.([60, 40, 120]);
          } catch {
            /* not on this device */
          }
        }
        setState({ uid, member });
      },
      () => setState({ uid, member: false }),
    );
  }, [uid]);
  useEffect(() => {
    if (!uid || uid === "preview") return;
    return onSnapshot(
      doc(db, "accessRequests", uid),
      (snap) => {
        const value = snap.exists() ? ({ ...snap.data(), at: snap.data()?.at?.toMillis?.() } as DoorRequest) : null;
        if (value?.status === "pending") waited.current = true;
        setRequest({ uid, value });
      },
      () => setRequest({ uid, value: null }),
    );
  }, [uid]);
  const preview = uid === "preview";
  const member = preview || (!!uid && state?.uid === uid && state.member);
  const ready = !loading && (!uid || preview || state?.uid === uid);
  return (
    <TeamContext.Provider value={{ member, ready, request: uid && request?.uid === uid ? request.value : null, exit: () => signOut(auth) }}>
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
