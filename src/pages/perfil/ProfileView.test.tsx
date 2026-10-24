import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileView } from "./ProfileView";
import type { PlayerPositions } from "../../lib/positionStats";
import type { Achievement } from "../../lib/derived/achievements";
import { DAY, fakeActions, heroCard, makeData, noIntro, root, setUrl, view } from "./testkit";

// /profile «La carta» as a member drives it: no Firebase (the data and the callables are fakes), no
// router (links are plain anchors), no WebGL anywhere (the card is drawn in CSS).

// (the Link stub builds the href the router would: params into the path, the search as a query)
const hrefOf = (to: string, params: Record<string, string> = {}, search: Record<string, string | undefined> = {}) => {
  const q = new URLSearchParams(Object.entries(search).filter((e): e is [string, string] => e[1] !== undefined)).toString();
  return to.replace(/\$(\w+)/g, (_, k: string) => params[k] ?? "") + (q ? `?${q}` : "");
};
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, search, className }: { children?: ReactNode; to: string; params?: Record<string, string>; search?: Record<string, string | undefined>; className?: string }) => (
    <a className={className} href={hrefOf(to, params, search)}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setUrl("");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("el menú: pestañas", () => {
  it("roving tabindex y ←/→/Inicio/Fin; el hash sigue a la pestaña", () => {
    noIntro();
    view();
    const list = screen.getByRole("tablist", { name: "Secciones de tu perfil" });
    const tabs = within(list).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["01Tu carta", "02Temporada", "03Avisos", "04Ajustes", "05Cuenta"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Temporada/ })).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: /Temporada/ }));
    expect(window.location.pathname).toBe("/perfil/temporada");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName(/Temporada/);
    expect(screen.getByText("02 / 05")).toBeInTheDocument();
    fireEvent.keyDown(list, { key: "End" });
    expect(screen.getByRole("tab", { name: /Cuenta/ })).toHaveAttribute("aria-selected", "true");
    expect(window.location.pathname).toBe("/perfil/cuenta");
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Tu carta/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: /Cuenta/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(list, { key: "Home" });
    expect(screen.getByRole("tab", { name: /Tu carta/ })).toHaveAttribute("aria-selected", "true");
  });

  it("el panel entra desde el lado hacia el que te mueves; ← → en escritorio", () => {
    noIntro();
    const { container } = view();
    fireEvent.click(screen.getByRole("button", { name: "Pestaña siguiente" }));
    expect(container.querySelector(".pn")).toHaveClass("from-r");
    fireEvent.click(screen.getByRole("button", { name: "Pestaña anterior" }));
    expect(container.querySelector(".pn")).toHaveClass("from-l");
    expect(screen.getByRole("tab", { name: /Tu carta/ })).toHaveAttribute("aria-selected", "true");
  });

  it("un enlace con #temporada abre esa pestaña", () => {
    noIntro();
    setUrl("#temporada");
    view();
    expect(screen.getByRole("tab", { name: /Temporada/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Tus números" })).toBeInTheDocument();
  });

  it("Capitanía solo para los capitanes, en oro y con las peticiones de la puerta", () => {
    noIntro();
    setUrl("#capitania");
    const { unmount } = view(makeData());
    expect(screen.queryByRole("tab", { name: /Capitanía/ })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Tu carta/ })).toHaveAttribute("aria-selected", "true");
    unmount();
    setUrl("#capitania");
    view(makeData({ captain: true, doors: 2 }));
    const cap = screen.getByRole("tab", { name: /Capitanía/ });
    expect(cap).toHaveClass("gold");
    expect(cap).toHaveAttribute("aria-selected", "true");
    expect(within(cap).getByText("2")).toHaveClass("bd");
    expect(screen.getByText("06 / 06")).toBeInTheDocument();
  });
});

