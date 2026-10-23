// Avisos' data (the bell, «Tú», /avisos and /avisos/a-medida): the viewer's notices and what he has read, «Te
// toca» from the real open things (the next convocatoria unanswered, the MVP vote open with who played, an open
// poll, his turno, a captain's door), each tied to its notice when there is one, the stacks by match, this
// device (its state, preset, pause and silenced matches). Every read is an existing listener; every write an
// existing one (setAvailability, voteMvp, votePoll, markTurnDone) plus the read state (lib/noticeReads). The
// DEV maqueta (?quien, ?movil, ?bandeja) is honoured here.
import { useMemo, useState, useSyncExternalStore } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useViewer } from "../../../hooks/useViewer";
import { useClock } from "../../../hooks/useClock";
import { nameFor, useClubData, type ClubMatch } from "../../../lib/clubData";
import { toMillis, type Notice } from "../../../lib/derived/notices";
import { kickoffWindow, mvpCandidates, mvpVoteOpen } from "../../../lib/derived/memberWindows";
import { isPollOpen, type Poll } from "../../../lib/derived/polls";
import { rotaNotice, turnDone } from "../../../lib/derived/rota";
import { matchMarks, durationOf, type MatchMark } from "../../../lib/derived/vidrio/matchMarks";
import { useMatchTurns } from "../../../lib/useRotaTurns";
import { useNoticeReads, type NoticeReads } from "../../../lib/noticeReads";
import { pushChoiceKey, pushChoiceOf, subscribePushChoice, type Topic } from "../../../lib/push";
import { scoreOf } from "../../../lib/partidos";
import { dateMillis, isVisibleMatch, matchPhase } from "../../../../functions/src/matchEngine";
import { readTuMaqueta } from "../../../components/vidrio/tu/maqueta";
import type { TuIconName } from "../../../components/vidrio/tu/ui";
import { useAvailability, useDoorRequests, useMvpResults, useMyMvpVote, useMyClaim, useNotices, usePolls, usePollVotes } from "../../vestuario/live";
import { markTurnDone, setAvailability, useMe, voteMvp, votePoll } from "../../vestuario/writes";
import { jornadaOf, rsvpQuestion } from "../../../components/vidrio/account/accountModel";
import { feedOf, matchOf, mvpBody, noticesFor, resOf, rivalIni, rsvpBody, stackSummary, stacksOf, timelineAlt, untilDay, viewerOf, whenLine, ANSWERED, type Answer, type Res, type Viewer } from "./model";

interface PendBase {
  key: string;
  /** The notices this item stands for (answered: they turn read; the feed doesn't show them again). */
  noticeIds: string[];
  title: string;
  body: string;
  icon: TuIconName;
  done: boolean;
  gold?: boolean;
  /** The line under it once answered. */
  after: string;
  error: string;
}
export interface MvpCand {
  id: string;
  name: string;
  num: string;
  min: number;
  on: boolean;
}
export type Pend =
  | (PendBase & { kind: "rsvp"; value: Answer | null; busy: boolean; pick: (a: Answer) => Promise<void> })
  | (PendBase & { kind: "mvp"; cands: MvpCand[]; matchJ: number | null; pick: (id: string) => Promise<void> })
  | (PendBase & { kind: "poll"; opts: { id: string; label: string; n: number; pct: number; on: boolean }[]; pick: (id: string) => Promise<void> })
  | (PendBase & { kind: "turno"; busy: boolean; mark: () => Promise<void> })
  | (PendBase & { kind: "door"; path: string });

export interface StackView {
  matchId: string;
  j: number | null;
  rival: string;
  ini: string;
  title: string;
  res: Res;
  gf: number;
  ga: number;
  when: string;
  sum: string;
  marks: MatchMark[];
  dur: number;
  alt: string;
  rows: Notice[];
}

export interface NextMatch {
  id: string;
  j: number | null;
  at: number;
  home: boolean | null;
  rival: string;
  dur: number;
}

export interface Inbox {
  viewer: Viewer;
  member: boolean;
  uid: string | undefined;
  now: number;
  loading: boolean;
  failed: boolean;
  list: Notice[];
  reads: NoticeReads;
  unread: number;
  pends: Pend[];
  openPend: number;
  feed: Notice[];
  stacks: StackView[];
  loose: Notice[];
  stackOf: (matchId: string) => StackView | undefined;
  next: NextMatch | null;
  /** This device's topics and its per-match overrides (lib/push). */
  topics: Topic[];
  muted: string[];
  matchName: (matchId: string) => string;
}

const NO_NOTICES: Notice[] = [];

