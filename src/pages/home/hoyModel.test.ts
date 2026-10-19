import { describe, expect, it } from "vitest";
import { matchdayOf } from "../../lib/derived/matchday";
import { seasonStrip } from "../../lib/derived/vidrio/strip";
import { matchViewAt, niceName, type CopyCtx } from "./inicioModel";
import {
  benchLineOf,
  formaOf,
  goalsStory,
  hoyCopy,
  lensFace,
  meLineOf,
  ornamentsOf,
  pendingCount,
  placeFromHash,
  placesFor,
  resultHeadline,
  ribbonItemsOf,
  shortHint,
  sieteOf,
  spotOf,
  sunRibbonOf,
  tuTitleOf,
  venueName,
  venueWords,
  weatherLineOf,
  winnerLine,
  hourlyWords,
  postponedLine,
  porraSub,
  publishedWhen,
  turnoutLine,
  type MeLineCtx,
} from "./hoyModel";
import { EVENTS, KO, MIN, SCENES, SEVEN, base, nameOf, published } from "./inicio.fixtures";
import { longSeasonFixture } from "../../lib/derived/vidrio/fixtures";
import { ribbonModel } from "../../components/vidrio/momentum";

const nice = (id: string) => niceName(nameOf(id));
const S = (a: number, b: number) => `${a}⁠–⁠${b}`;
function scene(key: keyof typeof SCENES, opts: Partial<CopyCtx> = {}) {
  const { matches, now } = SCENES[key];
  const day = matchdayOf(matches, "t1", now);
  const view = matchViewAt(day, now, null);
  const ctx: CopyCtx = { day, view, now, member: false, role: "aficionado", nameOf: nice, sevenPublished: true, weather: null, seasonName: "Temporada 1", squadSize: 16, mvp: null, estreno: true, ...opts };
  return { day, view, ctx, now, matches };
}

describe("places", () => {
  it("Tú only for a jugador; the hash picks a place the viewer has, else Hoy", () => {
    expect(placesFor("aficion")).toEqual(["hoy", "temporada", "club"]);
    expect(placesFor("jugador")).toEqual(["hoy", "temporada", "club", "tu"]);
    expect(placeFromHash("#temporada", placesFor("socio"))).toBe("temporada");
    expect(placeFromHash("#tu", placesFor("socio"))).toBe("hoy");
    expect(placeFromHash("#tú", placesFor("jugador"))).toBe("tu");
    expect(placeFromHash("", placesFor("jugador"))).toBe("hoy");
  });

  it("the phone's short hints", () => {
    expect(shortHint("hoy", "2–1, minuto 23")).toBe("2–1, 23′");
    expect(shortHint("hoy", "Pendiente del acta")).toBe("Sin acta");
    expect(shortHint("hoy", "19:00, Orduña fc")).toBe("19:00");
    expect(shortHint("hoy", "3–1, acta lista")).toBe("3–1");
    expect(shortHint("hoy", "3–1, MVP Alcides")).toBe("3–1");
    expect(shortHint("temporada", "6º, J17 de 26")).toBe("6º");
    expect(shortHint("temporada", "Empieza esta noche")).toBe("Empieza hoy");
    expect(shortHint("temporada", "4º si acaba así")).toBe("4º");
    expect(shortHint("club", "Huberoski cumple el 27")).toBe("Cumple el 27");
    expect(shortHint("club", "16 en la plantilla")).toBe("16 jugadores");
    expect(shortHint("tu", "2 cosas pendientes")).toBe("2 pendientes");
    expect(shortHint("tu", "1 cosa pendiente")).toBe("1 pendiente");
  });
});

