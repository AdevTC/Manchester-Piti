// «Tu recorrido en la porra» on Mi página (/perfil#porra, where the match's vestuario links it — P boards
// place-vestuario): the season's points as they grew, by month, with the monthly table. A player finds it at the end
// of Temporada, a socio at the end of his carné; arriving through #porra opens it and brings it into view.
import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { useClubData } from "../../../../lib/clubData";
import { PorraHistory } from "../../../../components/celeste/PorraHistory";

export const PORRA_ID = "porra";

export function PorraBlock({ seasonId, uid }: { seasonId: string; uid: string }) {
  const { matches } = useClubData();
  const asked = useLocation({ select: (l) => l.hash === PORRA_ID });
  useEffect(() => {
    if (!asked) return;
    const t = window.setTimeout(() => document.getElementById(PORRA_ID)?.scrollIntoView({ block: "start" }), 120);
    return () => window.clearTimeout(t);
  }, [asked]);
  if (!uid || !seasonId) return null;
  return (
    <section className="tu-blk tu-blk--wide tu-porra" id={PORRA_ID} aria-label="Tu recorrido en la porra">
      <PorraHistory key={asked ? "open" : "shut"} matches={matches} seasonId={seasonId} uid={uid} defaultOpen={asked} />
    </section>
  );
}