describe("la carta viva", () => {
  it("«Ver el dorso» y un toque giran la carta (aria-pressed, etiquetas)", () => {
    noIntro();
    const { container } = view();
    const card = heroCard(container);
    // This historical fixture has goals but no minutes or narrated actions: keep its
    // totals while withholding a season rating instead of manufacturing one.
    expect(card).toHaveAccessibleName(/^Tu carta: GLOBAL pendiente, Delantero, dorsal 10 con «ADRI» a la espalda/);
    expect(card).toHaveAccessibleName(/GOL 2, MVP 0, ASI 0, PJ 2, MIN —/);
    expect(card).toHaveAccessibleName(/Toca para ver el dorso\.$/);
    const btn = screen.getByRole("button", { name: "Ver el dorso" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(card).toHaveClass("flipped");
    expect(screen.getByRole("button", { name: "Ver el frente" })).toHaveAttribute("aria-pressed", "true");
    expect(card).toHaveAccessibleName(/Mostrando el dorso: tu carné de socio/);
    fireEvent.click(card);
    expect(card).not.toHaveClass("flipped");
    // the back: the carné with the QR to the public page
    expect(container.querySelector(".cbk-qr small")).toHaveTextContent("/jugadores/adri");
    expect(container.querySelector(".cbk .dl")).toHaveTextContent("Socio desdesep 2026");
  });

  it("el capitán lleva el brazalete «C» y «· CAPITÁN» en el videomarcador", () => {
    noIntro();
    const { container } = view(makeData({ captain: true }));
    expect(container.querySelector(".cf-cap")).toHaveTextContent("C");
    expect(screen.getByText(/^Videomarcador:/)).toHaveTextContent("Videomarcador: ¡YA ES OFICIAL! · ADRI · DORSAL 10 · DELANTERO · CAPITÁN");
    expect(screen.getByText("Capitán", { selector: ".role" })).toBeInTheDocument();
  });
});

describe("la salida de la carta", () => {
  it("se ve una vez por sesión; «Saltar» la termina; dura 3,4 s", () => {
    vi.useFakeTimers();
    const first = view();
    expect(root(first.container)).toHaveClass("intro");
    const skip = screen.getByRole("button", { name: /Saltar/ });
    fireEvent.click(skip);
    expect(root(first.container)).toHaveClass("done");
    expect(screen.queryByRole("button", { name: /Saltar/ })).not.toBeInTheDocument();
    first.unmount();
    // same session: the card is already there
    const again = view();
    expect(root(again.container)).toHaveClass("done");
    again.unmount();
    // «Cada vez»: plays again, and ends by itself at 3.4 s
    localStorage.setItem("mp_perfil_prefs", JSON.stringify({ intro: "siempre", tilt: true }));
    const always = view();
    expect(root(always.container)).toHaveClass("intro");
    act(() => {
      vi.advanceTimersByTime(3399);
    });
    expect(root(always.container)).toHaveClass("intro");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(root(always.container)).toHaveClass("done");
  });

  it("un toque en el escenario la salta (y no gira la carta)", () => {
    const { container } = view();
    expect(root(container)).toHaveClass("intro");
    fireEvent.click(heroCard(container));
    expect(root(container)).toHaveClass("done");
    expect(heroCard(container)).not.toHaveClass("flipped");
  });

  it("con «reducir movimiento» no hay salida: el cuadro final", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
    const { container } = view();
    expect(root(container)).toHaveClass("done");
    expect(screen.queryByRole("button", { name: /Saltar/ })).not.toBeInTheDocument();
    // ↻ does nothing either
    fireEvent.click(screen.getByRole("button", { name: "Repetir la salida de la carta" }));
    expect(root(container)).toHaveClass("done");
  });

  it("↻ la repite", () => {
    vi.useFakeTimers();
    noIntro();
    const { container } = view();
    expect(root(container)).toHaveClass("done");
    fireEvent.click(screen.getByRole("button", { name: "Repetir la salida de la carta" }));
    act(() => {
      vi.advanceTimersByTime(40);
    });
    expect(root(container)).toHaveClass("intro");
  });
});

describe("estados: CTAs y videomarcador", () => {
  it("vinculada: «Compartir mi carta», «Ver el dorso» + ↻", () => {
    noIntro();
    view();
    expect(screen.getByText(/^Videomarcador:/)).toHaveTextContent("Videomarcador: ¡YA ES OFICIAL! · ADRI · DORSAL 10 · DELANTERO");
    expect(screen.getByRole("button", { name: "Ver el dorso" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Compartir mi carta/ })).toHaveClass("btn", "gold", "first");
    expect(screen.getByText("Toca la carta para girarla · muévela para ver el brillo")).toBeInTheDocument();
    expect(screen.queryByText(/aún no ha empezado/)).not.toBeInTheDocument();
  });

  it("pendiente: sobre cerrado, «Ver mi petición» y «Cancelar»", async () => {
    noIntro();
    const actions = fakeActions();
    const { container } = view(makeData({ state: "pendiente" }), actions);
    expect(screen.getByText(/^Videomarcador:/)).toHaveTextContent("Videomarcador: FICHAJE EN TRÁMITE · @ADRIAN_TC PIDE EL 9 · EL CAPITÁN LO REVISA");
    expect(container.querySelector(".vb")).toHaveClass("warn");
    expect(heroCard(container)).toHaveAccessibleName("Sobre cerrado con la carta del 9, esperando al capitán. Toca para ver tu petición.");
    expect(container.querySelector(".seal")).toHaveTextContent("Esperandoal capitánDORSAL 9");
    expect(within(container.querySelector(".cta") as HTMLElement).getByRole("button", { name: "Ver mi petición" })).toBeInTheDocument();
    const cancel = within(container.querySelector(".cta") as HTMLElement).getByRole("button", { name: "Cancelar" });
    await act(async () => {
      fireEvent.click(cancel);
    });
    expect(actions.cancelClaim).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Petición cancelada")).toBeInTheDocument();
    // Tu nombre is locked until the captain says yes
    expect(screen.getByLabelText("Lo que va a tu espalda")).toBeDisabled();
    expect(screen.getByText(/tu ficha del 9, eliges lo que va en tu espalda/)).toBeInTheDocument();
  });

  it("sin ficha: carta por revelar y «Reclamar mi ficha» lleva al selector", async () => {
    noIntro();
    const actions = fakeActions();
    const { container } = view(makeData({ state: "sin-ficha" }), actions);
    expect(screen.getByText(/^Videomarcador:/)).toHaveTextContent("Videomarcador: SIN DORSAL TODAVÍA · @ADRIAN_TC · RECLAMA TU FICHA");
    expect(container.querySelector(".vb")).toHaveClass("off");
    expect(heroCard(container)).toHaveAccessibleName("Carta por revelar. Toca para elegir tu dorsal.");
    expect(within(container.querySelector(".cta") as HTMLElement).getByRole("button", { name: "Reclamar mi ficha" })).toBeInTheDocument();
    const pick = screen.getByRole("button", { name: "ILLESCAS, dorsal 4, Defensa" });
    fireEvent.click(pick);
    expect(pick).toHaveAttribute("aria-pressed", "true");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pedir la carta del 4" }));
    });
    expect(actions.requestClaim).toHaveBeenCalledWith("illescas");
    expect(screen.getByText("Petición enviada al capitán")).toBeInTheDocument();
  });

  it("temporada sin empezar: «—», se revela en la J1 y el aviso de ejemplo", () => {
    noIntro();
    const { container } = view(makeData({ started: false }));
    expect(container.querySelector(".cf-rt")).toHaveTextContent("—");
    expect(screen.getByText("Por estrenar")).toHaveClass("tier");
    expect(screen.getByText(/^Se revela en la J1, el .* contra MAD SKY\.$/)).toBeInTheDocument();
    expect(container.querySelector(".cf-club")).toHaveTextContent("SE REVELA EN LA J1");
    expect(screen.getByText("La Temporada 1 aún no ha empezado: tus números salen en la J1")).toHaveClass("ex");
    expect(screen.getByText(/^Videomarcador:/)).toHaveTextContent("Videomarcador: ¡YA ES OFICIAL! · ADRI · DORSAL 10 · DELANTERO");
  });

  it("la captura del capitán mientras miras: la carta se revela", () => {
    noIntro();
    const actions = fakeActions();
    const { rerender, container } = render(<ProfileView data={makeData({ state: "pendiente", playerId: "adri" })} actions={actions} now={0} origin="" />);
    expect(container.querySelector(".cd")).toHaveClass("pack");
    rerender(<ProfileView data={makeData()} actions={actions} now={0} origin="" />);
    expect(container.querySelector(".cd")).not.toHaveClass("pack");
    expect(root(container)).toHaveClass("intro");
    expect(screen.getByText("¡Carta revelada! Tu ficha está vinculada")).toBeInTheDocument();
  });
});

