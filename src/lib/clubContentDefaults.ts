// What the club page shows before (or without) its Firestore document.
export interface ClubContent {
  intro: string;
  story: string;
  location: string;
  founded: string;
  venue: string;
  email: string;
  instagram: string;
  photoUrl: string;
  milestones: { year: string; title: string; text: string }[];
  sponsors: { name: string; url: string; logo: string }[];
  gallery: { url: string; caption: string }[];
}
export const DEFAULT_CONTENT: ClubContent = {
  intro: "Resultados, calendario y estadísticas del Manchester Piti.",
  story:
    "Manchester Piti es un equipo amateur de fútbol 7. Aquí puedes consultar nuestra plantilla, los partidos y las estadísticas de cada temporada.",
  location: "",
  founded: "",
  venue: "",
  email: "",
  instagram: "",
  photoUrl: "",
  milestones: [],
  sponsors: [],
  gallery: [],
};
