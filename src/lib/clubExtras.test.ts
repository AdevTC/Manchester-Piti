import { describe, expect, it } from "vitest";
import { DEFAULT_KITS, featuredSponsor, legacySocialFields, readKits, readSocials, readTrophies } from "./clubExtras";

describe("readKits (r12 M-19)", () => {
  it("no kits: the code's, marked not saved", () => {
    const k = readKits({});
    expect(k.home).toEqual({ ...DEFAULT_KITS.home, saved: false });
    expect(k.away).toEqual({ ...DEFAULT_KITS.away, saved: false });
    expect(readKits(null).home.saved).toBe(false);
  });
  it("a valid kit wins; a malformed one falls back to the code's, alone", () => {
    const k = readKits({ kits: { home: { note: "Celeste nueva", colors: [{ name: "Cielo", hex: "#aabbcc" }] }, away: { note: "x", colors: [{ name: "Mal", hex: "rojo" }] } } });
    expect(k.home).toEqual({ name: "1ª equipación", note: "Celeste nueva", colors: [{ name: "Cielo", hex: "#aabbcc" }], saved: true });
    expect(k.away.saved).toBe(false);
    expect(k.away.note).toBe(DEFAULT_KITS.away.note);
  });
});

describe("readTrophies (r12 M-19)", () => {
  it("only the valid ones, newest first", () => {
    const t = readTrophies({ trophies: [{ name: "Copa de verano", date: "2025" }, { name: "", date: "2026" }, { name: "Torneo de Navidad", date: "2025-12-20" }, { name: "Raro", date: "ayer" }] });
    expect(t.map((x) => x.name)).toEqual(["Torneo de Navidad", "Copa de verano"]);
    expect(readTrophies({})).toEqual([]);
    expect(readTrophies({ trophies: "nada" as unknown as [] })).toEqual([]);
  });
});

describe("readSocials (r12 M-45)", () => {
  it("without socials: the old fields, Instagram first, only https", () => {
    expect(readSocials({ instagram: "https://instagram.com/a", youtube: "https://youtube.com/@b" })).toEqual([
      { net: "instagram", url: "https://instagram.com/a" },
      { net: "youtube", url: "https://youtube.com/@b" },
    ]);
    expect(readSocials({ instagram: "manchesterpiti", youtube: "" })).toEqual([]);
  });
  it("with a valid list it rules (its order), dropping bad entries", () => {
    expect(readSocials({ instagram: "https://instagram.com/a", socials: [{ net: "tiktok", url: "https://tiktok.com/@x" }, { net: "myspace", url: "https://m.com" }, { net: "x", url: "http://x.com/y" }] })).toEqual([{ net: "tiktok", url: "https://tiktok.com/@x" }]);
  });
  it("a list with nothing valid falls back to the old fields", () => {
    expect(readSocials({ youtube: "https://youtube.com/@b", socials: [{ net: "x", url: "nope" }] })).toEqual([{ net: "youtube", url: "https://youtube.com/@b" }]);
  });
  it("legacySocialFields: the first of each, or empty", () => {
    expect(legacySocialFields([{ net: "x", url: "https://x.com/a" }, { net: "youtube", url: "https://youtube.com/@b" }, { net: "youtube", url: "https://youtube.com/@c" }])).toEqual({ instagram: "", youtube: "https://youtube.com/@b" });
  });
});

describe("featuredSponsor (r12 M-45)", () => {
  const s = (o: Record<string, unknown>) => ({ sponsors: [{ name: "Bar Pepe", url: "https://bar.es", logo: "", ...o }] });
  it("none marked: null", () => {
    expect(featuredSponsor(s({}), "2026-10-28")).toBeNull();
    expect(featuredSponsor({ sponsors: [] }, "2026-10-28")).toBeNull();
  });
  it("its dates, inclusive", () => {
    expect(featuredSponsor(s({ featured: true, from: "2026-10-28", to: "2026-10-28" }), "2026-10-28")?.name).toBe("Bar Pepe");
    expect(featuredSponsor(s({ featured: true, from: "2026-10-29" }), "2026-10-28")).toBeNull();
    expect(featuredSponsor(s({ featured: true, to: "2026-10-27" }), "2026-10-28")).toBeNull();
    expect(featuredSponsor(s({ featured: true }), "2026-10-28")).toEqual({ name: "Bar Pepe", url: "https://bar.es", logo: "" });
  });
  it("links only https; a nameless one never shows", () => {
    expect(featuredSponsor(s({ featured: true, url: "http://bar.es", logo: "javascript:x" }), "2026-10-28")).toEqual({ name: "Bar Pepe", url: "", logo: "" });
    expect(featuredSponsor({ sponsors: [{ name: "  ", url: "", logo: "", featured: true }] }, "2026-10-28")).toBeNull();
  });
});
