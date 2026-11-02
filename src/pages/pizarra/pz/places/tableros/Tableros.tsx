// r14 «La pizarra» · Tableros (/pizarra/tableros) and Comparar (/pizarra/tableros/comparar): the place's regions.
// Desktop: lead = hero, numbers, «Empieza uno nuevo» · stage = the gallery (it takes the pitch's place: source none)
// · side = the selected board. Tablet: the gallery in the stage, lead + side in the right column. Phone: the pitch
// previews the selected board in Grada; the sheet's peek is the strip of boards, its panel the gallery.
import { useEffect } from "react";
import "../../../../../styles/pz/tableros.css";
import type { RegionProps } from "../../store/types";
import { PzIcon } from "../../campo/Shirt";
import { verOf } from "../../store/seven";
import { pb } from "./pb";
import { useTb, pick, type Tb } from "./useTb";
import { dots } from "./tablerosView";
import { Gallery } from "./Gallery";
import { Hero, OriginsSec, Played } from "./Lead";
import { Inspector } from "./Inspector";
import { CmpLead, CmpSide, CmpStage, CmpView } from "./Comparar";
import { cmpModel, phoneSpec } from "./cmpModel";
import { readSeen, writeSeen } from "./seen";

export function Tableros({ region, layout }: RegionProps) {
  const tb = useTb();
  const { P, U, boards, off, sel, selId } = tb;
  const S = P.state;
  const phone = layout === "phone";
  const cmp = S.route.sub === "comparar";
  const M = cmp ? cmpModel(tb) : null;

  // the pitch: on the phone it previews the selected board (or the comparison); elsewhere the gallery takes its place
  const spec = phone ? (cmp ? phoneSpec(P, M, U.view) : sel ? { source: "siete" as const, boardId: sel.id, version: "titular" as const, camera: "grada" as const, editable: false, caption: sel.name + " · " + verOf(sel.lineup, "titular").formation } : { source: "tokens" as const, tokens: [], camera: "grada" as const, caption: "" }) : null;
  const specKey = JSON.stringify(spec);
  // (one region drives the pitch: the lead on desktop and tablet, whichever of peek/panel the phone shows)
  const lead = phone ? region === "peek" || region === "panel" : region === "lead";
  useEffect(() => {
    if (!lead || S.route.place !== "tableros") return;
    if (spec) P.act.setStage(spec, { replace: true });
    else P.act.setStage({ source: "none", editable: false }, { replace: true });
    // (the spec by value: a new object each render would loop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead, specKey, layout, S.route.place]);

  // PAR-42: the official as this device first saw it (for who doesn't edit it)
  const offSig = off ? JSON.stringify(verOf(off.lineup, "titular").slots.map((s) => s.playerId)) : "";
  const cap = P.sel.me().cap;
  useEffect(() => {
    if (!lead || !off || cap || readSeen(off.id)) return;
    writeSeen(off.id, verOf(off.lineup, "titular"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead, off?.id, offSig, cap]);

  // another season: the place starts again
  const season = S.W.season.id;
  useEffect(() => {
    if (lead) pb.reset();
  }, [lead, season]);

  // ── the regions
  if (region === "stage") {
    return (
      <div className={cmp && M ? `pb pb-stagewrap${layout === "tablet" ? " is-tab" : ""}` : "pb pb-stage"}>
        {cmp && M ? <CmpStage tb={tb} M={M} layout={layout} /> : <Gallery tb={tb} layout={layout} split />}
      </div>
    );
  }
  if (region === "lead" || region === "side") {
    const flow = layout === "tablet";
    const body =
      region === "lead" ? (
        cmp ? (
          M ? (
            <CmpLead tb={tb} M={M} phone={false} />
          ) : (
            <NothingToCompare tb={tb} />
          )
        ) : (
          <>
            <Hero tb={tb} layout={layout} />
            {boards.length > 0 && <OriginsSec tb={tb} />}
          </>
        )
      ) : cmp ? (
        M ? (
          <CmpSide tb={tb} M={M} />
        ) : null
      ) : sel ? (
        <Inspector tb={tb} b={sel} layout={layout} />
      ) : !boards.length ? (
        <Played tb={tb} />
      ) : null;
    if (!body) return null;
    if (flow) return <div className={`pb pb-flow pb-${region}`}>{body}</div>;
    return (
      <div className={`pz-region pb pb-${region}`}>
        <div className="pz-region__scroll">{body}</div>
      </div>
    );
  }
  if (region === "peek") {
    const R = P.sel.reactions();
    const pri = P.sel.primary("tableros");
    const nextM = P.state.W.matches.find((x) => x.id === P.state.W.next);
    const peekT = cmp ? (M ? M.head : "Nada con qué comparar") : boards.length ? boards.length + (boards.length === 1 ? " tablero" : " tableros") : "Aún no hay tableros";
    const peekS = cmp ? (M ? (M.c.ins.length ? M.c.ins.length + (M.c.ins.length === 1 ? " cara nueva" : " caras nuevas") : "Mismas caras") + (M.c.sistema ? " · " + M.A.formation + " → " + M.B.formation : "") : "") : off ? "Oficial: " + R.ok + " de acuerdo, " + R.dudas + " dudas" : boards.length ? "Aún sin oficial" + (nextM?.j ? " para la J" + nextM.j : "") : "El primero se guarda con tu primer cambio";
    return (
      <div className="pb pb-peek">
        <div className="pb-ptop">
          <div>
            <h1>{peekT}</h1>
            <p>{peekS}</p>
          </div>
          {pri && (
            <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={pri.run} disabled={!!pri.disabled}>
              <PzIcon name={pri.icon ?? "plus"} />
              {pri.short ?? pri.label}
            </button>
          )}
        </div>
        {cmp ? (
          M && <CmpView M={M} />
        ) : boards.length > 0 ? (
          <div className="pb-strip" role="group" aria-label="Tus tableros: toca uno para verlo en el campo" data-scroll-x="1">
            {boards
              .slice()
              .sort((a, b) => Number(b.id === off?.id) - Number(a.id === off?.id) || (b.updatedAt || 0) - (a.updatedAt || 0))
              .map((b) => {
                const v = verOf(b.lineup, "titular");
                return (
                  <button key={b.id} type="button" className="pb-sb" aria-pressed={b.id === selId} onClick={() => pick(P, b)} aria-label={b.name + (b.id === off?.id ? ", oficial" : "") + ", " + v.formation + ": verlo en el campo"}>
                    <span className="pz-mini" aria-hidden="true">
                      {dots(v.slots).map((d, i) => (
                        <i key={i} style={{ left: d.x + "%", top: d.y + "%" }} />
                      ))}
                    </span>
                    <span>
                      <b>{b.name}</b>
                      <small>{(b.id === off?.id ? "Oficial · " : "") + v.formation}</small>
                    </span>
                  </button>
                );
              })}
          </div>
        ) : null}
      </div>
    );
  }
  if (region === "panel") {
    return (
      <div className="pb pb-flow pb-panel">
        {cmp ? (
          M ? (
            <>
              <CmpLead tb={tb} M={M} phone />
              <CmpSide tb={tb} M={M} />
            </>
          ) : (
            <NothingToCompare tb={tb} />
          )
        ) : (
          <>
            <Hero tb={tb} layout={layout} />
            <Gallery tb={tb} layout={layout} />
            {!boards.length && <Played tb={tb} />}
          </>
        )}
      </div>
    );
  }
  return null;
}

function NothingToCompare({ tb }: { tb: Tb }) {
  const { P } = tb;
  return (
    <>
      <section className="pz-hero pb-hero" aria-labelledby="pb-h">
        <p className="pz-kick">Comparar · cara a cara</p>
        <h1 className="pz-h1" id="pb-h">
          Nada con qué comparar
        </h1>
        <p className="pz-line">No hay otro siete con el que comparar: duplica este o crea uno nuevo en Tableros.</p>
      </section>
      {tb.canCreate && <OriginsSec tb={tb} />}
      <button type="button" className="nx-lnk" onClick={() => P.nav("/pizarra/tableros")}>
        Volver a los tableros
      </button>
    </>
  );
}

