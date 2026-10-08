// The «Acta» tab: the score (± with the number roll) always equal to the goals written down; «Goles del
// Piti» (editable minute, scorer, assist, «Elegir») with the «¿Quién marcó?» picker anchored to the row
// (adding a goal opens it; removing a named goal asks inline); the rival's goals; «Otros eventos» (every
// other kind, «+ Añadir» by type, edit / remove inline); and, on the right, «La cuenta» and «¿Cuadra?».
import { useLayoutEffect, useRef, useState } from "react";
import { EVENT_LABELS, type EventType, type MatchEvent } from "../../../../functions/src/matchEngine";
import type { ActaReview } from "../data/adminLogic";
import type { MatchTab } from "../shell/nav";
import { AdIcon } from "../ui/icons";
import { calledUp } from "../acta/convocatoria";
import {
  addOurGoal,
  addRivalGoal,
  goalRows,
  lastOurGoal,
  lastRivalGoal,
  newId,
  otherEvents,
  removeEvent,
  rivalInitialsOf,
  rivalRows,
  score,
  setAssist,
  setMinute,
  setScorer,
  upsertEvent,
  type GoalRow,
  type MatchSheet,
} from "../acta/sheetModel";
import { EventForm } from "./EventForm";
import { OTHER_TYPES, pickOptions } from "./pickModel";
import { ScorerPicker } from "./ScorerPicker";
import { useFrame } from "../ui/frame";

export interface PlayerInfo {
  name: string;
  number: number | null;
  position: string;
}
export interface TabActaProps {
  sheet: MatchSheet;
  update: (f: (s: MatchSheet) => MatchSheet) => void;
  review: ActaReview;
  rival: string;
  /** «J7». */
  j: string;
  /** The season's squad ids, by dorsal (the picker's order). */
  rosterOrder: string[];
  info: (id: string) => PlayerInfo;
  onGoTab: (tab: MatchTab) => void;
}

type Pick = { id: string; step: "s" | "a" } | null;
type Remove = { side: "ours" | "theirs"; id: string } | null;
type Editing = { event: MatchEvent; isNew: boolean } | null;

const CARD = new Set(["yellow_card", "double_yellow", "red_card"]);
function EventIcon({ type }: { type: string }) {
  if (CARD.has(type)) return <i className={`cardy${type === "yellow_card" ? "" : " ad-red"}`} aria-hidden="true" />;
  if (type === "substitution") return <AdIcon name="swap" size={16} />;
  if (type === "woodwork" || type === "goal_penalty" || type === "goal_freekick" || type === "own_goal") return <AdIcon name="ball" size={16} />;
  return <AdIcon name="glove" size={16} />;
}

