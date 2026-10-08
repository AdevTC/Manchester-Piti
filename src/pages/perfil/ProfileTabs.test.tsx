import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as device from "./device";
import * as push from "../../lib/push";
import { doorRow, fakeActions, makeData, noIntro, setUrl, view } from "./testkit";
import type { ProfileData } from "./useProfileData";

// /profile › Avisos · Ajustes · Cuenta · Capitanía with the browser faked: push.ts and the device
// helpers are mocks (no service worker, no Firebase), matchMedia is a stub, no WebGL anywhere.

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, hash, className }: { children?: ReactNode; to: string; params?: Record<string, string>; hash?: string; className?: string }) => (
    <a className={className} href={(params ? to.replace(/\$(\w+)/g, (_, k: string) => params[k] ?? "") : to) + (hash ? "#" + hash : "")}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock("../../lib/push", () => ({
  TOPIC_LABELS: [
    { id: "start", label: "Cuando empiece el partido" },
    { id: "goals", label: "Cada gol" },
    { id: "final", label: "Resultado final" },
    { id: "mvp", label: "Se abre el voto del MVP" },
    { id: "dates", label: "Fechas nuevas y cambios" },
    { id: "lineup", label: "Cuando salga el siete oficial" },
  ],
  pushState: vi.fn(() => "ready"),
  savedTopics: vi.fn(() => []),
  toggleTopic: vi.fn(async () => []),
  setTopics: vi.fn(async (t: string[]) => t),
}));

vi.mock("./device", () => ({
  notificationPermission: vi.fn(() => "granted"),
  isStandalone: vi.fn(() => false),
  userAgent: vi.fn(() => "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36"),
  pushSubscribed: vi.fn(async () => true),
  watchPermission: vi.fn(() => () => undefined),
  showTestNotice: vi.fn(async () => undefined),
}));

const m = {
  pushState: vi.mocked(push.pushState),
  savedTopics: vi.mocked(push.savedTopics),
  toggleTopic: vi.mocked(push.toggleTopic),
  permission: vi.mocked(device.notificationPermission),
  ua: vi.mocked(device.userAgent),
  subscribed: vi.mocked(device.pushSubscribed),
  test: vi.mocked(device.showTestNotice),
};

/** matchMedia with live answers: dark mode and reduced motion can change while the page is open. */
function stubMedia(init: { dark?: boolean; rm?: boolean } = {}) {
  const live = { dark: !!init.dark, rm: !!init.rm };
  const subs = new Map<string, Set<() => void>>();
  const key = (q: string) => (q.includes("color-scheme") ? "dark" : q.includes("reduced-motion") ? "rm" : "other");
  vi.stubGlobal("matchMedia", (q: string) => ({
    media: q,
    get matches() {
      const k = key(q);
      return k === "dark" ? live.dark : k === "rm" ? live.rm : false;
    },
    addEventListener: (_: string, f: () => void) => subs.set(key(q), (subs.get(key(q)) ?? new Set()).add(f)),
    removeEventListener: (_: string, f: () => void) => subs.get(key(q))?.delete(f),
  }));
  return {
    set(k: "dark" | "rm", v: boolean) {
      live[k] = v;
      act(() => subs.get(k)?.forEach((f) => f()));
    },
  };
}

const open = (hash: string, data: ProfileData = makeData(), actions = fakeActions()) => {
  noIntro();
  setUrl(hash);
  view(data, actions);
  return actions;
};
const sw = (name: RegExp) => screen.getByRole("button", { name });
const clipboard = (writeText: (t: string) => Promise<void>) => Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setUrl("");
  m.pushState.mockReturnValue("ready");
  m.savedTopics.mockReturnValue([]);
  m.toggleTopic.mockReset().mockImplementation(async (t, on) => (on ? [t] : []));
  m.permission.mockReturnValue("granted");
  m.ua.mockReturnValue("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36");
  m.subscribed.mockResolvedValue(true);
  m.test.mockReset().mockResolvedValue(undefined);
  stubMedia();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("Avisos · este móvil", () => {
  it("listo: el estado de verdad, cuántos activos y los interruptores", async () => {
    m.savedTopics.mockReturnValue(["start", "goals"]);
    open("#avisos");
    const dv = document.getElementById("pe-dv")!;
    expect(within(dv).getByText("Listo")).toBeInTheDocument();
    expect(within(dv).getByText("Este móvil recibe avisos")).toBeInTheDocument();
    expect(within(dv).getByText("Chrome en Android · avisos permitidos")).toBeInTheDocument();
    expect(screen.getByText("2 de 6 activos en este móvil.")).toBeInTheDocument();
    expect(sw(/Empieza el partido/)).toHaveAttribute("aria-pressed", "true");
    expect(sw(/^Goles/)).toHaveAttribute("aria-pressed", "true");
    expect(sw(/MVP de la jornada/)).toHaveAttribute("aria-pressed", "false");
    // the door is only for captains
    expect(screen.queryByRole("button", { name: /Alguien llama a la puerta/ })).not.toBeInTheDocument();
    await waitFor(() => expect(m.subscribed).toHaveBeenCalled());
    expect(sw(/^Goles/)).toHaveAttribute("aria-pressed", "true");
  });

  it("guardados sin suscripción viva: apagados", async () => {
    m.savedTopics.mockReturnValue(["start", "goals"]);
    m.subscribed.mockResolvedValue(false);
    open("#avisos");
    await waitFor(() => expect(screen.getByText("0 de 6 activos en este móvil.")).toBeInTheDocument());
    expect(screen.getByText("Este móvil puede recibir avisos")).toBeInTheDocument();
  });

  it("capitán: «Alguien llama a la puerta» con CAPITANES", () => {
    open("#avisos", makeData({ captain: true }));
    const door = sw(/Alguien llama a la puerta/);
    expect(within(door).getByText("CAPITANES")).toBeInTheDocument();
    expect(screen.getByText("0 de 7 activos en este móvil.")).toBeInTheDocument();
  });

  it("iPhone sin instalar: los pasos, interruptores bloqueados con el motivo, «Probar» explica por qué", () => {
    m.pushState.mockReturnValue("ios-install");
    m.permission.mockReturnValue("unknown");
    m.ua.mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1");
    open("#avisos");
    const dv = document.getElementById("pe-dv")!;
    expect(within(dv).getByText("Falta un paso")).toBeInTheDocument();
    expect(within(dv).getByText("En iPhone, primero instala la web")).toBeInTheDocument();
    expect(within(dv).getByText("Añadir a pantalla de inicio")).toBeInTheDocument();
    expect(screen.getByText("Se activan cuando este móvil esté listo.")).toBeInTheDocument();
    const goles = sw(/^Goles/);
    expect(goles).toHaveAttribute("aria-disabled", "true");
    expect(goles).toHaveAccessibleDescription("Se activan cuando este móvil esté listo.");
    fireEvent.click(goles);
    expect(m.toggleTopic).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Probar en este móvil/ })).toBeDisabled();
    expect(screen.getByText("Se activa cuando este móvil esté listo.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ya la he añadido/ }));
    expect(screen.getByText("Aquí sigues en Safari: abre Manchester Piti desde el icono de tu pantalla de inicio")).toBeInTheDocument();
  });

  it("bloqueados: cómo desbloquearlos en este navegador (Firefox)", () => {
    m.pushState.mockReturnValue("denied");
    m.permission.mockReturnValue("denied");
    m.ua.mockReturnValue("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0");
    open("#avisos");
    const dv = document.getElementById("pe-dv")!;
    expect(within(dv).getByText("Bloqueados")).toBeInTheDocument();
    expect(within(dv).getByText("Bloqueaste los avisos en este navegador")).toBeInTheDocument();
    expect(within(dv).getByText("Notificaciones")).toBeInTheDocument();
    expect(dv).toHaveTextContent("quita el bloqueo (la ×)");
    fireEvent.click(screen.getByRole("button", { name: /Ya los he permitido/ }));
    expect(screen.getByText("Siguen bloqueados: sigue los tres pasos y recarga la página")).toBeInTheDocument();
  });

  it("no disponibles: lleva al calendario", () => {
    m.pushState.mockReturnValue("unsupported");
    open("#avisos");
    const dv = document.getElementById("pe-dv")!;
    expect(within(dv).getByText("No disponible")).toBeInTheDocument();
    expect(within(dv).getByText("Este navegador no admite avisos")).toBeInTheDocument();
    const spy = vi.spyOn(document.getElementById("pe-cal")!, "scrollIntoView");
    fireEvent.click(within(dv).getByRole("button", { name: /Ir al calendario/ }));
    expect(spy).toHaveBeenCalled();
  });
});

