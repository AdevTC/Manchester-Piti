// The club's social profiles (clubContent instagram / youtube): what Club's head and Inicio's «Síguenos» link
// to. Only an https address of the network's own site becomes a link; anything else (empty, a typo, another
// site) shows nothing.

export type SocialKey = "instagram" | "youtube";

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

const HOSTS: Record<SocialKey, readonly string[]> = {
  instagram: ["instagram.com", "www.instagram.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com"],
};
const NAME: Record<SocialKey, string> = { instagram: "Instagram", youtube: "YouTube" };
const BLURB: Record<SocialKey, string> = { instagram: "Fotos y lo que pasa en cada partido", youtube: "Los partidos en vídeo" };

/** The profile's handle from its address: instagram.com/user → @user, youtube.com/@Name → @Name. */
function handleOf(key: SocialKey, url: URL): string {
  const first = url.pathname.split("/").filter(Boolean)[0] ?? "";
  if (key === "instagram") return first ? `@${first}` : "";
  return first.startsWith("@") ? first : "";
}

/** The links worth showing, Instagram first. */
export function socialLinks(c: { instagram?: string; youtube?: string }): SocialLink[] {
  const out: SocialLink[] = [];
  for (const key of ["instagram", "youtube"] as const) {
    const raw = (c[key] ?? "").trim();
    if (!raw) continue;
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" || !HOSTS[key].includes(url.hostname.toLowerCase())) continue;
    out.push({ key, name: NAME[key], handle: handleOf(key, url) || NAME[key], blurb: BLURB[key], href: url.href });
  }
  return out;
}

/** Its accessible name: whose profile it is, and that it opens elsewhere. */
export const socialLabel = (l: SocialLink) => `${l.name} de Manchester Piti (se abre en otra pestaña)`;
