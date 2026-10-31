// «Tu juego» (TuCarta B «Juego»), the pure part: the F7 pitch with his marks and minutes, the proposal's state
// (today's Posiciones: ficha · draft · pending · approved · adjusted · rejected · out of season), «Dónde has
// jugado», the rank ladders from me.ranks (a zero is «aún a cero», never a rank), his best partner and «Compararte
// con…» (the squad's numbers side by side, and the address of Plantilla's cara a cara with both in it).
import { POSITIONS, POS_CODES, type PosCode, type PositionSet } from "../../../../lib/positions";
import { cyclePosition } from "../../../../lib/positionsEdit";
import type { PlayerPositions } from "../../../../lib/positionStats";
import { seasonPlayers } from "../../../../lib/derived/seasonPlayers";
import { seasonSquad } from "../../../../lib/derived/card";
import { matchNotas, ratingMatches } from "../../../../lib/seasonRating";
import { canSendPositions, positionsNudge, type PositionsInfo } from "../../profileData";
import type { MeInput, JornadaRow, PartnerInfo, RankKey, RankRow } from "../me";
import { pl } from "../model";
import { niceName } from "../../../../lib/derived/words";

const name = (c: PosCode) => POSITIONS[c].name;
const dec = (n: number) => n.toFixed(1).replace(".", ",");
const same = (a: PositionSet, b: PositionSet) => a.main === b.main && a.also.length === b.also.length && a.also.every((c) => b.also.includes(c));

/** The board's pitch (data.js POS): where each spot sits, in % of the pitch (attack at the top). */
export const SPOT_AT: Record<PosCode, { x: number; y: number }> = {
  POR: { x: 50, y: 91 },
  LIB: { x: 50, y: 79 },
  DFC: { x: 50, y: 67 },
  LI: { x: 15, y: 66 },
  LD: { x: 85, y: 66 },
  MCD: { x: 50, y: 55 },
  MC: { x: 50, y: 43 },
  MI: { x: 15, y: 43 },
  MD: { x: 85, y: 43 },
  MCO: { x: 50, y: 30 },
  EI: { x: 15, y: 19 },
  ED: { x: 85, y: 19 },
  DC: { x: 50, y: 13 },
};

// ── the proposal ───────────────────────────────────────────────────────────────────────────────────────────

/** What the pitch shows as marked: the draft, else the pending proposal, else the ficha. */
export function baseMarks(info: PositionsInfo | null): PositionSet {
  if (!info) return { main: null, also: [] };
  return info.state === "pendiente" && info.proposal ? info.proposal : info.approved;
}

export type Mark = "main" | "also" | null;
export const markOf = (set: PositionSet, c: PosCode): Mark => (set.main === c ? "main" : set.also.includes(c) ? "also" : null);

/** One spot of the pitch. */
export interface Spot {
  code: PosCode;
  x: number;
  y: number;
  mark: Mark;
  /** His whole minutes there this season (0: none). */
  min: number;
  aria: string;
}

/** The thirteen spots with his marks and minutes. `editable`: a tap changes it (out of season: read-only). */
export function pitchSpots(marks: PositionSet, played: PlayerPositions | null, editable: boolean): Spot[] {
  const mins = new Map((played?.lines ?? []).map((l) => [l.code, Math.round(l.minutes)]));
  return POS_CODES.map((code) => {
    const mark = markOf(marks, code);
    const min = mins.get(code) ?? 0;
    const aria = `${name(code)}${mark === "main" ? ", tu preferida" : mark === "also" ? ", también juegas" : ", sin marcar"}${min ? `, has jugado ${pl(min, "minuto", "minutos")}` : ""}${editable ? ". Toca para cambiar" : ""}`;
    return { code, ...SPOT_AT[code], mark, min, aria };
  });
}

/** One tap: ✓ también → ★ preferida → off (lib/positionsEdit). */
export const tapSpot = cyclePosition;

/** «Lateral derecho ★, Lateral izquierdo, Extremo derecho»: the preferida first. */
export function marksText(set: PositionSet): string {
  return [...(set.main ? [`${name(set.main)} ★`] : []), ...set.also.map(name)].join(", ");
}

