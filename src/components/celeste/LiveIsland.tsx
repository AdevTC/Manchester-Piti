// The live island: a pill at the top of every public page that follows the match day (lib/derived/island):
// «Pendiente del pitido inicial» once the date has come → the score and the live minute (tap it and it
// opens into the scoreboard with the last thing that happened) → «Descanso» → «FINAL 2–1 · acta
// pendiente» for half an hour → «Vota al MVP» for a member while the vote is open. A fresh goal takes the
// pill for ~4 s wherever you are («¡GOL! ERIK 19′ · 2–1», a burst only with motion allowed; a goal
// against is calmer). Under the pill, the connection chip when the score may not be live. Screen readers
// hear each change once (a polite live region), never the ticking minute. Hidden on the shown match's
// own page, which already is the scoreboard.
import { useEffect, useState, type CSSProperties } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { nameFor, useClubData, type ClubMatch } from "../../lib/clubData";
import { useClock } from "../../hooks/useClock";
import { useViewer } from "../../hooks/useViewer";
import { useAuth } from "../../context/AuthContext";
import { useTeam } from "../../context/TeamContext";
import { lastEvent, scoreOf, shownMinute } from "../../lib/partidos";
import { opponentInitials } from "../../lib/clubAnalytics";
import { PENDING_WHISTLE } from "../../lib/derived/kickoff";
import { goalMoment, islandAnnouncement, islandOf, voteMatch, type IslandState } from "../../lib/derived/island";
import { syncChip } from "../../lib/derived/syncChip";
import { useSyncStatus } from "../../lib/syncStatus";
import { serverOffset } from "../../lib/serverTime";
import { useMyMvpVote } from "../../pages/vestuario/live";
import { Flip } from "./Flip";
import { SyncChip } from "./SyncChip";
import { useGoalCelebration } from "./useGoalCelebration";
import { useServerTimeSync } from "../../hooks/useServerTimeSync";
import { Icon } from "./icons";
import "../../styles/partidos.css";

/** How long a goal holds the pill. */
export const GOAL_HOLD_MS = 4000;
/** The vote pill a member closed (one match id: the next vote shows again). */
const VOTE_OFF_KEY = "mp:isle:vote-off";

const readVoteOff = (): string | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(VOTE_OFF_KEY);
  } catch {
    return null;
  }
};
const motionAllowed = () => typeof window === "undefined" || !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const CONFETTI = Array.from({ length: 14 }, (_, i) => ({
  "--x": `${Math.round(Math.cos((i / 14) * 2 * Math.PI) * (90 + (i % 3) * 26))}px`,
  "--y": `${Math.round(Math.sin((i / 14) * 2 * Math.PI) * (26 + (i % 4) * 7))}px`,
  "--r": `${(i * 47) % 360}deg`,
  "--w": `${(i % 4) * 0.04}s`,
  background: ["#FFC659", "#6CABDD", "#eef4ff", "#ffe0a0"][i % 4],
}));

