// La pizarra · Bloque 4 — estilos predefinidos: five ready plans («Presión alta», «Bloque bajo + contra»,
// «Posesión», «Directo», «Equilibrado»), each one the seven consignas, its pro and its con in a line, and a
// preview of what it changes before it is applied (the consignas that change and how the shape moves). Pure.
import type { Lineup } from "../formations";
import type { StyleId } from "../../../lib/tacticaSchemas";
import { defaultTactics, TACTICS, type TacticKey, type Tactics } from "../tactics";
import { slotPos } from "./geometry";
import { PITCH_M } from "./phases";

export interface TacStyle {
  id: StyleId;
  name: string;
  tactics: Tactics;
  pro: string;
  con: string;
}

const T = (defLine: string, press: string, width: string, tempo: string, mentality: string, buildup: string, attackFocus: string): Tactics => ({ defLine, press, width, tempo, mentality, buildup, attackFocus });

export const STYLES: TacStyle[] = [
  { id: "presion", name: "Presión alta", tactics: T("Alta", "Alta", "Media", "Rápido", "Ofensiva", "Corta", "Centro"), pro: "Robamos cerca de su portería: goles fáciles.", con: "Espacio a la espalda si nos saltan la primera línea." },
  { id: "bloque", name: "Bloque bajo + contra", tactics: T("Baja", "Repliegue", "Estrecha", "Rápido", "Defensiva", "En largo", "Bandas"), pro: "Juntos atrás: les cuesta encontrar hueco.", con: "Mucho rato sin balón: cansa y empuja al área." },
  { id: "posesion", name: "Posesión", tactics: T("Media", "Media", "Amplia", "Pausado", "Equilibrada", "Corta", "Equilibrado"), pro: "Mandamos con el balón y descansamos con él.", con: "Una pérdida en la salida duele mucho." },
  { id: "directo", name: "Directo", tactics: T("Media", "Media", "Media", "Rápido", "Ofensiva", "En largo", "Centro"), pro: "Llegamos rápido y sin riesgos atrás.", con: "Muchos balones divididos: hay que ganar la segunda." },
  { id: "equilibrado", name: "Equilibrado", tactics: defaultTactics(), pro: "Sin sorpresas: vale contra cualquiera.", con: "Tampoco sorprendemos a nadie." },
];

export const styleById = (id: StyleId | null | undefined): TacStyle | null => STYLES.find((s) => s.id === id) ?? null;

/** The board with a style's consignas (and its name, to say which one it plays). */
export function applyStyle(L: Lineup, id: StyleId): Lineup {
  const s = styleById(id);
  if (!s) return L;
  return { ...L, tactics: { ...s.tactics }, style: id };
}

/** The style the board plays as it is (its consignas are exactly a style's), else null. */
export function styleNow(L: Lineup): TacStyle | null {
  const t = { ...defaultTactics(), ...L.tactics };
  const same = (s: TacStyle) => TACTICS.every((d) => s.tactics[d.key] === t[d.key]);
  const own = styleById(L.style);
  if (own && same(own)) return own;
  return STYLES.find(same) ?? null;
}

/** «Presión alta» / «Presión alta (retocado)» / null. */
export function styleLabel(L: Lineup): string | null {
  const now = styleNow(L);
  if (now) return now.name;
  const own = styleById(L.style);
  return own ? own.name + " (retocado)" : null;
}

export interface StyleDiff {
  /** The consignas that change: «Presión: media → alta». */
  rows: { key: TacticKey; label: string; from: string; to: string }[];
  /** How the shape moves, in words («El equipo se adelanta 5 m · más estrecho»); null = it doesn't. */
  shape: string | null;
}

/** What applying a style changes on this board. */
export function styleDiff(L: Lineup, id: StyleId): StyleDiff {
  const s = styleById(id);
  const t = { ...defaultTactics(), ...L.tactics };
  if (!s) return { rows: [], shape: null };
  const rows = TACTICS.filter((d) => t[d.key] !== s.tactics[d.key]).map((d) => ({ key: d.key, label: d.label, from: t[d.key].toLowerCase(), to: s.tactics[d.key].toLowerCase() }));
  if (L.freeMode) return { rows, shape: rows.length ? "En modo libre nadie se mueve: cambian las consignas." : null };
  const next = { ...L, tactics: { ...s.tactics }, phaseAt: undefined };
  const base = { ...L, phaseAt: undefined };
  let dv = 0;
  let spread0 = 0;
  let spread1 = 0;
  const n = L.slots.length - 1;
  for (let i = 1; i < L.slots.length; i++) {
    const a = slotPos(base, i);
    const b = slotPos(next, i);
    dv += b.v - a.v;
    spread0 += Math.abs(a.u - 50);
    spread1 += Math.abs(b.u - 50);
  }
  const m = n ? Math.round(((dv / n) / 100) * PITCH_M.len) : 0;
  const w = n ? Math.round((((spread1 - spread0) / n) / 100) * PITCH_M.wid * 2) : 0;
  const parts = [m < 0 ? "el equipo se adelanta " + -m + " m" : m > 0 ? "el equipo se echa atrás " + m + " m" : "", w > 0 ? "más abierto (" + w + " m)" : w < 0 ? "más cerrado (" + -w + " m)" : ""].filter(Boolean);
  return { rows, shape: parts.length ? parts.join(" · ").replace(/^./, (c) => c.toUpperCase()) : null };
}

/** The lineup the pitch shows while a style is previewed (its consignas, nothing stored). */
export const stylePreview = (L: Lineup, id: StyleId): Lineup => {
  const s = styleById(id);
  return s ? { ...L, tactics: { ...s.tactics } } : L;
};
