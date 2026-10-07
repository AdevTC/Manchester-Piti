// Fixtures for the pizarra tests: a squad of cromos and lineups, without Firebase.
import type { FormationName, Lineup, Zone } from "../formations";
import { seedLineup } from "../lineupOps";
import { pairKey, type Cromo, type PairStats, type Squad } from "./model";

export function cromo(id: string, num: number, pos: Zone | undefined, extra: Partial<Cromo> = {}): Cromo {
  return {
    id,
    num,
    name: id.toUpperCase(),
    pos,
    rt: 70,
    stats: { played: 0, goals: 0, assists: 0, minutes: 0, starts: 0, mvps: 0 },
    recentMin: 0,
    recentGA: 0,
    ...extra,
  };
}

export function squadOf(list: Cromo[], pairs: [string, string, Partial<PairStats>][] = [], recentLabel = "J5–J7"): Squad {
  return {
    list,
    byId: new Map(list.map((c) => [c.id, c])),
    pairs: new Map(pairs.map(([a, b, p]) => [pairKey(a, b), { tog: 0, ast: 0, ...p }])),
    recentLabel,
  };
}

/** A lineup of `formation` with `ids` in slot order (null = empty), the rest of the squad on the bench. */
export function lineupOf(ids: (string | null)[], formation: FormationName = "2-3-1", squad?: Squad): Lineup {
  const L = seedLineup(formation, []);
  const slots = L.slots.map((s, i) => ({ ...s, playerId: ids[i] ?? null }));
  const on = new Set(ids.filter(Boolean));
  return { ...L, slots, bench: squad ? squad.list.map((c) => c.id).filter((id) => !on.has(id)) : [] };
}

/** The design's example squad: two keepers, defenders, midfielders, forwards. */
export function demoSquad(): Squad {
  return squadOf([
    cromo("evans", 1, "POR", { rt: 87 }),
    cromo("fer", 12, "POR", { rt: 55 }),
    cromo("illescas", 4, "DEF", { rt: 83 }),
    cromo("tello", 20, "DEF", { rt: 79 }),
    cromo("brawan", 33, "DEF", { rt: 62, baja: "Lesionado" }),
    cromo("huberoski", 14, "MED", { rt: 95 }),
    cromo("eguzquiza", 8, "MED", { rt: 81 }),
    cromo("almachi", 21, "MED", { rt: 74 }),
    cromo("andia", 19, "MED", { rt: 60, baja: "Sancionado" }),
    cromo("adrian", 10, "DEL", { rt: 96 }),
    cromo("erik", 9, "DEL", { rt: 96 }),
    cromo("kevin", 11, "DEL", { rt: 75 }),
  ]);
}
