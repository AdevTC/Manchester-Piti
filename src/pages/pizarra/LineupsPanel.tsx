import React, { useState } from "react";
import { ChevronDown, ClipboardList, Copy, Crown, Pencil, Plus, Save, Trash2 } from "lucide-react";
import type { LineupDoc } from "./lineupDoc";
import { matchLabel, type SeasonMatch } from "./useSeasonMatches";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

// Radix Select items need non-empty values; "" (whole-season scope) maps to this.
const SEASON_SCOPE = "__season__";

export type SaveState = "none" | "dirty" | "saving" | "saved";

interface LineupsPanelProps {
  official: LineupDoc[];
  mine: LineupDoc[];
  loading: boolean;
  activeBoardId: string | null;
  saveState: SaveState;
  isAdmin: boolean;
  seasonName: string;
  matches: SeasonMatch[];
  /** Load an owned board (editable). */
  onLoadMine: (id: string) => void;
  /** Load an official board (read-only). */
  onLoadOfficial: (id: string) => void;
  onNew: () => void;
  onSaveAs: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  /** Mark a board official for a scope, or null to unmark. */
  onMarkOfficial: (id: string, scope: { matchId: string | null } | null) => void;
}

const SAVE_LABEL: Record<SaveState, string> = {
  none: "Sin guardar",
  dirty: "Sin guardar",
  saving: "Guardando…",
  saved: "Guardado ✓",
};

