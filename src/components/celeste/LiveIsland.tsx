// The live island («Elegida»): the scorebug on every public page through the match day (lib/derived/island).
// «Antes del partido» two hours before kick-off («¿Vas hoy?» for a member who hasn't answered, «Hoy anotas tú»
// for the one at la mesa) → «Pendiente del pitido» → the score and the minute → «Descanso» → «Final» for half an
// hour («Ya está el acta» once out) → «Vota al MVP» for a member who hasn't voted. Each fresh play unfolds its
// rótulo for ~9 s (useMatchMoment; only on a score the server confirmed), goals and the clock's turns with the
// crest's cortinilla. Phone: a row at the top; tablet: a bar above the dock; desktop: a picture-in-picture
// (components/celeste/isla). Screen readers hear each change once (a polite live region), never the ticking
// minute. Hidden on the shown match's own page (it lands there: «Ver el partido» is a View Transition into its
// scoreboard) and while a page's hero shows the match (useIslaHero).
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Link as RouterLink, useRouterState } from "@tanstack/react-router";
import { nameFor, useClubData, type ClubMatch } from "../../lib/clubData";
import { useClock } from "../../hooks/useClock";
import { useViewer } from "../../hooks/useViewer";
import { useAuth } from "../../context/AuthContext";
import { useTeam } from "../../context/TeamContext";
import { islandAnnouncement, islandOf, islaVista, todayMatch, voteMatch, type IslaAnswer, type IslandState } from "../../lib/derived/island";
import { momentsOf } from "../../lib/derived/moments";
import { kickoffWindow } from "../../lib/derived/memberWindows";
import { syncChip } from "../../lib/derived/syncChip";
import { useSyncStatus } from "../../lib/syncStatus";
import { serverOffset } from "../../lib/serverTime";
import { useAvailability, useMatchScorers, useMyMvpVote } from "../../pages/vestuario/live";
import { setAvailability, useMe } from "../../pages/vestuario/writes";
import { SyncChip } from "./SyncChip";
import { useServerTimeSync } from "../../hooks/useServerTimeSync";
import { Isla, type IslaLinkProps } from "./isla/Isla";
import { useMatchMoment, MOMENT_HOLD_MS } from "./isla/useMatchMoment";
import { useIslaHeroShown } from "./isla/heroSignal";
import { useIslaDevice, useReducedMotion } from "./isla/media";
import { readPipPrefs, writePipPrefs, type PipPrefs } from "./isla/pip";

/** The vote pill a member closed (one match id: the next vote shows again). */
const VOTE_OFF_KEY = "mp:isle:vote-off";
/** The clock's turns: their line is the state's own («Descanso. Piti 1, …»), said once by the state change. */
const CLOCK_KINDS = new Set(["arranque", "descanso", "reanudacion", "final"]);

const readVoteOff = (): string | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(VOTE_OFF_KEY);
  } catch {
    return null;
  }
};

/** The links of the island, on the router: «Ver el partido» flies into the match page's scoreboard. */
function IslaLink({ to, matchId, className, children }: IslaLinkProps) {
  if (to === "mesa")
    return (
      <RouterLink className={className} to="/matches/$matchId/mesa" params={{ matchId }}>
        {children}
      </RouterLink>
    );
  if (to === "votar")
    return (
      <RouterLink className={className} to="/matches/$matchId" params={{ matchId }} search={{ tab: "vestuario" }}>
        {children}
      </RouterLink>
    );
  return (
    <RouterLink className={className} to="/matches/$matchId" params={{ matchId }} viewTransition={to === "partido"}>
      {children}
    </RouterLink>
  );
}

const subscribeNothing = () => () => {};
/** False in the server render: the island is a fixed overlay of the live day, it only exists in the browser (its
 *  stylesheet comes with its lazy chunk, so server markup would paint unstyled above the page). */
const useHydrated = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);

