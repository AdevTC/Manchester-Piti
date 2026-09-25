import type { CSSProperties } from "react";
import { Icon } from "../../components/celeste/icons";
import { formatHeight, type SquadRow } from "../../lib/squad";

interface Props {
  rows: SquadRow[];
  selId?: string;
  compareIds: [string, string];
  withStats: boolean;
  onOpen: (id: string) => void;
  onCompare: (id: string) => void;
}

/** Everyone at a glance: one shirt-back card per player, with its ficha and the comparison one tap away. */
export function SquadCards({ rows, selId, compareIds, withStats, onOpen, onCompare }: Props) {
  return (
    <ul className="sq-cards">
      {rows.map((r, i) => {
        const inDuel = compareIds.includes(r.id);
        return (
          <li key={r.id} className={`sq-card${r.id === selId ? " on" : ""}`} style={{ "--i": i } as CSSProperties}>
            <div className="top" aria-hidden="true">
              <span className="nm">{r.name}</span>
              <span className="n">{r.num}</span>
              {r.birthday && r.birthday.days <= 60 && (
                <span className="bd">
                  <Icon name="cake" size={12} stroke={2} />
                  {r.birthday.days === 0 ? "¡Hoy!" : `${r.birthday.days} d`}
                </span>
              )}
            </div>
            <div className="body">
              <div>
                <h3>{r.name}</h3>
                {r.full && <p>{r.full}</p>}
              </div>
              <dl>
                <div>
                  <dt>Edad</dt>
                  <dd className={r.age == null ? "nd" : undefined}>{r.age ?? "—"}</dd>
                </div>
                <div>
                  <dt>Altura</dt>
                  <dd className={r.height ? undefined : "nd"}>{formatHeight(r.height)}</dd>
                </div>
                <div>
                  <dt>{withStats ? "Goles" : "PJ"}</dt>
                  <dd className={withStats ? undefined : "nd"}>{withStats ? r.stats.goals : "—"}</dd>
                </div>
              </dl>
            </div>
            <div className="foot">
              <button type="button" onClick={() => onOpen(r.id)} aria-label={`Ver la ficha de ${r.name}`}>
                Ver ficha
              </button>
              <button type="button" onClick={() => onCompare(r.id)} aria-pressed={inDuel} aria-label={`Comparar a ${r.name}`}>
                <Icon name={inDuel ? "check" : "swap"} size={14} stroke={2.2} />
                {inDuel ? "En duelo" : "Comparar"}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
