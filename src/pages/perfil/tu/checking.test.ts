// /perfil's «Cargando»: it waits for who looks, never forever (a member whose profile is missing used to stay on it).
import { describe, expect, it } from "vitest";
import { tuChecking } from "./model";

describe("tuChecking", () => {
  it("waits while the team doesn't know the account yet", () => {
    expect(tuChecking({ teamReady: false, member: false, hasProfile: false, profileLoading: true })).toBe(true);
  });
  it("waits for a member's profile still on its way", () => {
    expect(tuChecking({ teamReady: true, member: true, hasProfile: false, profileLoading: true })).toBe(true);
  });
  it("a member whose profile is known to be missing gets the door, not «Cargando» for ever", () => {
    expect(tuChecking({ teamReady: true, member: true, hasProfile: false, profileLoading: false })).toBe(false);
  });
  it("a member with his profile, or someone not inside: nothing to wait for", () => {
    expect(tuChecking({ teamReady: true, member: true, hasProfile: true, profileLoading: false })).toBe(false);
    expect(tuChecking({ teamReady: true, member: false, hasProfile: false, profileLoading: false })).toBe(false);
  });
});
