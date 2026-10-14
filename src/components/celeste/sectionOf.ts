// The Celeste section a path belongs to (the router's error page lights its nav item).
import type { CelestePage } from "./Chrome";

/** Which section a path belongs to: the header's subtitle and the nav item lit (none for a 404). */
export function sectionOf(pathname: string): { active?: CelestePage; sub: string } {
  if (pathname === "/") return { active: "inicio", sub: "Manchester Piti" };
  if (pathname === "/partidos" || pathname.startsWith("/matches/")) return { active: "partidos", sub: "Partidos" };
  if (pathname === "/plantilla" || pathname.startsWith("/jugadores/")) return { active: "plantilla", sub: "Plantilla" };
  if (pathname === "/stats") return { active: "stats", sub: "Estadísticas" };
  if (pathname === "/club") return { active: "club", sub: "El club" };
  if (["/vestuario", "/profile", "/pizarra"].some((p) => pathname.startsWith(p))) return { active: "vestuario", sub: "Vestuario" };
  return { sub: "Manchester Piti" };
}
