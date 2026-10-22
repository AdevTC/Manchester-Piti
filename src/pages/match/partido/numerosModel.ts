// «El partido» · «Números» (P- boards, place-numeros.js), pure: the head's words, the table (as it is, «Si ganamos
// · Si empatamos · Si perdemos» before the whistle, «Si acaba así» / «Si el acta lo confirma» while it is played,
// after the jornada once done, without our match when aplazado or pendiente), the block for a league with no
// published table, the outcome chips, la forma, the season left, «Quién sumó» and «De un vistazo» from the acta's
// ledger, the keeper's note and the record against the rival. No React, no Firebase: the screen passes the data.
import type { ClubMatch } from "../../../lib/clubData";
import type { StandingRow } from "../../../lib/standings";
import { projectTable, tableFocus } from "../../../lib/derived/vidrio/table";
import type { StripSegment } from "../../../lib/derived/vidrio/strip";
import { madridDate, madridTime, MONTHS_SHORT } from "../../../lib/derived/madrid";
import { andList } from "./model";
import type { ResultWords, Score } from "./model";

export type Letter = "G" | "E" | "P";
export const ORD = (n: number): string => `${n}º`;
/** «+2», «−3», «0» (a true minus sign). */
export const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
const NUMWORD = ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];
const numWord = (n: number): string => NUMWORD[n] ?? String(n);
/** The board's example scores for each outcome («Con un 1–0, por ejemplo»). */
export const PICK_SCORE: Record<Letter, [number, number]> = { G: [1, 0], E: [1, 1], P: [0, 1] };
export const PICK_WORD: Record<Letter, string> = { G: "Si ganamos", E: "Si empatamos", P: "Si perdemos" };

/** Where the screen stands (the page's flags). */
export interface Moment {
  pre: boolean;
  live: boolean;
  played: boolean;
  done: boolean;
  final: boolean;
  off: "aplazado" | "pendiente" | null;
  dragged: boolean;
  minute: number;
  edge: number;
  duration: number;
}

/** The record against a rival (teamAnalysis of the meetings). */
export interface Record3 {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
}

// ───────────────────────── the table ─────────────────────────

/** A row of the table the screen draws. */
export interface NRow {
  team: string;
  pj: number;
  g: number;
  e: number;
  p: number;
  dg: number;
  pts: number;
  isUs: boolean;
  pos: number;
  /** Places up (+) or down (−) against the table before. */
  move: number;
  /** One of the two teams of our match (a projected result, or the jornada just played). */
  touched: boolean;
}
export type TableItem =
  | { kind: "row"; key: string; pos: number; team: string; pj: number; g: number; e: number; p: number; dg: string; pts: number; us: boolean; prov: boolean; mark: string; up: boolean }
  | { kind: "gap"; key: string; text: string };

export interface TableView {
  title: string;
  sub: string;
  rows: NRow[];
  items: TableItem[];
  /** Teams left out of the focused table. */
  hidden: number;
  me: NRow | null;
  /** The provisional tag on our row («Si acaba así» · «Falta el acta»); "" for none. */
  provWord: string;
}

