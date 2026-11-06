import { describe, expect, it } from "vitest";
import { AGENT_PCS, isAgentPc } from "../../functions/src/vitalsLogic";
import { NOVITALS_KEY, vitalsOff } from "./vitalsOff";

const memory = (init: Record<string, string> = {}) => {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
};

describe("this PC's tools keep out of the field measurements", () => {
  it("a visitor measures as always", () => {
    expect(vitalsOff("", memory())).toBe(false);
    expect(vitalsOff("?season=2", memory())).toBe(false);
  });
  it("?novitals turns it off for this browser, also on the next pages (whose address no longer says it)", () => {
    const s = memory();
    expect(vitalsOff("?novitals", s)).toBe(true);
    expect(s.data.get(NOVITALS_KEY)).toBe("1");
    expect(vitalsOff("", s)).toBe(true);
    expect(vitalsOff("?season=2&novitals=1", memory())).toBe(true);
  });
  it("?novitals=0 turns it back on", () => {
    const s = memory({ [NOVITALS_KEY]: "1" });
    expect(vitalsOff("?novitals=0", s)).toBe(false);
    expect(vitalsOff("", s)).toBe(false);
  });
  it("with storage blocked, the address alone decides", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} };
    expect(vitalsOff("?novitals", blocked)).toBe(true);
    expect(vitalsOff("", blocked)).toBe(false);
  });
});

describe("the report leaves out what this PC sent before the switch", () => {
  it("by its class (threads and memory), nothing else", () => {
    expect(AGENT_PCS).toContainEqual({ cpu: 24, mem: 32 });
    expect(isAgentPc({ cpu: 24, mem: 32 })).toBe(true);
    expect(isAgentPc({ cpu: 8, mem: 4 })).toBe(false);
    expect(isAgentPc({ cpu: 24 })).toBe(false);
    expect(isAgentPc({})).toBe(false);
    expect(isAgentPc(undefined)).toBe(false);
  });
});
