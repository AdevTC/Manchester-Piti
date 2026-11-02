import { describe, expect, it } from "vitest";
import * as V from "./pachangaView";
import type { PgWho } from "./pachangaView";

const PEOPLE: Record<string, [string, PgWho["line"], number | null]> = {
  evans: ["EVANS", "POR", 64],
  fer: ["FER", "DEF", 68],
  erik: ["ERIK", "DEL", 65],
  jordi: ["JORDI", "DEF", 61],
  adrian: ["ADRIÁN", "MED", 71],
  kevin: ["KEVIN", "MED", 65],
  alcides: ["ALCIDES", "DEL", 73],
  illescas: ["ILLESCAS", "DEF", 63],
  brawan: ["BRAWAN", "DEL", 65],
  pellete: ["PELLETE", "DEF", 63],
  huber: ["HUBEROSKI", "DEF", 68],
  rafa: ["RAFA", null, null],
};
const who = (id: string): PgWho => {
  const p = PEOPLE[id];
  return p ? { id, shirt: p[0], num: 1, line: p[1], global: p[2], guest: id === "rafa", mine: false } : { id, shirt: id.toUpperCase(), num: null, line: null, global: null, guest: true, mine: true };
};
const ALL = Object.keys(PEOPLE);
const base = (o: Partial<V.PgState> = {}): V.PgState => ({ ...V.emptyPg(), seeded: true, ...o });

describe("pachanga · el reparto", () => {
  it("12 que vinieron: dos equipos de 6, todos una vez, parejos", () => {
    const s = V.setComes(who, base(), ALL, "entreno");
    expect(s.teams).toHaveLength(2);
    expect(s.teams.map((t) => t.length)).toEqual([6, 6]);
    expect(new Set(s.teams.flat())).toEqual(new Set(ALL));
    expect(V.spreadOf(V.teamStats(who, s))).toBeLessThanOrEqual(1);
  });
  it("sin nota cuenta como la mediana de los que vinieron", () => {
    expect(V.medianOf(who, ["fer", "jordi", "rafa"])).toBe(65);
    expect(V.medianOf(who, ["rafa"])).toBe(62);
  });
  it("menos de 2 × n: no hay equipos", () => {
    const s = V.setComes(who, base(), ["fer", "erik", "jordi"], "mano");
    expect(s.teams).toEqual([]);
    expect(V.ready(s)).toBe(false);
  });
  it("Mezclar: otra semilla, los fijos se quedan en su equipo", () => {
    let s = V.setComes(who, base(), ALL, "entreno");
    const t = s.teams.findIndex((x) => x.includes("alcides"));
    s = V.toggleLock(s, "alcides");
    for (let k = 0; k < 6; k++) {
      s = V.mezclar(who, s);
      expect(s.teams[t]).toContain("alcides");
    }
    expect(s.seed).toBe(7);
  });
  it("separados: cada uno en un equipo; juntos: el mismo", () => {
    let s = V.setComes(who, base(), ALL, "entreno");
    s = V.addPair(who, s, "alcides", "adrian", "separados");
    expect(s.teams.findIndex((t) => t.includes("alcides"))).not.toBe(s.teams.findIndex((t) => t.includes("adrian")));
    s = V.addPair(who, s, "fer", "huber", "juntos");
    expect(s.teams.findIndex((t) => t.includes("fer"))).toBe(s.teams.findIndex((t) => t.includes("huber")));
    expect(s.unmet).toEqual([]);
    expect(V.removePair(who, s, 0).pairs).toHaveLength(1);
  });
  it("cambiar dos de equipo y pasar a uno", () => {
    const s = V.setComes(who, base(), ALL, "entreno");
    const a = s.teams[0][0];
    const b = s.teams[1][0];
    const sw = V.swap(who, s, a, b);
    expect(sw.teams[0]).toContain(b);
    expect(sw.teams[1]).toContain(a);
    const mv = V.move(who, s, a, 1);
    expect(mv.teams[1]).toContain(a);
    expect(mv.teams[0]).not.toContain(a);
  });
  it("marcar y desmarcar mantiene los equipos igualados en número", () => {
    let s = V.setComes(who, base(), ALL.slice(0, 10), "entreno");
    s = V.tick(who, s, "huber");
    expect(s.teams.flat()).toContain("huber");
    s = V.tick(who, s, s.teams[0][0]);
    s = V.tick(who, s, s.teams[0][0]);
    const sizes = s.teams.map((t) => t.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(s.src).toBe("mano");
  });
  it("alguien de fuera se apunta y cuenta", () => {
    const s = V.addGuest(who, V.setComes(who, base(), ALL.slice(0, 6), "entreno"), "Pepe");
    expect(s.guests[0]).toMatchObject({ id: "g:pepe", name: "Pepe", mine: true });
    expect(s.comes).toContain("g:pepe");
    expect(s.teams.flat()).toContain("g:pepe");
  });
  it("3 equipos: juegan dos, el tercero espera y entra rotando", () => {
    let s = V.setN(who, V.setComes(who, base(), ALL, "entreno"), 3);
    expect(s.teams.map((t) => t.length)).toEqual([4, 4, 4]);
    expect(V.waiting(s)).toBe(2);
    s = V.rotate(s);
    expect(s.playing).toEqual([1, 2]);
    expect(V.waiting(s)).toBe(0);
  });
  it("porteros: por turnos va rotando; fijos, el elegido", () => {
    let s = V.setComes(who, base(), ALL, "entreno");
    const k0 = V.keeperOf(who, s, 0);
    const order = V.gkOrder(who, s, 0);
    expect(k0).toBe(order[0]);
    expect(V.keeperOf(who, { ...s, turn: 1 }, 0)).toBe(order[1]);
    s = V.setGk(who, s, "fijos");
    const pick = s.teams[1][2];
    s = V.setKeeper(s, 1, pick);
    expect(V.keeperOf(who, s, 1)).toBe(pick);
    expect(V.orderTeam(who, s, 1)[0]).toBe(pick);
  });
  it("las camisetas de un equipo en su mitad, sin salirse ni pisarse", () => {
    for (let n = 1; n <= 12; n++) {
      const top = V.spots(n, true);
      const bot = V.spots(n, false);
      expect(top).toHaveLength(n);
      top.forEach(([x, y]) => expect(x >= 0 && x <= 100 && y > 0 && y < 50).toBe(true));
      bot.forEach(([x, y]) => expect(x >= 0 && x <= 100 && y > 50 && y < 100).toBe(true));
      expect(new Set(top.map((p) => p.join())).size).toBe(n);
    }
  });
  it("el texto para el grupo dice cada equipo, su media y el portero", () => {
    const s = V.setComes(who, base(), ALL, "entreno");
    const t = V.pachangaText(who, s, "Pachanga · jue 12 nov");
    expect(t.split("\n")[0]).toBe("Pachanga · jue 12 nov");
    expect(t).toMatch(/^Con petos \(media \d+\): .*\(portero\)/m);
    expect(t).toMatch(/^Sin petos \(media \d+\): /m);
  });
});
