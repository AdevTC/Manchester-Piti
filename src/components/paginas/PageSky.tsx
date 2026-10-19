// «Vidrio» on the other pages (Plantilla, Números, El club, the match page, Perfil, Vestuario; V-Integracion
// «Cada página, el mismo cristal» and the V-Vivo frames): the light field of the moment behind the whole page
// — Palomeras' sky now, floodlit while a match is played — and the goal moment's flood reaching it (gold for
// ours, a cold coral flash for theirs; nightGoal.ts).
import { VidrioSky, skyAt, type GoalClasses } from "../vidrio";

export interface PageSkyProps {
  now: number;
  /** A match is being played (the floodlights go on with the dusk). */
  live: boolean;
  /** The goal moment (useNightGoal().moment): its flood. */
  moment?: GoalClasses | null;
}

/** The light field of the moment, first child of a `.vd-pg` root. */
export function PageSky({ now, live, moment }: PageSkyProps) {
  const light = skyAt(now, live);
  return <VidrioSky light={light.light} floodlit={light.floodlit} gold={moment?.sky.gold} cold={moment?.sky.cold} />;
}
