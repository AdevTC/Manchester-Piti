import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecapCard } from "../../lib/derived/seasonRecap";
import { drawRecapCard, heroSize, RECAP_FACES, RECAP_PALETTE, RECAP_SIZE, recapFonts, recapLayout, recapText } from "./recapDraw";

/** A stand-in for document.fonts (jsdom has none). */
function fonts(set: { load: (font: string, text?: string) => Promise<unknown>; ready: Promise<unknown> }) {
  Object.defineProperty(document, "fonts", { configurable: true, value: set });
}
afterEach(() => {
  Reflect.deleteProperty(document, "fonts");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const CARDS: RecapCard[] = [
  { kind: "portada", name: "ANA", number: "9", season: "Temporada 1" },
  { kind: "partidos", played: 4, minutes: 120 },
  { kind: "goles", goals: 1, assists: 0, best: { matchId: "a1", label: "J1 contra Rival", goals: 1, assists: 0 } },
  { kind: "mvp", times: 0, votes: 0 },
  { kind: "socio", partnerId: "bea", partnerName: "BEATRIZ LA DEL MEDIO", combined: 3 },
  { kind: "posiciones", codes: [{ code: "DC", minutes: 110.25 }, { code: "MCO", minutes: 10 }], main: "DC" },
  { kind: "porra", rank: 2, of: 9, points: 7 },
  { kind: "medallas", medals: [{ id: "debut", label: "Debut" }] },
  { kind: "equipo", g: 2, e: 1, p: 1, gf: 6, ga: 3, biggest: { label: "J4 contra Rival", score: "3–0" } },
  { kind: "cierre", season: "Temporada 1" },
];

describe("recapText: the words of each card", () => {
  it("legacy minutes print «—», never a number", () => {
    expect(recapText({ kind: "partidos", played: 1, minutes: null }).lines[0]).toContain("—");
    expect(recapText({ kind: "partidos", played: 4, minutes: 120 }).lines[0]).toBe("120′ en el campo");
  });
  it("no MVP: «El año que viene»", () => {
    expect(recapText({ kind: "mvp", times: 0, votes: 0 }).lines).toEqual(["El año que viene."]);
    expect(recapText({ kind: "mvp", times: 2, votes: 9 })).toMatchObject({ hero: "2", label: "VECES MVP", lines: ["9 votos en toda la temporada"] });
  });
  it("the record reads G·E·P in words too (never colour alone), the porra as a rank", () => {
    expect(recapText(CARDS[8])).toMatchObject({ hero: "2·1·1", label: "GANADOS · EMPATADOS · PERDIDOS" });
    expect(recapText(CARDS[6])).toMatchObject({ hero: "2.º", label: "DE 9 EN LA PORRA", lines: ["7 puntos"] });
  });
  it("the positions card puts each code on the pitch, sized by its share of minutes", () => {
    const t = recapText(CARDS[5]);
    expect(t.hero).toBe("DC");
    expect(t.label).toBe("PUNTA");
    expect(t.markers.map((m) => m.code)).toEqual(["DC", "MCO"]);
    expect(t.markers[0].share + t.markers[1].share).toBeCloseTo(1);
  });
  it("no numbered labels («01/02»): no kicker carries a count", () => {
    for (const c of CARDS) expect(recapText(c).kicker).not.toMatch(/\d/);
  });
});

describe("recapLayout: the 1080×1920 story", () => {
  it("everything stacks top to bottom inside the frame, above the foot", () => {
    for (const c of CARDS) {
      const t = recapText(c);
      const L = recapLayout(t);
      expect([L.w, L.h]).toEqual([RECAP_SIZE.w, RECAP_SIZE.h]);
      expect(L.top.y + L.top.crest).toBeLessThan(L.kicker.y);
      expect(L.kicker.y + 2 * L.kicker.lineH).toBeLessThanOrEqual(L.hero.y);
      expect(L.label.y).toBeGreaterThan(t.crest ? L.crest.cy : L.hero.y + L.hero.size * 0.8);
      if (L.pitch) expect(L.pitch.y).toBeGreaterThan(L.label.y + L.label.size);
      expect(L.lines.y).toBeLessThan(L.foot.rule);
      expect(L.foot.y).toBeLessThanOrEqual(L.h - L.pad);
    }
  });
  it("the hero fills the width: short numbers big, long names shrink (never below the floor)", () => {
    const inner = RECAP_SIZE.w - 2 * 96;
    expect(heroSize("9", inner)).toBe(460);
    expect(heroSize("BEATRIZ LA DEL MEDIO", inner)).toBeLessThan(heroSize("ANA", inner));
    expect(heroSize("X".repeat(80), inner)).toBe(120);
  });
  it("two themes: the light one is Celeste sky, not cream", () => {
    expect(RECAP_PALETTE.light.bg).toBe("#e4f0fb");
    expect(RECAP_PALETTE.dark.accent).toBe("#FFC659");
  });
});

describe("the fonts load before the card is drawn", () => {
  it("loads every face with the card's words, then waits for the set", async () => {
    const order: string[] = [];
    const load = vi.fn((font: string) => {
      order.push("load " + font);
      return Promise.resolve([]);
    });
    fonts({
      load,
      get ready() {
        order.push("ready");
        return Promise.resolve();
      },
    });
    await recapFonts("ANA 9");
    expect(load.mock.calls.map((c) => c[0])).toEqual([...RECAP_FACES]);
    expect(load).toHaveBeenCalledWith("900 100px Anybody", "ANA 9");
    expect(order.at(-1)).toBe("ready");
  });

  it("never fails the image when a face won't load", async () => {
    fonts({ load: vi.fn(() => Promise.reject(new Error("offline"))), ready: Promise.resolve() });
    await expect(recapFonts("x")).resolves.toBeUndefined();
  });

  it("drawRecapCard: the faces are loaded before the first letter is painted", async () => {
    const order: string[] = [];
    fonts({
      load: vi.fn((font: string) => {
        order.push("load " + font);
        return Promise.resolve([]);
      }),
      ready: Promise.resolve(),
    });
    vi.stubGlobal("Image", undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const gradient = { addColorStop: () => undefined };
    const ctx = new Proxy({} as Record<string | symbol, unknown>, {
      get(target, key) {
        if (key in target) return target[key];
        if (key === "measureText") return () => ({ width: 10 });
        if (key === "createRadialGradient" || key === "createLinearGradient") return () => gradient;
        if (key === "fillText") return (s: string) => order.push("text " + s);
        return () => undefined;
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    });
    const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
    await expect(drawRecapCard(canvas, CARDS[1], { theme: "dark", shirt: { name: "Ana", number: "9" } })).resolves.toBe(true);
    expect([canvas.width, canvas.height]).toEqual([1080, 1920]);
    const firstText = order.findIndex((s) => s.startsWith("text "));
    expect(firstText).toBeGreaterThan(order.findLastIndex((s) => s.startsWith("load ")));
    expect(order).toContain("text 4");
    expect(order).toContain("text PARTIDOS JUGADOS");
  });
});
