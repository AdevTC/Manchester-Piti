import { describe, expect, it } from "vitest";
import type { PlayerDoc, SeasonDoc } from "../../../lib/schemas";
import {
  bajaPayload,
  checkPlayerForm,
  csvCell,
  csvFileName,
  dorsalHolder,
  dorsalLine,
  emptyForm,
  filterRows,
  formDirty,
  formFromPlayer,
  linkState,
  perchaOf,
  plantillaRows,
  playerPayload,
  previewDoc,
  rosterCsv,
  rosterSummary,
  seasonCode,
  seasonLabel,
  shirtNameError,
} from "./plantillaLogic";

const seasons: SeasonDoc[] = [
  { id: "t0", name: "Temporada 0 · pre-Piti", archived: true },
  { id: "t1", name: "Temporada 1" },
];
const P = (id: string, number: number, shirtName: string, extra: Partial<PlayerDoc> = {}): PlayerDoc => ({ id, number, shirtName, firstName: "Nombre", lastName: id, seasons: ["t1"], naturalPosition: "MED", ...extra });
const players: PlayerDoc[] = [
  P("erik", 9, "ERIK", { naturalPosition: "DEL", seasons: ["t1", "t0"] }),
  P("evans", 1, "EVANS", { naturalPosition: "POR" }),
  P("adrian", 10, "ADRI", { naturalPosition: "del", seasons: ["t1", "t0"], seasonDetails: { t1: { shirtName: "ADRIÁN T.C.", number: 10 }, t0: { shirtName: "ADRI", number: 7 } } }),
  P("old", 4, "VIEJO", { seasons: ["t0"], injured: true }),
];

describe("seasonCode / seasonLabel", () => {
  it("shortens season names", () => {
    expect(seasonCode("Temporada 1")).toBe("T1");
    expect(seasonCode("Temporada 0 · pre-Piti")).toBe("T0");
    expect(seasonCode("Verano")).toBe("VER");
    expect(seasonLabel(seasons[1], "t1")).toBe("Temporada 1 · activa");
    expect(seasonLabel(seasons[0], "t1")).toBe("Temporada 0 · pre-Piti · archivada");
    expect(seasonLabel({ id: "t2", name: "Temporada 2" }, "t1")).toBe("Temporada 2 · en preparación");
  });
});

describe("plantillaRows", () => {
  const rows = plantillaRows(players, seasons, "t1");
  it("shows every player: the active season's squad by dorsal (season shirt + number), then the rest", () => {
    expect(rows.map((r) => `${r.number} ${r.name}`)).toEqual(["1 EVANS", "9 ERIK", "10 ADRIÁN T.C.", "4 VIEJO"]);
    expect(rows.find((r) => r.id === "adrian")).toMatchObject({ position: "DEL", seasons: "T1 · T0", inSeason: true, full: "Nombre adrian" });
    expect(rows.find((r) => r.id === "old")).toMatchObject({ inSeason: false, injured: true, seasons: "T0" });
  });
  it("filters by name (accents ignored), full name or exact dorsal, and by position", () => {
    expect(filterRows(rows, "adrian", "Todos").map((r) => r.id)).toEqual(["adrian"]);
    expect(filterRows(rows, "1", "Todos").map((r) => r.id)).toEqual(["evans"]);
    expect(filterRows(rows, "", "DEL").map((r) => r.id)).toEqual(["erik", "adrian"]);
    expect(filterRows(rows, "nombre evans", "Todos").map((r) => r.id)).toEqual(["evans"]);
    expect(filterRows(rows, "zz", "Todos")).toEqual([]);
  });
  it("sums up the squad", () => {
    expect(rosterSummary(rows)).toBe("1 portero · dorsales únicos");
  });
});

describe("the drawer's form", () => {
  it("reads defaults and keeps only the seasons that differ as overrides", () => {
    const f = formFromPlayer(players[2]);
    expect(f).toMatchObject({ shirtName: "ADRI", number: "10", position: "DEL", seasons: ["t1", "t0"] });
    expect(f.overrides).toEqual({ t1: { shirtName: "ADRIÁN T.C.", number: "" }, t0: { shirtName: "", number: "7" } });
  });
  it("is dirty only when what would be saved changes", () => {
    const f = formFromPlayer(players[0]);
    expect(formDirty({ ...f, seasons: ["t0", "t1"], firstName: " Nombre " }, f)).toBe(false);
    expect(formDirty({ ...f, overrides: { t1: { shirtName: "", number: "" } } }, f)).toBe(false);
    expect(formDirty({ ...f, injured: true }, f)).toBe(true);
  });
  it("starts an alta in the active season, as a medio", () => {
    expect(emptyForm(["t1"])).toMatchObject({ seasons: ["t1"], position: "MED", number: "" });
  });
});

