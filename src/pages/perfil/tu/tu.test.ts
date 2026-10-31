import { describe, expect, it } from "vitest";
import { adminLinks, ajLabel, ajSecsOf, allowedAj, allowedSec, dirOf, doorLead, fitWord, initials, placesOf, screenAt, screenPath, secLabel, secPath, secsOf, secTitle, signOutFailText, sinceLong } from "./model";
import { clubLineOf, firstName, kindOf } from "./view";
import { goalClock } from "./season";
import { matchMarks } from "../../../lib/derived/vidrio/matchMarks";
import type { ClubMatch } from "../../../lib/clubData";

describe("Tú: the screen an address shows", () => {
  const P = (sec: string, aj: string | null = null, open: string | null = null) => ({ page: "perfil", sec, aj, open });
  it("reads every /perfil and /avisos address", () => {
    expect(screenAt("/perfil")).toEqual(P("tu"));
    expect(screenAt("/perfil/")).toEqual(P("tu"));
    expect(screenAt("/perfil/partidos")).toEqual(P("partidos"));
    expect(screenAt("/perfil/juego")).toEqual(P("juego"));
    expect(screenAt("/perfil/vitrina")).toEqual(P("vitrina"));
    expect(screenAt("/perfil/vitrina/cromos")).toEqual(P("vitrina", null, "cromos"));
    expect(screenAt("/perfil/compartir")).toEqual(P("vitrina", null, "compartir"));
    expect(screenAt("/perfil/ajustes")).toEqual(P("ajustes"));
    expect(screenAt("/perfil/ajustes/cuenta")).toEqual(P("ajustes", "cuenta"));
    expect(screenAt("/perfil/ajustes/capitania")).toEqual(P("ajustes", "capitania"));
    expect(screenAt("/perfil/ajustes/nada")).toEqual(P("ajustes"));
    expect(screenAt("/perfil/nada")).toEqual(P("tu"));
    expect(screenAt("/avisos").page).toBe("avisos");
    expect(screenAt("/avisos/a-medida").page).toBe("avisos");
  });
  it("an old screen's address lands on its place (the router redirects it first)", () => {
    expect(screenAt("/perfil/temporada")).toEqual(P("partidos"));
    expect(screenAt("/perfil/temporada/cromos")).toEqual(P("vitrina", null, "cromos"));
    expect(screenAt("/perfil/posiciones")).toEqual(P("juego"));
    expect(screenAt("/perfil/nombre")).toEqual(P("ajustes", "nombre"));
    expect(screenAt("/perfil/cuenta")).toEqual(P("ajustes", "cuenta"));
    expect(screenAt("/perfil/capitania")).toEqual(P("ajustes", "capitania"));
  });
  it("writes each screen's address back", () => {
    for (const p of ["/perfil", "/perfil/partidos", "/perfil/juego", "/perfil/vitrina", "/perfil/vitrina/cromos", "/perfil/compartir", "/perfil/ajustes", "/perfil/ajustes/avisos", "/perfil/ajustes/capitania", "/avisos"]) expect(screenPath(screenAt(p))).toBe(p);
    expect(secPath("ajustes", "nombre")).toBe("/perfil/ajustes/nombre");
    expect(secPath("tu", "nombre")).toBe("/perfil");
  });
  it("gives each viewer his places", () => {
    const fan = { kind: "fan", captain: false } as const;
    const socio = { kind: "socio", captain: false } as const;
    const nuevo = { kind: "nuevo", captain: false } as const;
    const jugador = { kind: "jugador", captain: false } as const;
    const capitan = { kind: "jugador", captain: true } as const;
    expect(placesOf(fan)).toEqual(["tu"]);
    expect(secsOf(fan)).toEqual(["tu"]);
    expect(placesOf(socio)).toEqual(["tu", "vitrina"]);
    expect(placesOf(nuevo)).toEqual(["tu", "vitrina"]);
    expect(secsOf(socio)).toEqual(["tu", "vitrina", "ajustes"]);
    expect(placesOf(jugador)).toEqual(["tu", "partidos", "juego", "vitrina"]);
    expect(ajSecsOf(jugador)).toEqual(["nombre", "avisos", "apariencia", "cuenta"]);
    expect(ajSecsOf(capitan)).toEqual(["nombre", "avisos", "apariencia", "cuenta", "capitania"]);
    expect(allowedSec("partidos", socio)).toBe("tu");
    expect(allowedSec("juego", nuevo)).toBe("tu");
    expect(allowedSec("ajustes", fan)).toBe("tu");
    expect(allowedSec("juego", jugador)).toBe("juego");
    expect(allowedAj("capitania", jugador)).toBeNull();
    expect(allowedAj("capitania", capitan)).toBe("capitania");
    expect(secLabel("tu")).toBe("Tú");
    expect(secTitle("partidos")).toBe("Tus partidos");
    expect(ajLabel("nombre", "socio")).toBe("Tu apodo");
    expect(ajLabel("nombre", "jugador")).toBe("Tu nombre");
  });
  it("Capitanía's «Administrar el club» goes straight into the admin's sections", () => {
    const links = adminLinks();
    expect(links[0]).toMatchObject({ t: "Sala de control", path: "/admin" });
    // (the r12 addresses, never an old one the router has to redirect)
    expect(links.map((l) => l.path)).toEqual(["/admin", "/admin/partidos", "/admin/partidos/proximo/convocatoria", "/admin/plantilla", "/admin/plantilla/socios", "/admin/caja", "/admin/club"]);
  });
  it("a «Salir» that fails says why", () => {
    expect(signOutFailText({ code: "auth/network-request-failed" })).toBe("No se ha podido cerrar la sesión. No se ha podido conectar con Google. Comprueba tu conexión y vuelve a intentarlo.");
  });
  it("moves in the order of the places; la bandeja always to the right", () => {
    const at = (sec: "tu" | "partidos" | "vitrina" | "ajustes", aj: "nombre" | "cuenta" | null = null, page: "perfil" | "avisos" = "perfil") => ({ page, sec, aj, open: null });
    expect(dirOf(at("tu"), at("partidos"))).toBe("right");
    expect(dirOf(at("vitrina"), at("partidos"))).toBe("left");
    expect(dirOf(at("ajustes", "nombre"), at("ajustes", "cuenta"))).toBe("right");
    expect(dirOf(at("ajustes", "cuenta"), at("ajustes", "nombre"))).toBe("left");
    expect(dirOf(at("ajustes"), at("tu", null, "avisos"))).toBe("right");
    expect(dirOf(at("tu", null, "avisos"), at("ajustes"))).toBe("left");
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
});
