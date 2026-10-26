// DEV only: the CL- boards' «Maqueta» strip over production's data. `?quien=fan|socio|jugador|capitan` looks at the
// club (and the vestuario) as someone else — the reads and writes stay the signed-in test member's —, `?momento=larga` (or `estreno`, three days before the season's first match)
// reads the long demo season (Partidos' fixture) and `?contenido=demo` fills the club's content with the boards' DEMO
// (year, barrio, moments, the crest's story, the grounds, the sponsors, the email) so every section shows full. The
// production build never reads it.
import type { ClubContent } from "../../../lib/clubContentDefaults";

export type Quien = "fan" | "socio" | "jugador" | "capitan";
export interface ClubMaqueta {
  quien: Quien | null;
  larga: boolean;
  estreno: boolean;
  demo: boolean;
}

export function readClubMaqueta(search: Record<string, unknown>): ClubMaqueta | null {
  if (!import.meta.env.DEV) return null;
  const q = typeof search.quien === "string" ? search.quien : "";
  const quien = q === "fan" || q === "socio" || q === "jugador" || q === "capitan" ? q : null;
  const larga = search.momento === "larga";
  const estreno = search.momento === "estreno";
  const demo = search.contenido === "demo";
  return quien || larga || estreno || demo ? { quien, larga, estreno, demo } : null;
}

/** The boards' DEMO content (data.js CONTENT), over what the club has published. */
export function demoContent(c: ClubContent): ClubContent {
  return {
    ...c,
    location: "Vallecas",
    founded: "2025",
    crestStory: "Un piti con la camiseta celeste y la bufanda al cuello: el escudo se dibujó en una servilleta la noche que el equipo cambió de nombre.",
    milestones: [
      { year: "2025", title: "Nace el nombre", text: "El equipo de siempre pasa a llamarse Manchester Piti." },
      { year: "2026", title: "Primera liga con escudo", text: "Temporada 1 en la liga de fútbol 7 de Vallecas." },
    ],
    venues: [
      { name: "CDM Palomeras", address: "Calle de Pedro Laborde, s/n · Puente de Vallecas", transit: "Metro Portazgo (L1), 8 min andando" },
      { name: "Campo de Pitutis", address: "Polideportivo de Moratalaz", transit: "Bus 32, parada Arroyo Fontarrón" },
    ],
    sponsors: [
      { name: "Bar Casa Paco", url: "https://example.com", logo: "" },
      { name: "Fisio Vallecas", url: "", logo: "" },
    ],
    email: "hola@manchesterpiti.es",
    instagram: "https://instagram.com/manchesterpiti",
    youtube: "https://www.youtube.com/@ManchesterPitiFC2026",
  };
}
