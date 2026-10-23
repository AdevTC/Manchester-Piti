// A Mi página screen's frame (TU boards tu-scr__head + tu-scr__body): its title and line, its one primary action
// at the top right and the rest in «Más» (a menu with keys).
import type { ReactNode } from "react";
import { MoreMenu, TuIcon, type MenuItem, type TuIconName } from "../../../../components/vidrio/tu/ui";

export interface Act {
  t: string;
  icon: TuIconName;
  go: () => void;
  busy?: boolean;
}

export function Screen({ title, desc, act, more = [], children }: { title: string; desc: string; act?: Act | null; more?: MenuItem[]; children: ReactNode }) {
  return (
    <>
      <header className="tu-scr__head vd-reg-2">
        <div className="tu-scr__tt">
          <h2 className="tu-h2" id="tu-scr-t">
            {title}
          </h2>
          <p>{desc}</p>
        </div>
        <div className="tu-scr__acts">
          {act && (
            <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" aria-disabled={act.busy || undefined} onClick={() => !act.busy && act.go()}>
              <TuIcon name={act.icon} />
              {act.t}
            </button>
          )}
          {more.length > 0 && <MoreMenu kind="more" items={more} label="Más acciones" right />}
        </div>
      </header>
      <div className="tu-scr__body vd-reg-3">{children}</div>
    </>
  );
}
