import React from "react";
import { SETTINGS_FIELDS, type PizarraSettings } from "./usePizarraSettings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

interface PizarraSettingsProps {
  settings: PizarraSettings;
  onChange: (key: keyof PizarraSettings, value: boolean) => void;
  onClose: () => void;
}

// Display settings: what to show on the board. Radix Dialog handles the portal,
// focus trap/restore, scroll lock and Esc/backdrop dismissal.
export const PizarraSettingsPanel: React.FC<PizarraSettingsProps> = ({ settings, onChange, onClose }) => {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase tracking-wide">Ajustes de la pizarra</DialogTitle>
          <DialogDescription>Elige qué se muestra en el campo.</DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
};
