// What «Buscar» can find, built from the public data the pages already hold (useClubData, the seasons): the
// players, the published matches, the rivals, the seasons and the web's sections (a member's own ones only
// for a member). Pure: the dialog hands it the data and ranks it with derived/search.
import type { ClubMatch } from "../clubData";
import { dateMillis, isCompleted, isVisibleMatch, nextFixture } from "../../../functions/src/matchEngine";
import { jornadaNumbers } from "./jornada";
import { nameFor, type NameSource } from "./names";
import { rivalKey } from "./rival";
import { dateKeywords, shortDate, type SearchEntry, type StatsView } from "./search";

export interface SearchPlayer extends NameSource {
  id: string;
  number?: number | null;
  seasons?: string[];
}
export interface SearchSeason {
  id: string;
  name: string;
}
export interface SearchIndexInput {
  players: readonly SearchPlayer[];
  matches: readonly ClubMatch[];
  /** Oldest first (the SeasonContext order). */
  seasons: readonly SearchSeason[];
  /** The season the club is playing (this season's players rank first). */
  currentSeasonId?: string;
  /** A member gets his own sections too (Mi perfil, Pizarra, La caja). */
  member: boolean;
  now: number;
}

const STATS_VIEWS: { view: StatsView; label: string; keywords: string }[] = [
  { view: "summary", label: "Resumen", keywords: "pichichi asistencias mvp" },
  { view: "players", label: "Jugadores", keywords: "goles tabla" },
  { view: "game", label: "Análisis del juego", keywords: "analisis juego" },
  { view: "minutes", label: "Minutos", keywords: "minutos jugados" },
  { view: "positions", label: "Posiciones", keywords: "posicion campo" },
  { view: "rivals", label: "Rivales", keywords: "rival contra" },
  { view: "compare", label: "Comparar", keywords: "cara a cara versus vs" },
  { view: "explore", label: "Explorar", keywords: "graficos evolucion" },
];

/** The web's sections: everyone's, then a member's own. */
export function sectionEntries(member: boolean): SearchEntry[] {
  const out: SearchEntry[] = [
    { id: "s:partidos", kind: "seccion", title: "Partidos", detail: "Calendario y resultados", keywords: "calendario resultados jornadas", target: { to: "partidos" } },
    { id: "s:clasificacion", kind: "seccion", title: "Clasificación", detail: "La tabla de la liga", keywords: "tabla liga puntos", target: { to: "partidos", view: "tabla" } },
    { id: "s:plantilla", kind: "seccion", title: "Plantilla", detail: "Los jugadores del equipo", keywords: "equipo jugadores dorsales", target: { to: "plantilla" } },
    { id: "s:stats", kind: "seccion", title: "Estadísticas", detail: "Números de la temporada", keywords: "stats numeros", target: { to: "stats" } },
    ...STATS_VIEWS.map(
      (v): SearchEntry => ({
        id: `s:stats:${v.view}`,
        kind: "seccion",
        title: `Estadísticas · ${v.label}`,
        detail: v.label,
        keywords: `stats ${v.label} ${v.keywords}`,
        target: { to: "stats", view: v.view },
      }),
    ),
    { id: "s:club", kind: "seccion", title: "El club", detail: "Historia, escudo y equipación", keywords: "historia escudo camiseta", target: { to: "club" } },
    { id: "s:vestuario", kind: "seccion", title: "Vestuario", detail: "La zona del equipo", keywords: "entrar equipo", target: { to: "vestuario" } },
  ];
  if (!member) return out;
  return [
    ...out,
    { id: "s:perfil", kind: "seccion", title: "Mi perfil", detail: "Tu carta y tu cuenta", keywords: "perfil cuenta carta", target: { to: "profile" } },
    { id: "s:pizarra", kind: "seccion", title: "Pizarra", detail: "Tácticas y jugadas", keywords: "tactica jugadas siete", target: { to: "pizarra" } },
    { id: "s:caja", kind: "seccion", title: "La caja", detail: "Cuotas y gastos", keywords: "dinero cuotas pagos bote", target: { to: "vestuario", hash: "vx-caja" } },
  ];
}

const resultOf = (m: ClubMatch) => (isCompleted(m) ? `${m.goalsFor ?? 0}-${m.goalsAgainst ?? 0}` : "");