describe("Tu nombre · A «En la espalda»", () => {
  const input = () => screen.getByLabelText("Lo que va a tu espalda") as HTMLInputElement;
  const type = (v: string) => fireEvent.change(input(), { target: { value: v } });
  const msg = () => document.getElementById("pe-shirt-v") as HTMLElement;

  it("comprueba al escribir, en mayúsculas, con el tamaño de la letra", () => {
    noIntro();
    const { container } = view();
    expect(msg()).toHaveTextContent("Es lo que llevas ahora");
    expect(screen.getByRole("button", { name: "Estampar" })).toBeDisabled();
    type("ad1");
    expect(input().value).toBe("AD1");
    expect(msg()).toHaveTextContent("Sin números: el dorsal ya va debajo");
    expect(input()).toHaveAttribute("aria-invalid", "true");
    type("érik");
    expect(msg()).toHaveTextContent("Ya la lleva el 9 (ERIK): elige otro");
    type("a");
    expect(msg()).toHaveTextContent("Mínimo 2 caracteres");
    type("ABCDEFGHIJKLM");
    expect(msg()).toHaveTextContent("Máximo 12 caracteres: no cabe en la espalda");
    expect(container.querySelector(".es-fit small")).toHaveTextContent("No cabe");
    type("adri tello");
    expect(input().value).toBe("ADRI TELLO");
    expect(msg()).toHaveTextContent("Libre: así quedará a tu espalda");
    expect(container.querySelector(".es-fit small")).toHaveTextContent("Letra estrecha");
    expect(container.querySelector(".es-prev .tee-n")).toHaveClass("n3");
    expect(screen.getByRole("button", { name: "Estampar" })).toBeEnabled();
  });

  it("Estampar: la plancha en la carta, el aviso y 6 s para deshacer", async () => {
    vi.useFakeTimers();
    noIntro();
    const actions = fakeActions();
    const { container } = view(makeData(), actions);
    type("tello");
    const stamp = screen.getByRole("button", { name: "Estampar" });
    await act(async () => {
      fireEvent.click(stamp);
      fireEvent.click(stamp);
    });
    // never twice
    expect(actions.setShirtName).toHaveBeenCalledTimes(1);
    expect(actions.setShirtName).toHaveBeenCalledWith("TELLO");
    // the card keeps the old name until the press lands (phones: after the scroll, 700 ms)
    expect(container.querySelector(".cf-nm")).toHaveTextContent("ADRI");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(container.querySelector(".cf-nm")).toHaveTextContent("TELLO");
    expect(heroCard(container)).toHaveClass("st-a");
    expect(screen.getByText("Estampado", { exact: false, selector: ".undo-t span" })).toHaveTextContent("Estampado TELLO");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1900);
    });
    expect(screen.getByText("Estampado: así sale ya en tu ficha")).toBeInTheDocument();
    // Deshacer (in the strip under the card)
    await act(async () => {
      fireEvent.click(within(container.querySelector(".undo") as HTMLElement).getByRole("button", { name: "Deshacer" }));
    });
    expect(actions.setShirtName).toHaveBeenLastCalledWith("ADRI");
    expect(container.querySelector(".cf-nm")).toHaveTextContent("ADRI");
    expect(heroCard(container)).toHaveClass("st-b");
    expect(container.querySelector(".undo")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1900);
    });
    expect(screen.getByText("Deshecho: vuelve «ADRI» a tu espalda")).toBeInTheDocument();
  });

  it("la ventana de deshacer se cierra a los 6 s", async () => {
    vi.useFakeTimers();
    noIntro();
    const { container } = view();
    type("tello");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Estampar" }));
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(container.querySelector(".undo")).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "Deshacer" })).toHaveLength(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5999);
    });
    expect(container.querySelector(".undo")).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(container.querySelector(".undo")).toBeNull();
    expect(screen.queryByRole("button", { name: "Deshacer" })).not.toBeInTheDocument();
  });

  it("un error del servidor sale en la línea, con icono; sin conexión, también", async () => {
    vi.useFakeTimers();
    noIntro();
    const actions = fakeActions({ setShirtName: vi.fn(async () => Promise.reject(Object.assign(new Error("Ya la lleva el 7 (ALMACHI): elige otro"), { code: "functions/already-exists" }))) });
    const { container } = view(makeData(), actions);
    type("almachi");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Estampar" }));
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(msg()).toHaveTextContent("Ya la lleva el 7 (ALMACHI): elige otro");
    expect(msg()).toHaveClass("bad");
    expect(msg().querySelector("svg")).not.toBeNull();
    expect(container.querySelector(".cf-nm")).toHaveTextContent("ADRI");
    expect(heroCard(container)).not.toHaveClass("st-a");
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    type("almachis");
    fireEvent.click(screen.getByRole("button", { name: "Estampar" }));
    expect(msg()).toHaveTextContent("Sin conexión");
    expect(actions.setShirtName).toHaveBeenCalledTimes(1);
  });
});

