// La mesa (r12) · the sheets: on the phone they come up from the bottom over a scrim, on the desktop they sit at the
// side. The player's sheet (M-32: under the thumb, with «En propia», «Gol de penalti» and «Gol de falta»), more of
// ours, more of theirs, the clock (pause, stoppage time, the end of the half, «Deshacer el inicio de la 2ª» and the
// match's length: M-37, M-48), «Por revisar», «Corregir» (its error inside: B-MESA-04), «Añadir anotador» and
// «+ Invitado» (M-36). Focus goes to the sheet's first control; Esc closes it.
import { useEffect, useRef, type ReactNode } from "react";
import { MESA_TYPES } from "../../../../functions/src/liveRules";
import { TYPE_NAME } from "../screens/model";
import type { MesaType, MesaView } from "../types";
import { galonesText, upper, whyNot } from "./derive";
import { Icon, Shirt } from "./parts";
import { placeWord, type useBoard } from "./useBoard";

type B = ReturnType<typeof useBoard>;

const FAMILIES: readonly (readonly MesaType[])[] = [
  ["goal", "goal_penalty", "goal_freekick"],
  ["chance", "woodwork", "save", "foul", "foul_received", "injury", "corner", "penalty_missed", "penalty_saved", "penalty_received", "penalty_committed"],
  ["yellow_card", "double_yellow", "red_card"],
  ["opponent_goal", "opponent_chance", "opponent_corner", "opponent_foul", "opponent_woodwork", "opponent_offside", "opponent_penalty_missed"],
  ["opponent_yellow", "opponent_red"],
  ["own_goal", "opponent_own_goal"],
];
const familyOf = (t: MesaType) => FAMILIES.find((f) => f.includes(t)) ?? [t];
const KNOWN = new Set<string>(MESA_TYPES);

function Frame({ title, kicker, onClose, children, foot, head }: { title: string; kicker?: string; onClose: () => void; children: ReactNode; foot?: ReactNode; head?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // (the first control of the sheet takes the focus: A-MESA-22)
    const el = ref.current?.querySelector<HTMLElement>(".me-sheet__b button:not([aria-disabled='true']), .me-sheet__b input, .me-sheet__b select, .me-sheet__b textarea");
    el?.focus({ preventScroll: true });
  }, []);
  return (
    <div ref={ref} className="me-sheet vd-glass vd-glass--deep" role="dialog" aria-modal="true" aria-labelledby="me-sheet-t">
      <div className="me-sheet__grab" aria-hidden="true" />
      <header className="me-sheet__h me-psh">
        {head}
        <div className="me-psh__t">
          {kicker && <p className="me-k">{kicker}</p>}
          <h2 className="me-h3" id="me-sheet-t">{title}</h2>
        </div>
        <button type="button" className="vd-ibtn vd-glass vd-press" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
      </header>
      <div className="me-sheet__b">{children}</div>
      {foot && <footer className="me-sheet__f">{foot}</footer>}
    </div>
  );
}

function Btn({ t, go, cls = "", why = "" }: { t: string; go: () => void; cls?: string; why?: string }) {
  return (
    <button type="button" className={`vd-btn vd-glass vd-press me-gbtn ${cls}`.trim()} onClick={go} aria-disabled={!!why} title={why || undefined}>{t}</button>
  );
}