describe("the lens, phase by phase", () => {
  it("before: the kick-off in big and what is left; the evening's light below", () => {
    const { day, now } = scene("antes");
    const f = lensFace(day, now);
    expect(f).toMatchObject({ mode: "time", big: "19:00", under: "Faltan 2 h 0 min", ribbon: "sun" });
    expect(f.status.text).toBe("Jornada 1, hoy en el CDM Palomeras");
  });
  it("live: the score, «En directo», the minute in the mono face and the half", () => {
    const { day, now } = scene("directo1");
    expect(lensFace(day, now)).toMatchObject({ mode: "score", gf: 2, ga: 1, ribbon: "momentum", status: { live: true, clock: "23′", text: "de la primera parte" } });
  });
  it("after: the final score and the acta", () => {
    const { day, now } = scene("acta");
    expect(lensFace(day, now)).toMatchObject({ mode: "score", gf: 3, ga: 1, status: { live: false, text: "Final. El acta ya está publicada." } });
  });
  it("«Pendiente del acta»: no score anywhere, no ribbon", () => {
    const { day, now } = scene("pendiente");
    const f = lensFace(day, now);
    expect(f).toMatchObject({ mode: "word", big: "Pendiente del acta", ribbon: null });
    expect(f.label).not.toMatch(/\d/);
  });
  it("postponed and preseason say so in words", () => {
    expect(lensFace(scene("aplazado").day, SCENES.aplazado.now)).toMatchObject({ mode: "word", big: "Aplazado" });
    expect(lensFace(scene("pretemporada").day, SCENES.pretemporada.now)).toMatchObject({ mode: "word", big: "Pretemporada" });
  });
  it("venues in capitals read as names, with their article", () => {
    expect(venueName("CDM PALOMERAS")).toBe("CDM Palomeras");
    expect(venueWords({ venue: "CDM PALOMERAS", home: true, rival: "X" })).toBe("en el CDM Palomeras");
    expect(venueWords({ venue: "", home: false, rival: "Pitutis" })).toBe("en casa de Pitutis");
  });
});

describe("the evening's light and the momentum", () => {
  it("the sun ribbon: the kick-off in the middle, the masts by the end of a 19:00 match in October", () => {
    const r = sunRibbonOf(KO, KO - 2 * 60 * MIN);
    expect(r.pitido).toBe(50);
    expect(r.focos).not.toBeNull();
    expect(r.labels.map((l) => l.text)).toContain("19:00 pitido");
    expect(r.label).toMatch(/^La luz de esta tarde: el sol se pone a las \d\d:\d\d; /);
  });
  it("the ribbon's items: our goals above, theirs below, each with its words", () => {
    const items = ribbonItemsOf(published, nice);
    expect(items.map((i) => [i.side, i.kind])).toEqual([["us", "gol"], ["them", "gol"], ["us", "gol"], ["us", "gol"]]);
    expect(items[0].label).toBe("Minuto 6, gol de Alcides");
    expect(ribbonItemsOf(published, nice, 15 * 60)).toHaveLength(2);
  });
  it("the long season's J17 (38 plays): marks only on goals, cards, the post and a saved penalty, spread apart", () => {
    const f = longSeasonFixture();
    const j17 = f.matches.find((m) => m.id === f.liveId)!;
    const items = ribbonItemsOf(j17, f.nameOf);
    expect(items.length).toBeGreaterThan(20);
    const m = ribbonModel(items, j17.duration ?? 50, undefined, undefined, 3.2);
    const marked = new Set(m.marks.map((k) => k.id));
    for (const it of items) if (marked.has(it.id)) expect(["gol", "tarjeta", "roja", "palo", "parada"]).toContain(it.kind);
    expect(items.filter((it) => it.kind === "ocasion" || it.kind === "otro" || it.kind === "cambio").every((it) => !marked.has(it.id))).toBe(true);
    for (const side of ["us", "them"] as const) {
      const lefts = m.marks.filter((k) => k.side === side).map((k) => k.left).sort((a, b) => a - b);
      for (let i = 1; i < lefts.length; i++) expect(lefts[i] - lefts[i - 1]).toBeGreaterThanOrEqual(3.1);
    }
  });
});