const NameDialog: React.FC<{
  title: string;
  initial?: string;
  cta: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}> = ({ title, initial = "", cta, onCancel, onSubmit }) => {
  const [value, setValue] = useState(initial);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase tracking-wide">{title}</DialogTitle>
        </DialogHeader>
        <input
          className="pz-dialog-input"
          autoFocus
          value={value}
          maxLength={40}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
          }}
          placeholder="Nombre del tablero"
          aria-label="Nombre del tablero"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button disabled={!value.trim()} onClick={() => onSubmit(value.trim())}>
            {cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const OfficialDialog: React.FC<{
  seasonName: string;
  matches: SeasonMatch[];
  onCancel: () => void;
  onConfirm: (scope: { matchId: string | null }) => void;
}> = ({ seasonName, matches, onCancel, onConfirm }) => {
  const [matchId, setMatchId] = useState<string>(""); // "" = whole season
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase tracking-wide">Marcar como oficial</DialogTitle>
          <DialogDescription>Elige el alcance de esta alineación oficial.</DialogDescription>
        </DialogHeader>
        <div className="pz-dialog-field">
          <span>Alcance</span>
          <Select
            value={matchId === "" ? SEASON_SCOPE : matchId}
            onValueChange={(v) => setMatchId(v === SEASON_SCOPE ? "" : v)}
          >
            <SelectTrigger className="w-full" aria-label="Alcance de la alineación oficial">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[1100]">
              <SelectItem value={SEASON_SCOPE}>Toda la temporada · {seasonName}</SelectItem>
              {matches.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {matchLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm({ matchId: matchId || null })}>
            Marcar oficial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type DialogState = null | { kind: "saveAs" } | { kind: "rename"; id: string; name: string } | { kind: "official" };

export const LineupsPanel: React.FC<LineupsPanelProps> = (props) => {
  const { official, mine, loading, activeBoardId, saveState, isAdmin, seasonName, matches } = props;
  const [open, setOpen] = useState(true);
  const [dialog, setDialog] = useState<DialogState>(null);

  const dateOf = (ms: number | null): string =>
    ms != null ? new Date(ms).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "—";
  const scopeOf = (d: LineupDoc): string => {
    if (!d.matchId) return "Temporada";
    const m = matches.find((x) => x.id === d.matchId);
    return m ? matchLabel(m) : "Partido";
  };

  return (
    <section className="pz-boards" aria-label="Tableros guardados">
      <header className="pz-boards-head">
        <button type="button" className="pz-boards-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <ClipboardList size={15} aria-hidden="true" />
          <span className="pz-boards-title">Tableros</span>
          <ChevronDown size={15} aria-hidden="true" className={`pz-boards-chev${open ? " is-open" : ""}`} />
        </button>
        <span className={`pz-save pz-save--${saveState}`} role="status">
          {SAVE_LABEL[saveState]}
        </span>
        <span className="pz-boards-actions">
          <button type="button" className="pz-btn-ghost" onClick={props.onNew}>
            <Plus size={14} aria-hidden="true" />
            Nuevo
          </button>
          <button type="button" className="pz-btn-solid" onClick={() => setDialog({ kind: "saveAs" })}>
            <Save size={14} aria-hidden="true" />
            Guardar como
          </button>
        </span>
      </header>

      {open && (
        <div className="pz-boards-body">
          <div className="pz-boards-group">
            <div className="pz-boards-grouphead">
              <Crown size={13} aria-hidden="true" />
              <span>Oficial</span>
              {isAdmin && activeBoardId && (
                <button type="button" className="pz-btn-mini" onClick={() => setDialog({ kind: "official" })}>
                  Marcar oficial
                </button>
              )}
            </div>
            {official.length === 0 ? (
              <p className="pz-boards-empty">Sin alineación oficial todavía.</p>
            ) : (
              <ul className="pz-boards-list">
                {official.map((d) => (
                  <li key={d.id} className={`pz-board-row is-official${d.id === activeBoardId ? " is-active" : ""}`}>
                    <button type="button" className="pz-board-load" onClick={() => props.onLoadOfficial(d.id)}>
                      <span className="pz-board-seal" aria-hidden="true">
                        <Crown size={12} />
                      </span>
                      <span className="pz-board-name">{d.name}</span>
                      <span className="pz-board-scope">{scopeOf(d)}</span>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        className="pz-board-act"
                        aria-label={`Quitar oficial: ${d.name}`}
                        onClick={() => props.onMarkOfficial(d.id, null)}
                      >
                        Quitar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pz-boards-group">
            <div className="pz-boards-grouphead">
              <span>Mis tableros</span>
              <span className="pz-boards-season">{seasonName}</span>
            </div>
            {loading ? (
              <p className="pz-boards-empty">Cargando tableros…</p>
            ) : mine.length === 0 ? (
              <p className="pz-boards-empty">Aún no has guardado tableros. Usa “Guardar como”.</p>
            ) : (
              <ul className="pz-boards-list">
                {mine.map((d) => (
                  <li key={d.id} className={`pz-board-row${d.id === activeBoardId ? " is-active" : ""}`}>
                    <button type="button" className="pz-board-load" onClick={() => props.onLoadMine(d.id)}>
                      <span className="pz-board-name">{d.name}</span>
                      {d.isOfficial && (
                        <span className="pz-board-tag" aria-label="Oficial">
                          <Crown size={11} aria-hidden="true" />
                        </span>
                      )}
                      <span className="pz-board-date">{dateOf(d.updatedAt)}</span>
                    </button>
                    <span className="pz-board-rowacts">
                      <button
                        type="button"
                        className="pz-board-act"
                        aria-label={`Renombrar ${d.name}`}
                        onClick={() => setDialog({ kind: "rename", id: d.id, name: d.name })}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="pz-board-act"
                        aria-label={`Duplicar ${d.name}`}
                        onClick={() => props.onSaveAs(`Copia de ${d.name}`)}
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        className="pz-board-act pz-board-act--danger"
                        aria-label={`Borrar ${d.name}`}
                        onClick={() => props.onRemove(d.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {dialog?.kind === "saveAs" && (
        <NameDialog
          title="Guardar tablero"
          cta="Guardar"
          onCancel={() => setDialog(null)}
          onSubmit={(name) => {
            setDialog(null);
            props.onSaveAs(name);
          }}
        />
      )}
      {dialog?.kind === "rename" && (
        <NameDialog
          title="Renombrar tablero"
          initial={dialog.name}
          cta="Renombrar"
          onCancel={() => setDialog(null)}
          onSubmit={(name) => {
            setDialog(null);
            props.onRename(dialog.id, name);
          }}
        />
      )}
      {dialog?.kind === "official" && activeBoardId && (
        <OfficialDialog
          seasonName={seasonName}
          matches={matches}
          onCancel={() => setDialog(null)}
          onConfirm={(scope) => {
            setDialog(null);
            props.onMarkOfficial(activeBoardId, scope);
          }}
        />
      )}
    </section>
  );
};
