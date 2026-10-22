import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// The Celeste states. Each kind has its role, its kicker and its mark; an error says «!» (never colour
// alone) and never «no encontrado»; the screen brings the site chrome. The chrome's links are stubbed.

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...rest }: { children?: ReactNode; to?: string; className?: string; "aria-current"?: "page" }) => (
    <a {...rest} href={to}>
      {children}
    </a>
  ),
}));
vi.mock("../ThemeToggle", () => ({ ThemeToggle: () => null }));

const { ClubDataError, StatePanel, StateScreen } = await import("./StatePanel");
const { sectionOf } = await import("./sectionOf");

describe("StatePanel kinds", () => {
  it("loading: a status (busy), its kicker, the title as an h2", () => {
    render(<StatePanel kind="loading" title="Preparando la ficha" />);
    const panel = screen.getByRole("status");
    expect(panel).toHaveAttribute("aria-busy", "true");
    expect(panel).toHaveClass("sp", "loading");
    expect(within(panel).getByText("Calentando en la banda")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Preparando la ficha" })).toBeInTheDocument();
    expect(panel).toHaveAccessibleName("Preparando la ficha");
  });

  it("empty: a region named by its title (no live role), its kicker, the body and the action", () => {
    render(<StatePanel kind="empty" title="Nada por aquí" body="Todavía no hay partidos." action={<button type="button">Ver todo</button>} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("region", { name: "Nada por aquí" })).toHaveClass("sp", "empty");
    expect(screen.getByText("Sin jugadas todavía")).toBeInTheDocument();
    expect(screen.getByText("Todavía no hay partidos.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver todo" })).toBeInTheDocument();
  });

  it("error: an alert, marked «!» and «Error» in words, with the technical detail folded away", () => {
    render(<StatePanel kind="error" title="Algo se ha torcido" detail="permission-denied" />);
    const panel = screen.getByRole("alert");
    expect(within(panel).getByText("!")).toHaveAttribute("aria-hidden", "true");
    expect(within(panel).getByText(/Error/)).toBeInTheDocument();
    expect(within(panel).getByText("Detalle técnico")).toBeInTheDocument();
    expect(within(panel).getByText("permission-denied")).toBeInTheDocument();
  });

  it("notfound: «404 · Fuera de juego» and a heading level of choice", () => {
    render(<StatePanel kind="notfound" heading="h1" title="Partido no encontrado" />);
    expect(screen.getByRole("region", { name: "Partido no encontrado" })).toBeInTheDocument();
    expect(screen.getByText("404 · Fuera de juego")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Partido no encontrado" })).toBeInTheDocument();
  });

  it("a kicker and a compact size of the caller's", () => {
    const { container } = render(<StatePanel kind="empty" kicker="Sala de control" compact title="Solo para la capitanía" />);
    expect(screen.getByText("Sala de control")).toBeInTheDocument();
    expect(container.querySelector(".sp")).toHaveClass("compact");
  });
});

describe("ClubDataError", () => {
  it("an error that offers to try again, never «no encontrado»", () => {
    render(<ClubDataError />);
    const panel = screen.getByRole("alert");
    expect(panel.textContent).not.toMatch(/no encontrad/i);
    expect(within(panel).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});

describe("StateScreen", () => {
  it("the panel's title is the page's h1, inside the Celeste header, footer and dock", () => {
    const { container } = render(<StateScreen kind="notfound" sub="Manchester Piti" ghost="404" title="Fuera de juego" />);
    expect(screen.getByRole("heading", { level: 1, name: "Fuera de juego" })).toBeInTheDocument();
    expect(container.querySelector(".vx .vx-top")).not.toBeNull();
    expect(container.querySelector(".vx .vx-foot")).not.toBeNull();
    expect(container.querySelector(".vx .vx-dock")).not.toBeNull();
    // the giant 404 is decoration
    expect(container.querySelector(".sp-ghost")).toHaveAttribute("aria-hidden", "true");
    // no nav item lit outside the nav
    expect(container.querySelector('[aria-current="page"]')).toBeNull();
  });

  it("lights the section it belongs to", () => {
    const { container } = render(<StateScreen kind="error" {...sectionOf("/partidos/j1")} title="Algo se ha torcido" />);
    expect(container.querySelector('.vx-nav [aria-current="page"]')?.textContent).toBe("Partidos");
  });
});

describe("sectionOf", () => {
  it("maps paths to their section", () => {
    expect(sectionOf("/")).toEqual({ active: "inicio", sub: "Manchester Piti" });
    expect(sectionOf("/jugadores/erik").active).toBe("plantilla");
    expect(sectionOf("/numeros").active).toBe("stats");
    expect(sectionOf("/numeros/records/marcas").active).toBe("stats");
    expect(sectionOf("/partidos/j1/siete").active).toBe("partidos");
    expect(sectionOf("/plantilla/cara-a-cara").active).toBe("plantilla");
    expect(sectionOf("/club/historia").active).toBe("club");
    expect(sectionOf("/hoy/campo").active).toBe("inicio");
    expect(sectionOf("/perfil/ajustes").active).toBe("vestuario");
    expect(sectionOf("/stats").active).toBeUndefined();
    expect(sectionOf("/club").active).toBe("club");
    expect(sectionOf("/pizarra").active).toBe("vestuario");
    expect(sectionOf("/nada").active).toBeUndefined();
  });
});
