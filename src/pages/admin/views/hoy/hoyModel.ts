// Hoy, pure (tested in hoyModel.test.ts): the lines around the hero — the lead under «Hoy», the J8 plaque,
// the LED ticker, «Después» — and the peg wall of «Antes»: el siete on the front pegs (seven, «Libre» for
// the gaps) and, on the back rail, the banquillo and whoever can still come (not those who said no).
import { dateMillis } from "../../../../../functions/src/matchEngine";
import { clockTime, jLabel, longDay, shortDate, type AdminMatch } from "../../data/adminLogic";
import type { MatchMoment } from "../../data/moments";
import { RSVP_LABEL, SEVEN, type Lineup, type Rsvp } from "../../data/lineup";

const TZ = "Europe/Madrid";
const dayKey = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
const where = (m: Pick<AdminMatch, "home" | "rival">) => (m.home === false ? `en el campo de ${m.rival ?? "el rival"}` : "en casa");

/** The line under «Hoy»: what day it is and what is going on. */
export function hoyLead(now: number, hero: { match: AdminMatch; moment: MatchMoment } | null): string {
  const today = longDay(now);
  if (!hero) return `${today} · no hay partidos a la vista`;
  const { match, moment } = hero;
  if (moment === "juego") return `${today} · el Piti está jugando · apunta lo que pase`;
  if (moment === "final") return `${today} · pitado el final · falta el acta`;
  if (moment === "publicado") return `${today} · acta publicada · la web ya lo cuenta`;
  const t = dateMillis(match.date);
  const tomorrow = dayKey(now + 24 * 60 * 60_000) === dayKey(t);
  const when = dayKey(now) === dayKey(t) ? "hoy" : tomorrow ? "mañana" : `el ${shortDate(t)}`;
  return `${today} · ${when} juega el Piti ${where(match)}`;
}

const kitOf = (m: Pick<AdminMatch, "kit">) => (m.kit === "away" ? "2ª equipación" : m.kit === "home" ? "1ª equipación" : "");
const homeAway = (m: Pick<AdminMatch, "home">) => (m.home === false ? "fuera" : "en casa");

/** The plaque: «J8 · MAD SKY», «dom 8 nov · 12:00 · fuera · 2ª equipación» and the meeting note. */
export function plaque(m: AdminMatch, note: string): { title: string; line: string; short: string; note: string } {
  const t = dateMillis(m.date);
  const kit = kitOf(m);
  return {
    title: `${jLabel(m)} · ${m.rival ?? "Rival"}`,
    line: [shortDate(t), clockTime(t), homeAway(m), kit].filter(Boolean).join(" · "),
    short: [shortDate(t), clockTime(t), homeAway(m), kit.replace(" equipación", "")].filter(Boolean).join(" · "),
    note: note.trim(),
  };
}

/** The LED's ticker: «J8 · LIGA · MAD SKY · DOMINGO 8 NOV 12:00 · CAMPO DE MAD SKY · 2ª EQUIPACIÓN · … · ». */
export function tickerText(m: AdminMatch, note: string): string {
  const t = dateMillis(m.date);
  const rival = m.rival ?? "Rival";
  const day = Number.isFinite(t) ? `${longDay(t)} ${clockTime(t)}` : "";
  const place = m.venue?.trim() || (m.home === false ? `Campo de ${rival}` : "En casa");
  return `${[jLabel(m), m.competition || "Liga", rival, day, place, kitOf(m), note.trim()].filter(Boolean).join(" · ")} · `.toLocaleUpperCase("es");
}

/** «J9 · EL CUARTEL CF · dom 15 nov · 11:00 · en casa». */
export function afterLine(m: AdminMatch): string {
  const t = dateMillis(m.date);
  return [jLabel(m), m.rival ?? "Rival", shortDate(t), clockTime(t), homeAway(m)].join(" · ");
}

/** «2–1 en el campo de MAD SKY» / «3–1 en casa». */
export const finalLine = (m: AdminMatch, gf: number, ga: number) => `${gf}–${ga} ${where(m)}`;

export interface WallPlayer {
  id: string;
  name: string;
  number: number | null;
  position: string;
}
export interface FrontPeg {
  /** null = a free peg («Libre»). */
  id: string | null;
  num: string;
  name: string;
  sub: string;
  duda: boolean;
}
export interface BackPeg {
  id: string;
  num: string;
  name: string;
  sub: string;
  duda: boolean;
  /** On the banquillo (full colour) or just able to come (dimmed). */
  bench: boolean;
}
const doubt = (r: Rsvp) => r === "duda" || r === "sin";

/** The peg wall: seven front pegs (el siete, then «Libre») and the back rail (the banquillo and whoever can come, dorsal order). */
export function pegWall(l: Lineup, roster: readonly WallPlayer[], rsvp: ReadonlyMap<string, Rsvp>): { front: FrontPeg[]; back: BackPeg[] } {
  const by = new Map(roster.map((p) => [p.id, p]));
  const num = (id: string) => (by.get(id)?.number != null ? String(by.get(id)?.number) : "");
  const nm = (id: string) => by.get(id)?.name ?? "Jugador";
  const front: FrontPeg[] = [];
  for (let i = 0; i < SEVEN; i++) {
    const id = l.starters[i];
    if (!id) {
      front.push({ id: null, num: "", name: "", sub: "toca una de atrás", duda: false });
      continue;
    }
    const r = rsvp.get(id) ?? "sin";
    front.push({ id, num: num(id), name: nm(id), sub: r === "si" ? by.get(id)?.position || "Viene" : RSVP_LABEL[r], duda: doubt(r) });
  }
  const onBench = (id: string) => l.bench.includes(id);
  const candidates = roster.filter((p) => !l.starters.includes(p.id) && (onBench(p.id) || rsvp.get(p.id) !== "no"));
  const back = candidates.map((p): BackPeg => {
    const r = rsvp.get(p.id) ?? "sin";
    const b = onBench(p.id);
    return { id: p.id, num: num(p.id), name: p.name, sub: b ? (r === "si" ? "Banquillo" : `Banq. · ${RSVP_LABEL[r].toLowerCase()}`) : RSVP_LABEL[r], duda: doubt(r), bench: b };
  });
  return { front, back };
}

/** The phone rail's short names: «EGUZQ.», «ADRIÁ.» (six letters at most). */
export const shortName = (s: string) => (s.length > 6 ? `${s.slice(0, 5)}.` : s);
