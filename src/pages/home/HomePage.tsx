// Inicio, «La portada» (boards IN-Inicio390/820/1440/1920, ronda 3): one home screen with the match of the day
// at its centre (the lens: the score with «La moviola», the hour with «La tarde», «El último» between matches),
// the headline and the viewer's own line, «Lo que te toca», tonight's pitch and plays, and «Por la casa»; every
// section you choose is a screen with its own address (/hoy/campo, /hoy/jugadas, /hoy/lo-tuyo, /camiseta) that
// replaces the content through a View Transition, the lens morphing into the screen's score capsule. The server
// paints the public match; what is a member's appears once the viewer is known (useHydrated + useViewer).
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useSeason } from "../../context/SeasonContext";
import { dateMillis, nameFor, nextFixture, playerForSeason, useClubData, type ClubMatch } from "../../lib/clubData";
import { useMatchClock } from "../../hooks/useMatchClock";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { useViewer } from "../../hooks/useViewer";
import { KitStillContext, type Kit } from "../../components/jersey3d/kitStill";
import { usePageKitStills } from "../../components/jersey3d/usePageKitStills";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { PipWindow, bokehDiscs, openScorePip, useLightPointer, useReducedMotion, type ScorePip } from "../../components/vidrio";
import { paintDiscs } from "../../components/vidrio/sky";
import { clubMedals, seasonPulse, playerLines, upcomingBirthdays, type SquadMember } from "../../lib/home";
import { currentSeasonId } from "../../lib/vestuario";
import { useStandings } from "../../lib/useStandings";
import { useMatchWeather } from "../../lib/weather";
import { matchdayOf, viewerRoleOf, type MatchdayModel } from "../../lib/derived/matchday";
import { mvpVoteOpen } from "../../lib/derived/memberWindows";
import { jornadaOf as jornadaOfMatch } from "../../lib/derived/jornada";
import { parseMatchLineup } from "../../lib/matchLineup";
import { mapsUrl, venueName } from "../../lib/derived/venue";
import { madridDate, madridTime } from "../../lib/derived/madrid";
import { sunTimes } from "../../lib/derived/sun";
import { scoreOf } from "../../lib/partidos";
import { mesaOf } from "../../lib/derived/mesa";
import { seasonStrip } from "../../lib/derived/vidrio/strip";
import { seasonLeaders } from "../../lib/derived/vidrio/leaders";
import { viewerKind } from "../../lib/derived/vidrio/viewer";
import { albumLine, albumOf } from "../../lib/derived/album";
import { pollTally } from "../../lib/derived/polls";
import { capital, niceName } from "../../lib/derived/words";
import { pushState, savedTopics, toggleTopic, usePushPreset, PRESET_NOTES, type PushPreset } from "../../lib/push";
import { formatDate } from "../../lib/clubData";
import { useVenuePlace } from "../partidos/vidrio/venuePlace";
import { usePolls, usePollVotes, useMatchScorers, useMvpResults, useMeetingNote } from "../vestuario/live";
import { useMe, voteMvp, votePoll, predictScore } from "../vestuario/writes";
import { floodlightsFrom, leftWords, publishedWhen } from "./hoyModel";
import { weekday } from "./inicioModel";
import { useTu } from "./vidrio/useTu";
import { partidoOf, scoreAt, KEY_PLAY, type Partido } from "./portada/partido";
import { POSN, capOf, heroOf, isLiveF, isPlayedF, isPreF, lensOf, movOf, tardeOf, type Act, type Ctx, type Fase, type Fixture, type Quien } from "./portada/model";
import { doorsOf, nightOf, tasksOf, type DoorsIn, type Task, type TaskAct, type TasksIn } from "./portada/bands";
import { campoOf, jugadasOf, tuyoOf, type JugFilter } from "./portada/screenModel";
import { InicioLens } from "./portada/InicioLens";
import { Portada } from "./portada/Portada";
import { Campo, Jugadas, LoTuyo, SubHead, SubNext, SubTitle } from "./portada/Screens";
import { Camiseta } from "./portada/Camiseta";
import { CartelSheet, MvpSheet, PorraSheet, type CartelView } from "./portada/Sheets";
import { MatchLink, PageLink } from "./portada/links";
import { PI } from "./portada/ui";
import { hrefOf, useInicioNav, type Screen } from "./portada/nav";
import { applyMaqueta, readMaqueta } from "./portada/maqueta";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/sky.css";
import "../../styles/vidrio/field.css";
import "../../styles/vidrio/reading.css";
import "../../styles/vidrio-paginas.css";
import "../../styles/inicio.css";

const subscribeNothing = () => () => {};
/** False on the server and while the browser takes over, true after (member data never renders on the server). */
const useHydrated = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);

const MIN = 60_000;
const DAY_LONG = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" });
/** «Domingo 18 de octubre». */
const dayLongOf = (ms: number) => capital(DAY_LONG.format(ms).replace(",", ""));
/** The boards' crest letters for a rival: the admin's own initials, else two words' initials or a word's first two. */
function crestCode(m: Pick<ClubMatch, "rival" | "rivalShort" | "rivalInitials">): string {
  const own = (m.rivalInitials ?? m.rivalShort ?? "").trim();
  if (own) return own.toLocaleUpperCase("es").slice(0, 3);
  const w = (m.rival ?? "")
    .replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, " ")
    .split(/\s+/)
    .filter((x) => x && !/^(fc|f|c|de|la|el|los|las|cf)$/i.test(x));
  if (!w.length) return "";
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toLocaleUpperCase("es");
}
/** A meeting note's time («18:30 en la puerta» → «18:30»). */
const meetTime = (note: string) => {
  const t = /(\d{1,2})[:.h](\d{2})/.exec(note);
  return t ? `${Number(t[1])}:${t[2]}` : null;
};
/** Days since the epoch of the Madrid day `ms` falls on (two of them subtract to whole days). */
const madridDayNumber = (ms: number) => {
  const [y, mo, d] = madridDate(ms).split("-").map(Number);
  return Date.UTC(y, mo - 1, d) / 86_400_000;
};
const madridMinutes = (ms: number) => {
  const [h, m] = madridTime(ms).split(":").map(Number);
  return h * 60 + m;
};

