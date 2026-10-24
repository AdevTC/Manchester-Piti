import type { SeasonRating } from "../lib/seasonRating";
import "./season-rating-details.css";

const roles = { POR: "Portería", DEF: "Defensa", MED: "Medio", DEL: "Ataque" };
const number = (n: number) => n.toLocaleString("es", { maximumFractionDigits: 1 });

/** One explanation for the season GLOBAL shared by cards and player profiles. */
export function SeasonRatingDetails({ rating }: { rating: SeasonRating }) {
  return (
    <details className="season-rating-details">
      <summary>Cómo se calcula GLOBAL</summary>
      <div className="season-rating-details__body">
        <p>{rating.summary}.</p>
        <p>{rating.role ? `Perfil ${roles[rating.role]}: ${rating.roleSource === "played" ? "la línea con más minutos acreditados esta temporada" : "tu posición configurada; faltan minutos por posición para determinar la predominante"}.` : "Falta una posición acreditada o configurada para elegir los pesos."}</p>
        <p>{rating.minutes === null ? "Minutos incompletos" : `${number(rating.minutes)} minutos`} · {rating.sample} acciones con resultado conocido. Para mostrar una nota hacen falta 10 minutos, 6 acciones, dos bloques de juego y al menos el 30 % del peso del perfil.</p>
        <dl>
          {rating.blocks.filter(b => b.weight > 0).map(b => (
            <div key={b.id}>
              <dt>{b.label} <span>Peso base {b.weight} %</span></dt>
              <dd><strong>{b.score === null ? "—" : `${number(b.score)}/100`}</strong>{b.score !== null && b.partial ? " · muestra parcial" : ""}<small>{b.detail}</small></dd>
            </div>
          ))}
        </dl>
        <p>{rating.explanation}</p>
        <p>Los indicadores de cada bloque se promedian antes de aplicar su peso. El peso base de los bloques conocidos suma {rating.knownWeight} %; esto describe el perfil disponible, no el porcentaje de partido narrado. El ajuste por muestra aplica el menor valor entre minutos/150, acciones/30 y 1.</p>
        <small>Modelo {rating.version}. Los pesos y referencias son criterios del Piti, no una valoración profesional validada.</small>
      </div>
    </details>
  );
}
