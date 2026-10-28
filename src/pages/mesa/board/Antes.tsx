// La mesa (r12) · antes del pitido: the seven on the pitch, «Todo listo para pitar» with what it still needs (the
// seven, the roll call, the keeper), the touchline («+ Invitado», «Añadir anotador», «Probar aviso») and «Pitar el
// inicio» in the thumb zone; and «¿Quién ha venido?», the roll call with each one's answer, position and form.
import type { CSSProperties } from "react";
import type { MesaView } from "../types";
import { useLlegada } from "../useLlegada";
import { rollRows, type Convocado } from "../screens/llegadaModel";
import { beep, buzz } from "../screens/hooks";
import { antesChecks, benchRows, dayText, leftText, lenCls, listOf, pitchTokens, timeText, upper } from "./derive";
import { Icon, Shirt } from "./parts";
import type { useBoard } from "./useBoard";

type B = ReturnType<typeof useBoard>;

function StillPitch({ v }: { v: MesaView }) {
  const tokens = pitchTokens(v.field, []);
  return (
    <div className="me-pitch me-pitch--still vd-pitch" role="img" aria-label={`El siete: ${v.field.map((p) => upper(p.name)).join(", ") || "por decidir"}`}>
      <svg className="vd-pitch__lines" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect x="3" y="3" width="94" height="134" rx="2" /><line x1="3" y1="70" x2="97" y2="70" /><circle cx="50" cy="70" r="11" /><rect x="28" y="3" width="44" height="17" /><rect x="28" y="120" width="44" height="17" /></svg>
      {tokens.map((t) => {
        const name = upper(t.player.name);
        return (
          <span key={t.id} className="me-man me-man--still" style={{ "--nx": t.nx, "--ny": t.ny } as CSSProperties}>
            <Shirt kit={v.match.kit} num={t.player.guest ? undefined : t.player.number} className="me-man__shirt" />
            <span className={`me-man__n ${lenCls(name)}`.trim()}>{name}</span>
            <span className="me-man__m">{t.code ?? ""}</span>
          </span>
        );
      })}
    </div>
  );
}

export function Antes({ v, b, now }: { v: MesaView; b: B; now: number }) {
  const m = v.match;
  const checks = antesChecks(v);
  const bad = checks.filter((x) => !x.ok).length;
  const seven = v.field.length === 7;
  const bench = benchRows(v).map((x) => upper(x.player.name));
  const others = v.scorers.filter((s) => s.uid !== v.me.uid).map((s) => s.name);
  const scorers = others.length ? `${v.me.name} (tú) y ${listOf(others)} anotan · veis lo mismo al instante` : `${v.me.name} (tú) · anotas tú`;
  const head = [m.date > now ? `Faltan ${leftText(m.date, now)}` : "Es la hora", `${dayText(m.date)} ${timeText(m.date)}`.trim(), m.venue].filter(Boolean).join(" · ");
  const guests = m.guests;
  const kickBusy = b.busy === "kick";
  const why = !seven ? "Primero el siete: elígelo en la pizarra" : !b.online ? "Sin red: el pitido necesita conexión" : "Un toque: el reloj empieza y el club recibe «¡Empieza el partido!»";
  return (
    <section className="me-antes me-scroll" aria-labelledby="me-an-h">
      <div className="me-antes__a vd-reg-2">
        <header className="me-sh">
          <p className="me-k">{head}</p>
          <h1 className="me-h1" id="me-an-h">{bad ? "Casi listo para pitar" : "Todo listo para pitar"}</h1>
          <p className="me-small">{bad ? `Falta ${bad} de 3` : "3 de 3"}</p>
        </header>
        <StillPitch v={v} />
      </div>
      <div className="me-antes__b vd-reg-3">
        <ul className="me-rows me-checks" aria-label="Lo que hace falta para pitar">
          {checks.map((x) => (
            <li key={x.t} className="me-row me-check">
              <span className="me-row__t"><b>{x.t}</b><span>{x.s}</span></span>
              <span className={`me-tag ${x.ok ? "me-tag--hecho" : "me-tag--toca"}`}>{x.ok ? "Listo" : "Falta"}</span>
            </li>
          ))}
        </ul>
        <div className="me-btnrow me-antes__btns">
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => b.setLista(true)}><Icon name="list" />¿Quién ha venido?</button>
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => v.nav.pizarra(m.officialBoard ?? null)}>Elegir el siete en la pizarra ↗</button>
        </div>
        <ul className="me-rows me-info" aria-label="La banda y la mesa">
          <li className="me-row">
            <span className="me-row__t"><b>{bench.length ? `Banda: ${listOf(bench)} · cambios ilimitados` : "Sin banquillo · cambios ilimitados"}</b><span>{guests ? `${guests === 1 ? "Un invitado" : `${guests} invitados`} en el partido` : "Sin invitados"}</span></span>
            {guests < 4 && <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => b.openSheet("invitado")} aria-haspopup="dialog">+ Invitado</button>}
          </li>
          <li className="me-row">
            <span className="me-row__t"><b>Quién anota</b><span>{scorers}</span></span>
            {v.me.admin && <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => b.openSheet("anotador")} aria-haspopup="dialog">Añadir anotador</button>}
          </li>
          <li className="me-row">
            <span className="me-row__t"><b>Este móvil</b><span>La pantalla no se apagará · vibra al apuntar</span></span>
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => { buzz([40, 60, 140]); beep(880, 140); b.say("Probado", "Vibra y suena en este móvil (no manda nada al club) · la pantalla no se apagará"); }}>Probar aviso</button>
          </li>
        </ul>
      </div>
      <div className="me-kick me-primary me-primary--pin vd-reg-4">
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri me-kick__b" onClick={b.kickOff} aria-busy={kickBusy} aria-disabled={!seven || kickBusy} aria-describedby="me-kick-why">
          <Icon name="whistle" />{kickBusy ? "Pitando…" : "Pitar el inicio"}
        </button>
        <p className="me-small me-kick__why" id="me-kick-why">{why}</p>
      </div>
    </section>
  );
}