export type ProposalTone = "ok" | "warn" | "";
export interface ProposalStatus {
  tone: ProposalTone;
  /** «Enviada: pendiente de que el capitán la vea». */
  t: string;
  d: string;
  /** «Ahora en tu ficha: …» after the captain answered (approved, adjusted, rejected); null otherwise. */
  ficha: string | null;
}

/** «Tu propuesta»: what the pitch shows and where it stands. `draft`: his unsent marks (null: none). */
export function proposalStatus(info: PositionsInfo | null, draft: PositionSet | null, posLong: string | null): ProposalStatus {
  const base = baseMarks(info);
  const ficha = info ? `Ahora en tu ficha: ${marksText(info.approved) || "sin puesto"}.` : null;
  if (!info?.inSeason) return { tone: "", t: "Tu ficha no está en esta temporada", d: "Se pueden proponer posiciones cuando el capitán te ponga en la plantilla. Mientras, el campo solo se mira.", ficha: null };
  if (draft && !same(draft, base)) return { tone: "", t: "Cambios sin enviar", d: "El capitán los verá cuando los envíes.", ficha: null };
  if (info.state === "pendiente") return { tone: "warn", t: "Enviada: pendiente de que el capitán la vea", d: "Te avisamos en cuanto la mire.", ficha: null };
  if (info.state === "aprobada") return { tone: "ok", t: "El capitán aprobó tu propuesta", d: "Ya está en tu ficha.", ficha };
  if (info.state === "ajustada") return { tone: "ok", t: "El capitán ajustó tu propuesta", d: "Lo que ves es lo que dejó en tu ficha.", ficha };
  if (info.state === "rechazada") return { tone: "warn", t: "El capitán no aprobó tu propuesta", d: "Siguen las de tu ficha; puedes proponer otras.", ficha };
  if (!base.main && !base.also.length) return { tone: "", t: "Aún no has dicho dónde juegas", d: `Tu ficha dice ${(posLong ?? "sin posición").toLowerCase()}, sin puesto exacto. Márcalo en el campo y envíaselo al capitán.`, ficha: null };
  return { tone: "ok", t: "Las de tu ficha", d: "Las puso el capitán; si no son, propón las tuyas.", ficha: null };
}

/** «Enviar al capitán» only with valid changes (a ficha of this season, something marked, not what is already there). */
export const canSend = (info: PositionsInfo | null, draft: PositionSet | null): boolean => !!info && !!draft && canSendPositions(draft, info);

/** The page's title: «De lateral derecho, y donde haga falta». */
export function juegoTitle(marks: PositionSet, posLong: string | null): string {
  const main = marks.main ? name(marks.main) : posLong;
  return main ? `De ${main.toLowerCase()}, y donde haga falta` : "Dinos dónde juegas";
}

/** «Dónde has jugado»: «Lateral derecho: 40′ · Lateral izquierdo: 12′.» and the note on how it is counted. */
export function playedText(played: PlayerPositions | null): { line: string; note: string } {
  if (!played?.lines.length) return { line: "Aún en ningún puesto.", note: "" };
  const line = `${played.lines.map((l) => `${name(l.code)}: ${Math.round(l.minutes)}′`).join(" · ")}.`;
  const note =
    played.estimatedMatches > 0
      ? "Sin pizarra oficial en alguna acta: ahí cuenta tu posición preferida."
      : `Según la pizarra oficial ${played.matches === 1 ? "de tu partido" : "de cada partido"}. Con cambios continuos, cuenta el puesto que ocupaste más tiempo.`;
  return { line, note };
}

/** «Has jugado de lateral izquierdo y no lo tienes puesto.» (his most-played spot, missing from what he marks). */
export function nudgeText(played: PlayerPositions | null, info: PositionsInfo | null, marks: PositionSet): string | null {
  const c = info ? positionsNudge(played, { ...info, approved: marks, proposal: null }) : null;
  return c ? `Has jugado de ${name(c).toLowerCase()} y no lo tienes puesto.` : null;
}

// ── the squad's numbers (the ladders' slots and «Compararte con…») ───────────────────────────────────────────

