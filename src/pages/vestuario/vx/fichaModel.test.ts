import { describe, expect, it } from "vitest";
import { fichaChoices } from "./fichaModel";

const squad = [
  { id: "jordi", name: "Jordi", num: "7" },
  { id: "pellete", name: "Pellete", num: "20" },
  { id: "nuevo", name: "Nuevo", num: "" },
];

describe("fichaChoices", () => {
  it("offers the season's free fichas by dorsal, «Nombre · dorsal»", () => {
    const { options } = fichaChoices(squad, [{ playerId: "jordi" }], "", () => []);
    expect(options).toEqual([
      { id: "pellete", label: "Pellete · 20" },
      { id: "nuevo", label: "Nuevo" },
    ]);
  });
  it("suggests the free one that looks like his nickname", () => {
    const names = (id: string) => (id === "pellete" ? ["PELLETE", "Pablo"] : [id]);
    expect(fichaChoices(squad, [], "pellete99", names).suggestion).toEqual({ id: "pellete", label: "Pellete · 20" });
    expect(fichaChoices(squad, [{ playerId: "pellete" }], "pellete", names).suggestion).toBeNull();
  });
});
