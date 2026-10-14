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

const { CelesteDock } = await import("./Chrome");

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