/** One teammate's season numbers. */
export interface SquadNumbers {
  id: string;
  /** «Evans»: his shirt's name read as a name (niceName), like the rest of the web. */
  name: string;
  num: string;
  minutos: number;
  partidos: number;
  goles: number;
  asistencias: number;
  /** His nota media (one decimal); null without a nota. */
  nota: number | null;
}

/** The season's squad with their numbers (the same tables me.ranksOf reads), by dorsal. */
export function squadNumbers(i: Pick<MeInput, "playerId" | "seasonId" | "matches" | "players" | "seasons" | "mvpResults" | "standings" | "now">): SquadNumbers[] {
  const squadP = seasonPlayers(i.players, i.seasonId, i.seasons, i.playerId);
  const { squad, games } = seasonSquad(squadP, i.matches, i.seasonId, i.mvpResults, i.now, i.standings);
  const noteOf = matchNotas(ratingMatches(games), i.standings);
  return squad.list
    .map((c): SquadNumbers => {
      const ns = games.flatMap((m) => {
        const n = noteOf(m.id, c.id)?.nota;
        return typeof n === "number" ? [n] : [];
      });
      return {
        id: c.id,
        name: niceName(c.name),
        num: c.num ? String(c.num) : "",
        minutos: Math.round(c.stats.minutes ?? 0),
        partidos: c.stats.played ?? 0,
        goles: c.stats.goals ?? 0,
        asistencias: c.stats.assists ?? 0,
        nota: ns.length ? Math.round((ns.reduce((s, n) => s + n, 0) / ns.length) * 10) / 10 : null,
      };
    })
    .sort((a, b) => (Number(a.num) || 999) - (Number(b.num) || 999) || a.name.localeCompare(b.name, "es"));
}

// ── the ladders ───────────────────────────────────────────────────────────────────────────────────────────

/** The prototype's order: minutos, nota media, partidos, goles, asistencias. */
const LADDER_ORDER: RankKey[] = ["minutos", "nota", "partidos", "goles", "asistencias"];
const fmt = (key: RankKey, v: number) => (key === "nota" ? dec(v) : key === "minutos" ? `${v}′` : String(v));
const noun: Record<RankKey, string> = { minutos: "minutos", partidos: "partidos", goles: "goles", asistencias: "asistencias", nota: "nota" };
/** «14 han jugado», «3 han marcado», «1 tiene nota». */
const VALUED: Record<RankKey, [string, string]> = { minutos: ["ha jugado", "han jugado"], partidos: ["ha jugado", "han jugado"], goles: ["ha marcado", "han marcado"], asistencias: ["ha asistido", "han asistido"], nota: ["tiene nota", "tienen nota"] };

export interface Ladder {
  key: RankKey;
  label: string;
  /** «40′ · 9.º», «—». */
  value: string;
  /** «Lidera Evans, 101′ · 14 han jugado», «Aún a cero, como 6 más · lidera Alcides, 3». */
  line: string;
  /** One slot per ranked teammate: his lit (`me`), those with a value, those still at zero (`none`). */
  slots: ("me" | "on" | "none")[];
  aria: string;
}

/** The five ladders from me.ranks (his place; a zero is «aún a cero», never a rank) and the squad's numbers (how
 *  many have a value: the lit part of each ladder). */
