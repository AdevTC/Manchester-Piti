// La pizarra «Noche de partido» — the long-press radial fan on a pitch cromo: the galones, «Jugar de»
// (a sub-fan of zones), Banquillo and Ficha, laid out on a circle; and what each one does to the lineup.
// Pure.
import type { Lineup, RoleKey, Zone } from "../formations";
import { ZONES } from "../formations";
import { natOf, GALONES, type Squad } from "./model";
import { setPlaysAs, toBench, toggleRole } from "./ops";

export type FanKind = "role" | "zone" | "jugar" | "banquillo" | "ficha" | "volver";
export interface FanItem {
  key: string;
  kind: FanKind;
  role?: RoleKey;
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

export function fanItems(L: Lineup, sq: Squad, id: string, sub: boolean): FanItem[] {
  const name = sq.byId.get(id)?.name ?? "";
  type Raw = Omit<FanItem, "dx" | "dy" | "d">;
  const raw: Raw[] = sub
    ? [
        ...ZONES.map<Raw>((z) => ({ key: "z" + z, kind: "zone", zone: z, glyph: z.charAt(0), label: z, aria: name + " juega de " + z, on: natOf(L, sq, id) === z })),
        { key: "back", kind: "volver", glyph: "", label: "Volver", aria: "Volver al menú", on: false },
      ]
    : [
        ...GALONES.map<Raw>((g) => {
          const on = L.roles[g.key] === id;
          return { key: "r" + g.key, kind: "role", role: g.key, glyph: g.letter, label: g.label, aria: g.label + (on ? ": quitar a " : ": dar a ") + name, on };
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
  | { kind: "sub"; sub: boolean }
  | { kind: "ficha" };

export function applyFan(item: FanItem, L: Lineup, sq: Squad, id: string): FanOutcome {
  const name = sq.byId.get(id)?.name ?? "";
  switch (item.kind) {
    case "role": {
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
