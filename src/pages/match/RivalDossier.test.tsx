import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CronicaTab, PreviaTab } from "./Tabs";
import type { ClubMatch } from "../../lib/clubData";
import { newRival, setRivalNote, setRivalNum } from "../pizarra/v2/rival";

// «El rival» (idea 12): the previa's dossier from rivalDossier — the record, the last three meetings with
// links, our scorers against them, the biggest win — and the pizarra's notes on their seven only when the
// page passes them (members: MatchPage reads the official board only for them). The crónica: a one-line
// record at its top leading to the same section.

const squad = vi.hoisted(() => [
  { id: "ana", shirtName: "ANA", seasons: ["t1"] },
  { id: "bea", shirtName: "BEA", seasons: ["t1"] },
]);
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [] }) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, search, className, ...rest }: { children: React.ReactNode; to: string; params?: Record<string, string>; search?: { season?: string }; className?: string; "aria-label"?: string }) => (
    <a className={className} aria-label={rest["aria-label"]} href={to.replace("$playerId", params?.playerId ?? "").replace("$matchId", params?.matchId ?? "") + (search?.season ? `?season=${search.season}` : "")}>
      {children}
    </a>
  ),
}));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: [], players: squad, loading: false, error: null }) }));
vi.mock("../../components/jersey3d/Jersey3D", () => ({ Jersey3D: () => null }));

type Ev = NonNullable<ClubMatch["events"]>[number];
const goal = (id: string, playerId: string): Ev => ({ id, type: "goal", minute: 10, playerId });
const played = (id: string, month: number, rival: string, gf: number, ga: number, events: Ev[] = []): ClubMatch => ({ id, seasonId: "t1", rival, date: Date.UTC(2025, month, 10, 10), duration: 50, status: "finished", goalsFor: gf, goalsAgainst: ga, events, version: 2 });
const history = [
  played("h1", 1, "Mad Sky", 1, 1, [goal("1", "ana")]),
  played("h2", 3, "MAD SKY", 4, 0, [goal("2", "ana"), goal("3", "bea"), goal("4", "ana"), goal("5", "ana")]),
  played("h3", 5, "mad  sky", 0, 2),
  played("h4", 7, "Mád Sky", 2, 1, [goal("6", "bea"), goal("7", "bea")]),
  played("o1", 8, "Otro", 9, 0),
];
const next: ClubMatch = { id: "nx", seasonId: "t1", rival: "MAD SKY", date: Date.now() + 3 * 86_400_000, duration: 50, status: "scheduled", events: [], version: 2 };

