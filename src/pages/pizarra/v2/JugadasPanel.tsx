// «Jugadas» in the sheet, as designed: the replay's transport (paso anterior, play/pause, the timeline
// with a tick per paso, paso siguiente) and its toggles (En 3D, 0,5×, Calco, Estelas); then the library
// (estrategia and yours), the paso's caption, Rivales / Balón and «+ Paso»; and, full, a new jugada of
// your own and the editor: name, duplicate, delete, the pasos (go, reorder, copy, remove), the paso's
// title and note, the rivals and whoever of the seven is missing.
import { useEffect, useId, useRef, useState } from "react";
import { PIZARRA_LIMITS } from "../../../lib/schemas";
import { Icon, Nuevo } from "./icons";
import { mag } from "./mag";
import { vars } from "./view";
import type { ReplayHud } from "./jugadas";

/** A text that is written as you go and kept on Enter, on leaving the field or after a short pause;
 *  `check` says what is wrong with it (then it is not kept). */
function DraftField({ value, label, max, area, check, onSave }: { value: string; label: string; max: number; area?: boolean; check?: (v: string) => string | null; onSave: (v: string) => void }) {
  const id = useId();
  const [edit, setEdit] = useState<string | null>(null);
  const shown = edit ?? value;
  const err = edit != null && check ? check(edit) : null;
  const save = () => {
    if (edit == null || err) return;
    if (edit.trim() !== value.trim()) onSave(edit);
  };
  const latest = useRef(save);
  useEffect(() => {
    latest.current = save;
  });
  useEffect(() => {
    if (edit == null || err) return;
    const t = window.setTimeout(() => latest.current(), 900);
    return () => window.clearTimeout(t);
  }, [edit, err]);
  const common = {
    id,
    value: shown,
    maxLength: max,
    "aria-invalid": !!err,
    "aria-describedby": err ? id + "-e" : undefined,
    onBlur: () => {
      save();
      if (!err) setEdit(null);
    },
  };
  return (
    <label className="jf-f">
      <span>{label}</span>
      {area ? (
        <textarea {...common} rows={2} onChange={(e) => setEdit(e.target.value)} />
      ) : (
        <input
          {...common}
          type="text"
          onChange={(e) => setEdit(e.target.value)}
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
      )}
      {err && (
        <small className="nm-err" id={id + "-e"} role="alert">
          {err}
        </small>
      )}
    </label>
  );
}

export interface JugadaEditorView {
  id: string;
  name: string;
  /** Stored on the board (else built-in: the first change keeps a copy of yours). */
  own: boolean;
  pasos: { title: string; cur: boolean }[];
  cur: number;
  title: string;
  note: string;
  rivals: number;
  /** A rival is marked on the pitch (Quitar takes that one). */
  rivalMarked: boolean;
  /** Of the seven on the board, how many the jugada leaves out (and can still take). */
  missing: number;
  /** In the jugada but no longer among the seven on the board. */
  gone: number;
  /** What is wrong with the jugada (validatePlay), if anything. */
  errors: string[];
}

export interface JugadasPanelProps {
  hud: ReplayHud;
  frame: number;
  n: number;
  playing: boolean;
  v3: boolean;
  slow: boolean;
  onion: boolean;
  trails: boolean;
  riv: boolean;
  ball: boolean;
  lib: { id: string; short: string; aria: string; on: boolean }[];
  /** The board can be edited (else the jugada is only watched). */
  canEdit: boolean;
  /** Why the 3D stadium is not there (shown while «En 3D» is on), or null. */
  note3d: string | null;
  editor: JugadaEditorView;
  onToggle: () => void;
  onStep: (d: 1 | -1) => void;
  onSeek: (i: number) => void;
  on3d: () => void;
  onSlow: () => void;
  onOnion: () => void;
  onTrails: () => void;
  onRiv: () => void;
  onBall: () => void;
  onPick: (id: string) => void;
  onAddPaso: () => void;
  onNew: () => void;
  onCharla: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPaso: (i: number) => void;
  onMovePaso: (i: number, d: 1 | -1) => void;
  onCopyPaso: (i: number) => void;
  onDelPaso: (i: number) => void;
  onTitle: (v: string) => void;
  onNote: (v: string) => void;
  onAddRival: () => void;
  onDelRival: () => void;
  onAddMissing: () => void;
  onDropGone: () => void;
}

const L = PIZARRA_LIMITS;
const nameCheck = (v: string) => (v.trim().length < 1 || v.trim().length > L.playName ? "El nombre lleva entre 1 y " + L.playName + " caracteres." : null);

