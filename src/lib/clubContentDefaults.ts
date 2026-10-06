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
  /** Preguntas de vestuario (El club). */
  faq: { q: string; a: string }[];
  /** La historia del escudo (El club, bajo la vitrina). */
  crestStory: string;
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
  faq: [
    { q: "¿Cómo me apunto?", a: "Escríbenos desde «Un lugar en el equipo», en los clasificados de esta página: te contamos cuándo jugamos y te venimos a conocer." },
    { q: "¿Dónde y cuándo jugamos?", a: "Los partidos, con fecha, hora y campo, están en Partidos; suscríbete al calendario y te llegan solos." },
    { q: "¿Puedo venir a vernos?", a: "Claro. La grada es libre y el ánimo se agradece: el próximo partido está en esta misma página." },
  ],
  crestStory: "",
};
