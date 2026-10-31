// El vestuario, the club's fourth room (the canvas prototype «Vestuario · rediseño», Vestuario.dc.html): the hub —
// «Modo capitán», «Vincula tu ficha» for a socio, «Lo que te toca» (what waits for you, one tap away), «¿Vas?» with
// your printed shirt, the seven places for «hay equipo» and who goes, and the rooms' doors with their latest — and
// each room at /vestuario/<sala> under the room bar («El vestuario» back and every room with its live word). A room
// draws its own head (its status in words) and body (vx/<Sala>.tsx). The door of a room grows into its head through a
// View Transition. Without a session RootLayout shows the door (AccessGate → vx/Door). «Voy» / «No puedo» from a
// notice (?rsvp=&m=&n=) is answered here once.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { getRouteApi, useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { useAuth } from "../../context/AuthContext";
import { useSeason } from "../../context/SeasonContext";
import { nameFor, nextFixture, playerForSeason, useClubData } from "../../lib/clubData";
import { currentSeasonId } from "../../lib/vestuario";
import { useClock } from "../../hooks/useClock";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { useViewer } from "../../hooks/useViewer";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteDock, CelesteHeader } from "../../components/celeste/Chrome";
import { KitStillContext } from "../../components/jersey3d/kitStill";
import { usePageKitStills } from "../../components/jersey3d/usePageKitStills";
import { seasonStrip } from "../../lib/derived/vidrio/strip";
import { niceName } from "../../lib/derived/words";
import { madridDate } from "../../lib/derived/madrid";
import { fmtEuros, jarBalance } from "../../lib/derived/caja";
import { closesText, isPollOpen, joinEs, visiblePolls } from "../../lib/derived/polls";
import { kickoffWindow } from "../../lib/derived/memberWindows";
import { slotStanding, trainingOver } from "../../lib/vestuario";
import { useAbsences, useAvailability, useBoard, useInvites, useOpenTrainings, usePolls, usePollVotes, useTeamMembers, useTrainingVotes } from "./live";
import { setAvailability, useMe } from "./writes";
import { useRsvpFromNotice } from "./useRsvpFromNotice";
import { useVxSummary } from "./vx/summary";
import { BLOQUES, type Bloque, type VxCtx } from "./vx/ctx";
import { Ic, PShirt, ROOM_TITLE_ID, Tile } from "./vx/kit";
import type { VIcon } from "./vx/icons";
import { CajaBlock } from "./vx/Caja";
import { EncuestasBlock } from "./vx/Encuestas";
import { AusenciasBlock } from "./vx/Ausencias";
import { TurnosBlock } from "./vx/Turnos";
import { EntrenosBlock } from "./vx/Entrenos";
import { TablonBlock } from "./vx/Tablon";
import { PuertaBlock } from "./vx/Puerta";
import { FichaBlock } from "./vx/Ficha";
import { Go, Sky } from "../club/cb/ui";
import { useClubNav } from "../club/cb/nav";
import { dayMonth, rsvpLine, seasonFrom, weekdayDay } from "../club/cb/model";
import { readClubMaqueta } from "../club/cb/maqueta";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";
import "../../styles/vidrio/reading.css";
import "../../styles/vidrio/sky.css";
import "../../styles/palco/palco.css";
import "../../styles/vestuario/vestuario.css";

