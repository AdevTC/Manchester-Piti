import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

it("keyboard: the arrows and Home / End only move the focus; nothing is written until Enter or Space", async () => {
  const user = userEvent.setup();
  render(<RsvpSwitch match={MATCH} now={NOW} answer="yes" />);
  const [yes, maybe, no] = radios();
  yes.focus();
  await user.keyboard("{ArrowRight}");
  expect(maybe).toHaveFocus();
  await user.keyboard("{End}");
  expect(no).toHaveFocus();
  await user.keyboard("{ArrowDown}");
  expect(yes).toHaveFocus();
  await user.keyboard("{ArrowLeft}");
  expect(no).toHaveFocus();
  await user.keyboard("{Home}");
  expect(yes).toHaveFocus();
  // (the answer is still «Voy»: a step is not a choice, and not a write)
  expect(fs.setDoc).not.toHaveBeenCalled();
  expect(radios().map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
});

it("keyboard: Enter chooses and writes once; so does Space", async () => {
  const user = userEvent.setup();
  render(<RsvpSwitch match={MATCH} now={NOW} answer="yes" />);
  const [yes, maybe, no] = radios();
  yes.focus();
  await user.keyboard("{ArrowRight}");
  expect(maybe).toHaveFocus();
  expect(maybe.tabIndex).toBe(0);
  expect(yes.tabIndex).toBe(-1);
  await user.keyboard("{Enter}");
  expect(fs.setDoc).toHaveBeenCalledTimes(1);
  expect(fs.setDoc).toHaveBeenLastCalledWith({ path: "matchPrivate/j8/availability/u1" }, { response: "maybe", name: "ADRI", playerId: "adri", at: "SERVER_TIME" });
  await user.keyboard("{ArrowRight}");
  expect(no).toHaveFocus();
  await user.keyboard(" ");
  expect(fs.setDoc).toHaveBeenCalledTimes(2);
  expect(fs.setDoc).toHaveBeenLastCalledWith({ path: "matchPrivate/j8/availability/u1" }, { response: "no", name: "ADRI", playerId: "adri", at: "SERVER_TIME" });
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

it("a future match that is not scheduled (legacy, without status) does not claim it closed", () => {
  render(<RsvpSwitch match={{ id: "j9", date: NOW + 86_400_000 }} now={NOW} answer={undefined} />);
  expect(screen.queryByRole("radiogroup")).toBeNull();
  expect(screen.getByText("Este partido no admite convocatoria.")).toBeInTheDocument();
});