function Jugador({ v, b }: { v: MesaView; b: B }) {
  const p = v.field.find((x) => x.id === b.sel);
  if (!p) return null;
  const pid = p.id;
  const w = (t: MesaType) => whyNot(v, t);
  const act = (t: MesaType, go: () => void) => () => (w(t) ? b.fail(w(t)) : go());
  const gal = galonesText(v, pid);
  const head = <Shirt kit={v.match.kit} num={p.guest ? undefined : p.number} className="me-shirt--s" />;
  const sub = [p.keeper ? "portero" : placeWord(p.pos), `${p.minutes}′ jugados`, `minuto ${v.match.clock.minute}`, gal].filter(Boolean).join(" · ");
  return (
    <Frame title={upper(p.name)} kicker={undefined} onClose={b.closeSheet} head={head}>
      <p className="me-small me-psh__sub">{sub}</p>
      {v.match.clock.held && <p className="me-small me-note">En pausa: solo cambios, tarjetas y tocados.</p>}
      {b.sub !== "tarjeta" ? (
        <div className="me-grid" role="group" aria-label={`Acciones de ${p.name}`}>
          <Btn t="Gol" cls="is-gold" go={act("goal", () => b.golTo(pid))} why={w("goal")} />
          <Btn t="Pase de gol" go={act("goal", () => b.assistLast(pid))} why={w("goal")} />
          <Btn t="Ocasión" go={act("chance", () => b.play("chance", pid))} why={w("chance")} />
          <Btn t="Al palo" go={act("woodwork", () => b.play("woodwork", pid))} why={w("woodwork")} />
          <Btn t="Falta hecha" go={act("foul", () => b.play("foul", pid))} why={w("foul")} />
          <Btn t="Le hacen falta" go={act("foul_received", () => b.play("foul_received", pid))} why={w("foul_received")} />
          <Btn t="Tarjeta" go={act("yellow_card", () => b.setSub("tarjeta"))} why={w("yellow_card")} />
          <Btn t="Cambio" go={act("substitution", () => { b.closeSheet(); b.setMode({ k: "outFrom", pid }); })} why={w("substitution")} />
          <Btn t="Cambiar de sitio" go={act("position_swap", () => b.swapStart(pid))} why={w("position_swap")} />
          {p.keeper ? <Btn t="Parada" go={act("save", () => b.play("save", pid))} why={w("save")} /> : <Btn t="Tocado" go={act("injury", () => b.play("injury", pid))} why={w("injury")} />}
          <Btn t="Penalti a favor" go={act("penalty_received", () => b.play("penalty_received", pid))} why={w("penalty_received")} />
          <Btn t="Penalti en contra" go={act("penalty_committed", () => b.play("penalty_committed", pid))} why={w("penalty_committed")} />
          <Btn t="Gol de penalti" go={act("goal_penalty", () => b.golTo(pid, "goal_penalty"))} why={w("goal_penalty")} />
          <Btn t="Gol de falta" go={act("goal_freekick", () => b.golTo(pid, "goal_freekick"))} why={w("goal_freekick")} />
          <Btn t="Penalti fallado" go={act("penalty_missed", () => b.play("penalty_missed", pid))} why={w("penalty_missed")} />
          <Btn t="En propia" cls="is-them" go={act("own_goal", () => b.play("own_goal", pid))} why={w("own_goal")} />
        </div>
      ) : (
        <>
          <p className="me-k">Tarjeta a {upper(p.name)}</p>
          <div className="me-grid me-grid--3" role="group" aria-label="Tarjeta">
            <Btn t={p.stickers.yellow ? "Amarilla (la 2ª: expulsado)" : "Amarilla"} cls="is-am" go={act("yellow_card", () => b.play("yellow_card", pid))} why={w("yellow_card")} />
            <Btn t="Roja" cls="is-roja" go={act("red_card", () => b.play("red_card", pid))} why={w("red_card")} />
            <Btn t="Volver" go={() => b.setSub("")} />
          </div>
        </>
      )}
    </Frame>
  );
}

function Mas({ v, b }: { v: MesaView; b: B }) {
  const items: [string, () => void][] = [
    ["Ocasión", () => b.pickFor("chance")], ["Al palo", () => b.pickFor("woodwork")], ["Le hacen falta", () => b.pickFor("foul_received")],
    ["Córner nuestro", () => b.play("corner")], ["Penalti a favor", () => b.pickFor("penalty_received")], ["Penalti en contra", () => b.pickFor("penalty_committed")],
    ["Gol de penalti", () => b.pickFor("goal_penalty")], ["Gol de falta", () => b.pickFor("goal_freekick")], ["Penalti fallado", () => b.pickFor("penalty_missed")],
    ["En propia (nuestro)", () => b.pickFor("own_goal")], ["Tocado", () => b.pickFor("injury")], ["Recolocar", () => b.swapStart(null)],
    ["Ver la crónica", () => { b.closeSheet(); v.nav.cronica(); }],
  ];
  return (
    <Frame title="Más jugadas del Piti" onClose={b.closeSheet}>
      <p className="me-small me-note">Las de un jugador te piden después su camiseta en el campo.</p>
      <div className="me-grid">{items.map(([t, go]) => <Btn key={t} t={t} go={go} />)}</div>
    </Frame>
  );
}

