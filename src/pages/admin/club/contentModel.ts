// Contenido del club — the draft model, pure (tested in contentModel.test.ts).
//
// The club content (clubContent/main) and the player stories (players/{id}: bio, quote, photoUrl) have no
// drafts in Firestore — the rules only accept the published fields — so drafts live on this device, per
// section: «Guardar borrador» keeps the section's new value (and the published value it started from);
// the section reads «Sin publicar» until «Publicar contenido» writes every draft at once. A draft equal to
// what is published is no draft. A draft whose starting point changed on the web meanwhile is flagged
// («Revisar»), and nothing with a broken link (not HTTPS) or an incomplete item gets published.
import type { ClubContent } from "../../../lib/clubContent";
import { linkState } from "./plantillaLogic";

export type ContentKey = "frase" | "historia" | "contacto" | "momentos" | "historias" | "preguntas" | "colaboradores" | "galeria";
export type ClubKey = Exclude<ContentKey, "historias">;

/** The clubContent fields each section edits. */
export const CLUB_FIELDS = {
  frase: ["intro", "location", "founded", "venue"],
  historia: ["story", "crestStory"],
  contacto: ["email", "instagram", "photoUrl"],
  momentos: ["milestones"],
  preguntas: ["faq"],
  colaboradores: ["sponsors"],
  galeria: ["gallery"],
} as const satisfies Record<ClubKey, readonly (keyof ClubContent)[]>;

export const SECTIONS: readonly { key: ContentKey; title: string }[] = [
  { key: "frase", title: "Frase, localidad y campo" },
  { key: "historia", title: "Nuestra historia y el escudo" },
  { key: "contacto", title: "Contacto, redes y foto de equipo" },
  { key: "momentos", title: "Momentos del club" },
  { key: "historias", title: "Historias de jugadores" },
  { key: "preguntas", title: "Preguntas de vestuario" },
  { key: "colaboradores", title: "Colaboradores" },
  { key: "galeria", title: "Galería" },
];
export const sectionTitle = (k: ContentKey) => SECTIONS.find((s) => s.key === k)?.title ?? "";
/** `?seccion=` → a section (Inicio's gaps link «escudo» and «foto» too). */
export function resolveSection(v: unknown): ContentKey | null {
  const s = String(v ?? "");
  if (s === "escudo") return "historia";
  if (s === "foto") return "contacto";
  return SECTIONS.some((x) => x.key === s) ? (s as ContentKey) : null;
}

/** Rules' limits (firestore.rules · clubContent). */
export const LIMITS = { intro: 999, story: 19_999, crestStory: 4_999, gallery: 100, sponsors: 50, milestones: 100, faq: 30 } as const;

export type Slice = Partial<ClubContent>;
export function sliceOf(c: ClubContent, k: ClubKey): Slice {
  const out: Record<string, unknown> = {};
  for (const f of CLUB_FIELDS[k]) out[f] = c[f];
  return out as Slice;
}
export interface PlayerStory {
  bio: string;
  quote: string;
  photoUrl: string;
}
export const storyOf = (p: { bio?: string; quote?: string; photoUrl?: string } | undefined): PlayerStory => ({ bio: p?.bio ?? "", quote: p?.quote ?? "", photoUrl: p?.photoUrl ?? "" });

/** JSON with sorted keys and trimmed strings: «the same content» regardless of key order or stray spaces. */
export function canonical(v: unknown): string {
  const norm = (x: unknown): unknown => {
    if (typeof x === "string") return x.trim();
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === "object")
      return Object.fromEntries(
        Object.keys(x)
          .sort()
          .map((k) => [k, norm((x as Record<string, unknown>)[k])]),
      );
    return x ?? "";
  };
  return JSON.stringify(norm(v));
}
export const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

export interface DraftEntry<T> {
  value: T;
  /** The published value when the draft was saved (to notice the web changing meanwhile). */
  base: T;
  /** When it was saved (ms). */
  at: number;
}
export interface Drafts {
  club: Partial<Record<ClubKey, DraftEntry<Slice>>>;
  stories: Record<string, DraftEntry<PlayerStory>>;
}
export const NO_DRAFTS: Drafts = { club: {}, stories: {} };

