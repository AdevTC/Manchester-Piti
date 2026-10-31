// Ajustes (TuCarta «ajustes»): the index of his sections — Tu nombre (a socio's: Tu apodo), Avisos, Apariencia,
// Cuenta and, for a captain, Capitanía — each with its live hint, and the section beside it. Every section has its
// own address (/perfil/ajustes/<section>). On a desktop the index sits at the side and /perfil/ajustes shows the
// first section; on the phone /perfil/ajustes is the index alone and a section is a screen of its own with
// «Ajustes» to come back (CSS: the container nx, .is-index / .is-sec).
import { lazy, Suspense } from "react";
import { useTheme } from "../../../../hooks/useTheme";
import { TuIcon } from "../../../../components/vidrio/tu/ui";
import { useThisDevice } from "../../bandeja/device";
import type { AjSec } from "../model";
import { ajHead, ajIndex, badgeAria, shownAj } from "./ajustesView";
import type { PlaceProps } from "./types";
import { Nombre } from "./ajustes/Nombre";
import { Apariencia } from "./ajustes/Apariencia";
import { Cuenta } from "./ajustes/Cuenta";
import { Capitania } from "./ajustes/Capitania";

const Avisos = lazy(() => import("./ajustes/Avisos"));

export function Ajustes(p: PlaceProps) {
  const { who, screen } = p;
  const d = useThisDevice();
  const { pref } = useTheme();
  const doorN = p.data.captain?.doorRequests.length ?? 0;
  const rows = ajIndex({ who, shirt: p.data.shirt.current, nickname: p.data.nickname, deviceLine: d.line, theme: pref, doorN });
  const aj = shownAj(screen.aj, who);
  const head = ajHead(aj, who.kind);
  const to = (s: AjSec | null) => p.go({ page: "perfil", sec: "ajustes", aj: s, open: null });
  return (
    <div className={`tc-ajw ${screen.aj ? "is-sec" : "is-index"}`}>
      <header className="tc-head tc-aj__ixhead">
        <div className="tc-head__t">
          <h2 className="nx-h2">Ajustes</h2>
          <p className="nx-sub">Tu nombre, lo que te llega a este móvil, cómo se ve la web y tu cuenta.</p>
        </div>
      </header>
      <header className="tc-head tc-aj__head">
        <div className="tc-head__t">
          <p className="tc-kick">Ajustes</p>
          <h2 className="nx-h2" id="tc-aj-t">
            {head.title}
          </h2>
          <p className="nx-sub">{head.sub}</p>
        </div>
      </header>
      <div className="tc-aj">
        <nav className="tc-ajnav" aria-label="Ajustes">
          {rows.map((r) => (
            <button key={r.id} type="button" className="tc-ajb" aria-current={r.id === aj ? "page" : undefined} onClick={() => to(r.id)}>
              <TuIcon name={r.icon} className="nx-ic" />
              <span>
                {r.t}
                <small>{r.hint}</small>
              </span>
              {r.badge > 0 && (
                <span className="tk-badge" aria-label={badgeAria(r.badge)}>
                  {r.badge}
                </span>
              )}
              <TuIcon name="chev-r" className="nx-ic tc-ajb__go" />
            </button>
          ))}
        </nav>
        <div className="tc-ajp" aria-labelledby="tc-aj-t" role="region">
          <button type="button" className="nx-lnk tc-ajback" onClick={() => to(null)}>
            <TuIcon name="chev-l" className="nx-ic" />
            Ajustes
          </button>
          {aj === "nombre" && <Nombre {...p} />}
          {aj === "avisos" && (
            <Suspense fallback={<p className="nx-meta">Cargando tus avisos…</p>}>
              <Avisos pending={p.pending} say={p.say} d={d} />
            </Suspense>
          )}
          {aj === "apariencia" && <Apariencia {...p} />}
          {aj === "cuenta" && <Cuenta {...p} />}
          {aj === "capitania" && <Capitania {...p} d={d} />}
        </div>
      </div>
    </div>
  );
}
