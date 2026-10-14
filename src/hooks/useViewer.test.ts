import { describe, expect, it } from "vitest";
import { viewerOf } from "./useViewer";

// Who sees which shortcut: a fan none, a member the pizarra's, an admin the Sala de control's too, and
// the member linked to a player his own «Editar tu carta». Being signed in is not being inside.

describe("viewerOf", () => {
  it("a fan (no profile, or a profile outside the vestuario) is nobody: no member, no admin, no player", () => {
    expect(viewerOf(false, null)).toEqual({ member: false, admin: false, playerId: null });
    expect(viewerOf(false, { role: "admin", playerId: "erik" })).toEqual({ member: false, admin: false, playerId: null });
  });

  it("a member: his linked player, not admin", () => {
    expect(viewerOf(true, { role: "user", playerId: "erik" })).toEqual({ member: true, admin: false, playerId: "erik" });
    expect(viewerOf(true, { role: "user" })).toEqual({ member: true, admin: false, playerId: null });
  });

  it("admins and superadmins inside are admins", () => {
    expect(viewerOf(true, { role: "admin" }).admin).toBe(true);
    expect(viewerOf(true, { role: "superadmin" }).admin).toBe(true);
  });

  it("a member flag without a profile yet is not inside", () => {
    expect(viewerOf(true, null)).toEqual({ member: false, admin: false, playerId: null });
  });
});
