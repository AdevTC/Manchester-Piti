import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { CampoTab, CronicaTab, DirectoTab } from "./Tabs";
import type { ClubMatch } from "../../lib/clubData";

const squad = vi.hoisted(() => ["a", "b", "h"].map((id, i) => ({ id, firstName: id, number: i + 1 })));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [] }) }));
// (the player links: the href the router would build, /jugadores/<id>?season=<season>)
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, search, className }: { children: React.ReactNode; to: string; params?: Record<string, string>; search?: { season?: string }; className?: string }) => (
    <a className={className} href={to.replace("$playerId", params?.playerId ?? "").replace("$matchId", params?.matchId ?? "") + (search?.season ? `?season=${search.season}` : "")}>
      {children}
    </a>
  ),
}));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: [], players: squad, loading: false, error: null }) }));
afterEach(() => vi.useRealTimers());

it("replaces the player immediately, puts the outgoing player's stats on the bench and permits inspecting them", async () => {
  const start = Date.now() - 25 * 60_000;
  const players = squad;
  const match: ClubMatch = { id: "m", date: start, duration: 60, status: "scheduled", starters: ["a", "b"], bench: ["h"], events: [
    { id: "g1", type: "goal", minute: 5, playerId: "a", assistPlayerId: "b" },
    { id: "g2", type: "goal", minute: 8, playerId: "a", assistPlayerId: "b" },
    { id: "y", type: "yellow_card", minute: 10, playerId: "a" },
    { id: "s", type: "substitution", minute: 20, playerId: "a", inPlayerId: "h" },
  ] };
  const { container, rerender } = render(<CampoTab match={match} players={players} nameOf={(id) => id.toUpperCase()} live />);
  const pitch = container.querySelector(".fc-pitch") as HTMLElement;
  expect(within(pitch).getByRole("button", { name: /^H, dorsal/ })).toBeInTheDocument();
  expect(within(pitch).queryByRole("button", { name: /^A, dorsal/ })).toBeNull();
  const bench = container.querySelector(".fc-bench") as HTMLElement;
  expect(within(bench).getByRole("img", { name: "2 goles" })).toBeInTheDocument();
  expect(within(bench).getByRole("img", { name: "1 amarilla" })).toBeInTheDocument();
  expect(within(bench).getByText(/20′/)).toBeInTheDocument();
  expect(within(pitch).getByRole("img", { name: "2 asistencias" })).toBeInTheDocument();
  await userEvent.setup().click(within(bench).getByRole("button"));
  expect(container.querySelector(".fc-pinfo")).toHaveTextContent("1 · A");
  rerender(<CampoTab match={{ ...match, events: [...match.events!, { id: "red", type: "red_card", minute: 24, playerId: "h" }] }} players={players} nameOf={(id) => id.toUpperCase()} live />);
  expect(within(pitch).queryByRole("button", { name: /^H, dorsal/ })).toBeNull();
  expect(screen.getByText(/Expulsado · 4′ · entró 20′/)).toBeInTheDocument();
});

it("the player card and the minutes chart name each one as a link to his page, in the match's season", async () => {
  const start = Date.now() - 3 * 3_600_000;
  const match: ClubMatch = { id: "m", seasonId: "t1", date: start, duration: 50, status: "finished", goalsFor: 1, goalsAgainst: 0, starters: ["a", "b"], bench: ["h"], events: [{ id: "g1", type: "goal", minute: 5, playerId: "a" }],
    ledger: { a: { minutes: 50, played: true, started: true, benched: false, notCalled: false, subIn: 0, subOut: 0, dismissed: false, stints: [[0, 50]], exchanges: [], goals: 1, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0 } } } as unknown as ClubMatch;
  const { container } = render(<CampoTab match={match} players={squad} nameOf={(id) => id.toUpperCase()} live={false} />);
  const card = container.querySelector(".fc-pinfo") as HTMLElement;
  expect(within(card).getByRole("link", { name: "A" })).toHaveAttribute("href", "/jugadores/a?season=t1");
  const chart = container.querySelector(".fc-stints") as HTMLElement;
  expect(within(chart).getByRole("link", { name: "A" })).toHaveAttribute("href", "/jugadores/a?season=t1");
  // (the pitch and the bench stay buttons that pick the card: no link inside a button)
  expect(container.querySelector(".fc-pitch a, .fc-bench a")).toBeNull();
});

