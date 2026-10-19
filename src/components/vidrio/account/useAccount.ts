// «Tú»'s data for the avatar's sheet (a jugador: a member linked to a player of the squad; a socio gets his porra).
// Every read is an existing listener (vestuario/live, useRotaTurns, the club's matches and players); with
// `jugador` false only the socio's porra is opened. Writes are the existing ones (setAvailability, votePoll).
import { useMemo, useState } from "react";
import { nameFor, useClubData, type ClubMatch } from "../../../lib/clubData";
import { useClock } from "../../../hooks/useClock";
import { useAuth } from "../../../context/AuthContext";
import { useSeason } from "../../../context/SeasonContext";
import { kickoffWindow } from "../../../lib/derived/memberWindows";
import { turnsLine } from "../../../lib/derived/rota";
import { balanceOf } from "../../../lib/derived/caja";
import { cajaOpen, myBalanceText } from "../../../lib/derived/cajaMember";
import { isPollOpen } from "../../../lib/derived/polls";
import { achievements, nextToChase } from "../../../lib/derived/achievements";
import { useMatchTurns } from "../../../lib/useRotaTurns";
import { dateMillis, isVisibleMatch } from "../../../../functions/src/matchEngine";
import { parseMatchLineup } from "../../../lib/matchLineup";
import { firstName } from "../../celeste/accountSignal";
import { useAvailability, useCaja, useMvpResults, useMyPrediction, usePollVotes, usePolls } from "../../../pages/vestuario/live";
import { setAvailability, useMe, votePoll } from "../../../pages/vestuario/writes";
import { headLine, jornadaOf, porraLine, rsvpQuestion, rsvpSub, tonightLine, tonightMatch } from "./accountModel";

export type Answer = "yes" | "maybe" | "no";

export interface AccountData {
  name: string;
  /** The jugador's shirt number and armband, for the head. */
  number: number | null;
  captain: boolean;
  line: string;
  tonight: { text: string; live: boolean } | null;
  rsvp: { question: string; sub: string; value: Answer | null; pick: (a: Answer) => void; busy: boolean; error: string } | null;
  porra: string | null;
  turno: { title: string; text: string } | null;
  poll: { title: string; options: { id: string; label: string; n: number; pct: number; mine: boolean }[]; pick: (id: string) => void; error: string } | null;
  logro: string | null;
  caja: { owes: boolean; text: string } | null;
}

