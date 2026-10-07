import { describe, expect, it } from "vitest";
import { doorStep, inviteCodeFrom, inviteUrl, shirtsToPick, type DoorInput } from "./door";

const base: DoorInput = { signedIn: false, member: false, hasProfile: false, request: null, invite: null, choosing: false };
const valid = { state: "valid" as const, by: "capitan", expiresAt: 1, playerId: null, playerName: null };

describe("Qué pantalla de la puerta toca", () => {
  it("members with a profile are inside; without one they still say who they are", () => {
    expect(doorStep({ ...base, signedIn: true, member: true, hasProfile: true })).toBe("dentro");
    expect(doorStep({ ...base, signedIn: true, member: true })).toBe("quien-eres");
  });
  it("an invitation: welcome before Google, «¿Quién eres?» after", () => {
    expect(doorStep({ ...base, invite: valid })).toBe("invitacion");
    expect(doorStep({ ...base, invite: valid, signedIn: true })).toBe("quien-eres");
    const dead = { state: "used" as const, problem: "x" };
    expect(doorStep({ ...base, invite: dead })).toBe("invitacion-caducada");
    expect(doorStep({ ...base, invite: dead, signedIn: true, choosing: true })).toBe("quien-eres");
  });
  it("without an invitation: the door, then asking, waiting or being turned away", () => {
    expect(doorStep(base)).toBe("puerta");
    expect(doorStep({ ...base, signedIn: true })).toBe("quien-eres");
    expect(doorStep({ ...base, signedIn: true, request: { status: "pending" } })).toBe("pendiente");
    // «Cambiar ficha» while waiting goes back to the shirts.
    expect(doorStep({ ...base, signedIn: true, request: { status: "pending" }, choosing: true })).toBe("quien-eres");
    expect(doorStep({ ...base, signedIn: true, request: { status: "rejected" } })).toBe("rechazada");
    expect(doorStep({ ...base, signedIn: true, request: { status: "removed" }, choosing: true })).toBe("quien-eres");
  });
});

describe("El enlace de invitación", () => {
  it("reads the code from the path or the query, never anything else", () => {
    expect(inviteCodeFrom("/invitacion/abcdefgh23", "")).toBe("ABCDEFGH23");
    expect(inviteCodeFrom("/vestuario", "?invitacion=ABCDEFGH23")).toBe("ABCDEFGH23");
    expect(inviteCodeFrom("/invitacion/ABC", "")).toBeNull();
    expect(inviteCodeFrom("/invitacion/ABCDEFGH01", "")).toBeNull();
    expect(inviteUrl("https://x.app", "ABCDEFGH23")).toBe("https://x.app/invitacion/ABCDEFGH23");
  });
});

describe("¿Quién eres?", () => {
  it("free shirts first by dorsal, taken ones last, and a guess from the Google name", () => {
    const { shirts, suggestion } = shirtsToPick(
      [
        { id: "a", name: "ADRIÁN T.C.", num: "10", first: "Adrián" },
        { id: "e", name: "ERIK", num: "9", first: "Erik" },
        { id: "k", name: "KEVIN", num: "11" },
      ],
      new Set(["e"]),
      "Adrián Tomás",
    );
    expect(shirts.map((s) => `${s.num}${s.taken ? "x" : ""}`)).toEqual(["10", "11", "9x"]);
    expect(suggestion?.id).toBe("a");
    expect(shirtsToPick([{ id: "e", name: "ERIK", num: "9" }], new Set(["e"]), "Erik").suggestion).toBeNull();
  });
});
