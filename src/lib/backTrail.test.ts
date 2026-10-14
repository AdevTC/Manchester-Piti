import { beforeEach, describe, expect, it } from "vitest";
import { _resetTrailForTesting, recordTrail, stepsBack } from "./backTrail";

// The trail notes the page shown at each history index; «Volver» asks how far back the previous page
// of the app is (0 = none or not known → the section).

describe("backTrail", () => {
  beforeEach(() => _resetTrailForTesting());

  it("a first load or a deep link (index 0): nothing behind", () => {
    recordTrail(0, "/matches/j1");
    expect(stepsBack(0, "/matches/j1")).toBe(0);
  });

  it("the entry behind is another page of the app: one step", () => {
    recordTrail(0, "/stats");
    recordTrail(1, "/matches/j1");
    expect(stepsBack(1, "/matches/j1")).toBe(1);
  });

  it("the page's own entries (tabs, season) are skipped: back to the page before them", () => {
    recordTrail(0, "/");
    recordTrail(1, "/matches/j1");
    recordTrail(2, "/matches/j1"); // ?tab=campo
    recordTrail(3, "/matches/j1"); // ?tab=pulso
    expect(stepsBack(3, "/matches/j1")).toBe(3);
  });

  it("only this page in the history (a deep link, then its tabs): nothing behind", () => {
    recordTrail(0, "/matches/j1");
    recordTrail(1, "/matches/j1");
    expect(stepsBack(1, "/matches/j1")).toBe(0);
  });

  it("a gap in the trail (an entry it never saw): not known, so nothing", () => {
    recordTrail(1, "/matches/j1");
    expect(stepsBack(1, "/matches/j1")).toBe(0);
  });

  it("an entry overwritten by a later visit (back, then somewhere else) reads the latest page", () => {
    recordTrail(0, "/partidos");
    recordTrail(1, "/stats");
    recordTrail(1, "/plantilla"); // back to 0, then a push lands on 1 again
    recordTrail(2, "/jugadores/erik");
    expect(stepsBack(2, "/jugadores/erik")).toBe(1);
    // …and the page it now holds is what «Volver» compares: the same page as here is skipped
    recordTrail(1, "/jugadores/erik");
    expect(stepsBack(2, "/jugadores/erik")).toBe(2);
  });

  it("survives a reload: the trail lives in sessionStorage", () => {
    recordTrail(0, "/stats");
    recordTrail(1, "/jugadores/erik");
    expect(JSON.parse(sessionStorage.getItem("mp:trail") ?? "{}")).toEqual({ 0: "/stats", 1: "/jugadores/erik" });
  });

  it("ignores a missing or negative index", () => {
    recordTrail(-1, "/x");
    recordTrail(Number.NaN, "/x");
    expect(sessionStorage.getItem("mp:trail")).toBeNull();
    expect(stepsBack(-1, "/x")).toBe(0);
  });
});
