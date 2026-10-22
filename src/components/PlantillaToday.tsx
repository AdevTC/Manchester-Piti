// /plantilla's layout until Plantilla's redesign lands: today's percha (SquadPage) on el vestuario and el
// álbum, and today's Números «Comparar» (StatsPage, which reads the duel's ?a=&b=) on /plantilla/cara-a-cara.
import { lazyRouteComponent, useLocation } from "@tanstack/react-router";

const SquadPage = lazyRouteComponent(() => import("../pages/squad/SquadPage"), "SquadPage");
const StatsPage = lazyRouteComponent(() => import("../pages/stats/StatsPage"), "StatsPage");

export function PlantillaToday() {
  const duel = useLocation({ select: (l) => l.pathname.replace(/\/+$/, "") === "/plantilla/cara-a-cara" });
  return duel ? <StatsPage /> : <SquadPage />;
}