/** Saves a section's draft (or drops it when it equals what is published). */
export function putClubDraft(d: Drafts, key: ClubKey, value: Slice, live: ClubContent, at: number): Drafts {
  const club = { ...d.club };
  const base = sliceOf(live, key);
  if (same(value, base)) delete club[key];
  else club[key] = { value, base, at };
  return { ...d, club };
}
/** Saves player stories' drafts (each dropped when equal to the published one). */
export function putStoryDrafts(d: Drafts, values: Record<string, PlayerStory>, live: (id: string) => PlayerStory, at: number): Drafts {
  const stories = { ...d.stories };
  for (const [id, value] of Object.entries(values)) {
    const base = live(id);
    if (same(value, base)) delete stories[id];
    else stories[id] = { value, base, at };
  }
  return { ...d, stories };
}
export function discardSection(d: Drafts, key: ContentKey): Drafts {
  if (key === "historias") return { ...d, stories: {} };
  const club = { ...d.club };
  delete club[key];
  return { ...d, club };
}
/** Removes the drafts `published` held — only those not saved again since (their `at` matches). */
export function removePublished(d: Drafts, published: Drafts): Drafts {
  const club = { ...d.club };
  for (const k of Object.keys(published.club) as ClubKey[]) if (club[k] && club[k]?.at === published.club[k]?.at) delete club[k];
  const stories = { ...d.stories };
  for (const id of Object.keys(published.stories)) if (stories[id] && stories[id].at === published.stories[id].at) delete stories[id];
  return { club, stories };
}
/** `d` without what `published` holds (shown as published while its write waits behind «Deshacer»). */
export const withoutPublishing = (d: Drafts, publishing: Drafts | null) => (publishing ? removePublished(d, publishing) : d);

/** Published content with the club drafts applied. */
export function applyClub(live: ClubContent, d: Drafts): ClubContent {
  let out = live;
  for (const e of Object.values(d.club)) if (e) out = { ...out, ...e.value };
  return out;
}
/** A player's story with its draft applied. */
export const storyWith = (d: Drafts, id: string, live: PlayerStory) => d.stories[id]?.value ?? live;

/** The sections with a pending change (a draft that differs from what is published now). */
export function pendingKeys(d: Drafts, live: ClubContent, liveStory: (id: string) => PlayerStory): ContentKey[] {
  const keys = new Set<ContentKey>();
  for (const k of Object.keys(d.club) as ClubKey[]) {
    const e = d.club[k];
    if (e && !same(e.value, sliceOf(live, k))) keys.add(k);
  }
  if (Object.entries(d.stories).some(([id, e]) => !same(e.value, liveStory(id)))) keys.add("historias");
  return SECTIONS.map((s) => s.key).filter((k) => keys.has(k));
}
/** Drafts saved over a published value that has changed on the web since. */
export function staleKeys(d: Drafts, live: ClubContent, liveStory: (id: string) => PlayerStory): ContentKey[] {
  const out: ContentKey[] = [];
  for (const k of Object.keys(d.club) as ClubKey[]) {
    const e = d.club[k];
    if (e && !same(e.base, sliceOf(live, k)) && !same(e.value, sliceOf(live, k))) out.push(k);
  }
  if (Object.entries(d.stories).some(([id, e]) => !same(e.base, liveStory(id)) && !same(e.value, liveStory(id)))) out.push("historias");
  return out;
}