it("the crónica links every one of ours it names, once per chapter; an unknown id stays text", () => {
  const match: ClubMatch = { id: "m", seasonId: "t1", rival: "MAD SKY", date: Date.now() - 86_400_000, duration: 50, status: "finished", goalsFor: 2, goalsAgainst: 0, version: 2, events: [
    { id: "g1", type: "goal", minute: 5, playerId: "a", assistPlayerId: "b" },
    { id: "s1", type: "substitution", minute: 20, playerId: "b", inPlayerId: "h" },
    { id: "g2", type: "goal", minute: 30, playerId: "zz" },
  ] };
  const { container } = render(<CronicaTab match={match} matches={[match]} players={squad} nameOf={(id) => id.toUpperCase()} />);
  const [goal, sub, other] = [...container.querySelectorAll<HTMLElement>(".fc-ch")];
  expect(within(goal).getByRole("link", { name: "A" })).toHaveAttribute("href", "/jugadores/a?season=t1");
  expect(within(goal).getByRole("link", { name: "B" })).toHaveAttribute("href", "/jugadores/b?season=t1");
  expect(goal.querySelector("p")).toHaveTextContent("A marca, con asistencia de B. 1–0.");
  // «Entra H» (title) · «Sale B.» (sentence): each linked where it is said
  expect(within(sub.querySelector("h3")!).getByRole("link", { name: "H" })).toHaveAttribute("href", "/jugadores/h?season=t1");
  expect(within(sub.querySelector("p")!).getByRole("link", { name: "B" })).toBeInTheDocument();
  expect(within(other).queryByRole("link")).toBeNull();
  expect(other.querySelector("p")).toHaveTextContent("ZZ marca. 2–0.");
});

it("two of ours with the same name in one change: «Entra» links who comes on, «Sale» who goes off", () => {
  const match: ClubMatch = { id: "m", seasonId: "t1", rival: "R", date: Date.now() - 86_400_000, duration: 50, status: "finished", goalsFor: 1, goalsAgainst: 0, version: 2, events: [
    { id: "g1", type: "goal", minute: 5, playerId: "a" },
    { id: "s1", type: "substitution", minute: 20, playerId: "b", inPlayerId: "h" },
  ] };
  const { container } = render(<CronicaTab match={match} matches={[match]} players={squad} nameOf={(id) => (id === "a" ? "A" : "PEPE")} />);
  const sub = container.querySelectorAll<HTMLElement>(".fc-ch")[1];
  expect(within(sub.querySelector("h3")!).getByRole("link", { name: "PEPE" })).toHaveAttribute("href", "/jugadores/h?season=t1");
  expect(within(sub.querySelector("p")!).getByRole("link", { name: "PEPE" })).toHaveAttribute("href", "/jugadores/b?season=t1");
});

it("the Directo feed reads a live-stamped goal in football's minute (0:07 → 1′); a typed minute as typed", () => {
  const match: ClubMatch = { id: "m", date: Date.now(), duration: 50, status: "scheduled", events: [
    { id: "g1", type: "goal", minute: 0, elapsedSeconds: 7, playerId: "a" },
    { id: "g2", type: "opponent_goal", minute: 19 },
  ] };
  const { container } = render(<DirectoTab match={match} nameOf={(id) => id.toUpperCase()} />);
  const rows = [...container.querySelectorAll(".fc-feed li b")].map((b) => b.textContent);
  expect(rows).toEqual(["19′", "1′"]);
});