const route = getRouteApi("/vestuario");
const subscribeNothing = () => () => {};
const useHydrated = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);
const MIN_PLAYERS = 7;
/** A turno's glyph (the rota's job icon). */
const JOB_ICON: Record<string, VIcon> = { shirt: "shirt", ball: "ball", car: "car", bottle: "bottle", bag: "bag", key: "key" };
/** The rooms, in the hub's order: the puerta only for a captain, «Tu ficha» only without one. */
const ROOMS: { id: Bloque; t: string; icon: VIcon }[] = [
  { id: "caja", t: "La caja", icon: "euro" },
  { id: "encuestas", t: "Encuestas", icon: "poll" },
  { id: "ausencias", t: "Mis ausencias", icon: "cal" },
  { id: "turnos", t: "Turnos", icon: "rota" },
  { id: "entrenos", t: "Entrenos", icon: "whistle" },
  { id: "tablon", t: "El tablón", icon: "board" },
  { id: "puerta", t: "La puerta", icon: "lock" },
  { id: "ficha", t: "Tu ficha", icon: "shirt" },
];
const hhmm = (ms: number) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(ms);
/** «2026-10-31» → «31 oct». */
const dayOf = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return dayMonth(Date.UTC(y, m - 1, d, 12));
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The address's room (/vestuario/<sala>, /vestuario/encuestas/<id>). */
function blockOf(pathname: string): { bloque: Bloque | null; pollId: string | null } {
  const m = /^\/vestuario\/([^/]+)(?:\/([^/]+))?\/?$/.exec(pathname);
  if (!m) return { bloque: null, pollId: null };
  const b = m[1] as Bloque;
  return BLOQUES.includes(b) ? { bloque: b, pollId: b === "encuestas" && m[2] ? decodeURIComponent(m[2]) : null } : { bloque: null, pollId: null };
}

interface Toasted {
  t: string;
  undo?: () => void;
  on: boolean;
}