export function LiveIsland() {
  const { matches, players, loading } = useClubData();
  const now = useClock(15_000);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const viewer = useViewer();
  const { user, loading: authLoading } = useAuth();
  const { ready: teamReady } = useTeam();
  const sync = useSyncStatus();
  const [open, setOpen] = useState(false);
  const [voteOff, setVoteOff] = useState(readVoteOff);

  // «Vota al MVP»: a member who hasn't voted (his own vote doc: members only, one document).
  const ballot = viewer.member ? voteMatch(matches, now) : undefined;
  const myVote = useMyMvpVote(ballot?.id, viewer.member ? user?.uid : undefined);
  const state = islandOf(matches, now, !!ballot && !myVote.loading && !myVote.data && voteOff !== ballot.id);

  const live = state && (state.kind === "live" || state.kind === "halftime") ? state.match : undefined;
  // (a goal only celebrates on a score the server confirmed: never on the cache's word)
  const goalShow = useGoalCelebration(live, now, { hold: GOAL_HOLD_MS, celebrate: sync.fresh && sync.online });
  const chip = syncChip(sync, now - serverOffset(), !!live);
  // (while a match is on or about to be, the phone checks the server's clock)
  useServerTimeSync(!!state && state.kind !== "final" && state.kind !== "vote", now);
  const shown = !!state && pathname !== `/matches/${state.match.id}`;
  // /partidos has the big board with its own ¡GOL!: the island changes its words there, without a second burst or announcement.
  const boardHere = pathname === "/partidos";

  const nameOf = (id: string) => nameFor(players.find((p) => p.id === id), state?.match.seasonId);
  const goal = live && goalShow.goal ? goalMoment(live, goalShow.goal.id, nameOf) : null;

  // What a screen reader hears: each real change of state and each goal, once. Nothing while what the island
  // shows is still settling (the data loading or only the cache's word, who is looking, his vote), nor on
  // the first settled render: arriving at a page is not «Empieza el partido» at minute 30 nor «Ya puedes votar».
  const settled = !loading && teamReady && !authLoading && !myVote.loading && (sync.since !== null || !sync.online);
  const stateKey = state ? `${state.kind}:${state.match.id}` : "";
  const kind = state?.kind ?? null;
  const goalId = goal && goalShow.goal ? goalShow.goal.id : null;
  // (`from`: the match snapshot the last line was said for — the goal shows one render after the state
  // change it came with, so a goal of that same snapshot is added to the line, not put in its place)
  const [heard, setHeard] = useState<{ armed: boolean; key: string; kind: IslandState["kind"] | null; goal: string; text: string; from: ClubMatch | null }>({ armed: false, key: stateKey, kind, goal: goalId ?? "", text: "", from: null });
  const newState = heard.key !== stateKey;
  const newGoal = !!goalId && goalId !== heard.goal;
  if (!settled || !heard.armed) {
    // seed silently (and arm once settled)
    if (heard.armed !== settled || newState || newGoal) setHeard({ armed: settled, key: stateKey, kind, goal: goalId ?? heard.goal, text: heard.text, from: null });
  } else if (newState || newGoal) {
    // a state change and a fresh goal from the same snapshot: both, the state first
    const sameSnapshot = !newState && !!state && heard.from === state.match;
    const lines = [newState && state ? islandAnnouncement(state, heard.kind) : sameSnapshot ? heard.text : "", newGoal && goal && !boardHere ? goal.said : ""].filter(Boolean);
    setHeard({ armed: true, key: stateKey, kind, goal: goalId ?? heard.goal, text: lines.length ? lines.join(" ") : newState ? "" : heard.text, from: state?.match ?? null });
  }

  // The heroes make room for the pill (and the chip under it) while they are on screen (styles: html[data-isle]).
  const reserve = !shown ? null : chip ? "sync" : "";
  useEffect(() => {
    if (reserve === null) return;
    document.documentElement.dataset.isle = reserve;
    return () => {
      delete document.documentElement.dataset.isle;
    };
  }, [reserve]);

  if (!state || !shown) return null;
  const close = () => {
    try {
      localStorage.setItem(VOTE_OFF_KEY, state.match.id);
    } catch {
      // (storage blocked: it stays closed until the page reloads)
    }
    setVoteOff(state.match.id);
  };

  return (
    <div className="pt-isle-wrap">
      <span className="pt-isle-sr" role="status">
        {heard.text}
      </span>
      {state.kind === "live" || state.kind === "halftime" ? (
        <LivePill state={state} open={open} setOpen={setOpen} goal={goal} burst={!!goal?.ours && !boardHere && motionAllowed()} flip={goalShow.flip} nameOf={nameOf} now={now} stale={chip?.kind === "stale"} goalKey={goalShow.goal?.n ?? 0} />
      ) : (
        <StillPill state={state} onClose={close} />
      )}
      <SyncChip chip={chip} variant="isle" announce />
    </div>
  );
}

function StillPill({ state, onClose }: { state: Exclude<IslandState, { kind: "live" | "halftime" }>; onClose: () => void }) {
  const m = state.match;
  const rival = m.rival ?? "Rival";
  const ini = m.rivalInitials || opponentInitials(rival);
  if (state.kind === "pending")
    return (
      <Link className="pt-isle wait" to="/matches/$matchId" params={{ matchId: m.id }} aria-label={`Manchester Piti contra ${rival}: ${PENDING_WHISTLE.toLowerCase()}. Abrir el partido`}>
        <span className="s">
          <img src="/crest-128.webp" alt="" />
          <span>vs {ini}</span>
        </span>
        <span className="m">{PENDING_WHISTLE}</span>
      </Link>
    );
  if (state.kind === "final") {
    const { gf, ga } = scoreOf(m);
    const after = state.published ? "ya está el acta" : "acta pendiente";
    return (
      <Link className="pt-isle fin" to="/matches/$matchId" params={{ matchId: m.id }} aria-label={`Final: Manchester Piti ${gf}, ${rival} ${ga}, ${after}. Abrir el partido`}>
        <span className="s">
          <img src="/crest-128.webp" alt="" />
          <span>
            FINAL {gf}–{ga}
          </span>
        </span>{" "}
        <span className="m">· {after}</span>
      </Link>
    );
  }
  return (
    <div className="pt-isle vote">
      <Link className="go" to="/matches/$matchId" params={{ matchId: m.id }} search={{ tab: "vestuario" }} aria-label={`Vota al MVP del partido contra ${rival}`}>
        <span className="s">
          <Icon name="crown" size={18} stroke={2.2} />
          <span>Vota al MVP</span>
        </span>
        <span className="m">
          vs {ini} <Icon name="arrow" size={14} stroke={2.4} />
        </span>
      </Link>
      <button type="button" className="x" onClick={onClose} aria-label="Ocultar el aviso de votar al MVP">
        <Icon name="x" size={16} stroke={2.4} />
      </button>
    </div>
  );
}

