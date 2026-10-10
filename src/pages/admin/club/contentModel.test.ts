import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT, type ClubContent } from "../../../lib/clubContentDefaults";
import {
  GROUPS,
  NO_DRAFTS,
  monthLabel,
  resolveGroup,
  applyClub,
  canonical,
  contentIssues,
  discardSection,
  parseDrafts,
  pendingKeys,
  publishPlan,
  putClubDraft,
  putStoryDrafts,
  removePublished,
  resolveSection,
  sliceOf,
  staleKeys,
  storyIssues,
  storyOf,
  withoutPublishing,
  type PlayerStory,
} from "./contentModel";

const live: ClubContent = {
  ...DEFAULT_CONTENT,
  intro: "El equipo más celeste de la liga",
  location: "Madrid",
  milestones: [{ year: "Sep 2026", title: "Primer partido de liga", text: "" }],
  gallery: [{ url: "https://firebasestorage.googleapis.com/j6.jpg", caption: "" }],
};
const stories: Record<string, PlayerStory> = { kevin: storyOf({ bio: "" }), erik: storyOf({ bio: "Nueve", quote: "Gol", photoUrl: "https://x.es/e.jpg" }) };
const liveStory = (id: string) => stories[id] ?? storyOf(undefined);

describe("sections", () => {
  it("maps ?seccion= (and Inicio's gaps) to a section", () => {
    expect(resolveSection("galeria")).toBe("galeria");
    expect(resolveSection("escudo")).toBe("historia");
    expect(resolveSection("foto")).toBe("contacto");
    expect(resolveSection("nope")).toBeNull();
    expect(resolveSection(undefined)).toBeNull();
  });
  it("slices the content per section", () => {
    expect(sliceOf(live, "frase")).toEqual({ intro: live.intro, location: "Madrid", founded: "", venue: "" });
    expect(Object.keys(sliceOf(live, "contacto"))).toEqual(["email", "instagram", "photoUrl"]);
  });
  it("compares content ignoring key order and stray spaces", () => {
    expect(canonical({ a: " x ", b: [{ q: "1", a: "2" }] })).toBe(canonical({ b: [{ a: "2", q: "1" }], a: "x" }));
  });
});

describe("drafts", () => {
  it("saves a section as a draft, pending until published; equal to the web is no draft", () => {
    const d = putClubDraft(NO_DRAFTS, "frase", { ...sliceOf(live, "frase"), location: "Getafe" }, live, 100);
    expect(d.club.frase).toMatchObject({ value: { location: "Getafe" }, base: { location: "Madrid" }, at: 100 });
    expect(pendingKeys(d, live, liveStory)).toEqual(["frase"]);
    expect(applyClub(live, d).location).toBe("Getafe");
    const back = putClubDraft(d, "frase", sliceOf(live, "frase"), live, 200);
    expect(back.club.frase).toBeUndefined();
    expect(pendingKeys(back, live, liveStory)).toEqual([]);
  });
  it("keeps player stories apart, one draft per player", () => {
    const d = putStoryDrafts(NO_DRAFTS, { kevin: { bio: "Once", quote: "", photoUrl: "" }, erik: stories.erik }, liveStory, 5);
    expect(Object.keys(d.stories)).toEqual(["kevin"]);
    expect(pendingKeys(d, live, liveStory)).toEqual(["historias"]);
    expect(discardSection(d, "historias").stories).toEqual({});
  });
  it("flags a draft whose published starting point changed meanwhile", () => {
    const d = putClubDraft(NO_DRAFTS, "frase", { ...sliceOf(live, "frase"), location: "Getafe" }, live, 1);
    expect(staleKeys(d, live, liveStory)).toEqual([]);
    expect(staleKeys(d, { ...live, intro: "Otra frase" }, liveStory)).toEqual(["frase"]);
    // once the web equals the draft, it is neither stale nor pending
    expect(staleKeys(d, { ...live, location: "Getafe" }, liveStory)).toEqual([]);
    expect(pendingKeys(d, { ...live, location: "Getafe" }, liveStory)).toEqual([]);
  });
  it("removes only what was published (a section saved again since stays)", () => {
    const d1 = putStoryDrafts(putClubDraft(NO_DRAFTS, "frase", { ...sliceOf(live, "frase"), location: "Getafe" }, live, 1), { kevin: { bio: "Once", quote: "", photoUrl: "" } }, liveStory, 1);
    const d2 = putClubDraft(d1, "frase", { ...sliceOf(live, "frase"), location: "Leganés" }, live, 2);
    const left = removePublished(d2, d1);
    expect(left.club.frase?.value.location).toBe("Leganés");
    expect(left.stories).toEqual({});
    expect(withoutPublishing(d1, d1)).toEqual({ club: {}, stories: {} });
    expect(withoutPublishing(d1, null)).toBe(d1);
  });
  it("reads storage defensively", () => {
    expect(parseDrafts(null)).toEqual(NO_DRAFTS);
    expect(parseDrafts("{nope")).toEqual(NO_DRAFTS);
    expect(parseDrafts(JSON.stringify({ club: { frase: { value: { intro: "x" }, base: {}, at: 3 }, raro: { value: {}, base: {}, at: 1 } }, stories: { k: { value: { bio: "b" }, base: {}, at: 2 } } }))).toEqual({
      club: { frase: { value: { intro: "x" }, base: {}, at: 3 } },
      stories: { k: { value: { bio: "b", quote: "", photoUrl: "" }, base: { bio: "", quote: "", photoUrl: "" }, at: 2 } },
    });
  });
});

