// Everything the vestuario door needs, in one hook: who is knocking (Google account, membership,
// request), the invitation in the link, the season's shirts (which ones already have an owner), the
// next match for the teaser and the actions (sign in, come in with the invitation, ask, cancel,
// get a notice when let in, sign out on this device).
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "../../context/AuthContext";
import { useTeam } from "../../context/TeamContext";
import { useSeason } from "../../context/SeasonContext";
import { nextFixture, playerForSeason, playerName, useClubData } from "../../lib/clubData";
import { currentSeasonId, kickoffLabel } from "../../lib/vestuario";
import { apiError, cancelAccessRequest, doorShirts, inviteInfo, joinWithInvite, requestAccess, type Who } from "../../lib/clubApi";
import { doorStep, inviteCodeFrom, shirtsToPick } from "../../lib/door";
import { endWelcome, startWelcome, useWelcome, walkOut } from "../../lib/doorWelcome";
import { pushState, savedTopics, toggleTopic } from "../../lib/push";

export type DoorScreen = ReturnType<typeof doorStep> | "aprobada" | "bienvenida";
const buzz = (p: number | number[]) => {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* not on this device */
  }
};
/** iPhone/iPad web app on the home screen: Google opens in the same window (no popups there). */
const standaloneIos = () =>
  typeof window !== "undefined" &&
  /iP(hone|ad|od)/.test(navigator.userAgent) &&
  (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** The current season's active squad (name and dorsal as printed on the shirt) and the next match. */
export function useSeasonSquad() {
  const { matches, players } = useClubData();
  const { seasons } = useSeason();
  const [now] = useState(() => Date.now());
  const next = nextFixture(matches, now);
  const seasonId = currentSeasonId(next, matches, seasons);
  const squad = players
    .filter((p) => p.seasons?.includes(seasonId) && p.active !== false)
    .map((raw) => {
      const p = playerForSeason(raw, seasonId, seasons);
      // Printed like on the shirt: upper case.
      return { id: p.id, name: playerName(p).toUpperCase(), num: p.number != null ? String(p.number) : "", position: p.naturalPosition, first: p.firstName, last: p.lastName };
    });
  return { next, squad };
}

export function useDoor() {
  const { user, profile, loginWithGoogle } = useAuth();
  const { member, request, exit } = useTeam();
  const qc = useQueryClient();
  const location = useRouterState({ select: (s) => s.location });
  const code = inviteCodeFrom(location.pathname, typeof location.search === "string" ? location.search : new URLSearchParams(location.search as Record<string, string>).toString());
  // «¿Quién eres?» on demand (again after a rejection, or to change the shirt asked for): it lasts
  // while the request stays as it was when chosen.
  const [choseAt, setChoseAt] = useState<string | null>(null);
  const status = request?.status ?? "none";
  const choosing = choseAt === status;
  const [busy, setBusy] = useState<"" | "google" | "send" | "push">("");
  const [error, setError] = useState<{ text: string; popup: boolean } | null>(null);
  const welcome = useWelcome();
  const [push, setPush] = useState(() => savedTopics().includes("access"));
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = (text: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(""), 2600);
  };

  const invite = useQuery({ queryKey: ["invite", code], queryFn: async () => (await inviteInfo({ code: code! })).data, enabled: !!code, staleTime: 60_000, retry: 1 });
  const shirtsQ = useQuery({
    queryKey: ["door-shirts"],
    queryFn: async () => {
      const { data } = await doorShirts();
      return { taken: new Set(data.taken), inside: data.inside };
    },
    staleTime: 30_000,
  });

  const { next, squad } = useSeasonSquad();
  const taken = shirtsQ.data?.taken;
  const pick = shirtsToPick(squad, taken ?? new Set(), user?.displayName ?? "");
  const byId = new Map(squad.map((s) => [s.id, s]));

  const step: DoorScreen = welcome
    ? welcome.phase === "ok"
      ? "aprobada"
      : "bienvenida"
    : doorStep({ signedIn: !!user, member, hasProfile: !!profile, request, invite: code ? (invite.data ?? undefined) : null, choosing });

  /** The shirt this account asked for (or was let in with). */
  const asked = request?.status === "pending" ? request : null;
  const mine = profile?.playerId ? byId.get(profile.playerId) : undefined;
  const me = welcome
    ? { name: welcome.name || mine?.name || (profile?.nickname ?? "").toUpperCase(), num: welcome.num || mine?.num || "" }
    : asked?.playerId
      ? { name: byId.get(asked.playerId)?.name ?? asked.playerName ?? "", num: byId.get(asked.playerId)?.num ?? "" }
      : { name: (asked?.name ?? profile?.nickname ?? user?.displayName ?? "").toUpperCase(), num: "" };

  // Let in (TeamContext starts the welcome): the wall now has one more shirt with an owner.
  useEffect(() => {
    if (welcome?.phase === "ok") void qc.invalidateQueries({ queryKey: ["door-shirts"] });
  }, [welcome?.phase, qc]);

  const run = async (kind: "google" | "send" | "push", fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      const c = (e as { code?: string }).code ?? "";
      setError({ text: apiError(e), popup: c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request" || c === "auth/popup-blocked" });
    } finally {
      setBusy("");
    }
  };
  const nameOf = (who: Who) => (who.playerId ? (byId.get(who.playerId)?.name ?? "") : (who.name ?? "").toUpperCase());
  const numOf = (who: Who) => (who.playerId ? (byId.get(who.playerId)?.num ?? "") : "");

  return {
    step,
    user,
    me,
    asked,
    /** Turned away after being inside (a captain removed the access), not just a rejected request. */
    removed: request?.status === "removed",
    code,
    invite: invite.data,
    inviteLoading: !!code && invite.isPending,
    squad,
    shirts: pick.shirts,
    suggestion: pick.suggestion,
    taken: taken ?? null,
    inside: shirtsQ.data?.inside ?? null,
    next: next ? { rival: next.rival ?? "Rival", home: next.home !== false, when: kickoffLabel(next.date) } : null,
    iphone: standaloneIos(),
    busy,
    error,
    clearError: () => setError(null),
    signIn: () => run("google", loginWithGoogle),
    choose: () => setChoseAt(status),
    /** With a valid invitation: straight in. Without: ask the captain (old members walk back in). */
    send: (who: Who) =>
      run("send", async () => {
        if (code && invite.data?.state === "valid") {
          await joinWithInvite({ code, ...who });
          startWelcome({ name: nameOf(who) || "NUEVO FICHAJE", num: numOf(who), phase: "walk" });
          buzz([30, 60, 30, 60, 120]);
        } else {
          const r = await requestAccess(who);
          if (r.data.status === "member") {
            startWelcome({ name: nameOf(who) || "DE VUELTA", num: numOf(who), phase: "walk" });
            buzz([30, 60, 30, 60, 120]);
          }
        }
        setChoseAt(null);
        void qc.invalidateQueries({ queryKey: ["door-shirts"] });
      }),
    cancel: () =>
      run("send", async () => {
        await cancelAccessRequest();
        say("Petición cancelada");
      }),
    notice,
    /** A notice on this device when the captain opens (Web Push, topic "access"). */
    push,
    pushable: pushState(),
    togglePush: () =>
      run("push", async () => {
        const topics = await toggleTopic("access", !push);
        setPush(topics.includes("access"));
        if (topics.includes("access")) {
          buzz(20);
          say("Te avisaremos en este móvil");
        }
      }),
    walkOut: () => {
      walkOut();
      buzz([30, 60, 30, 60, 120]);
    },
    finishWelcome: endWelcome,
    exit: async () => {
      await exit();
      say("Has salido en este dispositivo");
    },
  };
}
export type Door = ReturnType<typeof useDoor>;
