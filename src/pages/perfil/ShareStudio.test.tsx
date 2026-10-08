import { act, fireEvent, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeData, noIntro, setUrl, view } from "./testkit";

// The share studio as a member uses it: opened from the hero's CTA, a sheet over the page (focus in and
// back, Escape / backdrop / ×, no page scroll), its three choices, the preview, «Descargar imagen»,
// «Compartir» and «Copiar enlace». The PNG itself is drawn by shareDraw (canvas; covered by its layout
// tests): here it is a fake blob, so no canvas runs in jsdom.

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, className }: { children?: ReactNode; to: string; className?: string }) => (
    <a className={className} href={to}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));
const { shareBlob } = vi.hoisted(() => ({ shareBlob: vi.fn(async (_spec: unknown): Promise<Blob | null> => new Blob(["png"], { type: "image/png" })) }));
vi.mock("./shareDraw", () => ({ shareBlob }));

const clicks: string[] = [];
const nav = navigator as Navigator & Record<string, unknown>;
const setNav = (k: string, v: unknown) => Object.defineProperty(navigator, k, { configurable: true, writable: true, value: v });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setUrl("");
  noIntro();
  clicks.length = 0;
  shareBlob.mockClear();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push(this.download);
  });
  URL.createObjectURL = vi.fn(() => "blob:fake");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const k of ["share", "canShare", "clipboard"]) delete nav[k];
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
});

const dialog = () => screen.getByRole("dialog", { name: /Compartir mi/ });
const open = (name: RegExp) => {
  const cta = screen.getByRole("button", { name });
  cta.focus();
  fireEvent.click(cta);
  return cta;
};