// One «siete» (M6): before the acta, members see the pizarra's official seven (the `official` prop, read
// only for them), badged, with a note when the convocatoria has another seven. Fans: the convocatoria.
it("before the acta: the pizarra's official seven, its badge and the note when the convocatoria differs", () => {
  const match: ClubMatch = { id: "m", seasonId: "t1", date: Date.now() + 86_400_000, status: "scheduled", version: 2, starters: ["a"], bench: ["b"], events: [] };
  const nameOf = (id: string) => id.toUpperCase();
  // a fan (no official read): the convocatoria's titulares, no badge
  const { container, rerender } = render(<CampoTab match={match} players={squad} nameOf={nameOf} live={false} />);
  const pitch = () => container.querySelector(".fc-pitch") as HTMLElement;
  expect(within(pitch()).getByRole("button", { name: /^A, dorsal/ })).toBeInTheDocument();
  expect(screen.queryByText("Siete oficial de la pizarra")).toBeNull();
  // a member: the official's seven on the pitch, the convocatoria's other titular on the bench
  rerender(<CampoTab match={match} players={squad} nameOf={nameOf} live={false} official={["h", "b"]} />);
  expect(screen.getByText("Siete oficial de la pizarra")).toBeInTheDocument();
  expect(within(pitch()).getByRole("button", { name: /^H, dorsal/ })).toBeInTheDocument();
  expect(within(pitch()).queryByRole("button", { name: /^A, dorsal/ })).toBeNull();
  expect(within(container.querySelector(".fc-bench") as HTMLElement).getByText("A")).toBeInTheDocument();
  expect(screen.getByText("La convocatoria tiene otro siete: con A en lugar de H y B.")).toBeInTheDocument();
  // they agree: the badge, no note
  rerender(<CampoTab match={{ ...match, starters: ["b", "h"], bench: [] }} players={squad} nameOf={nameOf} live={false} official={["h", "b"]} />);
  expect(screen.getByText("Siete oficial de la pizarra")).toBeInTheDocument();
  expect(screen.queryByText(/La convocatoria tiene otro siete/)).toBeNull();
  // no convocatoria yet: the official still shows (no «se publica con el acta»)
  rerender(<CampoTab match={{ ...match, starters: [], bench: [] }} players={squad} nameOf={nameOf} live={false} official={["h", "b"]} />);
  expect(within(pitch()).getByRole("button", { name: /^H, dorsal/ })).toBeInTheDocument();
  expect(screen.getByText("La convocatoria aún no tiene siete: este es el de la pizarra.")).toBeInTheDocument();
});

it("once played (or live) the official is never shown: the acta's seven", () => {
  const match: ClubMatch = { id: "m", seasonId: "t1", date: Date.now() - 3 * 3_600_000, duration: 50, status: "finished", goalsFor: 0, goalsAgainst: 0, starters: ["a"], bench: ["b"], events: [] };
  const { container } = render(<CampoTab match={match} players={squad} nameOf={(id) => id.toUpperCase()} live={false} official={["h"]} />);
  expect(screen.queryByText("Siete oficial de la pizarra")).toBeNull();
  expect(within(container.querySelector(".fc-pitch") as HTMLElement).getByRole("button", { name: /^A, dorsal/ })).toBeInTheDocument();
});

// C3: after the acta the pitch draws where each one played (ledger positionsPlayed) and the system played
// (match.system); without position data, the orientative 1-3-2-1 of always.
type Pp = Partial<Record<string, number>>;
const ledgerRow = (pp: Pp | undefined, o: { minutes?: number; started?: boolean; estimated?: boolean; inFor?: string; at?: number } = {}) => ({
  minutes: o.minutes ?? 50, played: true, started: o.started ?? true, benched: !(o.started ?? true), notCalled: false, subIn: o.inFor ? 1 : 0, subOut: 0, dismissed: false,
  stints: [{ from: o.inFor ? (o.at ?? 25) : 0, to: 50 }], exchanges: o.inFor ? [{ minute: o.at ?? 25, with: o.inFor, direction: "in" }] : [],
  goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0,
  ...(pp ? { positionsPlayed: pp } : {}),
  ...(o.estimated ? { positionsEstimated: true } : {}),
});
const played = (extra: Partial<ClubMatch>, ledger: Record<string, unknown>): ClubMatch =>
  ({ id: "m", seasonId: "t1", date: Date.now() - 3 * 3_600_000, duration: 50, status: "finished", goalsFor: 0, goalsAgainst: 0, version: 2, starters: ["a", "b"], bench: ["h"], events: [], ledger, ...extra }) as unknown as ClubMatch;
