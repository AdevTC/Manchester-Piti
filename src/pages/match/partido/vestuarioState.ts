// «El partido» · the vestuario's state for the page (P- boards, place-vestuario.js): the team's own data for this
// match as the rules let the signed-in member read it (his answer and everyone's counts, his porra and — once it
// kicked off — the team's, the MVP turnout or tally and his vote, the notas, his share of la caja, the turnos,
// the quedada, the ausentes), the screen's own little state (what is being changed, the porra being written,
// «Ver todo»), the writes, and from all that what he still has to do: the tab's badge and its second line.
// MatchPage calls it every render (the tab needs it on every screen); ScreenVestuario draws it from `v`.
// (DEV: `?quien=` changes only who the page draws; the reads and writes stay the signed-in test member's.)
import { useMemo, useState } from "react";
import { useClubData, dateMillis, type ClubMatch } from "../../../lib/clubData";
import { useClock } from "../../../hooks/useClock";
import { useMatchTurns } from "../../../lib/useRotaTurns";
import { turnDone as isTurnDone, type Turn } from "../../../lib/derived/rota";
import { balances, type CajaMov } from "../../../lib/derived/caja";
import { covers, madridDate, matchDay, type Absence } from "../../../lib/derived/absences";
import { ratingWindow, type RatingDoc, type RatingWindow } from "../../../lib/derived/trasElPartido";
import { kickoffWindow } from "../../../lib/derived/memberWindows";
import { predictionOpen, predictionsRevealed, scorePrediction, type Prediction } from "../../../../functions/src/predictions";
import type { MvpResult } from "../../../lib/vestuario";
import type { CajaClaim } from "../../../lib/derived/cajaClaims";
import { usePorraCount, useAbsences, useAvailability, useCaja, useMatchPredictions, useMatchRatings, useMeetingNote, useMvpResults, useMyCajaClaims, useMyMvpVote, useMyPrediction, type Availability } from "../../vestuario/live";
import { addAbsence, claimPayment, deleteAbsence, markTurnDone, predictScore, rateMatch, setAvailability, unrateMatch, useMe, voteMvp, type Me } from "../../vestuario/writes";
import { unclaimPayment } from "./vestuarioWrites";
import type { Person, Viewer } from "./ctx";
import { isDone, isLive, isPre, scoreAt, type Fase, type Play, type Score } from "./model";
import { badgeTextOf, goalsOf, hintOf, tasksOf, verdict, verdictWord, type Task, type TeamPick, type Who } from "./vestuarioModel";

export interface VestuarioInput {
  fase: Fase;
  viewer: Viewer;
  minute: number;
  edge: number;
  score: Score;
  plays: Play[];
  people: Map<string, Person>;
}

/** The screen's own state (the board's ves_*), kept per match. */
export interface VesUi {
  rsvpEdit: boolean;
  porraEdit: boolean;
  /** The porra being written (null: the saved one's). */
  gf: number | null;
  ga: number | null;
  scorer: string | null;
  assist: string | null;
  rules: boolean;
  mvpEdit: boolean;
  mvpPick: string | null;
  notaEdit: boolean;
  more: boolean;
}
const UI0: VesUi = { rsvpEdit: false, porraEdit: false, gf: null, ga: null, scorer: null, assist: null, rules: false, mvpEdit: false, mvpPick: null, notaEdit: false, more: false };

export type Answer = "yes" | "maybe" | "no";
export interface MyPorra {
  gf: number;
  ga: number;
  /** The goleador of the first goal (the board picks one for all of them), "" without one. */
  scorer: string;
  assist: string;
  /** Every goleador picked (a porra written goal by goal elsewhere may name several). */
  scorers: string[];
}
export interface CajaShare {
  /** His share of the match (cents). */
  fee: number;
  /** How many of those charged for the match are square, of how many. */
  paid: number;
  of: number;
  /** He owes the caja. */
  owes: boolean;
  /** His «Ya la he pagado» still waiting for a captain. */
  claim: CajaClaim | null;
}

export interface VesData {
  /** Reads are open: a member of the vestuario is signed in. */
  on: boolean;
  me: Me | null;
  uid: string | null;
  who: Who;
  answers: Availability[];
  myAnswer: Answer | null;
  rsvpOpen: boolean;
  porraOpen: boolean;
  porra: MyPorra | null;
  porraLoading: boolean;
  /** The team's porras (only once the match kicked off: the rules), with their points once it is done. */
  picks: TeamPick[];
  /** How many porras the team has (the server's count; null until counted). */
  porraCount: number | null;
  /** The players a goleador can be (the season's active squad, the convocados first). */
  candidates: string[];
  mvp: MvpResult | undefined;
  voteOpen: boolean;
  myVote: string;
  /** The MVP once the vote closed (ties share it). */
  winners: string[];
  ratings: RatingDoc[];
  nota: RatingWindow;
  myNota: number | null;
  caja: CajaShare | null;
  turns: Turn[];
  turnDone: boolean;
  meetingNote: string;
  /** The absences that cover the match's day. */
  absences: Absence[];
  myAbsence: Absence | null;
  /** The match's Madrid day (YYYY-MM-DD). */
  day: string;
  now: number;
  /** His porra points with the acta. */
  porraPoints: number | null;
}

