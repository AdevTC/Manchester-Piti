// La pizarra ⇄ la mesa, wired: the «desde la mesa» link (/pizarra?desde=mesa&partido=<id>), the board it
// opens (useBoardSession: the official for an admin, else your copy bound to the match — reused, copied
// from the official, or made from the convocatoria), the match as it is now (the shared matches
// subscription: its lineup, roll call, clock and events — no extra listener) and «Mandar a la mesa»
// (setMatchLineup). The Board gets what it shows: the strip, the dialog, the roll call and the pitch now.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { apiError, setMatchLineup } from "../../../lib/clubApi";
import { useClubData, type ClubMatch } from "../../../lib/clubData";
import { lineupFromBoard, parseMatchLineup, parsePresent, type LineupSlot, type MatchLineup } from "../../../lib/matchLineup";
import { shownMinute } from "../../../lib/partidos";
import { useMatchScorers } from "../../vestuario/live";
import { seedLineup } from "../lineupOps";
import type { BoardSession } from "./useBoardSession";
import type { Squad } from "./model";
import { matchShort, type CalMatch } from "./boards";
import { autoPlace } from "./ops";
import { useMatchClock } from "./useMatchDay";
import { MesaSend, MesaStrip } from "./MesaLink";
import { Icon } from "./icons";
import {
  availableOf,
  changeLine,
  desdeMesaOf,
  fieldCopyName,
  fieldStory,
  mesaDiff,
  mesaState,
  rollOf,
  rollSquad,
  workingCopy,
} from "./mesaLogic";

/** What the Board shows of the mesa (BoardProps.mesa). */
export interface BoardMesa {
  /** «¿Quién ha venido?» for the board's match (null: the roll hasn't been called). */
  roll: ReadonlySet<string> | null;
  /** Under the header: the mesa's state, «Mandar a la mesa», «Volver a la mesa» (null: not shown). */
  strip: ReactNode;
  /** The «Mandar a la mesa» dialog while open. */
  dialog: ReactNode;
  /** Where «Usar este siete como convocatoria» lives (Tableros): «Mandar a la mesa» (null: not offered). */
  tableros: ReactNode;
  /** «Volver a la mesa» (a router link dressed as the board's chips). */
  back: ReactNode;
  /** In play: the pitch now (lineupNow) and its story, for «En el campo ahora» and «Traer aquí». */
  field: { minute: string; lines: string[]; seven: string; lineup: MatchLineup; now: LineupSlot[] } | null;
  /** «Desde la mesa» before kick-off with the roll called, on a board this user edits: a board short of
   *  seven opens «Sugerir siete» by itself (only who came), so the mesa is two taps from its seven. */
  autoSuggest: boolean;
}

const PLAYING = new Set(["first", "halftime", "second"]);
/** setMatchLineup not deployed on this server (an emulator or a backend behind the web). */
const missingCallable = (err: unknown): boolean => {
  const e = err as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === "string" ? e.code : "";
  const msg = typeof e?.message === "string" ? e.message : "";
  return code === "functions/unimplemented" || (code === "functions/not-found" && /^(not[ _-]?found)?$/i.test(msg.trim()));
};

