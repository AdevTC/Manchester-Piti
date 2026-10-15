// Shared by the vestuario and match tab: one draft, one scoring rule, one server write.
import { PredictionForm } from "../../../components/celeste/PredictionForm";
import type { ClubMatch } from "../../../lib/clubData";
import type { PlayerDoc } from "../../../lib/schemas";
export const PORRA_RULE = "Acierta el marcador, los goleadores y los asistentes. Consulta los puntos en «Cómo se puntúa».";
export function PorraCard({ match, players = [], uid, className }: { match: ClubMatch; players?: PlayerDoc[]; uid: string | undefined; className?: string; now?: number }) {
  return uid ? <div className={className}><PredictionForm key={match.id} match={match} players={players} uid={uid} /></div> : null;
}
