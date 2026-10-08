// /profile's menu: a sticky ARIA tablist (roving tabindex, ←/→/Home/End, the ← → buttons on desktop,
// Capitanía in gold with the pending door requests) and one tabpanel that slides in from the side you
// moved to, with «0N / 0M». As designed (pf-g.mjs menu).
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { counter, tabForKey, type TabDef, type TabId } from "./tabs";

export function Menu({ tabs, tab, dir, badge, onTab, children }: { tabs: TabDef[]; tab: TabId; dir: "l" | "r" | null; badge: number; onTab: (id: TabId) => void; children: ReactNode }) {
  const ids = tabs.map((t) => t.id);
  const i = Math.max(0, ids.indexOf(tab));
  const cur = tabs[i];
  const tb = useRef<HTMLDivElement>(null);
  // The selected tab stays in view in the scrolling bar.
  useEffect(() => {
    const el = tb.current;
    if (!el) return;
    const b = el.querySelector<HTMLElement>("[aria-selected=true]");
    if (b && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, b.offsetLeft - (el.clientWidth - b.offsetWidth) / 2);
  }, [tab]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = tabForKey(e.key, tab, ids);
    if (!n) return;
    e.preventDefault();
    onTab(n);
    // roving tabindex: the focus goes with the selection
    document.getElementById("pe-tab-" + n)?.focus();
  };
  return (
    <section className="menu" id="pe-menu" aria-label="Menú de tu perfil">
      <div className="tb-w">
        <button type="button" className="kc" onClick={() => onTab(ids[(i - 1 + ids.length) % ids.length])} aria-label="Pestaña anterior" title="Pestaña anterior (←)">
          ←
        </button>
        <div className="tb" role="tablist" aria-label="Secciones de tu perfil" onKeyDown={onKey} ref={tb}>
          {tabs.map((t, k) => {
            const on = t.id === tab;
            return (
              <button
                type="button"
                role="tab"
                key={t.id}
                id={"pe-tab-" + t.id}
                className={"tbb" + (t.id === "cap" ? " gold" : "")}
                aria-selected={on}
                aria-controls="pe-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => onTab(t.id)}
              >
                <small>{"0" + (k + 1)}</small>
                {t.label}
                {t.id === "cap" && badge > 0 && (
                  <>
                    <i className="bd">{badge}</i>
                    <span className="sr"> pendientes</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        <button type="button" className="kc" onClick={() => onTab(ids[(i + 1) % ids.length])} aria-label="Pestaña siguiente" title="Pestaña siguiente (→)">
          →
        </button>
      </div>
      <p className="tb-hint" aria-hidden="true">
        Con el teclado: ← → cambian de pestaña
      </p>
      <div className={"pn" + (dir === "l" ? " from-l" : dir === "r" ? " from-r" : "")} id="pe-panel" role="tabpanel" aria-labelledby={"pe-tab-" + tab} tabIndex={0} key={tab}>
        <div className="ph">
          <h2>{cur.label}</h2>
          <span className="ct">{counter(i, tabs.length)}</span>
          <p>{cur.desc}</p>
        </div>
        {children}
      </div>
    </section>
  );
}