export function useMesaLink(o: {
  session: BoardSession;
  uid: string;
  isAdmin: boolean;
  squad: Squad;
  calendar: CalMatch[];
  now: number;
  /** The season on screen, and how to change it (the match's boards are its season's). */
  seasonId: string;
  onSeason: (id: string) => void;
}): BoardMesa | null {
  const { session, uid, isAdmin, squad } = o;
  const search = useLocation({ select: (l) => l.search as Record<string, unknown> });
  const desde = useMemo(() => desdeMesaOf(search), [search]);
  const matchId = desde.on ? desde.matchId : session.matchId;
  const { matches, loading } = useClubData();
  const raw: ClubMatch | null = (matchId && matches.find((m) => m.id === matchId)) || null;
  const cal = (matchId && o.calendar.find((c) => c.id === matchId)) || null;
  const rawRec = raw as (ClubMatch & { lineup?: unknown; present?: unknown }) | null;
  const lineup = useMemo(() => parseMatchLineup(rawRec?.lineup), [rawRec?.lineup]);
  const present = useMemo(() => parsePresent(rawRec?.present), [rawRec?.present]);
  const roll = useMemo(() => rollOf(present), [present]);
  const phase = raw?.clock?.phase ?? "ready";
  const scorers = useMatchScorers(matchId && !isAdmin ? matchId : undefined);
  const mayDecide = isAdmin || (!!matchId && scorers.data.includes(uid));
  const clockNow = useMatchClock(cal, o.now);

  // ── «desde la mesa»: the match's season on screen (its boards, its official) ──
  const wantSeason = desde.on && typeof raw?.seasonId === "string" && raw.seasonId ? raw.seasonId : null;
  const seasonOk = !!wantSeason && o.seasonId === wantSeason;
  const askedSeason = useRef<string | null>(null);
  const { onSeason } = o;
  useEffect(() => {
    if (!wantSeason || o.seasonId === wantSeason || askedSeason.current === wantSeason) return;
    askedSeason.current = wantSeason;
    onSeason(wantSeason);
  }, [wantSeason, o.seasonId, onSeason]);

  // ── «desde la mesa»: the board to work on (once per match, when the boards are in) ──
  const placed = useRef<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!desde.on || !desde.matchId || !seasonOk || !session.ready || loading || placed.current === desde.matchId) return;
    placed.current = desde.matchId;
    const mId = desde.matchId;
    const all = [...session.mine, ...session.officials];
    const current = session.id ? (all.find((d) => d.id === session.id) ?? null) : null;
    const choice = workingCopy({ matchId: mId, uid, isAdmin, current, officials: session.officials, mine: session.mine });
    const name = fieldCopyName(cal?.j);
    const fail = (err: unknown) => {
      console.error("No se pudo abrir el tablero del partido", err);
      setNotice(apiError(err));
    };
    if (choice.k === "open") session.open(choice.id);
    else if (choice.k === "copy") session.newFor({ matchId: mId, name, from: choice.from }).catch(fail);
    else if (choice.k === "new") {
      // the convocatoria's siete on its spots (who came, once the roll is called), else who came
      const starters = raw?.starters ?? [];
      const pool = availableOf(starters.length ? new Set(starters) : null, roll);
      const L = pool ? autoPlace(seedLineup("2-3-1", []), rollSquad(squad, roll), pool) : seedLineup("2-3-1", []);
      session.newFor({ matchId: mId, name, lineup: L }).catch(fail);
    }
    // (runs once per match: the session's own changes afterwards are the user's)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per match, when the boards are in
  }, [desde.on, desde.matchId, seasonOk, session.ready, loading]);

  // ── «Mandar a la mesa» ──
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ changed: boolean } | null>(null);
  const [sentHere, setSentHere] = useState(false);
  const board = useMemo(() => lineupFromBoard(session.lineup), [session.lineup]);
  const editable = session.ready && !session.readOnly;
  const bound = !!matchId && (desde.on || session.matchId === matchId);
  const canSend = bound && mayDecide && phase === "ready" && !!raw;

  const block = !editable
    ? session.official
      ? "El oficial solo lo cambian los admins: trabaja en tu copia."
      : "Este tablero es de solo lectura."
    : !board
      ? "Faltan jugadores: el siete tiene que estar completo (7 de 7) y sin repetidos."
      : null;
  const name = (id: string) => squad.byId.get(id)?.name ?? "Jugador";
  const rows = open ? mesaDiff({ board, match: lineup, conv: { starters: raw?.starters ?? [], bench: raw?.bench ?? [], notCalled: raw?.notCalled ?? [] }, present, name }) : null;

  const send = async () => {
    if (!matchId || busy || block) return;
    setBusy(true);
    setError(null);
    try {
      const boardId = await session.flush();
      const r = await setMatchLineup({ matchId, boardId });
      setDone({ changed: r.data.changed });
      setSentHere(true);
    } catch (err) {
      console.error("No se pudo mandar el siete a la mesa", err);
      setError(missingCallable(err) ? "La mesa aún no recibe el siete desde la pizarra (falta setMatchLineup en el servidor). Inténtalo más tarde." : apiError(err));
    } finally {
      setBusy(false);
    }
  };
  const openSend = () => {
    setDone(null);
    setError(null);
    setOpen(true);
  };

  const back = matchId ? (
    <Link className="b3 mzs-bk" to="/partidos/$matchId/mesa" params={{ matchId }} aria-label="Volver a la mesa">
      <Icon n="chevL" w={16} />
      <span className="mzs-w">Volver a la mesa</span>
      <span className="mzs-n">Mesa</span>
    </Link>
  ) : null;
  const backGold = matchId ? (
    <Link className="b3 gold" to="/partidos/$matchId/mesa" params={{ matchId }}>
      Volver a la mesa
    </Link>
  ) : null;

  if (!matchId) return null;
  const live = PLAYING.has(phase);
  const state = phase === "ended" ? "fin" : live ? "vivo" : mesaState(board, lineup);
  const showStrip = !!raw && (desde.on || sentHere) && (editable || live || phase === "ended");
  const strip = showStrip ? <MesaStrip state={state} onSend={canSend && editable ? openSend : null} back={back} /> : null;

  const dialog = open ? (
    <MesaSend
      matchShort={cal ? matchShort(cal) : ""}
      rows={block ? null : rows}
      block={notice ?? block}
      hasLineup={!!lineup}
      busy={busy}
      error={error}
      done={done}
      onSend={() => void send()}
      onClose={() => setOpen(false)}
      back={backGold}
    />
  ) : null;

  const tableros =
    canSend && editable && !desde.on ? (
      <button type="button" className="b3 gold" onClick={openSend}>
        Mandar a la mesa
      </button>
    ) : null;

  let field: BoardMesa["field"] = null;
  if (live && lineup && raw) {
    const story = fieldStory(lineup, raw.events ?? []);
    const m = shownMinute({ date: raw.date, duration: raw.duration, clock: raw.clock }, clockNow);
    field = {
      minute: phase === "halftime" ? "Descanso" : m != null ? m + "′" : "—",
      lines: story.changes.map((c) => changeLine(c, name)),
      seven: story.now.map((s) => s.code + " " + name(s.playerId)).join(" · "),
      lineup,
      now: story.now,
    };
  }
  return { roll, strip, dialog, tableros, field, back, autoSuggest: desde.on && !live && !!roll && editable };
}
