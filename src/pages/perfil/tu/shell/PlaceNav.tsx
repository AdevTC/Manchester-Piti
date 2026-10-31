// The bar that hangs from the stage (TuCarta tc-nav): his places, labelled, each with its live hint («2 cosas te
// tocan», «1 jugado · media 4,7», «Lateral derecho», «Bronce · 3 de 14»), a divider and the gear «Ajustes» (a
// captain's badge when someone knocks). Sticky on the phone, four equal buttons (the hints hide), never a strip
// cut sideways. aria-current="page" on the place shown.
import { TuIcon, type TuIconName } from "../../../../components/vidrio/tu/ui";
import { secLabel, type Sec } from "../model";

export interface PlaceTab {
  id: Exclude<Sec, "ajustes">;
  hint: string;
  /** A number on the tab (Tú's pending, when he is elsewhere); 0 for none. */
  badge: number;
}

const ICON: Record<Exclude<Sec, "ajustes">, TuIconName> = { tu: "user", partidos: "ball", juego: "flag", vitrina: "trophy" };

export interface PlaceNavProps {
  tabs: PlaceTab[];
  current: Sec;
  onGo: (s: Sec) => void;
  /** The gear's badge (a captain: people at the door); 0 for none. */
  gearBadge: number;
}

export function PlaceNav({ tabs, current, onGo, gearBadge }: PlaceNavProps) {
  return (
    <nav className="vd-glass tc-nav" aria-label="Tu página">
      <div className="tc-nav__tabs">
        {tabs.map((t) => (
          <button key={t.id} type="button" className="tc-tab" aria-current={t.id === current ? "page" : undefined} onClick={() => onGo(t.id)}>
            <TuIcon name={ICON[t.id]} className="nx-ic" />
            <span className="tc-tab__t">
              <b>{secLabel(t.id)}</b>
              <small>{t.hint}</small>
            </span>
            {t.badge > 0 && (
              <span className="tk-badge" aria-label={`${t.badge} por hacer`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <span className="tc-nav__sep" aria-hidden="true" />
      <button type="button" className="tc-gear" aria-current={current === "ajustes" ? "page" : undefined} onClick={() => onGo("ajustes")}>
        <TuIcon name="gear" className="nx-ic" />
        Ajustes
        {gearBadge > 0 && (
          <span className="tk-badge" aria-label={`${gearBadge} en la puerta`}>
            {gearBadge}
          </span>
        )}
      </button>
    </nav>
  );
}
