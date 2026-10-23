import { afterEach, describe, expect, it, vi } from "vitest";
import { displacementMap, lensFilter } from "./refraction";

// jsdom paints no canvas: a stand-in 2D context that keeps what each build wrote
function stubCanvas() {
  const drawn: { width: number; height: number; data: Uint8ClampedArray }[] = [];
  const ctx = {
    createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: (img: { width: number; height: number; data: Uint8ClampedArray }) => drawn.push({ width: img.width, height: img.height, data: img.data.slice() }),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctx) as unknown as HTMLCanvasElement["getContext"]);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => `data:image/png;base64,${drawn.length}`);
  return drawn;
}

afterEach(() => vi.restoreAllMocks());

describe("the lens filters", () => {
  it("writes exactly the displacement map's pixels, on the one canvas reused for every size", () => {
    const drawn = stubCanvas();
    const a = lensFilter(300, 58, 29, 16, 1.1);
    const b = lensFilter(120, 46, 23, 16, 1.1);
    expect(a).not.toBe(b);
    expect(drawn).toHaveLength(2);
    for (const [i, [w, h, r]] of [
      [300, 58, 29],
      [120, 46, 23],
    ].entries()) {
      const map = displacementMap(w, h, r, 16);
      expect(drawn[i].width).toBe(map.width);
      expect(drawn[i].height).toBe(map.height);
      expect(drawn[i].data).toEqual(map.data);
    }
    // a size seen before is reused, not redrawn
    expect(lensFilter(300, 58, 29, 16, 1.1)).toBe(a);
    expect(drawn).toHaveLength(2);
  });

  it("keeps the last 24 sizes and removes the evicted filters, but never one still on screen", () => {
    stubCanvas();
    const shown = document.createElement("div");
    document.body.appendChild(shown);
    const first = lensFilter(40, 20, 10, 8, 1)!;
    shown.dataset.vdLensed = first;
    const second = lensFilter(41, 20, 10, 8, 1)!;
    const ids = [first, second];
    for (let w = 42; w < 42 + 30; w++) ids.push(lensFilter(w, 20, 10, 8, 1)!);
    const defs = document.getElementById("vd-lens-defs")!;
    // the one in use stays; the oldest free ones are gone from the cache and from the <svg>
    expect(document.getElementById(first)).not.toBeNull();
    expect(document.getElementById(second)).toBeNull();
    expect(defs.querySelectorAll("filter").length).toBeLessThanOrEqual(24 + 1);
    expect(document.getElementById(ids[ids.length - 1])).not.toBeNull();
    // once the element moves on, the old filter can go on the next build
    shown.dataset.vdLensed = ids[ids.length - 1];
    lensFilter(500, 20, 10, 8, 1);
    expect(document.getElementById(first)).toBeNull();
    shown.remove();
  });
});
