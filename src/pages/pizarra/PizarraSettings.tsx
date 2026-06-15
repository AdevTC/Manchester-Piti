import React, { useRef } from "react";
import { X } from "lucide-react";
import { SETTINGS_FIELDS, type PizarraSettings } from "./usePizarraSettings";
import { useFocusTrap } from "./useFocusTrap";

interface PizarraSettingsProps {
  settings: PizarraSettings;
  onChange: (key: keyof PizarraSettings, value: boolean) => void;
  onClose: () => void;
}

// Display settings: what to show on the board. Rendered as a centered dialog
// (escapes any overflow/stacking context); closes on Esc, backdrop, or X, with
// focus trapped and restored.
export const PizarraSettingsPanel: React.FC<PizarraSettingsProps> = ({ settings, onChange, onClose }) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, onClose);

  return (
    <div className="pz-settings-scrim" role="dialog" aria-modal="true" aria-label="Ajustes de la pizarra" onClick={onClose}>
      <div ref={dialogRef} className="pz-settings" onClick={(e) => e.stopPropagation()}>
        <div className="pz-settings-head">
          <span className="pz-settings-title">Ajustes de la pizarra</span>
          <button type="button" className="pz-settings-close" aria-label="Cerrar ajustes" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <p className="pz-settings-sub">Elige qué se muestra en el campo.</p>
        <ul className="pz-settings-list">
          {SETTINGS_FIELDS.map((f) => (
            <li key={f.key}>
              <label className="pz-settings-row">
                <input
                  type="checkbox"
                  checked={settings[f.key]}
                  onChange={(e) => onChange(f.key, e.target.checked)}
                />
                <span>{f.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
