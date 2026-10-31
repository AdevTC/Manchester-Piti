// «Tú» › Tus partidos, pure: what the place draws from his season's rows (tu/me JornadaRow). The head and the
// season switcher (TuCarta «partidos»), the river of every jornada (TuTemporada tt-river: the played bar is the
// nota with its number and band word, G/A marks, the MVP in gold; «No jugaste»; the absence with its why; the
// ones to come as outlines; the next one with his convocatoria; «Tu media»), the jornada in focus as A's match
// sheet (TuFicha tf-md: the big nota and its word against his average, the result with G/E/P, his minutes on
// the match's real length with its stints, the acta's figures that exist), B's nota chart and figures, and C's
// table with its filters. Our score always first («3–8»).
import { dateFormat } from "../../../../lib/intlCache";
import { notaBand, type NotaBand } from "../../../../lib/rating/semaforo";
import type { ResultLetter } from "../../../../lib/derived/result";
import type { Answer, JornadaRow, SeasonFigures } from "../me";

const TZ = "Europe/Madrid";
export const dec = (n: number): string => n.toFixed(1).replace(".", ",");
const pl = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const fmt = (o: Intl.DateTimeFormatOptions) => dateFormat("es-ES", { timeZone: TZ, ...o });
const ok = (ms: number) => Number.isFinite(ms);
/** «8 nov». */
export const dShort = (ms: number): string => (ok(ms) ? fmt({ day: "numeric", month: "short" }).format(ms).replace(".", "") : "");
/** «dom 8 nov». */
export const dDay = (ms: number): string => (ok(ms) ? fmt({ weekday: "short", day: "numeric", month: "short" }).format(ms).replace(/\./g, "").replace(",", "") : "");
/** «domingo 8 de noviembre». */
export const dLong = (ms: number): string => (ok(ms) ? fmt({ weekday: "long", day: "numeric", month: "long" }).format(ms).replace(",", "") : "");
/** «18:00». */
export const hhmm = (ms: number): string => (ok(ms) ? fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms) : "");
/** «en casa» / «fuera» / «» (an unknown home is never «en casa»). */
export const where = (home: boolean | null): string => (home === true ? "en casa" : home === false ? "fuera" : "");
const RES_VERB: Record<ResultLetter, string> = { G: "Ganamos", E: "Empatamos", P: "Perdimos" };
/** «Perdimos 1–8» (our score first). */
export const resShort = (r: Pick<JornadaRow, "gf" | "ga" | "result">): string => (r.result && r.gf !== null && r.ga !== null ? `${RES_VERB[r.result]} ${r.gf}–${r.ga}` : "");
/** «Perdimos 1–8 contra Orduña» · «Ganamos 3–1 a Pitutis» · «Empatamos 2–2 con …». */
export const resSentence = (r: Pick<JornadaRow, "gf" | "ga" | "result" | "rival">): string => {
  if (!r.result || r.gf === null || r.ga === null) return `Contra ${r.rival}`;
  return `${RES_VERB[r.result]} ${r.gf}–${r.ga} ${r.result === "G" ? "a" : r.result === "P" ? "contra" : "con"} ${r.rival}`;
};
const done = (r: JornadaRow) => r.kind === "played" || r.kind === "didnt" || r.kind === "absent";
const ANSWER_SHORT: Record<Answer, string> = { yes: "Has dicho que vas", maybe: "Has dicho que tienes duda", no: "Has dicho que no vas" };

// ── the season switcher (Temporada 1 / the archived ones), honouring ?temporada= (an id or the name's slug)

/** The season's address word, the one Partidos writes (?temporada=temporada-1): the same rule as
 *  partidos/pa/season slugW (not imported: it would pull Partidos' model into this page's chunk). */