function Rival({ v, b }: { v: MesaView; b: B }) {
  const keeper = v.field.find((p) => p.keeper);
  const items: [string, () => void][] = [
    ["Ocasión suya", () => b.play("opponent_chance")], ["Amarilla suya", () => b.play("opponent_yellow")], ["Roja suya", () => b.play("opponent_red")],
    ["Fuera de juego", () => b.play("opponent_offside")], ["Fallan su penalti", () => b.play("opponent_penalty_missed")],
  ];
  if (keeper) items.push([`Penalti parado (${upper(keeper.name)})`, () => b.play("penalty_saved", keeper.id)]);
  return (
    <Frame title={`Otra jugada de ${v.match.rivalShort}`} onClose={b.closeSheet}>
      <div className="me-grid">{items.map(([t, go]) => <Btn key={t} t={t} go={go} />)}</div>
    </Frame>
  );
}

function Reloj({ v, b }: { v: MesaView; b: B }) {
  const c = v.match.clock;
  const second = c.phase === "second";
  const lim = second ? v.match.duration : Math.round(c.halfSeconds / 60);
  const due = (second ? c.elapsedSeconds : c.periodSeconds) >= lim * 60;
  const endK = second ? "end" : "half";
  const undo2 = second && b.status?.undo?.k === "second";
  return (
    <Frame title={`El reloj · ${c.text} · ${second ? "2ª parte" : "1ª parte"}`} onClose={b.closeSheet}>
      <div className="me-reloj">
        <button type="button" className="vd-btn vd-glass vd-press me-wide" onClick={() => b.clockAct("pause")} aria-pressed={c.held} aria-busy={b.busy === "clock"}><Icon name="pause" />{c.held ? "Seguir" : "Pausa"}</button>
        <div className="me-step" role="group" aria-label="Añadido de esta parte">
          <span className="me-step__l">Añadido</span>
          <button type="button" className="vd-ibtn vd-glass vd-press" onClick={() => b.clockAct("add-")} aria-label="Un minuto menos de añadido"><Icon name="minus" /></button>
          <b className="me-step__v">+{c.added}′</b>
          <button type="button" className="vd-ibtn vd-glass vd-press" onClick={() => b.clockAct("add+")} aria-label="Un minuto más de añadido"><Icon name="plus" /></button>
        </div>
        {due && <p className="me-small me-note">La parte ya llega a su {lim}′</p>}
        <button type="button" className={`vd-btn vd-glass vd-press me-wide me-end${b.confirmK === endK ? " is-sure" : ""}`} onClick={() => b.clockAct(endK)}>{b.confirmK === endK ? "¿Seguro? Toca otra vez" : second ? "Fin del partido" : "Fin de la 1ª"}</button>
        {undo2 && <button type="button" className="vd-btn vd-glass vd-press me-wide" onClick={b.undo}>Deshacer el inicio de la 2ª</button>}
        <div className="me-step" role="group" aria-label="Duración del partido">
          <span className="me-step__l">Duración <small>fija el «Fin» sugerido y la barra</small></span>
          <button type="button" className="vd-ibtn vd-glass vd-press" onClick={() => b.setDuration(v.match.duration - 2)} aria-label="Dos minutos menos" aria-disabled={v.match.duration <= 10 || b.busy === "dur"}><Icon name="minus" /></button>
          <b className="me-step__v">{v.match.duration}′</b>
          <button type="button" className="vd-ibtn vd-glass vd-press" onClick={() => b.setDuration(v.match.duration + 2)} aria-label="Dos minutos más" aria-disabled={v.match.duration >= 150 || b.busy === "dur"}><Icon name="plus" /></button>
        </div>
      </div>
    </Frame>
  );
}