it("the previa: the record, the last three meetings with links, our scorers and the biggest win", () => {
  const { container } = render(<PreviaTab match={next} matches={[...history, next]} />);
  const sec = container.querySelector("#fc-rival") as HTMLElement;
  expect(within(sec).getByRole("heading", { level: 2 })).toHaveTextContent("Ya nos hemos visto 4 veces");
  // PJ · G-E-P (the letters and the words) · GF:GC
  const rec = sec.querySelector(".fc-rec") as HTMLElement;
  expect([...rec.querySelectorAll("dd")].map((d) => d.textContent)).toEqual(["4", "2", "1", "1"]);
  expect(rec).toHaveTextContent(/Partidos.*G.*ganados.*E.*empate.*P.*perdido/);
  expect(sec.querySelector(".fc-goalbar")).toHaveTextContent("7 a favor7:44 en contra");
  // newest first, each one a link to its page, its result in words for a screen reader
  const last = within(sec.querySelector(".fc-riv-last") as HTMLElement).getAllByRole("link");
  expect(last.map((a) => a.getAttribute("href"))).toEqual(["/matches/h4", "/matches/h3", "/matches/h2"]);
  expect(last[1]).toHaveAccessibleName(/^Derrota 0–2, /);
  // ana 4 · bea 3, each a link to his page
  const sc = sec.querySelector(".fc-riv-sc") as HTMLElement;
  expect(within(sc).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([["ANA", "/jugadores/ana?season=t1"], ["BEA", "/jugadores/bea?season=t1"]]);
  expect(sc).toHaveTextContent("ANA4 golesBEA3 goles");
  expect(within(sec).getByRole("link", { name: /^La mayor victoria: 4–0/ })).toHaveAttribute("href", "/matches/h2");
  expect(sec).toHaveTextContent(/Primer cara a cara: .* · empate 1–1/);
  // the old «Ya nos hemos visto» chips are gone: one section
  expect(container.querySelectorAll(".fc-h2h")).toHaveLength(0);
});

it("a fan sees no pizarra notes; a member sees the RivalPanel's notes for their seven", () => {
  const { container, rerender } = render(<PreviaTab match={next} matches={[...history, next]} />);
  expect(screen.queryByText(/Solo el vestuario/)).toBeNull();
  expect(container.querySelector(".fc-riv-plan")).toBeNull();
  let plan = setRivalNum(newRival("3-2-1"), 6, "9");
  plan = setRivalNote(plan, 6, "Presionar al 9 por su izquierda");
  plan = setRivalNote(plan, 0, "Saca rápido con la mano");
  rerender(<PreviaTab match={next} matches={[...history, next]} plan={plan} />);
  const box = container.querySelector(".fc-riv-plan") as HTMLElement;
  expect(box).toHaveTextContent("Solo el vestuario · de la pizarra oficial");
  expect(within(box).getByRole("heading")).toHaveTextContent(/^Su sistema: 3-2-1 · /);
  // a named region (its aria-labelledby works on a section, not on a bare div)
  expect(screen.getByRole("region", { name: /^Su sistema: 3-2-1/ })).toBe(box);
  expect([...box.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Su PORSaca rápido con la mano", "El 9 (DC)Presionar al 9 por su izquierda"]);
  // a board with their seven but no notes yet
  rerender(<PreviaTab match={next} matches={[...history, next]} plan={newRival()} />);
  expect(container.querySelector(".fc-riv-plan")).toHaveTextContent("todavía sin notas");
});

it("no history: «Primera vez contra X» with a friendly line, nothing else to list", () => {
  const first: ClubMatch = { ...next, rival: "Nuevos FC" };
  const { container } = render(<PreviaTab match={first} matches={[...history, first]} />);
  const sec = container.querySelector("#fc-rival") as HTMLElement;
  expect(within(sec).getByRole("heading", { level: 2 })).toHaveTextContent("Primera vez contra Nuevos FC");
  expect(sec).toHaveTextContent("No hay precedentes: este partido abre el historial.");
  expect(sec.querySelector(".fc-rec, .fc-riv-last, .fc-riv-sc")).toBeNull();
});

it("the crónica: «Contra X: 3G 1E 0P» at the top leads to «El rival», where this match counts and is no link", () => {
  const done = played("now", 9, "Mad Sky", 3, 0, [goal("8", "bea")]);
  const { container } = render(<CronicaTab match={done} matches={[...history, done]} players={[]} nameOf={(id) => id.toUpperCase()} />);
  const line = container.querySelector(".fc-riv-line a") as HTMLElement;
  expect(line).toHaveAttribute("href", "#fc-rival");
  expect(line).toHaveTextContent("Contra Mad Sky: 3G 1E 1P");
  expect(line).toHaveAccessibleName(/3 victorias, 1 empate y 1 derrota/);
  const sec = container.querySelector("#fc-rival") as HTMLElement;
  expect(within(sec).getByRole("heading", { level: 2 })).toHaveTextContent("Ya nos hemos visto 5 veces");
  const rows = [...sec.querySelectorAll(".fc-riv-last li")];
  expect(rows[0].querySelector("a")).toBeNull();
  expect(rows[0].querySelector("[aria-current]")).toHaveTextContent("Este partido");
  // (no aria-label on a plain span: the result is said in words inside it)
  expect(rows[0].querySelector("[aria-current]")).not.toHaveAttribute("aria-label");
  expect(rows[0].querySelector("[aria-current]")).toHaveTextContent(/Victoria 3–0/);
  // the crónica has no pizarra notes
  expect(sec.querySelector(".fc-riv-plan")).toBeNull();
  // no written crónica: its moments (h3) still sit under an h2 for the outline
  expect(screen.getByRole("heading", { level: 2, name: "La crónica" })).toHaveClass("sr-only");
  expect(screen.getAllByRole("heading", { level: 3 }).length).toBeGreaterThan(0);
});

it("the crónica's reactions that did not load: said so, never an empty bar", () => {
  const done = played("now", 9, "Mad Sky", 3, 0, [goal("8", "bea")]);
  render(<CronicaTab match={done} matches={[...history, done]} players={[]} nameOf={(id) => id} after={{ reactions: [], ratings: [], me: null, error: true }} />);
  expect(screen.getByText(/No se han podido cargar las reacciones/)).toBeInTheDocument();
});

it("the crónica of the first meeting: «Primera vez contra X»", () => {
  const done = played("now", 9, "Nuevos FC", 1, 0);
  const { container } = render(<CronicaTab match={done} matches={[...history, done]} players={[]} nameOf={(id) => id} />);
  expect(container.querySelector(".fc-riv-line a")).toHaveTextContent("Primera vez contra Nuevos FC");
  expect(container.querySelector("#fc-rival")).toHaveTextContent("Este fue el primer cara a cara");
});

it("a match that names no rival: no dossier, no line", () => {
  const anon: ClubMatch = { ...next, rival: undefined };
  const { container } = render(<PreviaTab match={anon} matches={[...history, anon]} />);
  expect(container.querySelector("#fc-rival")).toBeNull();
});
