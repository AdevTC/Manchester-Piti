// The Celeste section a path belongs to (the router's error page lights its nav item).
import type { CelestePage } from "./Chrome";
import { under } from "../../lib/paths";

/** Which section a path belongs to: the header's subtitle and the nav item lit (none for a 404). */
export function sectionOf(pathname: string): { active?: CelestePage; sub: string } {
  if (pathname === "/" || pathname === "/camiseta" || under(pathname, "/hoy")) return { active: "inicio", sub: "Manchester Piti" };
  if (under(pathname, "/partidos")) return { active: "partidos", sub: "Partidos" };
  if (under(pathname, "/plantilla") || pathname.startsWith("/jugadores/")) return { active: "plantilla", sub: "Plantilla" };
  if (under(pathname, "/estadisticas")) return { active: "stats", sub: "Estadísticas" };
  if (under(pathname, "/club")) return { active: "club", sub: "El club" };
  if (["/vestuario", "/perfil", "/avisos", "/pizarra"].some((p) => under(pathname, p))) return { active: "vestuario", sub: "Vestuario" };
  return { sub: "Manchester Piti" };
}