export function JugadasPanel(p: JugadasPanelProps) {
  const { hud, editor: ed } = p;
  const [ask, setAsk] = useState<string | null>(null);
  const full = ed.pasos.length >= L.framesMax;
  const few = ed.pasos.length <= L.framesMin;
  return (
    <>
      <div className="tp" role="group" aria-label="Repetición de la jugada">
        <button type="button" className="ib" onClick={() => p.onStep(-1)} aria-label="Paso anterior">
          <Icon n="prev" />
        </button>
        <button type="button" className="ib pl mag" {...mag} onClick={p.onToggle} aria-label={p.playing ? "Pausar la repetición" : "Reproducir la repetición"}>
          {p.playing ? <Icon n="pause" /> : <Icon n="play" />}
        </button>
        <div className="tl">
          <div className="tl-tr" aria-hidden="true">
            <i style={vars({ "--p": hud.pct })} />
          </div>
          <ol aria-hidden="true">
            {hud.ticks.map((t) => (
              <li key={t.n} className={t.cls} style={vars({ "--l": t.l })}>
                {t.n}
              </li>
            ))}
          </ol>
          <input type="range" min={0} max={Math.max(0, p.n - 1)} step={1} value={p.frame} onChange={(e) => p.onSeek(Number(e.target.value))} aria-label="Paso de la jugada" aria-valuetext={hud.lab} />
        </div>
        <button type="button" className="ib" onClick={() => p.onStep(1)} aria-label="Paso siguiente">
          <Icon n="next" />
        </button>
        <span className="tp-n">{hud.lab}</span>
      </div>
      <div className="tgr">
        <button type="button" className="pill k3" onClick={p.on3d} aria-pressed={p.v3}>
          <Icon n="cube" w={15} />
          En 3D
        </button>
        <button type="button" className="pill" onClick={p.onSlow} aria-pressed={p.slow}>
          <Icon n="slow" w={15} />
          0,5×
        </button>
        <button type="button" className="pill" onClick={p.onOnion} aria-pressed={p.onion}>
          <Icon n="layers" w={15} />
          Calco
        </button>
        <button type="button" className="pill" onClick={p.onTrails} aria-pressed={p.trails}>
          <Icon n="trail" w={15} />
          Estelas
        </button>
      </div>
      <div className="s-half">
        <h3>
          Biblioteca · estrategia y propias <Nuevo />
        </h3>
        <div className="jlib" role="group" aria-label="Biblioteca de jugadas">
          {p.lib.map((j) => (
            <button key={j.id} type="button" className="jl" onClick={() => p.onPick(j.id)} aria-pressed={j.on} aria-label={j.aria}>
              {j.short}
            </button>
          ))}
        </div>
        <div className="cap">
          <b>{hud.stepT}</b>
          {hud.stepD && <span>{hud.stepD}</span>}
        </div>
        <div className="tgr">
          <button type="button" className="tg" onClick={p.onRiv} aria-pressed={p.riv}>
            Rivales
          </button>
          <button type="button" className="tg" onClick={p.onBall} aria-pressed={p.ball}>
            Balón
          </button>
          {p.canEdit && (
            <button type="button" className="b3" onClick={p.onAddPaso}>
              <Icon n="plus" w={15} />
              Paso
            </button>
          )}
        </div>
      </div>
      <div className="s-full">
        <div className="row" style={{ marginTop: 10 }}>
          {p.canEdit && (
            <button type="button" className="b3" onClick={p.onNew}>
              <Icon n="plus" w={15} />
              Nueva jugada propia
            </button>
          )}
          <button type="button" className="b3" onClick={p.onCharla}>
            <Icon n="whistle" w={16} />
            Verla en la charla
          </button>
        </div>
        {p.note3d && (
          <p className="fb3">
            <Icon n="cube" w={16} />
            <span>{p.note3d}</span>
          </p>
        )}
        <p className="soon">
          <Icon n="film" w={16} />
          <span>
            {p.canEdit ? "Arrastra un cromo, el balón o un rival para retocar su sitio en este paso." : "Solo lectura: la jugada se ve, pero no se retoca."} Compartir la jugada como clip:{" "}
            <Nuevo>próximamente</Nuevo>
          </span>
        </p>
        {p.canEdit && (
          <div className="jed">
            <h3>{ed.own ? "Tu jugada" : "De la biblioteca · al retocarla se guarda una copia tuya"}</h3>
            {ed.own ? (
              <div className="bd-cur">
                <DraftField key={ed.id} value={ed.name} label="Nombre de la jugada" max={L.playName + 10} check={nameCheck} onSave={p.onRename} />
                <div className="row">
                  <button type="button" className="b3" onClick={p.onDuplicate}>
                    <Icon n="copy" />
                    Duplicar
                  </button>
                  <button type="button" className="b3" onClick={() => setAsk(ed.id)}>
                    <Icon n="trash" />
                    Borrar
                  </button>
                </div>
                {ask === ed.id && (
                  <div className="cfm" role="group" aria-label={"¿Borrar " + ed.name + "?"}>
                    <span>
                      ¿Borrar <b>{ed.name}</b>? Se quita de este tablero con todos sus pasos.
                    </span>
                    <button
                      type="button"
                      className="b3 danger"
                      onClick={() => {
                        setAsk(null);
                        p.onDelete();
                      }}
                    >
                      <Icon n="trash" />
                      Borrar
                    </button>
                    <button type="button" className="b3" onClick={() => setAsk(null)}>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="row">
                <button type="button" className="b3" onClick={p.onDuplicate}>
                  <Icon n="copy" />
                  Duplicar como tuya
                </button>
              </div>
            )}
            <h3>
              Pasos · {ed.pasos.length} de {L.framesMax}
            </h3>
            <ol className="bl pasos" aria-label="Pasos de la jugada">
              {ed.pasos.map((ps, i) => (
                <li key={i} className={ps.cur ? "on" : ""}>
                  <button type="button" className="op" onClick={() => p.onPaso(i)} aria-current={ps.cur ? "step" : undefined}>
                    <b>{i + 1 + " · " + ps.title}</b>
                  </button>
                  <button type="button" className="ib" onClick={() => p.onMovePaso(i, -1)} disabled={i === 0} aria-label={"Subir el paso " + (i + 1)}>
                    <Icon n="chevU" w={16} />
                  </button>
                  <button type="button" className="ib" onClick={() => p.onMovePaso(i, 1)} disabled={i === ed.pasos.length - 1} aria-label={"Bajar el paso " + (i + 1)}>
                    <Icon n="chevD" w={16} />
                  </button>
                  <button type="button" className="ib" onClick={() => p.onCopyPaso(i)} disabled={full} aria-label={"Duplicar el paso " + (i + 1)}>
                    <Icon n="copy" />
                  </button>
                  <button type="button" className="ib" onClick={() => p.onDelPaso(i)} disabled={few} aria-label={"Quitar el paso " + (i + 1)}>
                    <Icon n="trash" />
                  </button>
                </li>
              ))}
            </ol>
            {(full || few) && <p className="empty">{"Una jugada tiene entre " + L.framesMin + " y " + L.framesMax + " pasos."}</p>}
            <div className="jpaso">
              {/* (keyed by the paso only: a built-in jugada made yours on the first letter keeps the field) */}
              <DraftField key={"t" + ed.cur} value={ed.title} label={"Título del paso " + (ed.cur + 1)} max={L.frameTitle} onSave={p.onTitle} />
              <DraftField key={"n" + ed.cur} value={ed.note} label="Nota del paso" max={L.frameNote} area onSave={p.onNote} />
            </div>
            {(ed.missing > 0 || ed.gone > 0) && (
              <>
                <h3>Los siete del tablero</h3>
                <div className="row">
                  {ed.missing > 0 && (
                    <button type="button" className="b3" onClick={p.onAddMissing}>
                      <Icon n="plus" w={15} />
                      {ed.missing === 1 ? "Añadir al que falta" : "Añadir a los " + ed.missing + " que faltan"}
                    </button>
                  )}
                  {ed.gone > 0 && (
                    <button type="button" className="b3" onClick={p.onDropGone}>
                      <Icon n="x" w={15} />
                      {ed.gone === 1 ? "Quitar al que ya no está" : "Quitar a los " + ed.gone + " que ya no están"}
                    </button>
                  )}
                </div>
              </>
            )}
            <h3>
              Rivales · {ed.rivals} de {L.rivals}
            </h3>
            <div className="row">
              <button type="button" className="b3" onClick={p.onAddRival} disabled={ed.rivals >= L.rivals}>
                <Icon n="plus" w={15} />
                Rival
              </button>
              <button type="button" className="b3" onClick={p.onDelRival} disabled={!ed.rivals}>
                <Icon n="x" w={15} />
                {ed.rivalMarked ? "Quitar el rival marcado" : "Quitar un rival"}
              </button>
            </div>
            {!ed.rivalMarked && ed.rivals > 0 && <p className="empty">Toca un rival en el campo para marcarlo.</p>}
            {ed.errors.length > 0 && (
              <p className="why" role="alert">
                {ed.errors.join(" ")}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