const pitchOf = (c: HTMLElement) => c.querySelector(".fc-pitch") as HTMLElement;
const dotOf = (c: HTMLElement, name: RegExp) => within(pitchOf(c)).getByRole("button", { name });

it("after the acta: each one at the code he played, the system's chip and «Posiciones de la pizarra oficial»", () => {
  const match = played({ system: "2-3-1" }, { a: ledgerRow({ POR: 50 }), b: ledgerRow({ MC: 10, DC: 40 }) });
  const { container } = render(<CampoTab match={match} players={squad} nameOf={(id) => id.toUpperCase()} live={false} />);
  expect(container.querySelector(".fc-sys")).toHaveTextContent("Sistema 2-3-1 · Clásico");
  expect(screen.getByText("Posiciones de la pizarra oficial")).toBeInTheDocument();
  // b played most as punta: the 2-3-1's DC spot (50, 22) on the pitch box, not the orientative 2nd slot
  const b = dotOf(container, /^B, dorsal 2, jugó de punta,/);
  expect(b.style.left).toBe("50%");
  expect(b.style.top).toBe("23.9%");
  expect(dotOf(container, /^A, dorsal 1, jugó de portero,/).style.top).toBe("86.7%");
  expect(container.querySelector(".fc-pitch-sys")).toHaveTextContent("2-3-1");
  expect(container.querySelector(".fc-note")?.textContent).not.toMatch(/orientativas/);
  // the card says where he played
  expect(container.querySelector(".fc-pinfo .pos")).toHaveTextContent("Jugó de Portero (POR) 50′");
});

it("estimated by the preferida (no official board): no system chip, «Posiciones estimadas por su preferida»", () => {
  const match = played({ system: null }, { a: ledgerRow({ POR: 50 }, { estimated: true }), b: ledgerRow({ DFC: 50 }, { estimated: true }) });
  const { container } = render(<CampoTab match={match} players={squad} nameOf={(id) => id.toUpperCase()} live={false} />);
  expect(screen.getByText("Posiciones estimadas por su preferida")).toBeInTheDocument();
  expect(container.querySelector(".fc-sys")).toBeNull();
  expect(dotOf(container, /^B, dorsal 2, jugó de central \(estimado por su preferida\),/)).toBeInTheDocument();
  expect(container.querySelector(".fc-pinfo .pos")).toHaveTextContent("Jugó de Portero (POR) 50′ · estimado por su preferida");
});

it("a free-mode board reads «Libre · sin sistema fijo»", () => {
  const match = played({ system: "libre" }, { a: ledgerRow({ POR: 50 }), b: ledgerRow({ MC: 50 }) });
  const { container } = render(<CampoTab match={match} players={squad} nameOf={(id) => id.toUpperCase()} live={false} />);
  expect(container.querySelector(".fc-sys")).toHaveTextContent("Libre · sin sistema fijo");
});

it("an old acta without positions keeps the orientative 1-3-2-1 and its copy", () => {
  const match = played({}, { a: ledgerRow(undefined), b: ledgerRow(undefined) });
  const { container } = render(<CampoTab match={match} players={squad} nameOf={(id) => id.toUpperCase()} live={false} />);
  expect(container.querySelector(".fc-sys")).toBeNull();
  expect(screen.queryByText(/Posiciones de la pizarra oficial|estimadas por su preferida/)).toBeNull();
  expect(container.querySelector(".fc-note")).toHaveTextContent(/^Posiciones orientativas\. Minutos calculados desde el siete inicial y cada entrada y salida\.$/);
  const b = dotOf(container, /^B, dorsal 2, 0 goles/);
  expect([b.style.left, b.style.top]).toEqual(["20%", "68%"]);
});