export const slugOf = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export interface SeasonOpt {
  id: string;
  /** «Temporada 1», «Archivo 2025/26». */
  t: string;
  name: string;
  slug: string;
  archived: boolean;
  on: boolean;
  current: boolean;
}
/** The seasons he can look at: the current one first, then the rest (newest first, the archived ones last). */
export function seasonChoices(seasons: readonly { id: string; name: string; archived?: boolean }[], currentId: string, asked: string | undefined): { selected: string; opts: SeasonOpt[] } {
  const hit = asked ? seasons.find((s) => s.id === asked || slugOf(s.name) === asked) : undefined;
  const selected = hit?.id ?? currentId;
  const cur = seasons.filter((s) => s.id === currentId);
  const rest = seasons.filter((s) => s.id !== currentId);
  const ordered = [...cur, ...rest.filter((s) => !s.archived).reverse(), ...rest.filter((s) => s.archived).reverse()];
  return {
    selected,
    opts: ordered.map((s) => ({ id: s.id, t: s.archived ? `Archivo ${s.name.replace(/^temporada\s+/i, "")}` : s.name, name: s.name, slug: slugOf(s.name), archived: !!s.archived, on: s.id === selected, current: s.id === currentId })),
  };
}

// ── the head («Uno jugado, con un 4,7»)

export interface Head {
  title: string;
  sub: string;
}
/** The place's status line and what's behind it. */
export function headOf(rows: readonly JornadaRow[], f: SeasonFigures, seasonName: string): Head {
  const past = rows.filter(done);
  const next = rows.find((r) => r.kind === "next") ?? null;
  const avg = f.average;
  const nextBit = next ? ` La ${next.jLabel !== "—" ? next.jLabel : "siguiente"} es el ${dLong(next.dateMs).split(" de ")[0]}.` : "";
  if (!past.length) return { title: rows.length ? "Tu temporada aún no ha empezado" : "Aún no hay partidos", sub: rows.length ? `La ${seasonName} tiene ${pl(rows.length, "jornada", "jornadas")} por delante.${nextBit}` : "Cuando el club ponga el calendario, aquí salen tus jornadas." };
  if (!f.played) return { title: "Aún sin jugar", sub: `Tras la ${past[past.length - 1].jLabel}: ${pl(past.length, "jornada", "jornadas")} y aún no has salido al campo.${nextBit}` };
  const title = f.played === 1 ? (avg !== null ? `Uno jugado, con un ${dec(avg)}` : "Uno jugado") : avg !== null ? `${f.played} partidos, ${dec(avg)} de media` : `${f.played} partidos jugados`;
  const last = past[past.length - 1];
  let sub: string;
  if (past.length <= 3) {
    const bits = past.map((r) => {
      if (r.kind === "played") return `jugaste la ${r.jLabel}${r.min !== null ? ` (${r.min}′${r.posLong ? ` de ${r.posLong.toLowerCase()}` : ""})` : ""}`;
      if (r.kind === "didnt") return `la ${r.jLabel} la viste desde fuera`;
      return `en la ${r.jLabel} no estuviste`;
    });
    const joined = bits.length > 1 ? `${bits.slice(0, -1).join(", ")} y ${bits[bits.length - 1]}` : bits[0];
    sub = `Tras la ${last.jLabel}: ${joined}.${nextBit}`;
  } else {
    const best = f.best;
    sub = `Tras la ${last.jLabel}: jugaste ${f.played} de ${past.length}.${best && best.nota !== null ? ` Tu mejor noche, la ${best.jLabel} contra ${best.rival} (${dec(best.nota)}).` : ""}${nextBit}`;
  }
  return { title, sub };
}

// ── the river

/** The jornada «Hoy» points at: the next one, or the last of the season once it is over. */
export const nowIndex = (rows: readonly JornadaRow[]): number => {
  const n = rows.findIndex((r) => r.kind === "next");
  return n >= 0 ? n : rows.length - 1;
};
/** The jornada shown when none is asked: his last played, else the present. */
export const defaultIndex = (rows: readonly JornadaRow[]): number => {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].kind === "played") return i;
  return nowIndex(rows);
};

