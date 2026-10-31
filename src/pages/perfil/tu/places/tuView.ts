// «Tú» › Tú (TuCarta «tu»): the words and numbers the place draws, pure — who he is beside the card (kicker,
// chips, why his card is what it is), each «Lo que te toca» card (its kicker, title, line, tile, the «Solo lo ves
// tú» lock), what an answered one says in «Lo que ya has hecho», the calm line, and under the bar: the next match
// (countdown, line), his form (nota chips of his last jornadas with «No jugaste» shown, the trend line), the next
// milestone for his card, and B's «De qué está hecho» sheet for a number of the card (the matches that built it,
// how it moves the rating, the next milestone it feeds — rewards never add points).
import type { AttrKey } from "../../../../lib/derived/card";
import type { PorraLine } from "../../../../lib/derived/seasonPlayers";
import { dateFormat } from "../../../../lib/intlCache";
import type { TuIconName } from "../../../../components/vidrio/tu/ui";
import type { JornadaRow, Reward, Rewards, SeasonFigures, TierInfo } from "../me";
import type { PendingItem } from "../usePending";
import type { Kind } from "../model";
import { pl } from "../model";
import { niceName } from "../../../../lib/derived/words";

const TZ = "Europe/Madrid";
/** «domingo 8 de noviembre». */
const longDay = (ms: number) => dateFormat("es-ES", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(ms).replace(",", "");
const TIME = () => dateFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const DAY_KEY = () => dateFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dec = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
const lowerFirst = (s: string) => s.charAt(0).toLocaleLowerCase("es") + s.slice(1);
const upperFirst = (s: string) => s.charAt(0).toLocaleUpperCase("es") + s.slice(1);

/** Whole calendar days (Madrid) from `now` to `at`. */
export function dayGap(now: number, at: number): number {
  const f = DAY_KEY();
  return Math.round((Date.parse(`${f.format(at)}T00:00:00Z`) - Date.parse(`${f.format(now)}T00:00:00Z`)) / 86_400_000);
}

/** «Faltan 8 días», «Mañana», «Hoy». */
export function countdown(now: number, at: number): string {
  if (!Number.isFinite(at)) return "Fecha por confirmar";
  const d = dayGap(now, at);
  return d <= 0 ? "Hoy" : d === 1 ? "Mañana" : `Faltan ${d} días`;
}

// ───────────────────────── who he is, beside the card

export interface IdView {
  kick: string;
  chips: { t: string; cls: string }[];
  why: string;
}

/** The stage's words: «Tu página · Temporada 1, tras la J2», the chips and why his card is what it is. */
export function idView(o: {
  kind: Kind;
  captain: boolean;
  seasonName: string;
  /** The last completed jornada's label («J2»), null before the first. */
  lastJ: string | null;
  tier: TierInfo;
  figures: SeasonFigures;
  /** The only played row when there is exactly one (for «con un solo partido (J1, 4,7)»). */
  onlyPlayed: JornadaRow | null;
  /** The card has numbers (vinculada and the season started). */
  showNumbers: boolean;
  started: boolean;
  first: { dateMs: number; rival: string } | null;
  racha: boolean;
  pendingClaim: boolean;
}): IdView {
  const chips: IdView["chips"] = [];
  if (o.kind === "jugador") {
    const t = o.tier;
    if (o.showNumbers && t.rating !== null) chips.push({ t: `${t.name} · ${t.rating}${t.provisional ? " · provisional" : ""}`, cls: "is-ok" });
    else chips.push({ t: o.figures.played > 0 ? "GLOBAL pendiente" : "Carta nueva", cls: "" });
    if (o.racha) chips.push({ t: "En racha", cls: "is-ok" });
  }
  if (o.kind === "socio") chips.push({ t: "Socio del club", cls: "is-ok" });
  if (o.kind === "nuevo") chips.push(o.pendingClaim ? { t: "Ficha pendiente", cls: "is-ok" } : { t: "Sin ficha todavía", cls: "" });
  if (o.captain) chips.push({ t: "Capitán del vestuario", cls: "" });

  const kick = o.kind === "jugador" ? `Tu página · ${o.seasonName}${o.lastJ ? `, tras la ${o.lastJ}` : ""}` : o.kind === "socio" ? "Tu página · socio" : o.pendingClaim ? "Tu página · ficha en camino" : "Tu página · sin ficha";

  let why: string;
  if (o.kind === "socio") why = "Lo que el club sabe de ti y desde cuándo. Tu carné lleva el QR del club.";
  else if (o.kind === "nuevo") why = o.pendingClaim ? "Tu petición está en manos del capitán. Mientras, la porra, las encuestas y tus avisos ya son tuyos." : "Sin ficha no hay carta: elige la tuya en el vestuario y el capitán la confirma.";
  else if (o.showNumbers && o.tier.rating !== null) {
    const r = o.tier.rating;
    const one = o.onlyPlayed && o.figures.played === 1;
    const from = one ? `, con un solo partido (${o.onlyPlayed?.jLabel}${o.onlyPlayed?.nota !== null ? `, ${o.onlyPlayed?.notaText}` : ""})` : ` en ${pl(o.figures.played, "partido", "partidos")}`;
    const prov = o.tier.provisional ? (one ? " Por eso es provisional." : " Aún es provisional: se asienta con más minutos.") : "";
    why = `${r} de valoración: sale de tus notas por partido${from}.${prov} La misma que en la pizarra.`;
  } else if (!o.started) why = o.first ? `La ${o.seasonName} aún no ha empezado: tus números salen en la J1, el ${longDay(o.first.dateMs)} contra ${o.first.rival}.` : `La ${o.seasonName} aún no ha empezado: tus números salen en la J1.`;
  else if (o.figures.played > 0) why = "Tu valoración sale cuando un partido tuyo tenga nota: hacen falta tus minutos en el acta.";
  else why = "Tus números salen con tu primer partido.";
  return { kick, chips, why };
}

// ───────────────────────── «Lo que te toca»

export interface TodoView {
  /** «Convocatoria · J3», «La caja». */
  kick: string;
  title: string;
  line: string;
  icon: TuIconName;
  /** The tile's tone: warn for what he owes. */
  warn: boolean;
  /** «Solo lo ves tú» (la caja). */
  priv: boolean;
  /** The lead card (the convocatoria) spans the board. */
  lead: boolean;
}

/** The number of the J in «J3 · 18:00 · …» (the convocatoria's line). */
const leadJ = (s: string): string | null => /^J\d+/.exec(s)?.[0] ?? null;
/** «Kevin y 2 más piden entrar.» → 3. */
export function doorCount(body: string): number {
  const m = /y (\d+) más/.exec(body);
  return m ? 1 + Number(m[1]) : 1;
}

/** One card's words. `jOf`: a match's jornada (the porra's «· J3»). */
export function todoView(p: PendingItem, jOf: (matchId: string) => number | null = () => null): TodoView {
  const base = { warn: false, priv: false, lead: false };
  switch (p.kind) {
    case "rsvp": {
      const j = leadJ(p.body);
      const rest = (j ? p.body.slice(j.length).replace(/^ · /, "") : p.body).trim();
      return { ...base, kick: `Convocatoria${j ? ` · ${j}` : ""}`, title: p.title, line: rest ? `${upperFirst(rest)}.` : "", icon: "cal", lead: true };
    }
    case "caja":
      return { ...base, kick: "La caja", title: p.title, line: p.body, icon: "euro", warn: true, priv: true };
    case "turno": {
      const j = /de la (J\d+)/.exec(p.body)?.[1];
      return { ...base, kick: `Tu turno${j ? ` · ${j}` : ""}`, title: p.title, line: p.body.replace(/^Turnos( de la J\d+)?\. /, ""), icon: "wash" };
    }
    case "poll": {
      const at = p.body.indexOf(": ");
      const who = at > 0 ? p.body.slice(0, at) : "";
      const q = at > 0 ? p.body.slice(at + 2) : p.body;
      const votes = p.opts.reduce((s, o) => s + o.n, 0);
      return { ...base, kick: who ? `Encuesta de ${who}` : "Encuesta", title: q, line: votes ? `${pl(votes, "voto", "votos")} hasta ahora.` : "Aún no ha votado nadie.", icon: "poll" };
    }
    case "porra": {
      const j = jOf(p.matchId);
      return { ...base, kick: `Tu porra${j ? ` · J${j}` : ""}`, title: `Piti – ${p.rival}`, line: "Se cierra con el pitido.", icon: "star" };
    }
    case "mvp":
      return { ...base, kick: `El MVP${p.matchJ ? ` · J${p.matchJ}` : ""}`, title: p.title, line: `${upperFirst(p.body)}.`, icon: "trophy" };
    case "door": {
      const n = doorCount(p.body);
      return { ...base, kick: "Capitanía · la puerta", title: `${n === 1 ? "1 llama" : `${n} llaman`} a la puerta`, line: p.body, icon: "door" };
    }
  }
}

/** What an answered card says in «Lo que ya has hecho» (null: still open). */
export function doneText(p: PendingItem): string | null {
  if (!p.done) return null;
  switch (p.kind) {
    case "rsvp": {
      const j = leadJ(p.body);
      const when = p.title.replace(/^¿Vas /, "").replace(/ a .*$/, "");
      return p.value === "yes" ? `Vas ${when}` : p.value === "maybe" ? `En duda${j ? ` para la ${j}` : ""}` : `No vas${j ? ` a la ${j}` : ""}`;
    }
    case "caja":
      return "Pago avisado: el capitán lo apunta";
    case "turno":
      return `Turno hecho: ${p.title.replace(/^Te toca /, "")}`;
    case "poll": {
      const on = p.opts.filter((o) => o.on).map((o) => `«${o.label}»`);
      return `Votado: ${on.join(", ")}`;
    }
    case "porra":
      return p.saved ? `Porra: ${p.saved.gf}–${p.saved.ga}` : "Porra guardada";
    case "mvp": {
      const c = p.cands.find((x) => x.on);
      return c ? `MVP: ${niceName(c.name)}` : "MVP votado";
    }
    case "door":
      return null;
  }
}

/** Which answered cards can be opened again from their chip («Cambiar»). */
export const canChange = (p: PendingItem): boolean => p.kind === "rsvp" || p.kind === "poll" || p.kind === "porra" || p.kind === "mvp";

/** «5 cosas · las contestas aquí mismo». */
export const todoMeta = (open: number): string => (open ? `${pl(open, "cosa", "cosas")} · las contestas aquí mismo` : "");

/** «Lo próximo: J3 contra Red Demons, el domingo 8 de noviembre a las 18:00.» */
export function calmLine(next: Pick<JornadaRow, "j" | "rival" | "dateMs"> | null): string {
  if (!next) return "Te avisamos cuando haya algo que contestar.";
  const when = Number.isFinite(next.dateMs) ? `, el ${longDay(next.dateMs)} a las ${TIME().format(next.dateMs)}` : "";
  return `Lo próximo: ${next.j ? `J${next.j} ` : ""}contra ${next.rival}${when}.`;
}

// ───────────────────────── under the bar

export interface NextView {
  in: string;
  rival: string;
  line: string;
}
/** «El próximo partido · Faltan 8 días»: the rival and «J3 · en casa · domingo 8 de noviembre · 18:00 · CDM Palomeras». */
export function nextView(next: Pick<JornadaRow, "j" | "rival" | "dateMs" | "home"> | null, now: number, venue?: string | null): NextView | null {
  if (!next) return null;
  const ok = Number.isFinite(next.dateMs);
  const where = next.home === true ? "en casa" : next.home === false ? "fuera" : "campo por confirmar";
  const line = [next.j ? `J${next.j}` : "", where, ok ? longDay(next.dateMs) : "", ok ? TIME().format(next.dateMs) : "", venue?.trim() ?? ""].filter(Boolean).join(" · ");
  return { in: countdown(now, next.dateMs), rival: next.rival, line };
}

export interface FormChip {
  key: string;
  n: string;
  j: string;
  cls: string;
  aria: string;
}
/** His form: a chip per completed jornada (nota + band colour + the J; «—» when he didn't play), and its line. */
export function formView(form: readonly JornadaRow[], figures: SeasonFigures): { chips: FormChip[]; line: string } {
  const chips = form.map((r) => {
    const played = r.kind === "played";
    const word = played ? (r.nota !== null ? `${r.notaText}, ${r.bandWord.toLocaleLowerCase("es")}` : "jugaste, sin nota") : r.kind === "didnt" ? "no jugaste" : `no estuviste${r.reason ? ` (${r.reason.toLocaleLowerCase("es")})` : ""}`;
    return { key: r.matchId, n: played ? r.notaText : "—", j: r.jLabel, cls: `tc-nb tc-nb--s tc-nb--${played ? r.band : "no"}`, aria: `${r.jLabel}: ${word}` };
  });
  const notas = form.filter((r) => r.kind === "played" && r.nota !== null);
  const avg = figures.average;
  let line: string;
  if (!form.length) line = "Tu forma sale con tu primer partido: aquí van tus notas, jornada a jornada.";
  else if (!notas.length || avg === null) line = figures.played ? "Aún sin nota: tus partidos salen aquí en cuanto el acta tenga tus minutos." : `Aún no has jugado: ${pl(form.length, "jornada", "jornadas")} desde fuera.`;
  else if (figures.played < 2 || notas.length < 2) {
    const only = notas[notas.length - 1];
    const after = form.slice(form.indexOf(only) + 1).filter((r) => r.kind !== "played");
    line = `Con un partido aún no hay tendencia: tu ${only.jLabel} fue un ${only.notaText} (${only.bandWord.toLocaleLowerCase("es")}).${after.length === 1 ? ` La ${after[0].jLabel} la viste desde fuera.` : after.length > 1 ? ` Después, ${pl(after.length, "jornada", "jornadas")} desde fuera.` : ""}`;
  } else {
    const last3 = notas.slice(-3).map((r) => r.nota as number);
    const rec = last3.reduce((s, v) => s + v, 0) / last3.length;
    const trend = rec > avg + 0.2 ? "Subiendo" : rec < avg - 0.2 ? "Bajando" : "Estable";
    line = `${trend}: tus ${last3.length === 1 ? "última" : `${last3.length} últimas`}, ${dec(rec)} de media; la temporada, ${dec(avg)}.`;
  }
  return { chips, line };
}

export interface MilestoneView {
  t: string;
  pct: number;
  /** «Te falta 1 gol · Premio: estela dorada en el nombre». */
  line: string;
  aria: string;
}
/** «Lo próximo para tu carta»: the closest piece to earn (the first goal first, as the prototype). */
export function milestoneView(r: Rewards): MilestoneView | null {
  const nm = r.next.find((x) => x.id === "evo-goal") ?? r.next[0];
  if (!nm) return null;
  const pr = nm.progress ?? { cur: 0, goal: 1, pct: 0 };
  const reward = nm.reward ? `Premio: ${lowerFirst(nm.reward)}` : "";
  return { t: nm.t, pct: Math.max(0, Math.min(100, pr.pct)), line: [nm.need, reward].filter(Boolean).join(" · "), aria: `${nm.t}: ${pr.cur} de ${pr.goal}` };
}

/** The socio's three: la porra, el MVP, tus avisos. */
export function socioTrio(porra: PorraLine | null): { porraBig: string; porraLine: string } {
  if (!porra || !porra.predictions) return { porraBig: "Sin pronósticos", porraLine: "Se abre antes del pitido de cada jornada." };
  return { porraBig: `${porra.rank}.º de ${porra.of}`, porraLine: `${pl(porra.predictions, "pronóstico", "pronósticos")} · ${pl(porra.exact, "exacto", "exactos")} esta temporada.` };
}

// ───────────────────────── «De qué está hecho»

const ATTR_WORDS: Record<AttrKey, [string, string, string]> = {
  GOL: ["Goles", "Tus goles de la temporada, partido a partido.", "Cada gol sube la nota de ese partido, y tu valoración sale de tus notas. No suma por separado."],
  ASI: ["Asistencias", "Los pases de gol que diste, partido a partido.", "Igual que los goles: entran en la nota del partido en el que los das."],
  MIN: ["Minutos", "El tiempo que has estado en el campo.", "No dan puntos: dan peso. Con más minutos tu nota cuenta más y tu valoración deja de ser provisional."],
  PJ: ["Partidos jugados", "Las jornadas en las que pisaste el campo.", "Con pocos partidos tu valoración es provisional: cada partido nuevo la asienta."],
  MVP: ["MVP", "Las jornadas en las que el vestuario te votó el mejor.", "No suma puntos: pone una estrella en tu carta."],
  FOR: ["Forma reciente", "Tus últimas notas, en la escala de la carta.", "Es lo que más rápido se mueve: si tus próximas notas superan tu media, sube primero la forma y luego tu valoración."],
};
/** The rewards each number feeds (ids or id prefixes of me.rewards), closest first. */
const FEEDS: Record<AttrKey, string[]> = {
  GOL: ["evo-goal", "evo-double", "evo-goleador", "evo-hat", "logro-goles", "logro-racha"],
  FOR: ["evo-goal", "evo-double", "evo-goleador", "evo-hat", "logro-goles"],
  ASI: ["logro-assist", "logro-asistencias"],
  MIN: ["logro-minutos"],
  PJ: ["evo-debut", "evo-fijo", "logro-partidos"],
  MVP: ["evo-mvp", "logro-mvp"],
};
const feeds = (k: AttrKey, r: Reward) => FEEDS[k].some((f) => r.id === f || r.id.startsWith(`${f}-`));

export interface AttrRow {
  key: string;
  j: string;
  v: string;
  pct: number;
  aria: string;
}
export interface AttrSheetView {
  k: string;
  title: string;
  v: string;
  what: string;
  rows: AttrRow[];
  /** Nothing built it yet. */
  empty: string;
  move: string;
  next: string;
  rule: string;
}

/** The sheet for one number of the card: the matches that built it (from his rows), how it moves his rating,
 *  the next milestone it feeds. `text`: the card's value («—» without numbers). */
export function attrSheetView(k: AttrKey, rows: readonly JornadaRow[], text: string, rewards: Rewards): AttrSheetView {
  const [name, what, move] = ATTR_WORDS[k];
  const played = rows.filter((r) => r.kind === "played");
  const games = k === "FOR" ? played.filter((r) => r.nota !== null).slice(-5) : played;
  const val = (r: JornadaRow): number => (k === "GOL" ? r.g : k === "ASI" ? r.a : k === "MIN" ? (r.min ?? 0) : k === "PJ" ? 1 : k === "MVP" ? (r.mvp ? 1 : 0) : (r.nota ?? 0));
  const fmt = (r: JornadaRow): string => (k === "MIN" ? (r.min === null ? "—" : `${r.min}′`) : k === "FOR" ? r.notaText : k === "MVP" ? (r.mvp ? "MVP" : "—") : k === "PJ" ? (r.start === false ? "Suplente" : r.start ? "Titular" : "Jugó") : String(val(r)));
  const max = Math.max(1, ...games.map(val));
  const list = games.map((r) => ({ key: r.matchId, j: `${r.jLabel} · ${r.rival}`, v: fmt(r), pct: k === "PJ" ? 100 : Math.round((val(r) / max) * 100), aria: `${r.jLabel} contra ${r.rival}: ${fmt(r)}` }));
  const nextR = rewards.next.find((r) => feeds(k, r));
  const lastR = [...rewards.earned].reverse().find((r) => feeds(k, r));
  const next = nextR
    ? `${nextR.need ? `${nextR.need} para` : "Lo próximo:"} «${nextR.t}»${nextR.reward ? `: ${lowerFirst(nextR.reward)}` : ""}.`
    : lastR
      ? `Ya tienes «${lastR.t}»${lastR.reward ? `: ${lowerFirst(lastR.reward)}` : ""}.`
      : "";
  const shown = text && text !== "—";
  return {
    k: `De qué está hecho · ${k}`,
    title: shown ? `${name}: ${text}` : name,
    v: shown ? text : "—",
    what,
    rows: list,
    empty: played.length ? (k === "FOR" ? "Aún ningún partido con nota." : "") : "Aún nada: sale con tu primer partido.",
    move,
    next,
    rule: "Los premios marcan tu carta, nunca tu valoración.",
  };
}
