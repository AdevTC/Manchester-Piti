import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

// «Voy · Duda · No puedo»: the shared convocatoria control. The real write (vestuario/writes.ts) runs on
// a stubbed Firestore, so the test sees the exact document and payload it sends.
const fs = vi.hoisted(() => ({ setDoc: vi.fn(async (_ref: unknown, _data: unknown) => undefined) }));
const auth = vi.hoisted(() => ({ signedIn: true }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  setDoc: fs.setDoc,
  serverTimestamp: () => "SERVER_TIME",
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(),
}));
vi.mock("../../../firebase", () => ({ db: {} }));
vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => (auth.signedIn ? { user: { uid: "u1" }, profile: { nickname: "ADRI", playerId: "adri" } } : { user: null, profile: null }),
}));
vi.mock("../../../lib/clubApi", () => ({ apiError: (e: unknown) => `No se pudo guardar: ${(e as Error).message}` }));

const { RsvpSwitch } = await import("./RsvpSwitch");

const NOW = Date.UTC(2026, 10, 6, 12);
const MATCH = { id: "j8", status: "scheduled", date: NOW + 2 * 86_400_000 } as const;
const radios = () => within(screen.getByRole("radiogroup", { name: "Tu respuesta a la convocatoria" })).getAllByRole("radio");

beforeEach(() => {
  fs.setDoc.mockReset();
  fs.setDoc.mockResolvedValue(undefined);
  auth.signedIn = true;
});

it("open: three answers, the current one checked (and with a tick), one tab stop", () => {
  render(<RsvpSwitch match={MATCH} now={NOW} answer="maybe" id="vx-rsvp" />);
  expect(screen.getByRole("radiogroup")).toHaveAttribute("id", "vx-rsvp");
  const [yes, maybe, no] = radios();
  expect([yes, maybe, no].map((r) => r.textContent)).toEqual(["Voy", "Duda", "No puedo"]);
  expect([yes, maybe, no].map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
  expect(maybe.querySelector("svg")).not.toBeNull();
  expect([yes, maybe, no].map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
});

it("no answer yet: nothing checked, the first one takes the tab stop", () => {
  render(<RsvpSwitch match={MATCH} now={NOW} answer={undefined} />);
  expect(radios().map((r) => [r.getAttribute("aria-checked"), r.tabIndex])).toEqual([
    ["false", 0],
    ["false", -1],
    ["false", -1],
  ]);
});

it("a tap writes the member's availability: matchPrivate/{match}/availability/{uid}", () => {
  render(<RsvpSwitch match={MATCH} now={NOW} answer="yes" />);
  fireEvent.click(screen.getByRole("radio", { name: "No puedo" }));
  expect(fs.setDoc).toHaveBeenCalledTimes(1);
  expect(fs.setDoc).toHaveBeenCalledWith({ path: "matchPrivate/j8/availability/u1" }, { response: "no", name: "ADRI", playerId: "adri", at: "SERVER_TIME" });
});

it("keyboard: the arrows move and choose, Home and End jump to the ends", () => {
  render(<RsvpSwitch match={MATCH} now={NOW} answer="yes" />);
  const [yes, maybe, no] = radios();
  yes.focus();
  fireEvent.keyDown(yes, { key: "ArrowRight" });
  expect(maybe).toHaveFocus();
  fireEvent.keyDown(maybe, { key: "End" });
  expect(no).toHaveFocus();
  fireEvent.keyDown(no, { key: "ArrowDown" });
  expect(yes).toHaveFocus();
  fireEvent.keyDown(yes, { key: "ArrowLeft" });
  expect(no).toHaveFocus();
  fireEvent.keyDown(no, { key: "Home" });
  expect(yes).toHaveFocus();
  expect(fs.setDoc.mock.calls.map((c) => (c[1] as { response: string }).response)).toEqual(["maybe", "no", "yes", "no", "yes"]);
  fireEvent.keyDown(yes, { key: "Tab" });
  expect(fs.setDoc).toHaveBeenCalledTimes(5);
});

it("a refused write says why, next to the control", async () => {
  fs.setDoc.mockRejectedValueOnce(new Error("permission-denied"));
  render(<RsvpSwitch match={MATCH} now={NOW} answer={undefined} />);
  fireEvent.click(screen.getByRole("radio", { name: "Voy" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar: permission-denied");
});

it("without a signed-in member nothing is written", () => {
  auth.signedIn = false;
  render(<RsvpSwitch match={MATCH} now={NOW} answer={undefined} />);
  fireEvent.click(screen.getByRole("radio", { name: "Voy" }));
  expect(fs.setDoc).not.toHaveBeenCalled();
});

it("closed at the match's date (the rules refuse it from then on), and before it has a date", () => {
  const { rerender } = render(<RsvpSwitch match={MATCH} now={MATCH.date} answer="yes" />);
  expect(screen.queryByRole("radiogroup")).toBeNull();
  expect(screen.getByText("La convocatoria se cerró a la hora del partido.")).toBeInTheDocument();
  rerender(<RsvpSwitch match={{ ...MATCH, status: "postponed" }} now={NOW} answer="yes" />);
  expect(screen.queryByRole("radiogroup")).toBeNull();
  rerender(<RsvpSwitch match={{ id: "j9", status: "scheduled" }} now={NOW} answer={undefined} />);
  expect(screen.getByText("La convocatoria se abre cuando el partido tenga fecha.")).toBeInTheDocument();
  expect(fs.setDoc).not.toHaveBeenCalled();
});
