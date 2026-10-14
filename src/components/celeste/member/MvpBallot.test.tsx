import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ClubMatch } from "../../../lib/clubData";

// «Tu voto»: the shared MVP ballot. The real write (vestuario/writes.ts) runs on a stubbed Firestore, so
// the test sees the exact document and payload; my current vote comes from a stubbed listener.
const fs = vi.hoisted(() => ({ setDoc: vi.fn(async (_ref: unknown, _data: unknown) => undefined) }));
const live = vi.hoisted(() => ({ vote: "", asked: [] as unknown[] }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  setDoc: fs.setDoc,
  serverTimestamp: () => "SERVER_TIME",
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(),
}));
vi.mock("../../../firebase", () => ({ db: {} }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" }, profile: { nickname: "ADRI", playerId: "adri" } }) }));
vi.mock("../../../pages/vestuario/live", () => ({
  useMyMvpVote: (matchId: string, uid: string) => {
    live.asked = [matchId, uid];
    return { data: live.vote };
  },
}));
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => `No se pudo guardar: ${(e as Error).message}` }));

const { MvpBallot } = await import("./MvpBallot");

const NOW = Date.UTC(2026, 10, 9, 12);
const played = { minutes: 50, played: true };
const MATCH = {
  id: "j5",
  status: "finished",
  voteClosesAt: NOW + 3_600_000,
  ledger: { raul: played, erik: played, adri: played, hugo: { minutes: 0, played: false } },
} as unknown as ClubMatch;
const name = (id: string) => id.toUpperCase();
const ballot = (extra: Partial<Parameters<typeof MvpBallot>[0]> = {}) => <MvpBallot match={MATCH} now={NOW} uid="u1" counts={{ raul: 2, adri: 2, erik: 1 }} nameOf={name} {...extra} />;

beforeEach(() => {
  fs.setDoc.mockReset();
  fs.setDoc.mockResolvedValue(undefined);
  live.vote = "";
});

it("open: one radio per player who played, most voted first, then by name", () => {
  render(ballot());
  expect(live.asked).toEqual(["j5", "u1"]);
  const group = screen.getByRole("group", { name: "Tu voto" });
  expect(within(group).getAllByRole("radio").map((r) => r.closest("label")?.textContent)).toEqual(["ADRI", "RAUL", "ERIK"]);
  expect(screen.queryByRole("radio", { name: "HUGO" })).toBeNull();
  expect(screen.getByRole("button", { name: "Votar al MVP" })).toBeDisabled();
});

it("pick and vote: writes matches/{match}/votes/{uid}", () => {
  render(ballot());
  fireEvent.click(screen.getByRole("radio", { name: "RAUL" }));
  expect(screen.getByRole("radio", { name: "RAUL" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Votar al MVP" }));
  expect(fs.setDoc).toHaveBeenCalledTimes(1);
  expect(fs.setDoc).toHaveBeenCalledWith({ path: "matches/j5/votes/u1" }, { playerId: "raul", voterName: "ADRI", at: "SERVER_TIME" });
});

it("my vote is checked and saved; another pick offers «Cambiar mi voto»", () => {
  live.vote = "erik";
  render(ballot());
  expect(screen.getByRole("radio", { name: "ERIK" })).toBeChecked();
  expect(screen.getByRole("button", { name: "Voto guardado" })).toBeDisabled();
  fireEvent.click(screen.getByRole("radio", { name: "ADRI" }));
  fireEvent.click(screen.getByRole("button", { name: "Cambiar mi voto" }));
  expect(fs.setDoc).toHaveBeenCalledWith({ path: "matches/j5/votes/u1" }, { playerId: "adri", voterName: "ADRI", at: "SERVER_TIME" });
});

it("the team's count beside the button, when the host asks for it", () => {
  const { rerender } = render(ballot({ total: 1 }));
  expect(screen.getByText("1 voto del equipo")).toBeInTheDocument();
  rerender(ballot({ total: 5 }));
  expect(screen.getByText("5 votos del equipo")).toBeInTheDocument();
  rerender(ballot());
  expect(screen.queryByText(/del equipo/)).toBeNull();
});

it("closed (at the deadline, without one, before the acta) or nobody played: no ballot", () => {
  const { container, rerender } = render(ballot({ now: MATCH.voteClosesAt! }));
  expect(container).toBeEmptyDOMElement();
  rerender(ballot({ match: { ...MATCH, voteClosesAt: undefined } }));
  expect(container).toBeEmptyDOMElement();
  rerender(ballot({ match: { ...MATCH, status: "scheduled" } }));
  expect(container).toBeEmptyDOMElement();
  rerender(ballot({ match: { ...MATCH, ledger: {} } }));
  expect(container).toBeEmptyDOMElement();
});

it("a refused vote says why", async () => {
  fs.setDoc.mockRejectedValueOnce(new Error("permission-denied"));
  render(ballot());
  fireEvent.click(screen.getByRole("radio", { name: "ERIK" }));
  fireEvent.click(screen.getByRole("button", { name: "Votar al MVP" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar: permission-denied");
});
