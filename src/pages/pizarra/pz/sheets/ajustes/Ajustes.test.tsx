// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderWithPz, fakeWorld, ME_CAPTAIN } from "../../store/testkit";
import { PREFS_DEFAULT, type PizarraPrefs } from "../../../data/prefs";

vi.mock("../../campo/PiCampo", () => ({ PiCampo: () => <div data-testid="campo" /> }));

import { AjustesSheet } from "./Ajustes";
import { PrefsBoot } from "./PrefsBoot";
import { prefsCss } from "./prefsLive";

beforeEach(() => {
  localStorage.clear();
  document.getElementById("pz-prefs-style")?.remove();
});

/** A host whose prefs live like usePizarraPrefs' (set → the next read). */
function withPrefs(h: ReturnType<typeof renderWithPz>) {
  let cur: PizarraPrefs = { ...PREFS_DEFAULT };
  h.host.prefs.mockImplementation(() => cur);
  h.host.setPrefs.mockImplementation((p: Partial<PizarraPrefs>) => {
    cur = { ...cur, ...p };
  });
  return () => cur;
}

describe("Ajustes de la pizarra", () => {
  it("cada ajuste cambia de verdad: se guarda (te sigue) y la pizarra lo usa", async () => {
    const h = renderWithPz(
      <>
        <PrefsBoot />
        <AjustesSheet layout="desktop" args={{}} />
      </>,
      { place: "siete", world: fakeWorld(), me: ME_CAPTAIN },
    );
    const now = withPrefs(h);
    await h.flush();
    // the camera on entering: Grada now, and on the pitch on screen
    fireEvent.click(screen.getByRole("button", { name: /Cámara al entrar: Grada/ }));
    await h.flush();
    expect(now().camara).toBe("grada");
    expect(h.P.state.stage.camera).toBe("grada");
    expect(screen.getByRole("button", { name: /Cámara al entrar: Grada/ }).getAttribute("aria-pressed")).toBe("true");
    // the default layer: saved and applied
    fireEvent.click(screen.getByRole("button", { name: "Química" }));
    await h.flush();
    expect(now().capa).toBe("quimica");
    expect(h.P.state.layer).toBe("quimica");
    // names and galones off, less motion: one style for every pitch
    fireEvent.click(screen.getByRole("button", { name: "El nombre debajo" }));
    fireEvent.click(screen.getByRole("button", { name: "Los galones" }));
    fireEvent.click(screen.getByRole("button", { name: "Menos movimiento" }));
    await h.flush();
    expect(now()).toMatchObject({ nombre: false, galones: false, mov: "menos" });
    const css = document.getElementById("pz-prefs-style")?.textContent ?? "";
    expect(css).toContain("pz-c__plate{display:none");
    expect(css).toContain("pz-c__gal{display:none");
    expect(css).toContain("animation:none");
    // a place entered now opens without gliding (store.stageDefaults reads them)
    act(() => h.P.setRoute({ place: "plan", sub: "", q: {} }));
    await h.flush();
    expect(h.P.state.stage.glideMs).toBe(0);
    expect(h.P.state.stage.camera).toBe("grada");
    // back to how they came, with Deshacer
    fireEvent.click(screen.getByRole("button", { name: "Volver a como venían" }));
    await h.flush();
    expect(now()).toMatchObject({ camara: "sitio", capa: "nada", nombre: true, galones: true, mov: "sistema" });
  });

  it("el sonido: interruptor con su estado en palabras", async () => {
    const h = renderWithPz(<AjustesSheet layout="phone" args={{}} />, { place: "siete", world: fakeWorld(), me: ME_CAPTAIN });
    const now = withPrefs(h);
    await h.flush();
    const tog = screen.getByRole("button", { name: "Sonidos de la pizarra" });
    expect(tog.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Apagados")).toBeTruthy();
    fireEvent.click(tog);
    await h.flush();
    expect(now().sonido).toBe(true);
    expect(screen.getByText("Encendidos")).toBeTruthy();
  });

  it("prefsCss: nada que esconder con los ajustes de serie", () => {
    expect(prefsCss(PREFS_DEFAULT)).toBe("");
  });
});