// ───────────────────────── checks ─────────────────────────
export interface Issue {
  key: ContentKey;
  text: string;
}
const nBad = (urls: string[]) => urls.filter((u) => linkState(u) === "bad").length;
const links = (n: number) => (n === 1 ? "1 enlace no es HTTPS" : `${n} enlaces no son HTTPS`);
export const emailOk = (v: string) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** What would stop the club content from being published (the old editor's checks + the rules' limits). */
export function contentIssues(c: ClubContent): Issue[] {
  const out: Issue[] = [];
  if (c.intro.length > LIMITS.intro) out.push({ key: "frase", text: "La frase es demasiado larga" });
  if (c.story.length > LIMITS.story) out.push({ key: "historia", text: "Nuestra historia es demasiado larga" });
  if ((c.crestStory ?? "").length > LIMITS.crestStory) out.push({ key: "historia", text: "La historia del escudo es demasiado larga" });
  if (!emailOk(c.email)) out.push({ key: "contacto", text: "Contacto: el correo no es válido" });
  const nc = nBad([c.instagram, c.photoUrl]);
  if (nc) out.push({ key: "contacto", text: `Contacto: ${links(nc)}` });
  if (c.milestones.some((m) => !m.title.trim())) out.push({ key: "momentos", text: "Momentos: hay uno sin título" });
  if (c.milestones.length > LIMITS.milestones) out.push({ key: "momentos", text: `Momentos: máximo ${LIMITS.milestones}` });
  if ((c.faq ?? []).some((f) => !f.q.trim() || !f.a.trim())) out.push({ key: "preguntas", text: "Preguntas: hay una sin pregunta o sin respuesta" });
  if ((c.faq ?? []).length > LIMITS.faq) out.push({ key: "preguntas", text: `Preguntas: máximo ${LIMITS.faq}` });
  if (c.sponsors.some((s) => !s.name.trim())) out.push({ key: "colaboradores", text: "Colaboradores: hay uno sin nombre" });
  const ns = nBad(c.sponsors.flatMap((s) => [s.url, s.logo]));
  if (ns) out.push({ key: "colaboradores", text: `Colaboradores: ${links(ns)}` });
  if (c.sponsors.length > LIMITS.sponsors) out.push({ key: "colaboradores", text: `Colaboradores: máximo ${LIMITS.sponsors}` });
  const ng = nBad(c.gallery.map((g) => g.url)) + c.gallery.filter((g) => !g.url.trim()).length;
  if (ng) out.push({ key: "galeria", text: `Galería: ${links(ng)}` });
  if (c.gallery.length > LIMITS.gallery) out.push({ key: "galeria", text: `Galería: máximo ${LIMITS.gallery} fotos` });
  return out;
}
/** Player stories with a photo that is not HTTPS. */
export function storyIssues(stories: readonly { name: string; story: PlayerStory }[]): Issue[] {
  const bad = stories.filter((s) => linkState(s.story.photoUrl) === "bad").map((s) => s.name);
  return bad.length ? [{ key: "historias", text: `Historias: la foto de ${bad.join(", ")} no es HTTPS` }] : [];
}

// ───────────────────────── publishing ─────────────────────────
export interface PublishPlan {
  /** The whole clubContent/main document to write, or null when no club section changed. */
  content: ClubContent | null;
  /** players/{id} merges (bio, quote, photoUrl). */
  stories: { id: string; data: PlayerStory }[];
  sections: ContentKey[];
}
/** What «Publicar contenido» writes: the published content with every club draft applied, and each
 *  changed player story. Built at commit time from the content published then. */
export function publishPlan(d: Drafts, live: ClubContent, liveStory: (id: string) => PlayerStory): PublishPlan {
  const sections = pendingKeys(d, live, liveStory);
  const clubChanged = sections.some((k) => k !== "historias");
  return {
    content: clubChanged ? applyClub(live, d) : null,
    stories: Object.entries(d.stories)
      .filter(([id, e]) => !same(e.value, liveStory(id)))
      .map(([id, e]) => ({ id, data: { bio: e.value.bio.trim(), quote: e.value.quote.trim(), photoUrl: e.value.photoUrl.trim() } })),
    sections,
  };
}

/** Parses what localStorage holds (anything unexpected reads as no drafts). */
export function parseDrafts(raw: string | null): Drafts {
  if (!raw) return NO_DRAFTS;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return NO_DRAFTS;
    const o = v as { club?: unknown; stories?: unknown };
    const okEntry = (e: unknown): e is DraftEntry<unknown> => !!e && typeof e === "object" && "value" in e && "base" in e && typeof (e as { at?: unknown }).at === "number";
    const club: Drafts["club"] = {};
    if (o.club && typeof o.club === "object")
      for (const [k, e] of Object.entries(o.club)) if (Object.hasOwn(CLUB_FIELDS, k) && okEntry(e) && e.value && typeof e.value === "object") club[k as ClubKey] = e as DraftEntry<Slice>;
    const stories: Drafts["stories"] = {};
    if (o.stories && typeof o.stories === "object")
      for (const [id, e] of Object.entries(o.stories)) if (okEntry(e)) stories[id] = { value: storyOf(e.value as PlayerStory), base: storyOf(e.base as PlayerStory), at: e.at };
    return { club, stories };
  } catch {
    return NO_DRAFTS;
  }
}