export function VestuarioPage() {
  const { user, logout } = useAuth();
  const viewer = useViewer();
  const hydrated = useHydrated();
  const { matches, players } = useClubData();
  const { seasons } = useSeason();
  const now = useClock(60_000);
  const theme = useDocumentTheme();
  const day = theme === "light";
  const location = useLocation();
  const loose = useSearch({ strict: false }) as Record<string, unknown>;
  const go = useClubNav();
  const me = useMe();
  const uid = user?.uid ?? "";
  const member = viewer.member;

  // (DEV: the boards' «quién mira»; the reads and writes stay the signed-in member's)
  const mq = hydrated ? readClubMaqueta(loose) : null;
  const quien = mq?.quien && mq.quien !== "fan" ? mq.quien : viewer.admin ? "capitan" : viewer.playerId ? "jugador" : "socio";
  const cap = quien === "capitan";

  // ── the season, the squad
  const next = nextFixture(matches, now);
  const seasonId = currentSeasonId(next, matches, seasons);
  const season = seasons.find((s) => s.id === seasonId);
  const squad = useMemo(
    () =>
      players
        .filter((p) => p.seasons?.includes(seasonId) && p.active !== false)
        .map((raw) => {
          const p = playerForSeason(raw, seasonId, seasons);
          return { id: p.id, name: niceName(nameFor(p, seasonId)), print: nameFor(p, seasonId).toLocaleUpperCase("es"), num: p.number != null ? String(p.number) : "" };
        })
        .sort((a, b) => Number(a.num || 999) - Number(b.num || 999) || a.name.localeCompare(b.name, "es")),
    [players, seasonId, seasons],
  );
  const byId = useMemo(() => new Map(squad.map((s) => [s.id, s])), [squad]);
  const nameOf = useCallback((id: string) => byId.get(id)?.name ?? niceName(nameFor(players.find((p) => p.id === id), seasonId)), [byId, players, seasonId]);
  const byShirt = (n: string) => squad.find((s) => s.print === n)?.id ?? null;
  const pid = mq?.quien === "socio" ? null : mq?.quien === "jugador" ? (viewer.playerId && !viewer.admin ? viewer.playerId : byShirt("KEVIN")) : mq?.quien === "capitan" ? (viewer.playerId ?? byShirt("JORDI")) : viewer.playerId;
  const strip = useMemo(() => seasonStrip(matches, seasonId, now), [matches, seasonId, now]);
  const S = useMemo(() => seasonFrom(season?.name ?? "La temporada", strip.segments, null), [season?.name, strip.segments]);
  const nextJ = S.jornadas[S.played] ?? null;
  const nextMatch = nextJ?.match ?? next;

  // ── the printed shirts (the plantilla's stills: everyone's own name and dorsal)
  const stillOf = usePageKitStills({ on: hydrated, theme, kits: ["home"], players: squad.map((s) => ({ name: s.print, num: s.num })) });

  // ── the toast (with «Deshacer» for a few seconds when the room offers it)
  const [toast, setToast] = useState<Toasted>({ t: "", on: false });
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = useCallback((t: string, undo?: () => void) => {
    if (toastT.current) clearTimeout(toastT.current);
    setToast({ t, undo, on: true });
    toastT.current = setTimeout(() => setToast((s) => ({ ...s, on: false })), undo ? 5000 : 2600);
  }, []);
  useEffect(() => () => void (toastT.current && clearTimeout(toastT.current)), []);
  const undoToast = () => {
    const u = toast.undo;
    if (toastT.current) clearTimeout(toastT.current);
    setToast((s) => ({ ...s, on: false }));
    u?.();
  };

  // ── the vestuario at a glance
  const vx = useVxSummary({ on: member, uid, playerId: pid, admin: viewer.admin, next: nextMatch, matches, seasonId, squad: squad.length });
  const polls = usePolls(member);
  const shown = visiblePolls(polls.data, now);
  const openPoll = shown.find((p) => isPollOpen(p, now)) ?? null;
  const pollVotes = usePollVotes(member ? openPoll?.id : undefined);
  const today = madridDate(now);
  const absences = useAbsences(today, member);
  const myAbs = absences.data.filter((a) => a.uid === uid);
  const trainings = useOpenTrainings(now);
  const training = trainings.data.find((t) => !trainingOver(t, now)) ?? null;
  const trainVotes = useTrainingVotes(member && training ? training.id : undefined);
  const board = useBoard(1);
  const invites = useInvites(member && viewer.admin);
  const members = useTeamMembers(member && viewer.admin);

  // ── «Voy» / «No puedo» from a notice (?rsvp=&m=&n=): written once, then the params leave the address
  const search = route.useSearch();
  const navigate = useNavigate();
  const noticeRsvp = !!search.rsvp && !!search.m && member;
  const noticeAnswers = useAvailability(noticeRsvp ? search.m : undefined);
  useRsvpFromNotice({
    rsvp: search.rsvp,
    m: search.m,
    n: search.n,
    member,
    me,
    matches,
    matchesLoading: false,
    previous: { loading: noticeAnswers.loading, answer: noticeAnswers.data.find((a) => a.uid === uid)?.response },
    now,
    clear: () => void navigate({ to: ".", search: (prev) => ({ ...prev, rsvp: undefined, m: undefined, n: undefined }), replace: true }),
  });

  // ── ¿Vas?
  const mine = pid ? byId.get(pid) : undefined;
  const rs = vx.mine;
  const open = nextMatch ? kickoffWindow(nextMatch, now) === "open" : false;
  const dayWord = nextJ ? weekdayDay(nextJ.at, now).split(" ")[0] : "domingo";
  const answer = (r: "yes" | "maybe" | "no") => {
    if (!me || !nextMatch || !open) return;
    void setAvailability(me, nextMatch.id, r)
      .then(() => say(r === "yes" ? `Apuntado: vas el ${dayWord}.` : r === "maybe" ? "Apuntado como duda." : `Apuntado: no puedes el ${dayWord}.`))
      .catch(() => say("No se ha guardado tu respuesta. Inténtalo otra vez."));
  };
  const vasBtns = useRef<(HTMLButtonElement | null)[]>([]);
  const onVasKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    vasBtns.current[(i + step + 3) % 3]?.focus();
  };
  const countLine = `${plural(vx.yes, "va", "van")} · ${vx.maybe} en duda · ${vx.no} no ${vx.no === 1 ? "puede" : "pueden"} · ${vx.pending} sin responder.${vx.yes >= MIN_PLAYERS ? " Hay partido." : ""}`;
  const goers = vx.answers.filter((a) => a.response === "yes");
  const goersT = joinEs(goers.map((a) => (a.uid === uid ? "tú" : a.playerId ? nameOf(a.playerId) : a.name)));
  const seven = Array.from({ length: MIN_PLAYERS }, (_, i) => (i < vx.yes ? "is-yes" : i < vx.yes + vx.maybe ? "is-maybe" : ""));
  const lack = MIN_PLAYERS - vx.yes;
  const sevenT = lack <= 0 ? "Hay equipo" : `${lack === 1 ? "Falta 1" : `Faltan ${lack}`} para hacer equipo`;

  // ── the rooms' living lines
  const jar = jarBalance(vx.caja.movs);
  const cajaIsOpen = vx.caja.movs.length > 0 || !!vx.caja.settings.cuota;
  const lastCargo = pid ? [...vx.caja.movs].filter((m) => m.playerId === pid && m.kind !== "pago" && !m.void).sort((a, b) => b.date.localeCompare(a.date))[0] : undefined;
  const pollTallyLine = openPoll
    ? `${openPoll.question} · ${openPoll.options.map((o) => `${o.label} ${pollVotes.data.filter((v) => v.optionIds.includes(o.id)).length}`).join(", ")}`
    : shown.length
      ? `${shown[0].question} · cerrada`
      : "Ninguna abierta · pregunta tú";
  const votedPoll = !!openPoll && pollVotes.data.some((v) => v.uid === uid);
  const absLine = myAbs.length ? `Del ${dayOf(myAbs[0].from)} al ${dayOf(myAbs[0].to)}${myAbs.length > 1 ? ` · y ${myAbs.length - 1} más` : ""}` : "Ninguna apuntada · avisa una vez";
  const turnLine = vx.myTurn
    ? `Te toca: ${vx.myTurn.job.name.toLocaleLowerCase("es")}${nextJ ? ` (J${nextJ.j})` : ""}`
    : vx.turns.length
      ? vx.turns.map((t) => `${t.job.name}: ${t.playerId ? nameOf(t.playerId) : "nadie"}`).join(" · ")
      : "Sin turnos para este partido";
  const standing = training && !training.confirmed ? slotStanding(training.slots, trainVotes.data) : null;
  const top = standing && training ? (training.slots.find((s) => standing.top.has(s.id)) ?? null) : null;
  const conf = training?.confirmed ?? null;
  const trainLine = conf
    ? `Entreno: ${weekdayDay(conf.at, now)}, ${hhmm(conf.at)}`
    : training
      ? `¿Cuándo entrenamos?${top ? ` ${weekdayDay(top.at, now).replace(/^./, (c) => c.toLocaleUpperCase("es"))}, ${hhmm(top.at)} va ganando` : ""}`
      : "Nadie ha propuesto huecos · sé el primero";
  const lastMsg = board.data[0];
  const knockN = vx.knocking.length;
  const passes = invites.data.filter((i) => !i.revoked && (i.maxUses === 0 || i.uses < i.maxUses)).length;
  const lines: Record<Bloque, { d: string; badge: string; warn?: boolean }> = {
    caja: {
      d: !cajaIsOpen ? "Aún no está abierta" : vx.owes ? `Debes ${fmtEuros(-vx.balance)}${lastCargo ? ` · ${lastCargo.concept}` : ""}` : vx.claim ? "Pago avisado · el capitán lo apunta" : pid ? `Al día · ${fmtEuros(jar)} en el bote` : `${fmtEuros(jar)} en el bote`,
      badge: vx.owes ? "Debes" : "",
      warn: vx.owes,
    },
    encuestas: { d: pollTallyLine, badge: openPoll && !votedPoll ? "Vota" : "" },
    ausencias: { d: absLine, badge: "" },
    turnos: { d: turnLine, badge: vx.myTurn ? "Te toca" : "" },
    entrenos: { d: trainLine, badge: "" },
    tablon: { d: lastMsg ? `${lastMsg.uid === uid ? "Tú" : lastMsg.playerId ? nameOf(lastMsg.playerId) : lastMsg.name}: «${lastMsg.text}»` : "Nadie ha escrito todavía · preséntate", badge: "" },
    puerta: { d: `${knockN} ${knockN === 1 ? "llama" : "llaman"} · ${passes} ${passes === 1 ? "pase activo" : "pases activos"} · ${members.data.length} dentro`, badge: knockN ? String(knockN) : "" },
    ficha: { d: "Primer paso · elige tu nombre y tu dorsal", badge: "" },
  };
  const rooms = ROOMS.filter((r) => (r.id !== "puerta" || cap) && (r.id !== "ficha" || !pid));

  // ── «Lo que te toca»: what waits for you, one tap away
  const todo: { id: Bloque; t: string; s: string; icon: VIcon; warn?: boolean }[] = [];
  if (vx.owes) todo.push({ id: "caja", t: `Debes ${fmtEuros(-vx.balance)}`, s: "La caja · avisa cuando lo pagues", icon: "euro", warn: true });
  if (openPoll && !votedPoll && !pollVotes.loading) todo.push({ id: "encuestas", t: `Vota: ${openPoll.question.replace(/^¿/, "").replace(/\?$/, "")}`, s: `Encuestas · ${closesText(openPoll, now).toLocaleLowerCase("es")}`, icon: "poll" });
  if (vx.myTurn) todo.push({ id: "turnos", t: `Te toca: ${vx.myTurn.job.name.toLocaleLowerCase("es")}`, s: nextJ ? `Turnos · J${nextJ.j} contra ${nextJ.rival}` : "Turnos · el próximo partido", icon: JOB_ICON[vx.myTurn.job.icon] ?? "rota" });
  if (conf && !trainVotes.loading && !trainVotes.data.some((v) => v.uid === uid))
    todo.push({ id: "entrenos", t: `Entreno, ${weekdayDay(conf.at, now)}`, s: `Entrenos · ${hhmm(conf.at)}${conf.end ? `–${hhmm(conf.end)}` : ""} · ¿vas?`, icon: "whistle" });

  // ── the screen
  const { bloque, pollId } = blockOf(location.pathname);
  const blk = bloque && (bloque !== "puerta" || cap) ? bloque : null;
  const openRoom = (id: Bloque) => go(`/vestuario/${id}`);
  const close = () => go("/vestuario", { out: true });
  const felicitar = typeof loose.felicitar === "string" ? loose.felicitar : null;
  const ctx: VxCtx = {
    me,
    uid,
    playerId: pid,
    admin: viewer.admin,
    seasonId,
    seasonName: season?.name ?? "La temporada",
    matches,
    players,
    squad: squad.map((s) => ({ id: s.id, name: s.name, num: s.num })),
    nameOf,
    next: nextMatch,
    nextLine: rsvpLine(nextJ, now),
    now,
    summary: vx,
    say,
    go: (href) => go(href),
    pollId,
    felicitar,
  };
  const capLine = `${knockN} ${knockN === 1 ? "llama" : "llaman"} a la puerta · ${members.data.length} dentro`;
  const body: Record<Bloque, () => ReactNode> = {
    caja: () => <CajaBlock c={ctx} />,
    encuestas: () => <EncuestasBlock c={ctx} />,
    ausencias: () => <AusenciasBlock c={ctx} />,
    turnos: () => <TurnosBlock c={ctx} />,
    entrenos: () => <EntrenosBlock c={ctx} />,
    tablon: () => <TablonBlock c={ctx} />,
    puerta: () => <PuertaBlock c={ctx} />,
    ficha: () => <FichaBlock c={ctx} />,
  };

  // a room opened: its title takes the focus and, on the phone, its tab comes into view; back at the hub, the door of
  // the room left behind takes it
  const roomsNav = useRef<HTMLElement | null>(null);
  const hubRef = useRef<HTMLDivElement | null>(null);
  const was = useRef<Bloque | null | undefined>(undefined);
  useEffect(() => {
    const prev = was.current;
    was.current = blk;
    if (blk) {
      const on = roomsNav.current?.querySelector<HTMLElement>('[aria-current="page"]');
      if (on && roomsNav.current) roomsNav.current.scrollLeft = Math.max(0, on.offsetLeft - 12);
    }
    if (prev === undefined || prev === blk) return;
    // (a room that moved the focus itself — the poll of /vestuario/encuestas/<id> — keeps it: the title takes it only
    // from the page, the door just gone or the room bar)
    const at = document.activeElement;
    const free = !at || at === document.body || !!at.closest(".ve-bar");
    if (blk && free) document.getElementById(ROOM_TITLE_ID)?.focus({ preventScroll: true });
    else if (prev) hubRef.current?.querySelector<HTMLElement>(`[data-room="${prev}"]`)?.focus({ preventScroll: true });
  }, [blk]);

  return (
    <KitStillContext.Provider value={stillOf}>
      <div className={`vx vd-pg vst${day ? " is-dia" : ""}`} style={{ "--vd-sky-h": "1100px" } as CSSProperties}>
        <Sky day={day} />
        <CelesteHeader active="club" actions={<ThemeToggle />} />
        <main className="nx" id="ve-main">
          {!blk && (
            <div ref={hubRef}>
              <div className="ve-bar">
                <button type="button" className="vd-glass vd-press ve-back" onClick={() => go("/club", { out: true, from: "vestuario" })}>
                  <Ic name="chevL" />
                  El club
                </button>
              </div>
              <section className="ve-hero" style={{ viewTransitionName: "cb-room-vestuario" }}>
                <div>
                  <h1 className="nx-h1" tabIndex={-1}>
                    El vestuario
                  </h1>
                  <p className="nx-lede">Lo del equipo, para el equipo: la convocatoria, la caja, los turnos y el tablón.</p>
                </div>
              </section>

              {cap && (
                <section className="vd-glass ve-cap" aria-label="Modo capitán">
                  <div className="ve-cap__t">
                    <Tile icon="flag" />
                    <div>
                      <b>Modo capitán</b>
                      <span>{capLine}</span>
                    </div>
                  </div>
                  <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={() => openRoom("puerta")}>
                    <Ic name="lock" />
                    Abrir la puerta
                    {knockN > 0 && (
                      <span className="ve-badge" aria-hidden="true">
                        {knockN}
                      </span>
                    )}
                  </button>
                  <Go className="nx-lnk" href="/admin">
                    Sala de control
                  </Go>
                </section>
              )}

              {!pid && (
                <section className="vd-glass ve-first" aria-label="Primer paso">
                  <PShirt n="?" />
                  <div>
                    <span>Primer paso · recomendado</span>
                    <b>Vincula tu ficha</b>
                    <span>Tu nombre y tu dorsal se imprimen en la camiseta y tus partidos se cuentan solos.</span>
                  </div>
                  <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={() => openRoom("ficha")}>
                    Elegir mi ficha
                    <Ic name="arrow" />
                  </button>
                </section>
              )}

              <section aria-labelledby="ve-todo-h">
                <div className="ve-sub">
                  <h2 id="ve-todo-h">Lo que te toca</h2>
                  {todo.length > 0 && <p>{`${plural(todo.length, "cosa", "cosas")} · un toque y lo resuelves`}</p>}
                </div>
                {todo.length > 0 ? (
                  <div className="ve-todo">
                    {todo.map((d) => (
                      <button key={d.id} type="button" className="vd-glass vd-press ve-do" onClick={() => openRoom(d.id)}>
                        <Tile icon={d.icon} warn={d.warn} />
                        <span className="ve-do__t">
                          <b>{d.t}</b>
                          <span>{d.s}</span>
                        </span>
                        <Ic name="chevR" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="ve-calm">
                    <Tile icon="check" />
                    Estás al día: nada pendiente en el vestuario.
                  </p>
                )}
              </section>

              <div className="ve-hub">
                <section className="vd-glass vd-glass--deep ve-vas" aria-labelledby="ve-vas-h">
                  <div className="ve-vas__top">
                    {mine ? (
                      <span role="img" aria-label={`Tu camiseta: ${mine.name}, ${mine.num}`}>
                        <PShirt n={mine.num} />
                      </span>
                    ) : (
                      <PShirt n="" />
                    )}
                    <div>
                      <h2 id="ve-vas-h">¿Vas?</h2>
                      <p className="ve-vas__line">{rsvpLine(nextJ, now)}</p>
                    </div>
                  </div>
                  {nextMatch && open ? (
                    <div className="vd-glass vd-seg nx-seg" role="radiogroup" aria-label="¿Vas al partido?" style={{ "--n": 3, "--i": rs === "maybe" ? 1 : rs === "no" ? 2 : 0 } as CSSProperties}>
                      {rs && <span className="vd-shelf__bead" aria-hidden="true" />}
                      {(
                        [
                          ["yes", "Voy"],
                          ["maybe", "Duda"],
                          ["no", "No voy"],
                        ] as const
                      ).map(([r, t], i) => (
                        <button
                          key={r}
                          ref={(el) => {
                            vasBtns.current[i] = el;
                          }}
                          type="button"
                          role="radio"
                          className="vd-seg__b"
                          aria-checked={rs === r}
                          tabIndex={(rs ? rs === r : i === 0) ? 0 : -1}
                          onClick={() => answer(r)}
                          onKeyDown={(e) => onVasKey(e, i)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  ) : (
                    nextMatch && <p className="ve-vas__count">La convocatoria se abre cuando el partido tenga fecha y se cierra a la hora del partido.</p>
                  )}
                  {nextMatch ? (
                    <>
                      <p className="ve-vas__count">
                        {!rs && <b>Aún no has respondido. </b>}
                        {countLine}
                      </p>
                      <div className="ve-vas__go">
                        <div className="ve-seven" role="img" aria-label={`${vx.yes} de ${MIN_PLAYERS} para hacer equipo, ${vx.maybe} en duda`}>
                          {seven.map((cls, i) => (
                            <i key={i} className={cls || undefined} />
                          ))}
                          <b>{sevenT}</b>
                        </div>
                        {goers.length > 0 && (
                          <div className="ve-shirts" aria-hidden="true">
                            {goers.map((a) => (
                              <PShirt key={a.uid} n={(a.playerId && byId.get(a.playerId)?.num) || ""} />
                            ))}
                          </div>
                        )}
                        <p>{goers.length ? `Van: ${goersT}` : "Nadie ha dicho «Voy» todavía."}</p>
                      </div>
                    </>
                  ) : (
                    <p className="ve-vas__count">Sin partido a la vista: el capitán lo publicará aquí.</p>
                  )}
                </section>

                <section aria-labelledby="ve-rooms-h">
                  <div className="ve-sub">
                    <h2 id="ve-rooms-h">Las salas</h2>
                    <p>Cada una con lo último</p>
                  </div>
                  <ul className="ve-grid" aria-label="Lo del equipo">
                    {rooms.map((r) => {
                      const L = lines[r.id];
                      return (
                        <li key={r.id}>
                          <button type="button" className="vd-glass vd-press ve-door" data-room={r.id} style={{ viewTransitionName: `cb-blk-${r.id}` }} onClick={() => openRoom(r.id)} aria-label={`${r.t}: ${L.d}. Abrir`}>
                            <Tile icon={r.icon} warn={L.warn} />
                            <span className="ve-door__t">
                              <b>{r.t}</b>
                              <span>{L.d}</span>
                            </span>
                            <span className="ve-door__end">
                              {L.badge && <span className={`ve-badge${L.warn ? " ve-badge--warn" : ""}`}>{L.badge}</span>}
                              <Ic name="chevR" />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <nav className="ve-foot" aria-label="Más">
                    <Go className="nx-lnk" href="/pizarra">
                      Abrir la pizarra
                    </Go>
                    <Go className="nx-lnk" href={pid ? `/jugadores/${pid}` : "/perfil"}>
                      {pid ? "Mi ficha" : "Mi perfil"}
                    </Go>
                    <button type="button" className="nx-lnk" onClick={() => void logout()}>
                      Salir en este dispositivo
                    </button>
                  </nav>
                </section>
              </div>
            </div>
          )}

          {blk && (
            <>
              <div className="ve-bar">
                <button type="button" className="vd-glass vd-press ve-back" onClick={close}>
                  <Ic name="chevL" />
                  El vestuario
                </button>
                <nav ref={roomsNav} className="vd-glass ve-rooms" aria-label="Las salas del vestuario">
                  {rooms.map((r) => {
                    const L = lines[r.id];
                    const here = r.id === blk;
                    return (
                      <button key={r.id} type="button" className="ve-room" aria-current={here ? "page" : undefined} onClick={() => !here && openRoom(r.id)}>
                        <Ic name={r.icon} />
                        {r.t}
                        {L.badge && !here && <span className={`ve-badge${L.warn ? " ve-badge--warn" : ""}`}>{L.badge}</span>}
                      </button>
                    );
                  })}
                </nav>
              </div>
              {body[blk]()}
            </>
          )}
        </main>
        <CelesteDock active="club" />
        <p className="nx-vh" role="status" aria-live="polite">
          {toast.on ? toast.t : ""}
        </p>
        <div className={`ve-toast${toast.on ? " is-on" : ""}`} aria-hidden={toast.on ? undefined : true}>
          <Ic name="check" />
          <span aria-hidden="true">{toast.t}</span>
          {toast.on && toast.undo && (
            <button type="button" onClick={undoToast}>
              Deshacer
            </button>
          )}
        </div>
      </div>
    </KitStillContext.Provider>
  );
}
