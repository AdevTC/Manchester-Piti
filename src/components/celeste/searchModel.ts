// «Buscar» as the TU boards draw it (piti-diseno/src/cuenta/src component.js entries · searchModel · choose),
// pure. What can be found — the season's players (with their printed shirt), its matches (G · E · P), its rivals
// (initials in coral and their record), «Tu página y tus avisos», the web's pages and the things to do — depends
// on who looks (Main board, «Quién ve qué»). How it is found: six scopes (Todo · Jugadores · Partidos · Rivales ·
// Tu página · Acciones, Tab cycles them), the prefixes @ # >, a score (dorsal 130 · jornada 125 · title prefix 100 ·
// a title word 85 · a keyword 60 · inside 40; once anything scores 60 the loose ones go), «Mejor resultado», groups
// of three with «N más», «Lo próximo» and four «Acciones» on an empty field, «¿Querías decir…?». Where a result
// leads: targetHref (the new addresses, never one the router must redirect).
import type { ClubMatch } from "../../lib/clubData";
import type { TuIconName } from "../vidrio/tu/ui";
import type { MatchMark } from "../../lib/derived/vidrio/matchMarks";
import { matchMarks } from "../../lib/derived/vidrio/matchMarks";
import { rotationOf } from "../../lib/derived/vidrio/rotation";
import { settled } from "../../lib/eventMeta";
import { scoreOf } from "../../lib/partidos";
import { scoreText, niceName } from "../../lib/derived/words";
import { madridTime, MONTHS_SHORT, madridDate } from "../../lib/derived/madrid";
import { calendarOrder, jornadaNumbers } from "../../lib/derived/jornada";
import { nameFor } from "../../lib/derived/names";
import { positionText } from "../../lib/positions";
import { clubHashPath, vestuarioHashPath } from "../../lib/legacyUrls";
import { statsViewPath } from "../../lib/interimScreens";
import type { SearchTarget } from "../../lib/derived/search";
import { dateMillis, isCompleted, isVisibleMatch, kickoffState } from "../../../functions/src/matchEngine";

// ───────────────────────── where a result leads

export type PanelTarget = SearchTarget | { to: "href"; href: string } | { to: "pip" } | { to: "match"; matchId: string; tab?: "vestuario" } | { to: "clubAt"; hash: string };
/** Where a result leads, as an address of the app (null: «Sacar el marcador», which opens no page). */
export function targetHref(t: PanelTarget): string | null {
  const q = (params: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
    return s ? `?${s}` : "";
  };
  switch (t.to) {
    case "jugador":
      return `/jugadores/${encodeURIComponent(t.playerId)}${q({ season: t.season })}`;
    case "partido":
      return `/partidos/${encodeURIComponent(t.matchId)}`;
    case "match":
      return `/partidos/${encodeURIComponent(t.matchId)}${t.tab ? `/${t.tab}` : ""}`;
    case "partidos":
      return `${t.view === "tabla" ? "/partidos/tabla" : "/partidos"}${q({ temporada: t.season })}`;
    case "stats":
      return statsViewPath(t.view ?? "summary") + (t.view === "minutes" ? q({ ranking: "minutos", ver: "todo" }) : "");
    case "plantilla":
      return "/plantilla";
    case "club":
      return "/club";
    case "clubAt":
      return clubHashPath(t.hash) ?? "/club";
    case "vestuario":
      // (#vx-mvp: the last vote, found once the matches are in — components/InterimLanding)
      return t.hash ? (vestuarioHashPath(t.hash) ?? `/vestuario#${t.hash}`) : "/vestuario";
    case "profile":
      return "/perfil";
    case "pizarra":
      return "/pizarra";
    case "href":
      return t.href;
    case "pip":
      return null;
  }
}

// ───────────────────────── words

/** Lower case, no accents (the boards' fold). */
export const fold = (s: string): string =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A rival's initials in its coral disc: the first letters of its words, two at most, «fc», «F.C.», «cf», «de» and
 *  «del» aside («Orduña fc» → «O», «Sporting de Brugal» → «SB»). (The board's \b rule kept «F.C.» at the end of a
 *  name: «Entrepibas F.C.» gave «EF».) */