/** Everything «Buscar» can find. */
export function buildSearchIndex(input: SearchIndexInput): SearchEntry[] {
  const { players, seasons, member, now, currentSeasonId } = input;
  const seasonName = new Map(seasons.map((s) => [s.id, s.name]));
  const seasonOrder = new Map(seasons.map((s, i) => [s.id, i]));
  // (an admin draft, published: false, is not public; a cancelled match is not one to look for)
  const matches = input.matches.filter((m) => isVisibleMatch(m) && (m as { published?: boolean }).published !== false && m.status !== "cancelled");
  const numbers = jornadaNumbers(matches);
  const next = nextFixture([...matches], now);

  // players: named by the latest season they played (their page opens on it)
  const playerEntries = players.map((p): SearchEntry => {
    const latest = [...(p.seasons ?? [])].filter((s) => seasonOrder.has(s)).sort((a, b) => (seasonOrder.get(b) ?? 0) - (seasonOrder.get(a) ?? 0))[0];
    const name = nameFor(p, latest);
    const detail = seasonDetailNumber(p, latest) ?? p.number ?? null;
    const shirtNames = Object.values(p.seasonDetails ?? {})
      .map((d) => (d && typeof d === "object" ? (d as Record<string, unknown>).shirtName : undefined))
      .filter((s): s is string => typeof s === "string");
    return {
      id: `p:${p.id}`,
      kind: "jugador",
      title: name,
      detail: [detail != null ? `Dorsal ${detail}` : "", latest ? seasonName.get(latest) : ""].filter(Boolean).join(" · ") || undefined,
      keywords: [p.shirtName, p.firstName, p.lastName, ...shirtNames].filter(Boolean).join(" "),
      exact: detail != null ? [String(detail)] : undefined,
      boost: currentSeasonId && p.seasons?.includes(currentSeasonId) ? 2 : 0,
      target: { to: "jugador", playerId: p.id, ...(latest ? { season: latest } : {}) },
    };
  });

  // matches: the next one first, then the newest
  const byDateDesc = [...matches].sort((a, b) => (dateMillis(b.date) || 0) - (dateMillis(a.date) || 0));
  const matchEntries = byDateDesc.map((m): SearchEntry => {
    const j = numbers.get(m.id);
    const ms = dateMillis(m.date);
    const dated = Number.isFinite(ms) && ms > 0;
    const rival = m.rival || "Rival";
    return {
      id: `m:${m.id}`,
      kind: "partido",
      title: `${j ? `J${j} · ` : ""}${rival}`,
      detail: [m.id === next?.id ? "Próximo partido" : "", dated ? shortDate(ms) : "", resultOf(m), m.seasonId ? seasonName.get(m.seasonId) : ""].filter(Boolean).join(" · ") || undefined,
      keywords: [rival, dated ? dateKeywords(ms) : "", m.seasonId ? seasonName.get(m.seasonId) : ""].filter(Boolean).join(" "),
      exact: j ? [`J${j}`] : undefined,
      boost: m.id === next?.id ? 5 : 0,
      target: { to: "partido", matchId: m.id },
    };
  });

  // rivals: their next match (the previa) when there is one, else the latest meeting
  const rivals = new Map<string, ClubMatch[]>();
  for (const m of byDateDesc) {
    if (!m.rival) continue;
    const key = rivalKey(m.rival);
    rivals.set(key, [...(rivals.get(key) ?? []), m]);
  }
  const rivalEntries = [...rivals.entries()].map(([key, games]): SearchEntry => {
    const upcoming = nextFixture([...games], now);
    const played = games.filter((g) => isCompleted(g));
    const lead = upcoming ?? games[0];
    const name = (played.at(-1) ?? games.at(-1) ?? lead).rival || "Rival";
    const meetings = played.length === 1 ? "1 partido" : `${played.length} partidos`;
    const nextMs = upcoming ? dateMillis(upcoming.date) : NaN;
    return {
      id: `r:${key}`,
      kind: "rival",
      title: name,
      detail: [meetings, upcoming ? `próximo ${Number.isFinite(nextMs) && nextMs > 0 ? shortDate(nextMs) : "sin fecha"}` : ""].filter(Boolean).join(" · "),
      keywords: "rival",
      target: { to: "partido", matchId: lead.id },
    };
  });

  const seasonEntries = [...seasons].reverse().map(
    (s): SearchEntry => ({
      id: `t:${s.id}`,
      kind: "temporada",
      title: s.name,
      detail: s.id === currentSeasonId ? "Temporada actual" : "Partidos de la temporada",
      keywords: "temporada",
      target: { to: "partidos", season: s.id },
    }),
  );

  return [...playerEntries, ...matchEntries, ...rivalEntries, ...seasonEntries, ...sectionEntries(member)];
}

function seasonDetailNumber(p: SearchPlayer, seasonId: string | undefined): number | null {
  if (!seasonId) return null;
  const raw = p.seasonDetails?.[seasonId];
  if (!raw || typeof raw !== "object") return null;
  const n = (raw as Record<string, unknown>).number;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}
