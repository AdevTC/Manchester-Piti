// La mesa's data: the realtime match, its scorers, who else has la mesa open (a heartbeat every 30 s to
// matchPrivate/{id}/presence/{uid}), the offline queue every play goes through, the screen kept awake, a
// vibration per play, and the server-time clock. It hands the screens one MesaView (./types).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useClubData, nameFor, dateMillis, type ClubMatch } from "../../lib/clubData";
import { apiError, controlMatchClock, mesaEvent, publishLive } from "../../lib/clubApi";
import { isGuestId, withGuestNames } from "../../lib/derived/guests";
import { useClock } from "../../hooks/useClock";
import { useMatchScorers } from "../vestuario/live";
import { useBoardView, useMatchBoard } from "../pizarra/useMatchBoard";
import { useWakeLock } from "../pizarra/v2/useMatchDay";
import { jornadaOf } from "../../lib/derived/jornada";
import { systemText } from "../../lib/derived/system";
import { useStandings } from "../../lib/useStandings";
import { addSubs, MAX_WAVE } from "./api";
import { MesaQueue, itemPlays, pendingByPlayer, queueKey, type QueueItem, type QueuePayload } from "./queue";
import {
  buzzOf, counted, eventText, goalSide, liveId, mesaClock, mesaEvents, mesaPlayers, mesaScore, nextPlannedSub,
  rivalInitialsOf, rivalShortOf, withLocal, type LocalPlay, type PlayerInfo,
} from "./model";
import type { ClockAction, MesaActions, MesaAddOpts, MesaEditPatch, MesaNav, MesaPresence, MesaQueueState, MesaType, MesaView } from "./types";

export const HEARTBEAT_MS = 30_000;
export const FRESH_MS = 75_000;

/** A short vibration per play, where the phone has one (iPhones don't). */
export function vibrate(pattern: number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    /* not allowed: the lower third still confirms it */
  }
}