export function TabActa({ sheet, update, review, rival, j, rosterOrder, info, onGoTab }: TabActaProps) {
  const { desktop } = useFrame();
  const [pick, setPick] = useState<Pick>(null);
  const [rm, setRm] = useState<Remove>(null);
  const [roll, setRoll] = useState({ f: 0, a: 0 });
  const [editing, setEditing] = useState<Editing>(null);
  const [addType, setAddType] = useState<EventType>("yellow_card");
  const anchorRef = useRef<HTMLButtonElement>(null);
  const minusRef = useRef<HTMLButtonElement>(null);
  const focusMinute = useRef<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const rows = goalRows(sheet);
  const rivals = rivalRows(sheet);
  const others = otherEvents(sheet);
  const { gf, ga } = score(sheet);
  const lineup = { starters: sheet.starters, bench: sheet.bench, notCalled: sheet.notCalled };
  const called = calledUp(lineup, rosterOrder);
  const calledNames = called.map((c) => ({ id: c.id, name: info(c.id).name }));
  const nameOf = (id: string | null | undefined) => (id ? info(id).name : "—");
  const active = pick ? rows.find((r) => r.id === pick.id) : undefined;
  const pickOpen = !!(pick && active);

  // Focus a minute box that was just added (a rival goal).
  useLayoutEffect(() => {
    const id = focusMinute.current;
    if (!id) return;
    focusMinute.current = null;
    const box = Array.from(mainRef.current?.querySelectorAll<HTMLInputElement>("input[data-minute]") ?? []).find((x) => x.dataset.minute === id);
    box?.focus();
  });

  const gfUp = () => {
    const id = newId();
    update((s) => addOurGoal(s, "goal", id).sheet);
    setRoll((r) => ({ ...r, f: r.f + 1 }));
    setRm(null);
    setPick({ id, step: "s" });
  };
  const gfDown = () => {
    const last = lastOurGoal(sheet);
    if (!last) return;
    setPick(null);
    if (last.scorer || last.kind === "og") {
      setRm({ side: "ours", id: last.id });
      return;
    }
    update((s) => removeEvent(s, last.id));
    setRoll((r) => ({ ...r, f: r.f + 1 }));
  };
  const gaUp = () => {
    const id = newId();
    update((s) => addRivalGoal(s, id).sheet);
    setRoll((r) => ({ ...r, a: r.a + 1 }));
    focusMinute.current = id;
  };
  const gaDown = () => {
    const last = lastRivalGoal(sheet);
    if (!last) return;
    if (last.own && last.playerId) {
      setRm({ side: "theirs", id: last.id });
      return;
    }
    update((s) => removeEvent(s, last.id));
    setRoll((r) => ({ ...r, a: r.a + 1 }));
  };
  const confirmRemove = () => {
    if (!rm) return;
    update((s) => removeEvent(s, rm.id));
    setRoll((r) => (rm.side === "ours" ? { ...r, f: r.f + 1 } : { ...r, a: r.a + 1 }));
    setRm(null);
    minusRef.current?.focus({ preventScroll: true });
  };

  const rmRow = rm ? (rm.side === "ours" ? rows.find((r) => r.id === rm.id) : undefined) : undefined;
  const rmRival = rm && rm.side === "theirs" ? rivals.find((r) => r.id === rm.id) : undefined;
  const rmQuestion = rmRow
    ? `¿Quitar el gol ${rmRow.n}${rmRow.kind === "og" ? ` (autogol de ${rival})` : rmRow.scorer ? ` de ${nameOf(rmRow.scorer)}` : ""}${rmRow.minute !== undefined ? ` (${rmRow.minute}′)` : ""}?`
    : rmRival
      ? `¿Quitar el gol en propia de ${nameOf(rmRival.playerId)}${rmRival.minute !== undefined ? ` (${rmRival.minute}′)` : ""}?`
      : "";

  const closePick = () => setPick(null);
  const chooseScorer = (who: string | "og") => {
    if (!pick) return;
    update((s) => setScorer(s, pick.id, who));
    setPick(who === "og" ? null : { id: pick.id, step: "a" });
  };
  const chooseAssist = (who: string | null) => {
    if (!pick) return;
    update((s) => setAssist(s, pick.id, who));
    setPick(null);
  };

  const sub = (g: GoalRow) => {
    const kind = g.kind === "goal_penalty" ? " de penalti" : g.kind === "goal_freekick" ? " de falta" : "";
    const base = `Gol ${g.n}${kind}`;
    if (g.open) return `${base} · falta quién marcó`;
    if (g.kind === "og") return `${base} · cuenta para el Piti`;
    if (pick?.id === g.id && pick.step === "a") return `${base} · ¿asistencia? (opcional)`;
    return g.assist ? `${base} · asiste ${nameOf(g.assist)}` : `${base} · sin asistencia`;
  };

  const startAdd = () => {
    if (addType === "goal_penalty" || addType === "goal_freekick") {
      const id = newId();
      update((s) => addOurGoal(s, addType, id).sheet);
      setRoll((r) => ({ ...r, f: r.f + 1 }));
      setPick({ id, step: "s" });
      return;
    }
    setEditing({ event: { id: newId(), type: addType }, isNew: true });
  };
  const saveEvent = (e: MatchEvent) => {
    update((s) => upsertEvent(s, e));
    if (e.type === "own_goal" && editing?.isNew) setRoll((r) => ({ ...r, a: r.a + 1 }));
    setEditing(null);
  };

  const finishedWarn = review.items.find((i) => i.key === "encuentro" && i.title === "Márcalo como finalizado");
  const notPlayed = review.items.some((i) => i.key === "fecha") || (!review.finished && sheet.status === "scheduled");
  const ours = rows.filter((r) => r.kind !== "og");
  const named = rows.filter((r) => !r.open).length;
  const assisted = ours.filter((r) => r.assist).length;
  const missing = rows.filter((r) => r.open).length;
  const pickerOptions = pick
    ? pickOptions(
        pick.step === "s" ? called : called.filter((c) => c.id !== active?.scorer),
        (id) => info(id),
      )
    : [];

  return (
    <div className="pnl acta">
      <div className="ac-main" ref={mainRef}>
        {finishedWarn && (
          <p className="note ad-note-warn" role="note">
            <AdIcon name="alert" size={15} />
            <span>
              El partido ya se jugó y sigue como «Programado».{" "}
              <button type="button" className="btn sm line" onClick={() => update((s) => ({ ...s, status: "finished" }))}>
                Marcar como finalizado
              </button>
            </span>
          </p>
        )}
        {notPlayed && !finishedWarn && <p className="hint">El partido aún no se ha jugado: el acta se completa cuando acabe.</p>}
        <div className="sb" role="group" aria-label="Marcador">
          <div className="tm">
            <span className="nm">
              <img src="/crest-128.webp" alt="" width={22} height={22} />
              Piti
            </span>
            <div className="ctl">
              <button ref={minusRef} type="button" className="ib mn" onClick={gfDown} aria-label="Quitar el último gol del Piti" aria-disabled={!gf}>
                <AdIcon name="minus" />
              </button>
              <output aria-live="polite" aria-label="Goles del Piti">
                <span key={roll.f} className={roll.f ? (roll.f % 2 ? "rA" : "rB") : ""}>
                  {gf}
                </span>
              </output>
              <button type="button" className="ib pl" onClick={gfUp} aria-label="Añadir un gol del Piti" aria-haspopup="dialog">
                <AdIcon name="plus" />
              </button>
            </div>
          </div>
          <span className="dash" aria-hidden="true">
            –
          </span>
          <div className="tm">
            <span className="nm">
              <span className="ini">{rivalInitialsOf(sheet)}</span>
              {rival}
            </span>
            <div className="ctl">
              <button type="button" className="ib mn" onClick={gaDown} aria-label={`Quitar un gol de ${rival}`} aria-disabled={!ga}>
                <AdIcon name="minus" />
              </button>
              <output aria-live="polite" aria-label={`Goles de ${rival}`}>
                <span key={roll.a} className={roll.a ? (roll.a % 2 ? "rA" : "rB") : ""}>
                  {ga}
                </span>
              </output>
              <button type="button" className="ib pl" onClick={gaUp} aria-label={`Añadir un gol de ${rival}`}>
                <AdIcon name="plus" />
              </button>
            </div>
          </div>
        </div>
        {rm && rmQuestion && (
          <div className="cfm" role="alertdialog" aria-labelledby="ad-rmq">
            <p id="ad-rmq">
              {rmQuestion}
              <small>{rm.side === "ours" ? "Se borra con su goleador y su asistencia." : "Se borra el gol y el jugador que lo marcó."}</small>
            </p>
            <div className="row">
              <button type="button" className="btn sm red solid" onClick={confirmRemove}>
                Quitar el gol
              </button>
              <button
                type="button"
                className="btn sm line"
                onClick={() => {
                  setRm(null);
                  minusRef.current?.focus({ preventScroll: true });
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div>
          <div className="bh">
            <h3 className="h3">Goles del Piti</h3>
            <span className={`chip ${missing ? "warn" : "ok"}`}>
              <AdIcon name={missing ? "alert" : "check"} size={12} />
              {missing ? `${missing} sin goleador` : `${gf} de ${gf} con goleador`}
            </span>
          </div>
          {rows.length ? (
            <ol className="gl">
              {rows.map((g) => {
                const act = pick?.id === g.id;
                return (
                  <li key={g.id} className={`gr${act ? " act" : g.open ? " open" : ""}`}>
                    <label className="mi">
                      <span className="sr">Minuto del gol {g.n}</span>
                      <input className="inp tn" data-minute={g.id} inputMode="numeric" maxLength={3} value={g.minute ?? ""} placeholder="min" onChange={(e) => update((s) => setMinute(s, g.id, e.target.value))} />
                    </label>
                    <span className="who">
                      <b>{g.kind === "og" ? `Autogol de ${rival}` : g.scorer ? nameOf(g.scorer) : "¿Quién marcó?"}</b>
                      <small>{sub(g)}</small>
                    </span>
                    <button
                      ref={act ? anchorRef : undefined}
                      type="button"
                      className="ib pick"
                      onClick={() => {
                        setRm(null);
                        setPick(act ? null : { id: g.id, step: "s" });
                      }}
                      aria-label={g.open ? `Elegir quién marcó el gol ${g.n}` : `Cambiar goleador y asistencia del gol ${g.n}`}
                      aria-haspopup="dialog"
                      aria-expanded={act}
                    >
                      {g.open ? "Elegir" : <AdIcon name="pencil" />}
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="hint">Sin goles del Piti. Pulsa + en el marcador para apuntar uno.</p>
          )}
        </div>
        {pickOpen && active && pick && (
          <ScorerPicker
            key={pick.id}
            step={pick.step}
            goal={{ n: active.n, minute: active.minute, scorerName: nameOf(active.scorer) }}
            options={pickerOptions}
            current={pick.step === "s" ? (active.kind === "og" ? "og" : active.scorer) : active.assist}
            rival={rival}
            kicker={`Acta · ${j} · ${gf}–${ga}`}
            anchorRef={anchorRef}
            onScorer={chooseScorer}
            onAssist={chooseAssist}
            onClose={closePick}
            onGoConvocatoria={() => {
              setPick(null);
              onGoTab("convocatoria");
            }}
          />
        )}

        <div className="ac-rest" aria-hidden={pickOpen && desktop ? true : undefined} inert={pickOpen && desktop ? true : undefined}>
          <div>
            <div className="bh">
              <h3 className="h3">Goles de {rival}</h3>
              <span className="chip">{ga} en el marcador</span>
            </div>
            {rivals.length ? (
              <ul className="gl">
                {rivals.map((r) => {
                  const noMin = r.minute === undefined;
                  return (
                    <li key={r.id} className={`gr ad-rg${noMin ? " open" : ""}`}>
                      <label className="mi">
                        <span className="sr">Minuto del gol {r.n} de {rival}</span>
                        <input className="inp tn" data-minute={r.id} inputMode="numeric" maxLength={3} value={r.minute ?? ""} placeholder="min" onChange={(e) => update((s) => setMinute(s, r.id, e.target.value))} />
                      </label>
                      <span className="who">
                        <b>{r.own ? `Gol en propia · ${nameOf(r.playerId)}` : "Gol rival"}</b>
                        <small>{noMin ? "Falta el minuto · apúntalo para publicar" : r.own ? `Cuenta para ${rival}` : "Solo cuenta para el marcador"}</small>
                      </span>
                      <button type="button" className="ib" onClick={() => (r.own && r.playerId ? setRm({ side: "theirs", id: r.id }) : update((s) => removeEvent(s, r.id)))} aria-label={`Quitar el gol ${r.n} de ${rival}`}>
                        <AdIcon name="trash" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="hint">Sin goles de {rival}.</p>
            )}
          </div>
          <div>
            <div className="bh">
              <h3 className="h3">Otros eventos</h3>
              <span className="chip">{others.length}</span>
            </div>
            <ul className="evl">
              {others.map((e) =>
                editing && !editing.isNew && editing.event.id === e.id ? (
                  <li key={e.id}>
                    <EventForm
                      event={e}
                      duration={sheet.duration}
                      options={calledNames}
                      isNew={false}
                      onSave={saveEvent}
                      onCancel={() => setEditing(null)}
                      onRemove={() => {
                        update((s) => removeEvent(s, e.id));
                        setEditing(null);
                      }}
                    />
                  </li>
                ) : (
                  <li key={e.id} className="evr">
                    <span className="mn2">{e.minute !== undefined ? `${e.minute}′` : "—"}</span>
                    <span className="w">
                      <b>
                        <EventIcon type={e.type} />
                        {EVENT_LABELS[e.type] ?? e.type}
                        {e.type === "substitution" ? ` · Entra ${nameOf(e.inPlayerId)}` : e.playerId ? ` · ${nameOf(e.playerId)}` : ""}
                      </b>
                      {(e.type === "substitution" || e.note) && <small>{[e.type === "substitution" ? `Sale ${nameOf(e.playerId)}` : "", e.note ?? ""].filter(Boolean).join(" · ")}</small>}
                    </span>
                    <button type="button" className="ib" aria-label={`Editar ${(EVENT_LABELS[e.type] ?? e.type).toLowerCase()} del ${e.minute ?? "?"}′`} onClick={() => setEditing({ event: e, isNew: false })}>
                      <AdIcon name="pencil" />
                    </button>
                  </li>
                ),
              )}
              {editing?.isNew && (
                <li>
                  <EventForm event={editing.event} duration={sheet.duration} options={calledNames} isNew onSave={saveEvent} onCancel={() => setEditing(null)} />
                </li>
              )}
            </ul>
            {!others.length && !editing && <p className="hint">Tarjetas, cambios, penaltis, palos…</p>}
            <div className="addev ad-addev">
              <label className="fld">
                <span className="sr">Tipo de evento</span>
                <select className="inp" value={addType} onChange={(e) => setAddType(e.target.value as EventType)}>
                  {OTHER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {EVENT_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="btn sm" onClick={startAdd}>
                <AdIcon name="plus" size={16} />
                Añadir
              </button>
            </div>
          </div>
        </div>
      </div>

      <aside className="ac-side" aria-label="Comprobación">
        <div className="tally" role="group" aria-label="La cuenta">
          <p className="lbl">La cuenta</p>
          <div className="tr2">
            <span>Marcador</span>
            <span className="dots" aria-label={`${gf} goles en el marcador`}>
              {rows.map((g) => (
                <i key={g.id} className="f" />
              ))}
              <em>{gf}</em>
            </span>
          </div>
          <div className="tr2">
            <span>Con goleador</span>
            <span className="dots" aria-label={`${named} de ${gf} con goleador`}>
              {rows.map((g) => (
                <i key={g.id} className={g.open ? "o" : "f"} />
              ))}
              <em>
                {named} de {gf}
              </em>
            </span>
          </div>
          <div className="tr2">
            <span>Asistencias</span>
            <span className="dots" aria-label={`${assisted} de ${ours.length} con asistencia`}>
              {ours.map((g) => (
                <i key={g.id} className={g.assist ? "f" : "r"} />
              ))}
              <em>
                {assisted} de {ours.length}
              </em>
            </span>
          </div>
        </div>
        <h3 className="h3">¿Cuadra?</h3>
        <ul className="cq" aria-label="¿Cuadra?">
          {review.items.map((q) => (
            <li key={`${q.key}-${q.title}`}>
              <span className={`ic ${q.tone === "info" ? "" : q.tone}`} aria-hidden="true">
                {q.tone === "ok" ? "✓" : q.tone === "warn" ? "!" : "i"}
              </span>
              <span>
                <b>{q.title}</b>
                <small>{q.detail}</small>
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
