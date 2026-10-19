// «Compartir el cartel» from Inicio: the same cartel de la jornada Partidos makes (the poster drawn from the
// match, «Compartir» with Web Share or «Guardar la imagen»), opened in place in its glass sheet. Loaded only
// when asked for (it brings the poster's styles with it).
import type { ClubMatch } from "../../../lib/clubData";
import { cartelOf, type CartelContext } from "../../../lib/derived/vidrio/cartel";
import type { StripSegment } from "../../../lib/derived/vidrio/strip";
import { CartelSheet } from "../../partidos/vidrio/Cartel";
import { paintOf } from "../../partidos/vidrio/model";
import "../../../styles/partidos-vidrio.css";

export interface CartelShareProps {
  match: ClubMatch;
  segment: Pick<StripSegment, "light" | "at"> | null;
  ctx: CartelContext;
  onClose: () => void;
}

export default function CartelShare({ match, segment, ctx, onClose }: CartelShareProps) {
  const paint = paintOf(segment ?? { light: null, at: null });
  return <CartelSheet cartel={cartelOf(match, ctx)} paint={paint} onClose={onClose} />;
}
