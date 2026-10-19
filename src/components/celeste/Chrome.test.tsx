import { act, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

// The boards' chrome: «Inicio · Partidos · Plantilla · Números · Club», the account at the end of the top bar (a
// fan's «Entrar» link to the vestuario; a member's avatar), five labelled pages in the tab bar.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, className, onClick, "aria-label": label, "aria-current": current }: { children?: ReactNode; to: string; className?: string; onClick?: (e: unknown) => void; "aria-label"?: string; "aria-current"?: "page" }) => (
    <a href={to} className={className} aria-label={label} aria-current={current} onClick={onClick}>
      {children}
    </a>
  ),
}));

const { CelesteDock, CelesteFooter, CelesteHeader } = await import("./Chrome");
const { publishViewer } = await import("../../hooks/viewerSignal");
const { publishAccount } = await import("./accountSignal");
const { liveDock } = await import("../vidrio/liveDock");
const { pageDirection } = await import("./pageTransition");
const { shrinkNext } = await import("./useScrollShrink");
const { ThemeToggle } = await import("../ThemeToggle");

afterEach(() => {
  act(() => {
    publishViewer({ member: false, admin: false, playerId: null });
    publishAccount(null);
    liveDock.reset();
  });
});

it("a fan: one way into the vestuario («Entrar»), separate from the five public pages", () => {
  render(<CelesteHeader active="inicio" sub="Manchester Piti" actions={<button>Extra</button>} />);
  const header = within(screen.getByRole("banner"));
  expect(header.getAllByRole("link", { name: /vestuario/i })).toHaveLength(1);
  const door = header.getByRole("link", { name: "Entrar al vestuario" });
  expect(door).toHaveAttribute("href", "/vestuario");
  expect(door).toHaveTextContent("Entrar");
  const nav = within(header.getByRole("navigation", { name: "Navegación principal" }));
  expect(nav.getAllByRole("link").map((a) => a.textContent)).toEqual(["Inicio", "Partidos", "Plantilla", "Números", "Club"]);
  expect(nav.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/", "/partidos", "/plantilla", "/stats", "/club"]);
  expect(nav.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
  expect(header.getByRole("link", { name: "Manchester Piti, inicio" })).toHaveAttribute("href", "/");
  // page extras stay; the theme switch pages pass there moves out of the bar
  expect(header.getByRole("button", { name: "Extra" })).toBeInTheDocument();
});

it("the theme switch a page passes is not in the top bar (it lives in the account sheet and the footer)", () => {
  render(
    <>
      <CelesteHeader active="club" actions={<ThemeToggle />} />
      <CelesteFooter />
    </>,
  );
  expect(within(screen.getByRole("banner")).queryByRole("button", { name: /Cambiar a tema/ })).toBeNull();
  expect(within(screen.getByRole("contentinfo")).getByRole("button", { name: /Cambiar a tema/ })).toBeInTheDocument();
});

it("on the vestuario's own pages «Entrar» is lit as the current place", () => {
  render(<CelesteHeader active="vestuario" sub="Tu perfil" actions={<a href="/profile">Tu cuenta</a>} />);
  expect(screen.getByRole("link", { name: "Entrar al vestuario" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Tu cuenta" })).toHaveAttribute("href", "/profile");
});

it("a member gets his avatar («J Jordi») instead of «Entrar»: «Tú» for a jugador, «Tu cuenta» for a socio", () => {
  const { rerender } = render(<CelesteHeader active="plantilla" />);
  act(() => {
    publishViewer({ member: true, admin: false, playerId: "jordi" });
    publishAccount({ name: "jordi" });
  });
  rerender(<CelesteHeader active="plantilla" />);
  const avatar = screen.getByRole("button", { name: "Tú, Jordi" });
  expect(avatar).toHaveAttribute("aria-haspopup", "dialog");
  expect(avatar).toHaveTextContent("JJordi");
  expect(screen.queryByRole("link", { name: "Entrar al vestuario" })).toBeNull();
  act(() => publishViewer({ member: true, admin: false, playerId: null }));
  expect(screen.getByRole("button", { name: "Tu cuenta, Jordi" })).toBeInTheDocument();
});

it("the tab bar: the five pages, each with its label, and /club lit", () => {
  render(<CelesteDock active="club" />);
  const links = within(screen.getByRole("navigation", { name: "Navegación móvil" })).getAllByRole("link");
  expect(links.map((a) => a.getAttribute("href"))).toEqual(["/", "/partidos", "/plantilla", "/stats", "/club"]);
  expect(links.map((a) => a.textContent)).toEqual(["Inicio", "Partidos", "Plantilla", "Números", "Club"]);
  const club = links[4];
  expect(club).toHaveAttribute("aria-current", "page");
  expect(club).toHaveClass("on");
  expect(links.filter((a) => a.getAttribute("aria-current") === "page")).toHaveLength(1);
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
  expect(document.querySelectorAll(".vx-nav-in .vd-bead")).toHaveLength(1);
});

it("the floating score hidden until the next goal leaves its score beside «Partidos»; tapping it brings it back", () => {
  const back = vi.fn();
  render(<CelesteHeader active="plantilla" live />);
  expect(screen.queryByRole("button", { name: /Mostrar el marcador/ })).toBeNull();
  act(() => liveDock.setHidden({ score: "2–1", said: "Piti 2, Orduña fc 1" }, back));
  const chip = screen.getByRole("button", { name: "Mostrar el marcador: Piti 2, Orduña fc 1" });
  expect(chip).toHaveTextContent("2–1");
  act(() => chip.click());
  expect(back).toHaveBeenCalledOnce();
  act(() => liveDock.setHidden(null));
  expect(screen.queryByRole("button", { name: /Mostrar el marcador/ })).toBeNull();
});

it("pages travel by the capsule's order; the tab bar tightens going down and comes back going up", () => {
  expect(pageDirection("inicio", "plantilla")).toBe("right");
  expect(pageDirection("club", "partidos")).toBe("left");
  expect(pageDirection("otra", "inicio")).toBe("left");
  expect(shrinkNext(false, 300, 340)).toBe(true);
  expect(shrinkNext(true, 340, 320)).toBe(false);
  expect(shrinkNext(true, 340, 344)).toBe(true);
  expect(shrinkNext(true, 400, 80)).toBe(false);
});
