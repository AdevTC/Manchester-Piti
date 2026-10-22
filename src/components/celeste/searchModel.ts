// «Buscar, con ⌘K» as the boards have it (V-Integracion, integ-logic vnIndex), pure: on top of the club's index
// (lib/derived/searchIndex) it adds «Ahora» (the match of the moment, always first: live → the score and «Sacar
// el marcador»; before → today's kick-off; after → the result and the acta), «Acciones» (a jugador's, a member's,
// everyone's), «Equipos» (every team of the league table) and the boards' names («Jornadas», «Páginas»). The
// results come grouped, every hit counted: the panel shows three per group (two for «Ahora») with «N más», and
// «Ver los N resultados» shows them all.
import type { ClubMatch } from "../../lib/clubData";
import { matchScore, normalize, type SearchEntry, type SearchKind, type SearchTarget } from "../../lib/derived/search";
import { clockText, type FloatDay } from "../vidrio/live/liveModel";
import type { VIconName } from "../vidrio/VIcon";
import { scoreOf } from "../../lib/partidos";
import { dateMillis } from "../../../functions/src/matchEngine";
import { madridTime } from "../../lib/derived/madrid";
import { rivalKey } from "../../lib/derived/rival";
import { scoreText } from "../../lib/derived/words";

export type PanelKind = SearchKind | "ahora" | "accion";
export type PanelTarget = SearchTarget | { to: "href"; href: string } | { to: "pip" } | { to: "match"; matchId: string; tab?: "vestuario" } | { to: "clubAt"; hash: string };
export interface PanelEntry extends Omit<SearchEntry, "kind" | "target"> {
  kind: PanelKind;
  target: PanelTarget;
  /** The row's icon chip (players show their shirt instead). */
  icon?: VIconName;
  /** A player's dorsal on his shirt. */
  shirt?: string;
  /** The live match: the red chip. */
  live?: boolean;
}

export const GROUP_ORDER: PanelKind[] = ["ahora", "jugador", "partido", "rival", "accion", "seccion", "temporada"];
export const GROUP_TITLE: Record<PanelKind, string> = {
  ahora: "Ahora",
  jugador: "Jugadores",
  partido: "Jornadas",
  rival: "Equipos",
  accion: "Acciones",
  seccion: "Páginas",
  temporada: "Temporadas",
};
const ICON_OF: Record<PanelKind, VIconName> = { ahora: "ball", jugador: "shirt", partido: "fixtures", rival: "chart", accion: "arrow", seccion: "arrow", temporada: "cal" };
/** How many each group shows before its «N más». */
export const groupCap = (kind: PanelKind): number => (kind === "ahora" ? 2 : 3);

/** The club's index in the boards' words and icons («Números», «Club», the players' shirts). */
export function fromIndex(entries: readonly SearchEntry[]): PanelEntry[] {
  return entries.map((e): PanelEntry => {
    const title = e.kind === "seccion" ? e.title.replace(/^Estadísticas/, "Números").replace(/^El club$/, "Club") : e.title;
    const shirt = e.kind === "jugador" ? /Dorsal (\d+)/.exec(e.detail ?? "")?.[1] : undefined;
    return { ...e, title, shirt, icon: ICON_OF[e.kind] };
  });
}

/** «Ahora»: the match of the moment (from the floating score's state), first in every search. */
export function nowEntries(state: FloatDay | null, now: number): PanelEntry[] {
  if (!state) return [];
  const m = state.match;
  const rival = m.rival?.trim() || "Rival";
  const { gf, ga } = scoreOf(m);
  const at = dateMillis(m.date);
  const time = Number.isFinite(at) ? madridTime(at) : "";
  const base = { id: `now:${m.id}`, kind: "ahora" as const, live: true, keywords: `ahora directo partido ${rival}` };
  switch (state.kind) {
    case "live":
    case "halftime": {
      const minute = state.kind === "halftime" ? "Descanso" : `En directo, minuto ${clockText(m, now).replace(/′.*/, "")}`;
      return [
        { ...base, title: `Piti ${scoreText(gf, ga)} ${rival}`, detail: `${minute}. Abrir el partido`, icon: "ball", target: { to: "partido", matchId: m.id } },
        { id: "now:pip", kind: "ahora", title: "Sacar el marcador", detail: "A una ventana que flota encima de todo", keywords: "marcador ventana pip", icon: "pip", target: { to: "pip" } },
      ];
    }
    case "previa":
    case "rsvp":
    case "anotador":
    case "pending": {
      const left = Number.isFinite(at) && at > now ? Math.ceil((at - now) / 60_000) : 0;
      const until = left > 0 ? (left < 60 ? `Faltan ${left} min` : `Faltan ${Math.floor(left / 60)} h ${left % 60 ? `${left % 60} min` : ""}`.trim()) : "Pendiente del pitido";
      return [{ ...base, title: `Hoy, ${time} contra ${rival}`, detail: `${until}. Previa, el siete y cómo llegar`, icon: "fixtures", target: { to: "partido", matchId: m.id } }];
    }
    case "final":
    case "vote":
    case "mvpres":
      return [{ ...base, live: false, title: `Piti ${scoreText(gf, ga)} ${rival}`, detail: state.kind === "final" && !state.published ? "Final. El acta llega enseguida" : "Final. Leer el acta", icon: "ball", target: { to: "partido", matchId: m.id } }];
    case "unplayed":
      return [{ ...base, live: false, title: `Contra ${rival}`, detail: "Pendiente del acta. Abrir el partido", icon: "fixtures", target: { to: "partido", matchId: m.id } }];
  }
}