export function LiveIsland() {
  const hydrated = useHydrated();
  const { matches, players, loading } = useClubData();
  const now = useClock(15_000);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const viewer = useViewer();
  const { user, loading: authLoading } = useAuth();
  const { ready: teamReady } = useTeam();
  const me = useMe();
  const sync = useSyncStatus();
  const device = useIslaDevice();
  const reduced = useReducedMotion();
  const heroShown = useIslaHeroShown();
  const [open, setOpen] = useState(false);
  // Taken away (the last goal it saw, per match): the next goal brings it back by itself.
  const [hiddenAt, setHiddenAt] = useState<string | null>(null);
  const [voteOff, setVoteOff] = useState(readVoteOff);
  const [pip, setPip] = useState<PipPrefs>(readPipPrefs);
  // «¿Vas hoy?» answered from the island: it stays (showing the answer) for that match until the page changes
  const [answeredHere, setAnsweredHere] = useState<string | null>(null);

  // A member's own data (members only, his own documents or the match's private one):
  // «Vota al MVP» — he hasn't voted; «Hoy anotas tú» — la mesa is his; «¿Vas hoy?» — he hasn't answered.
  const uid = viewer.member ? user?.uid : undefined;
  const ballot = viewer.member ? voteMatch(matches, now) : undefined;
  const myVote = useMyMvpVote(ballot?.id, uid);
  const day = viewer.member ? todayMatch(matches, now) : undefined;
  const scorers = useMatchScorers(day?.id);
  const rsvpOpen = !!day && kickoffWindow(day, now) === "open";
  const availability = useAvailability(rsvpOpen ? day.id : undefined);
  const mine = uid ? (availability.data.find((a) => a.uid === uid)?.response ?? null) : null;
  const anotador = !!uid && !scorers.loading && scorers.data.includes(uid);
  const rsvp = rsvpOpen && !availability.loading && (!mine || answeredHere === day.id);
  const state = islandOf(matches, now, !!ballot && !myVote.loading && !myVote.data && voteOff !== ballot.id, { anotador, rsvp });

  // the match whose plays the island follows (from the whistle's wait to the final)
  const watched = state && (state.kind === "pending" || state.kind === "anotador" || state.kind === "live" || state.kind === "halftime" || state.kind === "final") ? state.match : undefined;
  // (a play only unfolds on a score the server confirmed: never on the cache's word)
  const moment = useMatchMoment(watched, now, { celebrate: sync.fresh && sync.online });
  const nameOf = (id: string) => nameFor(players.find((p) => p.id === id), watched?.seasonId);
  const moments = watched ? momentsOf(watched, nameOf) : [];
  const live = state && (state.kind === "live" || state.kind === "halftime") ? state.match : undefined;
  const chip = syncChip(sync, now - serverOffset(), !!live);
  // (while a match is on or about to be, the phone checks the server's clock)
  useServerTimeSync(!!state && (state.kind === "pending" || state.kind === "live" || state.kind === "halftime" || state.kind === "previa"), now);
  // (the island lands on its match page, which already is the scoreboard)
  const shown = !!state && pathname !== `/matches/${state.match.id}`;
  // /partidos has the big board with its own ¡GOL!, and a page's hero (useIslaHero) is the match itself: the
  // island changes its words there, without saying the play a second time.
  const boardHere = pathname === "/partidos" || heroShown;

  // What a screen reader hears: each real change of state and each fresh play, once. Nothing while what the
  // island shows is still settling (the data loading or only the cache's word, who is looking, his vote, la
  // mesa, his answer), nor on the first settled render: arriving at a page is not «Empieza el partido» at minute
  // 30 nor «Ya puedes votar».
  const settled = !loading && teamReady && !authLoading && !myVote.loading && !scorers.loading && !availability.loading && (sync.since !== null || !sync.online);
  const stateKey = state ? `${state.kind}:${state.kind === "final" && state.published ? "acta" : ""}:${state.match.id}` : "";
  const kind = state?.kind ?? null;
  const momentId = moment?.id ?? null;
  const [heard, setHeard] = useState<{ armed: boolean; key: string; kind: IslandState["kind"] | null; moment: string; text: string; from: ClubMatch | null }>({ armed: false, key: stateKey, kind, moment: momentId ?? "", text: "", from: null });
  // (a new state unfolds its rótulo for a while, like a play)
  const [enteredOn, setEnteredOn] = useState<string | null>(null);
  const newState = heard.key !== stateKey;
  const newMoment = !!momentId && momentId !== heard.moment;
  if (!settled || !heard.armed) {
    // seed silently (and arm once settled)
    if (heard.armed !== settled || newState || newMoment) setHeard({ armed: settled, key: stateKey, kind, moment: momentId ?? heard.moment, text: heard.text, from: null });
  } else if (newState || newMoment) {
    // a state change and a fresh play from the same snapshot: both, the state first (a turn of the clock is
    // said by its state change alone)
    const sameSnapshot = !newState && !!state && heard.from === state.match;
    const play = newMoment && moment && !boardHere && !CLOCK_KINDS.has(moment.kind) ? moment.said : "";
    const lines = [newState && state ? islandAnnouncement(state, heard.kind) : sameSnapshot ? heard.text : "", play].filter(Boolean);
    setHeard({ armed: true, key: stateKey, kind, moment: momentId ?? heard.moment, text: lines.length ? lines.join(" ") : newState ? "" : heard.text, from: state?.match ?? null });
    if (newState && state) setEnteredOn(stateKey);
  }
  const entered = !!enteredOn && enteredOn === stateKey;
  useEffect(() => {
    if (!enteredOn) return;
    const t = window.setTimeout(() => setEnteredOn(null), MOMENT_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [enteredOn]);

  const lastGoal = moments.findLast((x) => x.moment.kind === "gol" || x.moment.kind === "golrival")?.moment.id ?? "";
  const goalMark = `${state?.match.id ?? ""}:${lastGoal}`;
  const hidden = hiddenAt === goalMark;

  // The heroes make room for the phone's row (and the chip under it) while it shows (styles: html[data-isle]).
  const reserve = !shown || device !== "movil" ? null : chip ? "sync" : "";
  useEffect(() => {
    if (reserve === null) return;
    document.documentElement.dataset.isle = reserve;
    return () => {
      delete document.documentElement.dataset.isle;
    };
  }, [reserve]);

  const onPip = useCallback((p: PipPrefs) => {
    setPip(p);
    writePipPrefs(p);
  }, []);

  if (!hydrated || !state || !shown) return null;
  const matchId = state.match.id;
  const vista = islaVista({
    state,
    now,
    moment,
    moments,
    staleMinutes: chip?.kind === "stale" ? chip.minutes : null,
    rsvp: state.kind === "rsvp" ? { name: me?.name, vienen: availability.data.filter((a) => a.response === "yes").length, duda: availability.data.filter((a) => a.response === "maybe").length } : null,
    entered,
  });
  const voting = state.kind === "vote";
  const closeVote = () => {
    try {
      localStorage.setItem(VOTE_OFF_KEY, matchId);
    } catch {
      // (storage blocked: it stays closed until the page reloads)
    }
    setVoteOff(matchId);
  };
  const answer = (a: IslaAnswer) => {
    if (!me) return;
    setAnsweredHere(matchId);
    setHeard((h) => ({ ...h, text: a === "yes" ? "Apuntado: vas." : a === "maybe" ? "Apuntado: en duda." : "Apuntado: no vas." }));
    void setAvailability(me, matchId, a).catch(() => setHeard((h) => ({ ...h, text: "No se ha podido guardar tu respuesta. Prueba desde el vestuario." })));
  };

  return (
    <>
      <span className="is-sr" role="status">
        {heard.text}
      </span>
      <Isla
        vista={vista}
        device={device}
        momentKey={moment?.id ?? (entered ? stateKey : null)}
        reduced={reduced}
        open={open}
        onOpen={setOpen}
        hidden={hidden}
        onHide={
          voting
            ? closeVote
            : () => {
                setHiddenAt(goalMark);
                setOpen(false);
              }
        }
        onShow={() => setHiddenAt(null)}
        hideLabel={voting ? "Ocultar el aviso de votar al MVP" : undefined}
        pip={pip}
        onPip={onPip}
        mine={mine}
        onAnswer={answer}
        Link={IslaLink}
        chip={<SyncChip chip={chip} variant="isle" announce />}
      />
    </>
  );
}
