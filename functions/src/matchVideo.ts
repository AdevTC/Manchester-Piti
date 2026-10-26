// El vídeo del partido (matches/{id}.videoUrl): the YouTube link of the whole match, set in Encuentro and shown
// as «Ver el partido en YouTube» on its page. Shared by saveMatchSheet's schema and the web (pure).

const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

/** An https link to a YouTube video (youtube.com/watch, /live, /shorts or youtu.be). "" is not one. */
export function isYouTubeUrl(raw: string | undefined): boolean {
  const v = (raw ?? "").trim();
  if (!v) return false;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || !HOSTS.has(u.hostname.toLowerCase())) return false;
  if (u.hostname.toLowerCase() === "youtu.be") return u.pathname.length > 1;
  return (u.pathname === "/watch" && !!u.searchParams.get("v")) || /^\/(live|shorts|embed)\/[^/]+/.test(u.pathname);
}

/** The match's video link to show, or null (absent, empty or not YouTube). */
export const matchVideoHref = (raw: string | undefined): string | null => (isYouTubeUrl(raw) ? (raw ?? "").trim() : null);
