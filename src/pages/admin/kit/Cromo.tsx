// The cromo that heads a player's drawer (`.cromo`): the form rating (the pizarra's formula — the same
// number as the profile card and the board: buildSquad / formRating over the season, read from
// useAdmin().squad), the position, his shirt, his name and GOL / ASI / PJ / MVP. `.cromo.new` is the
// empty shirt of a new player, stamped as the name and dorsal are typed.
import type { Cromo as CromoData } from "../../pizarra/v2/model";
import { ShirtBack } from "./ShirtBack";

export interface CromoViewProps {
  /** The player's cromo from the season squad (`useAdmin().squad.byId.get(id)`); none = not in the season yet. */
  cromo?: CromoData;
  /** What the drawer is editing (wins over the cromo: the shirt shows the typed name / dorsal). */
  name: string;
  num: string | number | null;
  /** POR / DEF / MED / DEL. */
  pos: string;
  /** Matches the team has finished this season: with none, the rating reads «—». */
  games: number;
}
/** `.cromo`: rating + position, the shirt, the name and the season line. */
export function CromoCard({ cromo, name, num, pos, games }: CromoViewProps) {
  const rating = cromo && games > 0 ? String(cromo.rt) : "—";
  const s = cromo?.stats;
  return (
    <div className="cromo" role="group" aria-label={`Cromo de ${name}: media ${rating}, ${pos}`}>
      <span>
        <span className="rt">{rating}</span>
        <br />
        <span className="ps">{pos}</span>
      </span>
      <ShirtBack num={num} name={name} size={96} big />
      <span className="nm">{name}</span>
      <span className="st">
        <span>
          <b>{s?.goals ?? 0}</b>GOL
        </span>
        <span>
          <b>{s?.assists ?? 0}</b>ASI
        </span>
        <span>
          <b>{s?.played ?? 0}</b>PJ
        </span>
        <span>
          <b>{s?.mvps ?? 0}</b>MVP
        </span>
      </span>
    </div>
  );
}

/** `.cromo.new`: «Percha nueva» — the shirt is stamped as the name («NOMBRE» until then) and the dorsal
 *  («?»; dashed until there is one) are typed. */
export function CromoNew({ name, num }: { name: string; num: string }) {
  const shown = name.trim() ? name.toLocaleUpperCase("es") : "NOMBRE";
  return (
    <div className="cromo new">
      <span>
        <span className="ps">Percha nueva</span>
        <br />
        <span className="hint">La camiseta se estampa al escribir</span>
      </span>
      <ShirtBack num={num.trim() || "?"} name={shown} size={96} big state={num.trim() ? "" : "empty"} />
      <span className="nm">{shown}</span>
    </div>
  );
}