const sameTeam = (a: string, b: string) => a.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase() === b.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** The published table as rows (move from the save's previous place; `touched`: us and `rival`). */
export function rowsAsIs(rows: readonly StandingRow[], rival: string | null): NRow[] {
  return rows.map((r, i) => ({
    team: r.team,
    pj: r.pj,
    g: r.g,
    e: r.e,
    p: r.p,
    dg: r.gf - r.gc,
    pts: r.pts,
    isUs: r.isUs,
    pos: i + 1,
    move: r.prevPos ? r.prevPos - (i + 1) : 0,
    touched: r.isUs || (!!rival && sameTeam(r.team, rival)),
  }));
}

/** The published table with our match ending `gf`–`ga` (projectTable: the rest stand still). */
export function rowsProjected(rows: readonly StandingRow[], rival: string, gf: number, ga: number): NRow[] {
  return projectTable(rows, { rival, gf, ga }).rows.map((r) => ({ team: r.team, pj: r.pj, g: r.g, e: r.e, p: r.p, dg: r.gf - r.gc, pts: r.pts, isUs: r.isUs, pos: r.pos, move: r.move, touched: r.touched }));
}

function viewItems(rows: readonly NRow[], all: boolean, opts: { marks?: boolean; prov?: boolean }): { items: TableItem[]; hidden: number } {
  const focus = all ? rows.map((row, i) => ({ kind: "row" as const, pos: i + 1, row })) : tableFocus(rows);
  let hidden = 0;
  const items = focus.map((f, i): TableItem => {
    if (f.kind === "gap") {
      hidden += f.count;
      return { kind: "gap", key: `gap-${f.side}`, text: f.text };
    }
    const r = f.row;
    const show = !!opts.marks && r.touched && r.move !== 0;
    const up = r.move > 0;
    return {
      kind: "row",
      key: `r-${i}-${r.team}`,
      pos: r.pos,
      team: r.team,
      pj: r.pj,
      g: r.g,
      e: r.e,
      p: r.p,
      dg: signed(r.dg),
      pts: r.pts,
      us: r.isUs,
      prov: !!opts.prov && r.touched,
      mark: show ? `${up ? "sube" : "baja"} al ${ORD(r.pos)}` : "",
      up,
    };
  });
  return { items, hidden };
}

/** The table of the screen at this moment. `rows`: the published table (null: none published). `pick`: the
 *  chip pressed before the whistle. `already`: the published table already counts this jornada. */
export function tableView(
  mo: Moment,
  rows: readonly StandingRow[],
  o: { rival: string; score: Score; pick: Letter | null; all: boolean; jornada: number | null; tableJornada: number | null; already: boolean; allZero: boolean },
): TableView {
  const j = o.jornada ? `la J${o.jornada}` : "la jornada";
  let title = "La clasificación";
  let sub = "";
  let list: NRow[];
  let opts: { marks?: boolean; prov?: boolean } = {};
  let provWord = "";
  if (mo.pre) {
    if (o.pick) {
      const [gf, ga] = PICK_SCORE[o.pick];
      list = rowsProjected(rows, o.rival, gf, ga);
      opts = { marks: true };
      title = PICK_WORD[o.pick];
      sub = `Con un ${gf}–${ga}, por ejemplo; los demás, sin jugar`;
    } else {
      list = rowsAsIs(rows, null);
      sub = o.allZero ? "Todos a cero: la liga empieza esta noche" : `Como está, antes de ${j}`;
    }
  } else if (mo.played && !mo.done && !o.already) {
    list = rowsProjected(rows, o.rival, o.score.us, o.score.them);
    opts = { marks: true, prov: true };
    provWord = mo.final ? "Falta el acta" : "Si acaba así";
    title = mo.final ? "Si el acta lo confirma" : "Si acaba así";
    sub = `Con el ${o.score.us}–${o.score.them}${mo.minute >= mo.duration ? " final" : ` del minuto ${mo.minute}`}; el resto de ${j}, sin jugar`;
  } else if (mo.played) {
    // done (or a table that already counts this jornada): the table after it, our match's two rows marked
    list = rowsAsIs(rows, o.rival);
    opts = { marks: true };
    sub = o.tableJornada ? `Después de la J${o.tableJornada}` : `Después de ${j}`;
  } else {
    list = rowsAsIs(rows, null);
    sub = mo.off === "aplazado" ? "Sin nuestro partido: cuenta cuando se juegue" : "Sin nuestro partido: cuenta con el acta";
  }
  const v = viewItems(list, o.all, opts);
  return { title, sub, rows: list, items: v.items, hidden: v.hidden, me: list.find((r) => r.isUs) ?? null, provWord };
}

/** «dormimos líderes», «dormimos 3º»… after a projected outcome. */
export function outcomeWords(rows: readonly NRow[]): string {
  const me = rows.find((r) => r.isUs);
  if (!me) return "";
  const tie = rows.find((r) => !r.isUs && r.pts === me.pts && r.pts > 0);
  if (me.pos === 1 && tie) return `líderes, igualados con ${tie.team}`;
  if (me.pos === 1) return "dormimos líderes";
  if (me.pos === rows.length) return "últimos, hasta que juegue el resto";
  return `dormimos ${ORD(me.pos)}`;
}

export interface Chip {
  l: Letter;
  word: string;
  line: string;
  pos: string;
  aria: string;
}
/** «Si ganamos · Si empatamos · Si perdemos»: with a table, the place each leaves us in; without one, the points. */
export function chipsOf(rows: readonly StandingRow[] | null, rival: string, first: boolean, left: number): Chip[] {
  return (["G", "E", "P"] as const).map((l) => {
    const word = PICK_WORD[l];
    if (rows) {
      const [gf, ga] = PICK_SCORE[l];
      const proj = rowsProjected(rows, rival, gf, ga);
      const pos = proj.find((r) => r.isUs)?.pos ?? 0;
      const line = outcomeWords(proj);
      const cap = line.charAt(0).toUpperCase() + line.slice(1);
      return { l, word, line: cap, pos: ORD(pos), aria: `${word}: ${ORD(pos)}, ${line}. Ver la tabla así` };
    }
    const line = l === "G" ? `tres puntos${first ? " para empezar" : ""}` : l === "E" ? "un punto" : `${first ? "a cero" : "sin sumar"}, con ${left === 1 ? "una" : numWord(left)} por jugar`;
    const pos = l === "G" ? "3 pts" : l === "E" ? "1 pt" : "0 pts";
    return { l, word, line: line.charAt(0).toUpperCase() + line.slice(1), pos, aria: `${word}: ${pos}, ${line}` };
  });
}

// ───────────────────────── no table published ─────────────────────────

export interface NoTable {
  big: string;
  line: string;
  points: { v: string; t: string }[];
}
/** The board's «Sin clasificación todavía» (played) / «La liga empieza esta jornada» (before, the first one). */
export function noTableOf(mo: Moment, o: { score: Score; left: number; total: number; playedBefore: number; teams: number; season: { pts: number; dg: number }; jornada: number | null }): NoTable {
  if (mo.played && !mo.off) {
    const d = o.score.us - o.score.them;
    const pts = d > 0 ? 3 : d === 0 ? 1 : 0;
    return {
      big: "Sin clasificación todavía",
      line: `La liga aún no ha publicado la tabla de ${o.jornada ? `la J${o.jornada}` : "esta jornada"}: saldrá aquí, con el Piti dentro, en cuanto la suba. Mientras, lo que este partido deja:`,
      points: [
        { v: String(pts), t: pts === 1 ? "punto" : "puntos" },
        { v: signed(d), t: "de diferencia" },
        { v: String(o.left), t: o.left === 1 ? "jornada por jugar" : "jornadas por jugar" },
      ],
    };
  }
  if (o.playedBefore === 0)
    return {
      big: "La liga empieza esta jornada",
      line: "Con todos a cero, la tabla saldrá cuando la liga publique la primera jornada.",
      points: [
        { v: "0", t: "jugados" },
        { v: String(o.total), t: o.total === 1 ? "jornada" : "jornadas" },
        { v: String(o.teams), t: "equipos" },
      ],
    };
  return {
    big: "Sin clasificación todavía",
    line: "La liga aún no ha publicado la tabla: saldrá aquí, con el Piti dentro, en cuanto la suba. Mientras, lo que llevamos:",
    points: [
      { v: String(o.season.pts), t: o.season.pts === 1 ? "punto" : "puntos" },
      { v: signed(o.season.dg), t: "de diferencia" },
      { v: String(o.left), t: o.left === 1 ? "jornada por jugar" : "jornadas por jugar" },
    ],
  };
}

// ───────────────────────── the head ─────────────────────────

/** The place's title and line. `place`: «1º con 3 puntos» (with a table). `rec`: the record before this match. */
export function headOf(mo: Moment, o: { hasTable: boolean; place: string | null; pos: number | null; winLine: string; rec: Record3; result: ResultWords; narrated: boolean; descanso: boolean }): { title: string; sub: string } {
  const { minute: m, edge } = mo;
  if (mo.off === "aplazado") return { title: "Números", sub: "No cuentan mientras esté aplazado." };
  if (mo.off === "pendiente") return { title: "Números", sub: "Pendiente del acta." };
  if (mo.pre) {
    const r = o.rec;
    const before = r.played ? `Contra ellos: ${r.wins}G ${r.draws}E ${r.losses}P.` : "Primera vez contra ellos.";
    return { title: "El rival y lo que se juega", sub: `${before} ${o.hasTable ? `Si ganamos, ${o.winLine}.` : "La clasificación sale cuando la liga la publique."}` };
  }
  const title = "El partido en números";
  const held = mo.dragged ? `En el minuto ${m} (el directo va por el ${edge})` : "";
  if (mo.live || mo.final) {
    if (!o.hasTable || !o.place) return { title, sub: `${held ? `${held}. ` : ""}Desde la mesa${o.narrated ? " y el relato narrado" : ""}.` };
    if (mo.final) return { title, sub: `${mo.dragged ? `En el minuto ${m}. ` : ""}Desde la mesa, falta el acta. Si lo confirma, ${o.place}.` };
    if (mo.dragged) return { title, sub: `${held}: ${o.place} si acabara así.` };
    return { title, sub: o.descanso ? `La primera parte, desde la mesa. Si acaba así, ${o.place}.` : `En directo, desde la mesa. Si acaba así, ${o.place}.` };
  }
  const R = o.result;
  return { title, sub: `${mo.dragged ? `Hasta el minuto ${m}. ` : "Del acta. "}${R.verb} ${R.dash}${o.hasTable && o.pos ? ` y dormimos ${ORD(o.pos)}.` : "."}` };
}

// ───────────────────────── la forma ─────────────────────────

export interface FormItem {
  t: string;
  tone: "g" | "e" | "p" | "prov" | "empty";
  aria: string;
}
const LETTER_WORD: Record<Letter, string> = { G: "ganado", E: "empate", P: "perdido" };
const LETTER_LIVE: Record<Letter, string> = { G: "ganando", E: "empatando", P: "perdiendo" };
const letterOf = (gf: number, ga: number): Letter => (gf > ga ? "G" : gf === ga ? "E" : "P");

/** The season's jornadas as letters (this one from the moviola's score, provisional until the acta), at most
 *  `max` around this match. */
export function formOf(segments: readonly Pick<StripSegment, "id" | "jornada" | "state" | "letter">[], matchId: string, mo: Moment, score: Score, result: ResultWords, max = 8): { items: FormItem[]; from: string; to: string } {
  const segs = segments.filter((s) => s.state !== "suspendido");
  const at = segs.findIndex((s) => s.id === matchId);
  const n = segs.length;
  const size = Math.min(max, n);
  const start = n <= max ? 0 : Math.max(0, Math.min(at - (size - 3), n - size));
  const win = segs.slice(start, start + size);
  const items = win.map((s): FormItem => {
    const j = s.jornada ? `J${s.jornada}` : "Jornada";
    if (s.id === matchId) {
      if (mo.done) {
        const l = letterOf(result.us, result.them);
        return { t: l, tone: l === "G" ? "g" : l === "P" ? "p" : "e", aria: `${j}, ${LETTER_WORD[l]}` };
      }
      if (mo.played) {
        const l = letterOf(score.us, score.them);
        return { t: l, tone: "prov", aria: `${j}, ${mo.final ? LETTER_WORD[l] : LETTER_LIVE[l]}, provisional` };
      }
      if (mo.off === "aplazado") return { t: "A", tone: "empty", aria: `${j}, aplazado` };
      if (mo.off === "pendiente") return { t: "·", tone: "empty", aria: `${j}, pendiente del acta` };
    }
    if (s.state === "jugado" && s.letter && s.letter !== "A") return { t: s.letter, tone: s.letter === "G" ? "g" : s.letter === "P" ? "p" : "e", aria: `${j}, ${LETTER_WORD[s.letter]}` };
    if (s.state === "aplazado") return { t: "A", tone: "empty", aria: `${j}, aplazado` };
    if (s.state === "pendiente") return { t: "·", tone: "empty", aria: `${j}, pendiente del acta` };
    return { t: s.jornada ? `J${s.jornada}` : "·", tone: "empty", aria: `${j}, por jugar` };
  });
  const jn = (s: (typeof win)[number] | undefined) => (s?.jornada ? `J${s.jornada}` : "");
  return { items, from: jn(win[0]), to: jn(win[win.length - 1]) };
}

/** The list's label: «La forma: la J1, perdida; quedan cinco» once done. */
export function formLabel(mo: Moment, jornada: number | null, result: ResultWords, left: number): string {
  const j = jornada ? `la J${jornada}` : "este partido";
  if (mo.done) return `La forma: ${j}, ${result.win ? "ganada" : result.draw ? "empatada" : "perdida"}; ${left ? `${left === 1 ? "queda una" : `quedan ${numWord(left)}`}` : "no queda ninguna"}`;
  if (mo.played) return `La forma, con ${j} provisional`;
  return "La forma";
}

// ───────────────────────── the season left ─────────────────────────

const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
/** «Dom 2 nov, 19:00» in club time («Sin fecha» undated). */
export function whenText(ms: number): string {
  if (!Number.isFinite(ms)) return "Sin fecha";
  const [y, mo, d] = madridDate(ms).split("-").map(Number);
  const dow = DOW[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  return `${dow} ${d} ${MONTHS_SHORT[mo - 1] ?? ""}, ${madridTime(ms)}`;
}

export interface Fixture {
  id: string;
  j: string;
  rival: string;
  where: string;
  when: string;
}
export function fixturesOf(next: readonly ClubMatch[], jornadaOf: (id: string) => number | null, dateMs: (m: ClubMatch) => number): { list: Fixture[]; sub: string } {
  const list = next.map((m) => {
    const j = jornadaOf(m.id);
    return { id: m.id, j: j ? `J${j}` : "·", rival: m.rival ?? "Rival", where: m.home === false ? "Fuera" : "En casa", when: whenText(dateMs(m)) };
  });
  const home = next.filter((m) => m.home !== false).length;
  const n = next.length;
  return { list, sub: `${n} ${n === 1 ? "jornada" : "jornadas"}: ${home} en casa, ${n - home} fuera` };
}

// ───────────────────────── the acta's ledger ─────────────────────────

type LedgerRow = Partial<Record<string, unknown>>;
const num = (row: LedgerRow | undefined, k: string): number => (typeof row?.[k] === "number" ? (row[k] as number) : 0);
const has = (ledger: Record<string, LedgerRow>, k: string): boolean => Object.values(ledger).some((r) => typeof r[k] === "number");

export interface Leader {
  id: string;
  what: string;
  v: number;
  t: string;
}
const CATS: [string, string, string, string | null][] = [
  ["passesCompleted", "Pases buenos", "pases buenos", "passes"],
  ["shots", "Remates", "remates", "shotsOnTarget"],
  ["recoveries", "Recuperaciones", "recuperaciones", null],
  ["saves", "Paradas", "paradas", null],
  ["minutes", "Minutos", "minutos", null],
];
/** «Quién sumó»: the night's best in each column of the ledger (guests left out); without a ledger, the goals
 *  and assists of the plays. */
export function leadersOf(ledger: Record<string, LedgerRow> | null | undefined, plays: readonly { k: string; who?: string; assist?: string }[]): Leader[] {
  if (!ledger || !Object.keys(ledger).length) {
    const g = new Map<string, number>();
    const a = new Map<string, number>();
    for (const p of plays) {
      if (p.k !== "gol") continue;
      if (p.who) g.set(p.who, (g.get(p.who) ?? 0) + 1);
      if (p.assist) a.set(p.assist, (a.get(p.assist) ?? 0) + 1);
    }
    return [
      ...[...g].map(([id, v]) => ({ id, v, t: v === 1 ? "gol" : "goles", what: "Goles" })),
      ...[...a].map(([id, v]) => ({ id, v, t: v === 1 ? "asistencia" : "asistencias", what: "Asistencias" })),
    ];
  }
  const out: Leader[] = [];
  for (const [k, what, t, extra] of CATS) {
    let best: { id: string; v: number } | null = null;
    for (const [id, row] of Object.entries(ledger)) {
      if (id.startsWith("guest:")) continue;
      const v = num(row, k);
      if (v > 0 && (!best || v > best.v)) best = { id, v };
    }
    if (!best) continue;
    const row = ledger[best.id];
    const more = extra && typeof row[extra] === "number" ? (extra === "passes" ? ` de ${num(row, "passes")}` : `, ${num(row, extra)} a puerta`) : "";
    out.push({ id: best.id, what, v: best.v, t: `${t}${more}` });
  }
  return out;
}

export interface Vistazo {
  n: number;
  unit: string;
  t: string;
  d: string;
}
/** «De un vistazo»: the acta's ledger summed over the team (as the board's data.js derives it); a figure the
 *  ledger does not carry is left out. */
export function vistazoOf(ledger: Record<string, LedgerRow> | null | undefined, nameOf: (id: string) => string): Vistazo[] {
  if (!ledger) return [];
  const s = (k: string) => Object.values(ledger).reduce((a, r) => a + num(r, k), 0);
  const out: Vistazo[] = [];
  if (has(ledger, "shots")) out.push({ n: s("shots"), unit: "", t: "remates", d: `${s("shotsOnTarget")} a puerta` });
  if (has(ledger, "passes")) {
    const p = s("passes");
    const ok = s("passesCompleted");
    out.push({ n: p, unit: "", t: "pases", d: "intentados" });
    out.push({ n: p ? Math.round((ok / p) * 100) : 0, unit: " %", t: "de pases buenos", d: `${ok} de ${p}` });
  }
  if (has(ledger, "recoveries")) {
    const i = s("interceptions");
    out.push({ n: s("recoveries") + i, unit: "", t: "recuperaciones", d: `${i} ${i === 1 ? "interceptación" : "interceptaciones"}` });
  }
  if (has(ledger, "saves")) {
    const who = Object.entries(ledger).filter(([, r]) => num(r, "saves") > 0).sort((a, b) => num(b[1], "saves") - num(a[1], "saves"));
    out.push({ n: s("saves"), unit: "", t: "paradas", d: who.length ? `de ${andList(who.map(([id]) => nameOf(id)))}` : "ninguna" });
  }
  if (has(ledger, "dribbles")) out.push({ n: s("dribblesWon"), unit: "", t: "regates buenos", d: `de ${s("dribbles")}` });
  return out;
}

/** The keeper's note under the bars: a penalty saved up to the minute, else (the whole match) his saves. */
export function saveNoteOf(plays: readonly { k: string; m: number; who?: string }[], ledger: Record<string, LedgerRow> | null | undefined, minute: number, duration: number, nameOf: (id: string) => string): string {
  const sv = plays.find((p) => p.k === "parada" && p.m <= minute);
  if (sv) return `${sv.who ? nameOf(sv.who) : "Nuestro portero"} paró un penalti en el ${sv.m}.`;
  if (!ledger || minute < duration) return "";
  const best = Object.entries(ledger)
    .filter(([id, r]) => !id.startsWith("guest:") && num(r, "saves") > 0)
    .sort((a, b) => num(b[1], "saves") - num(a[1], "saves"))[0];
  if (!best) return "";
  const n = num(best[1], "saves");
  return `${nameOf(best[0])} hizo ${n === 1 ? "una parada" : `${n} paradas`}: sin él, la cuenta habría sido más larga.`;
}

// ───────────────────────── the rival ─────────────────────────

/** «3G 1E 0P» and its words. */
export function recordText(r: Record3): { short: string; long: string } {
  const w = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return { short: `${r.wins}G ${r.draws}E ${r.losses}P`, long: `${w(r.wins, "victoria", "victorias")}, ${w(r.draws, "empate", "empates")} y ${w(r.losses, "derrota", "derrotas")}` };
}

/** The lede of «El rival» before the whistle, from the meetings before this one. */
export function rivalLede(rival: string, r: Record3, last: { gf: number; ga: number; when: string } | null): { b: string; rest: string } {
  if (!r.played) return { b: `Primera vez contra ${rival}.`, rest: "No hay precedentes: este partido abre el historial. Lo que pase, aquí se queda escrito." };
  const veces = r.played === 1 ? "una vez" : `${r.played} veces`;
  const tail = last ? ` La última, ${letterOf(last.gf, last.ga) === "G" ? "victoria" : letterOf(last.gf, last.ga) === "E" ? "empate" : "derrota"} ${last.gf}–${last.ga}${last.when ? ` el ${last.when}` : ""}.` : "";
  return { b: `Ya nos hemos visto ${veces}.`, rest: `${recordText(r).long}; ${r.gf} a favor y ${r.ga} en contra.${tail}` };
}

/** The two facts under the lede: where it is played, and how they come (the table, else the first jornada). */
export function rivalFacts(o: { home: boolean; venue: string; jornada: number | null; theirRow: { pos: number; pts: number; pj: number } | null }): { icon: "away" | "cal"; text: string }[] {
  const out: { icon: "away" | "cal"; text: string }[] = [];
  const the = /^(CDM|CDF|Campo|Polideportivo|Estadio|Pabellón|Complejo)\b/i.test(o.venue);
  if (o.home) out.push({ icon: "away", text: o.venue ? `Vienen de visitantes ${the ? "al" : "a"} ${o.venue}.` : "Vienen de visitantes a nuestro campo." });
  else out.push({ icon: "away", text: o.venue ? `Jugamos de visitantes, en ${the ? "el " : ""}${o.venue}.` : "Jugamos de visitantes, en su campo." });
  if (o.theirRow && o.theirRow.pj > 0) out.push({ icon: "cal", text: `Llegan ${ORD(o.theirRow.pos)}, con ${o.theirRow.pts} ${o.theirRow.pts === 1 ? "punto" : "puntos"} en ${o.theirRow.pj} ${o.theirRow.pj === 1 ? "partido" : "partidos"}.` });
  else if (o.jornada === 1) out.push({ icon: "cal", text: "También es su primera jornada: nadie sabe aún cómo llegan." });
  return out;
}

/** The record after the acta: who scored against them and the biggest win. */
export function recordAfter(o: { rec: Record3; scorers: { name: string; goals: number }[]; biggest: { gf: number; ga: number; here: boolean; when: string } | null }): { lede: string; scorers: string; bestK: string; best: string } {
  const { rec } = o;
  const lede = rec.played <= 1 ? "Este fue el primer cara a cara: el historial contra ellos empieza aquí." : `Ya nos hemos visto ${rec.played} veces: ${recordText(rec).long}.`;
  const sc = o.scorers;
  const scorers = !sc.length ? (rec.gf ? "Sin goleador apuntado: actas antiguas o autogoles suyos." : "Todavía no les hemos marcado.") : sc.length === 1 ? `${sc[0].name}, ${sc[0].goals === 1 ? "un gol" : `${sc[0].goals} goles`}` : andList(sc.map((s) => s.name));
  if (!o.biggest) return { lede, scorers, bestK: "La primera victoria", best: "Aún sin victoria contra ellos: la próxima puede ser la primera." };
  return { lede, scorers, bestK: "La mayor victoria", best: `${o.biggest.gf}–${o.biggest.ga}, ${o.biggest.here ? "este partido" : o.biggest.when}` };
}
