// El rival en la pizarra (Siete → Plan): add their seven, pick their system, a dorsal and a note for each
// of them («presionar al 9 por su izquierda»), show or hide their red tokens («Rival»), take them off.
// And the filter of Tableros by the rival of each board's match.
import { useId, useState } from "react";
import { FORMATION_NAMES, type FormationName } from "../formations";
import { Icon } from "./icons";
import { RIVAL_LIMITS, rivalName, rivalPos, type RivalSeven } from "./rival";
import "../../../styles/pizarra-dibujo.css";

/** A short text kept on Enter or on leaving the field (Escape gives the old one back). */
function Keep({ value, label, max, numeric, onSave }: { value: string; label: string; max: number; numeric?: boolean; onSave: (v: string) => void }) {
  const [edit, setEdit] = useState<string | null>(null);
  const save = () => {
    if (edit != null && edit.trim() !== value.trim()) onSave(edit);
    setEdit(null);
  };
  return (
    <input
      type="text"
      className={numeric ? "dr-num" : "dr-note"}
      inputMode={numeric ? "numeric" : undefined}
      maxLength={max}
      value={edit ?? value}
      aria-label={label}
      onChange={(e) => setEdit(numeric ? e.target.value.replace(/\D/g, "") : e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          save();
        } else if (e.key === "Escape" && edit != null) {
          e.stopPropagation();
          setEdit(null);
        }
      }}
    />
  );
}

export interface RivalPanelProps {
  rival: RivalSeven | null | undefined;
  /** The red tokens are on the pitch. */
  on: boolean;
  ro: boolean;
  /** The rival of the board's match («MAD SKY»), if any. */
  matchRival: string | null;
  onAdd: () => void;
  onRemove: () => void;
  onSystem: (f: FormationName) => void;
  onNum: (i: number, v: string) => void;
  onNote: (i: number, v: string) => void;
  onToggle: () => void;
}

export function RivalPanel(p: RivalPanelProps) {
  const sysId = useId();
  const r = p.rival;
  return (
    <section className="dr-rival" aria-label="El rival">
      <h3>
        El rival{p.matchRival ? " · " + p.matchRival : ""}
        {r ? <small className="dr-cnt">{" · " + r.players.filter((x) => x.note).length + " notas"}</small> : null}
      </h3>
      {!r ? (
        p.ro ? (
          <p className="empty">Este tablero no tiene el siete rival.</p>
        ) : (
          <>
            <p className="dr-hint">Pon su siete enfrente (sus fichas, en rojo) y apunta qué hacer con cada uno.</p>
            <div className="row">
              <button type="button" className="b3" onClick={p.onAdd}>
                <Icon n="plus" w={15} />
                Añadir el siete rival
              </button>
            </div>
          </>
        )
      ) : (
        <>
          <div className="row dr-row">
            <button type="button" className="tg dr-rv-t" onClick={p.onToggle} aria-pressed={p.on}>
              Rival
            </button>
            <label className="dr-sys" htmlFor={sysId}>
              <span>Su sistema</span>
              <select id={sysId} value={r.formation} disabled={p.ro} onChange={(e) => p.onSystem(e.target.value as FormationName)}>
                {FORMATION_NAMES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            {!p.ro && (
              <button type="button" className="b3" onClick={p.onRemove}>
                <Icon n="x" w={15} />
                Quitar el rival
              </button>
            )}
          </div>
          <ol className="dr-rl" aria-label="Los siete del rival">
            {r.players.map((x, i) => (
              <li key={i}>
                <b className="dr-pos" aria-hidden="true">
                  {rivalPos(r, i)}
                </b>
                {p.ro ? (
                  <span className="dr-ro">
                    {rivalName(r, i)}
                    {x.note ? ": " + x.note : ""}
                  </span>
                ) : (
                  <>
                    <Keep key={"n" + i + ":" + (x.num ?? "")} value={x.num !== undefined ? String(x.num) : ""} label={"Dorsal de su " + rivalPos(r, i) + " (" + (i + 1) + " de 7)"} max={2} numeric onSave={(v) => p.onNum(i, v)} />
                    <Keep key={"t" + i + ":" + (x.note ?? "")} value={x.note ?? ""} label={"Nota para " + rivalName(r, i).toLowerCase()} max={RIVAL_LIMITS.note} onSave={(v) => p.onNote(i, v)} />
                  </>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

/** Tableros → Mis tableros, by the rival of each board's match («Todos» and one chip per rival). */
export function RivalFilter({ rivals, value, onPick }: { rivals: string[]; value: string | null; onPick: (r: string | null) => void }) {
  if (rivals.length < 1) return null;
  return (
    <div className="dr-flt" role="group" aria-label="Filtrar por rival">
      <button type="button" className="tg" onClick={() => onPick(null)} aria-pressed={!value}>
        Todos
      </button>
      {rivals.map((r) => (
        <button key={r} type="button" className="tg" onClick={() => onPick(value === r ? null : r)} aria-pressed={value === r}>
          {"vs " + r}
        </button>
      ))}
    </div>
  );
}
