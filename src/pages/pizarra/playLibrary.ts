// The built-in jugadas (estrategia): córner, falta, saque de banda and salida de balón from the
// approved design, then the córner en contra, the falta lateral, the saque de banda largo and the
// saque de portería en corto. Each one is written for seven «parts» (0 POR, 1–2 the centrales left and
// right, 3–5 the medios left, centre and right, 6 the punta: the design's 2-3-1) and turned into a Play
// for the seven on the board by zone and side: in any system each part goes to whoever stands closest
// to it (the same line first, then the nearest line, then left to right), so a 3-2-1 sends its third
// defender up for the remate instead of leaving the «MC» part to whoever sits in slot 4. The player
// with the galón for the dead ball (córners / faltas) takes it. Arrows are derived from each move.
// Pure data + functions; tested in plays.test.ts.
import type { Lineup, RoleKey, Zone } from "./formations";
import { deriveArrows, type Play, type PlayFrame, type PlayKind } from "./plays";

type XY = [number, number];
interface LibStep {
  title: string;
  note: string;
  /** Spot of part 0..6. */
  p: XY[];
  /** Rivals r1..r5. */
  r: XY[];
  b: XY;
}
interface LibPlay {
  /** Stable id (the design's four keep `lib-<kind>`). */
  id: string;
  kind: Exclude<PlayKind, "propia">;
  name: string;
  /** Its button in the library. */
  short: string;
  /** Who takes the dead ball: the holder of this galón goes to that part's spots. */
  taker?: { role: RoleKey; slot: number };
  steps: LibStep[];
}
const st = (title: string, note: string, p: XY[], r: XY[], b: XY): LibStep => ({ title, note, p, r, b });

