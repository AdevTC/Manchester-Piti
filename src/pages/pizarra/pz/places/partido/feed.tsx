// r14 «La pizarra» · Partido: the feed — what the day of the match reads that the store doesn't carry (la mesa's
// lineup and roll call, the acta's events, the clock's minute, whether I am a scorer, the quedada, the forecast,
// the frozen notas). One tiny component (<PtFeedBridge/>) reads it and writes it into the slice "pt-feed" only when
// it changes, so the clock's tick re-renders nothing else. The model (partidoView.ts) reads the slice.
import { useEffect } from "react";
import { useClubData, type ClubMatch } from "../../../../../lib/clubData";
import { parseMatchLineup, parsePresent } from "../../../../../lib/matchLineup";
import { liveMinute, shownMinute } from "../../../../../lib/partidos";
import { useMatchWeather } from "../../../../../lib/weather";
import { useMatchScorers, useMeetingNote } from "../../../../vestuario/live";
import { useQuedada } from "../../../data/quedada";
import { useMatchClock } from "../../../v2/useMatchDay";
import { usePz } from "../../store/context";
import { EMPTY_FEED, ptMatch, type PtFeed } from "./partidoView";
import { FEED } from "./state";

type Raw = ClubMatch & { lineup?: unknown; present?: unknown };

/** The raw match → the feed (pure; exported for the tests). */
export function feedFrom(raw: Raw | null, o: { matchId: string; tick: number; scorer: boolean; quedada: PtFeed["quedada"]; meetingNote: string; weather: PtFeed["weather"] }): PtFeed {
  if (!raw) return { ...EMPTY_FEED, matchId: o.matchId, scorer: o.scorer, quedada: o.quedada, meetingNote: o.meetingNote, weather: o.weather };
  const l = parseMatchLineup(raw.lineup);
  const c = raw.clock;
  const min = liveMinute({ date: raw.date, duration: raw.duration, clock: c }, o.tick);
  const shown = shownMinute({ date: raw.date, duration: raw.duration, clock: c }, o.tick);
  const notas: Record<string, number> = {};
  Object.entries(raw.notas?.players ?? {}).forEach(([k, n]) => {
    if (typeof n?.nota === "number") notas[k] = n.nota;
  });
  return {
    matchId: o.matchId,
    lineup: l ? { system: l.system, slots: l.slots, boardId: l.boardId, setAt: l.setAt } : null,
    present: parsePresent(raw.present),
    events: raw.events ?? [],
    minute: min ?? 0,
    shown,
    clock: c?.phase ?? null,
    paused: !!c && c.heldAt != null && (c.phase === "first" || c.phase === "second"),
    revision: c?.revision ?? null,
    duration: raw.duration && raw.duration > 1 ? raw.duration : 50,
    scorer: o.scorer,
    mesaName: raw.mesa?.name ?? "",
    notas,
    quedada: o.quedada,
    meetingNote: o.meetingNote,
    weather: o.weather,
    status: typeof raw.status === "string" ? raw.status : "",
  };
}

/** Reads the feed of the match on screen and keeps the slice up to date (renders nothing). */
export function PtFeedBridge() {
  const P = usePz();
  const M = ptMatch(P);
  const id = M?.id ?? null;
  const member = P.sel.me().member;
  const uid = P.sel.me().uid;
  const { matches } = useClubData();
  const raw = (id ? (matches.find((m) => m.id === id) as Raw | undefined) : undefined) ?? null;
  const tick = useMatchClock(M?.cal ?? null, P.state.W.now);
  const scorers = useMatchScorers(id && member ? id : undefined);
  const q = useQuedada(id, member).quedada;
  const note = useMeetingNote(id && member ? id : undefined).data;
  const w = useMatchWeather(M && M.phase === "antes" ? { venue: raw?.venue ?? M.venue, date: raw?.date ?? M.at } : undefined, P.state.W.now);
  const feed = id
    ? feedFrom(raw, {
        matchId: id,
        tick,
        scorer: !!uid && scorers.data.includes(uid),
        quedada: q ? { at: q.at, where: q.where, note: q.note } : null,
        meetingNote: note ?? "",
        weather: w ? { t: w.temp, sky: w.label, rain: w.rain } : null,
      })
    : EMPTY_FEED;
  const key = JSON.stringify(feed);
  useEffect(() => {
    const cur = P.slice<PtFeed>(FEED, EMPTY_FEED);
    if (JSON.stringify(cur.get()) === key) return;
    cur.set(JSON.parse(key) as PtFeed, { undoable: false, toast: false });
    // (the feed's text is what matters: P changes identity on every store version)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
