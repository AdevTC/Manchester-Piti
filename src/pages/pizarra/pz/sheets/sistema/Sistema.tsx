// r14 «La pizarra» · «El sistema»: the 15 F7 systems as minis with how many of the seven stay in their place, the
// best one said in words, and «Forma libre».
import { usePz } from "../../store/context";
import { sysTiles } from "../../places/siete/sieteView";
import { systemDef } from "../../../../../lib/formations";
import "../../../../../styles/pz/siete.css";

export function SistemaSheet() {
  const P = usePz();
  const v = P.sel.ver();
  const ro = !P.sel.canEdit();
  const placed = P.sel.placed(v).length;
  const tiles = sysTiles(P, v);
  const cur = v ? tiles.find((t) => t.id === v.formation) : null;
  const best = tiles.slice().sort((a, b) => b.n - a.n)[0];
  const def = v ? systemDef(v.formation) : null;
  return (
    <div className="pz-sh pz-7 is-flow">
      <p className="pz-line">{placed && cur && best ? `Tu siete: ${cur.n}/7 en su sitio · el mejor posible: ${best.n}/7 (${best.id})` : "Cada uno conserva su sitio por orden al cambiar."}</p>
      {def && !v?.freeMode && <p className="pz-meta pz-7__about">{def.id + " · " + def.name + ": " + def.about}</p>}
      <div className="pz-7__systiles">
        {tiles.map((t) => (
          <button key={t.id} type="button" className="vd-glass vd-press pz-7__tile" aria-pressed={t.on} onClick={() => P.act.setSistema(t.id)} disabled={ro} aria-label={`${t.id} · ${t.name} · ${t.n} de 7 en su sitio`}>
            <span className="pz-mini" aria-hidden="true">
              {t.dots.map((d, i) => (
                <i key={i} className={d.in ? "is-in" : undefined} style={{ left: d.x + "%", top: d.y + "%" }} />
              ))}
            </span>
            <b>{t.id}</b>
            <small>{placed ? t.n + "/7 en su sitio" : t.name}</small>
          </button>
        ))}
      </div>
      <button type="button" className="vx-tog" aria-pressed={!!v?.freeMode} onClick={() => P.act.setFree(!v?.freeMode)} disabled={ro}>
        <span className="vx-tog__t" aria-hidden="true" />
        Forma libre: cada uno donde lo sueltes
      </button>
    </div>
  );
}
