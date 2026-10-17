// La mesa · antes del pitido (AntesV2): the LED counting down to kick-off, the seven on the floodlit pitch
// with the bench below, the raised checklist (the seven, the bench, who scores, the screen stays on with
// «Probar aviso») and the gold «Pitar el inicio». After the whistle a lower third offers «Deshacer».
import { useState } from "react";
import { systemDef } from "../../../lib/formations";
import type { MesaPlayer, MesaScreenProps } from "../types";
import { beep, buzz, canVibrate, useFlash, useNow } from "./hooks";
import { avatars, fixtureTitle, fmtClock, hhmm, initial, listNames } from "./model";
import { BackButton, Check, Screws, Shirt, ShirtDefs, Whistle } from "./parts";
import "./screens.css";

const WORDS = ["Nadie", "Uno", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez"];
const FALLBACK = systemDef("2-3-1").spots;

/** Where a shirt stands on the 236 px card: x in %, top in px (the punta at 10, the keeper on the line; we attack up). */
function place(p: MesaPlayer, i: number) {
  const s = p.spot ?? (p.keeper ? { x: FALLBACK[0][1], y: FALLBACK[0][2] } : { x: FALLBACK[1 + (i % 6)][1], y: FALLBACK[1 + (i % 6)][2] });
  return { left: `${Math.min(89, Math.max(11, s.x))}%`, top: Math.round(Math.min(170, Math.max(4, 10 + ((s.y - 22) / 73) * 160))) };
}

function Lamp({ ok, gold = false }: { ok: boolean; gold?: boolean }) {
  return ok ? (
    <span className={gold ? "lamp gold" : "lamp"}><Check /></span>
  ) : (
    <span className="lamp warn" aria-hidden="true">!</span>
  );
}

export function Antes({ view }: MesaScreenProps) {
  const { match, field, bench, presence, me, actions, nav } = view;
  const now = useNow(1000);
  const [tested, setTested] = useState(false);
  const [kickedAt, setKickedAt] = useState<number | null>(null);
  const live = match.clock.phase !== "ready";
  const digitRef = useFlash<HTMLSpanElement>(live, "fa");
  const digitRef2 = useFlash<HTMLSpanElement>(live, "fa");

  const cd = Math.max(0, Math.ceil((match.date - now) / 1000));
  const showL3 = live && kickedAt !== null && now - kickedAt < 9000;
  const keeper = field.find((p) => p.keeper);
  const outfield = field.filter((p) => p !== keeper);
  const sevenLabel = `El siete en el campo: ${listNames([...outfield.map((p) => p.name), ...(keeper ? [`${keeper.name} de portero`] : [])])}`;

  const scorers = presence.length ? presence : [{ uid: me.uid, name: me.name, at: 0, fresh: true, me: true }];
  const colour = avatars(scorers);
  const others = scorers.filter((p) => !p.me).map((p) => p.name);
  const whoLine = others.length ? `${me.name} (tú) y ${listNames(others)} anotan` : "Anotas tú";
  const whoSub = others.length === 1 ? "Los dos veis lo mismo al instante" : others.length ? "Todos veis lo mismo al instante" : "Si entra otro anotador, lo verá al instante";
  const wake = typeof navigator !== "undefined" && "wakeLock" in navigator;

  const items = [field.length === 7, true, true, wake];
  const ready = items.filter(Boolean).length;
  const heading = live ? "Ya se juega" : ready === items.length ? "Todo listo para pitar" : "Casi listo para pitar";

  const kick = () => {
    buzz([70, 50, 260]);
    setKickedAt(Date.now());
    actions.clock("start").catch(() => setKickedAt(null));
  };
  const undo = () => {
    buzz(25);
    setKickedAt(null);
    void actions.clock("reset");
  };
  const probe = () => {
    buzz([40, 60, 40]);
    beep(880, 140);
    setTested(true);
  };

  const pct = live ? Math.min(100, Math.round((match.clock.periodSeconds / match.clock.halfSeconds) * 1000) / 10) : 0;
  const benchNames = bench.map((p) => p.name);

  return (
    <div className="col antes">
      <ShirtDefs />
      <div className="top">
        <BackButton label="Salir de la mesa" onClick={nav.exit} />
        <div className="ttl">
          <b>{fixtureTitle(match)}</b>
          <span>
            {live ? (
              <span className="live"><i />En juego</span>
            ) : (
              <span className="pre">Previa</span>
            )}
            {match.competition}
          </span>
        </div>
        <span className="who" role="img" aria-label={`${listNames(scorers.map((p) => p.name))} ${scorers.length > 1 ? "anotan" : "anota"}, ${view.queue.online ? "conectados" : "sin red"}`}>
          <span style={{ display: "inline-flex" }}>
            {scorers.map((p) => (
              <span key={p.uid} className="av" style={{ background: colour(p.uid) }}>{initial(p.name)}</span>
            ))}
          </span>
          {view.queue.online ? <i className="ok" /> : <i className="okoff" />}
        </span>
      </div>

      <div className="box">
        <Screws at={10} />
        <div className="glass">
          <div className="sc">
            <div className="side"><span className="crest">MP</span><span className="code">PITI</span></div>
            <div className="dg" role="img" aria-label={`Piti ${match.score.us}, ${match.rival} ${match.score.them}`}>
              <span ref={digitRef} className={live ? "d on" : "d"}>{match.score.us}</span>
              <s>:</s>
              <span ref={digitRef2} className={live ? "d on" : "d"}>{match.score.them}</span>
            </div>
            <div className="side"><span className="crest r">{match.rivalInitials}</span><span className="code r">{match.rivalShort}</span></div>
          </div>
          {live ? (
            <div className="ln flip" role="timer" aria-label="Reloj de la primera parte">
              <span className="half">{match.clock.period === 2 ? "2ª PARTE" : "1ª PARTE"}</span>
              <span className="clk">{match.clock.text}</span>
            </div>
          ) : (
            <div className="ln" role="timer" aria-label={`Cuenta atrás hasta el inicio, previsto a las ${hhmm(match.date)}`}>
              <span className="half">{cd > 0 ? "FALTAN" : "ES LA HORA"}</span>
              <span className="clk">{fmtClock(cd)}</span>
            </div>
          )}
          <div className="prog"><i style={{ width: `${pct}%` }} /></div>
          {kickedAt !== null && live && <span className="shine ice" />}
        </div>
      </div>

      <div className={kickedAt !== null && live ? "pitch flare" : "pitch"} role="group" aria-label={sevenLabel}>
        <div className="cl" style={{ left: 12, right: 12, top: 12, bottom: -2, borderBottom: 0, borderRadius: "4px 4px 0 0" }} />
        <div className="cl" style={{ left: "50%", top: -44, width: 88, height: 88, marginLeft: -44, borderRadius: "50%" }} />
        <div className="cl" style={{ left: "50%", bottom: -2, width: 170, height: 52, marginLeft: -85, borderBottom: 0 }} />
        <span className="spot" style={{ left: "50%", bottom: 36, marginLeft: -2.5 }} />
        <div className="net" />
        {field.map((p, i) => {
          const at = place(p, i);
          return (
            <div key={p.id} className="tok" style={{ left: at.left, top: at.top }}>
              <Shirt n={p.number} keeper={p.keeper} w={40} h={37} />
              <span className="tag"><span className="nm">{p.name}</span></span>
            </div>
          );
        })}
      </div>
      <div className="dug">
        <div className="dhead">
          <b>Banquillo</b>
          <span>{bench.length ? `${WORDS[bench.length] ?? bench.length} en la banda` : "Nadie en la banda"}</span>
        </div>
        <div className="row" role="group" aria-label={bench.length ? `Banquillo: ${listNames(benchNames)}` : "Banquillo vacío"}>
          {bench.map((p) => (
            <div key={p.id} className="bt">
              <Shirt n={p.number} bench w={32} h={29} />
              <span className="nm">{p.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="board">
        <div className="bh"><h1>{heading}</h1><span>{ready} de {items.length}</span></div>
        <div className="well">
          <div className="it">
            <Lamp ok={items[0]} />
            <span className="tx">
              <b>El siete de la pizarra</b>
              <small>{field.length === 7 ? "Siete de siete titulares" : `${field.length} de siete titulares`}</small>
            </span>
            {!live && <button type="button" className="key" onClick={nav.pizarra}>Cambiar</button>}
          </div>
          <div className="it">
            <Lamp ok />
            <span className="tx">
              <b>{bench.length ? `Banda: ${listNames(benchNames)}` : "Sin banquillo"}</b>
              <small>Cambios ilimitados</small>
            </span>
          </div>
          <div className="it">
            <Lamp ok />
            <span className="tx"><b>{whoLine}</b><small>{whoSub}</small></span>
          </div>
          <div className="it">
            <Lamp ok={wake} gold={wake && tested} />
            <span className="tx">
              <b>{wake ? "La pantalla no se apagará" : "La pantalla puede apagarse"}</b>
              {tested ? <small className="yes">{canVibrate() ? "Vibra, sonido listo" : "Sonido listo; este móvil no vibra"}</small> : <small>{wake ? "Vibra al apuntar" : "Toca la pantalla de vez en cuando"}</small>}
            </span>
            {tested ? (
              <span className="latch" role="status"><Check size={14} width={3} />Probado</span>
            ) : (
              <button type="button" className="key probe" onClick={probe}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 003.4 0" /></svg>
                Probar aviso
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="dock">
        {showL3 && kickedAt !== null && (
          <div className="l3 a" role="status">
            <span className="kk">INICIO</span>
            <div className="bar">
              <span className="msg"><b>Pitido inicial a las {hhmm(kickedAt)}, tú</b><small>El reloj ya corre</small></span>
              <button type="button" className="ud" onClick={undo}>Deshacer</button>
            </div>
          </div>
        )}
        {live ? (
          <button type="button" className="cta blow" onClick={nav.mesa}>
            <span>Ir a la mesa</span>
            <i><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFC659" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></i>
          </button>
        ) : (
          <button type="button" className="cta kick" onClick={kick}>
            <span>Pitar el inicio</span>
            <i><Whistle /></i>
          </button>
        )}
      </div>
    </div>
  );
}
