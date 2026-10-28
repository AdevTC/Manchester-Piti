// The club's social profiles: what Club's head and Inicio's «Síguenos» link to. r12 M-45: clubContent.socials (any
// of the eight networks, in its order) when it has a valid one; else the old instagram / youtube fields, exactly as
// before (clubExtras.readSocials). Only an https address becomes a link; Instagram and YouTube also have to be the
// network's own site (anything else — empty, a typo, another site — shows nothing). One link per network.
import { readSocials, SOCIAL_NAME, type RawContent, type SocialNet } from "./clubExtras";

export type SocialKey = SocialNet;

export interface SocialLink {
  key: SocialKey;
  /** «Instagram», «YouTube». */
  name: string;
  /** «@manchesterpiti.__» (the profile's handle, from its address), or the bare name when there isn't one. */
  handle: string;
  /** What the network holds, for Inicio's tile. */
  blurb: string;
  href: string;
}

/** Networks whose address must be on their own site (the old fields' check, kept for the list too). */
const HOSTS: Partial<Record<SocialKey, readonly string[]>> = {
  instagram: ["instagram.com", "www.instagram.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com"],
};
const BLURB: Record<SocialKey, string> = {
  instagram: "Fotos y lo que pasa en cada partido",
  youtube: "Los partidos en vídeo",
  tiktok: "Los mejores momentos, en corto",
  whatsapp: "El canal del club",
  x: "Lo último del Piti",
  facebook: "Las noticias del club",
  twitch: "Partidos en directo",
  web: "Más del Piti",
};

/** The profile's handle from its address: instagram.com/user → @user, youtube.com/@Name → @Name, tiktok.com/@user
 *  → @user, x.com/user → @user, twitch.tv/user → user; a web, its host. */
function handleOf(key: SocialKey, url: URL): string {
  const first = url.pathname.split("/").filter(Boolean)[0] ?? "";
  if (key === "instagram" || key === "x") return first ? `@${first.replace(/^@/, "")}` : "";
  if (key === "youtube" || key === "tiktok") return first.startsWith("@") ? first : "";
  if (key === "twitch") return first;
  if (key === "web") return url.hostname.replace(/^www\./, "");
  return "";
}

/** The links worth showing, in the content's order (old fields: Instagram first). */
export function socialLinks(c: RawContent<"socials" | "instagram" | "youtube">): SocialLink[] {
  const out: SocialLink[] = [];
  for (const s of readSocials(c)) {
    if (out.some((l) => l.key === s.net)) continue;
    let url: URL;
    try {
      url = new URL(s.url.trim());
    } catch {
      continue;
    }
    const hosts = HOSTS[s.net];
    if (url.protocol !== "https:" || (hosts && !hosts.includes(url.hostname.toLowerCase()))) continue;
    out.push({ key: s.net, name: SOCIAL_NAME[s.net], handle: handleOf(s.net, url) || SOCIAL_NAME[s.net], blurb: BLURB[s.net], href: url.href });
  }
  return out;
}

/** Its accessible name: whose profile it is, and that it opens elsewhere. */
export const socialLabel = (l: SocialLink) => `${l.name} de Manchester Piti (se abre en otra pestaña)`;