describe("el estudio: abrir y cerrar", () => {
  it("«Compartir mi carta» abre la hoja; Escape la cierra y el foco vuelve al botón", () => {
    view();
    const cta = open(/Compartir mi carta/);
    const d = dialog();
    expect(d).toHaveAttribute("aria-modal", "true");
    expect(within(d).getByRole("heading", { name: /Compartir mi carta/ })).toBeInTheDocument();
    expect(document.activeElement).toBe(within(d).getByRole("button", { name: "Cerrar el estudio" }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(cta);
    expect(document.body.style.overflow).toBe("");
  });

  it("× y el fondo también la cierran", () => {
    view();
    open(/Compartir mi carta/);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cerrar el estudio" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    open(/Compartir mi carta/);
    fireEvent.click(document.querySelector(".pc-shm-bg") as HTMLElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Tab no sale de la hoja", () => {
    view();
    open(/Compartir mi carta/);
    const d = dialog();
    const buttons = within(d).getAllByRole("button").filter((b) => !b.hasAttribute("disabled"));
    const last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});

describe("el estudio: diseño, formato y cara", () => {
  it("vinculada: Mi carta (frente / dorso) o ¡Ya es oficial!, en historia o post", () => {
    view();
    open(/Compartir mi carta/);
    const d = dialog();
    expect(within(d).getByText("Elige diseño, formato y cara: se descarga tal cual la ves.")).toBeInTheDocument();
    const pv = within(d).getByRole("img", { name: /^Vista previa \(historia 9:16\): tu carta/ });
    expect(pv).toHaveClass("pv");
    expect(pv).toHaveTextContent("Mi carta · T1");
    fireEvent.click(within(d).getByRole("button", { name: /Post/ }));
    expect(within(d).getByRole("img", { name: /^Vista previa \(post 4:5\)/ })).toHaveClass("post");
    fireEvent.click(within(d).getByRole("button", { name: /Dorso/ }));
    const back = within(d).getByRole("img", { name: /el dorso de tu carta, carné de socio con QR/ });
    expect(back).toHaveClass("bk");
    expect(back.querySelector(".cd")).toHaveClass("flipped");
    expect(back).toHaveTextContent("Socio del club");
    expect(within(d).getByText(/El dorso lleva el QR a tu página pública/)).toBeInTheDocument();
    fireEvent.click(within(d).getByRole("button", { name: /Ya es oficial/ }));
    expect(within(d).queryByRole("group", { name: "Cara" })).not.toBeInTheDocument();
    const po = within(d).getByRole("img", { name: "Vista previa del póster (post 4:5): ¡Ya es oficial! ADRI, dorsal 10, Delantero" });
    expect(po).toHaveClass("po", "post", "ok");
    expect(po).toHaveTextContent("¡YA ESOFICIAL!");
    expect(po.querySelector(".po-nm")).toHaveTextContent("ADRIDORSAL 10 · DELANTERO");
    expect(po.querySelector(".po-ft")).toHaveTextContent("10PRESENTADO ELSEP 2026");
    expect(within(d).getByText("El póster no lleva tu correo ni tu id: solo lo que ves.")).toBeInTheDocument();
  });

  it("pendiente: «Mi póster», Mi carta desactivada y la nota de lo que cambia", () => {
    view(makeData({ state: "pendiente" }));
    open(/^Mi póster$/);
    const d = screen.getByRole("dialog", { name: /Compartir mi póster/ });
    expect(within(d).getByRole("button", { name: /Mi carta/ })).toBeDisabled();
    expect(within(d).getByRole("button", { name: /Ya es oficial/ })).toHaveAttribute("aria-pressed", "true");
    const po = within(d).getByRole("img", { name: "Vista previa del póster (historia 9:16): Fichaje en trámite: @adrian_tc pide el 9" });
    expect(po.querySelector(".po-vb")).toHaveClass("warn", "long");
    expect(po).toHaveTextContent("PIDE EL 9 · EN REVISIÓN");
    expect(po.querySelector(".tee")).toHaveClass("blank");
    expect(within(d).getByText(/Mientras el capitán confirma tu ficha/)).toBeInTheDocument();
  });

  it("sin ficha: «Mi póster de socio», nuevo socio sin dorsal", () => {
    view(makeData({ state: "sin-ficha" }));
    open(/Mi póster de socio/);
    const d = screen.getByRole("dialog", { name: /Compartir mi póster/ });
    const po = within(d).getByRole("img", { name: /Nuevo socio: @adrian_tc, sin dorsal todavía/ });
    expect(po.querySelector(".po-vb")).toHaveClass("off");
    expect(po).toHaveTextContent("SIN DORSAL TODAVÍA");
    expect(within(d).getByText(/Sin ficha, el póster te presenta como nuevo socio/)).toBeInTheDocument();
  });
});

describe("el estudio: descargar, compartir, copiar", () => {
  it("«Descargar imagen»: el PNG de lo que ves, carta-{slug}.png, el escaneo y el aviso", async () => {
    view();
    open(/Compartir mi carta/);
    const d = dialog();
    await act(async () => {
      fireEvent.click(within(d).getByRole("button", { name: /Descargar imagen/ }));
    });
    expect(shareBlob).toHaveBeenCalledWith(expect.objectContaining({ design: "carta", format: "historia", face: "frente", season: "T1" }));
    const spec = JSON.stringify(shareBlob.mock.calls.at(-1));
    expect(spec).not.toMatch(/adrian@example\.com|"u1"/);
    expect(clicks).toEqual(["carta-adri.png"]);
    expect(within(d).getByRole("img", { name: /Vista previa/ })).toHaveClass("sa");
    expect(await screen.findByText("Imagen guardada · carta-adri.png", {}, { timeout: 2000 })).toBeInTheDocument();
    expect(within(d).getByRole("button", { name: /Descargada · otra vez/ })).toBeInTheDocument();
    fireEvent.click(within(d).getByRole("button", { name: /Ya es oficial/ }));
    await act(async () => {
      fireEvent.click(within(d).getByRole("button", { name: /Descargada · otra vez/ }));
    });
    expect(clicks).toEqual(["carta-adri.png", "oficial-adri.png"]);
    expect(within(d).getByRole("img", { name: /Vista previa del póster/ })).toHaveClass("sb");
  });

  it("si el navegador no puede dibujarla, lo dice (icono + texto)", async () => {
    shareBlob.mockResolvedValueOnce(null);
    view();
    open(/Compartir mi carta/);
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole("button", { name: /Descargar imagen/ }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("No se ha podido preparar la imagen");
    expect(clicks).toEqual([]);
  });

  it("«Compartir» manda la imagen con el enlace a tu página al menú del móvil", async () => {
    const share = vi.fn(async () => undefined);
    setNav("share", share);
    setNav("canShare", () => true);
    view();
    open(/Compartir mi carta/);
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole("button", { name: /^Compartir$/ }));
    });
    expect(share).toHaveBeenCalledTimes(1);
    const data = (share.mock.calls[0] as unknown as [ShareData])[0];
    expect(data.url).toBe("https://manchesterpiti.test/jugadores/adri");
    expect(data.files?.[0].name).toBe("carta-adri.png");
    expect(data.title).toBe("ADRI · Manchester Piti");
    expect(screen.getByText("Imagen enviada al menú de compartir")).toBeInTheDocument();
  });

  it("cerrar el menú de compartir no es un error", async () => {
    setNav("share", async () => {
      throw new DOMException("cancelado", "AbortError");
    });
    setNav("canShare", () => true);
    view();
    open(/Compartir mi carta/);
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole("button", { name: /^Compartir$/ }));
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: /Copiar enlace/ })).toBeInTheDocument();
  });

  it("«Copiar enlace»: tu página; sin portapapeles, el enlace seleccionado para copiarlo a mano", async () => {
    const writeText = vi.fn(async () => undefined);
    setNav("clipboard", { writeText });
    view();
    open(/Compartir mi carta/);
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole("button", { name: /Copiar enlace/ }));
    });
    expect(writeText).toHaveBeenCalledWith("https://manchesterpiti.test/jugadores/adri");
    expect(within(dialog()).getByRole("button", { name: /^Copiado$/ })).toBeInTheDocument();
    expect(screen.getByText("Enlace a tu página copiado")).toBeInTheDocument();

    setNav("clipboard", {
      writeText: async () => {
        throw new Error("no");
      },
    });
    document.execCommand = vi.fn(() => false);
    fireEvent.click(within(dialog()).getByRole("button", { name: /^Copiado$/ }));
    const input = await within(dialog()).findByLabelText("Enlace para compartir");
    expect(input).toHaveValue("https://manchesterpiti.test/jugadores/adri");
    expect(screen.getByRole("alert")).toHaveTextContent("cópialo a mano");
  });

  it("sin ficha el enlace es el del club", async () => {
    const writeText = vi.fn(async () => undefined);
    setNav("clipboard", { writeText });
    view(makeData({ state: "sin-ficha" }));
    open(/Mi póster de socio/);
    await act(async () => {
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Copiar enlace/ }));
    });
    expect(writeText).toHaveBeenCalledWith("https://manchesterpiti.test/");
    expect(screen.getByText("Enlace al club copiado")).toBeInTheDocument();
  });
});
