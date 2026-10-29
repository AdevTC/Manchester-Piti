// «Vidrio» · el directo: one glass object carries the match day across the whole web (V-Vivo, V-Integracion).
// The state comes from liveModel's dayStateOf (the island's states, lib/derived/island, plus the rest of the match
// day): the previa from the morning of the match day, «¿Vas hoy?» for a jugador who hasn't answered, «Hoy anotas
// tú» for the one at la mesa (and «Volver a la mesa» while it is on), «Pendiente del pitido», the score and the
// minute, «Descanso», «Final» → «Acta lista» for the rest of the match day (everyone), «Pendiente del acta» for a
// match nobody started, «Vota al MVP» for a member who hasn't voted, «MVP: Alcides» for a day once the vote
// closes, and «Sin conexión» over a live score the server hasn't confirmed (the sheet frosts too; back online,
// the last missed play unfolds once and «Conectado otra vez: N jugadas nuevas» is said). The kit's FloatingScore
// draws it (floating under the bar on desktop, above the tab bar on a phone; hidden while Inicio's lens shows the
// match, docked on Partidos' segment — liveDock); a tap opens the sheet (LiveSheet), the drop growing into it
// (one view-transition-name); «Sacar el marcador» takes it to a window of its own; each fresh goal plays the goal
// moment on it (rings, dust, glint, the page's light catching the gold), each turn of the match unfolds it for
// four seconds. «Ocultar hasta el próximo gol» leaves the score as a chip beside «Partidos» (liveDock.setHidden).
// liveDock.setLive lights the chrome's dot on «Partidos». The installed app's icon carries our goals while the
// ball rolls (useScoreBadge). Screen readers hear each change once (one polite live region), never the ticking
// minute. Client only, never on its own match page (it lands there).
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { nameFor, useClubData, type ClubMatch } from "../../../lib/clubData";
import { niceName } from "../../../lib/derived/words";
import { venueName } from "../../../lib/derived/venue";
import { useClock } from "../../../hooks/useClock";
import { useViewer } from "../../../hooks/useViewer";
import { useAuth } from "../../../context/AuthContext";
import { useTeam } from "../../../context/TeamContext";
import { islandAnnouncement, todayMatch, voteMatch } from "../../../lib/derived/island";
import { momentsOf, type MatchMoment } from "../../../lib/derived/moments";
import { kickoffWindow } from "../../../lib/derived/memberWindows";
import { RECONNECTING, syncChip, syncChipAnnouncement, type SyncChip } from "../../../lib/derived/syncChip";
import { playsLog } from "../../../lib/derived/vidrio/plays";
import { viewerKind } from "../../../lib/derived/vidrio/viewer";
import { useSyncStatus } from "../../../lib/syncStatus";
import { serverOffset } from "../../../lib/serverTime";
import { matchPhase } from "../../../../functions/src/matchEngine";
import { mvpWinners } from "../../../lib/vestuario";
import { pushState, savedTopics, toggleTopic } from "../../../lib/push";
import { scoreOf } from "../../../lib/partidos";
import { mesaLine } from "../../../lib/derived/mesa";
import { useAvailability, useMatchScorers, useMvpResults, useMyMvpVote } from "../../../pages/vestuario/live";
import { setAvailability, useMe } from "../../../pages/vestuario/writes";
import { useServerTimeSync } from "../../../hooks/useServerTimeSync";
import { useMatchMoment } from "./useMatchMoment";
import { FloatingScore } from "../FloatingScore";
import { floatLines, type FloatMatch } from "../floatText";
import { liveDock, useLiveDockState } from "../liveDock";
import { openScorePip, type ScorePip } from "../pip";
import { PipWindow } from "../PipWindow";
import { isShot, prefersReducedMotion, supportsViewTransitions, useDesktop, useReducedMotion } from "../env";
import { useGoalMoment } from "../useGoalMoment";
import { useGrow } from "../useGrow";
import { LIVE_MORPH } from "../transitions";
import { DROP_HOLD_MS, dayStateOf, dropEvent, floatHome, floatOf, hideMark, pageKey, pipBottom, playing, sheetOf, turnEvent, type FloatDay } from "./liveModel";
import { LiveSheet, type RsvpAnswer } from "./LiveSheet";
import { LivePlays } from "./LivePlays";
import { PipScore } from "./PipScore";
import { useScoreBadge } from "./useScoreBadge";
import { logoOf, rivalLogos } from "../../../lib/derived/rivalLogo";
import "../../../styles/vidrio/reading.css";
import "./live.css";

