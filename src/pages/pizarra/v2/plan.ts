// La pizarra «Noche de partido» — the plan (Siete → Plan): the seven consignas as the sheet shows them
// (a card each: what it tells the team, and a stepper through its three values) and what the plan paints on the
// pitch besides the línea and the presión: the salida de balón (from the keeper to whom he plays) and
// the foco de ataque (the lanes the attack goes through). Pure.
import type { Lineup } from "../formations";
import { defaultTactics, TACTICS, type TacticKey } from "../tactics";
import { CAMS, f1, proj, slotPos, slotZone, type CamName } from "./geometry";

/** «esc» = an ordered scale (a slider with three stops), «seg» = a choice (segmented buttons). */
export type TacKind = "esc" | "seg";

export interface TacRow {
  key: TacticKey;
  label: string;
  options: string[];
  kind: TacKind;
  value: string;
  /** Index of the value on its scale. */
  vi: number;
  /** The consigna the value gives the team: its title and one line («Presión alta», «Mordemos arriba…»). */
  ct: string;
  cd: string;
}

/** What each value of each instruction tells the team (the Plan's cards, the charla's plan). */
export const CONSIGNA: Record<TacticKey, Record<string, [string, string]>> = {
  press: { Alta: ["Presión alta", "Mordemos arriba: que no salgan jugando."], Media: ["Presión media", "Esperamos en el medio y saltamos juntos."], Repliegue: ["Repliegue", "Juntos atrás y a la contra."] },
  defLine: { Alta: ["Línea alta", "Los centrales cerca del medio: campo corto."], Media: ["Línea media", "Ni encima del portero ni a la espalda."], Baja: ["Línea baja", "Cerca del área, sin espacio a la espalda."] },
  width: { Amplia: ["Campo grande", "Las bandas pegadas a la cal."], Media: ["Amplitud media", "Abrimos sin perder el centro."], Estrecha: ["Juntos por dentro", "Cerramos el centro y salimos por dentro."] },
  buildup: { Corta: ["Salida corta", "El portero a los centrales, siempre al pie."], Mixta: ["Salida mixta", "Corta si se puede, larga si aprietan."], "En largo": ["En largo", "Al 9 y a por la segunda jugada."] },
  mentality: { Defensiva: ["Primero, no encajar", "Bloque junto y a la contra."], Equilibrada: ["Equilibrados", "Siempre dos por detrás del balón."], Ofensiva: ["A por el partido", "Todos arriba: el portero hace de líbero."] },
  tempo: { Pausado: ["Balón quieto", "Tocamos y esperamos el hueco."], Medio: ["Ritmo medio", "Dos toques y cambio de orientación."], "Rápido": ["A un toque", "Robo y vertical, sin pensarlo."] },
  attackFocus: { Bandas: ["Por fuera", "Abrimos a banda y centro atrás."], Centro: ["Por dentro", "Paredes en la frontal."], Equilibrado: ["Por todo el frente", "Donde haya espacio, sin prisa."] },
};

// As designed: the five scales first, then the salida and the foco.
const ORDER: TacticKey[] = ["defLine", "press", "width", "mentality", "tempo", "buildup", "attackFocus"];
const KIND: Record<TacticKey, TacKind> = { defLine: "esc", press: "esc", width: "esc", mentality: "esc", tempo: "esc", buildup: "seg", attackFocus: "seg" };

/** The plan's rows for the sheet, with the board's values (an unknown stored value reads as the default). */
export function tacRows(L: Lineup): TacRow[] {
  const t = { ...defaultTactics(), ...L.tactics };
  return ORDER.map((key) => {
    const d = TACTICS.find((x) => x.key === key)!;
    const value = d.options.includes(t[key]) ? t[key] : d.def;
    const [ct, cd] = CONSIGNA[key][value] ?? [value, ""];
    return { key, label: d.label, options: d.options, kind: KIND[key], value, vi: d.options.indexOf(value), ct, cd };
  });
}

/** One consigna changed (only to a value of its scale; anything else leaves the board as it was). */
export function setTactic(L: Lineup, key: TacticKey, value: string): Lineup {
  const d = TACTICS.find((x) => x.key === key);
  if (!d || !d.options.includes(value) || L.tactics?.[key] === value) return L;
  return { ...L, tactics: { ...defaultTactics(), ...L.tactics, [key]: value } };
}

export interface PlanArrow {
  key: string;
  /** "" = gold, "thin" = dashed gold, "sky" / "sky thin" = the attack lanes. */
  c: string;
  d: string;
}

/** The salida and foco arrows in the 1000×1000 frame box (system mode only: free mode has no plan). */
export function planArrows(L: Lineup, cam: CamName): PlanArrow[] {
  if (L.freeMode) return [];
  const C = CAMS[cam];
  const t = { ...defaultTactics(), ...L.tactics };
  const pt = (u: number, v: number): [number, number] => {
    const q = proj(C, u, v);
    return [q.x * 10, q.y * 10];
  };
  // A gentle curve from a to b, bent to the side by `bend` of its length.
  const arc = (a: [number, number], b: [number, number], bend: number): string => {
    const A = pt(a[0], a[1]);
    const B = pt(b[0], b[1]);
    const mx = (A[0] + B[0]) / 2 - (B[1] - A[1]) * bend;
    const my = (A[1] + B[1]) / 2 + (B[0] - A[0]) * bend;
    return "M" + f1(A[0]) + " " + f1(A[1]) + "Q" + f1(mx) + " " + f1(my) + " " + f1(B[0]) + " " + f1(B[1]);
  };
  const g = slotPos(L, 0);
  const gk: [number, number] = [g.u, g.v - 3];
  const defs: [number, number][] = [];
  const dels: [number, number][] = [];
  for (let i = 1; i < L.slots.length; i++) {
    const z = slotZone(L, i);
    const p = slotPos(L, i);
    if (z === "DEF") defs.push([p.u, p.v + 2]);
    if (z === "DEL") dels.push([p.u, p.v + 3]);
  }
  const out: PlanArrow[] = [];
  const mixed = t.buildup === "Mixta" ? "thin" : "";
  // Salida: corta = to every defender, en largo = to the striker, mixta = both (dashed).
  if (t.buildup !== "En largo") defs.forEach((d, k) => out.push({ key: "s" + k, c: mixed, d: arc(gk, d, 0.12) }));
  if (t.buildup !== "Corta" && dels[0]) out.push({ key: "l", c: mixed, d: arc(gk, dels[0], 0.18) });
  // Foco: the lanes the attack runs through.
  const lanes =
    t.attackFocus === "Bandas"
      ? [[12, 46, 12, 14], [88, 46, 88, 14]]
      : t.attackFocus === "Centro"
        ? [[50, 44, 50, 14]]
        : [[18, 46, 18, 18], [50, 44, 50, 16], [82, 46, 82, 18]];
  lanes.forEach((ln, k) => out.push({ key: "f" + k, c: "sky" + (lanes.length > 2 ? " thin" : ""), d: arc([ln[0], ln[1]], [ln[2], ln[3]], 0.02) }));
  return out;
}

/** How the plan reads in one line (screen readers, the «Más» tile). */
export function planAria(L: Lineup): string {
  return tacRows(L)
    .map((r) => r.label + ": " + r.value.toLowerCase())
    .join(", ");
}
