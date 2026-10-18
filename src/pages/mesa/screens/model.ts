// Pure helpers the four screens share (Antes, Lo que va pasando, Descanso, Final): each play's filter and
// icon, which types a play can be corrected into, minutes from stints, clock text, scorer chips.
import { MESA_TYPES } from "../../../../functions/src/liveRules";
import type { EventType } from "../../../../functions/src/matchEngine";
import type { MesaEvent, MesaMatch, MesaPlayer, MesaPresence, MesaStint, MesaType } from "../types";

export type Category = "gol" | "falta" | "cambio" | "tarjeta" | "otra";
const CATEGORY: Partial<Record<EventType, Category>> = {
  goal: "gol", goal_penalty: "gol", goal_freekick: "gol", opponent_goal: "gol", opponent_own_goal: "gol", own_goal: "gol",
  foul: "falta", foul_received: "falta", opponent_foul: "falta", penalty_committed: "falta", penalty_received: "falta",
  substitution: "cambio",
  yellow_card: "tarjeta", double_yellow: "tarjeta", red_card: "tarjeta", opponent_yellow: "tarjeta", opponent_red: "tarjeta",
};
export const categoryOf = (t: EventType): Category => CATEGORY[t] ?? "otra";

export type IconId = "gol" | "falta" | "cambio" | "palo" | "parada" | "ocasion" | "corner" | "amarilla" | "roja" | "tocado" | "fuera" | "penalti";
const ICON: Partial<Record<EventType, IconId>> = {
  goal: "gol", goal_penalty: "gol", goal_freekick: "gol", opponent_goal: "gol", opponent_own_goal: "gol", own_goal: "gol",
  foul: "falta", foul_received: "falta", opponent_foul: "falta", penalty_committed: "penalti", penalty_received: "penalti",
  substitution: "cambio", woodwork: "palo", opponent_woodwork: "palo", save: "parada", penalty_saved: "parada",
  chance: "ocasion", opponent_chance: "ocasion", corner: "corner", opponent_corner: "corner",
  yellow_card: "amarilla", opponent_yellow: "amarilla", double_yellow: "roja", red_card: "roja", opponent_red: "roja",
  injury: "tocado", opponent_offside: "fuera", penalty_missed: "penalti", opponent_penalty_missed: "penalti",
};
export const iconOf = (t: EventType): IconId => ICON[t] ?? "ocasion";

const MESA = new Set<string>(MESA_TYPES);
export const isMesaType = (t: string): t is MesaType => MESA.has(t);

/** The bare name of a type, for Corregir's choices. */
export const TYPE_NAME: Record<MesaType, string> = {
  goal: "Gol", goal_penalty: "De penalti", goal_freekick: "De falta", opponent_own_goal: "Autogol suyo", own_goal: "En propia",
  opponent_goal: "Gol suyo", yellow_card: "Amarilla", double_yellow: "2.ª amarilla", red_card: "Roja", substitution: "Cambio",
  woodwork: "Al palo", chance: "Ocasión", corner: "Córner", save: "Parada", foul: "Hace falta", foul_received: "Le hacen falta",
  injury: "Tocado", penalty_saved: "Penalti parado", penalty_missed: "Penalti fallado", penalty_received: "Penalti a favor",
  penalty_committed: "Penalti en contra", opponent_chance: "Ocasión", opponent_corner: "Córner", opponent_foul: "Falta",
  opponent_woodwork: "Al palo", opponent_offside: "Fuera de juego", opponent_yellow: "Amarilla", opponent_red: "Roja",
  opponent_penalty_missed: "Penalti fallado",
};

/** Types a play can be corrected into without changing what it carries (a player, two players, none). */
const FAMILIES: readonly (readonly MesaType[])[] = [
  ["goal", "goal_penalty", "goal_freekick"],
  ["chance", "woodwork", "save", "foul", "foul_received", "injury", "corner", "penalty_missed", "penalty_saved", "penalty_received", "penalty_committed"],
  ["yellow_card", "double_yellow", "red_card"],
  ["opponent_goal", "opponent_chance", "opponent_corner", "opponent_foul", "opponent_woodwork", "opponent_offside", "opponent_penalty_missed"],
  ["opponent_yellow", "opponent_red"],
];
export const compatibleTypes = (t: MesaType): readonly MesaType[] => FAMILIES.find((f) => f.includes(t)) ?? [t];
/** Which player fields a type carries. */
export const takesPlayer = (t: EventType) => !t.startsWith("opponent_");
export const takesAssist = (t: EventType) => t === "goal" || t === "goal_penalty" || t === "goal_freekick";
export const takesIn = (t: EventType) => t === "substitution";

export const two = (n: number) => (n < 10 ? "0" : "") + n;
/** 1145 → «19:05»; past an hour «1:05:00». */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${two(m)}:${two(s % 60)}`;
}
/** «2:05» for a short wait (minutes without padding). */
export const fmtShort = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${two(s % 60)}`;
};
export const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
};
/** Football's minute (1-based while running; with the clock stopped, the minute reached). */
export const minuteOfPlay = (sec: number, running = true) => (running ? Math.floor(Math.max(0, sec) / 60) + 1 : Math.max(1, Math.ceil(Math.max(0, sec) / 60)));

