// La mesa (r12) · descanso: how long the break has been, the goals and the duel of the 1ª, «Volver a la 1ª» (M-37),
// «Quién juega la 2ª» with each one's minutes projected and the keeper chosen in his own column (any of the seven:
// B-MESA-02), the changes it makes, «Igualar minutos», the pizarra's own «2ª parte» when the board has one, and
// «Arrancar la 2ª» (the whistle first, then the changes, B-MESA-05).
import type { MesaView } from "../types";
import { mmss, plural, upper } from "./derive";
import { Icon, Shirt } from "./parts";
import type { useBoard } from "./useBoard";

type B = ReturnType<typeof useBoard>;
const count = (v: MesaView, types: string[], us: boolean) => v.events.filter((e) => e.period === 1 && !e.dupOf && types.includes(e.type) && (e.side === "us") === us).length;

export function Descanso({ v, b }: { v: MesaView; b: B }) {
  const c = v.match.clock;
  const h = b.half;
  const firstMin = Math.max(1, Math.ceil(c.elapsedSeconds / 60));
  const halfMin = Math.round(c.halfSeconds / 60);
  const goals = v.events.filter((e) => e.period === 1 && e.goal && !e.dupOf);
  const duel = ([["Ocasiones", ["chance", "opponent_chance"]], ["Al palo", ["woodwork", "opponent_woodwork"]], ["Faltas hechas", ["foul", "opponent_foul"]], ["Córners", ["corner", "opponent_corner"]]] as const).map(([t, types]) => {
    const a = count(v, [...types], true);
    const z = count(v, [...types], false);
    const tot = Math.max(1, a + z);
    return { t, a, z, pa: Math.round((a / tot) * 100), pz: Math.round((z / tot) * 100) };
  });
  const all = [...v.field, ...v.bench];
  const present = v.match.present ?? [];
  // (in the convocatoria's order, as the boards list them: the starters, then the bench)
  const at = (id: string) => {
    const i = v.order.indexOf(id);
    return i < 0 ? v.order.length : i;
  };
  const rows = all.filter((p) => !present.length || present.includes(p.id) || p.played || h.base.includes(p.id) || p.sentOff).sort((a, b) => at(a.id) - at(b.id));
  const ins = h.sel.filter((id) => !h.base.includes(id));
  const name = (id: string) => upper(v.nameOf(id));
  const codeOf = (id: string) => v.field.find((p) => p.id === id)?.pos ?? v.bench.find((p) => p.id === id)?.vacancy?.code ?? null;
  const changes = h.pairs.map((x) => `${name(x.inId)} entra por ${name(x.outId)}${codeOf(x.outId) ? ` · de ${codeOf(x.outId)}` : ""}`);
  if (h.keeper && h.porHolder && h.keeper !== h.porHolder) changes.push(`${name(h.keeper)} se pone de portero · ${name(h.porHolder)} a su sitio`);
  const field7 = h.sel.filter((id) => id !== h.keeper).map((id) => (all.find((p) => p.id === id)?.minutes ?? 0) + (v.match.duration - halfMin));
  const startT = !h.ok ? (h.sel.length !== 7 ? `Elige el siete: ${h.sel.length} de 7` : "Falta portero") : ins.length ? `Arrancar con ${plural(ins.length, "cambio", "cambios")}` : "Arrancar la 2ª parte";
  const second = v.secondHalf;
  return (
    <section className="me-des me-scroll" aria-labelledby="me-de-h">
      <header className="me-sh vd-reg-2">
        <p className="me-k">parados {mmss(c.breakSeconds)}</p>
        <h1 className="me-h1" id="me-de-h">Descanso · la 1ª acabó en el {firstMin}′</h1>
        {goals.length > 0 && (
          <p className="me-des__goals" aria-label="Los goles de la 1ª">
            {goals.map((g) => <span key={g.id} className={`me-gl ${g.goal === "us" ? "is-us" : "is-them"}`}>{g.minute}′ {g.goal === "us" ? (g.playerName ? upper(g.playerName) : "Piti") : v.match.rivalShort}</span>)}
          </p>
        )}
      </header>
      <div className="me-des__grid">
        <section className="me-des__duel vd-reg-3" aria-labelledby="me-du-t">
          <h2 className="me-h3" id="me-du-t">El duelo de la 1ª</h2>
          <table className="me-duel">
            <thead><tr><th scope="col">PITI</th><th scope="col"><span className="vd-vh">Qué</span></th><th scope="col">{v.match.rivalShort}</th></tr></thead>
            <tbody>
              {duel.map((d) => (
                <tr key={d.t}>
                  <td className="me-duel__a"><span className="me-duel__bar is-us" style={{ width: `${d.pa}%` }} /><b>{d.a}</b></td>
                  <th scope="row">{d.t}</th>
                  <td className="me-duel__b"><b>{d.z}</b><span className="me-duel__bar is-them" style={{ width: `${d.pz}%` }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm me-des__back1" onClick={() => b.clockAct("resume_first")} aria-busy={b.busy === "clock"}>{b.confirmK === "resume_first" ? "¿Seguro? Toca otra vez" : "Volver a la 1ª"}</button>
        </section>

        <section className="me-des__who vd-reg-4" aria-labelledby="me-dw-t">
          <div className="me-sec__h"><h2 className="me-h3" id="me-dw-t">Quién juega la 2ª</h2><span className="me-sec__n">{h.sel.length} de 7</span></div>
          <p className="me-small">Toca para meter o sacar del siete. El portero se elige en su columna: puede ser cualquiera de los siete.</p>
          {second && (
            <p className="me-des__board"><button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={b.boardSecond}>El siete de la pizarra · 2ª parte</button></p>
          )}
          <ul className="me-rows">
            {rows.map((p) => {
              const on = h.sel.includes(p.id);
              const kp = h.keeper === p.id;
              const st = p.stints.filter((s) => s.from < c.elapsedSeconds).map((s) => `${Math.floor(s.from / 60)}–${s.to == null ? firstMin : Math.ceil(s.to / 60)}′`).join(", ");
              const nm = upper(p.name);
              return (
                <li key={p.id} className={`me-dr${on ? " is-in" : ""}${p.sentOff ? " is-gone" : ""}`}>
                  <button type="button" className="me-dr__b" aria-pressed={on} onClick={() => !p.sentOff && b.toggleHalf(p.id)} aria-disabled={p.sentOff} aria-label={`${p.name}${on ? ", juega la 2ª" : ", no juega la 2ª"}: toca para ${on ? "sacarlo" : "meterlo"} del siete`}>
                    <span className="me-li__chk" aria-hidden="true" />
                    <Shirt kit={v.match.kit} num={p.guest ? undefined : p.number} className="me-shirt--xs" />
                    <span className="me-row__t"><b>{nm}</b><span>{p.sentOff ? "expulsado" : st ? `jugó ${st}` : "sin jugar en la 1ª"}</span></span>
                    <span className="me-dr__p me-num" aria-hidden="true">{on ? `${p.minutes}′ → ${p.minutes + (v.match.duration - halfMin)}′` : `${p.minutes}′`}</span>
                  </button>
                  {on && !p.sentOff && <button type="button" className="me-dr__k" aria-pressed={kp} onClick={() => b.keeperHalf(p.id)} aria-label={`Portero en la 2ª: ${p.name}`}>POR</button>}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="me-des__ch vd-reg-5" aria-labelledby="me-dc-t">
          <h2 className="me-h3" id="me-dc-t">Los cambios</h2>
          {changes.length ? (
            <ul className="me-rows">{changes.map((t) => <li key={t} className="me-row"><span className="me-row__t"><b>{t}</b></span></li>)}</ul>
          ) : (
            <p className="me-small">Sigue el mismo siete en los mismos sitios.</p>
          )}
          {field7.length > 0 && <p className="me-small me-des__spread">Jugadores de campo: de {Math.min(...field7)}′ a {Math.max(...field7)}′</p>}
        </section>
      </div>
      <div className="me-kick me-primary me-primary--pin vd-reg-6">
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={b.fair}>Igualar minutos</button>
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri me-kick__b" onClick={b.startSecond} aria-disabled={!h.ok || b.busy === "second"} aria-busy={b.busy === "second"}>
          <Icon name="whistle" />{b.busy === "second" ? "Arrancando…" : startT}
        </button>
      </div>
    </section>
  );
}
