// r12 M-19 / M-45 · what clubContent may now hold beyond the old fields — the kits, the trophies, the networks and
// the featured sponsor — read with their Zod (a malformed entry reads as absent) and, when absent, what the web's
// code has always shown: with no new data the public pages stay exactly as they were. The Sala de control's
// Equipaciones and «La web del club» edit them; El club (El equipo, the vitrina), Inicio and the head's networks read
// them through here.
import type { ClubContent, ClubKit, ClubSocial, ClubTrophy } from "./clubContentDefaults";
import { SOCIAL_NETS } from "./clubContentDefaults";
import { clubKitsSchema, clubSocialSchema, clubSponsorSchema, clubTrophySchema, validItems } from "./schemas";

export type KitId = "home" | "away";
export type SocialNet = (typeof SOCIAL_NETS)[number];

/** The kits as the web's code has them (El equipo's note and swatches). */
export const DEFAULT_KITS: Record<KitId, ClubKit> = {
  home: {
    name: "1ª equipación",
    note: "Celeste de la casa, con el oro en el cuello y el bajo.",
    colors: [
      { name: "Celeste", hex: "#8ac8f5" },
      { name: "Tinta", hex: "#051330" },
      { name: "Oro", hex: "#cfa862" },
    ],
  },
  away: {
    name: "2ª equipación",
    note: "Negra de fuera, con la franja roja en diagonal.",
    colors: [
      { name: "Noche", hex: "#1d1d22" },
      { name: "Tiza", hex: "#f5f5f5" },
      { name: "Rojo", hex: "#d6161f" },
    ],
  },
};

export interface ReadKit extends ClubKit {
  /** True when it comes from clubContent.kits (false: the code's). */
  saved: boolean;
}

/** Each kit: clubContent.kits' when it is valid, else the code's. */
/** What the readers take: any of clubContent's fields, as stored (unchecked: each reader validates its own). */
export type RawContent<K extends keyof ClubContent> = { readonly [P in K]?: unknown } | null | undefined;

export function readKits(c: RawContent<"kits">): Record<KitId, ReadKit> {
  const parsed = clubKitsSchema.safeParse(c?.kits ?? {});
  const saved = parsed.success ? parsed.data : {};
  const one = (id: KitId): ReadKit => {
    const k = saved[id];
    return k ? { name: k.name || DEFAULT_KITS[id].name, note: k.note, colors: k.colors, saved: true } : { ...DEFAULT_KITS[id], saved: false };
  };
  return { home: one("home"), away: one("away") };
}

/** The trophies (only the valid ones), newest first. None: the vitrina's «La primera copa · Aquí irá». */
export function readTrophies(c: RawContent<"trophies">): ClubTrophy[] {
  return validItems(clubTrophySchema, c?.trophies, 30).sort((a, b) => b.date.localeCompare(a.date));
}

export const SOCIAL_NAME: Record<SocialNet, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  x: "X",
  facebook: "Facebook",
  twitch: "Twitch",
  web: "La web",
};

/** The networks: clubContent.socials when it has any valid one, else the old instagram / youtube fields (in that
 *  order). Only https addresses; the order is the list's. */
export function readSocials(c: RawContent<"socials" | "instagram" | "youtube">): ClubSocial[] {
  const list = validItems(clubSocialSchema, c?.socials, 8);
  if (list.length) return list;
  const old: ClubSocial[] = [];
  for (const net of ["instagram", "youtube"] as const) {
    const url = String(c?.[net] ?? "").trim();
    if (/^https:\/\//.test(url)) old.push({ net, url });
  }
  return old;
}

/** The old fields written beside `socials` (today's web reads them): the first of each network, or "". */
export function legacySocialFields(socials: readonly ClubSocial[]): { instagram: string; youtube: string } {
  return {
    instagram: socials.find((s) => s.net === "instagram")?.url ?? "",
    youtube: socials.find((s) => s.net === "youtube")?.url ?? "",
  };
}

export interface FeaturedSponsor {
  name: string;
  /** https or "". */
  url: string;
  /** https or "". */
  logo: string;
}

/** The sponsor Inicio shows: the first one marked `featured` whose dates (inclusive, Madrid `YYYY-MM-DD`) hold
 *  `today`; none marked, none in date or no name: null (Inicio stays as it was). */
export function featuredSponsor(c: RawContent<"sponsors">, today: string): FeaturedSponsor | null {
  const list = validItems(clubSponsorSchema, c?.sponsors, 50);
  const hit = list.find((s) => s.featured && s.name.trim() && (!s.from || s.from <= today) && (!s.to || today <= s.to));
  if (!hit) return null;
  const https = (u: string) => (/^https:\/\/\S+$/.test(u.trim()) ? u.trim() : "");
  return { name: hit.name.trim(), url: https(hit.url), logo: https(hit.logo) };
}
