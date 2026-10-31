// Tus partidos › #porra: «Tu recorrido en la porra» (today's tu/screens/Porra.tsx, restyled for the place): the
// season's points as they grew, by month, with the monthly table (components/celeste/PorraHistory). The match's
// vestuario and the old /perfil#porra link here; arriving through #porra opens it and brings it into view.
import { useEffect } from "react";
import type { ClubMatch } from "../../../../../lib/clubData";
import { PorraHistory } from "../../../../../components/celeste/PorraHistory";
import type { PorraLine } from "../../../profileData";
import { pl } from "../../model";

export const PORRA_ID = "porra";

export function PorraBlock({ matches, seasonId, uid, asked, line }: { matches: readonly ClubMatch[]; seasonId: string; uid: string; asked: boolean; line: PorraLine | null }) {
  useEffect(() => {
    if (!asked) return;
    const t = window.setTimeout(() => document.getElementById(PORRA_ID)?.scrollIntoView({ block: "start" }), 120);
    return () => window.clearTimeout(t);
  }, [asked]);
  if (!uid || !seasonId) return null;
  return (
    <section className="tp-porra" id={PORRA_ID} aria-labelledby="tp-po-h">
      <div className="nx-sec__head">
        <h3 className="nx-h3" id="tp-po-h">
          Tu porra
        </h3>
        <p className="nx-meta">{line ? `${pl(line.predictions, "pronóstico", "pronósticos")} · ${pl(line.exact, "exacto", "exactos")} · vas ${line.rank}.º de ${line.of}` : "Aún sin pronósticos esta temporada"}</p>
      </div>
      <PorraHistory key={`${seasonId}:${asked ? "open" : "shut"}`} matches={matches as ClubMatch[]} seasonId={seasonId} uid={uid} defaultOpen={asked} />
    </section>
  );
}
