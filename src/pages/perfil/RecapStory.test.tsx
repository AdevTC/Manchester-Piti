import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SeasonRecap } from "../../lib/derived/seasonRecap";

// «Tu temporada en 10 cromos»: the story viewer (keys, Escape, focus, sharing, reduced motion) and the
// Perfil › Temporada block. The canvas renderer is a mock (no canvas in jsdom); so is the download.

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, hash, className }: { children?: ReactNode; to: string; params?: Record<string, string>; hash?: string; className?: string }) => (
    <a className={className} href={(params ? to.replace(/\$(\w+)/g, (_, k: string) => params[k] ?? "") : to) + (hash ? "#" + hash : "")}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));
const draw = vi.hoisted(() => ({ recapCardBlob: vi.fn(async () => new Blob(["png"], { type: "image/png" })) }));
vi.mock("./recapDraw", () => draw);
const fx = vi.hoisted(() => ({ saveBlob: vi.fn() }));
vi.mock("./fxRuntime", async (orig) => ({ ...(await orig<typeof import("./fxRuntime")>()), saveBlob: fx.saveBlob }));

const { RecapStory } = await import("./RecapStory");
const { makeData, noIntro, setUrl, view } = await import("./testkit");

const RECAP: SeasonRecap = {
  seasonId: "t1",
  seasonName: "Temporada 1",
  partial: false,
  cards: [
    { kind: "portada", name: "ADRI", number: "10", season: "Temporada 1" },
    { kind: "goles", goals: 2, assists: 1, best: { matchId: "j1", label: "J1 · Rival j1", goals: 1, assists: 1 } },
    { kind: "cierre", season: "Temporada 1" },
  ],
};
const CTX = { theme: "dark" as const, shirt: { name: "ADRI", number: "10" } };
const live = () => document.getElementById("rc-live")?.textContent;
const key = (k: string, extra: KeyboardEventInit = {}) => fireEvent.keyDown(document.activeElement ?? document.body, { key: k, ...extra });

