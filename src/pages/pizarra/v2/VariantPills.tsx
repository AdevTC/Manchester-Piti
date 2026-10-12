// The versions of the seven over the pitch: «Titular · 2ª parte · Plan B» as pills (the one on screen
// pressed), «+» on the ones still to make (editable boards), and for the variant on screen «Renombrar» and
// «Quitar». The board says what each one did through its one announcer.
import { useState } from "react";
import type { VariantId } from "../formations";
import { VARIANT_LIMITS } from "../../../lib/schemas";
import type { VariantKey, VariantPill } from "./variants";

export interface VariantPillsProps {
  pills: VariantPill[];
  active: VariantKey;
  activeName: string;
  canEdit: boolean;
  onPick: (k: VariantKey) => void;
  onAdd: (id: VariantId) => void;
  /** Returns why the name can't be used (null = renamed). */
  onRename: (id: VariantId, name: string) => string | null;
  onRemove: (id: VariantId) => void;
}

export function VariantPills(p: VariantPillsProps) {
  const [edit, setEdit] = useState<{ id: VariantId; v: string; err: string | null } | null>(null);
  // Nothing to switch between on a board you can only look at and that has no variants.
  if (p.pills.length < 2) return null;
  const variant = p.active !== "titular" ? p.active : null;
  const editing = edit && edit.id === variant ? edit : null;
  const save = () => {
    if (!editing) return;
    const err = p.onRename(editing.id, editing.v);
    if (err) setEdit({ ...editing, err });
    else setEdit(null);
  };
  return (
    <div className="vpills" role="group" aria-label="Versiones del siete">
      <div className="vp-row">
        {p.pills.map((x) => (
          <button
            key={x.key}
            type="button"
            className={"vp" + (x.add ? " add" : "") + (x.on ? " on" : "")}
            aria-pressed={x.add ? undefined : x.on}
            aria-label={x.aria}
            onClick={() => (x.add && x.key !== "titular" ? p.onAdd(x.key) : p.onPick(x.key))}
          >
            {x.add && <i aria-hidden="true">+</i>}
            {x.label}
          </button>
        ))}
      </div>
      {variant && p.canEdit && !editing && (
        <div className="vp-acts">
          <button type="button" className="vp-a" onClick={() => setEdit({ id: variant, v: p.activeName, err: null })} aria-label={"Renombrar «" + p.activeName + "»"}>
            Renombrar
          </button>
          <button type="button" className="vp-a danger" onClick={() => p.onRemove(variant)} aria-label={"Quitar la versión «" + p.activeName + "»"}>
            Quitar
          </button>
        </div>
      )}
      {editing && (
        <div className="vp-ed">
          <label>
            <span className="sr">Nombre de la versión</span>
            <input
              type="text"
              value={editing.v}
              maxLength={VARIANT_LIMITS.name}
              autoFocus
              aria-invalid={!!editing.err}
              aria-describedby={editing.err ? "vp-err" : undefined}
              onChange={(e) => setEdit({ ...editing, v: e.target.value, err: null })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setEdit(null);
                }
              }}
            />
          </label>
          <button type="button" className="vp-a gold" onClick={save}>
            Guardar
          </button>
          <button type="button" className="vp-a" onClick={() => setEdit(null)}>
            Cancelar
          </button>
          {editing.err && (
            <small id="vp-err" className="nm-err" role="alert">
              {editing.err}
            </small>
          )}
        </div>
      )}
    </div>
  );
}