export function initials(name: string): string {
  const words = String(name || "")
    .split(/\s+/)
    .filter((w) => w && !/^(fc|f\.c\.?|cf|c\.f\.?|de|del)$/i.test(w));
  return words
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("es");
}

/** «orduna-fc»: a rival in an address (the router's slug). */
export const rivalSlug = (name: string): string =>
  fold(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "rival";

const WEEKDAY = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long" });
/** «domingo 25 oct, 14:00» in club time. */
export function whenText(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "fecha por confirmar";
  const [, mo, d] = madridDate(ms).split("-");
  return `${WEEKDAY.format(ms)} ${Number(d)} ${MONTHS_SHORT[Number(mo) - 1] ?? ""}, ${madridTime(ms)}`;
}
/** «domingo 18». */
const dayText = (ms: number): string => `${WEEKDAY.format(ms)} ${Number(madridDate(ms).split("-")[2])}`;

// ───────────────────────── what can be found

/** Who looks (Main board, «Quién ve qué»): a fan, a socio without a ficha, a new account (his ficha asked for), a
 *  player with his ficha linked; a captain on top. */
export type SrViewerKind = "fan" | "socio" | "nuevo" | "jugador";
export interface SrViewer {
  kind: SrViewerKind;
  captain: boolean;
}

/** Who looks, from the published viewer and his ficha request (`claim`: its status, when he has one); `quien`
 *  (DEV, the boards' maqueta) looks as someone else. A captain is a member with the admin role (Capitanía's rule). */
export function searchViewer(v: { member: boolean; admin: boolean; playerId: string | null }, claim: string | null | undefined, quien: string | null = null): SrViewer {
  switch (quien) {
    case "fan":
      return { kind: "fan", captain: false };
    case "socio":
      return { kind: "socio", captain: false };
    case "nuevo":
    case "pendiente":
      return { kind: "nuevo", captain: false };
    case "jugador":
      return { kind: "jugador", captain: false };
    case "capitan":
    case "admin":
      return { kind: v.playerId ? "jugador" : "socio", captain: true };
  }
  if (!v.member) return { kind: "fan", captain: false };
  const kind: SrViewerKind = v.playerId ? "jugador" : claim === "pending" || claim === "rejected" ? "nuevo" : "socio";
  return { kind, captain: v.admin };
}

export type SrKind = "jugador" | "partido" | "rival" | "tu" | "seccion" | "accion";
export type SrScope = "todo" | "jugador" | "partido" | "rival" | "tu" | "accion";
export type Res = "G" | "E" | "P";

/** What choosing it does: go to an address (`anchor`: then show that block), open «Tú» / «Entrar» (the header's
 *  account control; `href` when it is not there), or switch the theme. */
export type SrGo = { to: "href"; href: string; anchor?: string } | { to: "account"; href: string } | { to: "theme" };

export interface SrPreview {
  line: string;
  /** The address it opens (shown in the preview), or what it opens in words. */
  url: string;
  /** A match: the score (or «J2») and its word. */
  score?: string;
  word?: string;
  /** A rival: the meetings. */
  list?: string;
  marks?: MatchMark[];
}

export interface SrEntry {
  id: string;
  kind: SrKind;
  title: string;
  detail: string;
  /** Words it is also found by (not shown). */
  kw: string;
  /** A player's dorsal (found only exactly; his printed shirt). */
  num?: string;
  /** A match's jornada (found only exactly: «1», «j1»). */
  jn?: string;
  icon?: TuIconName;
  res?: Res;
  /** A rival's initials. */
  ini?: string;
  pv: SrPreview;
  go: SrGo;
}

export interface SrPlayer {
  id: string;
  /** «Kevin». */
  name: string;
  /** The dorsal, as text. */
  num: string;
  /** «Extremo derecho» (empty when unknown). */
  pos: string;
  /** «Kevin Pérez». */
  full: string;
  /** The name on his back («KEVIN»). */
  shirt: string;
  /** What the preview says of his season. */
  line: string;
}

export interface SrGame {
  id: string;
  /** Its jornada (null: a friendly). */
  j: number | null;
  rival: string;
  res: Res | null;
  /** «1–8» (unbreakable). */
  score: string;
  live: boolean;
  home: boolean | null;
  /** «domingo 25 oct, 14:00». */
  when: string;
  /** «Alcides (43′)». */
  scorers: string;
  goals: number;
  changes: number;
  marks: MatchMark[];
}

export interface SrInput {
  viewer: SrViewer;
  dia: boolean;
  players: readonly SrPlayer[];
  games: readonly SrGame[];
  /** The next match's jornada, for «Responder a la convocatoria» (undefined: no next match). */
  next?: { j: number | null };
  /** The match whose MVP vote is open. */
  vote?: { matchId: string; j: number | null; rival: string; closes: string } | null;
}

const RES_WORD: Record<Res, string> = { G: "Ganamos", E: "Empatamos", P: "Perdimos" };
const jLabel = (j: number | null) => (j ? `J${j}` : "Amistoso");

/** The web's pages (TUD.SECTIONS): id, title, detail, address, keywords, icon, members only. */
const SECTIONS: [string, string, string, string, string, TuIconName, boolean][] = [
  ["partidos", "Partidos", "Calendario y resultados", "/partidos", "calendario resultados jornadas", "fixtures", false],
  ["tabla", "Clasificación", "La tabla de la liga", "/partidos/tabla", "tabla liga puntos clasificacion", "chart", false],
  ["plantilla", "Plantilla", "Los 16 del equipo", "/plantilla", "equipo jugadores dorsales", "shirt", false],
  ["numeros", "Números", "La temporada en números", "/numeros", "estadisticas stats goleadores", "chart", false],
  ["club", "Club", "La vitrina, la historia y el equipo", "/club", "historia escudo vitrina", "shield", false],
  ["camiseta", "Ponte la del Piti", "Tu nombre y tu dorsal en la camiseta", "/club/equipo/camiseta", "camiseta equipacion dorsal", "shirt", false],
  ["vestuario", "Vestuario", "La zona del equipo", "/vestuario", "entrar equipo puerta", "lock", false],
  ["pizarra", "Pizarra", "Tácticas, jugadas y el siete", "/pizarra", "tactica jugadas siete alineacion", "poll", true],
  ["caja", "La caja", "Cuotas y gastos", "/vestuario/caja", "dinero cuotas pagos bote", "euro", true],
];

type Who = "all" | "card" | "player" | "member" | "cap";
/** «Tu página y tus avisos» (TUD.FAMILY): id, title, detail, address, keywords, icon, who. */
const FAMILY: [string, string, string, string, string, TuIconName, Who][] = [
  ["carta", "Tu carta", "Mi página", "/perfil", "perfil carta valoracion evoluciones mi pagina tipos", "cardi", "card"],
  ["temporada", "Tu temporada", "Mi página", "/perfil/temporada", "temporada numeros goles logros cromos", "chart", "player"],
  ["posiciones", "Tus posiciones", "Mi página", "/perfil/posiciones", "posiciones donde juego puesto", "target", "player"],
  ["nombre", "Tu nombre y tu apodo", "Mi página", "/perfil/nombre", "nombre apodo espalda camiseta estampar", "shirt", "member"],
  ["bandeja", "Avisos", "Lo que te ha contado el club", "/avisos", "avisos notificaciones bandeja", "bell", "member"],
  ["amedida", "Avisos a medida", "Qué te llega a este móvil", "/avisos/a-medida", "avisos notificaciones push silenciar solo goles calendario", "bell", "all"],
  ["ajustes", "Ajustes", "Tema, sonido, estadio en 3D", "/perfil/ajustes", "ajustes tema oscuro claro noche dia sonido 3d animaciones", "gear", "member"],
  ["cuenta", "Tu cuenta", "Google, acceso, salir y baja", "/perfil/cuenta", "cuenta google salir sesion baja datos id", "user", "member"],
  ["capitania", "Capitanía", "La puerta y administrar el club", "/perfil/capitania", "capitan puerta admin administrar", "door", "cap"],
];

/** Everything this viewer can find, in the board's order (players, matches, rivals, his page, the pages, the
 *  things to do): ties keep this order. */
export function buildEntries({ viewer, dia, players, games, next, vote }: SrInput): SrEntry[] {
  const { kind: k, captain } = viewer;
  const member = k !== "fan";
  const out: SrEntry[] = [];

  for (const p of players) {
    out.push({
      id: `j:${p.id}`,
      kind: "jugador",
      title: p.name,
      detail: [p.num, p.pos, p.full].filter(Boolean).join(" · "),
      kw: `${p.shirt} ${p.full} ${p.pos} ${p.num}`,
      num: p.num || undefined,
      pv: { line: p.line, url: `/jugadores/${p.id}` },
      go: { to: "href", href: `/jugadores/${encodeURIComponent(p.id)}` },
    });
  }

  for (const g of games) {
    const word = g.res ? RES_WORD[g.res] : g.live ? "En directo" : "Por jugar";
    const where = g.home === true ? " · en casa" : g.home === false ? " · fuera" : "";
    const label = jLabel(g.j);
    const goalLine = g.scorers ? `${g.goals === 1 ? "Gol" : "Goles"}: ${g.scorers}.${g.changes ? ` ${pl(g.changes, "cambio", "cambios")}, rotaciones continuas.` : ""}` : "";
    const place = g.home === true ? "En casa" : g.home === false ? "Fuera" : "";
    out.push({
      id: `p:${g.id}`,
      kind: "partido",
      title: `${label} · ${g.rival}`,
      detail: (g.res ? `${word} ${g.score}` : g.live ? `${word} · ${g.score}` : `Por jugar · ${g.when}`) + where,
      kw: g.j ? `j${g.j} jornada ${g.j} ${g.rival}` : `amistoso ${g.rival}`,
      jn: g.j ? String(g.j) : undefined,
      res: g.res ?? undefined,
      icon: "fixtures",
      pv: {
        score: g.res || g.live ? g.score : label,
        word: g.res || g.live ? word : g.when,
        line: goalLine || (g.res || g.live ? (place ? `${place}.` : "") : `${place ? `${place}. ` : ""}Previa, el siete y cómo llegar.`),
        url: `/partidos/${g.id}`,
        marks: g.marks,
      },
      go: { to: "href", href: `/partidos/${encodeURIComponent(g.id)}` },
    });
  }

  const rivals = new Map<string, { name: string; n: number; G: number; E: number; P: number; list: string[] }>();
  for (const g of games) {
    const key = fold(g.rival).trim();
    const r = rivals.get(key) ?? { name: g.rival, n: 0, G: 0, E: 0, P: 0, list: [] };
    if (g.res) {
      r.n++;
      r[g.res]++;
    }
    r.list.push(`${jLabel(g.j)}${g.res ? ` ${g.score}` : " por jugar"}`);
    rivals.set(key, r);
  }
  for (const r of rivals.values()) {
    const rec = r.n ? [r.G ? pl(r.G, "victoria", "victorias") : "", r.E ? pl(r.E, "empate", "empates") : "", r.P ? pl(r.P, "derrota", "derrotas") : ""].filter(Boolean).join(", ") : "Aún sin jugar";
    const href = `/numeros/rivales?rival=${rivalSlug(r.name)}`;
    out.push({ id: `r:${r.name}`, kind: "rival", title: r.name, detail: `Rival · ${rec}`, kw: `${r.name} rival equipo`, ini: initials(r.name), pv: { line: `${rec}.`, list: r.list.join(" · "), url: href }, go: { to: "href", href } });
  }

  const sees = (w: Who) => w === "all" || ((w === "card" || w === "member") && member) || (w === "player" && k === "jugador") || (w === "cap" && captain);
  for (const [id, t, d, url, kw, icon, who] of FAMILY) {
    if (!sees(who)) continue;
    out.push({ id: `f:${id}`, kind: "tu", title: id === "carta" && k === "socio" ? "Tu carné" : t, detail: `${d} · ${url}`, kw, icon, pv: { line: `${d}.`, url }, go: { to: "href", href: url } });
  }
  for (const [id, t, d, url, kw, icon, members] of SECTIONS) {
    if (members && !member) continue;
    out.push({ id: `s:${id}`, kind: "seccion", title: t, detail: d, kw, icon, pv: { line: `${d}.`, url }, go: { to: "href", href: url } });
  }

  const a = (id: string, title: string, detail: string, icon: TuIconName, kw: string, go: SrGo, url: string) => out.push({ id: `a:${id}`, kind: "accion", title, detail, kw: `${kw} hacer`, icon, pv: { line: `${detail}.`, url }, go });
  if (member && vote) {
    const href = `/partidos/${encodeURIComponent(vote.matchId)}/vestuario`;
    a("mvp", `Votar al MVP ${vote.j ? `de la J${vote.j}` : `contra ${vote.rival}`}`, `Contra ${vote.rival} · se cierra el ${vote.closes}`, "star", "mvp votar mejor", { to: "href", href }, href);
  }
  if (k === "jugador") {
    if (next) a("rsvp", `Responder a la convocatoria ${next.j ? `de la J${next.j}` : "del amistoso"}`, "Voy, duda o no voy, aquí mismo", "check", "convocatoria voy ir", { to: "account", href: "/vestuario" }, "Se abre «Tú»");
    a("compartir", "Compartir mi carta", "Historia o post, frente o dorso", "share", "compartir carta imagen instagram", { to: "href", href: "/perfil/compartir" }, "/perfil/compartir");
    a("estampar", "Cambiar el nombre de mi espalda", "Lo estampas y sale en tu ficha", "shirt", "estampar nombre espalda camiseta", { to: "href", href: "/perfil/nombre" }, "/perfil/nombre");
    a("ausencia", "Avisar de una ausencia", "Para que la pizarra lo sepa", "away", "ausencia no puedo vacaciones", { to: "href", href: "/vestuario/ausencias" }, "/vestuario/ausencias");
    a("turno", "Cambiar mi turno", "Lavar la equipación, los balones, los petos", "wash", "turno lavar equipacion", { to: "href", href: "/vestuario/turnos" }, "/vestuario/turnos");
  }
  if (k === "nuevo") a("ficha", "Pedir mi ficha", "Elige tu dorsal entre las libres", "shirt", "ficha dorsal pedir reclamar", { to: "href", href: "/perfil" }, "/perfil");
  if (member) a("porra", "Hacer la porra", "Antes del pitido de cada jornada", "star", "porra apuesta resultado", { to: "href", href: "/partidos" }, "/partidos");
  else a("entrar", "Entrar al vestuario", "Con tu Google, o pide que te abran", "lock", "entrar login sesion socio", { to: "account", href: "/vestuario" }, "Se abre «Entrar»");
  a("silenciar", "Silenciar los avisos de este móvil", "Solo goles, todo, nada o una pausa", "bell", "silenciar avisos notificaciones nada callar pausa", { to: "href", href: "/avisos/a-medida" }, "/avisos/a-medida");
  a("calendario", "Al calendario", "Todas las jornadas en tu calendario", "cal", "calendario ics google apple", { to: "href", href: "/avisos/a-medida", anchor: "tu-cal" }, "/avisos/a-medida");
  a("tema", dia ? "Cambiar a tema oscuro" : "Cambiar a tema claro", "Ahora mismo, en este móvil", dia ? "moon" : "sun", "tema oscuro claro noche dia modo", { to: "theme" }, "");
  a("camiseta", "Ponte la del Piti", "Tu nombre y tu dorsal en la camiseta", "shirt", "camiseta dorsal equipacion", { to: "href", href: "/club/equipo/camiseta" }, "/club/equipo/camiseta");
  return out;
}

// ───────────────────────── the club's data, in the search's words

export interface SrPlayerDoc {
  id: string;
  firstName?: string;
  lastName?: string;
  shirtName?: string;
  number?: number | null;
  seasons?: string[];
  seasonDetails?: Record<string, unknown>;
  positions?: unknown;
  naturalPosition?: unknown;
}

const OUR_GOAL = new Set(["goal", "goal_penalty", "goal_freekick"]);

/** The season's players and matches as the search lists them (the season's calendar: visible, published, not
 *  cancelled; the squad by dorsal). `now` sets what is played, live or to come. */
export function seasonData(input: { matches: readonly ClubMatch[]; players: readonly SrPlayerDoc[]; seasonId: string; now: number }): { players: SrPlayer[]; games: SrGame[]; next?: { j: number | null } } {
  const { seasonId, now } = input;
  const calendar = input.matches.filter((m) => isVisibleMatch(m) && m.seasonId === seasonId && (m as { published?: boolean }).published !== false && m.status !== "cancelled").sort(calendarOrder);
  const numbers = jornadaNumbers(calendar);
  const squad = input.players.filter((p) => p.seasons?.includes(seasonId));
  const seasonNum = (p: SrPlayerDoc): string => {
    const d = p.seasonDetails?.[seasonId];
    const n = d && typeof d === "object" ? (d as Record<string, unknown>).number : undefined;
    const v = typeof n === "number" && Number.isFinite(n) ? n : p.number;
    return v != null ? String(v) : "";
  };
  const shortName = (id: string | undefined) => {
    const p = squad.find((x) => x.id === id) ?? input.players.find((x) => x.id === id);
    return niceName(nameFor(p, seasonId));
  };

  const played = calendar.filter((m) => isCompleted(m));
  const rot = new Map(played.map((m) => [m.id, rotationOf(m, settled(m.events ?? []), (id) => id)]));

  const games: SrGame[] = calendar.map((m) => {
    const done = isCompleted(m);
    const ks = kickoffState(m, now);
    const live = !done && (ks === "live" || ks === "halftime");
    const { gf, ga } = scoreOf(m);
    const goals = settled(m.events ?? []).filter((e) => OUR_GOAL.has(e.type) && e.playerId);
    const by = new Map<string, number[]>();
    for (const e of goals) by.set(e.playerId as string, [...(by.get(e.playerId as string) ?? []), Math.round(e.minute ?? 0)]);
    const scorers = [...by].map(([id, ms]) => `${shortName(id)} (${ms.map((x) => `${x}′`).join(", ")})`).join(", ");
    const home = (m as { home?: unknown }).home;
    return {
      id: m.id,
      j: numbers.get(m.id) ?? null,
      rival: m.rival?.trim() || "Rival",
      res: done ? (gf > ga ? "G" : gf < ga ? "P" : "E") : null,
      score: scoreText(gf, ga),
      live,
      home: typeof home === "boolean" ? home : null,
      when: whenText(dateMillis(m.date)),
      scorers: done || live ? scorers : "",
      goals: goals.length,
      changes: rot.get(m.id)?.changes ?? 0,
      marks: done || live ? matchMarks(m) : [],
    };
  });

  const upcoming = calendar.find((m) => !isCompleted(m) && dateMillis(m.date) > now - 3 * 3_600_000) ?? calendar.find((m) => !isCompleted(m));
  const lineOf = (id: string): string => {
    if (!played.length) {
      if (!upcoming) return "Aún sin partidos esta temporada.";
      const at = dateMillis(upcoming.date);
      return `Se estrena${Number.isFinite(at) && at > 0 ? ` el ${dayText(at)}` : ""} contra ${upcoming.rival?.trim() || "el rival"}.`;
    }
    if (played.length === 1) {
      const m = played[0];
      const label = numbers.get(m.id) ? `la J${numbers.get(m.id)}` : "el amistoso";
      const row = rot.get(m.id)?.rows.find((r) => r.id === id);
      const called = [...(m.starters ?? []), ...(m.bench ?? [])].includes(id);
      if (!row || !row.minutes) return called ? `No jugó en ${label}.` : `No convocado en ${label}.`;
      const evs = settled(m.events ?? []).filter((e) => e.playerId === id);
      const gm = evs.filter((e) => OUR_GOAL.has(e.type)).map((e) => `${Math.round(e.minute ?? 0)}′`);
      const bits = [`${row.minutes}′ en ${label}, en ${pl(row.stints.length, "tramo", "tramos")}`];
      if (gm.length) bits.push(gm.length === 1 ? `gol en el ${gm[0]}` : `goles en el ${gm.slice(0, -1).join(", ")} y ${gm.at(-1)}`);
      if (evs.some((e) => e.type === "penalty_committed")) bits.push("penalti cometido");
      if (evs.some((e) => e.type === "yellow_card" || e.type === "double_yellow")) bits.push("amarilla");
      if (evs.some((e) => e.type === "red_card" || e.type === "double_yellow")) bits.push("roja");
      return `${bits.join(" · ")}.`;
    }
    let pj = 0;
    let g = 0;
    let a = 0;
    for (const m of played) {
      if (rot.get(m.id)?.minutes.get(id)) pj++;
      for (const e of settled(m.events ?? [])) {
        if (!OUR_GOAL.has(e.type)) continue;
        if (e.playerId === id) g++;
        if (e.assistPlayerId === id) a++;
      }
    }
    return `${pl(pj, "partido", "partidos")} · ${pl(g, "gol", "goles")} · ${pl(a, "asistencia", "asistencias")}`;
  };

  const players: SrPlayer[] = squad
    .map((p) => {
      const printed = nameFor(p, seasonId);
      return {
        id: p.id,
        name: niceName(printed),
        num: seasonNum(p),
        pos: positionText(p) ?? "",
        full: [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || niceName(printed),
        shirt: printed,
        line: lineOf(p.id),
      };
    })
    .sort((x, y) => (Number(x.num) || 999) - (Number(y.num) || 999) || x.name.localeCompare(y.name, "es"));

  const nextGame = calendar.find((m) => !isCompleted(m) && dateMillis(m.date) > now);
  return { players, games, next: nextGame ? { j: numbers.get(nextGame.id) ?? null } : undefined };
}

/** «viernes»: the weekday a vote closes. */
export const closesText = (ms: number): string => (Number.isFinite(ms) && ms > 0 ? WEEKDAY.format(ms) : "pronto");

// ───────────────────────── the search itself

export const SCOPES: [SrScope, string][] = [
  ["todo", "Todo"],
  ["jugador", "Jugadores"],
  ["partido", "Partidos"],
  ["rival", "Rivales"],
  ["tu", "Tu página"],
  ["accion", "Acciones"],
];
export const GROUP_TITLE: Record<Exclude<SrKind, never>, string> = { jugador: "Jugadores", partido: "Partidos", rival: "Rivales", tu: "Tu página y tus avisos", seccion: "Páginas", accion: "Acciones" };
const ORDER: SrKind[] = ["jugador", "partido", "rival", "tu", "seccion", "accion"];

export interface SrState {
  /** The field as typed (a prefix included). */
  q: string;
  scope: SrScope;
  /** Groups opened past their three («N más»). */
  more: Partial<Record<string, boolean>>;
}

export interface SrGroup {
  key: string;
  title: string;
  best?: boolean;
  items: SrEntry[];
  /** Hits not shown (its «N más»). */
  more: number;
}

export interface SrView {
  /** The scope in force (a prefix sets it). */
  scope: SrScope;
  /** The query without its prefix, folded and trimmed. */
  q: string;
  /** The query without its prefix, as typed. */
  q0: string;
  groups: SrGroup[];
  /** The options in keyboard order. */
  flat: SrEntry[];
  /** Hits per scope (the chips' numbers). */
  counts: Record<SrScope, number>;
  total: number;
  none: boolean;
  /** «¿Querías decir Kevin?». */
  sugg: string;
  noneText: string;
  hint: string;
  /** The scope chip in the field («Jugadores»), empty for «Todo». */
  chip: string;
}

/** The query's prefix: @ players, # jornadas, > things to do. */
export function prefixOf(raw: string): { scope: SrScope | null; q0: string } {
  const c = raw.charAt(0);
  if (c === "@") return { scope: "jugador", q0: raw.slice(1) };
  if (c === "#") return { scope: "partido", q0: raw.slice(1) };
  if (c === ">") return { scope: "accion", q0: raw.slice(1) };
  return { scope: null, q0: raw };
}

/** How well `q` (folded) finds `e` (0: it does not). */
export function scoreOfEntry(e: SrEntry, q: string): number {
  const t = fold(e.title);
  const kw = fold(`${e.kw} ${e.detail || ""}`);
  const qq = q.replace(/^j(?=\d)/, "");
  if (e.num && e.num === q) return 130;
  if (e.jn && e.jn === qq) return 125;
  if (t.indexOf(q) === 0) return 100;
  if (` ${t}`.includes(` ${q}`)) return 85;
  if (` ${kw}`.includes(` ${q}`)) return 60;
  if (t.includes(q) || kw.includes(q)) return 40;
  return 0;
}

/** The scope a Tab (or Shift+Tab) moves to. */
export const nextScope = (s: SrScope, back = false): SrScope => {
  const ids = SCOPES.map((x) => x[0]);
  return ids[(ids.indexOf(s) + (back ? -1 : 1) + ids.length) % ids.length];
};

/** What the dialog shows for `state` (component.js searchModel). */
export function searchView(all: readonly SrEntry[], state: SrState, viewer: SrViewerKind): SrView {
  const pre = prefixOf(state.q);
  const scope = pre.scope ?? state.scope;
  const q0 = pre.q0;
  const q = fold(q0).trim();
  const inScope = (e: SrEntry) => scope === "todo" || e.kind === scope || (scope === "tu" && e.kind === "seccion");
  let hits: { e: SrEntry; sc: number; i: number }[] = [];
  all.forEach((e, i) => {
    if (!inScope(e)) return;
    if (!q) {
      if (scope !== "todo") hits.push({ e, sc: 1, i });
      return;
    }
    const sc = scoreOfEntry(e, q);
    if (sc) hits.push({ e, sc, i });
  });
  if (hits.some((h) => h.sc >= 60)) hits = hits.filter((h) => h.sc >= 60);
  const sorted = hits.slice().sort((a, b) => b.sc - a.sc || a.i - b.i);
  const groups: SrGroup[] = [];
  const best = q && sorted[0] && sorted[0].sc >= 100 && scope === "todo" ? sorted[0].e : null;
  if (best) groups.push({ key: "best", title: "Mejor resultado", best: true, items: [best], more: 0 });
  if (q || scope !== "todo") {
    for (const g of ORDER) {
      const xs = sorted.filter((h) => h.e.kind === g && h.e !== best).map((h) => h.e);
      if (!xs.length) continue;
      const cap = scope !== "todo" || state.more[g] ? xs.length : 3;
      groups.push({ key: g, title: GROUP_TITLE[g], items: xs.slice(0, cap), more: xs.length - Math.min(cap, xs.length) });
    }
  } else {
    const acts = all.filter((e) => e.kind === "accion");
    const next = all.find((e) => e.kind === "partido" && !e.res);
    if (next) groups.push({ key: "prox", title: "Lo próximo", items: [next], more: 0 });
    const cap = state.more.accion ? acts.length : 4;
    if (acts.length) groups.push({ key: "accion", title: "Acciones", items: acts.slice(0, cap), more: Math.max(0, acts.length - cap) });
  }
  const counts = Object.fromEntries(SCOPES.map((x) => [x[0], 0])) as Record<SrScope, number>;
  if (q)
    for (const e of all) {
      const t = fold(e.title);
      const kw = fold(`${e.kw} ${e.detail || ""}`);
      if (t.includes(q) || kw.includes(q) || (e.num && e.num === q)) {
        counts.todo++;
        const kk = e.kind === "seccion" ? "tu" : e.kind;
        counts[kk]++;
      }
    }
  const total = hits.length;
  const none = !!q && !total;
  let sugg = "";
  if (none)
    for (const e of all) {
      if (e.kind !== "jugador") continue;
      const n = fold(e.title);
      if (n.charAt(0) === q.charAt(0) && n.charAt(1) === q.charAt(1)) {
        sugg = e.title;
        break;
      }
    }
  const flat = groups.flatMap((g) => g.items);
  const where = scope === "todo" ? "" : ` en ${GROUP_TITLE[scope].toLowerCase()}`;
  return {
    scope,
    q,
    q0,
    groups,
    flat,
    counts,
    total,
    none,
    sugg,
    noneText: `Nada con «${q0.trim()}»${where}.`,
    hint: scope === "todo" ? (viewer === "fan" ? "Un jugador, una jornada, un rival o algo que hacer" : "Un jugador, una jornada o algo tuyo") : `Busca en ${GROUP_TITLE[scope].toLowerCase()}`,
    chip: scope === "todo" ? "" : GROUP_TITLE[scope],
  };
}

/** «2 resultados» / «Sin resultados». */
export const countText = (n: number): string => (n ? pl(n, "resultado", "resultados") : "Sin resultados");

/** The preview's button. */
export const goLabel = (k: SrKind): string => (k === "jugador" ? "Abrir su página" : k === "partido" ? "Abrir el partido" : k === "rival" ? "Ver los partidos" : k === "accion" ? "Hacerlo" : "Ir");