export const PLAY_LIBRARY: readonly LibPlay[] = [
  {
    id: "lib-corner",
    kind: "corner",
    name: "Córner a favor",
    short: "Córner",
    taker: { role: "cornersId", slot: 3 },
    steps: [
      st("Colocación", "El especialista a la esquina. Dos rematan y uno espera el rechace.", [[50, 90], [36, 58], [62, 30], [95, 4], [42, 22], [72, 14], [28, 12]], [[50, 3], [46, 9], [58, 9], [38, 18], [66, 20]], [94, 4]),
      st("Bloqueo y desmarque", "El central bloquea en el primer palo; la punta da un paso atrás.", [[50, 90], [38, 52], [58, 16], [95, 4], [44, 25], [72, 7], [30, 18]], [[50, 3], [47, 10], [60, 12], [36, 21], [66, 9]], [94, 4]),
      st("Centro al segundo palo", "Centro tenso entre el portero y la defensa.", [[50, 90], [38, 50], [57, 14], [92, 7], [44, 24], [69, 6], [38, 8]], [[50, 3], [47, 11], [60, 11], [33, 15], [64, 6]], [40, 8]),
      st("Remate", "Cabezazo cruzado al palo largo. Dentro.", [[50, 90], [38, 50], [57, 14], [90, 8], [46, 25], [69, 6], [41, 7]], [[56, 2], [47, 11], [60, 11], [34, 15], [64, 6]], [46, 1.5]),
    ],
  },
  {
    id: "lib-falta",
    kind: "falta",
    name: "Falta frontal",
    short: "Falta",
    taker: { role: "freekicksId", slot: 3 },
    steps: [
      st("Barrera", "Dos sobre el balón; uno al final de la barrera, atento al rechace.", [[50, 90], [36, 62], [64, 62], [40, 34], [58, 44], [76, 16], [64, 30]], [[50, 3], [43, 20], [48, 20], [53, 20], [58, 20]], [52, 28]),
      st("Amago", "La punta pasa por encima del balón y arrastra a la barrera.", [[50, 90], [36, 62], [64, 62], [42, 33], [58, 42], [78, 13], [64, 21]], [[50, 3], [43, 20], [48, 20], [53, 20], [60, 17]], [52, 28]),
      st("Rosca", "Rosca por encima de la barrera, a la escuadra.", [[50, 90], [36, 62], [64, 62], [46, 30], [58, 41], [79, 10], [65, 18]], [[45, 3], [43, 20], [48, 20], [53, 20], [60, 17]], [40, 1.5]),
    ],
  },
  {
    id: "lib-banda",
    kind: "banda",
    name: "Saque de banda",
    short: "Banda",
    steps: [
      st("Saque", "Saca la banda; el MC viene en corto y la punta fija al central.", [[50, 90], [34, 72], [66, 72], [24, 44], [62, 54], [96, 38], [54, 22]], [[50, 3], [40, 40], [68, 44], [80, 48], [50, 18]], [97, 37]),
      st("En corto", "Saque al pie del MC, que la devuelve de primeras.", [[50, 90], [34, 72], [68, 70], [26, 40], [84, 48], [94, 32], [52, 22]], [[50, 3], [40, 40], [70, 44], [82, 52], [50, 18]], [84, 47]),
      st("A la espalda", "El que ha sacado recibe a la espalda y centra atrás.", [[50, 90], [36, 70], [68, 66], [30, 32], [80, 44], [90, 22], [50, 13]], [[50, 3], [42, 38], [72, 46], [84, 50], [54, 14]], [89, 22]),
    ],
  },
  {
    id: "lib-salida",
    kind: "salida",
    name: "Salida de balón",
    short: "Salida",
    steps: [
      st("Portero con balón", "Saque en corto: el portero la tiene y los centrales se abren.", [[50, 92], [30, 76], [70, 76], [18, 52], [50, 58], [82, 52], [50, 26]], [[50, 5], [40, 42], [60, 42], [50, 30], [30, 24]], [50, 88]),
      st("Abren los centrales", "Los centrales pisan la banda y el MC baja a ofrecerse.", [[50, 92], [12, 80], [88, 80], [18, 46], [50, 67], [82, 46], [50, 26]], [[50, 5], [36, 62], [64, 62], [50, 48], [30, 36]], [50, 88]),
      st("Pase al central", "Pase raso al central derecho, lejos de la presión.", [[50, 92], [12, 80], [88, 78], [18, 46], [52, 64], [86, 56], [50, 26]], [[50, 5], [38, 62], [72, 68], [52, 50], [30, 36]], [86, 75]),
      st("Salto de línea", "Pared con la banda y diagonal a la punta, de cara.", [[50, 92], [16, 76], [82, 66], [30, 30], [56, 50], [86, 42], [54, 18]], [[50, 5], [42, 58], [78, 72], [58, 46], [34, 34]], [54, 19]),
    ],
  },
  {
    id: "lib-corner-contra",
    kind: "corner",
    name: "Córner en contra",
    short: "Córner en contra",
    steps: [
      st("Todos atrás", "Zona en el área: un central a cada palo, el MC en el punto de penalti y la punta fuera, para la contra.", [[50, 95], [44, 93], [56, 93], [40, 84], [50, 86], [62, 86], [50, 62]], [[96, 97], [46, 85], [55, 83], [40, 80], [62, 78]], [95, 96]),
      st("El centro", "Cada uno a su zona y a por el balón; si es del portero, que lo grite y salga.", [[52, 92], [45, 91], [56, 90], [42, 85], [51, 87], [62, 84], [52, 60]], [[94, 96], [48, 88], [54, 87], [42, 83], [61, 81]], [52, 88]),
      st("Despeje a banda", "Despeje fuerte y hacia fuera, nunca al centro del área.", [[50, 94], [44, 88], [56, 88], [32, 76], [50, 82], [64, 80], [30, 58]], [[90, 92], [48, 86], [54, 85], [40, 80], [60, 78]], [20, 66]),
      st("A la contra", "La punta la aguanta, el MI acompaña y el equipo sube junto.", [[50, 92], [40, 78], [60, 78], [24, 56], [50, 68], [70, 66], [32, 48]], [[86, 86], [50, 80], [56, 78], [44, 72], [60, 70]], [30, 50]),
    ],
  },
  {
    id: "lib-falta-lateral",
    kind: "falta",
    name: "Falta lateral a favor",
    short: "Falta lateral",
    taker: { role: "freekicksId", slot: 5 },
    steps: [
      st("Colocación", "El de las faltas al balón; tres al área y el central en la frontal, por el rechace.", [[50, 90], [40, 60], [64, 50], [40, 20], [52, 18], [87, 31], [60, 16]], [[50, 3], [46, 14], [56, 13], [62, 18], [84, 26]], [88, 30]),
      st("Desmarque", "Los de dentro arrancan a la vez: primer palo, penalti y segundo palo.", [[50, 90], [40, 58], [62, 40], [34, 12], [50, 12], [87, 31], [62, 8]], [[50, 3], [42, 12], [52, 11], [60, 10], [84, 26]], [88, 30]),
      st("Centro tenso", "Centro cerrado hacia la portería: que la toque cualquiera.", [[50, 90], [40, 58], [60, 36], [36, 10], [50, 10], [86, 30], [60, 7]], [[52, 3], [43, 11], [52, 10], [58, 10], [84, 27]], [56, 8]),
      st("Remate", "Remate al primer toque; el central, atento al rechace en la frontal.", [[50, 90], [40, 58], [58, 34], [38, 9], [50, 9], [86, 30], [57, 5]], [[48, 3], [43, 10], [52, 9], [58, 9], [84, 27]], [54, 1.5]),
    ],
  },
  {
    id: "lib-banda-larga",
    kind: "banda",
    name: "Saque de banda largo",
    short: "Banda larga",
    steps: [
      st("Al área", "El MI saca largo; el central sube y dos se meten en el área.", [[50, 88], [30, 62], [60, 40], [3, 31], [40, 30], [62, 22], [46, 14]], [[50, 3], [42, 12], [56, 14], [36, 24], [20, 30]], [3, 30]),
      st("La peinada", "Saque al primer palo: la punta la peina hacia atrás.", [[50, 88], [30, 60], [56, 30], [6, 31], [42, 22], [60, 12], [44, 13]], [[50, 3], [44, 11], [56, 12], [38, 22], [18, 30]], [44, 14]),
      st("Segundo palo", "El MD entra al segundo palo y la empuja.", [[50, 88], [30, 60], [54, 28], [8, 30], [44, 18], [57, 6], [44, 12]], [[52, 3], [45, 10], [58, 10], [38, 21], [18, 30]], [56, 1.5]),
    ],
  },
  {
    id: "lib-salida-porteria",
    kind: "salida",
    name: "Saque de portería en corto",
    short: "Saque de puerta",
    steps: [
      st("Saque de puerta", "Los centrales abiertos al borde del área y el MC se ofrece entre los dos.", [[50, 95], [26, 84], [74, 84], [12, 60], [50, 74], [88, 60], [50, 36]], [[50, 5], [36, 66], [64, 66], [50, 58], [50, 40]], [50, 94]),
      st("Al central", "Pase raso al central izquierdo, que la protege de cara.", [[50, 94], [26, 82], [76, 82], [10, 56], [44, 72], [88, 58], [48, 38]], [[50, 5], [32, 72], [64, 68], [48, 62], [50, 42]], [27, 84]),
      st("El MC de cara", "El MC baja, la recibe y se gira hacia el lado contrario.", [[50, 92], [26, 80], [74, 80], [12, 54], [44, 71], [86, 54], [52, 40]], [[50, 5], [30, 76], [60, 66], [46, 66], [50, 44]], [44, 72]),
      st("Cambio de orientación", "Abierta al MD, que encara solo: hemos salido de la presión.", [[50, 92], [28, 76], [70, 76], [16, 48], [48, 66], [86, 50], [58, 34]], [[50, 5], [30, 74], [56, 66], [48, 64], [50, 46]], [86, 52]),
    ],
  },
];

