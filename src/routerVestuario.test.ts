import { describe, expect, it } from "vitest";
import { vestuarioSearchSchema } from "./router";

// /vestuario?rsvp=yes|no&m=<matchId>: what a notice's button opens (public/push-sw.js).
describe("the vestuario's search params", () => {
  it("keeps a notice's answer and its match", () => {
    expect(vestuarioSearchSchema.parse({ rsvp: "yes", m: "m8" })).toEqual({ rsvp: "yes", m: "m8" });
    expect(vestuarioSearchSchema.parse({ rsvp: "no", m: "AbC_12-x" })).toEqual({ rsvp: "no", m: "AbC_12-x" });
  });

  it("drops anything else: «Duda», another word, a malformed id, other params", () => {
    expect(vestuarioSearchSchema.parse({ rsvp: "maybe", m: "m8" })).toEqual({ rsvp: undefined, m: "m8" });
    expect(vestuarioSearchSchema.parse({ rsvp: "si", m: "m8" }).rsvp).toBeUndefined();
    expect(vestuarioSearchSchema.parse({ rsvp: "yes", m: "../x" }).m).toBeUndefined();
    expect(vestuarioSearchSchema.parse({ rsvp: "yes", m: "" }).m).toBeUndefined();
    expect(vestuarioSearchSchema.parse({ rsvp: "yes", m: "x".repeat(200) }).m).toBeUndefined();
    expect(vestuarioSearchSchema.parse({ rsvp: "yes", m: 8 }).m).toBeUndefined();
    expect(vestuarioSearchSchema.parse({ rsvp: "yes", m: "m8", evil: "1" })).toEqual({ rsvp: "yes", m: "m8" });
  });

  it("a plain /vestuario has none", () => {
    expect(vestuarioSearchSchema.parse({})).toEqual({});
  });
});
