// «Dibujar» in the sheet, as designed: the six tools (carrera, pase, conduce, zona, lápiz, texto), the
// three colours, the text for the field (with Texto), undo and «borrar todo» (asked once more); then the
// legend of the strokes and, full, every stroke on the grass to pick or delete one by one (the way to
// do it without drawing). A read-only board shows its strokes and no tools.
import { useState } from "react";
import { PIZARRA_LIMITS } from "../../../lib/schemas";
import type { StrokeColor, StrokeKind } from "../drawings";
import { Icon, Nuevo, type IconName } from "./icons";
import { COLORS, TOOLS } from "./telestrator";
import { vars } from "./view";

const TOOL_ICON: Record<StrokeKind, IconName> = { carrera: "run", pase: "pass", conduccion: "drib", zona: "zone", lapiz: "pencil", texto: "text" };
const LEGEND: [IconName, string][] = [
  ["run", "Carrera · puntos"],
  ["pass", "Pase · línea"],
  ["drib", "Conducción · onda"],
  ["zone", "Zona · área"],
  ["pencil", "Lápiz libre"],
  ["text", "Texto"],
];

export interface DibujarPanelProps {
  ro: boolean;
  tool: StrokeKind;
  color: StrokeColor;
  text: string;
  /** Every stroke on the grass (in drawing order). */
  strokes: { id: string; label: string; sel: boolean }[];
  /** The marked stroke's label (Borrar trazo takes it), or null. */
  selLabel: string | null;
  canUndo: boolean;
  onTool: (k: StrokeKind) => void;
  onColor: (c: StrokeColor) => void;
  onText: (v: string) => void;
  onUndo: () => void;
  onClear: () => void;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
}

export function DibujarPanel(p: DibujarPanelProps) {
  const [ask, setAsk] = useState(false);
  const n = p.strokes.length;
  const sel = p.strokes.find((s) => s.sel) ?? null;
  return (
    <>
      {p.ro ? (
        <p className="soon">
          <Icon n="lock" w={16} />
          <span>Solo lectura: los trazos se ven, pero no se tocan. Duplica el tablero para dibujar.</span>
        </p>
      ) : (
        <>
          <div className="tools" role="group" aria-label="Herramienta de dibujo">
            {TOOLS.map((t) => (
              <button key={t.k} type="button" className="dt" onClick={() => p.onTool(t.k)} aria-pressed={p.tool === t.k}>
                <Icon n={TOOL_ICON[t.k]} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <div className="tools2">
            {COLORS.map((c) => (
              <button key={c.k} type="button" className="sw" style={vars({ "--c": c.hex })} onClick={() => p.onColor(c.k)} aria-pressed={p.color === c.k} aria-label={"Color " + c.label} />
            ))}
            {p.tool === "texto" ? (
              <input className="txtin" type="text" maxLength={PIZARRA_LIMITS.strokeText} value={p.text} onChange={(e) => p.onText(e.target.value)} aria-label="Texto para el campo" />
            ) : sel ? (
              <button type="button" className="b3 danger dsel" onClick={() => p.onDelete(sel.id)} aria-label={"Borrar el trazo marcado: " + sel.label}>
                <Icon n="trash" />
                Borrar trazo
              </button>
            ) : (
              <span className="sp" />
            )}
            <button type="button" className="ib" onClick={p.onUndo} disabled={!p.canUndo} aria-label="Deshacer el último trazo">
              <Icon n="undo" />
            </button>
            <button type="button" className="ib" onClick={() => setAsk(true)} disabled={!n} aria-label="Borrar todos los trazos">
              <Icon n="trash" w={18} />
            </button>
          </div>
          {ask && n > 0 && (
            <div className="cfm" role="group" aria-label="¿Borrar todos los trazos?" style={{ marginTop: 8 }}>
              <span>
                ¿Borrar los <b>{n}</b> {n === 1 ? "trazo" : "trazos"} del césped? Podrás deshacerlo.
              </span>
              <button
                type="button"
                className="b3 danger"
                onClick={() => {
                  setAsk(false);
                  p.onClear();
                }}
              >
                <Icon n="trash" />
                Borrar todo
              </button>
              <button type="button" className="b3" onClick={() => setAsk(false)}>
                Cancelar
              </button>
            </div>
          )}
        </>
      )}
      <div className="s-half">
        <h3>
          Trazos de luz <Nuevo /> · {n} en el césped
        </h3>
        <ul className="dleg">
          {LEGEND.map(([ic, t]) => (
            <li key={t}>
              <Icon n={ic} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <p style={{ marginTop: 10 }}>
          {p.ro ? "Cada trazo se enciende solo sobre el césped." : "Dibuja con el dedo sobre el césped: cada trazo se enciende solo y se guarda con el tablero. Toca un trazo para marcarlo."}
        </p>
      </div>
      <div className="s-full">
        <h3>
          En el césped · {n} de {PIZARRA_LIMITS.strokes}
        </h3>
        {n ? (
          <ul className="bl dlist">
            {p.strokes.map((s, i) => (
              <li key={s.id} className={s.sel ? "on" : ""}>
                <button type="button" className="op" onClick={() => p.onSelect(s.sel ? null : s.id)} aria-pressed={s.sel} disabled={p.ro}>
                  <b>{s.label}</b>
                  <small>{"Trazo " + (i + 1)}</small>
                </button>
                {!p.ro && (
                  <button type="button" className="ib" onClick={() => p.onDelete(s.id)} aria-label={"Borrar el trazo " + (i + 1) + ": " + s.label}>
                    <Icon n="trash" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">{p.ro ? "Este tablero no tiene trazos." : "Aún no hay trazos: elige una herramienta y dibuja sobre el césped."}</p>
        )}
      </div>
    </>
  );
}