/** The moment the boards draw for the match day, and which match is the lens's (P), the fixture of P (M) and the
 *  next one (N). Between matches the lens counts down to N and keeps the last one (P) for «El último». */
function momentOf(day: MatchdayModel): { fase: Fase; p: ClubMatch | null; n: ClubMatch | null } {
  switch (day.phase) {
    case "pretemporada":
      return { fase: "semana", p: null, n: null };
    case "semana":
      return { fase: "semana", p: day.last, n: day.match };
    case "despues":
      return day.next ? { fase: "semana", p: day.match, n: day.next } : { fase: "acta", p: day.match, n: null };
    case "directo1":
    case "directo2":
      return { fase: "directo", p: day.match, n: day.next };
    default:
      return { fase: day.phase, p: day.match, n: day.next };
  }
}

/** A bokeh canvas over the two skies (the light field's out-of-focus lights, drawn once per light and width). */
function Bokeh({ light }: { light: "golden" | "flood" | "late" | "day" }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    const host = cv?.parentElement;
    if (!cv || !host || typeof cv.getContext !== "function") return;
    let width = 0;
    const draw = () => {
      const w = host.clientWidth;
      const h = Math.min(host.clientHeight || 900, 1400);
      if (!w || w === width) return;
      width = w;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      const g = cv.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = "lighter";
      paintDiscs(g, bokehDiscs(light, w, h));
    };
    draw();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(draw);
    ro.observe(host);
    return () => ro.disconnect();
  }, [light]);
  return <canvas ref={ref} className="pp-bokeh" aria-hidden="true" />;
}

function SkyLayer({ light, gold, cold, className, style }: { light: string; gold?: boolean; cold?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <div className={`vd-sky vd-l-${light}${gold ? " vd-sky--gold" : ""}${cold ? " vd-sky--cold" : ""}${className ? ` ${className}` : ""}`} style={style} aria-hidden="true">
      <div className="vd-sky__base" />
      <div className="vd-sky__sun" />
      <div className="vd-sky__drift">
        <div className="vd-sky__banks" />
      </div>
      <div className="vd-sky__rays" />
      <div className="vd-sky__haze" />
      <div className="vd-sky__turf" />
      <div className="vd-sky__gold" />
      <div className="vd-sky__cold" />
      <div className="vd-sky__grain" />
      <div className="vd-sky__vig" />
    </div>
  );
}

