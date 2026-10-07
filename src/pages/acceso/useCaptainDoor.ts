// The tunnel's control room (admins): who is knocking, the invitations still alive, who is inside,
// and the actions on each. Approving and rejecting go through a short undo window first, so a
// swipe by mistake can be taken back before the backend lets anyone in.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiError, createInvite, resolveAccess, revokeInvite, revokeMember } from "../../lib/clubApi";
import { useClubPeople, useDoorRequests, useInvites, useTeamMembers, type DoorRequestRow } from "../vestuario/live";

export const UNDO_MS = 5_000;
export interface Pending {
  row: DoorRequestRow;
  approve: boolean;
  playerId?: string;
  until: number;
}

export function useCaptainDoor() {
  const { profile, user } = useAuth();
  const admin = profile?.role === "admin" || profile?.role === "superadmin";
  const requests = useDoorRequests(admin);
  const invites = useInvites(admin);
  const members = useTeamMembers(admin);
  const people = useClubPeople(admin);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError("");
    try {
      await fn();
      return true;
    } catch (e) {
      setError(apiError(e));
      return false;
    } finally {
      setBusy("");
    }
  }, []);

  const commit = useCallback(
    (p: Pending) => {
      timer.current = null;
      setPending(null);
      void run(p.row.uid, () => resolveAccess({ uid: p.row.uid, approve: p.approve, ...(p.approve && p.playerId ? { playerId: p.playerId } : {}) }));
    },
    [run],
  );
  // Deciding a second card commits the first one straight away.
  const decide = useCallback(
    (row: DoorRequestRow, approve: boolean, playerId?: string) => {
      if (timer.current) clearTimeout(timer.current);
      if (pending) commit(pending);
      const next = { row, approve, playerId: playerId ?? row.playerId ?? undefined, until: Date.now() + UNDO_MS };
      setPending(next);
      timer.current = setTimeout(() => commit(next), UNDO_MS);
    },
    [pending, commit],
  );
  const undo = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPending(null);
  }, []);
  // Leaving the panel mid-undo still applies the decision.
  const latest = useRef(pending);
  useEffect(() => {
    latest.current = pending;
  });
  useEffect(
    () => () => {
      if (timer.current && latest.current) {
        clearTimeout(timer.current);
        void resolveAccess({ uid: latest.current.row.uid, approve: latest.current.approve, ...(latest.current.approve && latest.current.playerId ? { playerId: latest.current.playerId } : {}) });
      }
    },
    [],
  );

  const queue = useMemo(() => requests.data.filter((r) => r.uid !== pending?.row.uid).sort((a, b) => a.at - b.at), [requests.data, pending]);
  const liveInvites = useMemo(() => invites.data.filter((i) => !i.revoked && (i.maxUses === 0 || i.uses < i.maxUses)).sort((a, b) => b.expiresAt - a.expiresAt), [invites.data]);
  const inside = useMemo(() => {
    const byUid = new Map(people.data.map((p) => [p.uid, p]));
    return members.data
      .map((m) => ({ ...m, person: byUid.get(m.uid) }))
      .filter((m) => m.person && !m.person.removed)
      .sort((a, b) => (a.person!.nickname || "").localeCompare(b.person!.nickname || "", "es"))
      .map((m) => ({ ...m, me: m.uid === user?.uid }));
  }, [members.data, people.data, user?.uid]);

  return {
    admin,
    loading: requests.loading || invites.loading || members.loading || people.loading,
    queue,
    pending,
    invites: liveInvites,
    inside,
    linked: useMemo(() => new Set(people.data.filter((p) => !p.removed && p.playerId).map((p) => p.playerId!)), [people.data]),
    busy,
    error,
    clearError: () => setError(""),
    decide,
    undo,
    invite: (opts: { playerId?: string; maxUses: 0 | 1; days: number }) =>
      new Promise<{ code: string; expiresAt: number } | null>((resolve) => {
        let out: { code: string; expiresAt: number } | null = null;
        void run("invite", async () => {
          out = (await createInvite(opts)).data;
        }).then(() => resolve(out));
      }),
    revokeInvite: (code: string) => run(`inv:${code}`, () => revokeInvite({ code })),
    removeMember: (uid: string) => run(`mem:${uid}`, () => revokeMember({ uid })),
  };
}
export type CaptainDoor = ReturnType<typeof useCaptainDoor>;
