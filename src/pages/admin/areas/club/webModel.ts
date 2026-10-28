// CLUB · la web del club's sections (pure): their names, where each shows on the web, the content keys each edits and
// what each is missing (it asks, never blocks). The web room and the office's door count the same.
import type { ClubContent } from "../../../../lib/clubContent";
import { WEB_SECTIONS } from "../../../../lib/adminUrls";
import type { ContentKey } from "../../club/contentModel";

export type WebSection = (typeof WEB_SECTIONS)[number];
export const ALIAS: Record<string, WebSection> = { frase: "historia", campos: "historia", escudo: "historia", foto: "contacto", colaboradores: "galeria" };
export const SECTIONS: readonly { id: WebSection; name: string; where: string; keys: readonly ContentKey[] }[] = [
  { id: "historia", name: "Frase, historia y campos", where: "El club · portada e historia", keys: ["frase", "historia", "campos"] },
  { id: "contacto", name: "Contacto, redes y foto del equipo", where: "El club · el equipo y el pie", keys: ["contacto"] },
  { id: "momentos", name: "Momentos del club", where: "El club · la historia", keys: ["momentos"] },
  { id: "historias", name: "Historias de jugadores", where: "Cada perfil de jugador", keys: ["historias"] },
  { id: "preguntas", name: "Preguntas de vestuario", where: "El club · preguntas", keys: ["preguntas"] },
  { id: "galeria", name: "Galería y colaboradores", where: "El club · galería e Inicio", keys: ["galeria", "colaboradores"] },
];
/** What a section is missing (it asks, never blocks). */
export function sectionMiss(id: WebSection, c: ClubContent, withStory: number, squad: number): string[] {
  const m: string[] = [];
  if (id === "historia") {
    if (!c.intro.trim()) m.push("falta la frase");
    if (!c.story.trim()) m.push("falta la historia");
    if (!c.crestStory?.trim()) m.push("falta la historia del escudo");
    if (!c.venues.length) m.push("sin campos");
  } else if (id === "contacto") {
    if (!c.photoUrl.trim()) m.push("sin foto del equipo");
    if (!c.email.trim()) m.push("sin correo");
  } else if (id === "momentos") {
    if (!c.milestones.length) m.push("sin momentos");
  } else if (id === "historias") {
    if (withStory < squad) m.push(`faltan ${squad - withStory} historias`);
  } else if (id === "preguntas") {
    if (!(c.faq ?? []).length) m.push("sin preguntas");
  } else if (!c.gallery.length) m.push("sin fotos");
  return m;
}


/** Every section's missing things, counted (the office's door and the room's line). */
export function webMissCount(c: ClubContent, withStory: number, squad: number): number {
  return SECTIONS.reduce((n, s) => n + sectionMiss(s.id, c, withStory, squad).length, 0);
}
