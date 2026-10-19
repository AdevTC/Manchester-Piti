// «Tú»'s data, for a jugador only (a member linked to a player of the squad): his answer to the convocatoria
// still open, his turno, what he owes the caja, the newest poll he hasn't voted, his porra, the next medal to
// chase, the latest notices, and how many things wait on him (the shelf's badge). Every read is an existing
// listener (vestuario/live, useRotaTurns); with `enabled` false nothing is opened.
import { useMemo, useState } from "react";
import type { ClubMatch } from "../../../lib/clubData";
import type { PlayerDoc } from "../../../lib/schemas";
import type { MatchdayModel } from "../../../lib/derived/matchday";
import { kickoffWindow, mvpVoteOpen } from "../../../lib/derived/memberWindows";
import { jobTask, myTurns, turnDone, turnsLine } from "../../../lib/derived/rota";
import { balanceOf, fmtEuros } from "../../../lib/derived/caja";
import { capital } from "../../../lib/derived/words";
import { cajaOpen, howToPayText, myBalanceText } from "../../../lib/derived/cajaMember";
import { isPollOpen } from "../../../lib/derived/polls";
import { achievements, nextToChase } from "../../../lib/derived/achievements";
import { relativeTime, toMillis, unreadCount, type Notice } from "../../../lib/derived/notices";
import { useAuth } from "../../../context/AuthContext";
import { nameFor } from "../../../lib/clubData";
import { useMatchTurns } from "../../../lib/useRotaTurns";
import { useAvailability, useCaja, useMvpResults, useMyCajaClaims, useMyMvpVote, useMyPrediction, useNotices, usePollVotes, usePolls } from "../../vestuario/live";
import { claimPayment, markTurnDone, setAvailability, type Me } from "../../vestuario/writes";
import { pendingCount } from "../hoyModel";

export type Answer = "yes" | "maybe" | "no";