describe("Tu nombre · B «Tu apodo»", () => {
  const input = () => screen.getByLabelText("Apodo del vestuario") as HTMLInputElement;
  const msg = () => document.getElementById("pe-nick-v") as HTMLElement;

  it("quita mayúsculas, tildes y espacios; «Comprobando…» y luego ocupado", async () => {
    vi.useFakeTimers();
    noIntro();
    const actions = fakeActions({ nicknameTaken: vi.fn(async () => true) });
    view(makeData(), actions);
    expect(msg()).toHaveTextContent("Es tu apodo de ahora");
    fireEvent.change(input(), { target: { value: "Iñaki Pérez" } });
    expect(input().value).toBe("inakiperez");
    expect(screen.getByText("Sin mayúsculas, tildes ni espacios: los quitamos al escribir (ñ pasa a n).")).toBeInTheDocument();
    expect(msg()).toHaveTextContent("Comprobando si está libre…");
    expect(actions.nicknameTaken).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(actions.nicknameTaken).toHaveBeenCalledWith("inakiperez");
    expect(msg()).toHaveTextContent("Ya lo usa otro socio del vestuario");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    // the rules first: an invalid handle is never looked up
    fireEvent.change(input(), { target: { value: "ab" } });
    expect(msg()).toHaveTextContent("Mínimo 3 caracteres");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(actions.nicknameTaken).toHaveBeenCalledTimes(1);
  });

  it("libre → «Guardar» → aviso", async () => {
    vi.useFakeTimers();
    noIntro();
    const actions = fakeActions();
    view(makeData(), actions);
    fireEvent.change(input(), { target: { value: "adri_10" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(msg()).toHaveTextContent("Libre: así te verán en el vestuario");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    });
    expect(actions.setNickname).toHaveBeenCalledWith("adri_10");
    expect(screen.getByText("Guardado: ahora eres @adri_10")).toBeInTheDocument();
    expect(input().value).toBe("adri_10");
    expect(msg()).toHaveTextContent("Es tu apodo de ahora");
  });
});

describe("Temporada", () => {
  it("tus números de verdad y lo tuyo en el vestuario", () => {
    noIntro();
    setUrl("#temporada");
    const { container } = view();
    expect(container.querySelector(".sb .hero b")).toHaveTextContent("2");
    expect(screen.getByRole("img", { name: /^Goles por jornada: J1 1, J2 1$/ })).toBeInTheDocument();
    expect(screen.getByText(/^Temporada 1, de la J1 a la J2: lo mismo/)).toBeInTheDocument();
    expect(screen.getByText("Aún no tienes tableros: crea el primero")).toBeInTheDocument();
    expect(screen.getByText("Aún sin pronósticos esta temporada")).toBeInTheDocument();
  });
  it("sin ficha: el aviso y «Reclamar mi ficha»", () => {
    noIntro();
    setUrl("#temporada");
    view(makeData({ state: "sin-ficha" }));
    expect(screen.getByText(/Reclama tu ficha y aquí salen tus goles/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver tus estadísticas/ })).toBeNull();
  });
  it("«Ver tus estadísticas» lleva a su página pública, en la temporada; «Dónde has jugado», a las posiciones del equipo", () => {
    noIntro();
    setUrl("#temporada");
    view();
    const numbers = screen.getByRole("heading", { name: "Tus números" }).closest(".bk") as HTMLElement;
    expect(within(numbers).getByRole("link", { name: /Ver tus estadísticas/ })).toHaveAttribute("href", "/jugadores/adri?season=t1");
    const where = screen.getByRole("heading", { name: "Dónde has jugado" }).closest(".bk") as HTMLElement;
    expect(within(where).getByRole("link", { name: /Ver las posiciones del equipo/ })).toHaveAttribute("href", "/numeros/campo/puestos?temporada=t1");
  });
  it("pendiente: aún sin enlace a sus estadísticas", () => {
    noIntro();
    setUrl("#temporada");
    view(makeData({ state: "pendiente" }));
    expect(screen.queryByRole("link", { name: /Ver tus estadísticas/ })).toBeNull();
  });
});

