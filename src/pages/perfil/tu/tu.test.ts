import { describe, expect, it } from "vitest";
import { allowedSec, dirOf, doorLead, fitWord, initials, screenAt, secLabel, secsOf, sinceLong } from "./model";
import { clubLineOf, firstName, kindOf } from "./view";
import { cromosOf, type CromosInput } from "./cromosModel";
import { goalClock } from "./season";
import { matchMarks } from "../../../lib/derived/vidrio/matchMarks";
import type { ClubMatch } from "../../../lib/clubData";

describe("Tú: the screen an address shows", () => {
  it("reads every /perfil and /avisos address", () => {
    expect(screenAt("/perfil")).toEqual({ page: "perfil", sec: "carta", open: null });
    expect(screenAt("/perfil/")).toEqual({ page: "perfil", sec: "carta", open: null });
    expect(screenAt("/perfil/temporada")).toEqual({ page: "perfil", sec: "temporada", open: null });
    expect(screenAt("/perfil/temporada/cromos")).toEqual({ page: "perfil", sec: "temporada", open: "cromos" });
    expect(screenAt("/perfil/compartir")).toEqual({ page: "perfil", sec: "carta", open: "compartir" });
    expect(screenAt("/perfil/capitania")).toEqual({ page: "perfil", sec: "capitania", open: null });
    expect(screenAt("/avisos").page).toBe("avisos");
    expect(screenAt("/avisos/a-medida").page).toBe("avisos");
  });
  it("gives each viewer his screens", () => {
    expect(secsOf({ kind: "fan", captain: false }).map((x) => x.id)).toEqual(["carta"]);
    expect(secsOf({ kind: "socio", captain: false }).map((x) => x.id)).toEqual(["carta", "nombre", "avisos", "ajustes", "cuenta"]);
    expect(secsOf({ kind: "jugador", captain: true }).map((x) => x.id)).toEqual(["carta", "temporada", "posiciones", "nombre", "avisos", "ajustes", "cuenta", "capitania"]);
    expect(allowedSec("temporada", { kind: "socio", captain: false })).toBe("carta");
    expect(allowedSec("capitania", { kind: "jugador", captain: false })).toBe("carta");
    expect(secLabel("carta", "socio")).toBe("Tu carné");
    expect(secLabel("nombre", "socio")).toBe("Tu apodo");
  });
  it("moves in the order of the tabs", () => {
    const at = (sec: "carta" | "nombre", page: "perfil" | "avisos" = "perfil") => ({ page, sec, open: null });
    expect(dirOf(at("carta"), at("nombre"))).toBe("right");
    expect(dirOf(at("nombre"), at("carta"))).toBe("left");
    expect(dirOf(at("nombre"), at("carta", "avisos"))).toBe("right");
    expect(dirOf(at("carta", "avisos"), at("nombre"))).toBe("left");
  });
  it("words the door and the initials", () => {
    expect(doorLead(0)).toBe("Nadie llama ahora mismo.");
    expect(doorLead(1)).toBe("Una petición espera tu sí o tu no.");
    expect(doorLead(2)).toBe("Dos peticiones esperan tu sí o tu no.");
    expect(initials("Lucía Peña")).toBe("LP");
  });
});

describe("Tú: who looks and his card", () => {
  const f = (state: "vinculada" | "pendiente" | "sin-ficha", rejected: string | null = null) => ({ ficha: { state, playerId: null, rejectedPlayerId: rejected, claim: null } });
  it("tells players, new accounts and socios apart", () => {
    expect(kindOf(f("vinculada"), null)).toBe("jugador");
    expect(kindOf(f("pendiente"), null)).toBe("nuevo");
    expect(kindOf(f("sin-ficha", "p7"), null)).toBe("nuevo");
    expect(kindOf(f("sin-ficha"), null)).toBe("socio");
    expect(kindOf(f("sin-ficha"), { quien: "nuevo", jugador: null, movil: null, bandeja: null })).toBe("nuevo");
  });
  it("writes the club's line as the board does", () => {
    expect(clubLineOf("MANCHESTER PITI · T1 · J1")).toBe("Manchester Piti · T1 · J1");
    expect(clubLineOf("SE REVELA EN LA J1")).toBe("Se revela en la J1");
    expect(firstName("Jordi Sumba", "jordi28")).toBe("Jordi");
    expect(firstName("", "jordi28")).toBe("jordi28");
  });
  it("fits the name on the back and says since when", () => {
    expect(fitWord(5)).toBe("Holgado");
    expect(fitWord(9)).toBe("Justo");
    expect(fitWord(12)).toBe("Al límite");
    expect(fitWord(13)).toBe("No cabe");
    expect(sinceLong("sep 2026")).toBe("septiembre de 2026");
    expect(sinceLong("—")).toBe("—");
  });
});

describe("Tú: the season", () => {
  const m = (events: Partial<NonNullable<ClubMatch["events"]>[number]>[]) => ({ id: "m1", duration: 50, events }) as unknown as ClubMatch;
  it("places goals and cards on the 50′ line", () => {
    const marks = matchMarks(m([{ type: "goal", minute: 43, playerId: "a" }, { type: "opponent_goal", minute: 5 }, { type: "yellow_card", minute: 42, playerId: "b" }]));
    expect(marks.map((x) => [x.m, x.k])).toEqual([
      [5, "them"],
      [42, "card-us"],
      [43, "us"],
    ]);
    expect(marks[2].left).toBeCloseTo(86);
  });
  it("counts his goals by ten-minute stretch", () => {
    expect(goalClock([m([{ type: "goal", minute: 43, playerId: "a" }, { type: "goal", minute: 3, playerId: "a" }, { type: "goal", minute: 9, playerId: "b" }])], "a")).toEqual([1, 0, 0, 0, 1]);
  });
  it("tells four cromos while the season is on and ten once it is over", () => {
    const base: CromosInput = { seasonName: "Temporada 1", finished: false, played: 1, minutes: 40, goals: 0, assists: 0, wins: 0, firstJ: "J1", lastJ: "J1", firstGoal: null, stints: 4, oneLine: "La J1, en casa contra Orduña fc.", myNum: "28", partner: { name: "Alcides", num: "7", line: "30′ juntos" }, bestClock: null, pos: "Lateral derecho", medals: [], nextMedal: null, rating: "59", tier: "Bronce", next: { j: "J2", where: "en casa de Pitutis", when: "dom 25 oct a las 14:00", revancha: true } };
    const four = cromosOf(base);
    expect(four.map((c) => c.k)).toEqual(["Temporada 1, hasta ahora", "Tus minutos", "Tu socio", "Lo próximo"]);
    expect(four[1].t).toBe("en 4 tramos");
    expect(four[3].d).toContain("La revancha empieza ahí.");
    expect(cromosOf({ ...base, finished: true })).toHaveLength(10);
  });
});
