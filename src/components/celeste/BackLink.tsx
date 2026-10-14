// «Volver» that goes back to where you came from: when the entry behind this page is another page of
// the app (lib/backTrail), it steps back through history to it (the stats, the home, another jugador…);
// on a first load or a deep link there is nothing of ours behind, so it leads to the section instead,
// named («Partidos», «Plantilla»). Its href is always the section: a new tab or a copied link opens that.
import type { MouseEvent } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { stepsBack, useHistoryIndex } from "../../lib/backTrail";
import { Icon } from "./icons";

export interface BackLinkProps {
  /** The section it falls back to. */
  to: "/partidos" | "/plantilla";
  /** The section's name, shown when it falls back. */
  label: string;
  className?: string;
  iconSize?: number;
}

export function BackLink({ to, label, className, iconSize = 18 }: BackLinkProps) {
  const router = useRouter();
  const index = useHistoryIndex();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const steps = stepsBack(index, pathname);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // A modified or middle click keeps the link's own behaviour (a new tab on the section).
    if (!steps || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    router.history.go(-steps);
  };
  return (
    <Link className={className} to={to} onClick={onClick}>
      <Icon name="left" size={iconSize} stroke={2.2} />
      <span>{steps ? "Volver" : label}</span>
    </Link>
  );
}
