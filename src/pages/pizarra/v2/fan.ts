// La pizarra «Noche de partido» — the long-press radial fan on a pitch cromo: the galones, «Jugar de»
// (a sub-fan of zones), Banquillo and Ficha, laid out on a circle; and what each one does to the lineup.
// Pure.
import type { Lineup, RoleKey, TakerKind, Zone } from "../formations";
import { ZONES } from "../formations";
import { natOf, GALONES, type Squad } from "./model";
import { setPlaysAs, toBench, toggleRole } from "./ops";
import { ORDINAL, ROLE_TAKER, setTaker, TAKER_LABEL, TAKER_ROLE, takersOf } from "./takers";

export type FanKind = "role" | "zone" | "jugar" | "banquillo" | "ficha" | "volver";
export interface FanItem {
  key: string;
  kind: FanKind;
  role?: RoleKey;
  /** A dead-ball list's place (0 = 1º), in the galón's own sub-fan. */
  pos?: number;
  zone?: Zone;
  /** The letter on the disc (galones and zones); the icon kinds draw their own. */
  glyph: string;
  label: string;
  aria: string;
  on: boolean;
  dx: number;
  dy: number;
  /** Entrance delay (s). */
  d: number;
}

export const FAN_RADIUS = 98;

/** `sub`: false = the main fan, true = «Jugar de» (the zones), a list = its 1º · 2º · 3º. */
export type FanSub = boolean | TakerKind;

export function fanItems(L: Lineup, sq: Squad, id: string, sub: FanSub): FanItem[] {
  const name = sq.byId.get(id)?.name ?? "";
  type Raw = Omit<FanItem, "dx" | "dy" | "d">;
  const list = typeof sub === "string" ? takersOf(L)[sub] : [];
  const raw: Raw[] = typeof sub === "string"
    ? [
        ...ORDINAL.map<Raw>((o, pos) => {
          const on = list[pos] === id;
          const who = list[pos] && list[pos] !== id ? " (ahora " + (sq.byId.get(list[pos])?.name ?? "otro") + ")" : "";
          return { key: "o" + pos, kind: "role", role: TAKER_ROLE[sub], pos, glyph: o, label: o + " " + TAKER_LABEL[sub].toLowerCase(), aria: TAKER_LABEL[sub] + ": " + (on ? "quitar a " + name + " del " + o : name + " " + o + " lanzador" + who), on };
        }),
        { key: "back", kind: "volver", glyph: "", label: "Volver", aria: "Volver al menú", on: false },
      ]
    : sub
    ? [
        ...ZONES.map<Raw>((z) => ({ key: "z" + z, kind: "zone", zone: z, glyph: z.charAt(0), label: z, aria: name + " juega de " + z, on: natOf(L, sq, id) === z })),
        { key: "back", kind: "volver", glyph: "", label: "Volver", aria: "Volver al menú", on: false },
      ]
    : [
        ...GALONES.map<Raw>((g) => {
          const kind = ROLE_TAKER[g.key];
          const pos = kind ? takersOf(L)[kind].indexOf(id) : -1;
          const on = kind ? pos >= 0 : L.roles[g.key] === id;
          // (the dead-ball galones open their order: 1º · 2º · 3º)
          const aria = kind ? g.label + ": elegir el orden de " + name + (pos >= 0 ? " (ahora " + ORDINAL[pos] + ")" : "") : g.label + (on ? ": quitar a " : ": dar a ") + name;
          return { key: "r" + g.key, kind: "role", role: g.key, glyph: g.letter, label: g.label, aria, on };
        }),
        { key: "jugar", kind: "jugar", glyph: "", label: "Jugar de", aria: "Jugar como: elegir posición", on: false },
        { key: "bench", kind: "banquillo", glyph: "", label: "Banquillo", aria: "Mandar al banquillo", on: false },
        { key: "ficha", kind: "ficha", glyph: "", label: "Ficha", aria: "Ver la ficha de " + name, on: false },
      ];
  return raw.map((it, k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / raw.length;
    return { ...it, dx: Math.round(Math.cos(a) * FAN_RADIUS), dy: Math.round(Math.sin(a) * FAN_RADIUS), d: +(k * 0.035).toFixed(3) };
  });
}

export type FanOutcome =
  | { kind: "lineup"; lineup: Lineup; toast?: string; pick?: number }
  | { kind: "sub"; sub: FanSub }
  | { kind: "ficha" };

export function applyFan(item: FanItem, L: Lineup, sq: Squad, id: string): FanOutcome {
  const name = sq.byId.get(id)?.name ?? "";
  switch (item.kind) {
    case "role": {
      const kind = ROLE_TAKER[item.role as RoleKey];
      if (kind && item.pos == null) return { kind: "sub", sub: kind };
      if (kind && item.pos != null) {
        const next = setTaker(L, kind, id, item.pos);
        const at = takersOf(next)[kind].indexOf(id);
        return { kind: "lineup", lineup: next, toast: TAKER_LABEL[kind] + ": " + (at >= 0 ? name + " " + ORDINAL[at] : name + " ya no los tira") };
      }
      const next = toggleRole(L, item.role as RoleKey, id);
      const g = GALONES.find((x) => x.key === item.role);
      return { kind: "lineup", lineup: next, toast: (g?.label ?? "") + ": " + (next.roles[item.role as RoleKey] ? name : "sin asignar") };
    }
    case "zone":
      return { kind: "lineup", lineup: setPlaysAs(L, sq, id, item.zone as Zone), toast: name + " juega de " + item.zone + " en este siete" };
    case "jugar":
      return { kind: "sub", sub: true };
    case "volver":
      return { kind: "sub", sub: false };
    case "banquillo":
      return { kind: "lineup", lineup: toBench(L, id), pick: L.slots.findIndex((s) => s.playerId === id) };
    case "ficha":
      return { kind: "ficha" };
  }
}

/** Keep the fan's centre inside the app screen (px, relative to it). */
export function fanCentre(cardX: number, cardY: number, appW: number, appH: number): { cx: number; cy: number } {
  return {
    cx: Math.round(Math.max(118, Math.min(Math.max(118, appW - 118), cardX))),
    cy: Math.round(Math.max(150, Math.min(Math.max(150, appH - 230), cardY))),
  };
}