describe("checks", () => {
  it("blocks broken links and incomplete items (the old editor's rules + the Firestore limits)", () => {
    expect(contentIssues(live)).toEqual([]);
    const bad: ClubContent = {
      ...live,
      email: "club@",
      instagram: "http://instagram.com/piti",
      gallery: [...live.gallery, { url: "http://i.imgur.com/banquillo.jpg", caption: "" }],
      milestones: [{ year: "2026", title: " ", text: "" }],
      faq: [{ q: "¿Dónde?", a: "" }],
      sponsors: [{ name: "", url: "https://bar.es", logo: "ftp://x" }],
      intro: "x".repeat(1000),
    };
    expect(contentIssues(bad).map((i) => `${i.key}: ${i.text}`)).toEqual([
      "frase: La frase es demasiado larga",
      "contacto: Contacto: el correo no es válido",
      "contacto: Contacto: 1 enlace no es HTTPS",
      "momentos: Momentos: hay uno sin título",
      "preguntas: Preguntas: hay una sin pregunta o sin respuesta",
      "colaboradores: Colaboradores: hay uno sin nombre",
      "colaboradores: Colaboradores: 1 enlace no es HTTPS",
      "galeria: Galería: 1 enlace no es HTTPS",
    ]);
    expect(storyIssues([{ name: "KEVIN", story: { bio: "", quote: "", photoUrl: "http://x.es/k.jpg" } }])).toEqual([{ key: "historias", text: "Historias: la foto de KEVIN no es HTTPS" }]);
  });
});

describe("publishPlan", () => {
  it("writes the whole document with every club draft, and only the changed stories", () => {
    let d = putClubDraft(NO_DRAFTS, "galeria", { gallery: [...live.gallery, { url: "https://x.es/2.jpg", caption: "J7" }] }, live, 1);
    d = putStoryDrafts(d, { kevin: { bio: " Once ", quote: "", photoUrl: "" } }, liveStory, 1);
    // built from the content published at commit time: someone else's intro survives
    const now = { ...live, intro: "Cambiada por otro capitán" };
    const plan = publishPlan(d, now, liveStory);
    expect(plan.sections).toEqual(["historias", "galeria"]);
    expect(plan.content?.intro).toBe("Cambiada por otro capitán");
    expect(plan.content?.gallery).toHaveLength(2);
    expect(plan.stories).toEqual([{ id: "kevin", data: { bio: "Once", quote: "", photoUrl: "" } }]);
    expect(publishPlan(putStoryDrafts(NO_DRAFTS, { kevin: { bio: "x", quote: "", photoUrl: "" } }, liveStory, 1), live, liveStory).content).toBeNull();
  });
});

describe("the programa del club", () => {
  it("covers every section once, in six numbered entries", () => {
    expect(GROUPS.map((g) => g.key)).toEqual(["frase", "contacto", "momentos", "historias", "preguntas", "galeria"]);
    expect(GROUPS.flatMap((g) => g.keys).sort()).toEqual(["colaboradores", "contacto", "frase", "galeria", "historia", "historias", "momentos", "preguntas"]);
  });
  it("resolves ?seccion= to its entry (section keys and Hoy's gaps too)", () => {
    expect(resolveGroup("historia")).toBe("frase");
    expect(resolveGroup("escudo")).toBe("frase");
    expect(resolveGroup("foto")).toBe("contacto");
    expect(resolveGroup("colaboradores")).toBe("galeria");
    expect(resolveGroup("momentos")).toBe("momentos");
    expect(resolveGroup("nada")).toBeNull();
    expect(resolveGroup(undefined)).toBeNull();
  });
  it("dates a new momento with the month in Madrid", () => {
    expect(monthLabel(Date.UTC(2026, 10, 2, 9))).toBe("Nov 2026");
    expect(monthLabel(Date.UTC(2026, 9, 31, 23, 30))).toBe("Nov 2026");
  });
});
