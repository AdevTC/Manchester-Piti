import type { MatchNote, SeasonRating } from "../lib/seasonRating";
import { LINE_NAMES } from "../lib/positions";
import { FULL_MATCH_MINUTES } from "../lib/rating/constants";
import "./season-rating-details.css";

const number = (n: number, digits = 1) => n.toLocaleString("es", { minimumFractionDigits: digits, maximumFractionDigits: digits });
// (in goals: two decimals, three for the small ones so a +0,004 pass never reads «+0,00»)
const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + number(Math.abs(n), Math.abs(n) > 0 && Math.abs(n) < 0.01 ? 3 : 2);
const day = (ms: number) => (Number.isFinite(ms) ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short" }).format(ms) : "");
/** How much a match counts in GLOBAL, and why not entero. */
function counts(n: MatchNote): string {
  const why = [n.minutes < FULL_MATCH_MINUTES ? `menos de ${FULL_MATCH_MINUTES}′` : "", n.narrated ? "" : "sin narrar"].filter(Boolean).join(" y ");
  return why ? `${why.charAt(0).toUpperCase()}${why.slice(1)}: cuenta un ${Math.round(n.weight * 100)} %` : "Cuenta entero";
}

/** One explanation for the season GLOBAL shared by cards and player profiles: his notas, what they came from
 *  and the method. */
export function SeasonRatingDetails({ rating }: { rating: SeasonRating }) {
  const notes = [...rating.notes].reverse();
  return (
    <details className="season-rating-details">
      <summary>Cómo se calcula GLOBAL</summary>
      <div className="season-rating-details__body">
        <p>{rating.summary}.</p>
        <p>Cada nota te compara con los que jugaron tu puesto{rating.role && rating.roleSource === "played" ? ` (sobre todo, ${LINE_NAMES[rating.role].plural.toLowerCase()})` : ""}: un lateral con los laterales, un central con los centrales; si el acta no dice dónde jugaste, con todo el equipo.</p>
        {notes.length ? (
          <dl aria-label="Tus notas por partido">
            {notes.map((n) => (
              <div key={n.matchId}>
                <dt>
                  {n.rival} <span>{[day(n.date), `${Math.round(n.minutes)}′`].filter(Boolean).join(" · ")}</span>
                </dt>
                <dd>
                  <strong>{number(n.nota)}</strong>
                  <small>{counts(n)}</small>
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Aún sin nota: hace falta un partido con al menos 10 minutos tuyos en el acta.</p>
        )}
        {rating.groups.length > 0 && (
          <dl aria-label="De dónde sale">
            {rating.groups.map((g) => (
              <div key={g.id}>
                <dt>
                  {g.label} <span>{signed(g.value)} goles</span>
                </dt>
                <dd>
                  <small>{[...g.items].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).map((it) => `${it.label}${it.n > 1 ? ` ×${it.n}` : ""} ${signed(it.value)}`).join(" · ")}</small>
                </dd>
              </div>
            ))}
          </dl>
        )}
        <p>{rating.explanation}</p>
        <small>Modelo {rating.version}. Los valores son criterios del Piti, no una valoración profesional validada.</small>
      </div>
    </details>
  );
}
