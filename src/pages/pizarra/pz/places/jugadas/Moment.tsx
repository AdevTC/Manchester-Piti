// r14 «La pizarra» · Jugadas › «La jugada de verdad» (PZ-D21J): an own play ties itself to the acta's moment it
// happened in («J2 · 23′ · gol de ALCIDES», data/moment.ts), with a link to that match. The team's plays only read.
import { useState } from "react";
import { usePz } from "../../store/context";
import type { Layout } from "../../store/types";
import { PzIcon } from "../../campo/Shirt";
import { actaMoments, momentLabel, type MomentEvent } from "../../../data/moment";
import { canEditPlay, saveSteps, stepsOf } from "./engine";
import type { PjPlay } from "./jugadasView";

export function Moment({ pj }: { pj: PjPlay; layout: Layout }) {
  const P = usePz();
  const ed = canEditPlay(P, pj);
  const [open, setOpen] = useState(false);
  const [mid, setMid] = useState<string>("");
  const m = pj.play.moment ?? null;
  const played = P.state.W.matches.filter((x) => x.played).sort((a, b) => b.at - a.at);
  const evOf = (id: string): MomentEvent[] => actaMoments((P.sel.match(id)?.cal.events ?? []) as MomentEvent[]);
  const label = m
    ? momentLabel(m, { jornada: P.sel.match(m.matchId)?.j ?? null, event: m.eventId ? (evOf(m.matchId).find((e) => e.id === m.eventId) ?? null) : null, name: (id) => P.sel.name(id) })
    : "";
  const M = m ? P.sel.match(m.matchId) : null;
  if (!m && !ed) return null;
  const pick = mid || played[0]?.id || "";
  const evs = pick ? evOf(pick) : [];
  const save = (e: MomentEvent) => {
    setOpen(false);
    saveSteps(P, pj, stepsOf(P, pj), "La jugada de verdad: " + momentLabel({ matchId: pick, min: e.minute ?? 0, eventId: e.id }, { jornada: P.sel.match(pick)?.j ?? null, event: e, name: (id) => P.sel.name(id) }), { moment: { matchId: pick, min: Math.max(0, Math.min(200, Math.round(e.minute ?? 0))), eventId: e.id } });
  };
  return (
    <section className="pz-sec" aria-labelledby="pj-mom">
      <div className="pz-sec__h">
        <h2 id="pj-mom">La jugada de verdad</h2>
        {M && <p>{M.rival}</p>}
      </div>
      {m ? (
        <div className="pj-acts">
          <a className="vd-glass vd-press pz-btn" href={`/partidos/${encodeURIComponent(m.matchId)}`} aria-label={`${label}. Abrir el acta del partido`}>
            <PzIcon name="whistle" />
            {label}
          </a>
          {ed && (
            <button type="button" className="nx-lnk" onClick={() => saveSteps(P, pj, stepsOf(P, pj), "Momento del acta quitado", { moment: null })}>
              Quitar
            </button>
          )}
        </div>
      ) : (
        !open && (
          <>
            <p className="pj-hint">Enlaza el momento del acta en que pasó: se abre con su minuto, y el vídeo lo lleva.</p>
            <div className="pj-acts">
              <button type="button" className="vd-glass vd-press pz-btn" onClick={() => setOpen(true)} disabled={!played.length}>
                <PzIcon name="link" />
                {played.length ? "Enlazar un momento" : "Aún no hay partidos jugados"}
              </button>
            </div>
          </>
        )
      )}
      {open && (
        <div className="pj-mom" role="group" aria-label="Elige el momento">
          <label className="pj-field">
            <span>El partido</span>
            <select className="vd-glass pj-in" value={pick} onChange={(e) => setMid(e.target.value)}>
              {played.map((x) => (
                <option key={x.id} value={x.id}>
                  {`${x.j ? "J" + x.j + " · " : ""}${x.rival}${x.gf != null && x.ga != null ? ` · ${x.gf}–${x.ga}` : ""}`}
                </option>
              ))}
            </select>
          </label>
          {evs.length ? (
            <ul className="pj-momlist">
              {evs.map((e) => (
                <li key={e.id}>
                  <button type="button" className="vd-glass vd-press pz-btn" onClick={() => save(e)}>
                    {momentLabel({ matchId: pick, min: e.minute ?? 0, eventId: e.id }, { jornada: null, event: e, name: (id) => P.sel.name(id) })}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pj-hint">El acta de ese partido no tiene goles ni ocasiones apuntadas.</p>
          )}
          <div className="pj-acts">
            <button type="button" className="nx-lnk" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
