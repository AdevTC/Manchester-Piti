// What moved in the row between two looks: an answer arrived (the seat comes down, «clac»), the seven was
// published (gold sweeps the starters), a sub stood up and walked out while the one he replaced sat down, a
// red emptied a seat, the MVP was named. Each change gets its animation class per seat and one sentence for
// the polite live region.
import type { FrontRow, FrontRowMode, SeatState } from "../../../lib/derived/frontRow";
import { list } from "./view";

export type Anim = "pop" | "walk" | "sit" | "shine" | "flash";
export interface Snap {
  mode: FrontRowMode;
  seven: boolean;
  seats: Record<string, { state: SeatState; marks: string; name: string; mine: boolean }>;
}
export interface Change {
  anim: Record<string, Anim>;
  said: string;
  /** Someone else's answer arrived: the clac sounds (if the member turned it on). */
  clac: boolean;
}
export const NO_CHANGE: Change = { anim: {}, said: "", clac: false };

const marksOf = (s: FrontRow["seats"][number]) => s.markers.map((m) => `${m.kind}${m.minute ?? ""}`).join(",");

export function snapOf(row: FrontRow): Snap {
  const seats: Snap["seats"] = {};
  for (const s of row.seats) seats[s.playerId] = { state: s.state, marks: marksOf(s), name: s.name, mine: s.mine };
  return { mode: row.mode, seven: row.sevenPublished, seats };
}
/** Cheap identity of what the row shows (changes when any seat's state or markers do). */
export const snapKey = (row: FrontRow): string => `${row.mode}|${row.sevenPublished ? 1 : 0}|${row.seats.map((s) => `${s.playerId}:${s.state}:${marksOf(s)}`).join(";")}`;

const ANSWERED: Partial<Record<SeatState, string>> = { voy: "viene", duda: "está en duda", novoy: "no va" };
const MINE: Partial<Record<SeatState, string>> = { voy: "Has levantado tu cartulina: vas.", duda: "Cartulina a medias: estás en duda.", novoy: "Asiento vacío: no vas." };
const BENCH = new Set<SeatState>(["banquillo", "lesionado"]);

export function changesOf(prev: Snap, row: FrontRow): Change {
  if (prev.mode !== row.mode) return NO_CHANGE;
  const anim: Record<string, Anim> = {};
  const said: string[] = [];
  let clac = false;
  if (row.mode === "convocatoria") {
    for (const s of row.seats) {
      const was = prev.seats[s.playerId];
      if (!was || was.state === s.state) continue;
      const w = ANSWERED[s.state];
      if (!w) continue;
      anim[s.playerId] = s.state === "novoy" ? "flash" : "pop";
      if (s.mine) said.push(MINE[s.state] ?? "");
      else {
        said.push(`${s.name} ${w}.`);
        clac = true;
      }
    }
    if (!prev.seven && row.sevenPublished) {
      for (const s of row.seats) if (s.starter && !anim[s.playerId]) anim[s.playerId] = "shine";
      said.push("El siete ya está publicado.");
    }
  } else if (row.mode === "banquillo") {
    const ins: string[] = [];
    const outs: string[] = [];
    for (const s of row.seats) {
      const was = prev.seats[s.playerId];
      if (!was) continue;
      if (BENCH.has(was.state) && s.state === "campo") {
        anim[s.playerId] = "walk";
        ins.push(s.name);
      } else if (was.state === "campo" && BENCH.has(s.state)) {
        anim[s.playerId] = "sit";
        outs.push(s.name);
      } else if (s.state === "expulsado" && was.state !== "expulsado") {
        anim[s.playerId] = "flash";
        said.push(`Roja a ${s.name}: su asiento se queda vacío.`);
      } else if (was.marks !== marksOf(s)) {
        anim[s.playerId] = "flash";
        if (s.state === "lesionado" && was.state !== "lesionado") said.push(`${s.name}, tocado.`);
      }
    }
    if (ins.length) said.unshift(outs.length ? `Entra ${list(ins)} por ${list(outs)}.` : `Entra ${list(ins)}.`);
  } else if (row.mode === "jugaron") {
    for (const s of row.seats) {
      const was = prev.seats[s.playerId];
      if (!was) continue;
      if (s.markers.some((m) => m.kind === "mvp") && !was.marks.includes("mvp")) {
        anim[s.playerId] = "flash";
        said.push(`${s.name}, mejor del partido.`);
      }
    }
  }
  if (!Object.keys(anim).length && !said.length) return NO_CHANGE;
  return { anim, said: said.filter(Boolean).join(" "), clac };
}