/** «1 jugado · 20 por jugar · tu media 4,7 (baja)». */
export function riverMeta(rows: readonly JornadaRow[], f: SeasonFigures): string {
  const up = rows.filter((r) => r.kind === "next" || r.kind === "up").length;
  return [pl(f.played, "jugado", "jugados"), up ? `${up} por jugar` : "", f.average !== null ? `tu media ${dec(f.average)} (${notaBand(f.average).word.toLowerCase()})` : ""].filter(Boolean).join(" · ");
}

export interface RiverCol {
  kind: JornadaRow["kind"];
  isPlayed: boolean;
  notaT: string;
  band: NotaBand;
  word: string;
  /** The bar's height (px): the nota × 12, at least 30. */
  h: string;
  /** The phone's bar width (%). */
  w: string;
  mvp: boolean;
  gT: string;
  aT: string;
  res: ResultLetter | null;
  tiny: string;
  ghostCls: string;
  ghostT: string;
  aria: string;
  /** The phone river's line under the rival. */
  pline: string;
}
/** One jornada of the river (column on the ribbon, row on the phone). */
export function riverCol(r: JornadaRow): RiverCol {
  const isPlayed = r.kind === "played";
  const willMiss = (r.kind === "up" || r.kind === "next") && r.answer === "no";
  const ghost: [string, string] = r.kind === "didnt" ? ["is-out", "No jugaste"] : r.kind === "absent" ? ["is-abs", r.reason ?? "Ausente"] : willMiss ? ["is-upabs", "No estarás"] : r.kind === "up" ? ["is-up", ""] : ["", ""];
  const res = resShort(r);
  const parts = [`${r.jLabel}, ${r.rival}`];
  if (isPlayed) parts.push(`${r.nota !== null ? `tu nota ${r.notaText}, ${r.bandWord}` : "sin nota"}${r.min !== null ? `, ${r.min} minutos` : ""}${r.g ? `, ${pl(r.g, "gol", "goles")}` : ""}${r.a ? `, ${pl(r.a, "asistencia", "asistencias")}` : ""}${r.mvp ? ", MVP" : ""}`);
  else if (r.kind === "didnt") parts.push("no jugaste");
  else if (r.kind === "absent") parts.push(`ausente: ${(r.reason ?? "").toLowerCase()}`);
  parts.push(res ? res.toLowerCase() : `por jugar, ${dShort(r.dateMs)}${r.kind === "next" ? " (la siguiente)" : ""}${willMiss ? ", has dicho que no vas" : ""}`);
  const pline =
    r.kind === "next"
      ? ["La siguiente", `${dShort(r.dateMs)}, ${hhmm(r.dateMs)}`, where(r.home)].filter(Boolean).join(" · ")
      : res
        ? [dShort(r.dateMs), res, isPlayed && r.min !== null ? `${r.min}′` : "", isPlayed && r.g ? `${r.g} G` : "", isPlayed && r.a ? `${r.a} A` : ""].filter(Boolean).join(" · ")
        : [`${dShort(r.dateMs)}, ${hhmm(r.dateMs)}`, willMiss ? "has dicho que no vas" : ""].filter(Boolean).join(" · ");
  return {
    kind: r.kind,
    isPlayed,
    notaT: isPlayed ? r.notaText : "",
    band: r.band,
    word: r.bandWord,
    h: `${Math.max(30, Math.round((r.nota ?? 0) * 12))}px`,
    w: `${Math.max(6, Math.round((r.nota ?? 0) * 10))}%`,
    mvp: isPlayed && r.mvp,
    gT: isPlayed && r.g ? (r.g > 1 ? `${r.g}G` : "G") : "",
    aT: isPlayed && r.a ? (r.a > 1 ? `${r.a}A` : "A") : "",
    res: r.result,
    tiny: dShort(r.dateMs),
    ghostCls: ghost[0],
    ghostT: ghost[1],
    aria: parts.join(", "),
    pline,
  };
}
/** Where «Tu media» crosses the ribbon (from its bottom, px): the bar's scale over the labels' 62 px. */
export const avgBottom = (avg: number): string => `${Math.round(62 + avg * 12)}px`;

