// El club (CL- boards, ronda 3): a house — the vitrina at the entrance and four doors, La historia, El equipo, La
// gente and El vestuario (the fourth, /vestuario, is its own page). Each door shows something alive of its room and
// grows into the room's head (cb/nav); each room ends in the next one. The screen is the address (cb/nav
// clubScreenOf); the server paints the public club, what is a member's appears once the viewer is known.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useLocation, useSearch } from "@tanstack/react-router";
import { useClubContent } from "../../lib/clubContent";
import { socialLinks } from "../../lib/social";
import { readKits, readTrophies } from "../../lib/clubExtras";
import { dateMillis, nameFor, nextFixture, playerForSeason, useClubData } from "../../lib/clubData";
import { currentSeasonId, mvpWinners } from "../../lib/vestuario";
import { useSeason } from "../../context/SeasonContext";
import { useClock } from "../../hooks/useClock";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { useViewer } from "../../hooks/useViewer";
import { useAuth } from "../../context/AuthContext";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteDock, CelesteHeader } from "../../components/celeste/Chrome";
import { useLightPointer } from "../../components/vidrio";
import { useShirtStills } from "../../components/jersey3d/useShirtStills";
import { printNames, type Kit } from "../../components/jersey3d/kitStill";
import type { StillRequest } from "../../components/jersey3d/scene";
import { seasonStrip } from "../../lib/derived/vidrio/strip";
import { useStandings } from "../../lib/useStandings";
import { mvpVoteOpen } from "../../lib/derived/memberWindows";
import { mapsUrl, siteOrigin, venueMapsUrl, venueName } from "../../lib/derived/venue";
import { niceName } from "../../lib/derived/words";
import { useMvpResults } from "../vestuario/live";
import { keyEvents } from "../partidos/pa/season";
import { useVxSummary } from "../vestuario/vx/summary";
import { Bokeh, RoomEnd, RoomHead, Sky, Sprite, Toast, type ObjCtx } from "./cb/ui";
import { Hub, type Door } from "./cb/Hub";
import { Historia } from "./cb/Historia";
import { Equipo, type Venue } from "./cb/Equipo";
import { Maker } from "./cb/Maker";
import { Gente } from "./cb/Gente";
import { clubScreenOf, roomLeft, ROOM_T, ROOMS, SALA_PATH, useClubNav, type Room } from "./cb/nav";
import {
  BDAY_DAYS,
  bdayWhen,
  birthdaysOf,
  dayMonth,
  defaultPiece,
  doorLineOf,
  historiaLive,
  letterOf,
  minePieces,
  nextLine,
  piecesOf,
  posText,
  scoreOfJ,
  seasonFrom,
  vasLine,
  weekdayDay,
  type PieceId,
} from "./cb/model";
import { demoContent, readClubMaqueta, type Quien } from "./cb/maqueta";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";
import "../../styles/vidrio/reading.css";
import "../../styles/vidrio/sky.css";
import "../../styles/vidrio/field.css";
import "../../styles/club-vidrio.css";

const subscribeNothing = () => () => {};
/** False on the server and while the browser takes over, true after (member data never renders on the server). */
const useHydrated = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);
const ROOM_SUB: Record<Exclude<Room, "vestuario">, string> = {
  historia: "De dónde venimos y cada jornada, con la línea del club.",
  equipo: "Las camisetas por delante y por detrás, el escudo, la plantilla y los campos.",
  gente: "Quién cumple, quién nos apoya y cómo hablar con el club.",
};