export interface VestuarioState {
  /** The tab's second line (long, short). */
  hint: [string, string];
  /** Things the viewer still has to do (the tab's badge). */
  badge: number;
  /** «2 cosas pendientes: votar al MVP y la nota». */
  badgeText: string;
  tasks: Task[];
  d: VesData;
  ui: VesUi;
  set: (patch: Partial<VesUi>) => void;
  /** Whether each control is being changed (the board's «editing»), from the data and the ui. */
  editing: { rsvp: boolean; porra: boolean; ballot: boolean; nota: boolean };
  /** The porra in the form (the draft over the saved one). */
  draft: { gf: number; ga: number; scorer: string; assist: string; changed: boolean; valid: boolean; busy: boolean };
  /** The live verdict of his porra at the moviola's minute (null without one). */
  livePorra: { word: string; v: ReturnType<typeof verdict> } | null;
  act: {
    rsvp: (a: Answer) => Promise<void>;
    savePorra: () => Promise<void>;
    vote: () => Promise<void>;
    rate: (n: number) => Promise<void>;
    unrate: () => Promise<void>;
    pay: () => Promise<void>;
    unpay: () => Promise<void>;
    toggleTurn: () => Promise<boolean>;
    warn: () => Promise<void>;
    unwarn: () => Promise<void>;
  };
}

const samePorra = (a: Prediction | null | undefined, b: Prediction | null | undefined) => !!a && !!b && a.goalsFor === b.goalsFor && a.goalsAgainst === b.goalsAgainst && JSON.stringify(a.goals ?? []) === JSON.stringify(b.goals ?? []);
const mine = (p: Prediction | null): MyPorra | null => {
  if (!p) return null;
  const g = p.goals ?? [];
  const scorers = [...new Set(g.map((x) => x.playerId).filter(Boolean))];
  return { gf: p.goalsFor, ga: p.goalsAgainst, scorer: g[0]?.playerId ?? "", assist: g[0]?.assistPlayerId ?? "", scorers };
};
const noMe = () => Promise.reject(new Error("Entra en el vestuario para hacerlo."));

