// Where the portada's links go, in one place: the other pages and the match (its page, its mesa). Typed router
// links, so a page that moves (Fase 0's addresses) changes here only.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export type Page = "partidos" | "plantilla" | "numeros" | "club" | "vestuario" | "perfil";

interface LinkBits {
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  onClick?: () => void;
}

export function PageLink({ to, ...p }: LinkBits & { to: Page }) {
  switch (to) {
    case "partidos":
      return <Link to="/partidos" {...p} />;
    case "plantilla":
      return <Link to="/plantilla" {...p} />;
    case "numeros":
      return <Link to="/stats" {...p} />;
    case "club":
      return <Link to="/club" {...p} />;
    case "vestuario":
      return <Link to="/vestuario" {...p} />;
    case "perfil":
      return <Link to="/profile" {...p} />;
  }
}

/** The match's page (its acta, its previa, the live match) or its mesa. */
export function MatchLink({ id, mesa, viewTransition, ...p }: LinkBits & { id: string; mesa?: boolean; viewTransition?: boolean }) {
  return mesa ? <Link to="/matches/$matchId/mesa" params={{ matchId: id }} {...p} /> : <Link to="/matches/$matchId" params={{ matchId: id }} viewTransition={viewTransition} {...p} />;
}
