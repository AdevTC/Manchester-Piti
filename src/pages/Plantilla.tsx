import React from "react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { FileText, ClipboardList } from "lucide-react";
import { Expedientes } from "./Expedientes";
import { Pizarra } from "./pizarra/Pizarra";
import { SeasonSelector } from "../components/SeasonSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
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

  const choose = (next: Mode) =>
    void navigate({ to: "/plantilla", search: (prev) => ({ ...prev, mode: next }) });

  return (
    <div className="pl-shell fade-in">
      <SeasonSelector />
      <Tabs value={mode} onValueChange={(v) => choose(v as Mode)}>
        <TabsList variant="line" aria-label="Modo de plantilla">
          <TabsTrigger value="expedientes">
            <FileText size={15} aria-hidden="true" />
            Expedientes
          </TabsTrigger>
          <TabsTrigger value="pizarra">
            <ClipboardList size={15} aria-hidden="true" />
            Pizarra
          </TabsTrigger>
        </TabsList>
        <TabsContent value="expedientes">
          <Expedientes />
        </TabsContent>
        <TabsContent value="pizarra">
          <Pizarra />
        </TabsContent>
      </Tabs>
    </div>
  );
};