it("a substitute who played elsewhere than his slot is a ring on the pitch; the bench reads the shown minute", () => {
  const match = played(
    { system: "2-3-1", events: [{ id: "s", type: "substitution", minute: 18, elapsedSeconds: 18 * 60 + 30, playerId: "b", inPlayerId: "h" }] },
    { a: ledgerRow({ POR: 50 }), b: ledgerRow({ DC: 18.5 }, { minutes: 18.5 }), h: ledgerRow({ EI: 31.5 }, { started: false, minutes: 31.5, inFor: "b", at: 18.5 }) },
  );
  const { container } = render(<CampoTab match={match} players={squad} nameOf={(id) => id.toUpperCase()} live={false} />);
  const h = dotOf(container, /^H, dorsal 3, entró en el 19′ y jugó de extremo izquierdo,/);
  expect(h).toHaveClass("sub");
  expect(container.querySelector(".fc-note")).toHaveTextContent("Con anillo, quien entró desde el banquillo y jugó en otra posición.");
  // the bench chip: the 19′ the web showed live (eventMinute), not the stored 18.5
  expect(within(container.querySelector(".fc-bench") as HTMLElement).getByText(/entró 19′/)).toBeInTheDocument();
});

it("a substitute at the slot he took stays on the bench list only", () => {
  const match = played({ system: "2-3-1" }, { a: ledgerRow({ POR: 50 }), b: ledgerRow({ DC: 25 }, { minutes: 25 }), h: ledgerRow({ DC: 25 }, { started: false, minutes: 25, inFor: "b", at: 25 }) });
  const { container } = render(<CampoTab match={match} players={squad} nameOf={(id) => id.toUpperCase()} live={false} />);
  expect(within(pitchOf(container)).queryByRole("button", { name: /^H, dorsal/ })).toBeNull();
  expect(within(container.querySelector(".fc-bench") as HTMLElement).getByText(/entró 25′/)).toBeInTheDocument();
  expect(container.querySelector(".fc-note")?.textContent).not.toMatch(/anillo/);
});

it("before the acta, a member sees the official board's system and its slots; a fan sees neither", () => {
  const match: ClubMatch = { id: "m", seasonId: "t1", date: Date.now() + 86_400_000, status: "scheduled", version: 2, starters: ["a", "b"], bench: [], events: [] };
  const nameOf = (id: string) => id.toUpperCase();
  const { container, rerender } = render(<CampoTab match={match} players={squad} nameOf={nameOf} live={false} />);
  expect(container.querySelector(".fc-sys")).toBeNull();
  expect(container.querySelector(".fc-note")).toHaveTextContent(/^Posiciones orientativas\./);
  rerender(<CampoTab match={match} players={squad} nameOf={nameOf} live={false} official={["a", "b"]} board={{ system: "3-2-1", codes: { a: "POR", b: "LI" } }} />);
  expect(screen.getByText("Siete oficial de la pizarra")).toBeInTheDocument();
  expect(container.querySelector(".fc-sys")).toHaveTextContent("Sistema 3-2-1 · Línea de 3");
  // (not played yet: his slot on the board, never «jugó de»)
  const b = dotOf(container, /^B, dorsal 2, en la pizarra: lateral izquierdo,/);
  expect([b.style.left, b.style.top]).toEqual(["21.8%", "66.9%"]);
  expect(container.querySelector(".fc-note")?.textContent).not.toMatch(/orientativas/);
  expect(within(pitchOf(container)).queryByRole("button", { name: /jugó/ })).toBeNull();
  // a member with a board but no official seven drawn: no system chip over the orientative 1-3-2-1
  rerender(<CampoTab match={match} players={squad} nameOf={nameOf} live={false} official={null} board={{ system: "3-2-1", codes: {} }} />);
  expect(container.querySelector(".fc-sys")).toBeNull();
  expect(container.querySelector(".fc-note")).toHaveTextContent(/^Posiciones orientativas\./);
});

it("after the acta, a starter without a code: «Algunas posiciones, orientativas», never «de la pizarra oficial»", () => {
  const match = played({ system: "2-3-1" }, { a: ledgerRow({ POR: 50 }), b: ledgerRow(undefined) });
  render(<CampoTab match={match} players={squad} nameOf={(id) => id.toUpperCase()} live={false} />);
  expect(screen.getByText("Algunas posiciones, orientativas")).toBeInTheDocument();
  expect(screen.queryByText("Posiciones de la pizarra oficial")).toBeNull();
});