describe("checkPlayerForm", () => {
  const ctx = { players, seasons, editingId: null };
  const base = { ...emptyForm(["t1"]), firstName: "Kevin", shirtName: "KEVIN", number: "11" };
  it("says the dorsal is free in the season", () => {
    const c = checkPlayerForm(base, ctx);
    expect(c.ok).toBe(true);
    expect(c.number).toEqual({ tone: "ok", text: "Libre en la Temporada 1" });
  });
  it("names who already wears it, per season (season dorsals included)", () => {
    expect(checkPlayerForm({ ...base, number: "9" }, ctx).number).toEqual({ tone: "bad", text: "El 9 ya lo lleva ERIK en la Temporada 1." });
    // ADRIÁN wears the 7 only in T0
    expect(checkPlayerForm({ ...base, number: "7" }, ctx).ok).toBe(true);
    const t0 = checkPlayerForm({ ...base, number: "7", seasons: ["t1", "t0"] }, ctx);
    expect(t0.number.text).toBe("El 7 ya lo lleva ADRI en la Temporada 0 · pre-Piti.");
    // an override in T0 frees the default
    const ov = checkPlayerForm({ ...base, number: "7", seasons: ["t1", "t0"], overrides: { t0: { shirtName: "", number: "8" } } }, ctx);
    expect(ov.ok).toBe(true);
    expect(ov.number.text).toBe("Libre en la Temporada 1 y la Temporada 0 · pre-Piti");
    const ovBad = checkPlayerForm({ ...base, seasons: ["t1", "t0"], overrides: { t0: { shirtName: "", number: "7" } } }, ctx);
    expect(ovBad.overrides.t0).toEqual({ number: "El 7 ya lo lleva ADRI en la Temporada 0 · pre-Piti." });
    expect(ovBad.ok).toBe(false);
  });
  it("excludes the player being edited", () => {
    expect(checkPlayerForm({ ...formFromPlayer(players[0]) }, { ...ctx, editingId: "erik" }).ok).toBe(true);
  });
  it("checks the shirt name (2–12), the dorsal range and the rest", () => {
    expect(checkPlayerForm({ ...base, shirtName: "K" }, ctx).shirtName).toBe("El nombre en camiseta va de 2 a 12 letras.");
    expect(checkPlayerForm({ ...base, number: "" }, ctx)).toMatchObject({ ok: false, number: { tone: "mut", text: "Del 1 al 99 · único en la temporada" } });
    expect(checkPlayerForm({ ...base, number: "0" }, ctx).number).toEqual({ tone: "bad", text: "El dorsal va del 1 al 99." });
    expect(checkPlayerForm({ ...base, firstName: " " }, ctx).ok).toBe(true);
    expect(checkPlayerForm({ ...base, height: "1800" }, ctx).height).toBe("La altura va en centímetros, sin decimales.");
    const photo = checkPlayerForm({ ...base, photoUrl: "http://x.com/a.jpg" }, ctx);
    expect(photo.photo).toEqual({ tone: "bad", text: "Tiene que empezar por https://" });
    expect(photo.ok).toBe(false);
    expect(checkPlayerForm({ ...base, seasons: [] }, ctx).number.text).toBe("Libre · sin temporada elegida");
  });
  it("lets an unchanged legacy dorsal (0) through when editing other fields", () => {
    const legacy = P("zero", 0, "CERO", { seasons: ["t1"] });
    const start = formFromPlayer(legacy);
    expect(checkPlayerForm({ ...start, injured: true }, { players: [...players, legacy], seasons, editingId: "zero", start }).ok).toBe(true);
    expect(checkPlayerForm({ ...start, number: "0" }, { players, seasons, editingId: null }).ok).toBe(false);
  });
});

describe("dorsalHolder", () => {
  it("uses the season's dorsal over the default", () => {
    expect(dorsalHolder(players, "t0", 7, null)?.id).toBe("adrian");
    expect(dorsalHolder(players, "t0", 10, null)).toBeNull();
    expect(dorsalHolder(players, "t1", 10, "adrian")).toBeNull();
  });
});