/** Seconds a player spent on the pitch inside [from, to); open stints run to `to`. */
export function secondsIn(stints: readonly MesaStint[], from: number, to: number) {
  let s = 0;
  for (const st of stints) {
    const a = Math.max(from, st.from);
    const b = Math.min(to, st.to ?? to);
    if (b > a) s += b - a;
  }
  return s;
}
export const onPitchAt = (stints: readonly MesaStint[], sec: number) => stints.some((s) => s.from <= sec && (s.to === null || s.to > sec));

/** «Manchester Piti – Atlético Demo», home side first. */
export const fixtureTitle = (m: Pick<MesaMatch, "home" | "rival">) => (m.home ? `Manchester Piti – ${m.rival}` : `${m.rival} – Manchester Piti`);

/** «Jornada 7, liga» when the match has a round, else the competition («Liga»; "" when none). */
export const matchLine = (m: Pick<MesaMatch, "round" | "competition">) =>
  m.round ? [`Jornada ${m.round}`, m.competition.toLocaleLowerCase("es")].filter(Boolean).join(", ") : m.competition;
/** «Jornada 7, contra Atlético Demo», «Liga, contra …», «Contra …». */
export const againstLine = (m: Pick<MesaMatch, "round" | "competition" | "rival">) => {
  const head = m.round ? `Jornada ${m.round}` : m.competition;
  return head ? `${head}, contra ${m.rival}` : `Contra ${m.rival}`;
};

/** Scorer chip colours: me in sky, the next in gold, then the rest (stable by uid order). */
const AV = ["#a9d6f5", "#FFC659", "#b7e4c7", "#f4b6c2"];
export function avatars(presence: readonly MesaPresence[]) {
  const order = [...presence].sort((a, b) => (a.me ? -1 : b.me ? 1 : a.uid < b.uid ? -1 : 1));
  const map = new Map(order.map((p, i) => [p.uid, AV[i % AV.length]]));
  return (uid: string | null) => map.get(uid ?? "") ?? AV[2];
}
export const initial = (name: string | null | undefined) => (name?.trim()[0] ?? "?").toUpperCase();

/** «Pablo», «Pablo y David», «Pablo, David y Ana». */
export const listNames = (names: readonly string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`);

/** A play still waiting for «Es el mismo» / «Son dos». */
export const isPendingDup = (e: MesaEvent) => !!e.dupOf;

/** The keeper plus the six outfield players with the fewest minutes (nobody sent off). */
export function fairSeven(players: readonly MesaPlayer[], onPitch: readonly string[]): string[] {
  const able = players.filter((p) => !p.sentOff);
  const gk = able.find((p) => p.keeper && onPitch.includes(p.id)) ?? able.find((p) => p.keeper);
  const rest = able.filter((p) => p !== gk && !p.keeper).sort((a, b) => a.minutes - b.minutes).slice(0, 6);
  return [...(gk ? [gk.id] : []), ...rest.map((p) => p.id)];
}

/** The subs from the seven on the pitch to `seven`, keeper paired with keeper. */
export function subsTo(players: readonly MesaPlayer[], onPitch: readonly string[], seven: readonly string[], chosen: Readonly<Record<string, string>> = {}) {
  const gk = (id: string) => (players.find((p) => p.id === id)?.keeper ? 0 : 1);
  // the places to fill: who goes off (the keeper's first), then the slots a red left empty
  const outs = [...onPitch.filter((id) => !seven.includes(id)).sort((a, b) => gk(a) - gk(b)), ...players.filter((p) => p.vacancy).map((p) => p.id)];
  const ins = seven.filter((id) => !onPitch.includes(id)).sort((a, b) => gk(a) - gk(b));
  // «por quién» picked by hand first, then each one left takes the first place still free
  const taken = new Set<string>();
  const pick: Record<string, string> = {};
  for (const inId of ins) {
    const want = chosen[inId];
    if (want && outs.includes(want) && !taken.has(want)) {
      pick[inId] = want;
      taken.add(want);
    }
  }
  for (const inId of ins) {
    if (pick[inId]) continue;
    const free = outs.find((o) => !taken.has(o));
    if (!free) continue;
    pick[inId] = free;
    taken.add(free);
  }
  return ins.filter((inId) => pick[inId]).map((inId) => ({ outId: pick[inId], inId }));
}
/** The places a 2nd-half change can take: each one going off (his position) and each slot a red emptied. */
export function placesToFill(players: readonly MesaPlayer[], onPitch: readonly string[], seven: readonly string[]) {
  const gk = (id: string) => (players.find((p) => p.id === id)?.keeper ? 0 : 1);
  const leaving = onPitch.filter((id) => !seven.includes(id)).sort((a, b) => gk(a) - gk(b));
  return [
    ...leaving.flatMap((id) => {
      const p = players.find((x) => x.id === id);
      return p ? [{ outId: id, name: p.name, code: p.pos ?? (p.keeper ? "POR" : null), gone: false }] : [];
    }),
    ...players.filter((p) => p.vacancy).map((p) => ({ outId: p.id, name: p.name, code: p.vacancy?.code ?? null, gone: true })),
  ];
}