/** The vote notice a member closed (one match id: the next vote shows again). */
const VOTE_OFF_KEY = "mp:isle:vote-off";
/** The clock's turns: their line is the state's own («Descanso. Piti 1, …»), said once by the state change. */
const CLOCK_KINDS = new Set(["arranque", "descanso", "reanudacion", "final"]);
/** The View Transition name the score carries from page to page: the drop, its sheet, Inicio's lens and the match
 *  page's scoreboard (.vd-live-destino) — one of them on screen at a time. */
export const LIVE_VT = LIVE_MORPH;
/** How long a turn of the match keeps the drop unfolded (the board: 3.8 s). */
const TURN_HOLD_MS = 3800;

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

/** Runs a change of the sheet as a View Transition (the drop grows into it, it shrinks back), where there is one. */
function morphSheet(update: () => void): void {
  const doc = typeof document === "undefined" ? null : (document as Document & { startViewTransition?: (cb: () => void) => unknown });
  if (!doc || !supportsViewTransitions() || isShot() || prefersReducedMotion()) {
    update();
    return;
  }
  try {
    doc.startViewTransition?.(() => flushSync(update));
  } catch {
    update();
  }
}

interface Heard {
  armed: boolean;
  key: string;
  kind: FloatDay["kind"] | null;
  moment: string;
  chip: SyncChip["kind"] | "";
  text: string;
  from: ClubMatch | null;
}