describe("playerPayload", () => {
  it("saves the defaults and one seasonDetails entry per season, like the old form", () => {
    const f = { ...emptyForm(["t1", "t0"]), firstName: " Kevin ", lastName: "Del Once", shirtName: "kevin", number: "11", overrides: { t0: { shirtName: "kev", number: "" } }, height: "180", weight: "", position: "DEL" as const };
    const at = new Date(0);
    expect(playerPayload(f, { createdAt: at })).toEqual({
      firstName: "Kevin",
      lastName: "Del Once",
      shirtName: "KEVIN",
      number: 11,
      birthDate: "",
      seasons: ["t1", "t0"],
      seasonDetails: { t1: { shirtName: "KEVIN", number: 11 }, t0: { shirtName: "KEV", number: 11 } },
      height: 180,
      weight: null,
      naturalPosition: "DEL",
      injured: false,
      photoUrl: "",
      active: true,
      createdAt: at,
    });
    expect(playerPayload(f, null)).not.toHaveProperty("createdAt");
  });
  it("previews the doc the table shows while the write waits", () => {
    const doc = previewDoc(players[0], "erik", playerPayload({ ...formFromPlayer(players[0]), number: "19" }, null));
    expect(doc).toMatchObject({ id: "erik", number: 19, shirtName: "ERIK", naturalPosition: "DEL" });
    expect(doc.seasonDetails).toMatchObject({ t1: { number: 19 } });
  });
});

describe("linkState", () => {
  it("accepts only full HTTPS links", () => {
    expect(linkState("")).toBe("empty");
    expect(linkState("https://firebasestorage.googleapis.com/a.jpg")).toBe("ok");
    expect(linkState("http://i.imgur.com/a.jpg")).toBe("bad");
    expect(linkState("https://nada")).toBe("bad");
  });
});

describe("CSV", () => {
  it("quotes what needs it and never lets a cell become a formula", () => {
    expect(csvCell("ADRIÁN T.C.")).toBe("ADRIÁN T.C.");
    expect(csvCell('Dice "hola"; adiós')).toBe('"Dice ""hola""; adiós"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
  });
  it("exports the plantilla for a Spanish Excel (BOM, semicolons)", () => {
    const csv = rosterCsv(plantillaRows(players, seasons, "t1"));
    const lines = csv.slice(1).trim().split("\r\n");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe("Dorsal;Nombre en camiseta;Nombre;Apellidos;Posición;Estado;Temporadas;Nacimiento;Altura (cm);Peso (kg)");
    expect(lines[1]).toBe("1;EVANS;Nombre;evans;Portero;Activo;T1;;;");
    expect(lines[4]).toBe("4;VIEJO;Nombre;old;Medio;Lesionado;T0;;;");
    expect(csvFileName("Temporada 1")).toBe("plantilla-temporada-1.csv");
    expect(csvFileName(undefined)).toBe("plantilla.csv");
  });
});

describe("the percha (v2)", () => {
  const rows = plantillaRows(players, seasons, "t1");
  it("hangs the season's squad; while searching, the others too", () => {
    expect(perchaOf(rows, "", "Todos", true)).toEqual({ squad: rows.filter((r) => r.inSeason), others: [] });
    expect(perchaOf(rows, "viejo", "Todos", true).others.map((r) => r.id)).toEqual(["old"]);
    expect(perchaOf(rows, "", "POR", true).squad.map((r) => r.id)).toEqual(["evans"]);
    expect(perchaOf(rows, "", "Todos", false).squad).toHaveLength(4);
  });
  it("the shirt name's line: nothing for an untouched alta, then 2–12", () => {
    expect(shirtNameError("", true)).toBe("");
    expect(shirtNameError("", false)).toBe("Mínimo 2 letras");
    expect(shirtNameError("K", true)).toBe("Mínimo 2 letras");
    expect(shirtNameError("KEVIN", true)).toBe("");
    expect(shirtNameError("ABCDEFGHIJKLM", false)).toBe("Máximo 12 letras");
  });
  it("the dorsal's line: his own, free, taken, out of range, missing", () => {
    const ctx = { players, seasons, editingId: "erik" };
    const start = formFromPlayer(players[0]);
    const line = (number: string) => {
      const f = { ...start, number };
      return dorsalLine(checkPlayerForm(f, { ...ctx, start }), f, start);
    };
    expect(line("9")).toEqual({ tone: "ok", text: "Su dorsal · solo lo lleva él" });
    expect(line("99")).toEqual({ tone: "ok", text: "Libre en la Temporada 1 y la Temporada 0 · pre-Piti" });
    expect(line("10")).toEqual({ tone: "bad", text: "El 10 ya lo lleva ADRIÁN T.C. en la Temporada 1" });
    expect(line("0")).toEqual({ tone: "bad", text: "El dorsal va del 1 al 99" });
    expect(line("")).toEqual({ tone: "bad", text: "Pon un dorsal del 1 al 99" });
    const alta = emptyForm(["t1"]);
    expect(dorsalLine(checkPlayerForm(alta, { players, seasons, editingId: null }), alta, null)).toEqual({ tone: "mut", text: "Del 1 al 99 · único en la temporada" });
  });
  it("«Dar de baja» takes the season off his seasons", () => {
    expect(bajaPayload({ seasons: ["t1", "t0"] }, "t1")).toEqual({ seasons: ["t0"] });
    expect(bajaPayload({}, "t1")).toEqual({ seasons: [] });
  });
});