export function useAccount(jugador: boolean): AccountData {
  const now = useClock(30_000);
  const { matches, players } = useClubData();
  const { seasons, selectedSeasonId } = useSeason();
  const { profile } = useAuth();
  const me = useMe();
  const uid = me?.uid;
  const playerId = jugador ? (me?.playerId ?? null) : null;
  const player = playerId ? (players.find((p) => p.id === playerId) ?? null) : null;

  const tonight = useMemo(() => tonightMatch(matches, now), [matches, now]);
  const seasonId = tonight?.seasonId ?? (selectedSeasonId !== "all" ? selectedSeasonId : (seasons[0]?.id ?? ""));
  // (the armband: the match's own captain, else the season's — the rule Inicio's siete uses)
  const captainId = (tonight as (ClubMatch & { captainId?: string }) | null)?.captainId ?? seasons.find((s) => s.id === seasonId)?.captainPlayerId ?? null;
  const captain = !!playerId && captainId === playerId;
  const slotCode = tonight && playerId ? (parseMatchLineup((tonight as { lineup?: unknown }).lineup)?.slots.find((s) => s.playerId === playerId)?.code ?? null) : null;

  // the convocatoria still open: the earliest upcoming match that takes answers
  const rsvpMatch = useMemo<ClubMatch | null>(
    () =>
      matches
        .filter((m) => isVisibleMatch(m) && kickoffWindow(m, now) === "open")
        .sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0] ?? null,
    [matches, now],
  );
  const answers = useAvailability(jugador ? rsvpMatch?.id : undefined);
  const mine = (uid && answers.data.find((a) => a.uid === uid)?.response) || null;
  const [sent, setSent] = useState<{ id: string; value: Answer } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const value = sent && sent.id === rsvpMatch?.id ? sent.value : (mine as Answer | null);
  const squad = players.filter((p) => !(p as { archived?: boolean }).archived).length;

  // the porra of tonight's match (a socio's too)
  const porraMatch = tonight ?? rsvpMatch;
  const prediction = useMyPrediction(porraMatch?.id, uid);

  // turno, caja, poll, the next medal (jugador only)
  const turnMatch = tonight ?? rsvpMatch ?? undefined;
  const turns = useMatchTurns(turnMatch, matches, jugador && !!turnMatch);
  const nameOf = (id: string) => nameFor(players.find((p) => p.id === id), seasonId);
  const turn = jugador ? turnsLine(turns.turns, nameOf, playerId) : null;
  const caja = useCaja(seasonId, jugador);
  const polls = usePolls(jugador);
  const open = jugador ? polls.data.find((p) => isPollOpen(p, now)) : undefined;
  const votes = usePollVotes(open?.id);
  const [pollError, setPollError] = useState("");
  const mvpResults = useMvpResults();
  const logro = useMemo(() => {
    if (!jugador || !playerId) return null;
    const [next] = nextToChase(achievements(playerId, [...matches], { mvpResults, seasons, now }), 1);
    if (!next?.progress) return null;
    const left = Math.max(0, next.progress.goal - Math.floor(next.progress.now));
    return next.family === "debut" ? `«${next.label}» se desbloquea con tu primer partido.` : left ? `«${next.label}»: llevas ${Math.floor(next.progress.now)} de ${next.progress.goal}.` : `«${next.label}», a punto de caer.`;
  }, [jugador, playerId, matches, mvpResults, seasons, now]);

  const name = firstName(profile?.nickname ?? me?.name ?? "");
  const tonightText = jugador && tonight && playerId ? tonightLine(tonight, playerId, now, captain) : null;
  const waitingActa = !!tonight && tonight.status !== "finished" && !!tonightText && /Jugaste|campo|jugado/.test(tonightText);
  const counts = new Map<string, number>();
  for (const v of votes.data) for (const o of v.optionIds) counts.set(o, (counts.get(o) ?? 0) + 1);
  const total = votes.data.length;
  const myVote = votes.data.find((v) => v.uid === uid)?.optionIds ?? [];

  return {
    name,
    number: player?.number ?? null,
    captain,
    line: jugador ? headLine(player, captain, slotCode) : "Socio del club, sin ficha de jugador",
    tonight: tonightText ? { text: tonightText, live: true } : null,
    rsvp:
      jugador && rsvpMatch
        ? {
            question: rsvpQuestion(rsvpMatch),
            sub: rsvpSub(jornadaOf(matches, rsvpMatch), rsvpMatch, answers.data.length, squad),
            value,
            busy,
            error,
            pick: (a) => {
              if (!me) return;
              setSent({ id: rsvpMatch.id, value: a });
              setBusy(true);
              setError("");
              setAvailability(me, rsvpMatch.id, a)
                .catch(() => {
                  setSent(null);
                  setError("No se ha guardado tu respuesta. Inténtalo otra vez.");
                })
                .finally(() => setBusy(false));
            },
          }
        : null,
    porra: porraMatch ? porraLine(prediction.data ? { gf: prediction.data.goalsFor, ga: prediction.data.goalsAgainst } : null, tonight, now) : null,
    turno: turn ? { title: turn.mine ? "Tu turno" : "Turnos de la jornada", text: turn.mine ? `${turn.text.replace(/^Te toca: /, "Te toca ")}.` : turn.text } : null,
    poll: open
      ? {
          title: open.question,
          error: pollError,
          options: open.options.map((o) => {
            const n = counts.get(o.id) ?? 0;
            return { id: o.id, label: o.label, n, pct: total ? Math.round((n / total) * 100) : 0, mine: myVote.includes(o.id) };
          }),
          pick: (id) => {
            if (!me) return;
            setPollError("");
            const next = open.multi ? (myVote.includes(id) ? myVote.filter((x) => x !== id) : [...myVote, id]) : [id];
            votePoll(me, open, next).catch(() => setPollError("No se ha guardado tu voto. Inténtalo otra vez."));
          },
        }
      : null,
    logro: waitingActa ? "Hay un logro esperando al acta de esta noche." : logro,
    caja: jugador && playerId && cajaOpen(caja.settings, caja.movs) ? { owes: balanceOf(caja.movs, playerId) < 0, text: myBalanceText(balanceOf(caja.movs, playerId)) } : null,
  };
}
