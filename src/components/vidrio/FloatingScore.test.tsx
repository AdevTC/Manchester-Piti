import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FloatingScore } from "./FloatingScore";
import { liveDock, useLiveDock } from "./liveDock";
import { PipWindow } from "./PipWindow";
import { openScorePip, type ScorePip } from "./pip";
import type { FloatMatch } from "./floatText";

const LIVE: FloatMatch = { state: "directo", us: 2, them: 1, rival: "Orduña fc", clock: "23′" };

// jsdom lays nothing out: give elements a size so the anchors make sense
let sizes: PropertyDescriptor | undefined;
let sizesH: PropertyDescriptor | undefined;
beforeEach(() => {
  sizes = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
  sizesH = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 200 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 50 });
  localStorage.clear();
});
afterEach(() => {
  if (sizes) Object.defineProperty(HTMLElement.prototype, "offsetWidth", sizes);
  if (sizesH) Object.defineProperty(HTMLElement.prototype, "offsetHeight", sizesH);
  liveDock.reset();
});

function LensPage() {
  const ref = useRef<HTMLDivElement | null>(null);
  useLiveDock(ref, "lens");
  return <div ref={ref} />;
}

describe("FloatingScore", () => {
  it("a button named with the score; a tap opens the sheet", () => {
    const onOpen = vi.fn();
    render(<FloatingScore match={LIVE} now={0} onOpen={onOpen} storageKey="test" />);
    const drop = screen.getByRole("button", { name: "Manchester Piti 2, Orduña fc 1, minuto 23" });
    expect(drop).toHaveTextContent("2–1");
    fireEvent.click(drop);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("arrow keys hop between anchors and the spot is remembered per key; Home returns it", () => {
    render(<FloatingScore match={LIVE} now={0} onOpen={() => undefined} storageKey="test" />);
    const drop = screen.getByRole("button", { name: /Orduña fc 1/ });
    const float = drop.parentElement as HTMLElement;
    const x0 = float.style.getPropertyValue("--vd-fx");
    fireEvent.keyDown(drop, { key: "ArrowLeft" });
    expect(float.style.getPropertyValue("--vd-fx")).not.toBe(x0);
    expect(localStorage.getItem("vd-pos-test-movil")).toMatch(/"x":/);
    fireEvent.keyDown(drop, { key: "Home" });
    expect(float.style.getPropertyValue("--vd-fx")).toBe(x0);
    expect(localStorage.getItem("vd-pos-test-movil")).toBeNull();
  });

  it("desktop: rests where the page asks (top-right, or the bottom-right corner) and its hint opens towards the room", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("min-width: 1100px"), media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
    try {
      const { unmount } = render(<FloatingScore match={LIVE} now={0} onOpen={() => undefined} storageKey="a" />);
      let float = screen.getByRole("button", { name: /Orduña fc 1/ }).parentElement as HTMLElement;
      const W = document.documentElement.clientWidth || window.innerWidth;
      expect(float.style.getPropertyValue("--vd-fx")).toBe(`${W - 200 - 24}px`);
      expect(float.style.getPropertyValue("--vd-fy")).toBe("104px");
      expect(float.dataset.vdV).toBe("high");
      unmount();
      render(<FloatingScore match={LIVE} now={0} onOpen={() => undefined} storageKey="b" placement="bottom-right" />);
      float = screen.getByRole("button", { name: /Orduña fc 1/ }).parentElement as HTMLElement;
      expect(float.style.getPropertyValue("--vd-fx")).toBe(`${W - 200 - 24}px`);
      expect(float.style.getPropertyValue("--vd-fy")).toBe(`${window.innerHeight - 50 - 24}px`);
      expect(float.dataset.vdV).toBe("low");
      expect(float.dataset.vdH).toBe("right");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("steps aside while a page's lens shows the match", () => {
    render(
      <>
        <LensPage />
        <FloatingScore match={LIVE} now={0} onOpen={() => undefined} storageKey="test" />
      </>,
    );
    expect(screen.queryByRole("button", { name: /Orduña fc 1/ })).toBeNull();
  });

  it("pendiente del acta: no score", () => {
    render(<FloatingScore match={{ ...LIVE, state: "pendiente" }} now={0} onOpen={() => undefined} storageKey="test" />);
    const drop = screen.getByRole("button", { name: "Contra Orduña fc, pendiente del acta" });
    expect(drop).not.toHaveTextContent("2–1");
    expect(drop).toHaveTextContent("Pendiente del acta");
  });
});

describe("«Sacar el marcador»", () => {
  it("without Document Picture-in-Picture: the in-page glass window, closed by its button or Escape", async () => {
    const pip: ScorePip = await openScorePip();
    expect(pip.kind).toBe("inpage");
    const onClose = vi.fn();
    render(
      <PipWindow pip={pip} title="Manchester Piti contra Orduña fc" onClose={onClose}>
        <span>2–1</span>
      </PipWindow>,
    );
    const win = screen.getByRole("dialog", { name: "Manchester Piti contra Orduña fc" });
    expect(win).toHaveTextContent("2–1");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar la ventana" }));
    act(() => {
      fireEvent.keyDown(win, { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("with it: the score goes into the PiP window's document", async () => {
    const pipDoc = document.implementation.createHTMLDocument("pip");
    const fakeWin = { document: pipDoc, close: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as Window;
    const host = window as Window & { documentPictureInPicture?: { requestWindow: () => Promise<Window> } };
    host.documentPictureInPicture = { requestWindow: () => Promise.resolve(fakeWin) };
    try {
      const pip = await openScorePip();
      expect(pip.kind).toBe("document");
      render(
        <PipWindow pip={pip} title="Marcador" onClose={() => undefined}>
          <span>2–1</span>
        </PipWindow>,
      );
      // (another document's nodes: jest-dom's matchers only take this one's)
      expect(pipDoc.body.textContent).toBe("2–1");
      expect(pipDoc.title).toBe("Manchester Piti, marcador");
    } finally {
      delete host.documentPictureInPicture;
    }
  });
});
