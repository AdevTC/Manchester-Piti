// «De qué está hecho» (TuCarta sheet `attr`): a number of the card (GOL ASI MIN PJ MVP FOR), opened by its button
// on the stage (the shell's `card.attr`). The matches that built it, from his jornada rows; how it moves his
// rating; the next milestone it feeds. The rewards mark the card, never the rating.
import type { AttrKey } from "../../../../../lib/derived/card";
import type { JornadaRow, Rewards } from "../../me";
import { attrSheetView } from "../tuView";
import { TuSheet } from "./TuSheet";

export function AttrSheet({ k, rows, text, rewards, onClose }: { k: AttrKey; rows: readonly JornadaRow[]; text: string; rewards: Rewards; onClose: () => void }) {
  const v = attrSheetView(k, rows, text, rewards);
  return (
    <TuSheet id="tc-sh-attr" kick={v.k} title={v.title} onClose={onClose}>
      <div className="tc-big">
        <b>{v.v}</b>
        <p className="nx-meta">{v.what}</p>
      </div>
      <div>
        <p className="tk-card__k">Los partidos que lo forman</p>
        {v.rows.length ? (
          <ul className="tc-mrows">
            {v.rows.map((r) => (
              <li key={r.key} className="tc-mrow">
                <b>{r.j}</b>
                <span className="tc-bar" role="img" aria-label={r.aria}>
                  <i style={{ width: `${r.pct}%` }} />
                </span>
                <span>{r.v}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="nx-meta">{v.empty}</p>
        )}
      </div>
      <div className="tk-panel">
        <p className="tk-card__k">Cómo mueve tu valoración</p>
        <p className="tc-sh__p">{v.move}</p>
      </div>
      {v.next && <p className="nx-meta">{v.next}</p>}
      <p className="nx-meta">{v.rule}</p>
    </TuSheet>
  );
}
