import React from "react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { FileText, ClipboardList } from "lucide-react";
import { Expedientes } from "./Expedientes";
import { Pizarra } from "./pizarra/Pizarra";
import { SeasonSelector } from "../components/SeasonSelector";
import "./Plantilla.css";

type Mode = "expedientes" | "pizarra";

const route = getRouteApi("/plantilla");

//
// The Plantilla page is a shell over two switchable modes: the existing
// dossier viewer (Expedientes, intact) and the tactical board (Pizarra). The
// active mode lives in the `?mode` search param, so it is deep-linkable.
export const Plantilla: React.FC = () => {
  const { mode } = route.useSearch();
  const navigate = useNavigate();

  const choose = (next: Mode) => void navigate({ to: "/plantilla", search: { mode: next } });

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
