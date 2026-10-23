// El vestuario, the club's fourth room (CL- boards, part-vestuario): for the team, «¿Vas?» with your printed shirt and
// the blocks — la caja, encuestas, ausencias, turnos, entrenos y el tablón (and la puerta for the captain) —, each its
// own screen at /vestuario/<bloque>, grown in place from its card through a View Transition. A socio without a ficha
// is asked to link it first; the captain gets «Modo capitán». Without a session RootLayout shows the door
// (AccessGate → vx/Door). «Voy» / «No puedo» from a notice (?rsvp=&m=&n=) is answered here once.
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
import { useShirtStills } from "../../components/jersey3d/useShirtStills";
import { printNames } from "../../components/jersey3d/kitStill";
import { seasonStrip } from "../../lib/derived/vidrio/strip";
import { niceName } from "../../lib/derived/words";
import { madridDate } from "../../lib/derived/madrid";
import { fmtEuros, jarBalance } from "../../lib/derived/caja";
import { isPollOpen, visiblePolls } from "../../lib/derived/polls";
import { kickoffWindow } from "../../lib/derived/memberWindows";
import { slotStanding, trainingOver } from "../../lib/vestuario";
import { useAbsences, useAvailability, useBoard, useInvites, useOpenTrainings, usePolls, usePollVotes, useTeamMembers, useTrainingVotes } from "./live";
import { setAvailability, useMe } from "./writes";
import { useRsvpFromNotice } from "./useRsvpFromNotice";
import { useVxSummary } from "./vx/summary";
import { BLOQUES, type Bloque, type VxCtx } from "./vx/ctx";
import { CajaBlock } from "./vx/Caja";
import { EncuestasBlock } from "./vx/Encuestas";
import { AusenciasBlock } from "./vx/Ausencias";
import { TurnosBlock } from "./vx/Turnos";
import { EntrenosBlock } from "./vx/Entrenos";
import { TablonBlock } from "./vx/Tablon";
import { PuertaBlock } from "./vx/Puerta";
import { FichaBlock } from "./vx/Ficha";
import { Bokeh, Go, I, RoomEnd, RoomHead, Sky, Sprite, Toast, type IconName } from "../club/cb/ui";
import { useClubNav } from "../club/cb/nav";
import { dayMonth, rsvpLine, seasonFrom, weekdayDay } from "../club/cb/model";
import { readClubMaqueta } from "../club/cb/maqueta";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";
import "../../styles/vidrio/reading.css";
import "../../styles/vidrio/sky.css";
import "../../styles/vidrio/field.css";
import "../../styles/club-vidrio.css";

const route = getRouteApi("/vestuario");
const subscribeNothing = () => () => {};
const useHydrated = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);
const MIN_PLAYERS = 7;
const ROTA_ICON: Record<string, IconName> = { shirt: "shirt", ball: "ball", car: "away", bottle: "bolt", bag: "shirt", key: "lock" };
const iconOfJob = (job: { name: string; icon: string }): IconName => (/lav/i.test(job.name) ? "wash" : /mesa/i.test(job.name) ? "mesa" : (ROTA_ICON[job.icon] ?? "wash"));
/** «2026-10-31» → «31 oct». */
const dayOf = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return dayMonth(Date.UTC(y, m - 1, d, 12));
};

/** The address's block (/vestuario/<bloque>, /vestuario/encuestas/<id>). */
function blockOf(pathname: string): { bloque: Bloque | null; pollId: string | null } {
  const m = /^\/vestuario\/([^/]+)(?:\/([^/]+))?\/?$/.exec(pathname);
  if (!m) return { bloque: null, pollId: null };
  const b = m[1] as Bloque;
  return BLOQUES.includes(b) ? { bloque: b, pollId: b === "encuestas" && m[2] ? decodeURIComponent(m[2]) : null } : { bloque: null, pollId: null };
}

