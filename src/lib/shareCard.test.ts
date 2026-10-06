import { describe, expect, it } from "vitest";
import { playerCardSvg } from "../../functions/src/shareCard";

describe("cromo para compartir", () => {
  it("draws name, dorsal, position and the career numbers", () => {
    const svg = playerCardSvg({ name: "Adrián T.C.", number: 10, position: "DEL", totals: { played: 7, goals: 6, assists: 4 } }, "AAAA");
    expect(svg).toContain("ADRIÁN T.C.");
    expect(svg).toContain(">10<");
    expect(svg).toContain("DELANTERO");
    expect(svg).toContain(">PARTIDOS<");
    expect(svg).toContain(">6<");
  });
  it("escapes names and leaves the numbers out when he hasn't played", () => {
    const svg = playerCardSvg({ name: 'A<b>&"c', historic: true, totals: { played: 0, goals: 0, assists: 0 } }, "AAAA");
    expect(svg).not.toContain("<b>");
    expect(svg).toContain("A&lt;B&gt;&amp;&quot;C");
    expect(svg).not.toContain(">PARTIDOS<");
    expect(svg).toContain("HISTÓRICO");
  });
});
