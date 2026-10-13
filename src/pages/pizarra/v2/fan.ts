// La pizarra «Noche de partido» — the long-press radial fan on a pitch cromo: the galones, «Jugar de»
// (a sub-fan of the codes of his line in this system, and «Otra posición…» with all 13 grouped by
// line), Banquillo and Ficha, laid out on a circle; and what each one does to the lineup. Pure.
import type { Lineup, RoleKey, TakerKind } from "../formations";
import { normPlaysAs } from "../positions";
import { isPosCode, LINE_NAMES, lineOf, POS_CODES, POSITIONS, type PosCode } from "../../../lib/positions";
import { slotCode } from "./encaje";
import { GALONES, natOf, type Squad } from "./model";
import { setPlaysAs, toBench, toggleRole } from "./ops";
import { ORDINAL, ROLE_TAKER, setTaker, TAKER_LABEL, TAKER_ROLE, takersOf } from "./takers";

export type FanKind = "role" | "code" | "otra" | "jugar" | "banquillo" | "ficha" | "volver" | "mover";
export interface FanItem {
  key: string;
  kind: FanKind;
  role?: RoleKey;
  /** A dead-ball list's place (0 = 1º), in the galón's own sub-fan. */
  pos?: number;
  /** «Jugar de»: the position this item sets. */
  code?: PosCode;
  /** «Otra posición…»: the line it is listed under («Defensas»). */
  group?: string;
  /** «Volver»: where it goes back to (absent = the main fan). */
  back?: FanSub;
  /** «Otra posición…»: the chip the focus starts on. */
  first?: boolean;
  /** The letters on the disc (galones and codes); the icon kinds draw their own. */
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

/** `sub`: false = the main fan, true = «Jugar de» (his line's codes), "otra" = every position, a list =
 *  its 1º · 2º · 3º. */
export type FanSub = boolean | TakerKind | "otra";
const isTaker = (s: FanSub): s is TakerKind => typeof s === "string" && s !== "otra";

/** The codes «Jugar de» offers first: his slot's, then the rest of its line in this system, once each
 *  (none when he is not on the pitch). */
export function lineCodes(L: Lineup, id: string): PosCode[] {
  const i = L.slots.findIndex((s) => s.playerId === id);
  if (i < 0) return [];
  const own = slotCode(L, i);
  const line = L.slots.map((_, j) => slotCode(L, j)).filter((c) => lineOf(c) === lineOf(own));
  return [...new Set([own, ...line])];
}

/** The code he plays on this board: his «Jugar de» code, else (none set) his preferida; null for a
 *  legacy «Jugar de» line or without an exact position. */
function playsAtCode(L: Lineup, sq: Squad, id: string): PosCode | null {
  const over = normPlaysAs(L.playerPositions[id]);
  if (over) return isPosCode(over) ? over : null;
  return sq.byId.get(id)?.ps?.main ?? null;
}

export function fanItems(L: Lineup, sq: Squad, id: string, sub: FanSub): FanItem[] {
  const name = sq.byId.get(id)?.name ?? "";
  type Raw = Omit<FanItem, "dx" | "dy" | "d">;
  const at = sub === true || sub === "otra" ? playsAtCode(L, sq, id) : null;
  // a code: on the disc in the ring (named under it), «MCD · Pivote» in the full list
  const codeItem = (c: PosCode, full: boolean): Raw => ({
    key: "c" + c,
    kind: "code",
    code: c,
    glyph: c,
    label: full ? c + " · " + POSITIONS[c].name : POSITIONS[c].name,
    aria: name + " juega de " + POSITIONS[c].name.toLowerCase() + " (" + c + ")",
    on: at === c,
    ...(full ? { group: LINE_NAMES[POSITIONS[c].line].plural } : {}),
  });
  // «Otra posición…» opens on the code he plays, else on the first of his line (else of his slot's)
  const allCodes = (): Raw[] => {
    const items = POS_CODES.map((c) => codeItem(c, true));
    const line = natOf(L, sq, id) ?? lineCodes(L, id).map(lineOf)[0];
    const on = items.findIndex((it) => it.on);
    const k = on >= 0 ? on : Math.max(0, items.findIndex((it) => !!it.code && lineOf(it.code) === line));
    return items.map((it, j) => (j === k ? { ...it, first: true } : it));
  };
  const list = isTaker(sub) ? takersOf(L)[sub] : [];
  const raw: Raw[] = sub === "otra"
    ? [...allCodes(), { key: "back", kind: "volver", back: true, glyph: "", label: "Volver", aria: "Volver a las posiciones de su línea", on: false }]
    : isTaker(sub)
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
        ...lineCodes(L, id).map((c) => codeItem(c, false)),
        { key: "otra", kind: "otra", glyph: "", label: "Otra posición…", aria: "Otra posición: todas, por líneas", on: false },
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
        { key: "mover", kind: "mover", glyph: "", label: "Mover a", aria: "Mover a " + name + " a otro puesto: elegir de una lista", on: false },
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
  | { kind: "ficha" }
  | { kind: "mover" };

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
    case "code": {
      const c = item.code as PosCode;
      return { kind: "lineup", lineup: setPlaysAs(L, sq, id, c), toast: name + " juega de " + POSITIONS[c].name.toLowerCase() + " (" + c + ") en este siete" };
    }
    case "jugar":
      return { kind: "sub", sub: true };
    case "otra":
      return { kind: "sub", sub: "otra" };
    case "volver":
      return { kind: "sub", sub: item.back ?? false };
    case "banquillo":
      return { kind: "lineup", lineup: toBench(L, id), pick: L.slots.findIndex((s) => s.playerId === id) };
    case "ficha":
      return { kind: "ficha" };
    case "mover":
      return { kind: "mover" };
  }
}

/** Keep the fan's centre inside the app screen (px, relative to it). */
export function fanCentre(cardX: number, cardY: number, appW: number, appH: number): { cx: number; cy: number } {
  return {
    cx: Math.round(Math.max(118, Math.min(Math.max(118, appW - 118), cardX))),
    cy: Math.round(Math.max(150, Math.min(Math.max(150, appH - 230), cardY))),
  };
}