function Harness({ rm = false }: { rm?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      {open && <RecapStory recap={RECAP} ctx={CTX} rm={rm} onClose={() => setOpen(false)} />}
    </>
  );
}
const openStory = (rm = false) => {
  render(<Harness rm={rm} />);
  const opener = screen.getByRole("button", { name: "Abrir" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
};

beforeEach(() => {
  draw.recapCardBlob.mockClear();
  fx.saveBlob.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "canShare");
});

describe("RecapStory", () => {
  it("is a modal dialog that announces each cromo and moves with the arrow keys", () => {
    openStory();
    const dlg = screen.getByRole("dialog");
    expect(dlg.getAttribute("aria-modal")).toBe("true");
    expect(live()).toBe("Cromo 1 de 3: Portada");
    expect(screen.getByText("ADRI")).toBeTruthy();
    key("ArrowRight");
    expect(live()).toBe("Cromo 2 de 3: Goles y asistencias");
    expect(screen.getByText("J1 · Rival j1")).toBeTruthy();
    key("ArrowRight");
    key("ArrowRight");
    expect(live()).toBe("Cromo 3 de 3: Cierre");
    expect(screen.getByText("Gracias por la temporada")).toBeTruthy();
    key("ArrowLeft");
    expect(live()).toBe("Cromo 2 de 3: Goles y asistencias");
    fireEvent.click(screen.getByRole("button", { name: "Cromo anterior" }));
    expect(live()).toBe("Cromo 1 de 3: Portada");
    expect(screen.getByRole("button", { name: "Cromo anterior" })).toHaveAttribute("aria-disabled", "true");
  });

  it("a nav button that goes dead under the focus keeps it (aria-disabled, never dropped to the page)", () => {
    openStory();
    const next = screen.getByRole("button", { name: "Cromo siguiente" });
    next.focus();
    fireEvent.click(next);
    fireEvent.click(next);
    expect(live()).toBe("Cromo 3 de 3: Cierre");
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(next).not.toBeDisabled();
    expect(document.activeElement).toBe(next);
    // a press on the dead button does nothing
    fireEvent.click(next);
    expect(live()).toBe("Cromo 3 de 3: Cierre");
  });

  it("the porra's place is a Spanish ordinal, as on the PNG: «3.º»", () => {
    const porra: SeasonRecap = { ...RECAP, cards: [{ kind: "porra", rank: 3, of: 12, points: 1 }] };
    render(<RecapStory recap={porra} ctx={CTX} rm={false} onClose={() => {}} />);
    expect(screen.getByText(/^3\.º/)).toBeTruthy();
    expect(screen.getByText("punto")).toBeTruthy();
  });

  it("traps focus inside, closes on Escape and gives focus back to the opener", () => {
    const opener = openStory();
    const close = screen.getByRole("button", { name: "Cerrar tus cromos" });
    expect(document.activeElement).toBe(close);
    key("Tab", { shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cromo siguiente" }));
    key("Tab");
    expect(document.activeElement).toBe(close);
    key("Escape");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("downloads the cromo when the browser can't share files", async () => {
    openStory();
    fireEvent.click(screen.getByRole("button", { name: "Compartir" }));
    await waitFor(() => expect(fx.saveBlob).toHaveBeenCalledTimes(1));
    expect(fx.saveBlob.mock.calls[0][1]).toBe("temporada-1-01-portada.png");
    expect(draw.recapCardBlob).toHaveBeenCalledWith(RECAP.cards[0], CTX);
    expect(await screen.findByText("Cromo descargado · temporada-1-01-portada.png")).toBeTruthy();
  });

  it("shares the PNG through Web Share when it takes files (and a cancel downloads nothing)", async () => {
    const share = vi.fn(async (d: ShareData) => void d);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    openStory();
    fireEvent.click(screen.getByRole("button", { name: "Compartir" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const files = share.mock.calls[0][0].files ?? [];
    expect(files[0]?.name).toBe("temporada-1-01-portada.png");
    expect(files[0]?.type).toBe("image/png");
    expect(fx.saveBlob).not.toHaveBeenCalled();

    share.mockRejectedValueOnce(Object.assign(new Error("cancel"), { name: "AbortError" }));
    fireEvent.click(screen.getByRole("button", { name: "Compartir" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Compartir" })).toHaveAttribute("aria-disabled", "false"));
    expect(fx.saveBlob).not.toHaveBeenCalled();
  });

  it("falls back to the download when the share sheet refuses the file", async () => {
    Object.defineProperty(navigator, "share", { value: vi.fn(async () => Promise.reject(new Error("NotAllowedError"))), configurable: true });
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    openStory();
    fireEvent.click(screen.getByRole("button", { name: "Compartir" }));
    await waitFor(() => expect(fx.saveBlob).toHaveBeenCalledTimes(1));
  });

  it("«Descargar todas» saves every cromo, one by one", async () => {
    openStory();
    fireEvent.click(screen.getByRole("button", { name: "Descargar todas" }));
    await waitFor(() => expect(fx.saveBlob).toHaveBeenCalledTimes(3), { timeout: 3000 });
    expect(fx.saveBlob.mock.calls.map((c) => c[1])).toEqual(["temporada-1-01-portada.png", "temporada-1-02-goles.png", "temporada-1-03-cierre.png"]);
    expect(await screen.findByText("Guardados los 3 cromos")).toBeTruthy();
  });

  it("draws the cromo again when the recap changes while open (no stale image under the new name)", async () => {
    const { rerender } = render(<RecapStory recap={RECAP} ctx={CTX} rm={false} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Compartir" }));
    await waitFor(() => expect(fx.saveBlob).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Compartir" })).toHaveAttribute("aria-disabled", "false"));
    const later: SeasonRecap = { ...RECAP, cards: [{ kind: "portada", name: "ADRI", number: "7", season: "Temporada 1" }, ...RECAP.cards.slice(1)] };
    rerender(<RecapStory recap={later} ctx={CTX} rm={false} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Compartir" }));
    await waitFor(() => expect(fx.saveBlob).toHaveBeenCalledTimes(2));
    expect(draw.recapCardBlob).toHaveBeenLastCalledWith(later.cards[0], CTX);
  });

  it("«Descargar todas» stops when the story closes", async () => {
    openStory();
    fireEvent.click(screen.getByRole("button", { name: "Descargar todas" }));
    key("Escape");
    expect(screen.queryByRole("dialog")).toBeNull();
    await new Promise((r) => window.setTimeout(r, 900));
    expect(fx.saveBlob).not.toHaveBeenCalled();
  });

  it("keeps its toast inside the dialog, one polite region", async () => {
    openStory();
    fireEvent.click(screen.getByRole("button", { name: "Compartir" }));
    const toast = await screen.findByText("Cromo descargado · temporada-1-01-portada.png");
    const dlg = screen.getByRole("dialog");
    expect(dlg.contains(toast)).toBe(true);
    expect(dlg.querySelectorAll('[role="status"]').length).toBe(1);
    expect(toast.closest("[aria-live]")).toBeNull();
  });

  it("with reduced motion nothing slides and nothing advances on its own", () => {
    vi.useFakeTimers();
    openStory(true);
    expect(document.querySelector(".rc-card")?.classList.contains("rc-anim")).toBe(false);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(live()).toBe("Cromo 1 de 3: Portada");
  });

  it("without reduced motion the cromo animates in, and still waits for the member", () => {
    vi.useFakeTimers();
    openStory(false);
    expect(document.querySelector(".rc-card")?.classList.contains("rc-anim")).toBe(true);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(live()).toBe("Cromo 1 de 3: Portada");
  });
});

describe("Perfil › Temporada › «Tu temporada en 10 cromos»", () => {
  beforeEach(() => {
    noIntro();
    setUrl("#temporada");
  });

  it("is not there without a recap", () => {
    view(makeData({ recap: null }));
    expect(screen.queryByRole("heading", { name: "Tu temporada en 10 cromos" })).toBeNull();
  });

  it("shows for a closed season, without «hasta ahora», and opens the story", () => {
    view(makeData({ recap: { status: "closed", recap: RECAP } }));
    expect(screen.getByRole("heading", { name: "Tu temporada en 10 cromos" })).toBeTruthy();
    expect(screen.queryByText("Hasta ahora")).toBeNull();
    const open = screen.getByRole("button", { name: "Ver mis cromos" });
    open.focus();
    fireEvent.click(open);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(window.location.hash).toBe("#cromos");
    key("Escape");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.location.hash).toBe("#temporada");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ver mis cromos" }));
  });

  it("is labelled «hasta ahora» while the season is still going", () => {
    view(makeData({ recap: { status: "partial", recap: { ...RECAP, partial: true } } }));
    expect(screen.getByText("Hasta ahora")).toBeTruthy();
    expect(screen.getByText(/hasta ahora en 3 cromos/)).toBeTruthy();
  });

  it("stays hidden for a member without a linked ficha", () => {
    view(makeData({ state: "pendiente", recap: { status: "closed", recap: RECAP } }));
    expect(screen.queryByRole("heading", { name: "Tu temporada en 10 cromos" })).toBeNull();
  });

  it("opens with the story up from /profile#cromos (the vestuario's banner)", () => {
    setUrl("#cromos");
    view(makeData({ recap: { status: "closed", recap: RECAP } }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(live()).toBe("Cromo 1 de 3: Portada");
  });
});