export function VestuarioPage() {
  const { user, profile, logout } = useAuth();
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

  // ── the toast
  const [say, setSay] = useState("");
  const [sayOn, setSayOn] = useState(false);
  const sayT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((t: string) => {
    if (sayT.current) clearTimeout(sayT.current);
    setSay(t);
    setSayOn(true);
    sayT.current = setTimeout(() => setSayOn(false), 2600);
  }, []);
  useEffect(() => () => void (sayT.current && clearTimeout(sayT.current)), []);

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
  const trainVotes = useTrainingVotes(member && training && !training.confirmed ? training.id : undefined);
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

  // ── my shirt
  const prints = printNames(squad.map((s) => ({ name: s.print, num: s.num })));
  const mine = pid ? byId.get(pid) : undefined;
  const meReq = mine?.num && prints.get(mine.num) ? { kit: "home" as const, theme, name: prints.get(mine.num) ?? "", num: mine.num } : null;
  const still = useShirtStills(hydrated && meReq ? [meReq] : [], { offMainThread: true });
  const meShirt = meReq && hydrated ? still(meReq) : undefined;

  // ── ¿Vas?
  const rs = vx.mine;
  const open = nextMatch ? kickoffWindow(nextMatch, now) === "open" : false;
  const answer = (r: "yes" | "maybe" | "no") => {
    if (!me || !nextMatch || !open) return;
    void setAvailability(me, nextMatch.id, r)
      .then(() => toast(r === "yes" ? "Apuntado: vas el domingo." : r === "maybe" ? "Apuntado como duda." : "Apuntado: no puedes el domingo.".replace("el domingo", nextJ ? `el ${weekdayDay(nextJ.at, now).split(" ")[0]}` : "")))
      .catch(() => toast("No se ha guardado tu respuesta. Inténtalo otra vez."));
  };
  const vasBtns = useRef<(HTMLButtonElement | null)[]>([]);
  const onVasKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    vasBtns.current[(i + step + 3) % 3]?.focus();
  };
  const rsvpWords = nextMatch
    ? `${rs ? "" : "Aún no has respondido. "}${vx.yes} van · ${vx.maybe} en duda · ${vx.no} no ${vx.no === 1 ? "puede" : "pueden"} · ${vx.pending} sin responder.${vx.yes >= MIN_PLAYERS ? " Hay partido." : ""}`
    : "Sin partido a la vista: el capitán lo publicará aquí.";

  // ── the blocks' living lines
  const jar = jarBalance(vx.caja.movs);
  const cajaOpen = vx.caja.movs.length > 0 || !!vx.caja.settings.cuota;
  const lastCargo = pid ? [...vx.caja.movs].filter((m) => m.playerId === pid && m.kind !== "pago" && !m.void).sort((a, b) => b.date.localeCompare(a.date))[0] : undefined;
  const pollTallyLine = openPoll
    ? `${openPoll.question} · ${openPoll.options.map((o) => `${o.label} ${pollVotes.data.filter((v) => v.optionIds.includes(o.id)).length}`).join(", ")}`
    : shown.length
      ? `${shown[0].question} · cerrada`
      : "Ninguna abierta · pregunta tú";
  const votedPoll = !!openPoll && pollVotes.data.some((v) => v.uid === uid);
  const absLine = myAbs.length ? `Del ${dayOf(myAbs[0].from)} al ${dayOf(myAbs[0].to)}${myAbs.length > 1 ? ` · y ${myAbs.length - 1} más` : ""}` : "Ninguna apuntada · avisa una vez";
  const turnLine = vx.myTurn ? `Te toca: ${vx.myTurn.job.name.toLocaleLowerCase("es")}${nextJ ? ` (J${nextJ.j})` : ""}` : vx.turns.length ? vx.turns.map((t) => `${t.job.name}: ${t.playerId ? nameOf(t.playerId) : "nadie"}`).join(" · ") : "Sin turnos para este partido";
  const standing = training && !training.confirmed ? slotStanding(training.slots, trainVotes.data) : null;
  const top = standing && training ? (training.slots.find((s) => standing.top.has(s.id)) ?? null) : null;
  const trainLine = training?.confirmed
    ? `Entreno: ${weekdayDay(training.confirmed.at, now)}, ${new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(training.confirmed.at)}`
    : training
      ? `¿Cuándo entrenamos?${top ? ` ${weekdayDay(top.at, now).replace(/^./, (c) => c.toLocaleUpperCase("es"))}, ${new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(top.at)} va ganando` : ""}`
      : "Nadie ha propuesto huecos · sé el primero";
  const lastMsg = board.data[0];
  const knockN = vx.knocking.length;
  const passes = invites.data.filter((i) => !i.revoked && (i.maxUses === 0 || i.uses < i.maxUses)).length;
  const blocks: { id: Bloque; icon: IconName; t: string; d: string; badge: string }[] = [
    { id: "caja", icon: "euro", t: "La caja", d: !cajaOpen ? "Aún no está abierta" : vx.owes ? `Debes ${fmtEuros(-vx.balance)}${lastCargo ? ` · ${lastCargo.concept}` : ""}` : vx.claim ? "Pago avisado · el capitán lo apunta" : pid ? `Al día · ${fmtEuros(jar)} en el bote` : `${fmtEuros(jar)} en el bote`, badge: vx.owes ? "Debes" : "" },
    { id: "encuestas", icon: "poll", t: "Encuestas", d: pollTallyLine, badge: openPoll && !votedPoll ? "Vota" : "" },
    { id: "ausencias", icon: "cal", t: "Mis ausencias", d: absLine, badge: "" },
    { id: "turnos", icon: vx.myTurn ? iconOfJob(vx.myTurn.job) : "wash", t: "Turnos", d: turnLine, badge: vx.myTurn ? "Te toca" : "" },
    { id: "entrenos", icon: "whistle", t: "Entrenos", d: trainLine, badge: "" },
    { id: "tablon", icon: "tab", t: "El tablón", d: lastMsg ? `${lastMsg.uid === uid ? "Tú" : lastMsg.playerId ? nameOf(lastMsg.playerId) : lastMsg.name}: «${lastMsg.text}»` : "Nadie ha escrito todavía · preséntate", badge: "" },
    ...(cap ? [{ id: "puerta" as const, icon: "lock" as const, t: "La puerta", d: `${knockN} ${knockN === 1 ? "llama" : "llaman"} · ${passes} ${passes === 1 ? "pase activo" : "pases activos"} · ${members.data.length} dentro`, badge: knockN ? String(knockN) : "" }] : []),
  ];

  // ── the screen
  const { bloque, pollId } = blockOf(location.pathname);
  const blk = bloque && (bloque !== "puerta" || cap) ? bloque : null;
  const turnSub = nextJ ? `${nextJ.home ? `${nextJ.rival}, en casa` : `En casa de ${nextJ.rival}`}, ${weekdayDay(nextJ.at, now)}${nextJ.time ? ` a las ${nextJ.time}` : ""}` : "Sin partido a la vista";
  const BT: Record<Bloque, [string, string, IconName]> = {
    caja: ["La caja", "El equipo · el dinero. Solo la lees: la llevan los capitanes.", "euro"],
    encuestas: ["Encuestas", "Pregunta algo al equipo y vota. Todos ven quién votó qué.", "poll"],
    ausencias: ["Mis ausencias", "Tú · la convocatoria", "cal"],
    turnos: [nextJ ? `Turnos de la J${nextJ.j}` : "Turnos", turnSub, "wash"],
    entrenos: ["¿Cuándo entrenamos?", "El equipo · entrenos", "whistle"],
    tablon: ["El tablón", "El vestuario habla", "tab"],
    puerta: ["La puerta", "Quién llama, quién está dentro y quién tiene pase. Un toque y abres.", "lock"],
    ficha: ["Vincula tu ficha", "Primer paso · recomendado", "shirt"],
  };
  const openBlock = (id: Bloque) => go(`/vestuario/${id}`);
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
    say: toast,
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

  return (
    <div className={`vx vd-pg cb q-${quien} s-vestuario${day ? " is-dia" : ""}`} style={{ "--vd-sky-h": "1100px" } as CSSProperties}>
      <Sky day={day} />
      <Bokeh day={day} />
      <Sprite />
      <CelesteHeader active="club" actions={<ThemeToggle />} />
      <main className="cb-main" id="cb-main">
        <div className={`cb-room cb-room--vestuario${blk ? " has-door is-blk" : ""}`}>
          {!blk && (
            <>
              <RoomHead vt="cb-room-vestuario" back={() => go("/club", { out: true, from: "vestuario" })} title="El vestuario" sub="Lo del equipo, para el equipo." />
              {cap && (
                <div className="cb-capstrip">
                  <p>
                    <b>Modo capitán</b>
                    <span>{capLine}</span>
                  </p>
                  <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={() => openBlock("puerta")}>
                    Abrir la puerta
                  </button>
                  <Go className="vd-link" href="/admin">
                    Sala de control
                  </Go>
                </div>
              )}
              {!pid && (
                <div className="cb-ficha">
                  <p className="cb-ficha__k">Primer paso · recomendado</p>
                  <b>Vincula tu ficha</b>
                  <span>Tu nombre y tu dorsal se imprimen en la camiseta y tus partidos se cuentan solos.</span>
                  <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={() => openBlock("ficha")}>
                    Elegir mi ficha
                  </button>
                </div>
              )}
              <div className="cb-vas">
                {mine && (meShirt ? <img className="cb-vas__shirt" src={meShirt} alt={`Tu camiseta: ${mine.name}, ${mine.num}`} width={540} height={600} /> : <span className="cb-vas__shirt" role="img" aria-label={`Tu camiseta: ${mine.name}, ${mine.num}`} />)}
                <div className="cb-vas__t">
                  <b>¿Vas?</b>
                  <span>{rsvpLine(nextJ, now)}</span>
                </div>
                {nextMatch && open ? (
                  <div className={`vd-glass vd-seg cb-vas__seg${rs ? "" : " cb-nobead"}`} role="radiogroup" aria-label="¿Vas al partido?" style={{ "--n": 3, "--i": rs === "maybe" ? 1 : rs === "no" ? 2 : 0 } as CSSProperties}>
                    <span className="vd-shelf__bead" aria-hidden="true" />
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
                  nextMatch && <p className="cb-small">La convocatoria se abre cuando el partido tenga fecha y se cierra a la hora del partido.</p>
                )}
                <p className="cb-vas__n">{rsvpWords}</p>
              </div>

              <ul className="cb-blocks" aria-label="Lo del equipo">
                {blocks.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      className={`cb-block${b.badge ? " has-badge" : ""}`}
                      style={{ viewTransitionName: `cb-blk-${b.id}` }}
                      onClick={() => openBlock(b.id)}
                      aria-label={`${b.t}: ${b.d}. Abrir`}
                    >
                      <span className="cb-block__i" aria-hidden="true">
                        <I n={b.icon} className={null} />
                      </span>
                      <span className="cb-block__t">
                        <b>{b.t}</b>
                        <span>{b.d}</span>
                      </span>
                      {b.badge && <span className="cb-block__badge">{b.badge}</span>}
                      <svg className="cb-block__go" aria-hidden="true" focusable="false">
                        <use href="#vi-expand" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="cb-vxfoot">
                <Go className="vd-link" href="/pizarra">
                  Abrir la pizarra
                </Go>
                <Go className="vd-link" href={pid ? `/jugadores/${pid}` : "/perfil"}>
                  {pid ? "Mi ficha" : "Mi perfil"}
                </Go>
                <button type="button" className="vd-link" onClick={() => void logout()}>
                  Salir en este dispositivo
                </button>
              </p>
              <RoomEnd label="Volver" title="El club" line="La vitrina y las cuatro puertas" go={() => go("/club", { out: true, from: "vestuario" })} />
            </>
          )}
          {blk && (
            <section className="cb-blk" aria-labelledby="cb-grow-t">
              <header className="cb-roomhead cb-blkhead">
                <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm cb-back" onClick={close}>
                  <I n="chev-l" />
                  El vestuario
                </button>
                <div className="cb-blkhead__t" style={{ viewTransitionName: `cb-blk-${blk}` }}>
                  <span className="cb-block__i" aria-hidden="true">
                    <I n={blk === "turnos" && vx.myTurn ? iconOfJob(vx.myTurn.job) : BT[blk][2]} className={null} />
                  </span>
                  <h1 id="cb-grow-t" className="cb-roomhead__t" tabIndex={-1}>
                    {BT[blk][0]}
                  </h1>
                </div>
                <p className="cb-roomhead__s">{BT[blk][1]}</p>
              </header>
              <div className="cb-blk__body">{body[blk]()}</div>
            </section>
          )}
        </div>
      </main>
      <CelesteDock active="club" />
      <Toast say={say} on={sayOn} />
    </div>
  );
}