/** Stable id of one of the design's built-in jugadas (not stored on the board: rebuilt each time). */
export const libraryPlayId = (kind: LibPlay["kind"]) => `lib-${kind}`;

/** The library's button labels, by jugada id. */
export const LIBRARY_SHORT: Readonly<Record<string, string>> = Object.fromEntries(PLAY_LIBRARY.map((p) => [p.id, p.short]));

/** Where each part stands in the design (its line and its side). */
const PARTS: { z: Zone; x: number }[] = [
  { z: "POR", x: 50 },
  { z: "DEF", x: 33 },
  { z: "DEF", x: 67 },
  { z: "MED", x: 22 },
  { z: "MED", x: 50 },
  { z: "MED", x: 78 },
  { z: "DEL", x: 50 },
];
const RANK: Record<Zone, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };

/** A slot's line and side on this board (in free mode, from where the cromo stands). */
function slotSpot(lineup: Lineup, i: number): { z: Zone; x: number } {
  const s = lineup.slots[i];
  if (i === 0 || !s) return { z: "POR", x: s?.x ?? 50 };
  if (lineup.freeMode) return { z: s.y >= 62 ? "DEF" : s.y >= 36 ? "MED" : "DEL", x: s.x };
  return { z: s.zone, x: s.x };
}

// The 720 orders of the six outfield parts, identity first (it wins every tie).
const PERMS: number[][] = (() => {
  const out: number[][] = [];
  const go = (pre: number[], rest: number[]) => {
    if (!rest.length) out.push(pre);
    rest.forEach((v, k) => go([...pre, v], [...rest.slice(0, k), ...rest.slice(k + 1)]));
  };
  go([], [1, 2, 3, 4, 5, 6]);
  return out;
})();

