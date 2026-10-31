import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ClubMatch, Participation } from "../../../../../lib/clubData";
import type { PlayerDoc } from "../../../../../lib/schemas";
import { MODEL_VERSION } from "../../../../../lib/rating/constants";
import { buildMe, type Answer } from "../../me";
import { riverCol } from "../partidosView";
import { PhoneRiver, Ribbon, type Rsvp } from "./River";
import { Lista } from "./Lista";

// One played (J1, 4,7, lost 1–8), one from outside (J2, lost 3–8) and five to come.
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 18, 10);
const row = (o: Partial<Participation>): Participation => ({ minutes: 0, started: false, benched: false, notCalled: false, played: false, stints: [], goals: 0, assists: 0, ...o }) as Participation;
const done = (id: string, day: number, gf: number, ga: number, ledger: Record<string, Participation>, nts: Record<string, number>) =>
  ({ id, seasonId: "t1", rival: `Rival ${id}`, home: true, status: "finished", date: T0 + day * DAY, duration: 50, goalsFor: gf, goalsAgainst: ga, events: [], ledger, notas: { model: MODEL_VERSION, rival: 1, players: Object.fromEntries(Object.entries(nts).map(([k, nota]) => [k, { nota, minutes: 40, weight: 0.8, narrated: false }])) } }) as unknown as ClubMatch;
const matches = [
  done("j1", 0, 1, 8, { jordi: row({ played: true, started: true, minutes: 40, stints: [{ from: 0, to: 40 }] }) }, { jordi: 4.7 }),
  done("j2", 7, 3, 8, { jordi: row({ benched: true }) }, {}),
  ...Array.from({ length: 5 }, (_, i) => ({ id: `u${i}`, seasonId: "t1", rival: `Rival u${i}`, home: false, status: "scheduled", date: T0 + (21 + i * 7) * DAY, events: [] }) as unknown as ClubMatch),
];
const me = buildMe({ playerId: "jordi", seasonId: "t1", matches, players: [{ id: "jordi", number: 28, shirtName: "JORDI", seasons: ["t1"], active: true } as unknown as PlayerDoc], seasons: [{ id: "t1", name: "Temporada 1" }], mvpResults: new Map(), standings: [], now: T0 + 13 * DAY, answers: new Map<string, Answer>(), card: null });
const rows = me.rows;
const cols = rows.map(riverCol);

function props(over: Partial<Parameters<typeof Ribbon>[0]> = {}) {
  const rsvp: Rsvp = { matchId: "u0", question: "¿Vas a Rival u0?", body: "J3 · contestan 6 de 16", value: null, busy: false, pick: vi.fn() };
  return { rows, cols, on: 0, pick: vi.fn(), scrub: vi.fn(), scrubEnd: vi.fn(), rsvp, average: me.figures.average, played: me.figures.played, label: "Las 7 jornadas de la Temporada 1", ...over };
}

describe("the river", () => {
  it("draws every jornada on the ribbon, the one in focus pressed, and focuses the one tapped", () => {
    const p = props();
    render(<Ribbon {...p} />);
    const list = screen.getByRole("list", { name: "Las 7 jornadas de la Temporada 1" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(7);
    const j1 = screen.getByRole("button", { name: /^J1, Rival j1, tu nota 4,7, Baja, 40 minutos, perdimos 1–8$/ });
    expect(j1).toHaveAttribute("aria-pressed", "true");
    expect(j1).toHaveTextContent("4,7");
    expect(j1).toHaveTextContent("Baja");
    fireEvent.click(screen.getByRole("button", { name: /^J2, Rival j2, no jugaste, perdimos 3–8$/ }));
    expect(p.pick).toHaveBeenCalledWith(1);
  });
  it("answers the next jornada's convocatoria on the ribbon", () => {
    const p = props();
    render(<Ribbon {...p} />);
    const group = screen.getByRole("radiogroup", { name: "¿Vas a Rival u0?" });
    fireEvent.click(within(group).getByRole("radio", { name: "Voy" }));
    expect(p.rsvp?.pick).toHaveBeenCalledWith("yes");
  });
  it("one nota: no «Tu media» line across the ribbon yet", () => {
    const { container } = render(<Ribbon {...props()} />);
    expect(container.querySelector(".tt-avg")).toBeNull();
  });
  it("on the phone: the next on top with his answer, the past from the newest, the future folded", () => {
    const p = props({ on: null });
    render(<PhoneRiver {...p} />);
    const items = screen.getAllByRole("button", { name: /^J\d/ });
    expect(items.map((b) => b.getAttribute("aria-label")?.split(",")[0])).toEqual(["J3", "J2", "J1"]);
    expect(screen.getByRole("radiogroup", { name: "¿Vas a Rival u0?" })).toBeInTheDocument();
    const more = screen.getByRole("button", { name: /Más adelante: 4 jornadas, de la J4 a la J7/ });
    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("button", { name: /^J\d/ })).toHaveLength(7);
  });
});

describe("the list", () => {
  it("filters Jugados / Todos / Por jugar and opens a jornada", () => {
    const pick = vi.fn();
    let filter: "jugados" | "todos" | "porjugar" = "jugados";
    const setFilter = vi.fn((f: typeof filter) => (filter = f));
    const { rerender } = render(<Lista rows={rows} filter={filter} setFilter={setFilter} phone={false} pick={pick} nextAnswer={null} caption="Tus partidos de la Temporada 1" />);
    const table = screen.getByRole("table", { name: "Tus partidos de la Temporada 1" });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    fireEvent.click(screen.getByRole("radio", { name: "Todos · 7" }));
    expect(setFilter).toHaveBeenCalledWith("todos");
    rerender(<Lista rows={rows} filter={filter} setFilter={setFilter} phone={false} pick={pick} nextAnswer={null} caption="Tus partidos de la Temporada 1" />);
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(8);
    expect(screen.getByText("P · 3–8")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir tu J2 contra Rival j2" }));
    expect(pick).toHaveBeenCalledWith(1);
  });
});