export function useVestuario(match: ClubMatch | null, input: VestuarioInput): VestuarioState {
  const { fase, viewer } = input;
  const { matches, players } = useClubData();
  const now = useClock(30_000);
  const me = useMe();
  const id = match?.id;
  const on = viewer.member && !!me && !!match;
  const isMesa = viewer.member && viewer.anotador;
  const who: Who = { member: viewer.member, isJ: viewer.member && !!viewer.playerId && !isMesa, isMesa };
  const pre = isPre(fase);
  const done = isDone(fase);
  const uid = me?.uid ?? null;

  // ---- the screen's state, per match
  const [st, setSt] = useState<{ id: string | undefined; ui: VesUi }>({ id, ui: UI0 });
  const ui = st.id === id ? st.ui : UI0;
  const set = (patch: Partial<VesUi>) => setSt((s) => ({ id, ui: { ...(s.id === id ? s.ui : UI0), ...patch } }));

  // ---- ¿Vas?
  const answers = useAvailability(on ? id : undefined);
  const myAnswer = ((uid && answers.data.find((a) => a.uid === uid)?.response) || null) as Answer | null;
  // (the moment decides: «antes» is a scheduled match before its date — the rules' upcoming())
  const rsvpOpen = !!match && fase === "antes" && kickoffWindow(match, dateMillis(match.date) - 1) === "open";

  // ---- the porra (his own; the team's once it kicked off)
  const pred = useMyPrediction(on ? id : undefined, uid ?? undefined);
  const [sent, setSent] = useState<{ id: string | undefined; p: Prediction; base: Prediction | null } | null>(null);
  const savedPred = sent && sent.id === id && pred.data === sent.base && !samePorra(pred.data, sent.p) ? sent.p : pred.data;
  const porra = mine(savedPred);
  const porraOpen = !!match && pre && viewer.member && predictionOpen(match);
  const revealed = !!match && !pre && predictionsRevealed(match);
  const team = useMatchPredictions(id, on && revealed);
  const result = { goalsFor: match?.goalsFor ?? input.score.us, goalsAgainst: match?.goalsAgainst ?? input.score.them };
  const events = useMemo(() => match?.events ?? [], [match?.events]);
  const picks: TeamPick[] = useMemo(
    () => (revealed ? team.data.map((p) => ({ uid: p.uid, name: p.name, gf: p.goalsFor, ga: p.goalsAgainst, ...(done ? { points: scorePrediction(p, result, events).total } : {}) })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- result is two numbers from the match
    [revealed, team.data, done, result.goalsFor, result.goalsAgainst, events],
  );
  // (the count, never the porras: they stay private until the whistle)
  const counted = usePorraCount(on ? id : undefined);
  const porraCount = revealed ? picks.length : counted;
  const porraPoints = done && savedPred ? scorePrediction(savedPred, result, events).total : null;
  const candidates = useMemo(() => {
    if (!match?.seasonId) return [];
    const ok = players.filter((p) => p.active !== false && !p.archived && p.seasons?.includes(match.seasonId ?? ""));
    const okIds = new Set(ok.map((p) => p.id));
    const called = [...(match.starters ?? []), ...(match.bench ?? [])].filter((x, i, a) => okIds.has(x) && a.indexOf(x) === i);
    if (called.length) return called;
    const nm = (x: string) => input.people.get(x)?.name ?? x;
    return [...okIds].sort((a, b) => nm(a).localeCompare(nm(b), "es"));
  }, [match, players, input.people]);

  // ---- the MVP
  const mvpAll = useMvpResults();
  const mvp = id ? mvpAll.get(id) : undefined;
  const voteOpen = fase === "acta";
  const myVote = useMyMvpVote(on && done ? id : undefined, uid ?? undefined).data;
  const winners = useMemo(() => {
    if (voteOpen || !mvp?.total) return [];
    const counts = mvp.counts ?? {};
    const top = Math.max(0, ...Object.values(counts));
    return top > 0 ? Object.keys(counts).filter((k) => counts[k] === top) : [];
  }, [voteOpen, mvp]);

  // ---- the nota (public)
  const ratings = useMatchRatings(done ? id : undefined);
  const nota: RatingWindow = match && done ? ratingWindow(match, now) : { state: "none" };
  const myNota = (uid && ratings.data.find((r) => r.uid === uid)?.score) || null;

  // ---- la caja: his share of the match (a jugador)
  const cajaOn = on && who.isJ && !!match?.seasonId && fase !== "aplazado";
  const caja = useCaja(match?.seasonId, cajaOn);
  const claims = useMyCajaClaims(cajaOn ? (uid ?? undefined) : undefined);
  const cajaShare = useMemo((): CajaShare | null => {
    if (!cajaOn || !id) return null;
    const cargos = caja.movs.filter((m: CajaMov) => !m.void && m.kind === "cargo" && m.matchId === id && !!m.playerId);
    const mineC = cargos.find((m) => m.playerId === viewer.playerId);
    if (!mineC) return null;
    const bal = balances(caja.movs);
    const ids = [...new Set(cargos.map((m) => m.playerId as string))];
    const claim = claims.data.find((c) => c.status === "pendiente" && c.seasonId === match?.seasonId && c.concept === mineC.concept) ?? null;
    return { fee: mineC.amount, paid: ids.filter((x) => (bal.get(x) ?? 0) >= 0).length, of: ids.length, owes: (bal.get(mineC.playerId as string) ?? 0) < 0, claim };
  }, [cajaOn, id, caja.movs, claims.data, viewer.playerId, match?.seasonId]);
  const cajaConcept = useMemo(() => caja.movs.find((m) => !m.void && m.kind === "cargo" && m.matchId === id && m.playerId === viewer.playerId)?.concept ?? "", [caja.movs, id, viewer.playerId]);

  // ---- turnos, the quedada, the ausentes
  const turnsOn = on && (who.isJ || who.isMesa) && fase !== "aplazado";
  const turns = useMatchTurns(match ?? undefined, matches, turnsOn);
  const [turnSent, setTurnSent] = useState<{ id: string | undefined; done: boolean } | null>(null);
  const turnDone = turnSent && turnSent.id === id ? turnSent.done : isTurnDone(turns.pins, uid);
  const meeting = useMeetingNote(on ? id : undefined);
  const kick = match ? dateMillis(match.date) : NaN;
  const day = matchDay(kick);
  const abs = useAbsences(madridDate(now), on && fase === "antes" && !!day);
  const absences = useMemo(() => (day ? abs.data.filter((a) => covers(a, day)) : []), [abs.data, day]);
  const myAbsence = (uid && absences.find((a) => a.uid === uid)) || null;

  // ---- what is being changed
  const rsvpEditing = who.isJ && rsvpOpen && (!myAnswer || ui.rsvpEdit);
  const porraEditing = porraOpen && !pred.loading && (!porra || ui.porraEdit);
  const ballotable = voteOpen && viewer.member && !!match?.ledger && Object.entries(match.ledger).some(([k, r]) => r.played && !k.startsWith("guest:"));
  const ballot = ballotable && (!myVote || ui.mvpEdit);
  const notaEditing = done && viewer.member && nota.state === "open" && (!myNota || ui.notaEdit);
  const cajaTask = who.isJ && !!cajaShare && cajaShare.owes && !cajaShare.claim;

  const gf = ui.gf ?? porra?.gf ?? 0;
  const ga = ui.ga ?? porra?.ga ?? 0;
  const scorer = gf > 0 ? (ui.scorer ?? porra?.scorer ?? "") : "";
  const assist = gf > 0 ? (ui.assist ?? porra?.assist ?? "") : "";
  const changed = !porra || gf !== porra.gf || ga !== porra.ga || scorer !== porra.scorer || (assist !== scorer ? assist : "") !== porra.assist;
  const valid = gf === 0 || !!scorer;
  const [busy, setBusy] = useState(false);

  // ---- the live porra (and before the acta)
  const ended = fase === "final";
  const v = porra && (isLive(fase) || ended) ? verdict(porra, ended ? scoreAt(input.plays, input.edge) : input.score) : null;
  const livePorra = v ? { word: verdictWord(v, ended), v } : null;

  const tasks = tasksOf(fase, who, { rsvp: rsvpEditing, porra: porraEditing, caja: cajaTask, mvp: ballot, nota: notaEditing });
  const winnerName = winners.length ? winners.map((w) => input.people.get(w)?.name ?? "Jugador").join(" y ") : null;

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    await fn();
  };
  const act: VestuarioState["act"] = {
    rsvp: (a) => (me && id ? run(() => setAvailability(me, id, a)).then(() => set({ rsvpEdit: false })) : noMe()),
    savePorra: async () => {
      if (!me || !id) return noMe();
      if (!changed || !valid || busy) return;
      const p: Prediction = { goalsFor: gf, goalsAgainst: ga, goals: goalsOf(gf, scorer, assist) };
      setBusy(true);
      try {
        await predictScore(me, id, gf, ga, p.goals ?? []);
        setSent({ id, p, base: pred.data });
        set({ porraEdit: false, gf: null, ga: null, scorer: null, assist: null });
      } finally {
        setBusy(false);
      }
    },
    vote: () => {
      const pick = ui.mvpPick ?? myVote;
      if (!me || !id) return noMe();
      if (!pick || pick === myVote) return Promise.resolve();
      return run(() => voteMvp(me, id, pick)).then(() => set({ mvpEdit: false, mvpPick: null }));
    },
    rate: (n) => (me && id ? run(() => rateMatch(me, id, n)).then(() => set({ notaEdit: false })) : noMe()),
    unrate: () => (me && id ? run(() => unrateMatch(me, id)).then(() => set({ notaEdit: false })) : noMe()),
    pay: () => (me && match?.seasonId && cajaShare ? run(() => claimPayment(me, { seasonId: match.seasonId ?? "", concept: cajaConcept, amount: cajaShare.fee })) : noMe()),
    unpay: () => (cajaShare?.claim ? run(() => unclaimPayment(cajaShare.claim!.id)) : noMe()),
    toggleTurn: async () => {
      if (!me || !id) return noMe();
      const next = !turnDone;
      const r = await markTurnDone(me, id, next);
      setTurnSent({ id, done: r });
      return r;
    },
    warn: () => (me && day ? run(() => addAbsence(me, day, day, "")) : noMe()),
    unwarn: () => (myAbsence ? run(() => deleteAbsence(myAbsence.id)) : noMe()),
  };

  const d: VesData = {
    on,
    me,
    uid,
    who,
    answers: answers.data,
    myAnswer,
    rsvpOpen,
    porraOpen,
    porra,
    porraLoading: pred.loading,
    picks,
    porraCount,
    candidates,
    mvp,
    voteOpen,
    myVote,
    winners,
    ratings: ratings.data,
    nota,
    myNota,
    caja: cajaShare,
    turns: turnsOn ? turns.turns : [],
    turnDone,
    meetingNote: meeting.data,
    absences,
    myAbsence,
    day,
    now,
    porraPoints,
  };

  return {
    hint: hintOf(fase, who, tasks, livePorra, fase === "despues" ? winnerName : null),
    badge: viewer.member ? tasks.length : 0,
    badgeText: badgeTextOf(tasks),
    tasks,
    d,
    ui,
    set,
    editing: { rsvp: rsvpEditing, porra: porraEditing, ballot, nota: notaEditing },
    draft: { gf, ga, scorer, assist, changed, valid, busy },
    livePorra,
    act,
  };
}