// ---------- presence
interface PresenceDoc {
  uid: string;
  name: string;
  at: number;
}
const millis = (v: unknown): number => (v instanceof Timestamp ? v.toMillis() : typeof v === "number" ? v : 0);
function usePresence(matchId: string | undefined, me: { uid: string; name: string } | null, beat: boolean): PresenceDoc[] {
  const [rows, setRows] = useState<PresenceDoc[]>([]);
  useEffect(() => {
    if (!matchId || !me) return;
    return onSnapshot(
      collection(db, "matchPrivate", matchId, "presence"),
      (s) => setRows(s.docs.map((d) => ({ uid: d.id, name: typeof d.data().name === "string" ? (d.data().name as string) : "Anotador", at: millis(d.data().at) }))),
      () => setRows([]),
    );
  }, [matchId, me?.uid]); // eslint-disable-line react-hooks/exhaustive-deps -- (one listener per match and person; the name is written, not listened to)
  useEffect(() => {
    if (!matchId || !me || !beat) return;
    const write = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void setDoc(doc(db, "matchPrivate", matchId, "presence", me.uid), { name: me.name, at: serverTimestamp() }).catch(() => undefined);
    };
    write();
    const t = window.setInterval(write, HEARTBEAT_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") write();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [matchId, me?.uid, me?.name, beat]); // eslint-disable-line react-hooks/exhaustive-deps -- (me is rebuilt each render; its fields are the deps)
  return rows;
}

// ---------- the pizarra's planned subs (one read of the official board; the board itself is read by useBoardView)
interface PlannedSub {
  min?: number;
  out: string;
  in: string;
}
function usePlannedSubs(boardId: string | null): PlannedSub[] {
  const [got, setGot] = useState<{ id: string; subs: PlannedSub[] } | null>(null);
  useEffect(() => {
    if (!boardId) return;
    let live = true;
    getDoc(doc(db, "lineups", boardId))
      .then((s) => {
        const raw: unknown = s.exists() ? s.data().subs : undefined;
        const list = Array.isArray(raw)
          ? raw.flatMap((x: unknown) => {
              if (!x || typeof x !== "object") return [];
              const o = x as { min?: unknown; out?: unknown; in?: unknown };
              return typeof o.out === "string" && typeof o.in === "string" ? [{ out: o.out, in: o.in, ...(typeof o.min === "number" ? { min: o.min } : {}) }] : [];
            })
          : [];
        if (live) setGot({ id: boardId, subs: list });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [boardId]);
  return got && got.id === boardId ? got.subs : NO_SUBS;
}
const NO_SUBS: PlannedSub[] = [];

// ---------- the queue
function useQueue(uid: string | undefined, matchId: string | undefined): MesaQueue | null {
  const queue = useMemo(() => {
    if (!uid || !matchId || typeof window === "undefined") return null;
    const key = queueKey(uid, matchId);
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(key) : null;
    return new MesaQueue({
      key,
      storage,
      channel,
      send: async (item: QueueItem) => {
        if (item.batch) {
          // a wave of changes: one operation, all or none
          await addSubs(item.matchId, item.requestId, item.batch.map((b) => ({ playerId: b.playerId ?? "", inPlayerId: b.inPlayerId ?? "", minute: b.minute, clockRevision: b.clockRevision, tappedElapsed: b.tappedElapsed, period: b.period })));
          return;
        }
        const p = item.payload;
        await mesaEvent({
          action: "add",
          matchId: item.matchId,
          requestId: item.requestId,
          clockRevision: p.clockRevision,
          tappedElapsed: p.tappedElapsed,
          period: p.period,
          event: { type: p.type, minute: p.minute, playerId: p.playerId, assistPlayerId: p.assistPlayerId, assistReviewed: p.assistReviewed, inPlayerId: p.inPlayerId },
        });
      },
    });
  }, [uid, matchId]);
  useEffect(() => {
    if (!queue) return;
    const on = () => queue.setOnline(true);
    const off = () => queue.setOnline(false);
    const onStorage = (e: StorageEvent) => {
      if (e.key === queueKey(uid!, matchId!)) queue.reload();
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("storage", onStorage);
    queue.flush();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("storage", onStorage);
      queue.close();
    };
  }, [queue]); // eslint-disable-line react-hooks/exhaustive-deps -- (uid and matchId are the queue's own key)
  return queue;
}
const EMPTY_SNAP = { items: [] as readonly QueueItem[], sending: null, offline: false, lastTryAt: null };
const noop = () => () => undefined;

export interface MesaInput {
  matchId: string;
  me: { uid: string; name: string; admin: boolean } | null;
  nav: MesaNav;
}

/** The player names, dorsals and guests of a match (the season's shirt name and number). */
function playerInfo(match: ClubMatch | undefined, players: ReturnType<typeof useClubData>["players"]) {
  const seasonId = match?.seasonId;
  const byId = new Map(players.map((p) => [p.id, p]));
  const base = (id: string) => nameFor(byId.get(id), seasonId);
  const nameOf = withGuestNames(match ?? null, base);
  const info = (id: string): PlayerInfo => {
    const p = byId.get(id);
    const detail = seasonId && p?.seasonDetails ? (p.seasonDetails[seasonId] as { number?: unknown } | undefined) : undefined;
    const n = typeof detail?.number === "number" ? detail.number : p?.number;
    return { name: nameOf(id), number: typeof n === "number" ? String(n) : "", guest: isGuestId(id) };
  };
  return { nameOf, info };
}

/** Everything la mesa shows and does for one match. Null until the match is known (`state` says why). */
export function useMesa({ matchId, me, nav }: MesaInput): { view: MesaView | null; state: "loading" | "missing" | "ready"; canScore: boolean; scorersLoading: boolean } {
  const { matches, players, loading } = useClubData();
  const match = matches.find((m) => m.id === matchId);
  const scorers = useMatchScorers(me ? matchId : undefined);
  const canScore = !!me && (me.admin || scorers.data.includes(me.uid));
  const now = useClock(1000);
  const phase = match?.clock?.phase ?? "ready";
  useWakeLock(canScore && !!match && phase !== "ended");
  const presenceRows = usePresence(canScore ? matchId : undefined, me, canScore && phase !== "ended");
  const upcoming = !!match && phase === "ready";
  const boardId = useMatchBoard(match?.seasonId, matchId, upcoming, canScore);
  const board = useBoardView(boardId);
  const plannedSubs = usePlannedSubs(boardId);
  const { standings } = useStandings(match?.seasonId);
  const hasStandings = !!standings && standings.rows.length > 0;
  const queue = useQueue(canScore ? me?.uid : undefined, matchId);
  const snap = useSyncExternalStore(queue?.subscribe ?? noop, queue?.getSnapshot ?? (() => EMPTY_SNAP), () => EMPTY_SNAP);
  const [lastId, setLastId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  // (the actions read the latest match, time and last play through refs, kept in step after each render)
  const matchRef = useRef(match);
  const nowRef = useRef(now);
  const lastIdRef = useRef(lastId);
  useLayoutEffect(() => {
    matchRef.current = match;
    nowRef.current = now;
    lastIdRef.current = lastId;
  });

  // the realtime doc confirms the queued plays
  const eventIds = useMemo(() => new Set((match?.events ?? []).map((e) => e.id)), [match?.events]);
  useEffect(() => {
    queue?.confirm(eventIds);
  }, [queue, eventIds]);

  const fail = useCallback((e: unknown): never => {
    const msg = apiError(e);
    setNotice(msg);
    throw e instanceof Error ? e : new Error(msg);
  }, []);

  const actions = useMemo<MesaActions>(() => {
    /** The queued item that writes event `id`, and which of its plays it is (a wave has several). */
    const local = (id: string): { item: QueueItem; index: number } | undefined => {
      if (!id.startsWith("live-")) return undefined;
      for (const item of snapItems()) {
        const play = itemPlays(item).find((p) => p.id === id);
        if (play) return { item, index: play.index };
      }
      return undefined;
    };
    function snapItems(): readonly QueueItem[] {
      return queue?.getSnapshot().items ?? [];
    }
    /** A play as the queue keeps it: the time of play now, the clock it was tapped on. */
    const payloadNow = (type: MesaType, opts: MesaAddOpts): QueuePayload => {
      const m = matchRef.current;
      const reading = mesaClock(m?.clock, nowRef.current, m?.duration);
      return {
        type,
        minute: Math.floor(reading.elapsedSeconds / 60),
        tappedElapsed: reading.elapsedSeconds,
        period: reading.period,
        ...(m?.clock ? { clockRevision: m.clock.revision } : {}),
        ...(opts.playerId ? { playerId: opts.playerId } : {}),
        ...(opts.assistPlayerId ? { assistPlayerId: opts.assistPlayerId } : {}),
        ...(opts.inPlayerId ? { inPlayerId: opts.inPlayerId } : {}),
        ...(goalSide(type) === "us" && type === "goal" && opts.playerId ? { assistReviewed: !!opts.assistPlayerId } : {}),
      };
    };
    const textOf = (type: MesaType, opts: MesaAddOpts) =>
      eventText({ type, playerId: opts.playerId, assistPlayerId: opts.assistPlayerId, inPlayerId: opts.inPlayerId }, (id) => playerInfo(matchRef.current, players).nameOf(id), matchRef.current?.rival ?? "el rival");
    const remove = async (id: string) => {
      const q = local(id);
      if (q && q.item.status !== "sent" && queue?.drop(q.item.requestId, q.index)) return;
      try {
        await mesaEvent({ action: "delete", matchId, eventId: id });
      } catch (e) {
        fail(e);
      }
    };
    const clock = async (action: ClockAction, value?: number) => {
      const m = matchRef.current;
      setNotice("");
      try {
        await controlMatchClock({ matchId, action, revision: m?.clock?.revision ?? 0, ...(value !== undefined ? { value } : {}) });
      } catch (e) {
        fail(e);
      }
    };
    return {
      add(type: MesaType, opts: MesaAddOpts = {}) {
        const requestId = crypto.randomUUID();
        queue?.enqueue({ requestId, matchId, createdAt: Date.now(), text: textOf(type, opts), payload: payloadNow(type, opts) });
        const id = liveId(requestId);
        setLastId(id);
        setNotice("");
        vibrate(buzzOf(type));
        return id;
      },
      addMany(subs: readonly { playerId: string; inPlayerId: string }[]) {
        const wave = subs.slice(0, MAX_WAVE);
        if (!wave.length) return [];
        const requestId = crypto.randomUUID();
        const batch = wave.map((s) => payloadNow("substitution", s));
        queue?.enqueue({ requestId, matchId, createdAt: Date.now(), text: wave.map((s) => textOf("substitution", s)).join(" · "), payload: batch[0], batch });
        // (no lower third for a wave: «Deshacer» would only take back its last change)
        setLastId(null);
        setNotice("");
        vibrate(buzzOf("substitution"));
        return itemPlays({ requestId, payload: batch[0], batch }).map((p) => p.id);
      },
      async edit(id: string, patch: MesaEditPatch) {
        const q = local(id);
        if (q && queue?.amend(q.item.requestId, { type: patch.type, playerId: patch.playerId, assistPlayerId: patch.assistPlayerId, inPlayerId: patch.inPlayerId, ...(patch.assistPlayerId !== undefined ? { assistReviewed: true } : {}) }, q.index)) return;
        try {
          await mesaEvent({ action: "edit", matchId, eventId: id, patch });
        } catch (e) {
          fail(e);
        }
      },
      remove,
      async undo() {
        if (!lastIdRef.current) return;
        const id = lastIdRef.current;
        setLastId(null);
        await remove(id);
      },
      clock,
      async publish(assists?: Record<string, string>) {
        setNotice("");
        try {
          await publishLive({ matchId, ...(assists && Object.keys(assists).length ? { assists } : {}) });
        } catch (e) {
          fail(e);
        }
      },
      reopen: () => clock("reopen"),
      resend(requestId: string, fix: { playerId?: string; minute?: number }) {
        queue?.resend(requestId, fix, crypto.randomUUID());
      },
      discard(requestId: string) {
        queue?.drop(requestId);
      },
      retryNow() {
        queue?.setOnline(true);
      },
    };
    // (players feed only the queued play's text; the actions read the match and the time through refs)
  }, [queue, matchId, fail, players]);

  const view = useMemo<MesaView | null>(() => {
    if (!match || !me) return null;
    const { nameOf, info } = playerInfo(match, players);
    const reading = mesaClock(match.clock, now, match.duration);
    const localPlays: LocalPlay[] = snap.items
      .filter((x) => x.status !== "review")
      .flatMap((x) => itemPlays(x).map(({ id, payload: p }) => ({ requestId: x.requestId, id, type: p.type, playerId: p.playerId, assistPlayerId: p.assistPlayerId, inPlayerId: p.inPlayerId, tappedElapsed: p.tappedElapsed, period: p.period, ...(p.assistReviewed ? { assistReviewed: true } : {}) })));
    const all = withLocal(match.events, localPlays, me.uid);
    const pendingBy = pendingByPlayer(snap.items);
    const codes = board?.seven.length ? board.codes : null;
    // (the seven is the official board's when the convocatoria's starters are its seven)
    const starters = match.starters ?? [];
    const fromBoard = !!board && board.seven.length > 0 && board.seven.length === starters.length && board.seven.every((id) => starters.includes(id));
    const { field, bench } = mesaPlayers(match.starters ?? [], match.bench ?? [], all, reading.elapsedSeconds, info, codes, pendingBy);
    const fresh = presenceRows.map<MesaPresence>((p) => ({ uid: p.uid, name: p.name, at: p.at, fresh: p.at > 0 && now - p.at < FRESH_MS, me: p.uid === me.uid }));
    const people = new Map(fresh.map((p) => [p.uid, p.name] as const));
    const rival = match.rival ?? "Rival";
    const rivalShort = rivalShortOf(rival, "rivalShort" in match ? match.rivalShort : undefined);
    const events = mesaEvents(match.events, localPlays, { nameOf, rival, rivalShort, uid: me.uid, people });
    const queuedGoals = { us: 0, them: 0 };
    for (const e of events) if (e.local && e.goal) queuedGoals[e.goal]++;
    const queueState: MesaQueueState = {
      online: !snap.offline,
      pending: snap.items.filter((x) => x.status !== "review").length,
      byPlayer: pendingBy,
      items: snap.items.filter((x) => x.status !== "review").map((x) => ({ requestId: x.requestId, type: x.payload.type, text: x.text, playerId: x.batch ? null : x.payload.playerId ?? null, minute: x.payload.minute + 1, count: x.batch?.length ?? 1, createdAt: x.createdAt, status: x.requestId === snap.sending || x.status === "sent" ? "sending" : "pending" })),
      review: snap.items.filter((x) => x.status === "review").map((x) => ({ requestId: x.requestId, type: x.payload.type, text: x.text, playerId: x.batch ? null : x.payload.playerId ?? null, minute: x.payload.minute + 1, count: x.batch?.length ?? 1, reason: x.reason ?? "" })),
      lastTryAt: snap.lastTryAt,
    };
    const sentOff = new Set(bench.filter((p) => p.sentOff).map((p) => p.id));
    const plan = nextPlannedSub(plannedSubs, field.map((p) => p.id), bench.map((p) => p.id), sentOff);
    return {
      match: {
        id: match.id,
        seasonId: match.seasonId ?? "",
        rival,
        rivalShort,
        rivalInitials: rivalInitialsOf(rival, match.rivalInitials),
        competition: match.competition ?? "",
        round: jornadaOf(matches, match.id),
        lineup: fromBoard ? { fromBoard: true, system: systemText(board?.system) } : { fromBoard: false, system: null },
        hasStandings,
        home: match.home !== false,
        date: dateMillis(match.date),
        score: mesaScore(match.events),
        queuedGoals,
        clock: reading,
        published: match.status === "finished",
        pendingDuplicates: (match.events ?? []).filter((e) => !counted(e)).length,
      },
      field,
      bench,
      events,
      presence: fresh,
      me,
      queue: queueState,
      lastOwn: lastId ? events.find((e) => e.id === lastId) ?? null : null,
      nextSub: plan ? { ...plan, inName: nameOf(plan.inId), outName: nameOf(plan.outId) } : null,
      nameOf,
      notice,
      actions,
      nav,
    };
  }, [match, matches, me, players, now, snap, board, hasStandings, presenceRows, plannedSubs, lastId, notice, actions, nav]);

  return { view, state: loading ? "loading" : match ? "ready" : "missing", canScore, scorersLoading: scorers.loading };
}
