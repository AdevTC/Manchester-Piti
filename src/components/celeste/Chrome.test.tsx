import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";

// The phone dock: six items, El club among them, and /club lights its own.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, className, "aria-label": label, "aria-current": current }: { children?: ReactNode; to: string; className?: string; "aria-label"?: string; "aria-current"?: "page" }) => (
    <a href={to} className={className} aria-label={label} aria-current={current}>
      {children}
    </a>
  ),
}));

const { CelesteDock, CelesteHeader } = await import("./Chrome");

it("the header has a single Vestuario access, separate from the five public pages", () => {
  render(<CelesteHeader active="inicio" sub="Manchester Piti" actions={<button>Tema</button>} />);
  const header = within(screen.getByRole("banner"));
  expect(header.getAllByRole("link", { name: /vestuario/i })).toHaveLength(1);
  expect(header.getByRole("link", { name: "Entrar al vestuario" })).toHaveAttribute("href", "/vestuario");
  const nav = within(header.getByRole("navigation", { name: "Navegación principal" }));
  expect(nav.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/", "/partidos", "/plantilla", "/stats", "/club"]);
  expect(nav.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
});

it("private pages highlight the same Vestuario access while retaining their profile action", () => {
  render(<CelesteHeader active="vestuario" sub="Tu perfil" actions={<a href="/profile">Tu cuenta</a>} />);
  expect(screen.getByRole("link", { name: "Entrar al vestuario" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Tu cuenta" })).toHaveAttribute("href", "/profile");
});

it("the dock has six items and El club lights on /club", () => {
  render(<CelesteDock active="club" />);
  const links = within(screen.getByRole("navigation", { name: "Navegación móvil" })).getAllByRole("link");
  expect(links.map((a) => a.getAttribute("href"))).toEqual(["/", "/partidos", "/vestuario", "/stats", "/plantilla", "/club"]);
  const club = links[5];
  expect(club).toHaveAttribute("aria-current", "page");
  expect(club).toHaveClass("on");
  expect(club).toHaveTextContent("El club");
  expect(links.filter((a) => a.getAttribute("aria-current") === "page")).toHaveLength(1);
  expect(links.slice(0, 5).map((a) => a.getAttribute("aria-label"))).toEqual(["Inicio", "Partidos", "Vestuario", "Estadísticas", "Plantilla"]);
});

it("on another page El club is an icon link with its name", () => {
  render(<CelesteDock active="inicio" />);
  const nav = within(screen.getByRole("navigation", { name: "Navegación móvil" }));
  expect(nav.getByRole("link", { name: "El club" })).toHaveAttribute("href", "/club");
  expect(nav.getByRole("link", { name: "El club" })).not.toHaveAttribute("aria-current");
});

it("while a match is live «Partidos» carries the dot and says it, in the capsule and in the tab bar", () => {
  render(
    <>
      <CelesteHeader active="inicio" sub="Inicio" actions={null} live />
      <CelesteDock active="inicio" live />
    </>,
  );
  const nav = within(screen.getByRole("navigation", { name: "Navegación principal" }));
  expect(nav.getByRole("link", { name: "Partidos, en directo" })).toHaveAttribute("href", "/partidos");
  const dock = within(screen.getByRole("navigation", { name: "Navegación móvil" }));
  expect(dock.getByRole("link", { name: "Partidos, en directo" })).toHaveAttribute("href", "/partidos");
  expect(document.querySelectorAll(".vd-livedot")).toHaveLength(2);
});

it("no live match: no dot, and the glass capsule keeps the nav's names", () => {
  render(<CelesteHeader active="partidos" sub="Partidos" actions={null} />);
  const nav = within(screen.getByRole("navigation", { name: "Navegación principal" }));
  expect(nav.getByRole("link", { name: "Partidos" })).toHaveAttribute("aria-current", "page");
  expect(document.querySelector(".vd-livedot")).toBeNull();
  expect(document.querySelector(".vx-nav-in")).toHaveClass("vd-glass");
});
