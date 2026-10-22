// The changes of a match by player (F7's rolling substitutions): a compact line under el siete — «21 cambios ·
// Ver los cambios» — that grows in place (the kit's useGrow / SeeAll / GrowWindow) into the list: each player who
// went in or out with his minutes and his stints («0′–10′, 18′–35′»), then the ones who played throughout.
// The rows are derived/vidrio/rotation's.
import type { ReactNode } from "react";
import { GrowWindow, SeeAll, type Grow } from "../vidrio";
import { changesWord, minutesText, type Rotation } from "../../lib/derived/vidrio/rotation";

/** «21 cambios» and the button that grows the list. */
export function CambiosMore({ rotation, grow, controls }: { rotation: Rotation; grow: Grow; controls?: string }) {
  return <SeeAll summary={<b>{changesWord(rotation.changes)}</b>} count={rotation.changes} label="Ver los cambios" onOpen={grow.grow} controls={controls} />;
}

/** The list itself: who changed, by player, then who played throughout. */
export function CambiosList({ rotation }: { rotation: Rotation }) {
  const changed = rotation.rows.filter((r) => r.changed);
  const whole = rotation.rows.filter((r) => !r.changed);
  return (
    <>
      <ol className="vd-cambios">
        {changed.map((r) => (
          <li key={r.id} className="vd-cambio">
            <b>{r.name}</b>
            <span className="vd-cambio__min">{minutesText(r.minutes)}</span>
            <span className="vd-cambio__stints" aria-hidden="true">
              {r.text}
            </span>
            <span className="vd-vh">{r.label}</span>
          </li>
        ))}
      </ol>
      {whole.length > 0 && (
        <p className="vd-cambios__whole">
          <b>Todo el partido:</b> {whole.map((r) => r.name).join(", ")}.
        </p>
      )}
    </>
  );
}

export interface CambiosGrowProps {
  rotation: Rotation;
  grow: Grow;
  /** The line under the title. */
  sub?: ReactNode;
  className?: string;
  /** Fixed to the viewport (pages without a stage of their own to grow in). */
  portal?: boolean;
  id?: string;
}

/** The grown window: «Los cambios», by player. */
export function CambiosGrow({ rotation, grow, sub, className, portal, id }: CambiosGrowProps) {
  return (
    <GrowWindow open={grow.open} title="Los cambios" sub={sub ?? `${changesWord(rotation.changes)}. Los minutos de cada uno en el campo.`} onClose={grow.close} name={grow.windowProps.name} className={className} portal={portal} id={id}>
      <CambiosList rotation={rotation} />
    </GrowWindow>
  );
}
