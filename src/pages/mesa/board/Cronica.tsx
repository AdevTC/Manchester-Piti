// La mesa (r12) · «Lo que va pasando» (?vista=cronica): every play, the last first, filtered by kind, the start of
// the 2ª marked, each with who wrote it and what it still needs, «Corregir» and «Borrar» (their errors on the status
// line and in the sheet: B-MESA-04).
import type { MesaView } from "../types";
import { glyphOf, isRival, KINDS, kindOf, latestFirst, metaOf, minText, plural, timeText } from "./derive";
import { Dupe } from "./Juego";
import { Icon } from "./parts";
import type { useBoard } from "./useBoard";

type B = ReturnType<typeof useBoard>;

export function Cronica({ v, b }: { v: MesaView; b: B }) {
  const flt = b.ui.filter;
  const evs = latestFirst(v.events).filter((e) => flt === "todo" || kindOf(e.type) === flt);
  const hasSecond = v.events.some((e) => e.period === 2);
  const others = v.presence.filter((p) => p.fresh && !p.me).map((p) => p.name);
  // (the 2ª's start goes above the last play of the 1ª)
  const firstOfOne = hasSecond ? evs.findIndex((e) => e.period === 1) : -1;
  const head = v.match.round ? `Jornada ${v.match.round}, contra ${v.match.rival}` : `Contra ${v.match.rival}`;
  return (
    <section className="me-cro me-scroll" aria-labelledby="me-cr-h">
      <header className="me-sh vd-reg-2">
        <p className="me-k">{head}</p>
        <h1 className="me-h1" id="me-cr-h">Lo que va pasando</h1>
        <p className="me-small">{others.length ? `${others.join(" y ")} también ${others.length > 1 ? "están" : "está"} apuntando · ahora` : "Solo tú en la mesa"}</p>
      </header>
      <div className="me-chips me-chips--scroll me-cro__f vd-reg-3" role="group" aria-label="Filtrar jugadas">
        {KINDS.map(([k, t]) => (
          <button key={k} type="button" className="me-chip vd-glass vd-press" aria-pressed={flt === k} onClick={() => b.setUi({ filter: k })}>
            {t}<span className="me-sec__n">{k === "todo" ? v.events.length : v.events.filter((e) => kindOf(e.type) === k).length}</span>
          </button>
        ))}
      </div>
      <div className="vd-reg-3"><Dupe v={v} b={b} /></div>
      <ol className="me-rail vd-reg-4" aria-label="Las jugadas, de la última a la primera">
        {evs.flatMap((e, i) => {
          const out = [];
          if (i === firstOfOne) {
            out.push(<li key="second" className="me-rail__div">Empieza la 2ª parte</li>);
          }
          out.push(
            <li key={e.id} className={`me-rail__r is-${glyphOf(e.type)}`}>
              <span className="me-feed__m">{minText(e)}</span>
              <span className="me-feed__g" aria-hidden="true" />
              <span className="me-feed__t">
                {isRival(e) && <span className="me-rc me-feed__code"><i aria-hidden="true">{v.match.rivalShort}</i></span>}
                <b>{e.text}</b>
                <small>{metaOf(e)}</small>
              </span>
              <span className="me-rail__a">
                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => b.editOpen(e)} aria-label={`Corregir: ${e.text}`} aria-haspopup="dialog">Corregir</button>
                <button type="button" className="vd-ibtn vd-glass vd-press" onClick={() => b.remove(e.id)} aria-label={`Borrar: ${e.text}`}><Icon name="trash" /></button>
              </span>
            </li>,
          );
          return out;
        })}
        {v.events.length > 0 && v.match.clock.kickoffAt && <li className="me-rail__div">Pitido inicial a las {timeText(v.match.clock.kickoffAt)}</li>}
      </ol>
      {!evs.length && <p className="me-small me-cro__empty">{v.events.length ? "Nada de esto todavía." : "Aún no ha pasado nada."}</p>}
      <p className="vd-vh" aria-live="polite">{plural(evs.length, "jugada", "jugadas")}</p>
    </section>
  );
}