describe("Avisos · interruptores", () => {
  it("activar: ocupado mientras pregunta, luego SÍ y el aviso del primero", async () => {
    let done: (t: push.Topic[]) => void = () => undefined;
    m.toggleTopic.mockImplementation(() => new Promise((r) => (done = r)));
    open("#avisos");
    const goles = sw(/^Goles/);
    fireEvent.click(goles);
    expect(m.toggleTopic).toHaveBeenCalledWith("goals", true);
    expect(goles).toHaveAttribute("aria-pressed", "true");
    expect(goles).toHaveAttribute("aria-busy", "true");
    expect(within(goles).getByText("···")).toBeInTheDocument();
    // a second tap while it is busy does nothing
    fireEvent.click(sw(/^Final/));
    expect(m.toggleTopic).toHaveBeenCalledTimes(1);
    await act(async () => done(["goals"]));
    expect(goles).toHaveAttribute("aria-pressed", "true");
    expect(goles).not.toHaveAttribute("aria-busy");
    expect(within(goles).getByText("SÍ")).toBeInTheDocument();
    expect(screen.getByText("1 de 6 activos en este móvil.")).toBeInTheDocument();
    expect(screen.getByText("Avisos activados en este móvil")).toBeInTheDocument();
  });

  it("si falla: vuelve como estaba y lo dice en la línea", async () => {
    m.toggleTopic.mockRejectedValue(new Error("Sin permiso para avisos en este navegador."));
    open("#avisos");
    const goles = sw(/^Goles/);
    fireEvent.click(goles);
    expect(goles).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(goles).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getByRole("alert")).toHaveTextContent("Sin permiso no te podemos avisar: este navegador ha dicho que no.");
    expect(screen.getByText("0 de 6 activos en este móvil.")).toBeInTheDocument();
  });

  it("sin conexión: no lo intenta", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    open("#avisos");
    fireEvent.click(sw(/^Goles/));
    expect(m.toggleTopic).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Sin conexión");
  });
});

