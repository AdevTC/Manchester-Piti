import { useCallback, useState } from "react";

// What to show on the board. Persisted in localStorage so each user keeps
// their preferred view. Not part of the lineup (it's a view preference).
export interface PizarraSettings {
  showNumber: boolean;
  showName: boolean;
  showPosition: boolean;
  showGalones: boolean;
  showEmptyLabels: boolean;
  showOutOfPosition: boolean;
}

const KEY = "mp_pizarra_settings";

const DEFAULTS: PizarraSettings = {
  showNumber: true,
  showName: true,
  showPosition: false,
  showGalones: true,
  showEmptyLabels: true,
  showOutOfPosition: true,
};

function read(): PizarraSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<PizarraSettings>) };
  } catch {
    return DEFAULTS;
  }
}

export function usePizarraSettings(): {
  settings: PizarraSettings;
  set: (key: keyof PizarraSettings, value: boolean) => void;
} {
  const [settings, setSettings] = useState<PizarraSettings>(read);

  const set = useCallback((key: keyof PizarraSettings, value: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — keep in-memory */
      }
      return next;
    });
  }, []);

  return { settings, set };
}

export const SETTINGS_FIELDS: { key: keyof PizarraSettings; label: string }[] = [
  { key: "showNumber", label: "Dorsal" },
  { key: "showName", label: "Nombre" },
  { key: "showPosition", label: "Posición" },
  { key: "showGalones", label: "Galones" },
  { key: "showEmptyLabels", label: "Etiquetas de hueco" },
  { key: "showOutOfPosition", label: "Señal fuera de posición" },
];
