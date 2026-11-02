// Shared by the budget test and its measuring: the seeded boards and a board at every cap (see pizarra-budget.test.ts).
import { readFileSync } from "node:fs";
import { deleteField, serverTimestamp, Timestamp } from "firebase/firestore";

export const OWNER = "e5VyTucoVvZQVMI1T7al1kAnjr2d";
export const fx = JSON.parse(readFileSync("test/rules/fixtures/pz-boards.json", "utf8")) as Record<string, Record<string, unknown>>;
/** The fixture as Firestore data ({__ts} → Timestamp). */
export const revive = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.__ts === "string") return Timestamp.fromDate(new Date(o.__ts));
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, revive(x)]));
  }
  return v;
};
/** What the autosave writes (useLineups saveData): every board field, bench/pinned deleted, updatedAt. */
export const BOARD_FIELDS = ["formation", "freeMode", "slots", "roles", "tactics", "playerPositions", "drawings", "plays", "subs", "takers", "variants", "shapeOff", "condPlan", "style", "rival", "tags", "plan", "seasonPlays"];
export const autosave = (b: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  ...Object.fromEntries(BOARD_FIELDS.filter((k) => k in b).map((k) => [k, b[k]])),
  bench: deleteField(),
  pinned: deleteField(),
  updatedAt: serverTimestamp(),
  ...over,
});

// ── a board at every cap the rules know
export const id = (i: number) => "p" + String(i).padStart(19, "0");
export const slot = (i: number) => ({ slotId: "pz-slot-" + i, playerId: id(i), position: "MC", zone: "MED", x: 50, y: 50 });
export const frame = () => ({ players: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [id(i), { x: 10 * i, y: 50 }])), ball: { x: 50, y: 50 }, rivals: Array.from({ length: 7 }, (_, i) => ({ x: 5 * i, y: 20 })), arrows: Array.from({ length: 10 }, () => ({ kind: "pase", from: id(0), to: { x: 1, y: 2 } })), title: "x".repeat(40), note: "y".repeat(140) });
export const worst = (matchId: string) => ({
  ownerUid: OWNER,
  ownerNickname: "jordi",
  seasonId: "s".repeat(20),
  name: "n".repeat(60),
  isOfficial: false,
  matchId,
  formation: "2-3-1",
  freeMode: true,
  fromMesa: true,
  slots: Array.from({ length: 7 }, (_, i) => slot(i)),
  roles: { captainId: id(0), viceId: id(1), penaltiesId: id(2), freekicksId: id(3), cornersId: id(4) },
  tactics: Object.fromEntries(Array.from({ length: 12 }, (_, i) => ["t" + i, "Media"])),
  playerPositions: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [id(i), "MC"])),
  subs: Array.from({ length: 20 }, (_, i) => ({ id: "s" + i, min: 25, out: id(i % 7), in: id(7 + i) })),
  takers: { penalties: [id(0), id(1), id(2)], freekicks: [id(3), id(4), id(5)], corners: [id(6), id(1), id(2)] },
  rival: { formation: "2-3-1", players: Array.from({ length: 7 }, (_, i) => ({ num: i + 1, note: "z".repeat(80) })), visible: true, danger: 6 },
  drawings: Array.from({ length: 60 }, (_, i) => ({ id: "k" + i, kind: "carrera", color: "gold", points: Array.from({ length: 64 }, (_, j) => ({ x: j, y: j })) })),
  plays: Array.from({ length: 12 }, (_, i) => ({ id: "j" + i, name: "j".repeat(40), kind: "corner", frames: Array.from({ length: 8 }, frame), video: { url: "https://youtu.be/" + "a".repeat(40), at: 75 }, moment: { matchId, min: 23, eventId: "e1" } })),
  variants: ["v2", "vb"].map((vid) => ({ id: vid, name: "v".repeat(24), formation: "3-2-1", freeMode: false, slots: Array.from({ length: 7 }, (_, i) => slot(i)), tactics: Object.fromEntries(Array.from({ length: 12 }, (_, i) => ["t" + i, "Alta"])) })),
  shapeOff: { formation: "2-3-1", offs: Array.from({ length: 7 }, () => ({ du: 1, dv: 2 })) },
  condPlan: Array.from({ length: 3 }, (_, i) => ({ id: "c" + i, when: "perdiendo", by: 1, from: 35, key: "mentality", value: "Ofensiva", sub: { out: id(0), in: id(8) }, ver: "planb" })),
  style: "presion",
  tags: ["t".repeat(20), "u".repeat(20), "v".repeat(20)],
  plan: {
    claves: ["a".repeat(60), "b".repeat(60), "c".repeat(60)],
    viz: [{ icon: "spark", zona: "arriba" }, { icon: "eye", zona: "su7" }, { icon: "ball", zona: "centro" }],
    notes: "n".repeat(280),
    parado: { corners: { playId: "lib-corner", box: [0, 1, 2, 3, 4].map(id) }, freekicks: { playId: "lib-falta", box: [5, 6, 7, 8, 9].map(id) }, penalties: { rechace: [10, 11, 12, 13, 14].map(id) } },
  },
  seasonPlays: Array.from({ length: 24 }, (_, i) => "sp" + i),
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
/** Every field different (the heaviest update: all keys in affectedKeys). */
export const changed = (w: Record<string, unknown>) => ({
  ...w,
  name: "m".repeat(60),
  formation: "3-2-1",
  freeMode: false,
  fromMesa: false,
  slots: (w.slots as object[]).map((s, i) => ({ ...s, x: 40 + i })),
  roles: { captainId: id(1) },
  tactics: { t0: "Alta" },
  playerPositions: { [id(0)]: "DC" },
  subs: [],
  takers: { penalties: [id(1)], freekicks: [], corners: [] },
  rival: { formation: "3-2-1", players: [], visible: false, danger: null },
  drawings: (w.drawings as object[]).slice(1),
  plays: (w.plays as object[]).slice(1),
  variants: (w.variants as object[]).slice(1),
  shapeOff: null,
  condPlan: (w.condPlan as object[]).slice(1),
  style: "bloque",
  tags: ["Liga"],
  plan: { claves: ["otra"], viz: [{ icon: "flag", zona: "nada" }], notes: "", parado: null },
  seasonPlays: ["sp1"],
  updatedAt: serverTimestamp(),
});

