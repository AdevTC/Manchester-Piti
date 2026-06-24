import React, { useState } from "react";
import { Move, RotateCcw, Wand2, TrendingUp, LayoutGrid, Share2, Columns2, Undo2, Redo2, Settings2, Maximize2 } from "lucide-react";
import { FORMATION_NAMES, type FormationName } from "./formations";
import { TACTICS, type TacticKey, type Tactics } from "./tactics";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Hint } from "../../components/ui/hint";

// Radix Select items need non-empty values; "" (no linked match) maps to this.
const MATCH_NONE = "__none__";

interface PizarraControlsProps {
  formation: FormationName;
  onFormation: (f: FormationName) => void;
  tactics: Tactics;
  onTactic: (key: TacticKey, value: string) => void;
  freeMode: boolean;
  onToggleFree: () => void;
  onReset: () => void;
  onAuto: () => void;
  onSuggestForm: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenSettings: () => void;
  onPresent: () => void;
  onShare: () => void;
  onCompare: () => void;
  /** Season matches for the link-to-match select (id + human label). */
  matches: { id: string; label: string }[];
  matchId: string | null;
  onLinkMatch: (id: string | null) => void;
  /** Free-mode snap-to-grid + reset to formation. */
  snap: boolean;
  onToggleSnap: () => void;
  onResetPositions: () => void;
  /** When true, the board is being viewed (official / someone else's): the
   * editing controls are disabled (settings + presentation + share stay available). */
  readOnly?: boolean;
}

// The TV-graphic control bar: system dropdown + tactical instructions
// (collapsible behind "Táctica" on mobile) + board actions. Dropdowns are
// shadcn/Radix Select (keyboard operable, themed); actions are flat buttons.
export const PizarraControls: React.FC<PizarraControlsProps> = ({
  formation,
  onFormation,
  tactics,
  onTactic,
  freeMode,
  onToggleFree,
  onReset,
  onAuto,
  onSuggestForm,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpenSettings,
  onPresent,
  onShare,
  onCompare,
  matches,
  matchId,
  onLinkMatch,
  snap,
  onToggleSnap,
  onResetPositions,
  readOnly = false,
}) => {
  const [tacticsOpen, setTacticsOpen] = useState(false);
  return (
    <div className="pz-controls" role="group" aria-label="Sistema y táctica">
      <div className="pz-ctrl">
        <label className="pz-ctrl-label" htmlFor="pz-system">Sistema</label>
        <Select value={formation} onValueChange={(v) => onFormation(v as FormationName)} disabled={readOnly}>
          <SelectTrigger size="sm" id="pz-system" className="min-w-[5rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[1100]">
            {FORMATION_NAMES.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <button
        type="button"
        className="pz-tactics-toggle"
        aria-expanded={tacticsOpen}
        onClick={() => setTacticsOpen((o) => !o)}
      >
        Táctica
      </button>

      <div className={`pz-tactics${tacticsOpen ? " is-open" : ""}`}>
        {TACTICS.map((t) => (
          <div className="pz-ctrl" key={t.key}>
            <label className="pz-ctrl-label" htmlFor={`pz-t-${t.key}`}>{t.label}</label>
            <Select value={tactics[t.key]} onValueChange={(v) => onTactic(t.key, v)} disabled={readOnly}>
              <SelectTrigger size="sm" id={`pz-t-${t.key}`} className="min-w-[6rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[1100]">
                {t.options.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="pz-actions">
        <button type="button" className="pz-action" aria-pressed={freeMode} onClick={onToggleFree} title="Modo libre" disabled={readOnly}>
          <Move size={14} aria-hidden="true" /> Libre
        </button>
        {freeMode && (
          <>
            <button type="button" className="pz-action" aria-pressed={snap} onClick={onToggleSnap} title="Ajustar a la rejilla" disabled={readOnly}>
              <LayoutGrid size={14} aria-hidden="true" /> Rejilla
            </button>
            <button type="button" className="pz-action" onClick={onResetPositions} title="Reset de posiciones" disabled={readOnly}>
              <RotateCcw size={14} aria-hidden="true" /> Reset
            </button>
          </>
        )}
        <button type="button" className="pz-action" onClick={onAuto} title="Auto-colocar por posición" disabled={readOnly}>
          <Wand2 size={14} aria-hidden="true" /> Auto
        </button>
        <button type="button" className="pz-action" onClick={onSuggestForm} title="Sugerir once por forma reciente" disabled={readOnly}>
          <TrendingUp size={14} aria-hidden="true" /> Forma
        </button>
        <Hint label="Deshacer">
          <button type="button" className="pz-action" onClick={onUndo} disabled={!canUndo || readOnly} aria-label="Deshacer">
            <Undo2 size={14} aria-hidden="true" />
          </button>
        </Hint>
        <Hint label="Rehacer">
          <button type="button" className="pz-action" onClick={onRedo} disabled={!canRedo || readOnly} aria-label="Rehacer">
            <Redo2 size={14} aria-hidden="true" />
          </button>
        </Hint>
        <button type="button" className="pz-action" onClick={onReset} title="Reiniciar" disabled={readOnly}>
          <RotateCcw size={14} aria-hidden="true" /> Reiniciar
        </button>
        <Hint label="Ajustes de la pizarra">
          <button type="button" className="pz-action" onClick={onOpenSettings} aria-label="Ajustes de la pizarra">
            <Settings2 size={14} aria-hidden="true" />
          </button>
        </Hint>
        <Hint label="Modo presentación">
          <button type="button" className="pz-action" onClick={onPresent} aria-label="Modo presentación">
            <Maximize2 size={14} aria-hidden="true" />
          </button>
        </Hint>
        <button type="button" className="pz-action" onClick={onShare} title="Compartir / descargar póster" aria-label="Compartir el once">
          <Share2 size={14} aria-hidden="true" /> Compartir
        </button>
        <button type="button" className="pz-action" onClick={onCompare} title="Comparar dos alineaciones" aria-label="Comparar alineaciones">
          <Columns2 size={14} aria-hidden="true" /> Comparar
        </button>
        <Select
          value={matchId ?? MATCH_NONE}
          onValueChange={(v) => onLinkMatch(v === MATCH_NONE ? null : v)}
          disabled={readOnly}
        >
          <SelectTrigger size="sm" className="min-w-[8rem] pz-select--match" aria-label="Vincular a partido">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[1100]">
            <SelectItem value={MATCH_NONE}>Sin partido</SelectItem>
            {matches.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
