import React from "react";
import { Move, RotateCcw, Wand2, Undo2, Redo2, Settings2, Maximize2 } from "lucide-react";
import { FORMATION_NAMES, type FormationName } from "./formations";
import { TACTICS, type TacticKey, type Tactics } from "./tactics";

interface PizarraControlsProps {
  formation: FormationName;
  onFormation: (f: FormationName) => void;
  tactics: Tactics;
  onTactic: (key: TacticKey, value: string) => void;
  freeMode: boolean;
  onToggleFree: () => void;
  onReset: () => void;
  onAuto: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenSettings: () => void;
  onPresent: () => void;
  /** When true, the board is being viewed (official / someone else's): the
   * editing controls are disabled (settings + presentation stay available). */
  readOnly?: boolean;
}

// The TV-graphic control bar: system dropdown + one dropdown per tactical
// instruction, plus board actions. All native <select>/<button> (keyboard
// operable, gold focus); styled flat with gap-gridlines.
export const PizarraControls: React.FC<PizarraControlsProps> = ({
  formation,
  onFormation,
  tactics,
  onTactic,
  freeMode,
  onToggleFree,
  onReset,
  onAuto,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpenSettings,
  onPresent,
  readOnly = false,
}) => {
  return (
    <div className="pz-controls" role="group" aria-label="Sistema y táctica">
      <div className="pz-ctrl">
        <label className="pz-ctrl-label" htmlFor="pz-system">Sistema</label>
        <select
          id="pz-system"
          className="pz-select pz-select--system"
          value={formation}
          onChange={(e) => onFormation(e.target.value as FormationName)}
          disabled={readOnly}
        >
          {FORMATION_NAMES.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {TACTICS.map((t) => (
        <div className="pz-ctrl" key={t.key}>
          <label className="pz-ctrl-label" htmlFor={`pz-t-${t.key}`}>{t.label}</label>
          <select
            id={`pz-t-${t.key}`}
            className="pz-select"
            value={tactics[t.key]}
            onChange={(e) => onTactic(t.key, e.target.value)}
            disabled={readOnly}
          >
            {t.options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      ))}

      <div className="pz-actions">
        <button type="button" className="pz-action" aria-pressed={freeMode} onClick={onToggleFree} title="Modo libre" disabled={readOnly}>
          <Move size={14} aria-hidden="true" /> Libre
        </button>
        <button type="button" className="pz-action" onClick={onAuto} title="Auto-colocar por posición" disabled={readOnly}>
          <Wand2 size={14} aria-hidden="true" /> Auto
        </button>
        <button type="button" className="pz-action" onClick={onUndo} disabled={!canUndo || readOnly} title="Deshacer" aria-label="Deshacer">
          <Undo2 size={14} aria-hidden="true" />
        </button>
        <button type="button" className="pz-action" onClick={onRedo} disabled={!canRedo || readOnly} title="Rehacer" aria-label="Rehacer">
          <Redo2 size={14} aria-hidden="true" />
        </button>
        <button type="button" className="pz-action" onClick={onReset} title="Reiniciar" disabled={readOnly}>
          <RotateCcw size={14} aria-hidden="true" /> Reiniciar
        </button>
        <button type="button" className="pz-action" onClick={onOpenSettings} title="Ajustes de la pizarra" aria-label="Ajustes de la pizarra">
          <Settings2 size={14} aria-hidden="true" />
        </button>
        <button type="button" className="pz-action" onClick={onPresent} title="Modo presentación" aria-label="Modo presentación">
          <Maximize2 size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
