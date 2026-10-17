// La mesa · «¿Quién ha venido?» (QuienV3), a step of Antes before kick-off: the LED counting who has
// come and the time to kick-off, each convocado as a toggle (check lamp, shirt, name, his answer, the
// pizarra's position, form and rating), and the gold «Elegir el siete en la pizarra». Each tap is shown at
// once and saved a moment later (setMatchPresent); the note says whether it is saved.
import type { MesaScreenProps } from "../types";
import { useLlegada, type Llegada as LlegadaData } from "../useLlegada";
import { buzz, useFlash, useNow } from "./hooks";
import { fixtureTitle, fmtClock, hhmm, matchLine } from "./model";
import { BackButton, Check, Screws, ShirtDefs } from "./parts";
import { rollNote, rollRows, type Convocado, type RollRow } from "./llegadaModel";
import "./screens.css";

const SHIRT = "M15 3 L20 1.5 Q24 6 28 1.5 L33 3 L46 11 L41 20 L36 17 L36 42 L12 42 L12 17 L7 20 L2 11 Z";

function Row({ r, onToggle }: { r: RollRow; onToggle: (id: string) => void }) {
  const fm = "fm" + (r.form.hot ? " hot" : r.form.low ? " low" : "");
  return (
    <button type="button" className={r.here ? "p on" : "p off"} aria-pressed={r.here} aria-label={r.aria} onClick={() => onToggle(r.id)}>
      <span className="chk"><Check size={14} /></span>
      <span className="qshirt" aria-hidden="true">
        <svg width="30" height="28" viewBox="0 0 48 44"><path d={SHIRT} fill={r.keeper ? "url(#msGk)" : "url(#msSky)"} stroke={r.keeper ? "#FFC659" : "rgba(255,255,255,.55)"} strokeWidth="1.6" strokeLinejoin="round" /></svg>
        <span className={r.keeper ? "qdor gk" : "qdor"}>{r.number}</span>
      </span>
      <span className="nmw" aria-hidden="true"><b>{r.name}</b><small className={r.lineCls || undefined}>{r.line}</small></span>
      <span className={r.keeper ? "qpos gk" : "qpos"} aria-hidden="true">{r.pos}</span>
      <span className={fm} aria-hidden="true">
        <span className="bars">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= r.form.level ? "l" : undefined} />)}</span>
        <span>{r.form.word}</span>
      </span>
      <span className="rt" aria-hidden="true">{r.rt}</span>
    </button>
  );
}

export interface LlegadaViewProps extends MesaScreenProps {
  data: LlegadaData;
  onBack: () => void;
}

/** The roll call, drawn from its data (exported for the tests). */
export function LlegadaView({ view, data, onBack }: LlegadaViewProps) {
  const { match, field, bench, nav } = view;
  const now = useNow(1000);
  const called: Convocado[] = [...field, ...bench].filter((p, i, a) => a.findIndex((q) => q.id === p.id) === i).map((p) => ({ id: p.id, name: p.name, number: p.number, guest: p.guest }));
  const here = new Set(data.present);
  const { main, rest } = rollRows(called, data.squad, data.conv, here);
  const count = called.filter((p) => here.has(p.id)).length;
  const keeperHere = [...main, ...rest].some((r) => r.here && r.keeper);
  const note = rollNote(count, keeperHere);
  const bigRef = useFlash<HTMLSpanElement>(count, "pop");
  const cd = Math.max(0, Math.ceil((match.date - now) / 1000));
  const toggle = (id: string) => {
    buzz(15);
    data.toggle(id);
  };
  const status = data.save === "saving" ? "Guardando…" : data.save === "saved" ? "Guardado" : "";

  return (
    <div className="col llegada">
      <ShirtDefs />
      <div className="top">
        <BackButton label="Volver a la previa" onClick={onBack} />
        <div className="ttl">
          <b>{fixtureTitle(match)}</b>
          <span><span className="pre">Previa</span>{matchLine(match)}</span>
        </div>
      </div>

      <div className="box">
        <Screws at={9} />
        <div className="glass qled">
          <span ref={bigRef} className="big" aria-hidden="true">{count}</span>
          <span className="of"><b>HAN VENIDO</b><span>de {called.length} convocados</span></span>
          <span className="cd" role="timer" aria-label={`Cuenta atrás hasta el inicio, previsto a las ${hhmm(match.date)}`}><b>{cd > 0 ? "FALTAN" : "ES LA HORA"}</b><span>{fmtClock(cd)}</span></span>
        </div>
      </div>
      <p className="sr" role="status">{`Han venido ${count} de ${called.length} convocados`}</p>

      <div className="hd">
        <h1>¿Quién ha venido?</h1>
        <p>Toca a cada uno según llega. La forma y su sitio te ayudan a elegir el siete.</p>
      </div>

      <div className="roll" role="group" aria-label="Convocados: toca a quien haya venido" aria-busy={data.loading || undefined}>
        <div className="well">
          {main.map((r) => <Row key={r.id} r={r} onToggle={toggle} />)}
          {main.length > 0 && rest.length > 0 && <div className="sep">Dijeron que no o no contestaron</div>}
          {rest.map((r) => <Row key={r.id} r={r} onToggle={toggle} />)}
          {!called.length && <p className="sep">La convocatoria aún no tiene a nadie.</p>}
        </div>
      </div>

      <div className="dock">
        {data.save === "error" ? (
          <div className="qerr" role="alert">
            <span>{data.error}</span>
            <button type="button" className="key" onClick={data.retry}>Reintentar</button>
          </div>
        ) : (
          <div className="note" role="status">
            <span>{note.a}{note.b && <b>{note.b}</b>}</span>
            {status && <span className="sv">{data.save === "saved" && <Check size={12} />}{status}</span>}
          </div>
        )}
        <button type="button" className="cta" aria-label={note.enough ? `${note.cta} en la pizarra` : undefined} disabled={!note.enough} onClick={() => nav.pizarra(match.officialBoard ?? null)}>
          <span>{note.cta}</span>
          <i><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFC659" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></i>
        </button>
      </div>
    </div>
  );
}

/** The roll call with its data (mounted only while it is open: the cromos and the answers load then). */
export function Llegada({ view, onBack }: MesaScreenProps & { onBack: () => void }) {
  const called = [...view.field, ...view.bench].map((p) => p.id);
  const data = useLlegada(view.match.id, view.match.seasonId, view.match.present ?? null, called);
  return <LlegadaView view={view} data={data} onBack={onBack} />;
}
