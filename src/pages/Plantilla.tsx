import React, { useState } from "react";
import { FileText, ClipboardList } from "lucide-react";
import { Expedientes } from "./Expedientes";
import { Pizarra } from "./pizarra/Pizarra";
import { SeasonSelector } from "../components/SeasonSelector";
import "./Plantilla.css";

type Mode = "expedientes" | "pizarra";
const MODE_KEY = "mp_plantilla_mode";

function initialMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "pizarra" ? "pizarra" : "expedientes";
  } catch {
    return "expedientes";
  }
}
//
// The Plantilla page is a shell over two switchable modes: the existing
// dossier viewer (Expedientes, intact) and the tactical board (Pizarra). The
// last mode is remembered in localStorage, mirroring SeasonContext.
export const Plantilla: React.FC = () => {
  const [mode, setMode] = useState<Mode>(initialMode);

  const choose = (next: Mode) => {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* storage unavailable — keep the in-memory choice */
    }
  };

  return (
    <div className="pl-shell fade-in">
      <SeasonSelector />
      <div className="pl-modes" role="tablist" aria-label="Modo de plantilla">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "expedientes"}
          className="pl-mode-btn"
          onClick={() => choose("expedientes")}
        >
          <FileText size={15} aria-hidden="true" />
          Expedientes
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "pizarra"}
          className="pl-mode-btn"
          onClick={() => choose("pizarra")}
        >
          <ClipboardList size={15} aria-hidden="true" />
          Pizarra
        </button>
      </div>

      {mode === "expedientes" ? <Expedientes /> : <Pizarra />}
    </div>
  );
};