export interface ActionInput {
  /** A member linked to a player of the squad. */
  jugador: boolean;
  member: boolean;
  /** The convocatoria open now (its jornada number, when known). */
  rsvp: { match: ClubMatch; j: number | null } | null;
  /** The match whose MVP vote is open. */
  vote: ClubMatch | null;
  /** The season's calendar feed (https), for «Al calendario». */
  feed: string | null;
}

/** «Acciones»: what a jugador, a member and everyone can do from here. */
export function actionEntries({ jugador, member, rsvp, vote, feed }: ActionInput): PanelEntry[] {
  const out: PanelEntry[] = [];
  const a = (id: string, title: string, detail: string, icon: VIconName, target: PanelTarget, keywords = ""): PanelEntry => ({ id: `a:${id}`, kind: "accion", title, detail, icon, target, keywords: `${keywords} hacer accion` });
  if (jugador) {
    if (rsvp) out.push(a("rsvp", `Responder a la convocatoria${rsvp.j ? ` de la J${rsvp.j}` : ""}`, "Voy, duda o no voy", "check", { to: "vestuario", hash: "vx-rsvp" }, "convocatoria voy"));
    out.push(a("ausencia", "Avisar de una ausencia", "Para que la pizarra lo sepa", "away", { to: "vestuario", hash: "vx-ausencias" }, "ausencia no puedo vacaciones"));
    out.push(a("turno", "Cambiar mi turno", "Lavar la equipación, los balones, los petos", "wash", { to: "vestuario" }, "turno lavar equipacion"));
  }
  if (member) {
    out.push(a("mvp", "Votar al MVP", vote ? `Contra ${vote.rival ?? "el rival"}, abierta` : "Se abre con el final", "star", vote ? { to: "match", matchId: vote.id, tab: "vestuario" } : { to: "vestuario", hash: "vx-mvp" }, "mvp votar mejor"));
    out.push(a("porra", "Hacer la porra", "Antes del pitido de cada jornada", "star", { to: "partidos" }, "porra apuesta resultado"));
  }
  if (feed) out.push(a("calendario", "Al calendario", "Todas las jornadas en tu calendario", "cal", { to: "href", href: feed }, "calendario ics google apple"));
  out.push(a("camiseta", "Ponte la del Piti", "Tu nombre y tu dorsal en la camiseta", "shirt", { to: "clubAt", hash: "cl-kits" }, "camiseta dorsal equipacion"));
  return out;
}

/** «Equipos»: every team of the league table that the index doesn't have already (our rivals). */
export function teamEntries(rows: readonly { team: string; isUs?: boolean }[], have: readonly PanelEntry[]): PanelEntry[] {
  const known = new Set(have.filter((e) => e.kind === "rival").map((e) => rivalKey(e.title)));
  return rows
    .filter((r) => !r.isUs && !known.has(rivalKey(r.team)))
    .map((r): PanelEntry => ({ id: `e:${rivalKey(r.team)}`, kind: "rival", title: r.team, detail: "En la clasificación", keywords: "equipo liga clasificacion", icon: "chart", target: { to: "partidos", view: "tabla" } }));
}

/** The boards' extra pages: the vitrina, the line-ups (members), the season's calendar. */
export function extraPages(member: boolean): PanelEntry[] {
  const out: PanelEntry[] = [
    { id: "s:vitrina", kind: "seccion", title: "La vitrina", detail: "Club", keywords: "trofeos vitrina copa", icon: "trophy", target: { to: "clubAt", hash: "cl-trophies" } },
    { id: "s:calendario", kind: "seccion", title: "Calendario de la temporada", detail: "Partidos", keywords: "calendario fechas jornadas", icon: "cal", target: { to: "partidos" } },
  ];
  if (member) out.push({ id: "s:alineaciones", kind: "seccion", title: "Alineaciones", detail: "La pizarra", keywords: "alineacion siete pizarra", icon: "poll", target: { to: "pizarra" } });
  return out;
}

export interface PanelGroup {
  kind: PanelKind;
  title: string;
  /** Every hit of the group, best first. */
  items: PanelEntry[];
}

/**
 * The results for `query`, grouped in the boards' order with every hit counted. «Ahora» is always there; an empty
 * field gives «Ahora» and «Acciones». Letters in order are only a fallback (once a word matches, they go).
 */
export function groupResults(entries: readonly PanelEntry[], query: string): PanelGroup[] {
  const q = normalize(query);
  let hits: { e: PanelEntry; s: number; i: number }[];
  if (!q) hits = entries.map((e, i) => ({ e, s: 1, i })).filter((h) => h.e.kind === "ahora" || h.e.kind === "accion");
  else {
    const scored = entries.map((e, i) => {
      const base = e.kind === "ahora" ? 0 : matchScore(e, query);
      return { e, i, base, s: base ? base + (e.boost ?? 0) : 0 };
    });
    const real = scored.some((r) => r.base >= 50);
    hits = scored.filter((r) => r.e.kind === "ahora" || (r.s > 0 && (!real || r.base >= 50)));
  }
  const groups: PanelGroup[] = [];
  for (const kind of GROUP_ORDER) {
    const items = hits
      .filter((h) => h.e.kind === kind)
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((h) => h.e);
    if (items.length) groups.push({ kind, title: GROUP_TITLE[kind], items });
  }
  return groups;
}

/** «21 resultados». */
export const countText = (n: number): string => `${n} ${n === 1 ? "resultado" : "resultados"}`;
