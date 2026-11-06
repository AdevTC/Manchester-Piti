// @vitest-environment jsdom
// The pages whose light changes with the theme (Inicio, Números, Plantilla, El club) render the night's light whatever
// the theme and let the «día» theme's stylesheet paint the day over it: the server can't know the theme (it paints
// «día»), so a page that rendered the day light had its sky changed under the night's visitors when React took over.
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { VidrioSky } from "./VidrioSky";

type Fs = { readFileSync: (path: string, encoding: "utf8") => string };
const fsModule = "node:fs";
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as Fs;
const css = readFileSync("src/styles/vidrio/sky.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, ""); // vitest runs from the repo root

/** The custom properties a rule (found by its exact prelude) sets. */
const props = (prelude: string) => {
  const at = css.indexOf(prelude + "{");
  expect(at, prelude).toBeGreaterThanOrEqual(0);
  const body = css.slice(at + prelude.length + 1, css.indexOf("}", at));
  return new Set([...body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
};

describe("the light field under the «día» theme", () => {
  it("paints every colour of the sky whatever light the page passes (each light's properties are all the day's)", () => {
    const day = props('.vd-l-day,:root[data-theme="light"] .vd-sky');
    for (const light of ["golden", "flood", "late", "noon"]) {
      const missing = [...props(`.vd-l-${light}`)].filter((p) => !day.has(p));
      expect(missing, light).toEqual([]);
    }
  });

  it("renders the same markup for a night light with a day bokeh, whatever <html data-theme> says", () => {
    const html = (theme: string) => {
      document.documentElement.setAttribute("data-theme", theme);
      return renderToString(<VidrioSky light="dorada" day="noon" floodlit={false} height={1150} />);
    };
    const dark = html("dark");
    expect(dark).toBe(html("light"));
    expect(dark).toContain("vd-sky vd-l-golden");
  });
});

describe("the discs and a View Transition", () => {
  it("are drawn once the transition is over, not during it (its arriving page is captured live)", async () => {
    const { createRoot } = await import("react-dom/client");
    const { act } = await import("react");
    const { _resetTapsForTesting, tapsSkipTransitions } = await import("../celeste/pageTransition");
    const doc = document as unknown as { startViewTransition?: unknown };
    const had = doc.startViewTransition;
    let end = () => {};
    const finished = new Promise<void>((resolve) => (end = resolve));
    doc.startViewTransition = () => ({ finished, ready: Promise.resolve(), updateCallbackDone: Promise.resolve(), skipTransition: () => {} });
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: () => null };
    const getContext = proto.getContext;
    let asked = 0;
    proto.getContext = () => {
      asked++;
      return null;
    };
    (window as { __SHOT?: unknown }).__SHOT = true;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 400 });
    const host = document.createElement("div");
    document.body.append(host);
    try {
      tapsSkipTransitions(document);
      (document as unknown as { startViewTransition: () => unknown }).startViewTransition();
      const root = createRoot(host);
      await act(async () => root.render(<VidrioSky light="dorada" floodlit={false} height={900} />));
      expect(asked).toBe(0);
      end();
      await act(async () => {
        await finished;
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(asked).toBe(1);
      act(() => root.unmount());
    } finally {
      delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      delete (window as { __SHOT?: unknown }).__SHOT;
      proto.getContext = getContext;
      doc.startViewTransition = had;
      _resetTapsForTesting();
      host.remove();
    }
  });
});