describe("Temporada › Tus logros", () => {
  const won: Achievement = { id: "debut", family: "debut", tier: 0, label: "Debut", detail: "Tu primer partido", earned: true, at: { matchId: "j1", date: 10 * DAY + 18 * 3_600_000, rival: "Rival j1" } };
  const goals: Achievement = { id: "goles-1", family: "goles", tier: 1, label: "10 goles", detail: "Marca 10 goles", earned: false, progress: { now: 7, goal: 10 } };
  const zero: Achievement = { id: "cero", family: "cero", tier: 0, label: "Portería a cero", detail: "Gana sin encajar", earned: false };
  const logros = { list: [won, goals, zero], next: [goals] };

  it("va tras «Dónde has jugado»: lo ganado con su partido, lo próximo con «7 / 10» y el resto plegado", () => {
    noIntro();
    setUrl("#temporada");
    view(makeData({ logros }));
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings.indexOf("Tus logros")).toBe(headings.indexOf("Dónde has jugado") + 1);
    const box = screen.getByRole("heading", { name: "Tus logros" }).closest(".bk") as HTMLElement;
    expect(within(within(box).getByRole("list", { name: "Tus logros" })).getByRole("link", { name: "11 ene 1970 · vs Rival j1" })).toHaveAttribute("href", "/partidos/j1");
    expect(within(box).getByRole("region", { name: "Lo próximo" })).toHaveTextContent("7 / 10");
    expect(within(box).getByRole("region", { name: "Lo próximo" })).toHaveTextContent("Bronce");
    expect(box.querySelector("details.lg-all")).toHaveTextContent("Portería a cero");
  });
  it("sin ficha vinculada no sale", () => {
    noIntro();
    setUrl("#temporada");
    view(makeData({ state: "pendiente", logros }));
    expect(screen.queryByRole("heading", { name: "Tus logros" })).toBeNull();
  });
});