export function HomePage() {
  const { matches, players, loading } = useClubData();
  const { seasons } = useSeason();
  const clockNow = useMatchClock(matches);
  const theme = useDocumentTheme();
  const dia = theme === "light";
  const viewer = useViewer();
  const hydrated = useHydrated();
  const memberNow = hydrated && viewer.member;
  const me = useMe();
  const reduced = useReducedMotion();
  const nav = useInicioNav();
  const pageRef = useRef<HTMLDivElement | null>(null);
  useLightPointer(pageRef);

  // ── the season, the squad, the names
  const seasonId = currentSeasonId(nextFixture(matches, clockNow), matches, seasons);
  const season = seasons.find((s) => s.id === seasonId);
  const squad: SquadMember[] = useMemo(
    () =>
      players
        .filter((p) => p.seasons?.includes(seasonId))
        .map((raw) => {
          const p = playerForSeason(raw, seasonId, seasons);
          return { id: p.id, name: nameFor(p, seasonId), num: p.number != null ? String(p.number) : "", birthDate: p.birthDate };
        })
        .sort((a, b) => Number(a.num || 999) - Number(b.num || 999) || a.name.localeCompare(b.name, "es")),
    [players, seasonId, seasons],
  );
  const byId = useMemo(() => new Map(squad.map((s) => [s.id, s])), [squad]);
  const shortOf = (id: string) => (byId.get(id)?.name ?? nameFor(players.find((p) => p.id === id), seasonId)).toLocaleUpperCase("es");
  const niceOf = (id: string) => niceName(byId.get(id)?.name ?? nameFor(players.find((p) => p.id === id), seasonId));
  const numOf = (id: string) => byId.get(id)?.num ?? "";
  const names = { name: niceOf, short: shortOf, num: numOf };

  // ── the day, the match and who is looking
  // (DEV: ?maqueta= turns the last match into any moment, ?quien= looks at it as someone else)
  const maqueta = readMaqueta();
  const { day, now } = applyMaqueta(maqueta, matchdayOf(matches, seasonId, clockNow), clockNow);
  const { fase, p: pm, n: nm } = momentOf(day);
  const live = isLiveF(fase);
  const duration = pm?.duration && pm.duration > 0 ? Math.round(pm.duration) : 50;
  const liveMinute = live ? Math.max(1, Math.min(duration, fase === "descanso" ? Math.round(duration / 2) : (day.minute ?? 1))) : null;
  // (one read of the match per minute while live; once after)
  const P: Partido | null = useMemo(() => (pm ? partidoOf(pm, niceOf, liveMinute ?? undefined) : null), [pm, liveMinute, squad]); // eslint-disable-line react-hooks/exhaustive-deps -- niceOf follows squad
  const jOf = (m: ClubMatch) => jornadaOfMatch(matches, m.id);
  const fixture = (m: ClubMatch | null): Fixture | null => {
    if (!m) return null;
    const at = dateMillis(m.date);
    const ok = Number.isFinite(at);
    return {
      matchId: m.id,
      j: jOf(m),
      rival: m.rival?.trim() || "Rival",
      code: crestCode(m),
      home: m.home !== false,
      kickoff: ok ? at : null,
      dayLong: ok ? dayLongOf(at) : "Fecha por confirmar",
      dow: ok ? weekday(at) : "",
      day: ok ? Number(madridDate(at).slice(8)) : 0,
      time: ok ? madridTime(at) : "",
      competition: m.competition?.trim() || "Liga",
    };
  };
  const M = fixture(pm);
  const N = fixture(nm);
  const edge = !P ? 0 : live ? (liveMinute ?? 1) : isPlayedF(fase) || fase === "semana" ? duration : 0;

  const uid = memberNow ? me?.uid : undefined;
  const scorers = useMatchScorers(memberNow ? day.match?.id : undefined);
  const role = viewerRoleOf(day.match, { member: memberNow, playerId: memberNow ? viewer.playerId : null }, { scorer: !!uid && scorers.data.includes(uid), absentToday: false, seven: [] });
  const mineSq = memberNow && viewer.playerId ? byId.get(viewer.playerId) : undefined;
  const playerDoc = mineSq ? players.find((p) => p.id === mineSq.id) : undefined;
  const kind = viewerKind(memberNow ? viewer : null, playerDoc ? { id: playerDoc.id, archived: (playerDoc as { archived?: boolean }).archived } : null);
  const quien: Quien = maqueta?.quien ?? (!memberNow ? "fan" : role === "anotador" && (isPreF(fase) || live || fase === "final" || fase === "pendiente") ? "anotador" : kind === "jugador" ? "jugador" : "socio");
  const meId = quien === "jugador" || quien === "anotador" ? (viewer.playerId ?? null) : null;
  const meName = mineSq ? niceName(mineSq.name) : me?.name ? capital(me.name.split(" ")[0]) : "";

  // ── the moviola's minute (the address's ?min=, else the edge; live it follows the clock)
  const [minLocal, setMinLocal] = useState<number | null>(nav.min);
  const minFromUrl = nav.min;
  // (atrás / adelante move the address's minute: the moviola follows it)
  const [lastUrlMin, setLastUrlMin] = useState(minFromUrl);
  if (lastUrlMin !== minFromUrl) {
    setLastUrlMin(minFromUrl);
    if (minFromUrl !== minLocal) setMinLocal(minFromUrl);
  }
  const hasGame = !!P && (isPlayedF(fase) || fase === "semana");
  const m = hasGame && minLocal !== null ? Math.max(0, Math.min(edge, minLocal)) : edge;
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seek = (to: number | null) => {
    const v = to === null || to >= edge ? null : Math.max(0, Math.round(to));
    setMinLocal(v);
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => nav.setMin(v), 250);
  };
  useEffect(
    () => () => {
      if (urlTimer.current) clearTimeout(urlTimer.current);
    },
    [],
  );

  // ── the replay («Repasar el partido») and the goal flash
  const [playing, setPlaying] = useState(false);
  const [fx, setFx] = useState<"gold" | "cold" | null>(null);
  const [toast, setToast] = useState<{ t: string; on: boolean }>({ t: "", on: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = (t: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ t, on: true });
    toastTimer.current = setTimeout(() => setToast((x) => ({ ...x, on: false })), 2600);
  };
  const fxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashAt = (minute: number) => {
    const g = P?.plays.find((p) => p.m === minute && (p.k === "gol" || p.k === "rival"));
    if (!g) return;
    if (fxTimer.current) clearTimeout(fxTimer.current);
    setFx(g.k === "gol" ? "gold" : "cold");
    say(g.k === "gol" ? `¡${g.title}!` : g.title);
    fxTimer.current = setTimeout(() => setFx(null), reduced ? 600 : g.k === "gol" ? 2600 : 1600);
  };
  const playRef = useRef<{ m: number; edge: number }>({ m, edge });
  useEffect(() => {
    playRef.current = { m, edge };
  }, [m, edge]);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(
      () => {
        const next = playRef.current.m + 1;
        if (next > playRef.current.edge) {
          setPlaying(false);
          seek(null);
          return;
        }
        seek(next);
        if (nav.screen === "portada") flashAt(next);
      },
      nav.screen === "campo" ? 420 : 340,
    );
    return () => clearInterval(t);
  }, [playing, nav.screen]); // eslint-disable-line react-hooks/exhaustive-deps -- the tick reads the latest minute through playRef
  const stop = () => setPlaying(false);
  const jump = (dir: 1 | -1) => {
    if (!P) return;
    const list = [0, ...P.plays.filter((p) => p.m <= edge && KEY_PLAY.has(p.k)).map((p) => p.m), edge];
    const t = dir > 0 ? list.find((x) => x > m) : [...list].reverse().find((x) => x < m);
    if (t === undefined) return;
    seek(t);
    flashAt(t);
  };
  const togglePlay = () => {
    if (playing) return stop();
    if (reduced) return jump(1);
    if (m >= edge) seek(0);
    setPlaying(true);
  };

  // ── the viewer's things (members only, client side)
  const tu = useTu({ enabled: kind === "jugador", member: memberNow, me, admin: viewer.admin, playerId: memberNow ? viewer.playerId : null, day, matches, players, seasonId, seasons, now });
  const porra = tu.porra ? { us: tu.porra.gf, them: tu.porra.ga } : null;
  const rsvpV = tu.rsvp?.value ?? null;
  const rsvp = rsvpV === "yes" ? 0 : rsvpV === "maybe" ? 1 : rsvpV === "no" ? 2 : null;
  const voteOpen = !!pm && mvpVoteOpen(pm, now);
  const mvpResults = useMvpResults();
  const mvpResult = pm ? mvpResults.get(pm.id) : undefined;
  const closesAt = typeof pm?.voteClosesAt === "number" ? pm.voteClosesAt : null;
  const pulse = seasonPulse(matches, seasonId, now);
  const estreno = !!pm && (pulse.played.length === 0 || pulse.played[0]?.id === pm.id);

  // ── the light: the kick-off's sunset and floodlights, the weather
  const ko = M?.kickoff ?? null;
  const lit = ko !== null ? floodlightsFrom(ko, ko + duration * MIN) : null;
  const nko = N?.kickoff ?? null;
  const nlit = nko !== null ? floodlightsFrom(nko, nko + (nm?.duration ?? 50) * MIN) : null;
  const wxMatch = fase === "semana" ? nm : pm;
  const weather = useMatchWeather(wxMatch ?? undefined, now);
  const meeting = useMeetingNote(memberNow && pm && isPreF(fase) ? pm.id : undefined).data;
  const meet = memberNow && meeting ? meetTime(meeting) : null;
  const days = nko !== null ? madridDayNumber(nko) - madridDayNumber(now) : null;
  const nextLeft = days === null ? "Fecha por confirmar" : days <= 0 ? "Hoy" : days === 1 ? "Mañana" : `Faltan ${days} días`;

  // ── «Sacar el marcador» and «Avisarme…»
  const [pip, setPip] = useState<ScorePip | null>(null);
  const pushTopic = isPreF(fase) ? "start" : fase === "aplazado" ? "dates" : "goals";
  const [topicsSet, setTopicsLocal] = useState<string[] | null>(null);
  const topics = topicsSet ?? (hydrated ? savedTopics() : []);
  const push = hydrated ? pushState() : "unsupported";
  const alerts = push === "ready" && topics.includes(pushTopic);
  const toggleAlerts = () => {
    if (push !== "ready") {
      say(push === "ios-install" ? "En iPhone, añade antes la web a la pantalla de inicio." : push === "denied" ? "Los avisos están bloqueados en este navegador." : "Este navegador no admite avisos.");
      return;
    }
    toggleTopic(pushTopic, !alerts).then(
      (t) => {
        setTopicsLocal(t);
        say(alerts ? "Ya no te avisamos." : isPreF(fase) ? "Te avisamos del pitido." : fase === "aplazado" ? "Te avisamos en cuanto haya fecha." : "Te avisamos de cada gol.");
      },
      () => say("No se han podido activar los avisos en este navegador."),
    );
  };

  const ctx: Ctx = {
    fase,
    quien,
    me: meId,
    meName,
    P,
    M,
    N,
    m,
    edge,
    score: pm && (isPlayedF(fase) || fase === "semana") ? (() => {
      if (live && P) return scoreAt(P.plays, edge);
      const s = scoreOf(pm);
      return s ? { us: s.gf, them: s.ga } : null;
    })() : null,
    names,
    now,
    sunset: ko !== null ? madridTime(sunTimes(ko).sunset) : "",
    lights: lit !== null && ko !== null && lit > ko ? madridTime(lit) : lit !== null ? madridTime(lit) : null,
    lightsFromStart: lit !== null && ko !== null && lit <= ko,
    nextLights: nlit === null ? "dia" : nko !== null && nlit <= nko ? null : madridTime(nlit),
    nextLeft,
    kickLeft: ko !== null ? leftWords(ko, now) : "",
    weather: weather ? { t: Math.round(weather.temp), label: weather.label, rain: weather.rain } : null,
    estreno,
    mvp: { open: voteOpen, closes: closesAt !== null ? `el ${weekday(closesAt)} a las ${madridTime(closesAt)}` : "", total: mvpResult?.total ?? null, eligible: mvpResult?.eligible ?? null },
    postponed: pm?.postponedReason?.trim() ?? "",
    todayLine: dayLongOf(now),
    porra,
    rsvp,
    mvpVoted: tu.mvpVote ? niceOf(tu.mvpVote) : null,
    alerts,
    pip: !!pip,
    matchHref: pm ? pm.id : null,
    nextHref: nm ? nm.id : null,
  };

  // ── the page's light: golden (or the late night between matches, the day theme), the floodlit night over it
  const floodOp = dia || fase === "semana" || fase === "antes" || fase === "aplazado" ? 0 : fase === "pendiente" ? 1 : fase === "pitido" ? (lit !== null && lit <= now ? 1 : 0.05) : (() => {
    if (lit === null || ko === null) return 0;
    const on = (lit - ko) / MIN;
    if (m <= on - 4) return 0;
    if (m >= on + 18) return 1;
    return Math.round(((m - (on - 4)) / 22) * 100) / 100;
  })();
  const skyA = dia ? "day" : fase === "semana" ? "late" : "golden";
  const light = dia ? "day" : fase === "semana" ? "late" : floodOp >= 0.5 ? "flood" : "golden";

  // ── «La tarde» before the whistle
  const tarde = isPreF(fase) && ko !== null ? tardeOf({ koMin: madridMinutes(ko), endMin: madridMinutes(ko + duration * MIN), nowMin: madridMinutes(Math.min(Math.max(now, ko - 150 * MIN), ko + 90 * MIN)), sunset: madridTime(sunTimes(ko).sunset), lights: lit !== null ? madridTime(lit) : null, meet, pitido: fase === "pitido", showMeet: memberNow }) : null;

  // ── the views
  const lens = lensOf(ctx);
  const mov = movOf(ctx, tarde, playing);
  const hero = heroOf(ctx);
  const cap = capOf(ctx);

  // the members' open poll (a socia votes it here)
  const polls = usePolls(memberNow);
  const openPoll = memberNow ? polls.data.find((p) => p.closedAt === null && now < p.closesAt) : undefined;
  const pollVotes = usePollVotes(openPoll?.id);
  const tally = openPoll ? pollTally(openPoll, pollVotes.data) : null;
  const [pollSent, setPollSent] = useState<{ poll: string; id: string } | null>(null);
  const pollMine = openPoll ? (pollSent?.poll === openPoll.id ? [pollSent.id] : (pollVotes.data.find((v) => v.uid === uid)?.optionIds ?? [])) : [];
  const [pollErr, setPollErr] = useState("");

  const answers = tu.answers;
  const called = day.match ? [...(day.match.starters ?? []), ...(day.match.bench ?? [])] : [];
  const tasksIn: TasksIn = {
    rsvp: tu.rsvp ? { value: rsvp, yes: answers.filter((a) => a.response === "yes").length, maybe: answers.filter((a) => a.response === "maybe").length, answered: answers.length, called: called.length || squad.length, busy: tu.rsvp.busy, error: tu.rsvp.error } : null,
    porraOpen: memberNow && ((fase === "semana" && !!N) || isPreF(fase)),
    caja: tu.caja && (tu.caja.owes || tu.caja.claimed) ? { title: tu.caja.title, sub: tu.caja.text, claimed: tu.caja.claimed, canClaim: !!tu.caja.onClaim, busy: tu.caja.busy, error: tu.caja.error } : null,
    turno: tu.turno?.mine ? { task: tu.turno.task || "Tu turno", sub: tu.turno.text, done: tu.turno.done, canMark: !!tu.turno.onDone, busy: tu.turno.busy, error: tu.turno.error } : null,
    poll:
      openPoll && tally
        ? {
            title: openPoll.question,
            sub: `Encuesta de socios · ${tally.rows.map((r) => `${r.label} ${r.count}`).join(", ")}`,
            opts: tally.rows.map((r) => ({ id: r.id, t: r.label, on: pollMine.includes(r.id) })),
            seg: !openPoll.multi && tally.rows.length <= 3,
            voted: pollMine.length > 0,
            error: pollErr,
          }
        : null,
    mesaMine: role === "anotador",
  };
  const tasks = tasksOf(ctx, tasksIn);

  const lineup = pm ? parseMatchLineup((pm as ClubMatch & { lineup?: unknown }).lineup) : null;
  const place = useVenuePlace(pm ? venueName(pm.venue ?? "") || (pm.home !== false ? "CDM Palomeras" : null) : null);
  const venueWords = pm ? `${venueName(pm.venue ?? "") || (pm.home !== false ? "CDM Palomeras" : `Campo de ${pm.rival ?? "el rival"}`)}${place?.district ? ` · ${place.district}` : ""}` : "";
  const system = lineup?.system ?? pm?.system ?? "3-2-1";
  const night = nightOf(ctx, { venue: venueWords, published: lineup ? `Publicado ${publishedWhen(lineup.setAt, now)} desde la pizarra` : null, meet, mesaName: pm ? (mesaOf(pm)?.name ?? null) : null, system, kit: pm?.kit === "away" ? "away" : "home", evening: ko !== null && Number(madridTime(ko).slice(0, 2)) >= 16 });

  // the doors
  const strip = useMemo(() => seasonStrip(matches, seasonId, now), [matches, seasonId, now]);
  const leaders = useMemo(() => seasonLeaders(matches, seasonId, squad, now), [matches, seasonId, squad, now]);
  const { standings } = useStandings(seasonId);
  const usRow = standings?.rows.findIndex((r) => r.isUs) ?? -1;
  const lines = playerLines(squad, pulse.played);
  const medals = clubMedals(pulse, lines, niceOf, (d) => formatDate(d));
  const medal = medals.filter((x) => x.earned).at(-1);
  const bd = upcomingBirthdays(squad, now, 1).find((b) => b.days <= 30);
  const skyOf = (at: number | null): "day" | "golden" | "flood" => {
    if (at === null) return "flood";
    const set = sunTimes(at).sunset;
    return at + 24 * MIN < set - 72 * MIN ? "day" : at < set + 12 * MIN ? "golden" : "flood";
  };
  const railIds = [...new Set([...(meId ? [meId] : []), ...(P?.lineup.map((s) => s.id) ?? []), ...squad.map((s) => s.id)])].filter((id) => byId.has(id) && numOf(id)).slice(0, 5);
  const doorsIn: DoorsIn = {
    jornadas: strip.segments.map((s) => ({
      id: s.id,
      j: s.jornada,
      rival: s.rival,
      gf: s.score?.gf ?? null,
      ga: s.score?.ga ?? null,
      res: s.state === "jugado" && s.score ? (s.score.gf > s.score.ga ? "G" : s.score.gf < s.score.ga ? "P" : "E") : "",
      off: s.state === "aplazado" || s.state === "suspendido",
      live: s.state === "directo",
      sky: skyOf(s.at),
      dayNum: s.at !== null ? String(Number(madridDate(s.at).slice(8))) : "",
    })),
    total: strip.counts.total,
    squadN: squad.length,
    rail: railIds.map((id) => ({ id, num: numOf(id) })),
    standings: standings && usRow >= 0 && pulse.played.length > 0 ? { pos: usRow + 1, of: standings.rows.length, pts: standings.rows[usRow].pts } : null,
    leader: leaders.goals[0] ? { name: niceName(leaders.goals[0].name), goals: leaders.goals[0].value } : null,
    birthday: bd ? { id: bd.id, num: bd.num, name: niceName(bd.name), when: bd.days === 0 ? "hoy" : bd.days === 1 ? "mañana" : `el ${weekday(now + bd.days * 86_400_000)} ${Number(madridDate(now + bd.days * 86_400_000).slice(8))}` } : null,
    vitrina: medal ? `La vitrina: ${medal.kicker.toLocaleLowerCase("es")}` : "La vitrina, por estrenar",
    mine: meId && byId.get(meId) ? { id: meId, num: numOf(meId), short: shortOf(meId) } : null,
  };
  const doors = doorsOf(ctx, tasks, doorsIn);

  // the screens
  const [jf, setJf] = useState<JugFilter>(0);
  const campo = campoOf(ctx, { open: nav.jugador, captain: (pm as ClubMatch & { captainId?: string } | null)?.captainId ?? season?.captainPlayerId ?? null, system, meet, coverage: pm?.analysisCoverage === "partial" ? "Minutos de la narración, con cobertura parcial: el acta los da por buenos mientras no se corrijan." : null });
  const jugadas = jugadasOf(ctx, jf);
  const album = kind === "jugador" && meId ? albumOf(meId, matches, squad.map((s) => s.id), seasonId) : null;
  const mineSlot = meId ? P?.lineup.find((s) => s.id === meId) : undefined;
  const tuyo = tuyoOf(ctx, {
    tasks,
    logro: tu.logro,
    album: album ? { owned: album.owned.length, total: album.total, line: albumLine(album, []) } : null,
    carta: meId ? `Dorsal ${numOf(meId)}${mineSlot ? `, ${POSN[mineSlot.code] ?? mineSlot.code.toLocaleLowerCase("es")}` : ""}. Lo que llevas esta temporada.` : "",
    notices: tu.notices,
    unread: tu.unread,
    pushI: null,
    pushSub: "",
  });
  const pushP = usePushPreset();
  const pushOpts = hydrated && pushP.state === "ready" ? (["nada", "goles", "todo"] as PushPreset[]).map((id) => ({ id, t: id === "nada" ? "Nada" : id === "goles" ? "Solo goles" : "Todo", on: pushP.choice === id })) : null;
  // (where this device can't take notices «Avisos a medida» stays and says why)
  const pushSub = pushOpts ? PRESET_NOTES[pushP.choice] : pushP.state === "ios-install" ? "En iPhone y iPad, añade antes la web a tu pantalla de inicio y ábrela desde ahí." : pushP.state === "denied" ? "Los avisos están bloqueados en este navegador: se permiten en los ajustes del sitio." : "Este navegador no admite avisos.";

  // a screen a viewer can't have goes home (/hoy/lo-tuyo is a player's)
  const screen: Screen = nav.screen === "lo-tuyo" && hydrated && !meId ? "portada" : nav.screen;
  const sentHome = useRef(false);
  const goHome = nav.screen === "lo-tuyo" && hydrated && !loading && !meId;
  useEffect(() => {
    if (!goHome) {
      sentHome.current = false;
      return;
    }
    if (sentHome.current) return;
    sentHome.current = true;
    nav.go("portada");
  }, [goHome, nav]);
  const isSub = screen !== "portada";

  const go = (to: Screen) => (e: React.MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    stop();
    nav.go(to, { min: to === "lo-tuyo" || to === "camiseta" ? null : minLocal });
  };
  const goPlain = (to: Screen) => {
    stop();
    nav.go(to, { min: to === "lo-tuyo" || to === "camiseta" ? null : minLocal });
  };

  // the sheets
  const hoja = nav.hoja;
  const openSheet = (h: "porra" | "mvp" | "cartel") => {
    stop();
    nav.openSheet(h, minLocal);
  };
  const closeSheet = () => nav.closeSheet(minLocal);

  const onTask = (t: Task, act: TaskAct, value?: string) => {
    switch (act) {
      case "rsvp":
        if (value !== undefined && tu.rsvp) {
          const a = (["yes", "maybe", "no"] as const)[Number(value)];
          tu.rsvp.pick(a);
          say(`Respondido: ${["vas", "en duda", "no vas"][Number(value)]}.`);
        }
        return;
      case "poll":
        if (value !== undefined && me && openPoll && !openPoll.multi) {
          setPollSent({ poll: openPoll.id, id: value });
          setPollErr("");
          votePoll(me, openPoll, [value]).then(
            () => say("Voto guardado."),
            () => {
              setPollSent(null);
              setPollErr("No se ha guardado tu voto. Inténtalo otra vez.");
            },
          );
        }
        return;
      case "porra":
        return openSheet("porra");
      case "mvp":
        return openSheet("mvp");
      case "tuyo":
        return goPlain("lo-tuyo");
      case "camiseta":
        return goPlain("camiseta");
      case "caja":
        tu.caja?.onClaim?.();
        return;
      case "turno":
        tu.turno?.onDone?.();
        return;
      case "alerts":
        return toggleAlerts();
      case "mesa":
        return;
      default:
        void t;
    }
  };

  const takeOut = async () => {
    if (pip) {
      pip.close();
      setPip(null);
      say("El marcador ha vuelto a la página.");
      return;
    }
    setPip(await openScorePip({ title: `Manchester Piti contra ${M?.rival ?? "el rival"}` }));
    say("El marcador, en su ventana.");
  };
  const act = (a: Act): ReactNode => {
    const cls = `vd-glass vd-press vd-btn${a.pri ? " vd-btn--pri" : ""}${a.desk ? " in-desk" : ""}`;
    const inner = (
      <>
        {a.icon && <PI name={a.icon} />}
        {a.t}
      </>
    );
    const id = pm?.id ?? "";
    const nid = nm?.id ?? "";
    switch (a.id) {
      case "mesa":
        return (
          <MatchLink key={a.id} id={id} mesa className={cls}>
            {inner}
          </MatchLink>
        );
      case "abrir":
      case "acta":
        return (
          <MatchLink key={a.id} id={id} className={cls} viewTransition={!reduced}>
            {inner}
          </MatchLink>
        );
      case "previa":
        return (
          <MatchLink key={a.id} id={fase === "semana" ? nid : id} className={cls}>
            {inner}
          </MatchLink>
        );
      case "llegar": {
        const f = fase === "semana" ? nm : pm;
        return (
          <a key={a.id} className={cls} href={mapsUrl(f?.venue?.trim() || (f?.home === false ? (f.rival ?? "") : "CDM Palomeras"))} target="_blank" rel="noreferrer">
            {inner}
            <span className="vd-vh"> (abre el mapa en otra pestaña)</span>
          </a>
        );
      }
      case "calendario":
        return (
          <PageLink key={a.id} to="partidos" className={cls}>
            {inner}
          </PageLink>
        );
      case "cartel":
        return (
          <button key={a.id} type="button" className={cls} aria-haspopup="dialog" onClick={() => openSheet("cartel")}>
            {inner}
          </button>
        );
      case "pip":
        return (
          <button key={a.id} type="button" className={cls} aria-pressed={!!pip} onClick={() => void takeOut()}>
            {inner}
          </button>
        );
      case "alerts":
      case "avisar":
        return (
          <button key={a.id} type="button" className={cls} aria-pressed={a.pressed ?? undefined} onClick={toggleAlerts}>
            {inner}
          </button>
        );
    }
  };

  // the kit's stills: every shirt on the page wears its player's printed still
  const kit: Kit = pm?.kit === "away" ? "away" : "home";
  const kitStillOf = usePageKitStills({ on: hydrated, theme, kits: kit === "away" ? ["away", "home"] : ["home"], players: squad });

  // the sub-screen's head
  const SUB: Record<Exclude<Screen, "portada">, { kicker: string; h: string; p: string; next: Screen | null; nextLabel: string }> = {
    campo: { kicker: campo.kicker, h: campo.h, p: campo.p, next: "jugadas", nextLabel: "Jugada a jugada" },
    jugadas: { kicker: [M?.j ? `J${M.j}` : "", M?.rival].filter(Boolean).join(" · "), h: jugadas.h, p: jugadas.p, next: "campo", nextLabel: isPreF(fase) ? "El siete" : "Los minutos de cada uno" },
    "lo-tuyo": { kicker: `${meName}${meId ? ` · dorsal ${numOf(meId)}` : ""}`, h: "Lo tuyo", p: "Lo que te toca y lo que llevas, sin buscarlo.", next: "camiseta", nextLabel: "Ponte la del Piti" },
    camiseta: { kicker: "El club", h: "Ponte la del Piti", p: "Tu nombre y tu dorsal en la espalda, como los imprime la equipación de verdad. Para el fondo de pantalla o para presumir.", next: null, nextLabel: "" },
  };
  const sub = isSub ? SUB[screen as Exclude<Screen, "portada">] : null;

  // the sheets' contents
  const pJ = fase === "semana" ? N : M;
  const scE = ctx.score ?? { us: 0, them: 0 };
  const lastOurs = P ? [...P.plays].reverse().find((p) => p.k === "gol" && p.who) : undefined;
  const cartel: CartelView | null = M && pm
    ? {
        h: `El cartel${M.j ? ` de la J${M.j}` : ""}`,
        j: M.j ? `J${M.j}` : "",
        big: scE,
        vs: `contra ${M.rival}${M.j ? ` · J${M.j} de ${M.competition.toLocaleLowerCase("es")}` : ""}`,
        when: `Final · ${M.dayLong.toLocaleLowerCase("es")}`,
        where: venueName(pm.venue ?? "") || "CDM Palomeras",
        hero: lastOurs?.who ? `El gol del ${lastOurs.m}′: ${niceOf(lastOurs.who)}` : "Se juega con la primera",
        heroNum: lastOurs?.who ? numOf(lastOurs.who) : "",
        kit,
        alt: `Cartel${M.j ? ` de la J${M.j}` : ""}: Manchester Piti contra ${M.rival}, ${scE.us}–${scE.them}, ${M.dayLong.toLocaleLowerCase("es")}`,
        file: `cartel-piti${M.j ? `-j${M.j}` : ""}.png`,
      }
    : null;
  const mvpList = P
    ? Object.entries(P.ledger)
        .filter(([id, r]) => r.min > 0 && !id.startsWith("guest:"))
        .sort((a, b) => b[1].min - a[1].min)
        .map(([id, r]) => ({ id, name: niceOf(id), num: numOf(id), min: `${r.min}′` }))
    : [];

  const pageCls = ["vx", "in", `f-${fase}`, `q-${quien}`, `s-${screen}`, dia ? "is-dia" : "", hoja ? "has-sheet" : "", isSub ? "is-sub" : "is-portada"].filter(Boolean).join(" ");
  return (
    <KitStillContext.Provider value={kitStillOf}>
      <div ref={pageRef} className={pageCls} data-phase={day.phase} aria-busy={loading} style={{ "--vd-sky-h": "1000px" } as CSSProperties}>
        <SkyLayer light={skyA} gold={fx === "gold"} cold={fx === "cold"} />
        <SkyLayer light={dia ? "day" : "flood"} gold={fx === "gold"} cold={fx === "cold"} className="pp-sky-b" style={{ opacity: dia ? 0 : floodOp }} />
        <Bokeh light={light} />
        <CelesteHeader active="inicio" sub="Manchester Piti" actions={<ThemeToggle />} />
        <main className="in-stage" id="contenido" tabIndex={-1}>
          {isSub && <SubHead cap={cap} onBack={go("portada")} />}
          <div className="in-screen" id="in-screen">
            {sub && <SubTitle kicker={sub.kicker} h={sub.h} p={sub.p} />}
            {screen === "portada" && (
              <Portada
                lens={
                  <InicioLens
                    lens={lens}
                    mov={mov}
                    playing={playing}
                    fx={fx}
                    live={live}
                    actaId={pm?.id ?? null}
                    acts={{
                      seek: (v) => {
                        stop();
                        seek(v);
                        if (!fx) flashAt(v);
                      },
                      mark: (v) => {
                        stop();
                        seek(v);
                        flashAt(v);
                      },
                      prev: () => {
                        stop();
                        jump(-1);
                      },
                      next: () => {
                        stop();
                        jump(1);
                      },
                      toggle: togglePlay,
                      back: () => {
                        stop();
                        seek(null);
                      },
                      campo: go("campo"),
                    }}
                  />
                }
                hero={hero}
                act={act}
                tasks={tasks}
                onTask={onTask}
                night={night}
                doors={doors}
                kit={kit}
                matchId={pm?.id ?? null}
                go={(to) => go(to)}
                playsAria={night.isPlays ? night.playsH : "La previa"}
                previaOut={
                  pJ ? (
                    <MatchLink id={pJ.matchId} className="vd-glass vd-press vd-btn vd-btn--sm">
                      Toda la previa
                      <PI name="chev-r" />
                    </MatchLink>
                  ) : null
                }
                numOf={numOf}
              />
            )}
            {screen === "campo" && (
              <Campo
                v={campo}
                kit={kit}
                numOf={numOf}
                duration={duration}
                playing={playing}
                playLabel={playing ? "Pausa" : "Ver la rotación"}
                minute={m}
                max={edge}
                onPick={(id) => nav.setMin(minLocal, nav.jugador === id ? null : id)}
                onToggle={(id) => nav.setMin(minLocal, nav.jugador === id ? null : id)}
                onSeek={(v) => {
                  stop();
                  seek(v);
                }}
                onPlay={togglePlay}
              />
            )}
            {screen === "jugadas" && <Jugadas v={jugadas} fi={jf} onFilter={setJf} numOf={numOf} kit={kit} />}
            {screen === "lo-tuyo" && tuyo && (
              <LoTuyo
                v={tuyo}
                tasks={tasks.all}
                onTask={onTask}
                myNum={meId ? numOf(meId) : ""}
                kit={kit}
                numOf={numOf}
                duration={duration}
                onCampo={go("campo")}
                notices={tu.notices}
                pushOpts={pushOpts}
                pushSub={pushSub}
                onPush={(id) => {
                  void pushP.set(id as PushPreset, pushP.vibrate).then(
                    () => say(id === "nada" ? "Sin avisos en este móvil." : `Avisos: ${id === "goles" ? "solo goles" : "todo"}.`),
                    () => say("No se han podido cambiar los avisos en este navegador."),
                  );
                }}
                mineAct={() => openSheet("porra")}
              />
            )}
            {screen === "camiseta" && <Camiseta key={`${meId ? `${shortOf(meId)}|${numOf(meId)}` : quien}`} initialName={meId ? shortOf(meId) : quien === "socio" ? meName.toLocaleUpperCase("es") : ""} initialNum={meId ? numOf(meId) : ""} initialKit={kit} day={dia} mine={meId ? { num: numOf(meId), short: shortOf(meId) } : null} fan={quien === "fan"} say={say} />}
            {sub && (
              <SubNext
                onBack={go("portada")}
                next={
                  sub.next && !(sub.next === "lo-tuyo" && !meId)
                    ? { label: sub.nextLabel, href: hrefOf(sub.next, { min: minLocal }), go: go(sub.next) }
                    : null
                }
              />
            )}
          </div>
        </main>
        {!isSub && <CelesteFooter />}
        <CelesteDock active="inicio" />

        <p className="vd-vh" role="status" aria-live="polite">
          {toast.t}
        </p>
        <div className={`pp-toast${toast.on ? " is-on" : ""}`} aria-hidden="true">
          <PI name="check" />
          <span>{toast.t}</span>
        </div>

        {hoja === "porra" && memberNow && pJ && (
          <PorraSheet
            sub={`${pJ.j ? `J${pJ.j} · ` : ""}${pJ.home ? "en Palomeras" : `en casa de ${pJ.rival}`} · se cierra con el pitido`}
            rival={pJ.rival}
            code={pJ.code}
            note="Las porras de los demás se ven después del pitido."
            initial={porra ?? { us: 1, them: 1 }}
            onSave={(us, them) =>
              me
                ? predictScore(me, pJ.matchId, us, them, []).then(() => {
                    closeSheet();
                    say(`Porra guardada: ${us}–${them}.`);
                  })
                : Promise.reject(new Error("sin sesión"))
            }
            onClose={closeSheet}
          />
        )}
        {hoja === "mvp" && memberNow && voteOpen && pm && (
          <MvpSheet
            sub={`${M?.j ? `J${M.j} · ` : ""}${ctx.mvp.closes ? `cierra ${ctx.mvp.closes}` : "abierta"}${ctx.mvp.total !== null && ctx.mvp.eligible ? ` · ${ctx.mvp.total} de ${ctx.mvp.eligible} ya han votado` : ""}`}
            note={`Nunca se ve quién va ganando. Los resultados${ctx.mvp.closes ? `, ${ctx.mvp.closes}` : ", al cerrar"}.`}
            list={mvpList}
            voted={tu.mvpVote}
            kit={kit}
            onVote={(id) =>
              me
                ? voteMvp(me, pm.id, id).then(() => {
                    closeSheet();
                    say(`Votas a ${niceOf(id)}.${ctx.mvp.closes ? ` Puedes cambiarlo hasta ${ctx.mvp.closes}.` : ""}`);
                  })
                : Promise.reject(new Error("sin sesión"))
            }
            onClose={closeSheet}
          />
        )}
        {hoja === "cartel" && cartel && <CartelSheet c={cartel} teeSrc={kitStillOf(kit, cartel.heroNum || undefined)?.src ?? null} onClose={closeSheet} say={say} />}

        <PipWindow pip={pip} title={`Manchester Piti contra ${M?.rival ?? "el rival"}`} onClose={() => setPip(null)}>
          <img className="vd-drop__crest" src="/crest-128.webp" alt="" />
          <span className="vd-score" role="img" aria-label={lens.scoreLabel}>
            {`${lens.us}–${lens.them}`}
          </span>
          <p>
            <b>{M?.rival ?? ""}</b>
            {fase === "descanso" ? "Descanso" : `${edge}′`}
          </p>
        </PipWindow>
      </div>
    </KitStillContext.Provider>
  );
}
