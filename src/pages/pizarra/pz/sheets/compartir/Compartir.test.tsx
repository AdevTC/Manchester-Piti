// r14 «La pizarra» · Compartir: the three tabs, the cartel blocked under seven with «Ir al hueco», the video's
// states (B-PZ-10: stale when the speed changes after recording), the real QR and the fan view's switch.
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";

vi.mock("../../campo/PiCampo", () => ({ PiCampo: () => <div data-testid="campo" /> }));
vi.mock("firebase/firestore", async (orig) => ({ ...(await orig<typeof import("firebase/firestore")>()), getDoc: vi.fn(async () => ({ data: () => ({}) })) }));
vi.mock("./posterDraw", () => ({ posterBlob: vi.fn(async () => new Blob(["x"], { type: "image/png" })) }));
const fanCall = vi.fn(async (_d: unknown) => ({ data: { ok: true, token: "abcdefghijklmnopqrstuvwx" } }));
vi.mock("../../../../../lib/clubApi", () => ({ setBoardFanLink: (d: unknown) => fanCall(d) }));
// a recorder that finishes at once (the real recordClip drives it)
class FakeRec {
  state = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["v"]) });
    this.onstop?.();
  }
}
vi.mock("../../../v2/clip", async (orig) => {
  const real = await orig<typeof import("../../../v2/clip")>();
  return {
    ...real,
    clipSupport: () => ({ ok: true, mime: "video/webm", Recorder: FakeRec }),
    browserClock: { now: () => Date.now(), next: (cb: () => void) => window.setTimeout(cb, 16), cancel: (id: number) => window.clearTimeout(id) },
    drawClipFrame: () => 0,
  };
});

import { renderWithPz, fakeBoard, fakeWorld } from "../../store/testkit";
import { CompartirSheet } from "./Compartir";

const FULL = ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides"];

describe("Compartir", () => {
  it("blocks the cartel under seven and says which hole; with seven it can be shared", async () => {
    const { flush } = renderWithPz(<CompartirSheet layout="desktop" args={{}} />, { place: "siete" });
    expect(screen.getByRole("tab", { name: "El cartel", selected: true })).toBeTruthy();
    expect(screen.getByRole("note").textContent).toMatch(/Completa el siete para compartir \(6\/7\)/);
    expect(screen.getByRole("button", { name: /Ir al hueco del DC/ })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Compartir" }) as HTMLButtonElement).disabled).toBe(true);
    await flush();
  });

  it("the video: records with the app's clip export, and goes stale when the speed changes", async () => {
    vi.useFakeTimers();
    globalThis.URL.createObjectURL ??= () => "blob:x";
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ({})) as unknown as HTMLCanvasElement["getContext"]);
    Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", { configurable: true, value: () => ({ getTracks: () => [] }) });
    const lineup = { ...fakeBoard({ ids: FULL }).lineup };
    lineup.plays = [{ id: "p1", name: "Salida por Jordi", kind: "propia", frames: [{ players: {}, ball: { x: 50, y: 88 }, rivals: [], arrows: [] }, { players: {}, ball: { x: 50, y: 60 }, rivals: [], arrows: [] }] }];
    const { r } = renderWithPz(<CompartirSheet layout="desktop" args={{ tab: "video" }} />, { place: "siete", world: fakeWorld({ boards: [fakeBoard({ ids: FULL, lineup })] }) });
    fireEvent.click(screen.getByRole("button", { name: /Grabar el vídeo/ }));
    expect(screen.getByRole("progressbar", { name: /Grabando el vídeo/ })).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
    });
    expect(r.container.textContent).toMatch(/Listo · Salida por Jordi a 1×/);
    fireEvent.click(screen.getByRole("button", { name: "2×" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("alert").textContent).toMatch(/Lo grabaste a 1× y ahora está a 2×/);
    vi.useRealTimers();
  });

  it("Enlace y QR: a real QR, and the fan view switch calls setBoardFanLink", async () => {
    const { flush } = renderWithPz(<CompartirSheet layout="phone" args={{ tab: "enlace" }} />, { place: "siete", world: fakeWorld({ boards: [fakeBoard({ ids: FULL })] }) });
    expect(screen.getByRole("img", { name: /Código QR/ }).querySelector("path")?.getAttribute("d")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Vista para la afición/ }));
    await flush();
    await flush();
    expect(fanCall).toHaveBeenCalledWith({ boardId: "b1", on: true });
    expect(screen.getByRole("button", { name: /Copiar el enlace de la afición/ })).toBeTruthy();
  });
});