function Revisar({ v, b }: { v: MesaView; b: B }) {
  const lim = v.match.clock.phase === "second" ? v.match.duration : Math.round(v.match.clock.halfSeconds / 60);
  const mins = b.ui.reviewMin;
  return (
    <Frame title="Por revisar" onClose={b.closeSheet}>
      {!v.queue.review.length && <p className="me-small">Nada por revisar: la bandeja está vacía.</p>}
      <ul className="me-rows">
        {v.queue.review.map((x) => {
          const m = mins[x.requestId] ?? x.minute;
          return (
            <li key={x.requestId} className="me-rv">
              <p className="me-rv__t"><b>{m}′ · {x.text}</b><span>{x.reason}</span></p>
              <div className="me-step" role="group" aria-label={`Minuto de la jugada: ${m}`}>
                <span className="me-step__l">Minuto</span>
                <button type="button" className="vd-ibtn vd-glass vd-press" onClick={() => b.setUi({ reviewMin: { ...mins, [x.requestId]: Math.max(1, m - 1) } })} aria-label="Un minuto menos"><Icon name="minus" /></button>
                <b className="me-step__v">{m}′</b>
                <button type="button" className="vd-ibtn vd-glass vd-press" onClick={() => b.setUi({ reviewMin: { ...mins, [x.requestId]: Math.min(Math.max(1, v.match.clock.minute), m + 1) } })} aria-label="Un minuto más"><Icon name="plus" /></button>
              </div>
              <div className="me-btnrow">
                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => { v.actions.discard(x.requestId); b.say("Descartada", `${x.text} · no se sube`); }}>Descartar</button>
                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm vd-btn--pri" onClick={() => {
                  if (m > Math.min(lim + 15, Math.max(1, v.match.clock.minute))) return b.fail(`El minuto ${m} sigue fuera del tiempo de juego: bájalo antes de reenviar.`);
                  v.actions.resend(x.requestId, { minute: m });
                  b.say("Reenviada", `${x.text}, minuto ${m}`);
                }}>Reenviar</button>
              </div>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}

function Editar({ v, b }: { v: MesaView; b: B }) {
  const d = b.ui.edit;
  if (!d) return null;
  const e = v.events.find((x) => x.id === d.id);
  const fam = familyOf(d.type).filter((t) => KNOWN.has(t));
  const set = (p: Partial<typeof d>) => b.setUi({ edit: { ...d, ...p }, editErr: "" });
  const called = [...v.field, ...v.bench];
  const opts = called.map((p) => <option key={p.id} value={p.id}>{p.number ? `${p.number} ` : ""}{upper(p.name)}</option>);
  const rival = d.type.startsWith("opponent_");
  const hasWho = !rival;
  const hasIn = d.type === "substitution";
  const hasA = d.type === "goal" || d.type === "goal_freekick" || d.type === "position_swap";
  const maxMin = Math.max(1, v.match.clock.phase === "ended" ? Math.ceil(v.match.clock.elapsedSeconds / 60) : v.match.clock.minute);
  return (
    <Frame title={e?.text ?? "Esa jugada"} kicker={`Corregir, minuto ${d.min0}`} onClose={b.closeSheet}
      foot={<>
        <button type="button" className="vd-btn vd-glass vd-press me-del" onClick={() => b.remove(d.id)}><Icon name="trash" />Borrar</button>
        <button type="button" className="vd-btn vd-glass vd-press" onClick={b.closeSheet}>Cancelar</button>
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" onClick={() => void b.editSave()}>Guardar</button>
      </>}>
      <div className="me-edit">
        {fam.length > 1 && (
          <div className="me-edit__f" role="group" aria-label="Qué fue">
            <span className="me-edit__l">Qué fue</span>
            <div className="me-chips">{fam.map((t) => <button key={t} type="button" className="me-chip vd-glass vd-press" aria-pressed={d.type === t} onClick={() => set({ type: t, ...(t === "opponent_own_goal" ? { p: null, a: null } : {}) })}>{TYPE_NAME[t]}</button>)}</div>
          </div>
        )}
        {hasWho && d.type !== "opponent_own_goal" && (
          <label className="me-field"><span>{d.type === "substitution" ? "Sale" : d.type === "position_swap" ? "Se cambia de sitio" : "Quién"}</span>
            <select className="vd-input" value={d.p ?? ""} onChange={(x) => set({ p: x.target.value || null })}>{d.type === "corner" || d.type === "penalty_received" || d.type === "penalty_committed" || d.type === "goal" ? <option value="">Nadie</option> : null}{opts}</select>
          </label>
        )}
        {hasIn && (
          <label className="me-field"><span>Entra</span><select className="vd-input" value={d.inP ?? ""} onChange={(x) => set({ inP: x.target.value || null })}>{opts}</select></label>
        )}
        {hasA && (
          <label className="me-field"><span>{d.type === "position_swap" ? "Con" : "Pase de"}</span>
            <select className="vd-input" value={d.type === "position_swap" ? d.inP ?? "" : d.a ?? ""} onChange={(x) => (d.type === "position_swap" ? set({ inP: x.target.value || null }) : set({ a: x.target.value || null }))}><option value="">Nadie</option>{opts}</select>
          </label>
        )}
        <div className="me-step" role="group" aria-label="Minuto">
          <span className="me-step__l">Minuto</span>
          <button type="button" className="vd-ibtn vd-glass vd-press" onClick={() => set({ min: Math.max(1, d.min - 1) })} aria-label="Un minuto menos"><Icon name="minus" /></button>
          <b className="me-step__v">{d.min}′</b>
          <button type="button" className="vd-ibtn vd-glass vd-press" onClick={() => set({ min: Math.min(maxMin, d.min + 1) })} aria-label="Un minuto más"><Icon name="plus" /></button>
        </div>
        {b.ui.editErr && <p className="me-err" role="alert">{b.ui.editErr}</p>}
      </div>
    </Frame>
  );
}

function Anotador({ v, b }: { v: MesaView; b: B }) {
  return (
    <Frame title="Añadir anotador" onClose={b.closeSheet}>
      <p className="me-small me-note">Quien añadas anota este partido desde su móvil y ve lo mismo al instante (hasta 12).</p>
      <div className="me-grid">{v.scorerOptions.map((o) => <Btn key={o.uid} t={o.name} go={() => void b.addScorer(o.uid, o.name)} />)}</div>
      {!v.scorerOptions.length && <p className="me-small">Ya anotan todos los que tienen cuenta.</p>}
    </Frame>
  );
}

function Invitado({ b }: { b: B }) {
  return (
    <Frame title="+ Invitado" onClose={b.closeSheet}
      foot={<>
        <button type="button" className="vd-btn vd-glass vd-press" onClick={b.closeSheet}>Cancelar</button>
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" onClick={b.addGuest} aria-busy={b.busy === "guest"}>Añadir a la lista</button>
      </>}>
      <p className="me-small me-note">Llega uno a la banda: entra en la lista y en el banquillo de este partido (hasta 4 invitados).</p>
      <label className="me-field me-edit__f"><span>Su nombre</span>
        <input className="vd-input" type="text" maxLength={30} value={b.ui.guest} onChange={(e) => b.setUi({ guest: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") b.addGuest(); }} placeholder="Rafa" autoComplete="off" />
      </label>
    </Frame>
  );
}

export function Sheets({ v, b }: { v: MesaView; b: B }) {
  const h = b.hoja;
  if (!h) return null;
  return (
    <>
      <button type="button" className="me-scrim" onClick={b.closeSheet} aria-label="Cerrar" tabIndex={-1} />
      {h === "jugador" && <Jugador v={v} b={b} />}
      {h === "mas" && <Mas v={v} b={b} />}
      {h === "rival" && <Rival v={v} b={b} />}
      {h === "reloj" && <Reloj v={v} b={b} />}
      {h === "revisar" && <Revisar v={v} b={b} />}
      {h === "editar" && <Editar v={v} b={b} />}
      {h === "anotador" && <Anotador v={v} b={b} />}
      {h === "invitado" && <Invitado b={b} />}
    </>
  );
}
