// «Vidrio» · el directo: one glass object carries the match day across the whole web (V-Vivo, V-Integracion).
// It replaces the old live island. The state comes from lib/derived/island (islandOf): «Antes del partido»
// two hours before kick-off, «¿Vas hoy?» for a jugador who hasn't answered, «Hoy anotas tú» for the one at
// la mesa, «Pendiente del pitido», the score and the minute, «Descanso», «Final» for half an hour («Acta
// lista» once out), «Pendiente del acta» for a match nobody started, «Vota al MVP» for a member who hasn't
// voted, and «Sin conexión» over a live score the server hasn't confirmed. The kit's FloatingScore draws it
// (floating under the bar on desktop, above the tab bar on a phone; hidden while Inicio's lens shows the match,
// docked on Partidos' segment — liveDock); a tap opens the sheet (LiveSheet); «Sacar el marcador» takes it to
// a window of its own (Document PiP, or the in-page glass window); each fresh goal plays the goal moment.
// liveDock.setLive lights the chrome's dot on «Partidos». Screen readers hear each change once (one polite live
// region), never the ticking minute. Client only, never on its own match page (it lands there).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useRouterState } from "@tanstack/react-router";
import { nameFor, useClubData, type ClubMatch } from "../../../lib/clubData";
import { useClock } from "../../../hooks/useClock";
import { useViewer } from "../../../hooks/useViewer";
import { useAuth } from "../../../context/AuthContext";
import { useTeam } from "../../../context/TeamContext";
import { islandAnnouncement, islandOf, todayMatch, voteMatch, type IslandState } from "../../../lib/derived/island";
import { momentsOf, type MatchMoment } from "../../../lib/derived/moments";
import { kickoffWindow } from "../../../lib/derived/memberWindows";
import { RECONNECTING, syncChip, syncChipAnnouncement, type SyncChip } from "../../../lib/derived/syncChip";
import { playsLog } from "../../../lib/derived/vidrio/plays";
import { viewerKind } from "../../../lib/derived/vidrio/viewer";
import { useSyncStatus } from "../../../lib/syncStatus";
import { serverOffset } from "../../../lib/serverTime";
import { useAvailability, useMatchScorers, useMyMvpVote } from "../../../pages/vestuario/live";
import { setAvailability, useMe } from "../../../pages/vestuario/writes";
import { useServerTimeSync } from "../../../hooks/useServerTimeSync";
import { useMatchMoment } from "./useMatchMoment";
import { FloatingScore } from "../FloatingScore";
import { floatLines, type FloatMatch } from "../floatText";
import { liveDock, useLiveDockState } from "../liveDock";
import { openScorePip, type ScorePip } from "../pip";
import { PipWindow } from "../PipWindow";
import { useDesktop, useReducedMotion } from "../env";
import { useGoalMoment } from "../useGoalMoment";
import { useGrow } from "../useGrow";
import { DROP_HOLD_MS, floatOf, hideMark, pageKey, playing, sheetOf } from "./liveModel";
import { LiveSheet, type RsvpAnswer } from "./LiveSheet";
import { LivePlays } from "./LivePlays";
import "../../../styles/vidrio/reading.css";
import "./live.css";

/** The vote notice a member closed (one match id: the next vote shows again). */
const VOTE_OFF_KEY = "mp:isle:vote-off";
/** The clock's turns: their line is the state's own («Descanso. Piti 1, …»), said once by the state change. */
const CLOCK_KINDS = new Set(["arranque", "descanso", "reanudacion", "final"]);
/** The View Transition name «Abrir el partido» lands on the match page's scoreboard with (.vd-live-destino). */
export const LIVE_VT = "vd-live-marcador";

const readVoteOff = (): string | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(VOTE_OFF_KEY);
  } catch {
    return null;
  }
};

const subscribeNothing = () => () => {};
/** False in the server render and while hydrating: the live score is a fixed overlay of the browser. */
const useHydrated = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);

/** DEV only (the design shots; never in a production build): `?vivo=offline` shows the connection as lost,
 *  `?vivo=gol` replays the last goal 3 s after load, `?vivo=sinpip` hides Document PiP (the in-page window). */
function devHatch(): { offline: boolean; goal: boolean; noPip: boolean } {
  if (!import.meta.env.DEV || typeof location === "undefined") return { offline: false, goal: false, noPip: false };
  const v = new URLSearchParams(location.search).get("vivo");
  if (v === "sinpip") Object.defineProperty(window, "documentPictureInPicture", { configurable: true, value: undefined });
  return { offline: v === "offline", goal: v === "gol", noPip: v === "sinpip" };
}