describe("the headline", () => {
  it("the estreno before the match: «Hoy debuta el Piti» and when, where and the light", () => {
    const c = hoyCopy(scene("antes").ctx);
    expect(c.h1).toBe("Hoy debuta el Piti");
    expect(c.lede).toMatch(/^A las 19:00 contra Orduña fc en el CDM Palomeras\. Primer partido de la temporada: /);
  });
  it("live: the goal's headline and the story of the goals", () => {
    const c = hoyCopy(scene("directo1").ctx);
    expect(c.h1).toBe(`Adrián T.C. pone el ${S(2, 1)}`);
    expect(c.lede).toBe("Minuto 21, a pase de Jordi. Alcides abrió en el 6 y Orduña fc empató en el 11.");
  });
  it("the story says who went ahead and who drew level", () => {
    expect(goalsStory(base, EVENTS.slice(0, 1), nice)).toBe("Minuto 6, a pase de Adrián T.C.");
    expect(goalsStory(base, [], nice)).toBe("");
  });
  it("the acta: the first and the last of our scorers, the estreno's words", () => {
    expect(resultHeadline(published, 3, 1, nice)).toBe(`Alcides abre, Kevin cierra: ${S(3, 1)}`);
    expect(resultHeadline(published, 1, 3, nice)).toBeNull();
    const c = hoyCopy(scene("acta", { member: true }).ctx);
    expect(c.h1).toBe(`Alcides abre, Kevin cierra: ${S(3, 1)}`);
    expect(c.lede).toBe("Primera victoria de la temporada. Todos los que jugaron desbloquean «Debut». Ya se puede votar al MVP.");
  });
  it("pendiente: the lens says «Pendiente del acta»; the headline says what is missing, no score", () => {
    const c = hoyCopy(scene("pendiente").ctx);
    expect(c.h1).toBe("Falta el acta del partido");
    expect(`${c.h1} ${c.lede}`).not.toMatch(/\d\s*[–-]\s*\d|Pendiente del acta/);
  });
  it("después: the acta's headline and the MVP once the vote has closed, no broken «next» sentence", () => {
    const c = hoyCopy({ ...scene("despues").ctx, winner: { names: ["Alcides"], votes: 9 } });
    expect(c.h1).toBe(`Alcides abre, Kevin cierra: ${S(3, 1)}`);
    expect(c.lede).toBe("Alcides, MVP con 9 votos. La crónica y las notas, en el partido.");
    expect(winnerLine({ names: ["Alcides", "Kevin"], votes: 4 })).toBe("MVP compartido: Alcides y Kevin.");
  });
});

describe("the viewer's line", () => {
  const ctx = (o: Partial<MeLineCtx>): MeLineCtx => ({ phase: "directo1", kind: "jugador", name: "Jordi", role: "titular", code: "LD", porra: null, gf: 2, ga: 1, goals: [], assists: [], minutes: null, voteClosesAt: null, ...o });
  it("a fan has none", () => expect(meLineOf(ctx({ kind: "aficion" }))).toBeNull());
  it("before: his position and his porra", () => {
    expect(meLineOf(ctx({ phase: "antes", porra: { gf: 3, ga: 1 } }))).toBe("Jordi, juegas de lateral derecho. Tu porra: 3–1.");
  });
  it("live: the goal his pass made, the porra still on", () => {
    expect(meLineOf(ctx({ assists: [{ gf: 2, ga: 1 }], porra: { gf: 3, ga: 1 } }))).toBe("Jordi, el 2–1 lleva tu pase. Tu porra, 3–1, va bien: te falta un gol.");
  });
  it("a socio live: only the porra", () => {
    expect(meLineOf(ctx({ kind: "socio", name: "Lucía", porra: { gf: 2, ga: 0 } }))).toBe("Lucía, tu porra, 2–0, se te escapa.");
  });
  it("after: his minutes, his pass and the porra", () => {
    expect(meLineOf(ctx({ phase: "acta", gf: 3, ga: 1, minutes: 50, assists: [{ gf: 2, ga: 1 }], porra: { gf: 3, ga: 1 } }))).toBe("Jordi, jugaste los 50 minutos y diste el pase del 2–1. Acertaste la porra.");
  });
  it("the Tú place's title from his line", () => {
    expect(tuTitleOf("Jordi", "directo1", "Jordi, el 2–1 lleva tu pase. Tu porra va bien.")).toBe("Jordi, el 2–1 lleva tu pase");
    expect(tuTitleOf("Jordi", "semana", null)).toBe("Jordi, lo tuyo");
  });
});

describe("the weather line", () => {
  it("before: the sky and the sunset; after: the next match", () => {
    const a = scene("antes");
    expect(weatherLineOf(a.day, { temp: 14, rain: 0, cloud: 80, label: "Nublado", sky: "cloud", place: "x", approx: false })).toMatch(/^14°, nublado\. El sol se pone a las \d\d:\d\d\.$/);
    expect(weatherLineOf(scene("acta").day, null)).toBe("Próximo: domingo 25, 14:00, en casa de Pitutis.");
  });
});