/** The phone river: the next one on top, then the past from the newest; the rest of the future folded. */
export function phoneRiver(rows: readonly JornadaRow[], showFuture: boolean): { list: { r: JornadaRow; i: number }[]; future: number; futureT: string } {
  const idx = rows.map((r, i) => ({ r, i }));
  const fut = idx.filter((x) => x.r.kind === "up");
  const next = idx.filter((x) => x.r.kind === "next");
  const past = idx.filter((x) => done(x.r)).reverse();
  const futureT = !fut.length ? "" : showFuture ? "Recoger lo que viene" : `Más adelante: ${pl(fut.length, "jornada", "jornadas")}${fut.length > 1 ? `, de la ${fut[0].r.jLabel} a la ${fut[fut.length - 1].r.jLabel}` : ""}`;
  return { list: [...(showFuture ? [...fut].reverse() : []), ...next, ...past], future: fut.length, futureT };
}

// ── the nota chart (TuCarta chartOf) and the figures

export interface Chart {
  grid: string;
  line: string;
  dots: string;
  gold: string;
  avg: string;
  labs: { left: string; top: string; t: string }[];
  js: { left: string; t: string }[];
  gs: { top: string; t: string }[];
  note: string;
  aria: string;
  /** How many notas it draws. */
  n: number;
}
/** One x per completed jornada (played or not), y = the nota (3–10): the line breaks where he didn't play. */
export function chartOf(rows: readonly JornadaRow[], f: SeasonFigures): Chart {
  const W = 640, H = 200, x0 = 40, x1 = 620, top = 14, bot = 172, lo = 3, hi = 10;
  const past = rows.filter(done);
  const n = Math.max(2, past.length);
  const X = (i: number) => x0 + (i / Math.max(1, n - 1)) * (x1 - x0);
  const Y = (v: number) => bot - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (bot - top);
  let line = "", dots = "", gold = "", pen = false;
  const labs: Chart["labs"] = [];
  const js: Chart["js"] = [];
  past.forEach((r, i) => {
    js.push({ left: `${((X(i) / W) * 100).toFixed(2)}%`, t: r.kind === "played" ? r.jLabel : `${r.jLabel} ·` });
    if (r.kind !== "played" || r.nota === null) {
      pen = false;
      return;
    }
    const x = X(i), y = Y(r.nota);
    line += `${pen ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    pen = true;
    const c = `M${(x - 5).toFixed(1)} ${y.toFixed(1)}a5 5 0 1 0 10 0a5 5 0 1 0 -10 0`;
    if (r.mvp) gold += c;
    else dots += c;
    labs.push({ left: `${((x / W) * 100).toFixed(2)}%`, top: `${((y / H) * 100).toFixed(2)}%`, t: `${r.notaText}${r.mvp ? " · MVP" : ""}` });
  });
  const notas = labs.length;
  const firstOut = past.find((r) => r.kind !== "played");
  return {
    grid: [6, 7, 8].map((v) => `M${x0} ${Y(v).toFixed(1)}H${x1}`).join(""),
    line: notas > 1 ? line : "",
    dots,
    gold,
    avg: f.average !== null && notas > 1 ? `M${x0} ${Y(f.average).toFixed(1)}H${x1}` : "",
    labs,
    js,
    gs: [6, 7, 8].map((v) => ({ top: `${((Y(v) / H) * 100).toFixed(2)}%`, t: `${v},0` })),
    note: !notas
      ? "Tu primera nota sale con tu primer partido: la que el acta deja congelada."
      : notas === 1
        ? `Con una sola nota es un punto: con la segunda sale tu línea.${firstOut ? ` La ${firstOut.jLabel} no cuenta: no jugaste.` : ""} Las líneas marcan el 6 (floja), el 7 (buena) y el 8 (muy buena).`
        : `La línea discontinua es tu media (${dec(f.average as number)}). Huecos: jornadas que no jugaste.${labs.some((l) => l.t.endsWith("MVP")) ? " En oro, tu MVP." : ""}`,
    aria: `Tus notas: ${past.map((r) => `${r.jLabel} ${r.kind === "played" ? (r.nota !== null ? r.notaText : "sin nota") : "sin jugar"}`).join(", ")}${f.average !== null && notas > 1 ? `. Tu media, ${dec(f.average)}` : ""}`,
    n: notas,
  };
}

/** B's figures: partidos, minutos, media, mejor partido, G·A, MVP. */
export function figsOf(rows: readonly JornadaRow[], f: SeasonFigures): { v: string; k: string }[] {
  const past = rows.filter(done).length;
  const best = f.best;
  return [
    { v: `${f.played} de ${past}`, k: "Jornadas jugadas" },
    { v: f.minutes !== null ? `${f.minutes}′` : "—", k: "Minutos" },
    { v: f.average !== null ? dec(f.average) : "—", k: f.average !== null ? `Nota media · ${notaBand(f.average).word.toLowerCase()}` : "Nota media" },
    { v: best ? best.jLabel : "—", k: best && best.nota !== null ? `Tu mejor partido: ${dec(best.nota)} contra ${best.rival}` : "Tu mejor partido" },
    { v: `${f.goals} · ${f.assists}`, k: "Goles · asistencias" },
    { v: String(f.mvps), k: "MVP de la jornada" },
  ];
}

// ── C's table / list with its filters

export type Filter = "jugados" | "todos" | "porjugar";
export function filterOpts(rows: readonly JornadaRow[]): { k: Filter; t: string; n: number }[] {
  const up = rows.filter((r) => r.kind === "next" || r.kind === "up").length;
  return [
    { k: "jugados", t: "Jugados", n: rows.filter((r) => r.kind === "played").length },
    { k: "todos", t: "Todos", n: rows.length },
    { k: "porjugar", t: "Por jugar", n: up },
  ];
}
export interface TableRow {
  i: number;
  r: JornadaRow;
  dateT: string;
  haT: string;
  /** «P · 1–8». */
  resT: string;
  minT: string;
  posT: string;
  gaT: string;
  isPlayed: boolean;
  kindT: string;
  trCls: string;
  pline: string;
  openAria: string;
}
export function tableRows(rows: readonly JornadaRow[], filter: Filter, nextAnswer: Answer | null): TableRow[] {
  return rows.flatMap((r, i): TableRow[] => {
    const keep = filter === "todos" ? true : filter === "jugados" ? r.kind === "played" : r.kind === "next" || r.kind === "up";
    if (!keep) return [];
    const isPl = r.kind === "played";
    const answer = r.kind === "next" ? nextAnswer ?? r.answer : r.answer;
    const kindT = r.kind === "didnt" ? "No jugaste" : r.kind === "absent" ? `Ausente · ${r.reason ?? ""}` : r.kind === "next" ? (answer ? ANSWER_SHORT[answer] : "La siguiente · ¿vas?") : answer === "no" ? "Has dicho que no vas" : `Por jugar · ${hhmm(r.dateMs)}`;
    const ga = [r.g ? pl(r.g, "gol", "goles") : "", r.a ? `${r.a} asist.` : ""].filter(Boolean).join(" · ");
    return [
      {
        i,
        r,
        dateT: dShort(r.dateMs),
        haT: where(r.home) || "—",
        resT: r.result ? `${r.result} · ${r.gf}–${r.ga}` : "—",
        minT: isPl && r.min !== null ? `${r.min}′` : "—",
        posT: isPl ? (r.posLong ?? "—") : "—",
        gaT: isPl && ga ? ga : "—",
        isPlayed: isPl,
        kindT,
        trCls: isPl ? "" : r.kind === "next" ? "is-next" : "is-quiet",
        pline: [dShort(r.dateMs), r.result ? `${r.result} ${r.gf}–${r.ga}` : hhmm(r.dateMs), isPl && r.min !== null ? `${r.min}′` : "", isPl && r.pos ? r.pos : "", isPl && r.g ? `${r.g} G` : "", isPl && r.a ? `${r.a} A` : ""].filter(Boolean).join(" · "),
        openAria: `Abrir tu ${r.jLabel !== "—" ? r.jLabel : "jornada"} contra ${r.rival}`,
      },
    ];
  });
}

// ── the jornada in focus (A's match sheet; C's «other» for what isn't played)

export interface FocusFig {
  k: string;
  v: string;
  s: string;
}
export interface Focus {
  i: number;
  r: JornadaRow;
  /** «J1 · domingo 18 de octubre · en casa». */
  kick: string;
  /** «Tu partido contra Orduña». */
  title: string;
  /** played · out (didn't / absent) · next · up */
  mode: "played" | "out" | "next" | "up";
  notaT: string;
  band: NotaBand;
  word: string;
  notaLine: string;
  /** «1–8» and «Perdimos en casa contra Orduña». */
  score: string;
  resLine: string;
  stints: { left: string; width: string }[];
  durT: string;
  half: string;
  stintT: string;
  stintAria: string;
  ledger: FocusFig[];
  outT: string;
  outLine: string;
  /** next / up: the line under the title. */
  lead: string;
  prev: { i: number; t: string; aria: string } | null;
  next: { i: number; t: string; aria: string } | null;
}

/** The figures his acta row recorded, as A's sheet lists them (goals and assists first, passes «de» the total). */
export function focusLedger(r: JornadaRow): FocusFig[] {
  const by = new Map(r.ledger.map((l) => [l.k, l.v]));
  const out: FocusFig[] = [];
  if (r.g) out.push({ k: r.g === 1 ? "Gol" : "Goles", v: String(r.g), s: "" });
  if (r.a) out.push({ k: r.a === 1 ? "Asistencia" : "Asistencias", v: String(r.a), s: "" });
  const pc = by.get("passesCompleted"), pt = by.get("passes");
  if (pc !== undefined && pt !== undefined && pt >= pc) out.push({ k: "Pases", v: `${pc} de ${pt}`, s: `${Math.round((pc * 100) / pt)} % buenos` });
  const sh = by.get("shots"), so = by.get("shotsOnTarget");
  if (sh !== undefined) out.push({ k: "Remates", v: String(sh), s: so !== undefined ? `${so} a puerta` : "" });
  const skip = new Set([pc !== undefined && pt !== undefined && pt >= pc ? "passesCompleted" : "", pc !== undefined && pt !== undefined && pt >= pc ? "passes" : "", sh !== undefined ? "shots" : "", sh !== undefined ? "shotsOnTarget" : ""]);
  for (const l of r.ledger) if (!skip.has(l.k)) out.push({ k: l.label, v: String(l.v), s: "" });
  return out;
}

const stintsOf = (r: JornadaRow): { from: number; to: number }[] => {
  if (r.stints.length) return r.stints.map((s) => ({ from: Math.max(0, Math.min(r.dur, s.from)), to: Math.max(0, Math.min(r.dur, s.to)) })).filter((s) => s.to > s.from);
  if (r.min === null) return [];
  return r.start === false ? [{ from: Math.max(0, r.dur - r.min), to: r.dur }] : [{ from: 0, to: Math.min(r.dur, r.min) }];
};
const navOf = (rows: readonly JornadaRow[], i: number, d: -1 | 1) => {
  const o = rows[i + d];
  if (!o) return null;
  return { i: i + d, t: o.jLabel !== "—" ? o.jLabel : d < 0 ? "Anterior" : "Siguiente", aria: `${d < 0 ? "Jornada anterior" : "Jornada siguiente"}: ${o.jLabel !== "—" ? `${o.jLabel} ` : ""}contra ${o.rival}` };
};

/** The jornada at `i` as the focus panel / the sheet draws it. */
export function focusOf(rows: readonly JornadaRow[], i: number, f: SeasonFigures): Focus | null {
  const r = rows[i];
  if (!r) return null;
  const w = where(r.home);
  const jl = r.jLabel !== "—" ? r.jLabel : "Amistoso";
  const base: Focus = {
    i,
    r,
    kick: [r.kind === "played" ? `Tu ${jl}` : jl, dLong(r.dateMs), w].filter(Boolean).join(" · "),
    title: r.kind === "played" ? `Tu partido contra ${r.rival}` : r.kind === "next" || r.kind === "up" ? `${jl} contra ${r.rival}` : resSentence(r),
    mode: r.kind === "played" ? "played" : r.kind === "next" ? "next" : r.kind === "up" ? "up" : "out",
    notaT: r.nota !== null ? r.notaText : "—",
    band: r.band,
    word: r.bandWord,
    notaLine: "",
    score: r.gf !== null && r.ga !== null ? `${r.gf}–${r.ga}` : "",
    resLine: r.result ? `${RES_VERB[r.result]}${w ? ` ${w}` : ""} contra ${r.rival}` : "",
    stints: [],
    durT: `${r.dur}′`,
    half: `${Math.round(r.dur / 2)}′`,
    stintT: "",
    stintAria: "",
    ledger: [],
    outT: "",
    outLine: "",
    lead: "",
    prev: navOf(rows, i, -1),
    next: navOf(rows, i, 1),
  };
  if (r.kind === "played") {
    const notas = rows.filter((x) => x.kind === "played" && x.nota !== null).length;
    base.notaLine =
      r.nota === null
        ? "El acta no le puso nota a este partido."
        : `Tu nota del partido, congelada en el acta. ${f.average !== null && notas > 1 ? `${r.nota >= f.average ? "Por encima" : "Por debajo"} de tu media (${dec(f.average)}).` : "Es tu primera nota de la temporada."}${r.mvp ? " MVP de la jornada." : ""}`;
    const st = stintsOf(r);
    base.stints = st.map((s) => ({ left: `${((s.from / r.dur) * 100).toFixed(1)}%`, width: `${(((s.to - s.from) / r.dur) * 100).toFixed(1)}%` }));
    const min = r.min ?? Math.round(st.reduce((t, s) => t + s.to - s.from, 0));
    const span = (s: { from: number; to: number }) => `del ${Math.round(s.from)}′ al ${Math.round(s.to)}′`;
    const how = !st.length ? (r.start ? "titular" : "desde el banquillo") : st.length === 1 ? (r.start ? `titular, ${span(st[0])}` : `entraste en el ${Math.round(st[0].from)}′`) : `${r.start ? "titular" : "desde el banquillo"}, en ${st.length} tramos: ${st.slice(0, -1).map(span).join(", ")} y ${span(st[st.length - 1])}`;
    base.stintT = [`${min}′ de ${r.dur}`, how, r.posLong ? r.posLong.toLowerCase() : ""].filter(Boolean).join(" · ");
    base.stintAria = st.length ? `En el campo ${st.map(span).join(" y ")}, de ${r.dur}` : `${min} minutos de ${r.dur}`;
    base.ledger = focusLedger(r);
    return base;
  }
  if (r.kind === "didnt" || r.kind === "absent") {
    const res = resShort(r);
    base.outT = r.kind === "didnt" ? "No jugaste" : `Ausente: ${(r.reason ?? "").toLowerCase()}`;
    base.outLine =
      r.kind === "didnt"
        ? `La viste desde fuera. ${res}.`
        : r.answer === "no"
          ? `Lo avisaste en la convocatoria, así que no cuenta como falta. ${res}.`
          : r.reason === "No convocado"
            ? `No saliste en la convocatoria. ${res}.`
            : `No estabas en el acta. ${res}.`;
    return base;
  }
  const when = [`${dLong(r.dateMs)}, ${hhmm(r.dateMs)}`, w].filter(Boolean).join(" · ");
  base.lead = r.kind === "next" ? `La siguiente: ${when}.` : `${when}.${r.answer ? ` ${ANSWER_SHORT[r.answer]}.` : " Dirás si vas cuando sea la siguiente."}`;
  return base;
}