interface Heard {
  armed: boolean;
  key: string;
  kind: IslandState["kind"] | null;
  moment: string;
  chip: SyncChip["kind"] | "";
  text: string;
  from: ClubMatch | null;
}

/** Where the sheet sits on desktop: under the float (above it when the float sits low), kept on screen. */
function sheetPlace(zone: HTMLElement | null): { style: CSSProperties; up: boolean } {
  const el = zone?.querySelector(".vd-float");
  if (!el) return { style: { top: 104, right: 24 }, up: false };
  const r = el.getBoundingClientRect();
  const W = window.innerWidth;
  const H = window.innerHeight;
  const width = Math.min(420, W - 20);
  const left = Math.round(Math.min(Math.max(10, r.left + r.width / 2 - width / 2), W - width - 10));
  const up = r.top + r.height / 2 > H / 2;
  return up ? { style: { left, bottom: Math.round(H - r.top + 10) }, up } : { style: { left, top: Math.round(r.bottom + 10) }, up };
}

export function LiveScore() {
  const hydrated = useHydrated();
  const { matches, players, loading } = useClubData();
  const now = useClock(15_000);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const viewer = useViewer();
  const { user, loading: authLoading } = useAuth();
  const { ready: teamReady } = useTeam();
  const me = useMe();
  const sync = useSyncStatus();
  const desktop = useDesktop();
  const reduced = useReducedMotion();
  const dock = useLiveDockState();
  const [hatch] = useState(devHatch);
  const zone = useRef<HTMLDivElement | null>(null);
  // the page the sheet was opened on (null: closed), and the one «Ver todo» grew on
  const [open, setOpen] = useState<string | null>(null);
  const [growOn, setGrowOn] = useState<string | null>(null);
  const [place, setPlace] = useState<{ style: CSSProperties; up: boolean }>({ style: {}, up: false });
  // «Ocultar…» (the mark it was hidden at: the next goal, or the next state, brings it back by itself)
  const [hiddenAt, setHiddenAt] = useState<string | null>(null);
  const [voteOff, setVoteOff] = useState(readVoteOff);
  const [pip, setPip] = useState<ScorePip | null>(null);
  // «¿Vas hoy?» answered from the sheet: it stays (showing the answer) for that match
  const [answeredHere, setAnsweredHere] = useState<string | null>(null);
  const [devGoal, setDevGoal] = useState<string | null>(null);
  const grow = useGrow("vd-live-jugadas");

  // A member's own data (members only, his own documents or the match's private one): «Vota al MVP» — he
  // hasn't voted; «Hoy anotas tú» — la mesa is his; «¿Vas hoy?» — a jugador who hasn't answered.
  const uid = viewer.member ? user?.uid : undefined;
  const jugador = viewerKind(viewer, viewer.playerId ? (players.find((p) => p.id === viewer.playerId) ?? null) : null) === "jugador";
  const ballot = viewer.member ? voteMatch(matches, now) : undefined;
  const myVote = useMyMvpVote(ballot?.id, uid);
  const day = viewer.member ? todayMatch(matches, now) : undefined;
  const scorers = useMatchScorers(day?.id);
  const rsvpOpen = jugador && !!day && kickoffWindow(day, now) === "open";
  const availability = useAvailability(rsvpOpen ? day.id : undefined);
  const mine = uid ? (availability.data.find((a) => a.uid === uid)?.response ?? null) : null;
  const anotador = !!uid && !scorers.loading && scorers.data.includes(uid);
  const rsvp = rsvpOpen && !availability.loading && (!mine || answeredHere === day.id);
  const state = islandOf(matches, now, !!ballot && !myVote.loading && !myVote.data && voteOff !== ballot.id, { anotador, rsvp });

  // the match whose plays it follows (from the whistle's wait to the final)
  const watched = state && (state.kind === "pending" || state.kind === "anotador" || state.kind === "live" || state.kind === "halftime" || state.kind === "final") ? state.match : undefined;
  // (a play only unfolds on a score the server confirmed: never on the cache's word)
  const fresh = useMatchMoment(watched, now, { celebrate: sync.fresh && sync.online, hold: DROP_HOLD_MS });
  const nameOf = (id: string) => nameFor(players.find((p) => p.id === id), state?.match.seasonId);
  const moments = state ? momentsOf(state.match, nameOf) : [];
  const rows = state && state.kind !== "previa" && state.kind !== "rsvp" && state.kind !== "anotador" && state.kind !== "unplayed" ? playsLog(state.match, nameOf).rows : [];
  const isLive = !!state && playing(state);
  const realChip = syncChip(sync, now - serverOffset(), isLive);
  const chip: SyncChip | null = hatch.offline ? { kind: "offline", text: RECONNECTING } : realChip;
  // (while a match is on or about to be, the phone checks the server's clock)
  useServerTimeSync(!!state && (state.kind === "pending" || state.kind === "live" || state.kind === "halftime" || state.kind === "previa"), now);

  // the chrome's dot on «Partidos»
  useEffect(() => {
    liveDock.setLive(isLive);
  }, [isLive]);
  useEffect(() => () => liveDock.setLive(false), []);

  // the last goal: the goal moment plays when a new one arrives (a goal there on arrival only keeps its rim)
  const last = moments.at(-1)?.moment ?? null;
  const lastGoal = moments.findLast((x) => x.moment.kind === "gol" || x.moment.kind === "golrival")?.moment ?? null;
  const goalNow = last && (last.kind === "gol" || last.kind === "golrival") ? last : null;
  const devPlay = !!goalNow && devGoal === goalNow.id;
  // (it plays only for a goal that is fresh now — on a score the server confirmed —, never for one that was
  // already there or arrives late: those just keep the rim)
  const freshGoal = (!!fresh && !!goalNow && fresh.id === goalNow.id) || devPlay;
  const g = useGoalMoment(goalNow ? { key: devPlay ? `${goalNow.id}:otra` : goalNow.id, side: goalNow.kind === "gol" ? "us" : "them" } : null, { reduced: reduced || !freshGoal });
  // (DEV: replay the last goal 3 s in, for the shots)
  const goalId = goalNow?.id ?? null;
  useEffect(() => {
    if (!hatch.goal || !goalId) return;
    const t = window.setTimeout(() => setDevGoal(goalId), 3000);
    return () => window.clearTimeout(t);
  }, [hatch.goal, goalId]);
  const moment: MatchMoment | null = fresh ?? (devPlay && g.active ? goalNow : null);

  // What a screen reader hears: each real change of state, each fresh play and each change of connection,
  // once. Nothing while what it shows is still settling, nor on the first settled render (arriving at a page
  // is not «Empieza el partido» at minute 30).
  const settled = !loading && teamReady && !authLoading && !myVote.loading && !scorers.loading && !availability.loading && (sync.since !== null || !sync.online);
  const stateKey = state ? `${state.kind}:${state.kind === "final" && state.published ? "acta" : ""}:${state.match.id}` : "";
  const kind = state?.kind ?? null;
  const momentId = fresh?.id ?? null;
  const chipKind = chip?.kind ?? "";
  const [heard, setHeard] = useState<Heard>({ armed: false, key: stateKey, kind, moment: momentId ?? "", chip: chipKind, text: "", from: null });
  const newState = heard.key !== stateKey;
  const newMoment = !!momentId && momentId !== heard.moment;
  const newChip = heard.chip !== chipKind;
  if (!settled || !heard.armed) {
    if (heard.armed !== settled || newState || newMoment || newChip) setHeard({ armed: settled, key: stateKey, kind, moment: momentId ?? heard.moment, chip: chipKind, text: heard.text, from: null });
  } else if (newState || newMoment || newChip) {
    // a state change and a fresh play from the same snapshot: both, the state first (a turn of the clock is
    // said by its state change alone)
    const sameSnapshot = !newState && !!state && heard.from === state.match;
    const play = newMoment && fresh && !CLOCK_KINDS.has(fresh.kind) ? fresh.said : "";
    const conn = newChip ? syncChipAnnouncement(chip) : "";
    const lines = [newState && state ? islandAnnouncement(state, heard.kind) : sameSnapshot ? heard.text : "", play, conn].filter(Boolean);
    setHeard({ armed: true, key: stateKey, kind, moment: momentId ?? heard.moment, chip: chipKind, text: lines.length ? lines.join(" ") : newState ? "" : heard.text, from: state?.match ?? null });
  }

  const mark = state ? hideMark(state, lastGoal?.id ?? "") : "";
  const hidden = !!state && hiddenAt === mark;
  // (on the shown match's own page it has landed: the page is the scoreboard, and says its own plays)
  const landed = !!state && pathname === `/matches/${state.match.id}`;
  const shown = !!state && !landed && !hidden;
  const lensHere = dock.mode === "lens";

  // the sheet and its window belong to the page they were opened on, and go when the float hides or steps
  // aside for a lens
  const sheetOpen = open === pathname && shown && !lensHere;
  const growOpen = grow.open && growOn === pathname && shown && !lensHere;

  // the score's window goes when there is nothing to show
  const closePip = useCallback(() => {
    setPip((p) => {
      p?.close();
      return null;
    });
  }, []);
  const hasState = !!state;
  const activePip = hasState ? pip : null;
  useEffect(() => {
    if (!hasState) pip?.close();
  }, [hasState, pip]);

  // keep the sheet by the float when the window changes size
  useEffect(() => {
    if (!sheetOpen || !desktop) return;
    const onResize = () => setPlace(sheetPlace(zone.current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sheetOpen, desktop]);

  if (!hydrated || !state) return null;
  const matchId = state.match.id;
  const rival = state.match.rival?.trim() || "Rival";
  const float: FloatMatch = floatOf({ state, now, moment, rows, staleMinutes: chip?.kind === "stale" ? chip.minutes : null, offline: chip?.kind === "offline" });
  const counts = state.kind === "rsvp" ? { vienen: availability.data.filter((a) => a.response === "yes").length, duda: availability.data.filter((a) => a.response === "maybe").length } : null;
  const sheetBase = sheetOf({ state, now, nameOf, counts, rows });
  // (a score the server can't confirm isn't «en directo»: the sheet says why instead)
  const model = float.state === "offline" ? { ...sheetBase, live: false, clock: null } : sheetBase;
  const voting = state.kind === "vote";

  const openSheet = () => {
    if (sheetOpen) {
      setOpen(null);
      return;
    }
    if (desktop) setPlace(sheetPlace(zone.current));
    setOpen(pathname);
  };
  const hide = () => {
    if (voting) {
      try {
        localStorage.setItem(VOTE_OFF_KEY, matchId);
      } catch {
        // (storage blocked: it stays closed until the page reloads)
      }
      setVoteOff(matchId);
    } else setHiddenAt(mark);
    setOpen(null);
  };
  const answer = (a: RsvpAnswer) => {
    if (!me) return;
    setAnsweredHere(matchId);
    setHeard((h) => ({ ...h, text: a === "yes" ? "Apuntado: vas." : a === "maybe" ? "Apuntado: en duda." : "Apuntado: no vas." }));
    void setAvailability(me, matchId, a).catch(() => setHeard((h) => ({ ...h, text: "No se ha podido guardar tu respuesta. Prueba desde el vestuario." })));
  };
  const onPip = () => {
    if (activePip) {
      closePip();
      return;
    }
    // (from the click itself: the browser asks for a user gesture)
    void openScorePip({ title: `Manchester Piti contra ${rival}` }).then(setPip);
  };
  const lines = floatLines(float, now);

  return (
    <>
      {!landed && (
        <span className="vd-vh" role="status">
          {heard.text}
        </span>
      )}
      {shown && (
        <div ref={zone} className={g.root || undefined}>
          <FloatingScore
            match={float}
            now={now}
            onOpen={openSheet}
            onPip={onPip}
            storageKey={pageKey(pathname)}
            placement={pathname === "/" ? "centre" : "right"}
            goal={g.lens || undefined}
            rim={g.rim}
            scoreClass={g.digit || undefined}
            sheetOpen={sheetOpen}
          />
          {sheetOpen && !growOpen && (
            <LiveSheet
              model={model}
              rival={rival}
              matchId={matchId}
              rows={rows}
              phone={!desktop}
              style={desktop ? place.style : undefined}
              up={place.up}
              vtName={pathname.startsWith("/matches/") || reduced ? undefined : LIVE_VT}
              transition={!reduced}
              growProps={grow.summaryProps}
              onMore={() => {
                setGrowOn(pathname);
                grow.grow();
              }}
              onClose={() => setOpen(null)}
              onHide={hide}
              onPip={desktop ? onPip : undefined}
              pipOn={!!activePip}
              mine={state.kind === "rsvp" ? mine : null}
              onAnswer={state.kind === "rsvp" ? answer : undefined}
              sync={chip ? (chip.kind === "offline" ? `Sin conexión · ${chip.text}` : chip.text) : undefined}
            />
          )}
          <LivePlays open={growOpen} rows={rows} rival={rival} phone={!desktop} name={grow.windowProps.name} onClose={grow.close} />
        </div>
      )}
      <PipWindow pip={activePip} title={`Manchester Piti contra ${rival}`} onClose={closePip}>
        <div className="vd-pipscore">
          <img src="/crest-128.webp" alt="" width={44} height={44} />
          {lines.big && <span className="vd-score">{lines.big}</span>}
          <p>
            <b>{lines.main}</b>
            {lines.clock ? <span className="vd-clock">{lines.small}</span> : lines.small}
          </p>
        </div>
      </PipWindow>
    </>
  );
}