/** The open things a viewer answers in place, newest first in the board's order: convocatoria, door, poll, turno, MVP. */
export function useInbox(): Inbox {
  const maq = readTuMaqueta();
  const { user, profile } = useAuth();
  const real = useViewer();
  const claim = useMyClaim(real.member && !real.playerId ? user?.uid : undefined);
  const pendingClaim = claim.data?.status === "pending";
  const quien = maq?.quien ?? null;
  const v = viewerOf({ ...real, pendingClaim }, quien);
  // (one object while who looks stays the same: the lists below are memoised on it)
  const viewer = useMemo<Viewer>(() => ({ who: v.who, captain: v.captain }), [v.who, v.captain]);
  const member = viewer.who !== "fan";
  const uid = member ? user?.uid : undefined;
  const now = useClock(30_000);
  const me = useMe();
  const { matches, players } = useClubData();

  // ---------- the notices and what he has read
  const notices = useNotices(uid, real.admin);
  const bandeja = maq?.bandeja ?? null;
  const list = useMemo(() => (bandeja === "vacia" || bandeja === "cargando" || bandeja === "error" || !member ? NO_NOTICES : noticesFor(notices.data, viewer)), [bandeja, member, notices.data, viewer]);
  const loading = member && (bandeja === "cargando" || (bandeja === null && notices.loading && !notices.data.length));
  const failed = member && (bandeja === "error" || (bandeja === null && !!notices.error && !notices.data.length));
  // (the list the read marks are kept against: none while it loads or failed — an empty one would drop every mark)
  const readList = member && bandeja === null && !notices.loading && !notices.error ? list : null;
  const reads = useNoticeReads(uid, readList, toMillis(profile?.noticesSeenAt));

  // ---------- the matches
  const visible = useMemo(() => matches.filter(isVisibleMatch).sort((a, b) => dateMillis(a.date) - dateMillis(b.date)), [matches]);
  const byId = useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches]);
  const nextMatch = visible.find((m) => ["scheduled", "playing"].includes(matchPhase(m, now))) ?? null;
  const next: NextMatch | null = nextMatch ? { id: nextMatch.id, j: jornadaOf(matches, nextMatch), at: dateMillis(nextMatch.date), home: nextMatch.home ?? null, rival: nextMatch.rival?.trim() || "el rival", dur: durationOf(nextMatch) } : null;
  const nameOf = (id: string, seasonId?: string) => nameFor(players.find((p) => p.id === id), seasonId);
  const numOf = (id: string) => {
    const n = players.find((p) => p.id === id)?.number;
    return n != null ? String(n) : "";
  };

  // ---------- «Te toca»
  const jugador = viewer.who === "jugador";
  const playerId = jugador ? (me?.playerId ?? null) : null;
  // the convocatoria: the earliest upcoming match that still takes answers
  const rsvpMatch = jugador ? (visible.find((m) => kickoffWindow(m, now) === "open") ?? null) : null;
  const answers = useAvailability(rsvpMatch?.id);
  const [sent, setSent] = useState<{ id: string; value: Answer } | null>(null);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [rsvpErr, setRsvpErr] = useState("");
  const mine = ((uid && answers.data.find((a) => a.uid === uid)?.response) || null) as Answer | null;
  const rsvpValue = sent && sent.id === rsvpMatch?.id ? sent.value : mine;
  const squad = players.filter((p) => !(p as { archived?: boolean }).archived).length;

  // the MVP: the newest finished match whose vote is still open
  const mvpMatch = member ? ([...visible].reverse().find((m) => mvpVoteOpen(m, now)) ?? null) : null;
  const myMvp = useMyMvpVote(mvpMatch?.id, uid);
  const mvpResults = useMvpResults();
  const [mvpSent, setMvpSent] = useState<{ id: string; pick: string } | null>(null);
  const [mvpErr, setMvpErr] = useState("");

  // the poll: the first one open
  const polls = usePolls(member);
  const poll: Poll | undefined = member ? polls.data.find((p) => isPollOpen(p, now)) : undefined;
  const votes = usePollVotes(poll?.id);
  const [pollErr, setPollErr] = useState("");

  // his turno at the next match
  const turnMatch = (jugador && nextMatch) || undefined;
  const turns = useMatchTurns(turnMatch, matches, jugador && !!turnMatch);
  const myTurns = playerId ? turns.turns.filter((t) => t.playerId === playerId) : [];
  const [turnHere, setTurnHere] = useState<{ id: string; done: boolean } | null>(null);
  const [turnBusy, setTurnBusy] = useState(false);
  const [turnErr, setTurnErr] = useState("");
  const turnIsDone = !!turnMatch && (turnHere?.id === turnMatch.id ? turnHere.done : turnDone(turns.pins, uid));

  // a captain's door
  const door = useDoorRequests(member && viewer.captain);

  const pends = useMemo<Pend[]>(() => {
    const out: Pend[] = [];
    const tie = (pred: (n: Notice) => boolean) => list.filter(pred).map((n) => n.id);
    if (rsvpMatch && me) {
      const at = dateMillis(rsvpMatch.date);
      const value = rsvpValue;
      out.push({
        kind: "rsvp",
        key: `rsvp-${rsvpMatch.id}`,
        noticeIds: tie((n) => n.topic === "convocatoria" && n.audience === "personal" && matchOf(n) === rsvpMatch.id),
        title: rsvpQuestion(rsvpMatch),
        body: rsvpBody(jornadaOf(matches, rsvpMatch), at, rsvpMatch.home, answers.data.length, squad),
        icon: "check",
        done: !!value,
        after: value ? `${ANSWERED[value]} El capitán ya lo ve.` : "",
        error: rsvpErr,
        value,
        busy: rsvpBusy,
        pick: async (a) => {
          setSent({ id: rsvpMatch.id, value: a });
          setRsvpBusy(true);
          setRsvpErr("");
          try {
            await setAvailability(me, rsvpMatch.id, a);
          } catch (e) {
            setSent(null);
            setRsvpErr("No se ha guardado tu respuesta. Inténtalo otra vez.");
            throw e;
          } finally {
            setRsvpBusy(false);
          }
        },
      });
    }
    if (viewer.captain && door.data.length) {
      const [first, ...rest] = [...door.data].sort((a, b) => b.at - a.at);
      const who = first.googleName || first.name || "Alguien";
      out.push({
        kind: "door",
        key: "door",
        noticeIds: tie((n) => n.topic === "door"),
        title: "Llaman a la puerta del vestuario",
        body: rest.length ? `${who} y ${rest.length === 1 ? "1 más piden" : `${rest.length} más piden`} entrar.` : `${who} pide entrar${first.email ? ` (${first.email})` : ""}.`,
        icon: "door",
        done: false,
        after: "",
        error: "",
        path: "/vestuario/puerta",
      });
    }
    if (poll && me) {
      const counts = new Map<string, number>();
      for (const v of votes.data) for (const o of v.optionIds) counts.set(o, (counts.get(o) ?? 0) + 1);
      const total = votes.data.length;
      const mineV = votes.data.find((v) => v.uid === uid)?.optionIds ?? [];
      out.push({
        kind: "poll",
        key: `poll-${poll.id}`,
        noticeIds: tie((n) => n.id.startsWith(`poll-${poll.id}`) || (n.title === "Nueva encuesta" && n.body.endsWith(poll.question))),
        title: "Nueva encuesta",
        body: poll.authorName ? `${poll.authorName}: ${poll.question}` : poll.question,
        icon: "poll",
        done: mineV.length > 0,
        after: mineV.length ? `Has votado. Puedes cambiarlo ${untilDay(poll.closesAt)}.` : "",
        error: pollErr,
        opts: poll.options.map((o) => {
          const n = counts.get(o.id) ?? 0;
          return { id: o.id, label: o.label, n, pct: total ? Math.round((n / total) * 100) : 0, on: mineV.includes(o.id) };
        }),
        pick: async (id) => {
          setPollErr("");
          const nextIds = poll.multi ? (mineV.includes(id) ? mineV.filter((x) => x !== id) : [...mineV, id]) : [id];
          try {
            await votePoll(me, poll, nextIds);
          } catch (e) {
            setPollErr("No se ha guardado tu voto. Inténtalo otra vez.");
            throw e;
          }
        },
      });
    }
    if (turnMatch && myTurns.length && me) {
      const t = rotaNotice(turnMatch.id, myTurns[0].job, playerId as string, { date: dateMillis(turnMatch.date), rival: turnMatch.rival }, now);
      const j = jornadaOf(matches, turnMatch);
      out.push({
        kind: "turno",
        key: `turno-${turnMatch.id}`,
        noticeIds: tie((n) => n.id.startsWith(`rota-${turnMatch.id}-`) || (n.audience === "personal" && /^Te toca /.test(n.title) && matchOf(n) === turnMatch.id)),
        title: t.title,
        body: `Turnos${j ? ` de la J${j}` : ""}. Si no puedes, cámbialo en el vestuario.`,
        icon: "wash",
        done: turnIsDone,
        after: turnIsDone ? "Hecho: el vestuario ya lo sabe." : "",
        error: turnErr,
        busy: turnBusy,
        mark: async () => {
          const id = turnMatch.id;
          const want = !turnIsDone;
          setTurnBusy(true);
          setTurnErr("");
          try {
            const done = await markTurnDone(me, id, want);
            setTurnHere({ id, done });
          } catch (e) {
            setTurnErr("No se ha podido marcar tu turno. Inténtalo otra vez.");
            throw e;
          } finally {
            setTurnBusy(false);
          }
        },
      });
    }
    if (mvpMatch && me) {
      const res = mvpResults.get(mvpMatch.id);
      const order = [...(mvpMatch.starters ?? []), ...(mvpMatch.bench ?? [])];
      const rank = (id: string) => {
        const i = order.indexOf(id);
        return i < 0 ? order.length : i;
      };
      const ids = mvpCandidates(mvpMatch.ledger, undefined, (id) => nameOf(id, mvpMatch.seasonId)).sort((a, b) => rank(a) - rank(b));
      const voted = mvpSent?.id === mvpMatch.id ? mvpSent.pick : myMvp.data || null;
      const j = jornadaOf(matches, mvpMatch);
      out.push({
        kind: "mvp",
        key: `mvp-${mvpMatch.id}`,
        noticeIds: tie((n) => n.id.startsWith(`mvp-open-${mvpMatch.id}`) || (n.topic === "mvp" && n.title === "Vota al MVP" && matchOf(n) === mvpMatch.id)),
        title: `Vota al MVP${j ? ` del J${j}` : ""}`,
        body: mvpBody(res?.total ?? 0, res?.eligible ?? null, mvpMatch.voteClosesAt as number, now),
        icon: "star",
        gold: true,
        done: !!voted,
        after: voted ? `Has votado a ${nameOf(voted, mvpMatch.seasonId)}. Puedes cambiarlo hasta que se cierre.` : "",
        error: mvpErr,
        matchJ: j,
        cands: ids.map((id) => ({ id, name: nameOf(id, mvpMatch.seasonId), num: numOf(id), min: Math.round(mvpMatch.ledger?.[id]?.minutes ?? 0), on: voted === id })),
        pick: async (id) => {
          setMvpSent({ id: mvpMatch.id, pick: id });
          setMvpErr("");
          try {
            await voteMvp(me, mvpMatch.id, id);
          } catch (e) {
            setMvpSent(null);
            setMvpErr("No se ha guardado tu voto. Inténtalo otra vez.");
            throw e;
          }
        },
      });
    }
    return out;
    // (the closures read the latest state; the list is rebuilt whenever what it shows changes)
  }, [list, rsvpMatch, me, rsvpValue, answers.data, squad, rsvpErr, rsvpBusy, viewer.captain, door.data, poll, votes.data, uid, pollErr, turnMatch, myTurns, playerId, now, turnIsDone, turnErr, turnBusy, mvpMatch, mvpResults, mvpSent, myMvp.data, mvpErr, matches, players]); // eslint-disable-line react-hooks/exhaustive-deps

  const openPend = pends.filter((p) => !p.done).length;
  const tied = useMemo(() => new Set(pends.flatMap((p) => p.noticeIds)), [pends]);
  const feed = useMemo(() => feedOf(list, tied), [list, tied]);
  const unread = list.filter((n) => reads.unread(n)).length;

  const viewOf = (m: ClubMatch | undefined, matchId: string, rows: Notice[]): StackView => {
    const rival = m?.rival?.trim() || "el rival";
    const finished = !!m && m.status === "finished";
    const { gf, ga } = m ? scoreOf(m) : { gf: 0, ga: 0 };
    const res = resOf(finished, gf, ga);
    const marks = m ? matchMarks(m) : [];
    return {
      matchId,
      j: m ? jornadaOf(matches, m) : null,
      rival,
      ini: rivalIni(rival, (m as { rivalInitials?: string } | undefined)?.rivalInitials),
      title: res ? `Manchester Piti ${gf}–${ga} ${rival}` : rival,
      res,
      gf,
      ga,
      when: m ? whenLine(dateMillis(m.date), m.home) : "",
      sum: stackSummary(res, rival, marks, rows.map((r) => r.title)),
      marks,
      dur: m ? durationOf(m) : 50,
      alt: timelineAlt(res, gf, ga, rival),
      rows,
    };
  };
  const { stacks, loose } = useMemo(() => {
    const s = stacksOf(feed);
    return { stacks: s.stacks.map((x) => viewOf(byId.get(x.matchId), x.matchId, x.rows)), loose: s.loose };
  }, [feed, byId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- this device's choices
  const key = useSyncExternalStore(subscribePushChoice, pushChoiceKey, () => "");
  const choice = useMemo(() => pushChoiceOf(key), [key]);
  const muted = useMemo(() => Object.entries(choice.matches).filter(([, t]) => t.length === 0).map(([id]) => id), [choice.matches]);

  return {
    viewer,
    member,
    uid,
    now,
    loading,
    failed,
    list,
    reads,
    unread,
    pends,
    openPend,
    feed,
    stacks,
    loose,
    stackOf: (id) => stacks.find((s) => s.matchId === id) ?? (byId.get(id) ? viewOf(byId.get(id), id, []) : undefined),
    next,
    topics: choice.topics,
    muted,
    matchName: (id) => {
      const m = byId.get(id);
      const j = m ? jornadaOf(matches, m) : null;
      return j ? `J${j}` : "este partido";
    },
  };
}
