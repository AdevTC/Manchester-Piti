import { describe, expect, it, vi } from "vitest";
import { HEADLINE_FONT, headlineFont } from "./headlineFont";

const docWith = (fonts: Partial<FontFaceSet>) => ({ fonts }) as unknown as Document;

describe("Estadísticas' headline face", () => {
  it("is waited for when the page is entered, until it loads", async () => {
    let loaded: () => void = () => undefined;
    const load = vi.fn(() => new Promise<FontFace[]>((ok) => (loaded = () => ok([]))));
    const wait = headlineFont({ preload: false }, 400, docWith({ load, check: () => false }));
    expect(load).toHaveBeenCalledWith(HEADLINE_FONT);
    let done = false;
    void wait?.then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    loaded();
    await wait;
    expect(done).toBe(true);
  });

  it("never holds the change of page longer than its cap, nor fails it", async () => {
    vi.useFakeTimers();
    try {
      const wait = headlineFont({ preload: false }, 400, docWith({ load: () => new Promise<FontFace[]>(() => undefined), check: () => false }));
      vi.advanceTimersByTime(400);
      await expect(wait).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
    await expect(headlineFont({ preload: false }, 400, docWith({ load: () => Promise.reject(new Error("offline")), check: () => false }))).resolves.toBeUndefined();
  });

  it("does nothing while the route is only preloaded (at idle, on a touch's intent), once loaded, or on the server", () => {
    const load = vi.fn(async () => []);
    expect(headlineFont({ preload: true }, 400, docWith({ load, check: () => false }))).toBeUndefined();
    expect(headlineFont({ preload: false }, 400, docWith({ load, check: () => true }))).toBeUndefined();
    expect(headlineFont({ preload: false }, 400, undefined)).toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });
});