/**
 * Which slot of this board plays each part (index = part): the keeper is the keeper; the six outfield
 * parts go to the slots that fit them best — a line apart costs more than any sideways step, so a part
 * stays in its line whenever the system has room there, and left stays left.
 */
export function partSlots(lineup: Lineup): number[] {
  const spots = Array.from({ length: 7 }, (_, i) => slotSpot(lineup, i));
  const cost = (part: number, slot: number) => 100 * Math.abs(RANK[PARTS[part].z] - RANK[spots[slot].z]) + Math.abs(PARTS[part].x - spots[slot].x);
  let best = PERMS[0];
  let bestCost = Infinity;
  for (const perm of PERMS) {
    let c = 0;
    for (let k = 0; k < 6 && c < bestCost; k++) c += cost(k + 1, perm[k]);
    if (c < bestCost) {
      bestCost = c;
      best = perm;
    }
  }
  return [0, ...best];
}

/** Part index → player id for a library jugada on this lineup (the galón holder takes the dead ball). */
function cast(lineup: Lineup, taker: LibPlay["taker"]): (string | null)[] {
  const ids = partSlots(lineup).map((slot) => lineup.slots[slot]?.playerId ?? null);
  const holder = taker ? lineup.roles[taker.role] : undefined;
  const at = holder ? ids.indexOf(holder) : -1;
  // the keeper never leaves goal to take it
  if (taker && at > 0 && at !== taker.slot) [ids[at], ids[taker.slot]] = [ids[taker.slot], ids[at]];
  return ids;
}

/** The built-in jugadas for the seven on `lineup` (empty slots are simply not in them). */
export function libraryPlays(lineup: Lineup): Play[] {
  return PLAY_LIBRARY.map((lib) => {
    const ids = cast(lineup, lib.taker);
    const frames: PlayFrame[] = lib.steps.map((s) => ({
      players: Object.fromEntries(ids.flatMap((id, i) => (id ? [[id, { x: s.p[i][0], y: s.p[i][1] }]] : []))),
      ball: { x: s.b[0], y: s.b[1] },
      rivals: s.r.map(([x, y], j) => ({ id: `r${j + 1}`, x, y })),
      arrows: [],
      title: s.title,
      note: s.note,
    }));
    frames.forEach((f, i) => {
      if (frames[i + 1]) f.arrows = deriveArrows(f, frames[i + 1]);
    });
    return { id: lib.id, name: lib.name, kind: lib.kind, frames };
  });
}
