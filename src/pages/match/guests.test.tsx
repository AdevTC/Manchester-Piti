import { render, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import { withGuestNames } from "../../lib/derived/guests";
import { CampoTab, CronicaTab, DirectoTab } from "./Tabs";

// Invitados en el acta on the match page: «Rafa (invitado)» wherever a member's name would be, a dot with
// his name and «Inv.» on the Campo, and never a PlayerLink (a guest has no page).
const squad = vi.hoisted(() => ["a", "b", "h"].map((id, i) => ({ id, firstName: id, number: i + 1 })));
const linked = vi.hoisted(() => ({ ids: [] as string[] }));
vi.mock("../../context/SeasonContext", () => ({ useSeason: () => ({ seasons: [] }) }));
vi.mock("../../lib/clubData", async (orig) => ({ ...(await orig<typeof import("../../lib/clubData")>()), useClubData: () => ({ matches: [], players: squad, loading: false, error: null }) }));
vi.mock("../../components/celeste/PlayerLink", () => ({
  PlayerLink: ({ id, children }: { id: string; children?: ReactNode }) => {
    linked.ids.push(id);
    return <a href={`/jugadores/${id}`}>{children ?? id.toUpperCase()}</a>;
  },
}));
beforeEach(() => {
  linked.ids = [];
});

const GUESTS = [{ id: "g1", name: "Rafa" }];
const finished = (events: NonNullable<ClubMatch["events"]>): ClubMatch =>
  ({ id: "m", seasonId: "t1", rival: "MAD SKY", date: Date.now() - 86_400_000, duration: 50, status: "finished", goalsFor: 2, goalsAgainst: 0, version: 2, guests: GUESTS, starters: ["a", "guest:g1"], bench: ["b"], events }) as ClubMatch;
const nameOf = (m: ClubMatch) => withGuestNames(m, (id) => id.toUpperCase());

describe("the match page · invitados", () => {
  it("the crónica names the guest «Rafa (invitado)» as plain text and keeps the member's link", () => {
    const match = finished([
      { id: "e1", type: "goal", minute: 5, playerId: "guest:g1", assistPlayerId: "a" },
      { id: "e2", type: "goal", minute: 9, playerId: "a", assistPlayerId: "guest:g1" },
    ]);
    const { container } = render(<CronicaTab match={match} matches={[match]} players={squad} nameOf={nameOf(match)} />);
    const [first, second] = [...container.querySelectorAll<HTMLElement>(".fc-ch")];
    expect(first.querySelector("p")).toHaveTextContent("Rafa (invitado) marca, con asistencia de A. 1–0.");
    expect(second.querySelector("p")).toHaveTextContent("A marca, con asistencia de Rafa (invitado). 2–0.");
    expect(within(first).queryByRole("link", { name: /Rafa/ })).toBeNull();
    expect(within(first).getByRole("link", { name: "A" })).toBeInTheDocument();
    expect(linked.ids).not.toContain("guest:g1");
  });

  it("the live feed says «Gol» by «Rafa (invitado)», with no link", () => {
    const match = { ...finished([{ id: "e1", type: "goal", minute: 5, playerId: "guest:g1", assistPlayerId: "a" }]), status: "scheduled" } as ClubMatch;
    const { container } = render(<DirectoTab match={match} nameOf={nameOf(match)} />);
    const row = container.querySelector(".ml-ev") as HTMLElement;
    expect(row).toHaveTextContent("Rafa (invitado)");
    expect(row).toHaveTextContent(/Gol/);
    expect(within(row).queryByRole("link", { name: /Rafa/ })).toBeNull();
    expect(linked.ids).toEqual(["a"]);
  });

  it("on the Campo the guest gets a dot with his name and «Inv.», a dashed «guest» ring, and no link", () => {
    const match = finished([{ id: "e1", type: "goal", minute: 5, playerId: "guest:g1" }]);
    const { container } = render(<CampoTab match={match} players={squad} nameOf={nameOf(match)} live={false} />);
    const pitch = container.querySelector(".fc-pitch") as HTMLElement;
    const dot = within(pitch).getByRole("button", { name: /^Rafa \(invitado\), invitado/ });
    expect(dot).toHaveClass("guest");
    expect(dot.querySelector(".fc-number")).toHaveTextContent("Inv.");
    expect(dot.querySelector("b")).toHaveTextContent(/^Rafa$/);
    expect(linked.ids).not.toContain("guest:g1");
  });
});