const MONTH = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", month: "long" });
const andTasks = (xs: readonly string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

export interface TuData {
  /** The convocatoria he can still answer. */
  rsvp: { match: ClubMatch; value: Answer | null; pick: (a: Answer) => void; busy: boolean; error: string } | null;
  /** His turno of the match (or the line with everyone's): «Hecho» marks his own done (markTurnDone). */
  turno: {
    text: string;
    mine: boolean;
    /** «Lavar la equipación» (his task, capitalised) when the turn is his. */
    task: string;
    matchId: string | null;
    done: boolean;
    onDone: (() => void) | null;
    busy: boolean;
    error: string;
  } | null;
  /** The caja: «Cuota de octubre, 10,00 €», what he owes and «Ya la he pagado» (a claim the treasurer confirms). */
  caja: {
    owes: boolean;
    text: string;
    how: string;
    title: string;
    /** He has told the treasurer and it isn't confirmed yet. */
    claimed: boolean;
    onClaim: (() => void) | null;
    busy: boolean;
    error: string;
  } | null;
  poll: { title: string; sub: string; voted: boolean } | null;
  porra: { gf: number; ga: number } | null;
  logro: { label: string; text: string; pct: number } | null;
  notices: { id: string; title: string; when: string; url: string }[];
  /** Notices newer than his last look at the bell (users/{uid}.noticesSeenAt). */
  unread: number;
  /** His album of cromos (derived/album; the page fills it: it knows the squad and tonight's seven). */
  album?: { owned: number; total: number; line: string; latest: { id: string; num: string; name: string }[]; unknown: number } | null;
  /** His MVP vote while it is open (null: none yet). */
  mvpVote: string | null;
  pending: number;
}

export interface TuInput {
  enabled: boolean;
  /** A member at all (the convocatoria ornament's answers and the porra are a socio's too). */
  member: boolean;
  me: Me | null;
  admin: boolean;
  playerId: string | null;
  day: MatchdayModel;
  matches: readonly ClubMatch[];
  players: readonly PlayerDoc[];
  seasonId: string;
  seasons: readonly { id: string; name: string }[];
  now: number;
}

export function useTu(i: TuInput): TuData & { answers: ReturnType<typeof useAvailability>["data"] } {
  const { enabled, member, me, day, now } = i;
  const uid = member ? me?.uid : undefined;
  const m = day.match;
  // the convocatoria: the day's match while it still takes answers, else the next one
  const rsvpMatch = useMemo(() => [m, day.next].find((x): x is ClubMatch => !!x && kickoffWindow(x, now) === "open") ?? null, [m, day.next, now]);
  const answers = useAvailability(member ? (rsvpMatch?.id ?? m?.id) : undefined);
  const mine = (uid && answers.data.find((a) => a.uid === uid)?.response) || null;
  const [sent, setSent] = useState<{ id: string; value: Answer } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const value = sent && sent.id === rsvpMatch?.id ? sent.value : (mine as Answer | null);
  const pick = (a: Answer) => {
    if (!me || !rsvpMatch) return;
    setSent({ id: rsvpMatch.id, value: a });
    setBusy(true);
    setError("");
    setAvailability(me, rsvpMatch.id, a)
      .catch(() => {
        setSent(null);
        setError("No se ha guardado tu respuesta. Inténtalo otra vez.");
      })
      .finally(() => setBusy(false));
  };

  // his porra (the day's match), his MVP vote
  const prediction = useMyPrediction(member && m && day.phase !== "pretemporada" && day.phase !== "aplazado" ? m.id : undefined, uid);
  const voteOpen = !!m && mvpVoteOpen(m, now);
  const myVote = useMyMvpVote(member && voteOpen ? m?.id : undefined, uid).data;

  // his turno, the caja, the polls, the notices (jugador only)
  const turnMatch = (m && (day.phase === "semana" || day.phase === "antes" || day.phase === "pitido" || day.phase === "final" || day.phase === "acta") ? m : day.next) ?? undefined;
  const turns = useMatchTurns(turnMatch, i.matches, enabled && !!turnMatch);
  const nameOf = (id: string) => nameFor(i.players.find((p) => p.id === id), i.seasonId);
  const line = enabled ? turnsLine(turns.turns, nameOf, i.playerId) : null;
  const caja = useCaja(i.seasonId, enabled);
  const polls = usePolls(enabled);
  const open = enabled ? polls.data.find((p) => isPollOpen(p, now)) : undefined;
  const votes = usePollVotes(open?.id);
  const notices = useNotices(enabled ? uid : undefined, i.admin);
  const mvpResults = useMvpResults();
  const { profile } = useAuth();

  const balance = i.playerId ? balanceOf(caja.movs, i.playerId) : 0;
  const owesCaja = !!i.playerId && cajaOpen(caja.settings, caja.movs) && balance < 0;

  // «Hecho»: his own turn of the match, marked from here (the backend checks the turn is his)
  const myJobs = enabled ? myTurns(turns.turns, i.playerId) : [];
  const [turnSent, setTurnSent] = useState<{ id: string; busy: boolean; error: string } | null>(null);
  const turnId = turnMatch?.id ?? null;
  const turnHere = turnSent && turnSent.id === turnId ? turnSent : null;
  const turnIsDone = turnDone(turns.pins, uid) || (!!turnHere && !turnHere.busy && !turnHere.error);
  const markDone = () => {
    if (!me || !turnId) return;
    setTurnSent({ id: turnId, busy: true, error: "" });
    markTurnDone(me, turnId).then(
      () => setTurnSent({ id: turnId, busy: false, error: "" }),
      () => setTurnSent({ id: turnId, busy: false, error: "No se ha podido marcar. Inténtalo otra vez." }),
    );
  };

  // «Ya la he pagado»: a claim the treasurer confirms
  const claims = useMyCajaClaims(enabled ? uid : undefined);
  const openClaim = claims.data.some((c) => c.status === "pendiente" && c.seasonId === i.seasonId);
  const [claimSent, setClaimSent] = useState<{ busy: boolean; error: string; ok: boolean } | null>(null);
  const claimed = openClaim || !!claimSent?.ok;
  const owes = owesCaja && !claimed;
  const cuota = caja.settings.cuota;
  const cajaTitle =
    cuota > 0
      ? `Cuota ${caja.settings.cuotaPeriod === "mensual" ? `de ${MONTH.format(now)}` : "de la temporada"}, ${fmtEuros(cuota)}`
      : owesCaja
        ? `La caja: debes ${fmtEuros(-balance)}`
        : "La caja";
  const claim = () => {
    if (!me || !owesCaja) return;
    setClaimSent({ busy: true, error: "", ok: false });
    claimPayment(me, { seasonId: i.seasonId, concept: cajaTitle.replace(/, [^,]+$/, ""), amount: -balance }).then(
      () => setClaimSent({ busy: false, error: "", ok: true }),
      (e: unknown) => setClaimSent({ busy: false, error: e instanceof Error && e.message ? e.message : "No se ha podido avisar. Inténtalo otra vez.", ok: false }),
    );
  };
  const logro = useMemo(() => {
    if (!enabled || !i.playerId) return null;
    const [next] = nextToChase(achievements(i.playerId, [...i.matches], { mvpResults, seasons: i.seasons, now }), 1);
    if (!next?.progress) return null;
    const left = Math.max(0, next.progress.goal - Math.floor(next.progress.now));
    const text = next.family === "debut" ? "Se desbloquea con tu primer partido." : left ? `Llevas ${Math.floor(next.progress.now)} de ${next.progress.goal}.` : "A punto de caer.";
    return { label: `Logro «${next.label}»`, text, pct: Math.round(Math.min(1, next.progress.now / next.progress.goal) * 100) };
  }, [enabled, i.playerId, i.matches, mvpResults, i.seasons, now]);

  const rsvp = enabled && rsvpMatch ? { match: rsvpMatch, value, pick, busy, error } : null;
  const voted = !!open && !!uid && votes.data.some((v) => v.uid === uid);
  const data: TuData = {
    rsvp,
    turno: line
      ? {
          ...line,
          task: myJobs.length ? capital(andTasks(myJobs.map((t) => jobTask(t.job)))) : "",
          matchId: turnId,
          done: line.mine && turnIsDone,
          onDone: line.mine && me?.playerId && !turnIsDone ? markDone : null,
          busy: !!turnHere?.busy,
          error: turnHere?.error ?? "",
        }
      : null,
    caja:
      enabled && cajaOpen(caja.settings, caja.movs) && i.playerId
        ? {
            owes,
            text: myBalanceText(balance),
            how: howToPayText(caja.settings),
            title: cajaTitle,
            claimed: owesCaja && claimed,
            onClaim: owesCaja && !claimed ? claim : null,
            busy: !!claimSent?.busy,
            error: claimSent?.error ?? "",
          }
        : null,
    poll: open ? { title: open.question, sub: voted ? "Ya has votado." : "Encuesta del vestuario, sin votar todavía.", voted } : null,
    porra: prediction.data ? { gf: prediction.data.goalsFor, ga: prediction.data.goalsAgainst } : null,
    logro,
    notices: enabled ? notices.data.slice(0, 2).map((n: Notice) => ({ id: n.id, title: n.title, when: relativeTime(n.at, now), url: n.url })) : [],
    unread: enabled ? unreadCount(notices.data, toMillis(profile?.noticesSeenAt)) : 0,
    mvpVote: myVote || null,
    pending: 0,
  };
  data.pending = enabled ? pendingCount({ rsvp: rsvp ? { open: true, answered: !!value } : null, turno: !!line?.mine && !turnIsDone, caja: owes, polls: open && !voted ? 1 : 0, mvp: voteOpen && !data.mvpVote }) : 0;
  return { ...data, answers: answers.data };
}