export function Lista({ v, b }: { v: MesaView; b: B }) {
  const called: Convocado[] = [...v.field, ...v.bench].filter((p, i, a) => a.findIndex((q) => q.id === p.id) === i).map((p) => ({ id: p.id, name: p.name, number: p.number, guest: p.guest }));
  const data = useLlegada(v.match.id, v.match.seasonId, v.match.present ?? null, called.map((p) => p.id));
  const here = new Set(data.present);
  const { main, rest } = rollRows(called, data.squad, data.conv, here);
  const count = called.filter((p) => here.has(p.id)).length;
  const keeperHere = [...main, ...rest].some((r) => r.here && r.keeper);
  const saving = data.save === "saving" ? "Guardando…" : data.save === "saved" ? "Guardado" : data.save === "error" ? data.error : "";
  const note = count < 7 ? `Faltan ${7 - count} para el siete` : !keeperHere ? "Ojo: no ha venido ningún portero" : `${count} para elegir · ${count - 7} al banquillo`;
  const byId = new Map(called.map((p) => [p.id, p]));
  const row = (r: (typeof main)[number]) => {
    const p = byId.get(r.id);
    return (
      <li key={r.id}>
        <button type="button" className={`me-row me-row--btn me-li${r.here ? " is-here" : ""}`} aria-pressed={r.here} onClick={() => { buzz(15); data.toggle(r.id); }} aria-label={r.aria}>
          <span className="me-li__l">
            <span className="me-li__chk" aria-hidden="true" />
            <Shirt kit={v.match.kit} num={p?.guest ? undefined : p?.number} className="me-shirt--s" />
            <span className="me-row__t"><b>{upper(r.name)}</b><span>{r.line}</span></span>
          </span>
          <span className="me-li__r" aria-hidden="true">
            {r.pos !== "—" && <i className="me-code">{r.pos}</i>}
            <span className="me-form">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= r.form.level ? "is-on" : undefined} />)}</span>
            <small>{r.form.word}</small>
          </span>
        </button>
      </li>
    );
  };
  return (
    <section className="me-lista me-scroll" aria-labelledby="me-li-h">
      <header className="me-sh vd-reg-2">
        <p className="me-k">{count} han venido de {called.length} convocados</p>
        <h1 className="me-h1" id="me-li-h">¿Quién ha venido?</h1>
        <p className="me-lede">Toca a cada uno según llega. La forma y su sitio te ayudan a elegir el siete.</p>
        {saving && <p className={`me-small me-saving${data.save === "error" ? " is-bad" : ""}`} role="status">{saving}{data.save === "error" && <> · <button type="button" className="vd-link" onClick={data.retry}>Reintentar</button></>}</p>}
      </header>
      <div className="me-lista__b vd-reg-3">
        <ul className="me-rows" aria-label="Dijeron que vienen o duda">{main.map(row)}</ul>
        {rest.length > 0 && (
          <>
            <h2 className="me-h3 me-lista__sep">Dijeron que no o no contestaron</h2>
            <ul className="me-rows">{rest.map(row)}</ul>
          </>
        )}
        {v.match.guests < 4 && <p className="me-lista__guest"><button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => b.openSheet("invitado")} aria-haspopup="dialog">+ Invitado</button></p>}
      </div>
      <div className="me-kick me-primary me-primary--pin vd-reg-4">
        <p className={`me-kick__note${count < 7 || !keeperHere ? " is-bad" : ""}`}>{note}</p>
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri me-kick__b" onClick={() => v.nav.pizarra(v.match.officialBoard ?? null)}>Elegir el siete en la pizarra ↗</button>
      </div>
    </section>
  );
}