export function ladders(ranks: readonly RankRow[], squad: readonly SquadNumbers[], nameOf: (id: string) => string): Ladder[] {
  const byKey = new Map(ranks.map((r) => [r.key, r]));
  return LADDER_ORDER.flatMap((key) => {
    const r = byKey.get(key);
    if (!r) return [];
    const valued = squad.filter((s) => (s[key] ?? 0) > 0).length;
    const slotsN = Math.max(r.of, valued, 1);
    const lead = r.leader ? `${nameOf(r.leader.playerId) || r.leader.name}, ${fmt(key, r.leader.value)}` : "";
    const ranked = r.rank !== null && r.value !== null;
    const slots = Array.from({ length: slotsN }, (_, i): "me" | "on" | "none" => (ranked && i === (r.rank as number) - 1 ? "me" : i < valued ? "on" : "none"));
    let line: string;
    if (ranked) {
      const top = r.rank === 1 ? (r.tied ? `Arriba del todo, empatado con ${pl(r.tied, "compañero", "compañeros")}` : key === "nota" ? "Nadie tiene mejor nota" : "Nadie tiene más") : `Lidera ${lead}${r.tied ? ` · empatado con ${pl(r.tied, "compañero", "compañeros")}` : ""}`;
      line = `${top} · ${pl(valued, VALUED[key][0], VALUED[key][1])}`;
    } else if (r.value === null) {
      line = `Aún sin nota${lead ? ` · lidera ${lead}` : ""}`;
    } else {
      const zero = r.zeroWith > 0 ? `Aún a cero, como ${r.zeroWith} más` : "Aún a cero";
      line = `${zero}${lead ? ` · lidera ${lead}` : ` · nadie tiene ${noun[key]} todavía`}`;
    }
    return [
      {
        key,
        label: r.label,
        value: ranked ? `${r.text} · ${r.rank}.º` : "—",
        line,
        slots,
        aria: ranked ? `${r.label}: ${r.text}, ${r.rank}.º de ${r.of}${r.tied ? ` (empatado con ${r.tied})` : ""}` : r.value === null ? `${r.label}: aún sin nota` : `${r.label}: aún a cero`,
      },
    ];
  });
}

/** «Temporada 1, tras la J2 · los 16 de la plantilla». */
export function rankMeta(seasonName: string, rows: readonly JornadaRow[], of: number): string {
  const last = [...rows].reverse().find((r) => r.kind === "played" || r.kind === "didnt" || r.kind === "absent");
  return `${seasonName}${last?.j ? `, tras la J${last.j}` : ""} · ${of === 1 ? "el único de la plantilla" : `los ${of} de la plantilla`}`;
}

// ── the partner ───────────────────────────────────────────────────────────────────────────────────────────

export function partnerView(p: PartnerInfo | null, nameOf: (id: string) => string): { n: string; name: string; line: string } {
  if (!p) return { n: "", name: "Aún nadie", line: "Sale con tus primeros minutos: el compañero con el que más campo compartes." };
  return { n: p.num, name: nameOf(p.playerId) || p.name, line: `${p.minutes}′ juntos en el campo · en ${pl(p.matches, "partido", "partidos")}` };
}

// ── «Compararte con…» ─────────────────────────────────────────────────────────────────────────────────────

export interface CompareRow {
  label: string;
  mine: string;
  his: string;
  /** Who is ahead, in words (never by colour alone): «Tú, por 2», «Kevin, por 1», «Igual». */
  ahead: string;
  /** Who is ahead (for the bold). */
  side: "me" | "him" | "tie";
}

/** Three numbers side by side: partidos, goles · asistencias (by G+A) and nota media. */
export function compareRows(me: SquadNumbers, him: SquadNumbers): CompareRow[] {
  const row = (label: string, a: number | null, b: number | null, mine: string, his: string, by: (d: number) => string): CompareRow => {
    // (a nota only compares when both have one)
    const side = a === null || b === null ? "tie" : a > b ? "me" : b > a ? "him" : "tie";
    const ahead = a === null || b === null ? "Sin nota que comparar" : side === "tie" ? "Igual" : side === "me" ? `Tú, por ${by(a - b)}` : `${him.name}, por ${by(b - a)}`;
    return { label, mine, his, side, ahead };
  };
  const ga = (s: SquadNumbers) => s.goles + s.asistencias;
  const notaT = (v: number | null) => (v === null ? "—" : dec(v));
  return [
    row("Partidos", me.partidos, him.partidos, String(me.partidos), String(him.partidos), String),
    row("Goles · asistencias", ga(me), ga(him), `${me.goles} · ${me.asistencias}`, `${him.goles} · ${him.asistencias}`, String),
    row("Nota media", me.nota, him.nota, notaT(me.nota), notaT(him.nota), (d) => dec(Math.round(d * 10) / 10)),
  ];
}

/** Plantilla's cara a cara with both already in it (router: /plantilla/cara-a-cara?a=&b=, player ids). */
export const caraHref = (me: string, him: string): { to: "/plantilla/cara-a-cara"; search: { a: string; b: string } } => ({ to: "/plantilla/cara-a-cara", search: { a: me, b: him } });
