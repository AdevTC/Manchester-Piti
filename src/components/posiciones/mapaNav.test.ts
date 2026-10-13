import { describe, expect, it } from "vitest";
import { DISC_FLOOR, DISC_MIN, HIT_BAND, MIN_PITCH_WIDTH, PITCH_ASPECT, hitCentre, nearestSpot, playedDiscs, playedLines, playedText, spotState, summaryText, fullText } from "./mapaNav";
import { POSITIONS, POS_CODES, type PosCode } from "../../lib/positions";

describe("nearestSpot", () => {
  it("climbs the central spine one spot at a time", () => {
    expect(nearestSpot("POR", "up")).toBe("LIB");
    expect(nearestSpot("LIB", "up")).toBe("DFC");
    expect(nearestSpot("DFC", "up")).toBe("MCD");
    expect(nearestSpot("MCD", "up")).toBe("MC");
    expect(nearestSpot("MC", "up")).toBe("MCO");
    expect(nearestSpot("MCO", "up")).toBe("DC");
  });

  it("comes back down the spine", () => {
    expect(nearestSpot("DC", "down")).toBe("MCO");
    expect(nearestSpot("LIB", "down")).toBe("POR");
  });

  it("prefers the spot on the same row over a closer-but-diagonal one", () => {
    expect(nearestSpot("MC", "right")).toBe("MD");
    expect(nearestSpot("MC", "left")).toBe("MI");
    expect(nearestSpot("EI", "right")).toBe("DC");
    expect(nearestSpot("DC", "left")).toBe("EI");
  });

  it("walks up the wings", () => {
    expect(nearestSpot("LI", "up")).toBe("MI");
    expect(nearestSpot("MI", "up")).toBe("EI");
    expect(nearestSpot("ED", "down")).toBe("MD");
    expect(nearestSpot("MD", "down")).toBe("LD");
  });

  it("returns null at the edge of the pitch", () => {
    expect(nearestSpot("DC", "up")).toBeNull();
    expect(nearestSpot("POR", "down")).toBeNull();
    expect(nearestSpot("LI", "left")).toBeNull();
    expect(nearestSpot("ED", "right")).toBeNull();
  });

  it("reaches every spot from the goalkeeper with the arrows alone", () => {
    const seen = new Set<PosCode>(["POR"]);
    const queue: PosCode[] = ["POR"];
    while (queue.length) {
      const at = queue.shift() as PosCode;
      for (const dir of ["up", "down", "left", "right"] as const) {
        const next = nearestSpot(at, dir);
        if (next && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect([...seen].sort()).toEqual([...POS_CODES].sort());
  });
});

describe("hit areas", () => {
  it("keep every spot ≥ 44 px tall without overlapping, down to the smallest supported pitch", () => {
    const width = MIN_PITCH_WIDTH;
    const height = width * PITCH_ASPECT;
    const hitW = 48; // --_pos-hit-w at size m (3rem)
    expect((HIT_BAND / 100) * height).toBeGreaterThanOrEqual(44);
    for (const a of POS_CODES) {
      const ca = hitCentre(a);
      expect(ca - HIT_BAND / 2).toBeGreaterThanOrEqual(0);
      expect(ca + HIT_BAND / 2).toBeLessThanOrEqual(100);
      for (const b of POS_CODES) {
        if (a >= b) continue;
        const apartX = (Math.abs(POSITIONS[a].x - POSITIONS[b].x) / 100) * width >= hitW;
        const apartY = Math.abs(ca - hitCentre(b)) >= HIT_BAND;
        expect(apartX || apartY, `${a}/${b}`).toBe(true);
      }
    }
  });

  it("keeps the nudged hit area over its dot", () => {
    for (const code of POS_CODES) expect(Math.abs(hitCentre(code) - POSITIONS[code].y)).toBeLessThanOrEqual(2);
  });
});

describe("texts", () => {
  const set = { main: "MCD" as const, also: ["MC" as const, "DFC" as const] };

  it("says the state of each spot", () => {
    expect(spotState(set, "MCD")).toBe("preferida");
    expect(spotState(set, "MC")).toBe("también");
    expect(spotState(set, "DC")).toBe("nada");
  });

  it("summarises in one line", () => {
    expect(summaryText(set)).toBe("Pivote (MCD) · también MC, DFC");
    expect(summaryText({ main: "DC", also: [] })).toBe("Punta (DC)");
    expect(summaryText({ main: null, also: ["LI", "LD"] })).toBe("También LI, LD");
    expect(summaryText({ main: null, also: [] })).toBe("Sin posición");
    expect(summaryText({ main: null, also: [] }, "Aún no has dicho dónde juegas")).toBe("Aún no has dicho dónde juegas");
  });

  it("spells every position out for screen readers, including the review differences", () => {
    expect(fullText(set)).toBe("Preferida: Pivote (MCD). También: Mediocentro (MC), Central (DFC).");
    expect(fullText({ main: null, also: [] })).toBe("Sin posición.");
    expect(fullText(set, { main: "MCD", also: ["LIB"] })).toBe(
      "Preferida: Pivote (MCD). También: Mediocentro (MC), Central (DFC). Añadidas: Mediocentro (MC), Central (DFC). Quitadas: Líbero (LIB).",
    );
    expect(fullText({ main: "MCD", also: ["MC"] }, { main: "MC", also: ["MCD"] })).toBe(
      "Preferida: Pivote (MCD). También: Mediocentro (MC). Preferida antes: Mediocentro (MC).",
    );
  });
});

describe("history mode («Ha jugado de»)", () => {
  it("playedLines: codes with ≥ 1′ (rounded), by minutes desc then catalogue order; junk ignored", () => {
    const played = { MC: 140, MCD: 320, DFC: 20, DC: 0.4, LI: 0, XX: 50, ED: Number.NaN, MI: 20 } as Partial<Record<PosCode, number>>;
    expect(playedLines(played)).toEqual([
      { code: "MCD", minutes: 320 },
      { code: "MC", minutes: 140 },
      { code: "DFC", minutes: 20 },
      { code: "MI", minutes: 20 },
    ]);
    expect(playedLines({})).toEqual([]);
  });

  it("playedText: minutes in words, then the positions, then «estimado»; explicit empty copy", () => {
    expect(playedText({ main: "MCD", also: ["MC"] }, { MCD: 320.4, MC: 1 }, true)).toBe(
      "Ha jugado de Pivote (MCD), 320 minutos; Mediocentro (MC), 1 minuto. Preferida: Pivote (MCD). También: Mediocentro (MC). Algunos minutos estimados por su posición preferida.",
    );
    expect(playedText({ main: null, also: [] }, { DC: 0.3 }, false)).toBe("Aún sin minutos con posición.");
  });

  it("playedDiscs: √(minutes / max) between 28 and 52 px when nothing is close", () => {
    const d = playedDiscs({ DC: 400, MCD: 100, LI: 4 });
    expect(d.DC).toEqual({ d: 52, label: "below" });
    expect(d.MCD?.d).toBe(40); // 28 + 24 · √¼
    expect(d.LI?.d).toBeCloseTo(30.4, 1); // 28 + 24 · √(1/100)
    expect(d.MC).toBeUndefined();
  });

  // An independent check of the drawing: discs (circles), the «320′» pill (40 × 14 px, under the disc or
  // beside it) and the ★/✓ badge (13.6 px at the disc's top-right) of different spots never touch, at the
  // narrowest pitch of each size and wider. Mirrors src/styles/posiciones.css.
  type Box = { x0: number; y0: number; x1: number; y1: number };
  type Circle = { cx: number; cy: number; r: number };
  const boxHitsBox = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const boxHitsCircle = (a: Box, c: Circle) => {
    const nx = Math.max(a.x0, Math.min(c.cx, a.x1));
    const ny = Math.max(a.y0, Math.min(c.cy, a.y1));
    return (nx - c.cx) ** 2 + (ny - c.cy) ** 2 < c.r ** 2;
  };
  function shapes(played: Partial<Record<PosCode, number>>, size: "s" | "m", w: number) {
    const discs = playedDiscs(played, size);
    return POS_CODES.map((code) => {
      const p = POSITIONS[code];
      const cx = (p.x / 100) * w;
      const cy = (p.y / 100) * w * PITCH_ASPECT;
      const disc = discs[code];
      const r = Math.max(DISC_FLOOR, ((disc?.d ?? DISC_MIN) * w) / 320) / 2;
      const boxes: Box[] = [{ x0: cx + r - 4.8, y0: cy - r - 4.8, x1: cx + r + 8.8, y1: cy - r + 8.8 }]; // badge (assume every spot has one)
      if (disc?.label === "below") boxes.push({ x0: cx - 20, y0: cy + r - 5, x1: cx + 20, y1: cy + r + 9 });
      if (disc?.label === "side")
        boxes.push(p.side === "derecha" ? { x0: cx - r - 46, y0: cy - 5, x1: cx - r - 6, y1: cy + 9 } : { x0: cx + r + 6, y0: cy - 5, x1: cx + r + 46, y1: cy + 9 });
      return { code, circle: { cx, cy, r }, boxes };
    });
  }
  const configs: Partial<Record<PosCode, number>>[] = [
    Object.fromEntries(POS_CODES.map((c) => [c, 500])),
    Object.fromEntries(POS_CODES.map((c, i) => [c, 40 * (i + 1)])),
    Object.fromEntries(POS_CODES.map((c, i) => [c, 40 * (13 - i)])),
    { DFC: 600, LIB: 590, POR: 580 },
    { DFC: 600 },
    { LIB: 600 },
    { LIB: 600, DFC: 5 },
    { POR: 600, LIB: 300 },
    { MCD: 600, DFC: 600 },
    { MC: 500, MCO: 500, MCD: 500, DC: 500 },
    { LI: 300, MI: 300, EI: 300, LD: 300, MD: 300, ED: 300 },
  ];
  for (const [size, widths] of [["m", [MIN_PITCH_WIDTH, 320, 420]], ["s", [240, 300]]] as const)
    for (const w of widths)
      it(`no two spots touch, size ${size} at ${w} px`, () => {
        for (const played of configs) {
          const all = shapes(played, size, w);
          for (const a of all)
            for (const b of all) {
              if (a.code >= b.code) continue;
              const tag = `${JSON.stringify(played)} ${a.code}/${b.code}`;
              expect(Math.hypot(a.circle.cx - b.circle.cx, a.circle.cy - b.circle.cy), tag).toBeGreaterThanOrEqual(a.circle.r + b.circle.r);
              for (const box of a.boxes) expect(boxHitsCircle(box, b.circle) || b.boxes.some((o) => boxHitsBox(box, o)), `${tag} (${a.code}'s box)`).toBe(false);
              for (const box of b.boxes) expect(boxHitsCircle(box, a.circle), `${tag} (${b.code}'s box)`).toBe(false);
            }
          for (const s of all) for (const box of s.boxes) expect(box.y1 <= w * PITCH_ASPECT && box.x0 >= 0 && box.x1 <= w, `${s.code} inside the pitch`).toBe(true);
        }
      });

  it("a disc with more minutes is never drawn smaller than one with fewer (one scale for the whole map)", () => {
    for (const played of configs) {
      const d = playedDiscs(played, "m");
      const lines = playedLines(played);
      for (const a of lines) for (const b of lines) if (a.minutes > b.minutes) expect(d[a.code]!.d, `${a.code} vs ${b.code}`).toBeGreaterThanOrEqual(d[b.code]!.d);
    }
  });
});