describe("Avisos · probar y calendario", () => {
  it("sin permiso todavía: «Probar» explica por qué", () => {
    m.permission.mockReturnValue("default");
    open("#avisos");
    const b = screen.getByRole("button", { name: /Probar en este móvil/ });
    expect(b).toBeDisabled();
    expect(b).toHaveAccessibleDescription("Activa antes algún aviso: así este móvil te da permiso.");
  });

  it("con permiso: un aviso de verdad y la vista previa", async () => {
    open("#avisos", { ...makeData(), next: { id: "j3", rival: "MAD SKY", dateMs: 0, home: false, j: 8 } });
    fireEvent.click(screen.getByRole("button", { name: /Probar en este móvil/ }));
    expect(m.test).toHaveBeenCalledWith("GOOOL · ADRI · 31′", "Manchester Piti 2–1 MAD SKY · J8");
    const nt = await screen.findByText("GOOOL · ADRI · 31′");
    expect(nt.closest(".nt")).toHaveAttribute("role", "status");
    await waitFor(() => expect(screen.getByRole("button", { name: /Probar en este móvil/ })).not.toHaveAttribute("aria-busy"));
    fireEvent.click(screen.getByRole("button", { name: /Probar en este móvil/ }));
    expect(m.test).toHaveBeenLastCalledWith("Ya está el siete", "El capitán ha publicado el once para MAD SKY");
  });

  it("si el móvil no lo muestra, lo dice", async () => {
    m.test.mockRejectedValue(new Error("no-sw"));
    open("#avisos");
    fireEvent.click(screen.getByRole("button", { name: /Probar en este móvil/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se ha podido mostrar el aviso en este móvil");
  });

  it("calendario: Google, Apple, copiar y los próximos partidos", async () => {
    const writeText = vi.fn(async () => undefined);
    clipboard(writeText);
    open("#avisos", { ...makeData(), upcoming: [{ id: "a", j: "J8", rival: "MAD SKY", day: "8", mon: "nov", meta: "dom · 12:00 · fuera" }] });
    const cal = document.getElementById("pe-cal")!;
    expect(within(cal).getByText("MAD SKY")).toBeInTheDocument();
    expect(within(cal).getByText("dom · 12:00 · fuera")).toBeInTheDocument();
    expect(within(cal).getByText("J8")).toBeInTheDocument();
    expect(within(cal).getByRole("link", { name: /Google/ }).getAttribute("href")).toContain("calendar.google.com");
    expect(within(cal).getByRole("link", { name: /Apple/ })).toHaveAttribute("href", "webcal://manchesterpiti.test/calendario.ics");
    expect(within(cal).getByText("webcal://manchesterpiti.test/calendario.ics")).toBeInTheDocument();
    fireEvent.click(within(cal).getByRole("button", { name: /Copiar/ }));
    await waitFor(() => expect(within(cal).getByRole("button", { name: /Copiado/ })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith("webcal://manchesterpiti.test/calendario.ics");
  });
});

describe("Ajustes", () => {
  const group = (name: RegExp) => screen.getByRole("group", { name });

  it("Tema: ◀ ▶ y las flechas del teclado; se aplica y se guarda; «Sistema» sigue al móvil", () => {
    const media = stubMedia({ dark: true });
    open("#ajustes");
    const g = group(/^Tema:/);
    expect(g).toHaveAccessibleName("Tema: Sistema");
    expect(within(g).getByRole("status")).toHaveTextContent("Sistema");
    fireEvent.keyDown(g, { key: "ArrowRight" });
    expect(group(/^Tema:/)).toHaveAccessibleName("Tema: Día");
    expect(localStorage.getItem("mp_theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    fireEvent.click(screen.getByRole("button", { name: "Tema: siguiente" }));
    expect(group(/^Tema:/)).toHaveAccessibleName("Tema: Noche");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    fireEvent.keyDown(group(/^Tema:/), { key: "ArrowRight" });
    expect(group(/^Tema:/)).toHaveAccessibleName("Tema: Sistema");
    expect(localStorage.getItem("mp_theme")).toBe("system");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    media.set("dark", false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    fireEvent.keyDown(group(/^Tema:/), { key: "ArrowLeft" });
    expect(group(/^Tema:/)).toHaveAccessibleName("Tema: Noche");
  });

  it("Salida de la carta, Sonido y Estadio en 3D se guardan (los dos últimos, los de la pizarra)", () => {
    open("#ajustes");
    // noIntro() left it in «Nunca»
    expect(group(/^Salida de la carta:/)).toHaveAccessibleName("Salida de la carta: Nunca");
    fireEvent.click(screen.getByRole("button", { name: "Salida de la carta: siguiente" }));
    expect(group(/^Salida de la carta:/)).toHaveAccessibleName("Salida de la carta: Cada vez");
    expect(JSON.parse(localStorage.getItem("mp_perfil_prefs") ?? "{}")).toMatchObject({ intro: "siempre" });
    fireEvent.keyDown(group(/^Salida de la carta:/), { key: "ArrowRight" });
    expect(JSON.parse(localStorage.getItem("mp_perfil_prefs") ?? "{}")).toMatchObject({ intro: "primera" });
    expect(group(/^Salida de la carta:/)).toHaveAccessibleName("Salida de la carta: Solo la 1.ª");

    expect(group(/^Sonido:/)).toHaveAccessibleName("Sonido: No");
    fireEvent.keyDown(group(/^Sonido:/), { key: "ArrowRight" });
    expect(group(/^Sonido:/)).toHaveAccessibleName("Sonido: Sí");
    expect(JSON.parse(localStorage.getItem("mp_pizarra_v2_prefs") ?? "{}")).toMatchObject({ snd: true, v3: true });

    expect(group(/^Estadio en 3D:/)).toHaveAccessibleName("Estadio en 3D: Sí");
    fireEvent.click(screen.getByRole("button", { name: "Estadio en 3D: anterior" }));
    expect(group(/^Estadio en 3D:/)).toHaveAccessibleName("Estadio en 3D: No");
    expect(JSON.parse(localStorage.getItem("mp_pizarra_v2_prefs") ?? "{}")).toMatchObject({ snd: true, v3: false });
  });

  it("Brillo al inclinar: se guarda y, al encenderlo, pide el giroscopio en iOS desde ese toque", async () => {
    const requestPermission = vi.fn(async () => "granted");
    vi.stubGlobal("DeviceOrientationEvent", Object.assign(function DeviceOrientationEvent() {}, { requestPermission }));
    open("#ajustes");
    expect(group(/^Brillo al inclinar:/)).toHaveAccessibleName("Brillo al inclinar: Sí");
    fireEvent.keyDown(group(/^Brillo al inclinar:/), { key: "ArrowRight" });
    expect(group(/^Brillo al inclinar:/)).toHaveAccessibleName("Brillo al inclinar: No");
    expect(JSON.parse(localStorage.getItem("mp_perfil_prefs") ?? "{}")).toMatchObject({ tilt: false });
    expect(requestPermission).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Brillo al inclinar: siguiente" }));
    expect(JSON.parse(localStorage.getItem("mp_perfil_prefs") ?? "{}")).toMatchObject({ tilt: true });
    expect(requestPermission).toHaveBeenCalledTimes(1);
    await act(async () => undefined);
  });

  it("Animaciones: solo lectura, sigue al móvil en directo", () => {
    const media = stubMedia({ rm: false });
    open("#ajustes");
    expect(screen.getByText("Animaciones completas en este móvil.")).toBeInTheDocument();
    media.set("rm", true);
    expect(screen.getByText("Tu móvil pide menos movimiento: la carta sale ya quieta.")).toBeInTheDocument();
  });
});

describe("Cuenta", () => {
  it("Google, acceso, qué guarda y el id (copiar)", async () => {
    const writeText = vi.fn(async () => undefined);
    clipboard(writeText);
    open("#cuenta", { ...makeData(), google: { name: "Adrián Tello", email: "un.correo.muy.largo.de.google.para.probar@gmail.com", photo: null } });
    expect(screen.getByText("Adrián Tello")).toBeInTheDocument();
    expect(screen.getByText("un.correo.muy.largo.de.google.para.probar@gmail.com")).toHaveClass("mail");
    expect(screen.getByText("Jugador del Manchester Piti")).toBeInTheDocument();
    expect(document.querySelector(".gacc .av")).toHaveTextContent("A");
    const acc = document.querySelector("dl.acc") as HTMLElement;
    expect(within(acc).getByText("sep 2026")).toBeInTheDocument();
    expect(within(acc).getByText("Por invitación")).toBeInTheDocument();
    expect(within(acc).getByText("@capi")).toBeInTheDocument();
    expect(within(acc).getByText("No caduca")).toBeInTheDocument();
    const priv = screen.getByRole("button", { name: "Léelo en dos líneas" });
    expect(priv).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(priv);
    expect(screen.getByRole("button", { name: "Ocultar" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Nada más. No se vende ni se comparte con nadie.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver tu id de usuario" }));
    expect(screen.getByText("u1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Copiar id/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Copiado/ })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith("u1");
    expect(screen.getByText("Id copiado")).toBeInTheDocument();
  });

  it("Salir en este dispositivo: confirmación en la página; Cancelar vuelve; Sí, salir cierra solo aquí", async () => {
    const actions = open("#cuenta");
    const out = screen.getByRole("button", { name: "Salir en este dispositivo" });
    fireEvent.click(out);
    const cf = screen.getByRole("group", { name: "Confirmar la salida" });
    expect(document.activeElement).toBe(within(cf).getByRole("button", { name: "Sí, salir" }));
    fireEvent.click(within(cf).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("group", { name: "Confirmar la salida" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Salir en este dispositivo" }));
    expect(actions.signOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Salir en este dispositivo" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, salir" }));
    fireEvent.click(screen.getByRole("button", { name: /Saliendo/ }));
    expect(actions.signOut).toHaveBeenCalledTimes(1);
    await act(async () => undefined);
  });

  it("Darme de baja: hace falta marcar la casilla; luego se va", async () => {
    let done: () => void = () => undefined;
    const actions = open("#cuenta", makeData(), fakeActions({ leaveVestuario: vi.fn(() => new Promise<void>((r) => (done = r))) }));
    fireEvent.click(screen.getByRole("button", { name: /Darme de baja del vestuario/ }));
    const cf = screen.getByRole("group", { name: "Confirmar la baja" });
    const ck = within(cf).getByRole("checkbox");
    expect(document.activeElement).toBe(ck);
    const go = within(cf).getByRole("button", { name: "Darme de baja" });
    expect(go).toBeDisabled();
    fireEvent.click(go);
    expect(actions.leaveVestuario).not.toHaveBeenCalled();
    fireEvent.click(ck);
    expect(go).toBeEnabled();
    fireEvent.click(go);
    expect(actions.leaveVestuario).toHaveBeenCalledTimes(1);
    expect(within(cf).getByRole("button", { name: "Dándote de baja…" })).toBeDisabled();
    fireEvent.click(within(cf).getByRole("button", { name: "Dándote de baja…" }));
    expect(actions.leaveVestuario).toHaveBeenCalledTimes(1);
    await act(async () => done());
    expect(screen.getByText("Te has dado de baja.")).toBeInTheDocument();
  });

  it("Darme de baja: «Me quedo» y los errores en la línea", async () => {
    const leave = vi.fn(async () => {
      throw Object.assign(new Error("Marca que entiendes que dejas el vestuario."), { code: "functions/invalid-argument" });
    });
    open("#cuenta", makeData(), fakeActions({ leaveVestuario: leave }));
    fireEvent.click(screen.getByRole("button", { name: /Darme de baja del vestuario/ }));
    fireEvent.click(screen.getByRole("button", { name: "Me quedo" }));
    expect(screen.queryByRole("group", { name: "Confirmar la baja" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Darme de baja del vestuario/ }));
    fireEvent.click(screen.getByRole("button", { name: /Darme de baja del vestuario/ }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Darme de baja" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Marca que entiendes que dejas el vestuario.");
    expect(screen.getByRole("group", { name: "Confirmar la baja" })).toBeInTheDocument();
  });

  it("el superadministrador no puede darse de baja: se le explica", () => {
    open("#cuenta", makeData({ captain: true, superadmin: true }));
    expect(screen.queryByRole("button", { name: /Darme de baja del vestuario/ })).not.toBeInTheDocument();
    expect(screen.getByText(/esta cuenta no se puede dar de baja/)).toBeInTheDocument();
    expect(screen.getByText("Capitán del Manchester Piti")).toBeInTheDocument();
  });
});

describe("Capitanía", () => {
  it("la puerta: el LED, las peticiones y los enlaces a La puerta", () => {
    open("#capitania", makeData({ captain: true, doors: [doorRow(1, { playerId: "adri" }), doorRow(0, { name: null, googleName: "Pepe Google", at: 400 * 86_400_000 - 30 * 3_600_000 })] }));
    const led = screen.getByRole("img", { name: "2 personas llamando" });
    expect(led).toHaveTextContent("2LLAMANDO");
    expect(screen.getByText("Dos peticiones esperan tu sí o tu no.")).toBeInTheDocument();
    const door = led.closest("a")!;
    expect(door).toHaveAttribute("href", "/vestuario#puerta");
    const rows = within(screen.getByRole("list", { name: "Peticiones para entrar" })).getAllByRole("link");
    // oldest first
    expect(rows[0]).toHaveTextContent("Pepe Google");
    expect(rows[0]).toHaveTextContent("Sin dorsal todavía · hace 1 día");
    expect(rows[1]).toHaveTextContent("Socio 1");
    expect(rows[1]).toHaveTextContent("Pide la carta del 10 · hace 2 h");
    rows.forEach((r) => expect(r).toHaveAttribute("href", "/vestuario#puerta"));
    expect(screen.getByRole("link", { name: /Administrar el club/ })).toHaveAttribute("href", "/admin");
  });

  it("nadie llamando", () => {
    open("#capitania", makeData({ captain: true, doors: 0 }));
    expect(screen.getByRole("img", { name: "0 personas llamando" })).toBeInTheDocument();
    expect(screen.getByText(/Nadie llama ahora/)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Peticiones para entrar" })).not.toBeInTheDocument();
  });

  it("Aviso de la puerta: su estado en este móvil y «Cambiarlo en Avisos» lleva al interruptor", async () => {
    m.savedTopics.mockReturnValue(["door"]);
    open("#capitania", makeData({ captain: true, doors: 1 }));
    expect(screen.getByText("activado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cambiarlo en Avisos/ }));
    expect(screen.getByRole("tab", { name: /Avisos/ })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: /Alguien llama a la puerta/ })));
    expect(document.activeElement).toHaveAttribute("aria-pressed", "true");
  });

  it("sin avisos en este móvil: desactivado", () => {
    m.pushState.mockReturnValue("denied");
    m.savedTopics.mockReturnValue(["door"]);
    open("#capitania", makeData({ captain: true }));
    expect(screen.getByText("desactivado")).toBeInTheDocument();
  });
});