describe("ornaments and el siete", () => {
  it("members get the convocatoria, fans la previa; the plays while live; the MVP vote while it is open", () => {
    expect(ornamentsOf("antes", "socio", true, false)).toEqual({ left: "siete", right: "convo" });
    expect(ornamentsOf("antes", "aficion", true, false)).toEqual({ left: "siete", right: "previa" });
    expect(ornamentsOf("directo2", "aficion", true, false)).toEqual({ left: "siete", right: "plays" });
    expect(ornamentsOf("acta", "jugador", true, true)).toEqual({ left: "siete", right: "mvp" });
    expect(ornamentsOf("acta", "aficion", true, true)).toEqual({ left: "siete", right: "plays" });
    expect(ornamentsOf("aplazado", "aficion", true, false)).toEqual({ left: "viene", right: "fecha" });
    expect(ornamentsOf("despues", "aficion", true, false, true)).toEqual({ left: "siete", right: "winner" });
    expect(ornamentsOf("despues", "jugador", true, false, true)).toEqual({ left: "siete", right: "winner" });
  });
  it("the spots exist for both pitches; the keeper by our goal", () => {
    const keeper = spotOf(50, 92);
    expect(keeper.h.left).toBeLessThan(15);
    expect(keeper.v.top).toBeGreaterThan(85);
  });
  it("the marks of the night: goals (the latest gold while live), passes, the captain and «tú»", () => {
    const { day, view } = scene("directo1");
    const spots = sieteOf({ match: day.match!, phase: day.phase, events: view.events, seven: SEVEN, nameOf, numOf: () => "10", captainId: "jordi", me: "jordi" });
    expect(spots).toHaveLength(7);
    const adrian = spots.find((s) => s.id === "adrian")!;
    expect(adrian.tags.map((t) => [t.kind, t.text, t.gold])).toEqual([["asis", "6′", false], ["gol", "21′", true]]);
    expect(spots.find((s) => s.id === "jordi")).toMatchObject({ captain: true, me: true, name: "JORDI" });
    expect(benchLineOf(day.match!, day.phase, view.events, nice, false)).toBe("En el banquillo: Erik y Kevin.");
  });
});

describe("the form", () => {
  it("the first jornadas early in the season: tonight's provisional, the rest still to play", () => {
    const { matches, now } = scene("directo1");
    const f = formaOf(seasonStrip(matches, "t1", now).segments);
    expect(f.map((x) => [x.l, x.tone])).toEqual([["G", "prov"], ["J2", "empty"]]);
    expect(f[0].label).toBe("J1: ganando, provisional");
  });
});

describe("Tú's pending count", () => {
  it("adds what waits on him", () => {
    expect(pendingCount({ rsvp: { open: true, answered: false }, turno: true, caja: false, polls: 1, mvp: false })).toBe(3);
    expect(pendingCount({ rsvp: { open: true, answered: true }, turno: false, caja: false, polls: 0, mvp: false })).toBe(0);
  });
});

describe("the cierre's words", () => {
  it("the forecast by the hour: at the whistle, at the end, the rain", () => {
    const H = 3_600_000;
    const hours = [
      { at: KO - H, temp: 16, rain: 0, kickoff: false },
      { at: KO, temp: 14.2, rain: 10, kickoff: true },
      { at: KO + H, temp: 11, rain: 20, kickoff: false },
    ];
    expect(hourlyWords(hours, KO, 50)).toEqual({ previa: "14° al pitido, 11° al final; sin lluvia", line: "De 14° a 11°, sin lluvia" });
    expect(hourlyWords([{ ...hours[1], rain: 60 }], KO, 50)?.line).toBe("14°, lluvia al 60 %");
    expect(hourlyWords([], KO)).toBeNull();
  });
  it("a postponement: the reason and the new date, or that it comes", () => {
    expect(postponedLine({ postponedReason: "campo cerrado por lluvia" })).toBe("Campo cerrado por lluvia. Sin fecha todavía.");
    expect(postponedLine({})).toBe("La nueva fecha saldrá aquí y en los avisos.");
    expect(postponedLine({ postponedTo: KO + 2 * 86_400_000 })).toMatch(/^Se juega el \S+ \d+ de \S+ a las 19:00\.$/);
  });
  it("the porra in Tú, the MVP turnout, when the seven was published", () => {
    expect(porraSub({ gf: 3, ga: 1 }, 2, 1, "directo1")).toBe("Vas bien: te falta un gol nuestro.");
    expect(porraSub({ gf: 2, ga: 1 }, 2, 1, "directo1")).toBe("La clavas de momento.");
    expect(porraSub({ gf: 1, ga: 0 }, 2, 1, "directo1")).toBe("Se te escapa: ahora va 2–1.");
    expect(porraSub({ gf: 3, ga: 1 }, 3, 1, "acta")).toBe("Acertaste el resultado.");
    expect(turnoutLine({ total: 9, eligible: 16 })).toBe("9 de 16 ya han votado.");
    expect(turnoutLine({ total: 0, eligible: 16 })).toBe("Nadie ha votado todavía.");
    expect(publishedWhen(KO - 86_400_000, KO)).toBe("ayer");
    expect(publishedWhen(KO - 3_600_000, KO)).toBe("hoy");
  });
});
