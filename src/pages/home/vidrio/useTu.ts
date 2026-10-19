// «Tú»'s data, for a jugador only (a member linked to a player of the squad): his answer to the convocatoria
// still open, his turno, what he owes the caja, the newest poll he hasn't voted, his porra, the next medal to
// chase, the latest notices, and how many things wait on him (the shelf's badge). Every read is an existing
// listener (vestuario/live, useRotaTurns); with `enabled` false nothing is opened.
import { useMemo, useState } from "react";
import type { ClubMatch } from "../../../lib/clubData";
import type { PlayerDoc } from "../../../lib/schemas";
import type { MatchdayModel } from "../../../lib/derived/matchday";
import { kickoffWindow, mvpVoteOpen } from "../../../lib/derived/memberWindows";
import { turnsLine } from "../../../lib/derived/rota";
import { balanceOf } from "../../../lib/derived/caja";
import { cajaOpen, howToPayText, myBalanceText } from "../../../lib/derived/cajaMember";
import { isPollOpen } from "../../../lib/derived/polls";
import { achievements, nextToChase } from "../../../lib/derived/achievements";
import { relativeTime, type Notice } from "../../../lib/derived/notices";
import { nameFor } from "../../../lib/clubData";
import { useMatchTurns } from "../../../lib/useRotaTurns";
import { useAvailability, useCaja, useMvpResults, useMyMvpVote, useMyPrediction, useNotices, usePollVotes, usePolls } from "../../vestuario/live";
import { setAvailability, type Me } from "../../vestuario/writes";
import { pendingCount } from "../hoyModel";

export type Answer = "yes" | "maybe" | "no";

export interface TuData {
  /** The convocatoria he can still answer. */
  rsvp: { match: ClubMatch; value: Answer | null; pick: (a: Answer) => void; busy: boolean; error: string } | null;
  turno: { text: string; mine: boolean } | null;
  caja: { owes: boolean; text: string; how: string } | null;
  poll: { title: string; sub: string; voted: boolean } | null;
  porra: { gf: number; ga: number } | null;
  logro: { label: string; text: string; pct: number } | null;
  notices: { id: string; title: string; when: string; url: string }[];
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

  const owes = !!i.playerId && cajaOpen(caja.settings, caja.movs) && balanceOf(caja.movs, i.playerId) < 0;
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
    turno: line,
    caja: enabled && cajaOpen(caja.settings, caja.movs) && i.playerId ? { owes, text: myBalanceText(balanceOf(caja.movs, i.playerId)), how: howToPayText(caja.settings) } : null,
    poll: open ? { title: open.question, sub: voted ? "Ya has votado." : "Encuesta del vestuario, sin votar todavía.", voted } : null,
    porra: prediction.data ? { gf: prediction.data.goalsFor, ga: prediction.data.goalsAgainst } : null,
    logro,
    notices: enabled ? notices.data.slice(0, 2).map((n: Notice) => ({ id: n.id, title: n.title, when: relativeTime(n.at, now), url: n.url })) : [],
    mvpVote: myVote || null,
    pending: 0,
  };
  data.pending = enabled ? pendingCount({ rsvp: rsvp ? { open: true, answered: !!value } : null, turno: !!line?.mine, caja: owes, polls: open && !voted ? 1 : 0, mvp: voteOpen && !data.mvpVote }) : 0;
  return { ...data, answers: answers.data };
}
