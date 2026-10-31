import { describe, expect, it } from "vitest";
import { fichaChoices, fichaHead, fichaTiles, matchShirt } from "./fichaModel";

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

describe("the squad of shirts", () => {
  it("says whose each shirt is: yours, free or taken", () => {
    expect(fichaTiles(squad, [{ playerId: "jordi" }, { playerId: "pellete" }], "pellete").map((t) => t.state)).toEqual(["taken", "mine", "free"]);
  });
  it("finds a shirt by its name (no accents, any case) or the start of its dorsal", () => {
    expect(matchShirt("", "Pellete", "20")).toBe(true);
    expect(matchShirt("pelle", "Pellete", "20")).toBe(true);
    expect(matchShirt("ADRIAN", "Adrián T.C.", "4")).toBe(true);
    expect(matchShirt("2", "Pellete", "20")).toBe(true);
    expect(matchShirt("0", "Pellete", "20")).toBe(false);
    expect(matchShirt("x", "Nuevo", "")).toBe(false);
  });
});

describe("fichaHead", () => {
  it("names each phase, the captain's way and the no-free one", () => {
    expect(fichaHead("done", { admin: false, noFree: false, linkedName: "Pellete" }).title).toBe("Tu ficha ya está vinculada: Pellete.");
    expect(fichaHead("wait", { admin: false, noFree: false, linkedName: "" }).title).toBe("Solicitud enviada: tu ficha, en revisión.");
    expect(fichaHead("pick", { admin: true, noFree: false, linkedName: "" }).sub).toBe("Elige tu nombre. Como capitán, se vincula al instante.");
    expect(fichaHead("pick", { admin: false, noFree: false, linkedName: "" }).sub).toBe("Elige tu nombre. Lo aprueba un capitán; mientras tanto, todo el vestuario funciona igual.");
    expect(fichaHead("pick", { admin: false, noFree: true, linkedName: "" })).toMatchObject({ title: "Todas las camisetas tienen dueño", sub: "No queda ninguna ficha libre esta temporada: pídesela a un capitán." });
  });
});
