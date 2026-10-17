import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import { LiveSide, PulsoLive } from "./LivePanes";
import { LiveCard } from "./LiveBoard";
import { lastEvent } from "../../lib/partidos";
import { agoText, halvesOf, feedOf, pulseTrack, stickerWords, sumLine, tokenTops } from "./directoModel";
import { liveCounts } from "../../lib/ficha";

const squad = vi.hoisted(() => ["a", "b", "h", "k"].map((id, i) => ({ id, firstName: id, number: i + 1 })));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [] }) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, ...rest }: { children: React.ReactNode; to: string; params?: Record<string, string>; className?: string; "aria-label"?: string }) => (
    <a {...rest} href={Object.entries(params ?? {}).reduce((href, [k, v]) => href.replace(`$${k}`, v), to)}>
      {children}
    </a>
  ),
}));

vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: [], players: squad, loading: false, error: null }) }));

const T0 = Date.now() - 20 * 60_000;
const MATCH: ClubMatch = {
  id: "m",
  rival: "Atlético Demo",
  date: T0,
  duration: 50,
  status: "scheduled",
  starters: ["k", "a", "b"],
  bench: ["h"],
  clock: { revision: 1, phase: "first", firstStartedAt: T0 },
  events: [
    { id: "g1", type: "goal", minute: 3, elapsedSeconds: 200, period: 1, playerId: "a", assistPlayerId: "b" },
    { id: "g1b", type: "goal", minute: 3, elapsedSeconds: 210, period: 1, playerId: "a", dupOf: "g1" },
    { id: "o1", type: "opponent_goal", minute: 6, elapsedSeconds: 400, period: 1 },
    { id: "s1", type: "save", minute: 8, elapsedSeconds: 500, period: 1, playerId: "k" },
    { id: "s2", type: "save", minute: 9, elapsedSeconds: 560, period: 1, playerId: "k" },
    { id: "f1", type: "foul", minute: 10, elapsedSeconds: 610, period: 1, playerId: "b" },
    { id: "f2", type: "opponent_foul", minute: 11, elapsedSeconds: 670, period: 1 },
    { id: "w1", type: "woodwork", minute: 12, elapsedSeconds: 730, period: 1, playerId: "b" },
    { id: "y1", type: "opponent_yellow", minute: 13, elapsedSeconds: 790, period: 1 },
  ],
};
const nameOf = (id: string) => id.toUpperCase();

it("«El partido en números»: mirrored rows from la mesa's plays (a pending duplicate counted once) and the keeper's saves", () => {
  render(<LiveSide match={MATCH} players={squad} nameOf={nameOf} now={Date.now()} />);
  expect(screen.getByRole("group", { name: "Goles: Piti 1, Atlético Demo 1" })).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Al palo: Piti 1, Atlético Demo 0" })).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Faltas hechas: Piti 1, Atlético Demo 1" })).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Tarjetas: Piti 0, Atlético Demo 1" })).toBeInTheDocument();
  expect(screen.getByText("Paradas de K")).toBeInTheDocument();
  // the seven: each with his minutes and stickers in words
  const seven = screen.getByRole("region", { name: "Los siete y sus minutos" });
  expect(within(seven).getByRole("listitem", { name: /^A, \d+ minutos, 1 gol$/ })).toBeInTheDocument();
  expect(within(seven).getByRole("listitem", { name: /^K, \d+ minutos, 2 paradas$/ })).toBeInTheDocument();
});

it("Pulso: one tick per play (the duplicate left out), a ball per goal, and «Quién suma» in words", () => {
  const { container } = render(<PulsoLive match={MATCH} players={squad} nameOf={nameOf} live now={Date.now()} />);
  expect(container.querySelectorAll(".ml-trk .tk")).toHaveLength(8);
  expect(container.querySelectorAll(".ml-trk .bl")).toHaveLength(2);
  expect(screen.getByText("1 asistencia, 1 palo y 1 falta hecha")).toBeInTheDocument();
  expect(screen.getByText("1 gol")).toBeInTheDocument();
});

it("the card: the score on tiles, the last play on the strap in words, «Abrir la mesa» for scorers", () => {
  const last = lastEvent(MATCH.events, nameOf, "Atlético Demo");
  render(<LiveCard match={MATCH} rival="Atlético Demo" initials="AD" gf={1} ga={1} minute={14} last={last} lastAt={MATCH.events?.at(-1)} jornada="Jornada 7" goal={null} mesa />);
  expect(screen.getByRole("img", { name: "Manchester Piti 1, Atlético Demo 1" })).toBeInTheDocument();
  const strap = screen.getByRole("status");
  expect(strap).toHaveTextContent("AMARILLA");
  expect(strap).toHaveTextContent("Amarilla a Atlético");
  expect(screen.getByRole("link", { name: "Abrir la mesa, para anotadores" })).toHaveAttribute("href", "/matches/m/mesa");
});

it("a goal of ours arriving live: the gold card, the tile ring and the sweep", () => {
  const { container } = render(<LiveCard match={MATCH} rival="Atlético Demo" initials="AD" gf={2} ga={1} minute={14} last={null} jornada="" goal={{ ours: true, n: 1 }} />);
  expect(container.querySelector(".ml-card")).toHaveClass("g");
  expect(container.querySelector(".ml-tile.gold")).not.toBeNull();
  expect(container.querySelector(".ml-sweep")).not.toBeNull();
  expect(screen.queryByRole("link", { name: /Abrir la mesa/ })).toBeNull();
});

it("the model: halves by period, «hace N s», stickers and the sum line", () => {
  const items = feedOf({ ...MATCH, events: [...(MATCH.events ?? []), { id: "z", type: "chance", minute: 30, period: 2, playerId: "a" }] }, nameOf);
  expect(halvesOf(items, "all", 2).map((h) => [h.label, h.meta])).toEqual([["2ª parte", "en juego, 1 jugada"], ["1ª parte", "8 jugadas"]]);
  expect(halvesOf(items, "goles", null)[1].meta).toBe("2 de 8 jugadas");
  expect(agoText({ clock: { revision: 1, phase: "first", firstStartedAt: 0 } }, { elapsedSeconds: 100 }, 105_000)).toBe("hace 5 s");
  expect(stickerWords(liveCounts("k", MATCH.events))).toBe("2 paradas");
  expect(sumLine("b", MATCH.events)).toBe("1 asistencia, 1 palo y 1 falta hecha");
  expect(pulseTrack(items, 50).labels).toEqual([0, 10, 20, 30, 40, 50]);
  expect(pulseTrack(items, 25).labels).toEqual([0, 5, 10, 15, 20, 25]);
});

it("the pitch's rows never let a name cover a shirt: lines spread evenly, the deeper man a little lower", () => {
  // the orientative 1-3-2-1 (campoPositions): striker, two mids, three defenders, keeper
  const tops = tokenTops([19.6, 42, 42, 63.5, 67, 63.5, 81.5]);
  expect(tops[0]).toBe(8);
  expect(tops[1]).toBe(tops[2]);
  expect(tops[4]).toBeGreaterThan(tops[3]);
  expect(tops[6] - tops[4]).toBeGreaterThanOrEqual(80);
  expect(Math.max(...tops) + 84).toBeLessThanOrEqual(372);
});
