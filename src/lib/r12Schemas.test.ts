// r12 · reading the new documents and fields defensively (src/lib/schemas.ts).
import { describe, expect, it } from "vitest";
import { clubContentDraftSchema, clubKitsSchema, clubSocialSchema, clubSponsorSchema, clubTrophySchema, notasErrorSchema, pushSentSchema, seasonMatchSchema, validItems } from "./schemas";

describe("r12 · the match's new stamps", () => {
  it("reads actaPublishedAt, mvpManual and videoMarks; anything malformed is absent, never the match", () => {
    const ok = seasonMatchSchema.parse({ id: "j1", actaPublishedAt: 5, mvpManual: { action: "close", by: "u", at: 6 }, videoMarks: { g1: 30 } });
    expect(ok).toMatchObject({ actaPublishedAt: 5, mvpManual: { action: "close", by: "u", at: 6 }, videoMarks: { g1: 30 } });
    const bad = seasonMatchSchema.parse({ id: "j1", actaPublishedAt: "ayer", mvpManual: { action: "x" }, videoMarks: { g1: -3 } });
    expect(bad.id).toBe("j1");
    expect(bad.actaPublishedAt).toBeUndefined();
    expect(bad.mvpManual).toBeUndefined();
    expect(bad.videoMarks).toBeUndefined();
  });
});

describe("r12 · clubContent: kits, trophies, socials, sponsors", () => {
  it("a bad kit reads as absent (the web paints the one in its code)", () => {
    const kits = clubKitsSchema.parse({ home: { note: "Celeste", colors: [{ name: "Celeste", hex: "#6cabdd" }] }, away: { note: "x", colors: [{ name: "Negro", hex: "negro" }] } });
    expect(kits.home?.colors[0].hex).toBe("#6cabdd");
    expect(kits.away).toBeUndefined();
  });
  it("lists keep their valid items only", () => {
    expect(validItems(clubTrophySchema, [{ name: "Copa", date: "2026" }, { name: "", date: "2026" }, { name: "Liga", date: "ayer" }], 30)).toEqual([{ name: "Copa", date: "2026" }]);
    expect(validItems(clubSocialSchema, [{ net: "tiktok", url: "https://tiktok.com/@piti" }, { net: "tiktok", url: "http://x" }, { net: "myspace", url: "https://a.b" }], 8)).toHaveLength(1);
    expect(validItems(clubSocialSchema, "nada", 8)).toEqual([]);
  });
  it("a sponsor keeps its old shape, with the new keys when valid", () => {
    expect(clubSponsorSchema.parse({ name: "Bar", url: "", logo: "" })).toEqual({ name: "Bar", url: "", logo: "" });
    expect(clubSponsorSchema.parse({ name: "Bar", url: "", logo: "", featured: true, from: "2026-10-01", to: "junio" })).toEqual({ name: "Bar", url: "", logo: "", featured: true, from: "2026-10-01" });
  });
});

describe("r12 · pushSent, clubDrafts/content, notasError", () => {
  it("pushSent: its time in ms, unknown values to their default", () => {
    const d = pushSentSchema.parse({ id: "s", title: "Final", body: "b", topic: "final", url: "/", at: { seconds: 10 }, devices: 3, members: 2, audience: "rara", kind: "manual", matchId: "j1", by: "u" });
    expect(d).toMatchObject({ at: 10_000, devices: 3, members: 2, audience: "publico", kind: "manual", matchId: "j1", by: "u", tag: "" });
  });
  it("the content's draft and the notas' failure", () => {
    expect(clubContentDraftSchema.parse({ club: {}, stories: {}, by: "u", at: null }).at).toBeNull();
    expect(clubContentDraftSchema.safeParse({ club: "x", stories: {}, by: "u", at: 1 }).success).toBe(false);
    expect(notasErrorSchema.safeParse({ at: 1, message: "x" }).success).toBe(true);
  });
});