interface LivePillProps {
  state: Extract<IslandState, { kind: "live" | "halftime" }>;
  open: boolean;
  setOpen: (open: boolean) => void;
  goal: ReturnType<typeof goalMoment>;
  burst: boolean;
  flip: boolean;
  nameOf: (id: string) => string;
  now: number;
  stale: boolean;
  goalKey: number;
}

function LivePill({ state, open, setOpen, goal, burst, flip, nameOf, now, stale, goalKey }: LivePillProps) {
  const live = state.match;
  const half = state.kind === "halftime";
  const { gf, ga } = scoreOf(live);
  const rival = live.rival ?? "Rival";
  const ini = live.rivalInitials || opponentInitials(rival);
  const minute = shownMinute(live, now);
  const last = lastEvent(live.events, nameOf, rival);
  const pct = `${Math.min(100, ((minute ?? 0) / (live.duration ?? 50)) * 100)}%`;
  const label = half ? `Descanso: Manchester Piti ${gf}, ${rival} ${ga}` : `En directo: Manchester Piti ${gf}, ${rival} ${ga}, minuto ${minute ?? 0}`;
  const cls = ["pt-isle", half && "half", stale && "stale", goal && "goal", goal && !goal.ours && "them"].filter(Boolean).join(" ");

  if (open)
    return (
      <div className={`${cls} open`} role="region" aria-label={label}>
        <div className="pt-act">
          <div className="row">
            <span className="tm">
              <img src="/crest-128.webp" alt="" />
              PITI
            </span>
            <span className="sc" aria-hidden="true">
              <Flip value={gf} still={!flip} />
              <Flip value={ga} still={!flip} />
            </span>
            <span className="tm">
              <i>{ini}</i>
              {rival}
            </span>
          </div>
          <span className="bar">
            <i style={{ width: pct }} />
          </span>
          <span className={goal ? "ev gl" : "ev"}>
            {goal ? (
              goal.text
            ) : half ? (
              <>
                <Icon name="pause" size={13} />
                Descanso{last ? ` · ${last.who} · ${last.label}` : ""}
              </>
            ) : (
              <>
                <span className="pt-dot" />
                {minute}′{last ? ` · ${last.who} · ${last.label}` : " · en juego"}
              </>
            )}
          </span>
          <span className="go">
            <Link to="/matches/$matchId" params={{ matchId: live.id }}>
              Seguir en directo <Icon name="arrow" size={15} stroke={2.2} />
            </Link>
            <button type="button" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </span>
        </div>
      </div>
    );

  return (
    <button type="button" className={cls} onClick={() => setOpen(true)} aria-expanded="false" aria-label={`${goal ? `${goal.text}. ` : ""}${label}. Abrir el marcador`}>
      {goal ? (
        <span className="gl" key={goalKey}>
          {goal.head && <b>{goal.head}</b>}
          <span>{goal.rest}</span>
        </span>
      ) : (
        <>
          <span className="s">
            <img src="/crest-128.webp" alt="" />
            <span>
              {gf}–{ga} {ini}
            </span>
          </span>
          <span className="m">
            {half ? <Icon name="pause" size={12} /> : <span className="pt-dot" />}
            {half ? "Descanso" : `${minute}′`}
          </span>
        </>
      )}
      {burst && (
        <span className="pt-isle-burst" key={`b${goalKey}`} aria-hidden="true">
          <span className="ring" />
          {CONFETTI.map((style, i) => (
            <i key={i} style={style as CSSProperties} />
          ))}
        </span>
      )}
    </button>
  );
}
