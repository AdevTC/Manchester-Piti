import { describe, expect, it } from "vitest";
import { viewerKind } from "./viewer";

describe("viewerKind", () => {
  it("a fan, a member, a member linked to a squad player", () => {
    expect(viewerKind(null)).toBe("aficion");
    expect(viewerKind({ member: false, playerId: "jordi" }, { id: "jordi" })).toBe("aficion");
    expect(viewerKind({ member: true, playerId: null })).toBe("socio");
    expect(viewerKind({ member: true, playerId: "jordi" }, null)).toBe("socio");
    expect(viewerKind({ member: true, playerId: "jordi" }, { id: "kevin" })).toBe("socio");
    expect(viewerKind({ member: true, playerId: "jordi" }, { id: "jordi", archived: true })).toBe("socio");
    expect(viewerKind({ member: true, playerId: "jordi" }, { id: "jordi" })).toBe("jugador");
  });
});