/** Where the sheet sits on desktop: where the float is (it grows out of the drop), kept on screen. */
function sheetPlace(zone: HTMLElement | null): { style: CSSProperties; up: boolean } {
  const el = zone?.querySelector(".vd-float");
  if (!el) return { style: { top: 104, right: 24 }, up: false };
  const r = el.getBoundingClientRect();
  const W = window.innerWidth;
  const H = window.innerHeight;
  const width = Math.min(420, W - 20);
  const left = Math.round(Math.min(Math.max(10, r.left + r.width / 2 - width / 2), W - width - 10));
  const up = r.top + r.height / 2 > H / 2;
  return up ? { style: { left, bottom: Math.round(H - r.bottom) }, up } : { style: { left, top: Math.round(r.top) }, up };
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
  // a turn of the match day that unfolds the drop (acta, vote, MVP; the catch-up after a lost connection)
  const [turn, setTurn] = useState<{ ev: FloatMatch["event"]; ms: number } | null>(null);
  // «Avisarme de goles» on the phone's sheet
  const [goalsOn, setGoalsOn] = useState(() => (typeof window === "undefined" ? false : savedTopics().includes("goals")));
  const [goalsBusy, setGoalsBusy] = useState(false);
  const grow = useGrow("vd-live-jugadas");

  // A member's own data (members only, his own documents or the match's private one): «Vota al MVP» — he
  // hasn't voted; «Hoy anotas tú» / «Volver a la mesa» — la mesa is his; «¿Vas hoy?» — a jugador who hasn't
  // answered.
  const uid = viewer.member ? user?.uid : undefined;
  const jugador = viewerKind(viewer, viewer.playerId ? (players.find((p) => p.id === viewer.playerId) ?? null) : null) === "jugador";
  const ballot = viewer.member ? voteMatch(matches, now) : undefined;
  const myVote = useMyMvpVote(ballot?.id, uid);
  const day = viewer.member ? todayMatch(matches, now) : undefined;
  const onNow = viewer.member ? matches.find((m) => matchPhase(m, now) === "playing") : undefined;
  const scorers = useMatchScorers((day ?? onNow)?.id);
  const rsvpOpen = jugador && !!day && kickoffWindow(day, now) === "open";
  const availability = useAvailability(rsvpOpen ? day.id : undefined);
  const mine = uid ? (availability.data.find((a) => a.uid === uid)?.response ?? null) : null;
  const anotador = !!uid && !scorers.loading && scorers.data.includes(uid);
  const rsvp = rsvpOpen && !availability.loading && (!mine || answeredHere === day.id);
  const mvp = useMvpResults();
  const winnerOf = (m: ClubMatch): string | null => {
    const ids = mvpWinners(m, mvp.get(m.id), now);
    return ids.length ? ids.map((id) => niceName(nameFor(players.find((p) => p.id === id), m.seasonId))).join(" y ") : null;
  };
  const state = dayStateOf({ matches, now, voteOpen: !!ballot && !myVote.loading && !myVote.data && voteOff !== ballot.id, today: { anotador, rsvp }, winnerOf });
  // names in sentences and plays read as names («Adrián T.C.», not the shirt's «ADRIÁN T.C.»)
  const nameOf = (id: string) => niceName(nameFor(players.find((p) => p.id === id), state?.match.seasonId));

  // the match whose plays it follows (from the whistle's wait to the final)
  const watched = state && (state.kind === "pending" || state.kind === "anotador" || state.kind === "live" || state.kind === "halftime" || state.kind === "final") ? state.match : undefined;
  // (a play only unfolds on a score the server confirmed: never on the cache's word)
  const fresh = useMatchMoment(watched, now, { celebrate: sync.fresh && sync.online, hold: DROP_HOLD_MS });
  const moments = state ? momentsOf(state.match, nameOf) : [];
  const rows = state && state.kind !== "previa" && state.kind !== "rsvp" && state.kind !== "anotador" && state.kind !== "unplayed" ? playsLog(state.match, nameOf).rows : [];
  const ballRolling = !!state && playing(state);
  const realChip = syncChip(sync, now - serverOffset(), ballRolling);
  const chip: SyncChip | null = hatch.offline ? { kind: "offline", text: RECONNECTING } : realChip;
  const offline = chip?.kind === "offline";
  // (a score the server can't confirm isn't «en directo»: the dot on «Partidos» goes off while offline)
  const isLive = ballRolling && !offline;
  // (while a match is on or about to be, the phone checks the server's clock)
  useServerTimeSync(!!state && (state.kind === "pending" || state.kind === "live" || state.kind === "halftime" || state.kind === "previa"), now);

  // the chrome's dot on «Partidos»
  useEffect(() => {
    liveDock.setLive(isLive);
  }, [isLive]);
  useEffect(() => () => liveDock.setLive(false), []);
  // the app's icon: our goals while the ball rolls
  const { gf, ga } = state ? scoreOf(state.match) : { gf: 0, ga: 0 };
  useScoreBadge(ballRolling, gf);

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
  const fx: "us" | "them" | null = g.active && goalNow ? (goalNow.kind === "gol" ? "us" : "them") : null;

  // Offline: remember the last play seen; back online, the latest missed one unfolds once and it is said.
  const lastId = moments.at(-1)?.moment.id ?? "";
  const seenOffline = useRef<string | null>(null);
  const [caughtUp, setCaughtUp] = useState("");
  useEffect(() => {
    if (offline) {
      if (seenOffline.current === null) seenOffline.current = lastId;
      return;
    }
    const seen = seenOffline.current;
    if (seen === null) return;
    seenOffline.current = null;
    const at = moments.findIndex((x) => x.moment.id === seen);
    const missed = moments.slice(at + 1).filter((x) => !CLOCK_KINDS.has(x.moment.kind));
    if (!missed.length || !state) return;
    const newest = missed.at(-1)?.moment ?? null;
    setTurn({ ev: dropEvent(newest, rows, state.match), ms: DROP_HOLD_MS });
    setCaughtUp(`Conectado otra vez: ${missed.length === 1 ? "una jugada nueva" : `${missed.length} jugadas nuevas`}. El marcador te pone al día con la última.`);
    // oxlint-disable-next-line react/exhaustive-deps -- only the return of the connection counts; moments, rows and the state are read as they are at that moment
  }, [offline]);

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
    const said = newState && state ? (state.kind === "mvpres" ? `${state.winner}, MVP del partido contra ${state.match.rival ?? "el rival"}.` : islandAnnouncement(state, heard.kind === "mvpres" ? null : heard.kind)) : sameSnapshot ? heard.text : "";
    const lines = [said, play, conn].filter(Boolean);
    setHeard({ armed: true, key: stateKey, kind, moment: momentId ?? heard.moment, chip: chipKind, text: lines.length ? lines.join(" ") : newState ? "" : heard.text, from: state?.match ?? null });
    // the state's own turn unfolds the drop (acta, vote, MVP): what no play says
    const ev = newState && state ? turnEvent(state, now, heard.kind) : null;
    if (ev) setTurn({ ev, ms: TURN_HOLD_MS });
  }
  // (the turn folds back after its seconds)
  useEffect(() => {
    if (!turn) return;
    const t = window.setTimeout(() => setTurn(null), turn.ms);
    return () => window.clearTimeout(t);
  }, [turn]);

  const mark = state ? hideMark(state, lastGoal?.id ?? "") : "";
  const hidden = !!state && hiddenAt === mark;
  // (on the shown match's own page it has landed: the page is the scoreboard, and says its own plays)
  // (the match page, on any of its screens; la mesa has no floating score)
  const landed = !!state && pageKey(pathname) === "partido" && pathname.split("/")[2] === state.match.id;
  const shown = !!state && !landed && !hidden;
  const lensHere = dock.mode === "lens";
  const rival = state ? state.match.rival?.trim() || "Rival" : "Rival";
  const logos = useMemo(() => rivalLogos(matches), [matches]);

  // hidden until the next goal: the capsule keeps the score beside «Partidos»
  const chipScore = hidden && state && (ballRolling || state.kind === "final") ? `${gf}–${ga}` : "";
  useEffect(() => {
    liveDock.setHidden(chipScore ? { score: chipScore, said: `Manchester Piti ${gf}, ${rival} ${ga}` } : null, () => setHiddenAt(null));
  }, [chipScore, gf, ga, rival]);
  useEffect(() => () => liveDock.setHidden(null), []);

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

  // «Sacar el marcador» (here, in the sheet, and from the search's «Ahora» through liveDock)
  const togglePip = useCallback(() => {
    if (pip) {
      closePip();
      return;
    }
    // (from the click itself: the browser asks for a user gesture)
    void openScorePip({ title: "Manchester Piti, marcador" }).then(setPip);
  }, [pip, closePip]);
  useEffect(() => {
    liveDock.setPipOpener(ballRolling ? togglePip : null);
    return () => liveDock.setPipOpener(null);
  }, [ballRolling, togglePip]);

  if (!hydrated || !state) return null;
  const matchId = state.match.id;
  const turnEv = turn?.ev ?? null;
  const float: FloatMatch = floatOf({ state, now, moment, rows, staleMinutes: chip?.kind === "stale" ? chip.minutes : null, offline, syncedAt: sync.staleAt ?? sync.since, turn: turnEv });
  const counts = state.kind === "rsvp" ? { vienen: availability.data.filter((a) => a.response === "yes").length, duda: availability.data.filter((a) => a.response === "maybe").length, no: availability.data.filter((a) => a.response === "no").length, squad: players.filter((p) => !(p as { archived?: boolean }).archived).length } : null;
  const tally = mvp.get(state.match.id);
  const sheetBase = sheetOf({ state, now, nameOf, counts, rows, anotador: anotador && (ballRolling || state.kind === "pending"), fan: !viewer.member, mesaLine: mesaLine(state.match) ?? "", turnout: tally ? { total: tally.total, eligible: tally.eligible } : null });
  // (a score the server can't confirm isn't «en directo»: the sheet says why instead)
  // (offline, the frosted sheet says how old its score is: «Marcador del 24′, sin actualizar»)
  const model = float.state === "offline" ? { ...sheetBase, live: false, clock: null, status: floatLines(float, now).main } : sheetBase;
  const voting = state.kind === "vote";
  const docked = desktop && dock.mode === "anchor";

  const openSheet = () => {
    if (sheetOpen) {
      morphSheet(() => setOpen(null));
      return;
    }
    if (desktop) setPlace(sheetPlace(zone.current));
    morphSheet(() => setOpen(pathname));
  };
  const closeSheet = () => morphSheet(() => setOpen(null));
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
  const onPip = togglePip;
  const goals =
    pushState() === "ready"
      ? {
          on: goalsOn,
          busy: goalsBusy,
          toggle: () => {
            setGoalsBusy(true);
            toggleTopic("goals", !goalsOn).then(
              (t) => {
                setGoalsOn(t.includes("goals"));
                setGoalsBusy(false);
                setHeard((h) => ({ ...h, text: t.includes("goals") ? "Te avisamos de los goles." : "Ya no te avisamos de los goles." }));
              },
              () => {
                setGoalsBusy(false);
                setHeard((h) => ({ ...h, text: "No se han podido activar los avisos en este navegador." }));
              },
            );
          },
        }
      : null;

  // the score's window: the bold line and the last play
  const lines = floatLines(float, now);
  const lastRow = rows[0];
  const lastPlay = lastRow ? `${lastRow.minuteText} ${lastRow.title}${lastRow.sub ? `, ${lastRow.sub.charAt(0).toLocaleLowerCase("es")}${lastRow.sub.slice(1)}` : ""}` : "";
  const pipHead = float.event ? float.event.title : float.state === "offline" ? "Sin actualizar" : state.kind === "live" ? `En directo, ${float.clock ?? ""}` : state.kind === "halftime" ? "Descanso" : model.status;
  const pipSub = float.event ? (float.event.sub ?? "") : float.state === "offline" ? lines.main : ballRolling || state.kind === "final" ? lastPlay : `Contra ${rival}${state.match.venue ? `, en ${venueName(state.match.venue)}` : ""}`;
  const said = [caughtUp, heard.text].filter(Boolean).join(" ");

  return (
    <>
      {!landed && (
        <span className="vd-vh" role="status">
          {said}
        </span>
      )}
      {shown && (
        <div ref={zone} className={g.root || undefined}>
          {fx && !docked && !lensHere && <div className={`vd-flood vd-flood--${fx}`} aria-hidden="true" />}
          <FloatingScore
            match={float}
            now={now}
            onOpen={openSheet}
            onPip={onPip}
            storageKey={pageKey(pathname)}
            placement={floatHome(pathname)}
            goal={g.lens || undefined}
            rim={g.rim}
            coldRim={!!lastGoal && lastGoal.kind === "golrival" && last?.id === lastGoal.id}
            scoreClass={g.digit || undefined}
            sheetOpen={sheetOpen}
            vtName={pageKey(pathname) === "partido" || reduced ? undefined : LIVE_VT}
            fx={fx}
            glint={g.glint || undefined}
            nameClass={g.name || undefined}
            flash={!!turnEv && state.kind === "mvpres"}
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
              vtName={pageKey(pathname) === "partido" || reduced ? undefined : LIVE_VT}
              transition={!reduced}
              growProps={grow.summaryProps}
              onMore={() => {
                setGrowOn(pathname);
                grow.grow();
              }}
              onClose={closeSheet}
              onHide={hide}
              onPip={desktop ? onPip : undefined}
              pipOn={!!activePip}
              mine={state.kind === "rsvp" ? mine : null}
              onAnswer={state.kind === "rsvp" ? answer : undefined}
              sync={chip ? (chip.kind === "offline" ? `Sin conexión · ${chip.text}` : chip.text) : undefined}
              frost={offline}
              goals={desktop ? null : goals}
            />
          )}
          <LivePlays open={growOpen} rows={rows} rival={rival} phone={!desktop} name={grow.windowProps.name} onClose={grow.close} />
        </div>
      )}
      <PipWindow pip={activePip} title="Marcador en una ventana aparte" onClose={closePip} bottom={pipBottom(pathname)}>
        <PipScore big={lines.big} rival={rival} logo={logoOf(logos, rival)} head={pipHead} sub={pipSub} now={now} live={ballRolling} digit={g.digit || undefined} fx={fx} gold={g.sky.gold} cold={g.sky.cold} />
      </PipWindow>
    </>
  );
}
