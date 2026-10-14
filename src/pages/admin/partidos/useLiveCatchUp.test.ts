import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { defaultSheet, isSheet, type MatchEvent, type MatchSheet } from "../acta/sheetModel";
import { useEditBuffer } from "./useEditBuffer";
import { useLiveCatchUp } from "./useLiveCatchUp";

// M4 with the real edit buffer: while the acta has unsaved edits the touchline keeps writing; the bar
// counts the new jugadas and «Incorporarlas» takes them (and the revision) into the edits.
const ev = (id: string, minute: number): MatchEvent => ({ id, type: "goal", minute, playerId: "erik" });
const A = ev("live-a", 3);
const B = ev("live-b", 8);
const C = ev("live-c", 15);
const D = ev("live-d", 22);
const version = (revision: number, events: MatchEvent[]): MatchSheet => defaultSheet("t1", { rival: "Rival", date: 1, revision, events });

function editor(first: MatchSheet) {
  return renderHook(
    ({ server }) => {
      const buf = useEditBuffer(server, "acta", "m-live", isSheet);
      return { buf, catchUp: useLiveCatchUp(buf) };
    },
    { initialProps: { server: first } },
  );
}

afterEach(() => localStorage.clear());

it("counts the jugadas that arrive while dirty and takes them in by id, keeping the edits and removals", () => {
  const { result, rerender } = editor(version(3, [A]));
  // clean: the buffer follows the server by itself, no bar
  rerender({ server: version(4, [A, B]) });
  expect(result.current.buf.value.events.map((e) => e.id)).toEqual(["live-a", "live-b"]);
  expect(result.current.catchUp.count).toBe(0);

  // the captain edits: writes the crónica and removes A
  act(() => result.current.buf.set((s) => ({ ...s, report: "Partidazo", events: s.events.filter((e) => e.id !== "live-a") })));
  expect(result.current.buf.dirty).toBe(true);
  rerender({ server: version(5, [A, B, C]) });
  rerender({ server: version(6, [A, B, C, D]) });
  expect(result.current.catchUp.count).toBe(2);
  expect(result.current.buf.value.revision).toBe(4);

  act(() => result.current.catchUp.incorporate());
  const v = result.current.buf.value;
  expect(v.events.map((e) => e.id)).toEqual(["live-b", "live-c", "live-d"]);
  expect(v.report).toBe("Partidazo");
  // the server's revision: saveMatchSheet's check passes
  expect(v.revision).toBe(6);
  expect(result.current.buf.base.revision).toBe(6);
  expect(result.current.buf.dirty).toBe(true);
  expect(result.current.catchUp.count).toBe(0);

  // and the next one is counted again
  rerender({ server: version(7, [A, B, C, D, ev("live-e", 30)]) });
  expect(result.current.catchUp.count).toBe(1);
});

it("after a saved draft (the edits become the base), a jugada removed earlier still isn't «new»", () => {
  const { result, rerender } = editor(version(3, [A, B]));
  act(() => result.current.buf.set((s) => ({ ...s, events: s.events.filter((e) => e.id !== "live-a") })));
  act(() => result.current.buf.commit(result.current.buf.value)); // «Guardar borrador»
  act(() => result.current.buf.set((s) => ({ ...s, report: "Más tarde" })));
  // the live match still has A (the draft didn't touch the published events), plus a new C
  rerender({ server: version(4, [A, B, C]) });
  expect(result.current.catchUp.count).toBe(1);
  act(() => result.current.catchUp.incorporate());
  expect(result.current.buf.value.events.map((e) => e.id)).toEqual(["live-b", "live-c"]);
  expect(result.current.buf.value.revision).toBe(4);
});