export function ClubPage() {
  const raw = useClubContent();
  const club = useClubData();
  const realSeasons = useSeason().seasons;
  const clockNow = useClock(30_000);
  const theme = useDocumentTheme();
  const day = theme === "light";
  const viewer = useViewer();
  const { profile, user } = useAuth();
  const hydrated = useHydrated();
  const location = useLocation();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const go = useClubNav();
  const pageRef = useRef<HTMLDivElement | null>(null);
  useLightPointer(pageRef);

  // (DEV: the boards' maqueta strip)
  const mq = hydrated ? readClubMaqueta(search) : null;
  const [longDemo, setLongDemo] = useState<null | import("../partidos/pa/demo").Demo>(null);
  useEffect(() => {
    if (mq?.larga) void import("../partidos/pa/demo").then((m) => setLongDemo(m.demoSeason(null)));
  }, [mq?.larga]);
  const demo = mq?.larga ? longDemo : null;
  const c = mq?.demo ? demoContent(raw) : raw;
  const social = socialLinks(c);
  // (r12 M-19: the kits and the trophies, from the content when it has them, else the code's)
  const kits = useMemo(() => readKits(c), [c]);
  const trophies = useMemo(() => readTrophies(c), [c]);
  const matches = demo ? demo.matches : club.matches;
  const players = demo ? (demo.players as unknown as typeof club.players) : club.players;
  const seasons = useMemo(() => (demo ? [...realSeasons, demo.season] : realSeasons), [demo, realSeasons]);
  // (estreno: three days before the season's first match, at 10:00)
  const estrenoNow = useMemo(() => {
    if (!mq?.estreno) return null;
    const sid = currentSeasonId(nextFixture(matches, clockNow), matches, seasons);
    const first = Math.min(...matches.filter((m) => m.seasonId === sid).map((m) => dateMillis(m.date)).filter(Number.isFinite));
    return Number.isFinite(first) ? first - 3 * 86_400_000 - ((first % 86_400_000) - 8 * 3_600_000) : null;
  }, [mq?.estreno, matches, clockNow, seasons]);
  const now = demo ? demo.now : (estrenoNow ?? clockNow);
  // (and every match from then on is still to be played)
  const shown = useMemo(
    () => (estrenoNow === null ? matches : matches.map((m) => (dateMillis(m.date) > estrenoNow ? { ...m, status: "scheduled" as const, events: [], ledger: undefined, goalsFor: undefined, goalsAgainst: undefined, voteClosesAt: undefined, clock: undefined } : m))),
    [matches, estrenoNow],
  );

  // ── who is looking (only after hydration: the server paints the afición's club)
  const member = hydrated && viewer.member;
  const quien: Quien = mq?.quien ?? (!member ? "fan" : viewer.admin ? "capitan" : viewer.playerId ? "jugador" : "socio");
  const fan = quien === "fan";
  const cap = quien === "capitan";

  // ── the season, the squad, the names
  const next = nextFixture(shown, now);
  const seasonId = demo ? demo.season.id : currentSeasonId(next, shown, seasons);
  const season = seasons.find((s) => s.id === seasonId);
  const squad = useMemo(
    () =>
      players
        .filter((p) => p.seasons?.includes(seasonId) && p.active !== false)
        .map((raw) => {
          const p = playerForSeason(raw, seasonId, seasons);
          const short = niceName(nameFor(p, seasonId));
          return { id: p.id, name: short, print: nameFor(p, seasonId).toLocaleUpperCase("es"), num: p.number != null ? String(p.number) : "", full: [p.firstName, p.lastName].filter(Boolean).join(" ") || short, birthDate: p.birthDate };
        })
        .sort((a, b) => Number(a.num || 999) - Number(b.num || 999) || a.name.localeCompare(b.name, "es")),
    [players, seasonId, seasons],
  );
  const byId = useMemo(() => new Map(squad.map((s) => [s.id, s])), [squad]);
  const nameOf = useCallback((id: string) => byId.get(id)?.name ?? niceName(nameFor(players.find((p) => p.id === id), seasonId)), [byId, players, seasonId]);
  const squadIds = useMemo(() => new Set(squad.map((s) => s.id)), [squad]);
  // (DEV: the viewer the maqueta asks for, with a ficha of the squad)
  const byShirt = (n: string) => squad.find((s) => s.print === n)?.id ?? null;
  const pid = mq?.quien ? (mq.quien === "jugador" ? (viewer.playerId && byId.has(viewer.playerId) && !viewer.admin ? viewer.playerId : byShirt("KEVIN")) : mq.quien === "capitan" ? (viewer.playerId ?? byShirt("JORDI")) : null) : member ? viewer.playerId : null;
  const meName = pid ? nameOf(pid) : niceName(profile?.nickname ?? "");

  const strip = useMemo(() => seasonStrip(shown, seasonId, now), [shown, seasonId, now]);
  const { standings } = useStandings(demo ? undefined : seasonId);
  const table = demo ? demo.standings : standings;
  const us = table?.rows.findIndex((r) => r.isUs) ?? -1;
  const S = useMemo(() => seasonFrom(season?.name ?? "La temporada", strip.segments, us >= 0 && table ? { pos: us + 1, of: table.rows.length } : null), [season?.name, strip.segments, us, table]);
  const pieces = useMemo(() => piecesOf({ season: S, nameOf, squad: squadIds, trophies }), [S, nameOf, squadIds, trophies]);
  const nextJ = S.jornadas[S.played] ?? null;

  // ── the screen, the piece in focus
  const { sala, pieza } = clubScreenOf(location.pathname);
  const focus: PieceId = pieza && pieces.some((p) => p.id === pieza) ? pieza : defaultPiece(pieces);

  // ── the stills: the kit by the front and the back, the squad's printed shirts (after hydration)
  const kitReq = (kit: Kit, side: "front" | "back"): StillRequest => ({ kit, theme, name: "", num: "", yaw: side === "front" ? Math.PI : 0 });
  const prints = printNames(squad.map((s) => ({ name: s.print, num: s.num })));
  const own = (num: string): StillRequest | null => (num && prints.get(num) ? { kit: "home", theme, name: prints.get(num) ?? "", num } : null);
  const reqs: StillRequest[] = hydrated ? [kitReq("home", "front"), kitReq("home", "back"), kitReq("away", "front"), kitReq("away", "back"), ...squad.map((s) => own(s.num)).filter((r): r is StillRequest => !!r)] : [];
  const still = useShirtStills(reqs, { offMainThread: true });
  const kitStill = (kit: Kit, side: "front" | "back") => (hydrated ? still(kitReq(kit, side)) : undefined);
  const shirtOf = (id: string) => {
    const r = own(byId.get(id)?.num ?? "");
    return hydrated && r ? still(r) : undefined;
  };

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

  // ── the vestuario's door (a member's counts, his pending things; a captain's knocks)
  const vx = useVxSummary({ on: member, uid: user?.uid ?? "", playerId: pid, admin: viewer.admin, next: nextJ?.match, matches: shown, seasonId, squad: squad.length });
  const knockN = vx.knocking.length;
  const vesBadge = fan ? 0 : cap ? knockN : (vx.owes ? 1 : 0) + (vx.mine || !nextJ ? 0 : 1) + (vx.myTurn ? 1 : 0);

  // ── birthdays (30 days, Inicio's rule)
  const bdays = birthdaysOf(squad, now);
  const soon = bdays.filter((b) => b.days <= BDAY_DAYS);
  const b1 = soon[0] ?? null;
  const b2 = soon[1] ?? null;

  // ── the doors
  const dl = doorLineOf(S);
  const vesLive = fan ? "Solo plantilla. ¿Juegas en el Piti? Entra." : cap ? (knockN ? `${knockN} llaman a la puerta` : "Nadie llama a la puerta") : vx.mine ? "Respondido para el domingo".replace("el domingo", nextJ ? `el ${weekdayDay(nextJ.at, now).split(" ")[0]}` : "el partido") : vasLine(nextJ, now);
  const mkLine = pid ? `La tuya ya está: ${(byId.get(pid)?.print ?? meName.toLocaleUpperCase("es"))} y el ${byId.get(pid)?.num ?? ""}. O hazte otra.` : "Tu nombre y tu dorsal en la espalda, como la de verdad.";
  const sponsors = (c.sponsors ?? []).filter((s) => s?.name?.trim());
  const ini = (n: string) =>
    n
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .join("")
      .slice(0, 2)
      .toLocaleUpperCase("es");
  const doors: Door[] = [
    { id: "historia", t: ROOM_T.historia, k: "Sala 1 · la línea del club", live: historiaLive(S), badge: 0, badgeText: "", ...dl },
    { id: "equipo", t: ROOM_T.equipo, k: "Sala 2 · camisetas y campos", live: pid ? `Tu ${byId.get(pid)?.num ?? ""} te espera: Ponte la del Piti` : "Ponte la del Piti, con tu nombre", badge: 0, badgeText: "", front: kitStill("home", "front"), shirt: pid ? shirtOf(pid) : kitStill("home", "back") },
    {
      id: "gente",
      t: ROOM_T.gente,
      k: "Sala 3 · cumpleaños y contacto",
      live: b1 ? `${b1.name} cumple ${b1.age} ${bdayWhen(b1, now)}` : sponsors.length ? `${sponsors.length} nos apoyan · el hueco se alquila` : "El hueco del patrocinio se alquila",
      badge: 0,
      badgeText: "",
      ...(b1 ? { person: shirtOf(b1.id) ?? kitStill("home", "back"), person2: b2 ? (shirtOf(b2.id) ?? undefined) : undefined, day: String(new Date(b1.at).getUTCDate()), month: dayMonth(b1.at).split(" ")[1] } : {}),
      cal: nextJ ? { day: String(dayMonth(nextJ.at).split(" ")[0]), month: dayMonth(nextJ.at).split(" ")[1], t: `J${nextJ.j} · ${nextJ.rival}` } : undefined,
      spons: sponsors.slice(0, 2).map((s) => ini(s.name)),
    },
    {
      id: "vestuario",
      t: ROOM_T.vestuario,
      k: fan ? "Sala 4 · solo plantilla" : "Sala 4 · lo del equipo",
      live: vesLive,
      badge: vesBadge,
      badgeText: vesBadge ? (cap ? `${vesBadge} llaman` : `${vesBadge === 1 ? "1 cosa pendiente" : `${vesBadge} cosas pendientes`}`) : "",
      sign: fan ? "Solo plantilla" : cap && knockN ? `Llaman: ${knockN}` : vx.mine ? "Dentro" : "¿Vas?",
      chips: fan ? ["Convocatorias", "La porra", "La caja"] : [`${vx.yes} van`, `${vx.maybe} duda`, `${vx.pending} sin responder`],
    },
  ];

  // ── moving between screens
  const openRoom = (id: Room) => go(SALA_PATH[id], { from: null });
  const toHub = (from: Room | null) => go(SALA_PATH.hub, { out: true, from });
  const pick = (id: PieceId) => void go(id === defaultPiece(pieces) ? "/club" : `/club/vitrina/${id}`, { replace: true });
  const share = async () => {
    const url = `${siteOrigin()}/club`;
    try {
      if (typeof navigator.share === "function") await navigator.share({ title: "Manchester Piti · El club", url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Enlace copiado. Pásalo al grupo.");
      }
    } catch {
      /* the share sheet closed */
    }
  };
  const roomFoot = (room: Exclude<Room, "vestuario">) => {
    const i = ROOMS.indexOf(room);
    const nr = ROOMS[i + 1];
    return (
      <RoomEnd
        label="Siguiente sala"
        title={ROOM_T[nr]}
        line={doors[i + 1].live}
        go={(e) => {
          e.currentTarget.style.viewTransitionName = `cb-room-${nr}`;
          go(SALA_PATH[nr]);
        }}
      />
    );
  };

  // ── the head's words
  const where = [c.location && c.founded ? `En ${c.location} desde ${c.founded}.` : c.location ? `En ${c.location}.` : c.founded ? `Desde ${c.founded}.` : ""].filter(Boolean);
  const headSub = [...where, "Lo que se gana se queda aquí; lo que se está jugando, también."].join(" ");
  const ticketJ = S.jornadas[0];
  const ctx: ObjCtx = {
    front: kitStill("home", "front"),
    ticket: { j: ticketJ ? `J1 · ${dayMonth(ticketJ.at)}` : "J1", score: ticketJ && ticketJ.gf !== null ? scoreOfJ(ticketJ) : "J1", rival: ticketJ?.rival ?? "", venue: ticketJ?.venue ? niceVenue(ticketJ.venue) : "" },
  };

  // ── the member's own pieces
  const mvpResults = useMvpResults();
  const mine = (() => {
    if (!pid || fan) return null;
    const played = S.jornadas.slice(0, S.played);
    const wins = played.filter((x) => mvpWinners(x.match, mvpResults.get(x.id), now).includes(pid)).length;
    const lastM = played[played.length - 1]?.match;
    return { name: meName, list: minePieces({ playerId: pid, season: S, nameOf, mvpWins: wins, mvpOpen: !!lastM && mvpVoteOpen(lastM, now) }) };
  })();

  // ── La historia's words
  const lastJ = S.played ? S.jornadas[S.played - 1] : null;
  const seasonLine = S.played === 0 ? `${S.name} · por estrenar · ${S.jornadas.length} jornadas` : `${S.name} · en curso · ${posText(S)} tras la J${S.played}${demo ? " (demo)" : ""}`;
  const firstReal = S.jornadas.find((x) => x.gf !== null);
  const moments = [
    ...(c.milestones ?? []).filter((m) => m?.title?.trim()).map((m) => ({ y: m.year, t: m.title, d: m.text, cls: "", href: null as string | null })),
    firstReal
      ? { y: dayMonth(firstReal.at), t: "El primer partido de nuestro archivo", d: `${firstReal.date} · Manchester Piti ${scoreOfJ(firstReal)} ${firstReal.rival}`, cls: "is-ticket", href: `/partidos/${firstReal.id}` }
      : S.jornadas[0]
        ? { y: dayMonth(S.jornadas[0].at), t: "El primer partido", d: `${weekdayDay(S.jornadas[0].at, now)}, contra ${S.jornadas[0].rival}${S.jornadas[0].venue ? `, en el ${niceVenue(S.jornadas[0].venue)}` : ""}. Aquí quedará su resultado.`, cls: "is-ghost", href: null }
        : { y: "", t: "El primer partido", d: "Aquí quedará su resultado.", cls: "is-ghost", href: null },
  ];
  const story = c.story || "";
  const meta = [c.founded ? `Desde ${c.founded}` : "", c.location].filter(Boolean).join(" · ");
  const extra = [story, c.founded && c.location ? `Desde ${c.founded}, en ${c.location}.` : "", c.crestStory ? `El escudo: ${c.crestStory.charAt(0).toLocaleLowerCase("es")}${c.crestStory.slice(1)}` : ""].filter(Boolean).join(" ");
  const last = lastJ ? { k: `J${lastJ.j} · ${lastJ.home ? "en casa" : "fuera"} · ${lastJ.date}`, ...lastStory(lastJ, S, nameOf, mvpResults.get(lastJ.id), now) } : null;

  // ── El equipo's
  const capPid = season?.captainPlayerId && byId.has(season.captainPlayerId) ? season.captainPlayerId : null;
  const captain = capPid ? `Capitán: ${nameOf(capPid)}${byId.get(capPid)?.num ? `, el ${byId.get(capPid)?.num}` : ""}. ` : "";
  const venues: Venue[] = venuesOf(c, S, now);

  // ── the page
  const scr = sala === "vestuario" ? "hub" : sala;
  const cls = ["vx", "vd-pg", "cb", `q-${quien}`, `s-${scr === "camiseta" ? "equipo" : scr}`, day ? "is-dia" : ""].filter(Boolean).join(" ");
  return (
    <div className={cls} ref={pageRef} style={{ "--vd-sky-h": "1100px" } as CSSProperties} aria-busy={club.loading}>
      <Sky day={day} />
      <Bokeh day={day} />
      <Sprite />
      <CelesteHeader active="club" actions={<ThemeToggle />} />
      <main className="cb-main" id="cb-main">
        {scr === "hub" && (
          <Hub
            headSub={headSub}
            next={{ text: `Lo próximo: ${nextLine(nextJ, now)}`, href: nextJ ? `/partidos/${nextJ.id}` : "/partidos" }}
            share={() => void share()}
            social={social}
            pieces={pieces}
            focus={focus}
            pick={pick}
            seasonName={S.name}
            ctx={ctx}
            back={kitStill("home", "back")}
            mine={mine}
            doors={doors}
            from={roomLeft()}
            open={(id) => openRoom(id)}
          />
        )}
        {scr === "historia" && (
          <div className="cb-room cb-room--historia">
            <RoomHead vt="cb-room-historia" back={() => toHub("historia")} title={ROOM_T.historia} sub={ROOM_SUB.historia} extra={extra} />
            <Historia S={S} pieces={pieces} seasonLine={seasonLine} last={last} moments={moments} story={story} meta={meta} crest={c.crestStory ?? ""} gallery={(c.gallery ?? []).filter((g) => /^https:\/\//.test(g?.url ?? ""))} cap={cap} say={toast} />
            {roomFoot("historia")}
          </div>
        )}
        {scr === "equipo" && (
          <div className="cb-room cb-room--equipo">
            <RoomHead vt="cb-room-equipo" back={() => toHub("equipo")} title={ROOM_T.equipo} sub={ROOM_SUB.equipo} />
            <Equipo
              still={kitStill}
              mk={{ shirt: pid ? shirtOf(pid) : kitStill("home", "back"), line: mkLine, open: () => go(SALA_PATH.camiseta) }}
              squad={squad.map((s) => ({ id: s.id, src: shirtOf(s.id), alt: `${s.full}, ${s.name}, dorsal ${s.num}` }))}
              captain={captain}
              toCrest={() => go("/club/vitrina/escudo", { out: true, from: null })}
              photo={/^https:\/\//.test(c.photoUrl ?? "") ? c.photoUrl : ""}
              venues={venues}
              cap={cap}
              kits={kits}
            />
            {roomFoot("equipo")}
          </div>
        )}
        {scr === "camiseta" && <Maker people={squad.filter((s) => s.num && prints.get(s.num)).map((s) => ({ id: s.id, name: s.name, num: s.num, print: prints.get(s.num) ?? s.print }))} mine={pid} day={day} back={() => go(SALA_PATH.equipo, { out: false })} say={toast} />}
        {scr === "gente" && (
          <div className="cb-room cb-room--gente">
            <RoomHead vt="cb-room-gente" back={() => toHub("gente")} title={ROOM_T.gente} sub={ROOM_SUB.gente} />
            <Gente
              fan={fan}
              member={!fan}
              cap={cap}
              bday={
                b1
                  ? {
                      id: b1.id,
                      t: `${b1.name} cumple ${b1.age} ${bdayWhen(b1, now)}`,
                      d: `${b1.full}${b1.num ? `, el ${b1.num}` : ""}. Que no se te pase felicitarle.`,
                      shirt: shirtOf(b1.id),
                      shirtAlt: `La camiseta de ${b1.name}${b1.num ? `, dorsal ${b1.num}` : ""}`,
                      next2: b2 ? { t: `Y luego ${b2.name}: ${b2.age} ${bdayWhen(b2, now)}.`, shirt: shirtOf(b2.id) } : null,
                    }
                  : null
              }
              list={bdays.slice(0, 6).map((b) => ({ id: b.id, name: b.name, full: b.full, when: dayMonth(b.at), age: `cumple ${b.age}`, src: shirtOf(b.id), label: `${b.full}, ${b.name}: cumple ${b.age} el ${dayMonth(b.at)}` }))}
              sponsors={sponsors.map((s) => ({ name: s.name, url: /^https:\/\//.test(s.url ?? "") ? s.url : "", ini: ini(s.name) }))}
              email={c.email ?? ""}
              social={social}
              faq={(c.faq ?? []).filter((f) => f?.q?.trim() && f?.a?.trim())}
              feed={`${siteOrigin()}/calendario.ics`}
              congrats={() => b1 && go(`/vestuario/tablon?felicitar=${encodeURIComponent(b1.id)}`)}
              door={() => go("/vestuario")}
              invite={() => go("/vestuario?invitacion=1")}
              say={toast}
            />
            {roomFoot("gente")}
          </div>
        )}
      </main>
      <CelesteDock active="club" />
      <Toast say={say} on={sayOn} />
    </div>
  );
}

/** «CDM PALOMERAS» → «CDM Palomeras». */
function niceVenue(v: string): string {
  return v
    .split(/\s+/)
    .map((w) => (/^[A-ZÁÉÍÓÚÑ]{2,4}$/.test(w) && /^(CDM|IDM|CD|UD|CF|FC|SAD)$/.test(w) ? w : w.charAt(0) + w.slice(1).toLocaleLowerCase("es")))
    .join(" ");
}

/** La historia's last jornada in a line: a title and what happened (the goals, who played, the MVP). */
function lastStory(x: import("./cb/model").Jor, S: import("./cb/model").ClubSeason, nameOf: (id: string) => string, mvp: import("../../lib/vestuario").MvpResult | undefined, now: number): { t: string; d: string } {
  if (x.off) return { t: "Aplazado", d: `La J${x.j} contra ${x.rival} se jugará otro día.` };
  const gf = x.gf ?? 0;
  const ga = x.ga ?? 0;
  const L = letterOf(x);
  const first = S.jornadas.slice(0, S.played).filter((j) => j.gf !== null)[0]?.j === x.j;
  const t = first ? (L === "G" ? "El primer partido, la primera victoria" : L === "E" ? "Un empate para abrir el archivo" : "Una tarde dura para abrir el archivo") : L === "G" ? (gf - ga === 1 ? "La última, por la mínima" : "La última, ganada") : L === "E" ? "La última, en tablas" : ga - gf === 1 ? "La última, por la mínima" : "La última, cuesta arriba";
  const goals = keyEvents(x.match).filter((e) => e.k === "g" && e.who);
  const scorers = [...new Set(goals.map((e) => e.who as string))].map(nameOf);
  const played = Object.values(x.match.ledger ?? {}).filter((v) => v.played).length;
  const winners = mvpWinnersOf(x, mvp, now);
  const goalLine = gf === 0 ? "Sin goles nuestros." : gf === 1 && scorers.length === 1 ? `El gol: ${scorers[0]}${goalMinute(goals[0]?.min)}.` : scorers.length ? `Los goles: ${listY(scorers)}.` : "";
  const playedLine = played ? ` Jugaron ${NUMW[played] ?? played}${(x.match.events ?? []).some((e) => e.type === "substitution") ? " y se rotó todo el partido" : ""}.` : "";
  const mvpLine = winners.open ? ` El MVP sigue en votación${winners.votes !== null ? `: ${winners.votes} de ${winners.of}` : ""}.` : winners.names.length ? ` MVP: ${listY(winners.names.map(nameOf))}.` : "";
  return { t, d: `${goalLine}${playedLine}${mvpLine}`.trim() };
}
const NUMW = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis"];
const listY = (xs: readonly string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const goalMinute = (min: number | undefined) => (typeof min === "number" ? `, en el ${min}′` : "");
function mvpWinnersOf(x: import("./cb/model").Jor, mvp: import("../../lib/vestuario").MvpResult | undefined, now: number): { open: boolean; votes: number | null; of: number | null; names: string[] } {
  const open = mvpVoteOpen(x.match, now);
  if (open) return { open, votes: mvp?.total ?? null, of: typeof mvp?.eligible === "number" && mvp.eligible > 0 ? mvp.eligible : null, names: [] };
  return { open, votes: null, of: null, names: mvpWinners(x.match, mvp, now) };
}

/** Los campos: the club's published grounds, else the grounds of the season's matches; each with its next match. */
function venuesOf(c: import("../../lib/clubContentDefaults").ClubContent, S: import("./cb/model").ClubSeason, now: number): Venue[] {
  const upcoming = S.jornadas.slice(S.played).filter((x) => !x.off && x.at > now);
  const nextAt = (name: string) => upcoming.find((x) => x.venue && venueName(x.venue).toLocaleLowerCase("es") === venueName(name).toLocaleLowerCase("es"));
  const nextText = (name: string) => {
    const x = nextAt(name);
    return x ? `Próximo allí: J${x.j} contra ${x.rival}, ${weekdayDay(x.at, now)}${x.time ? ` a las ${x.time}` : ""}` : "";
  };
  const homeAt = (name: string) => S.jornadas.some((x) => x.home && x.venue && venueName(x.venue).toLocaleLowerCase("es") === venueName(name).toLocaleLowerCase("es"));
  const list = (c.venues ?? []).filter((v) => v?.name?.trim());
  if (list.length)
    return list.map((v) => ({ name: v.name, tag: homeAt(v.name) || list.indexOf(v) === 0 ? "En casa" : "Fuera", address: v.address ?? "", transit: v.transit ?? "", next: nextText(v.name), maps: venueMapsUrl(v) }));
  const names = [...new Set(S.jornadas.map((x) => x.venue).filter(Boolean))];
  if (!names.length && c.venue) names.push(venueName(c.venue));
  return names.map((n) => ({ name: niceVenue(n), tag: homeAt(n) ? "En casa" : "Fuera", address: "", transit: "", next: nextText(n), maps: mapsUrl(n) }));
}