describe("Temporada › Dónde has jugado", () => {
  const PLAYED: PlayerPositions = {
    lines: [
      { code: "MI", minutes: 320, matches: 5, goals: 1, assists: 2, yellowCards: 0, redCards: 0, rating: 70 },
      { code: "MCD", minutes: 140, matches: 3, goals: 0, assists: 0, yellowCards: 0, redCards: 0, rating: 60 },
    ],
    minutes: 460,
    estimatedMatches: 0,
    matches: 6,
    top: "MI",
  };
  const MINE = { approved: { main: "MCD" as const, also: ["MC" as const] }, proposal: null, state: "aprobada" as const, inSeason: true };
  const section = () => screen.getByRole("heading", { name: "Dónde has jugado" }).closest(".bk") as HTMLElement;
  const nudge = () => within(section()).queryByRole("button", { name: /Has jugado más de/ });

  it("va justo después de «Tus números»: el mapa con sus minutos y la línea de resumen", () => {
    noIntro();
    setUrl("#temporada");
    view(makeData({ played: PLAYED, positions: MINE }));
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings.indexOf("Dónde has jugado")).toBe(headings.indexOf("Tus números") + 1);
    expect(within(section()).getByText("Minutos por posición esta temporada.")).toBeInTheDocument();
    expect(within(section()).getByRole("img", { name: /^Dónde has jugado en la Temporada 1\. Ha jugado de Interior izquierdo \(MI\)/ })).toBeInTheDocument();
    expect(within(section()).getByText("Interior izquierdo (MI) 320′ · MCD 140′")).toBeInTheDocument();
  });

  it("sin minutos con posición: lo dice claro, sin filas «0′» ni empujón", () => {
    noIntro();
    setUrl("#temporada");
    view(makeData({ positions: MINE }));
    expect(within(section()).getByText("Aún sin minutos con posición")).toBeInTheDocument();
    expect(section()).not.toHaveTextContent("0′");
    expect(nudge()).not.toBeInTheDocument();
  });

  it("solo con la ficha vinculada", () => {
    noIntro();
    setUrl("#temporada");
    const { unmount } = view(makeData({ state: "pendiente" }));
    expect(screen.queryByRole("heading", { name: "Dónde has jugado" })).not.toBeInTheDocument();
    unmount();
    view(makeData({ state: "sin-ficha" }));
    expect(screen.queryByRole("heading", { name: "Dónde has jugado" })).not.toBeInTheDocument();
  });

  it("el empujón cuando lo que más juega no es lo que tiene puesto; lleva a «Tus posiciones»", () => {
    noIntro();
    setUrl("#temporada");
    view(makeData({ played: PLAYED, positions: MINE }));
    const b = nudge();
    expect(b).toHaveTextContent("Has jugado más de MI que de lo que tienes puesto. ¿Lo añades en Tus posiciones?");
    fireEvent.click(b!);
    expect(screen.getByRole("tab", { name: /Tu carta/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Tus posiciones" })).toBeInTheDocument();
  });

  it("sin empujón si lo más jugado ya es su preferida o una de «también»", () => {
    noIntro();
    setUrl("#temporada");
    const { unmount } = view(makeData({ played: PLAYED, positions: { ...MINE, approved: { main: "MI", also: [] } } }));
    expect(nudge()).not.toBeInTheDocument();
    unmount();
    view(makeData({ played: PLAYED, positions: { ...MINE, approved: { main: "MCD", also: ["MI"] } } }));
    expect(nudge()).not.toBeInTheDocument();
  });
});
