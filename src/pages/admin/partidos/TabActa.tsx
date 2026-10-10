// The «Acta» tab, as on the canvas (stats-gen/ad-v2-full.mjs `actaT`, shots-adv2f/partidos-acta.png, m-acta.png):
// «Goles del Piti» in big rows (editable minute, the scorer large, the pass; a goal without scorer in amber
// «¿Quién marcó?» + «Elegir») with the dorsal picker opening right UNDER its row; «Goles de RIVAL» (minute,
// remove with «Deshacer», «Portería a cero»); «Lo demás» grouped Tarjetas · Cambios · Penaltis · Otros
// (each with its «+», a row opens it for editing); and on the right «La cuenta» (dots) and «¿Cuadra?».
// A match still to play: «El acta se escribe en el partido»; being played: «Abrir En juego».
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import type { MatchEvent } from "../../../../functions/src/matchEngine";
import type { ActaReview } from "../data/adminLogic";
import { ShirtBack } from "../kit";
import { liveLog } from "../live/liveModel";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";
import { addOurGoal, addRivalGoal, goalRows, newId, otherEvents, removeEvent, rivalRows, setAssist, setMinute, setScorer, upsertEvent, type MatchSheet } from "../acta/sheetModel";
import { EventPanel } from "./EventPanel";
import { GROUPS, groupOfEvent, kindLabel, pickOptions, type EventGroup } from "./pickModel";
import { ScorerPicker } from "./ScorerPicker";
import { cuentaOf, goalSub, goalWho, type Phase } from "./workspaceModel";

export interface PlayerInfo {
  name: string;
  number: number | null;
}
export interface TabActaProps {
  phase: Phase;
  sheet: MatchSheet;
  update: (f: (s: MatchSheet) => MatchSheet) => void;
  review: ActaReview;
  rival: string;
  /** «J7» (the lower thirds' tag). */
  j: string;
  info: (id: string) => PlayerInfo;
  onOpenLive: () => void;
  onGoConvocar: () => void;
}

type Open = { k: "goal"; id: string; step: "s" | "a" } | { k: "ev"; group: EventGroup; editId: string | null; newId: string } | null;

/** Puts an event back where it was (the «Deshacer» of a removal). */
const restoreAt = (s: MatchSheet, e: MatchEvent, at: number): MatchSheet => {
  if (s.events.some((x) => x.id === e.id)) return s;
  const events = [...s.events];
  events.splice(Math.min(at, events.length), 0, e);
  return { ...s, events };
};

export function TabActa(props: TabActaProps) {
  const { phase } = props;
  if (phase === "antes" || phase === "off")
    return (
      <div className="void">
        <ShirtBack size={90} big state="empty" />
        <h3>{props.sheet.status === "cancelled" ? "Partido cancelado" : props.sheet.status === "postponed" ? "Partido aplazado" : "El acta se escribe en el partido"}</h3>
        <p>
          {props.sheet.status === "cancelled"
            ? "No tiene acta: un partido cancelado no cuenta para las estadísticas."
            : props.sheet.status === "postponed"
              ? "Pon la nueva fecha en «Encuentro»: el acta se escribe el día que se juegue."
              : "El día del partido, cada gol, tarjeta y cambio se apunta a un toque desde «En juego» en Hoy. Al pitar el final llega aquí para repasarla y publicarla."}
        </p>
      </div>
    );
  if (phase === "juego")
    return (
      <div className="void">
        <ShirtBack size={90} big />
        <h3>Se está jugando ahora</h3>
        <p>Apunta los goles desde «En juego»: llegan aquí solos.</p>
        <button type="button" className="btn gold" onClick={props.onOpenLive}>
          <AdIcon name="ball" size={18} />
          Abrir En juego
        </button>
      </div>
    );
  return <ActaEditor {...props} />;
}

function ActaEditor({ sheet, update, review, rival, j, info, onGoConvocar }: TabActaProps) {
  const toast = useToast();
  const [open, setOpen] = useState<Open>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const focusMinute = useRef<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const rows = goalRows(sheet);
  const rivals = rivalRows(sheet);
  const others = otherEvents(sheet);
  const nameOf = (id: string) => info(id).name;
  const field = pickOptions(sheet.starters, info);
  const bench = pickOptions(sheet.bench, info);

  // Focus a minute box that was just added (a rival goal).
  useLayoutEffect(() => {
    const id = focusMinute.current;
    if (!id) return;
    focusMinute.current = null;
    Array.from(mainRef.current?.querySelectorAll<HTMLInputElement>("input[data-minute]") ?? [])
      .find((x) => x.dataset.minute === id)
      ?.focus();
  });

  const close = () => setOpen(null);
  const indexOf = (id: string) => sheet.events.findIndex((e) => e.id === id);
  const removeWithUndo = (e: MatchEvent, message: string) => {
    const at = indexOf(e.id);
    update((s) => removeEvent(s, e.id));
    toast.show({ tag: j, message, undo: () => update((s) => restoreAt(s, e, at)) });
  };

  // ── our goals ──
  const addGoal = () => {
    const id = newId();
    update((s) => addOurGoal(s, "goal", id).sheet);
    setOpen({ k: "goal", id, step: "s" });
  };
  const active = open?.k === "goal" ? rows.find((r) => r.id === open.id) : undefined;
  const chooseScorer = (who: string | "og") => {
    if (open?.k !== "goal" || !active) return;
    update((s) => setScorer(s, open.id, who));
    if (who === "og") {
      setOpen(null);
      toast.show({ tag: j, message: `Gol ${active.n}: autogol de ${rival}` });
    } else setOpen({ ...open, step: "a" });
  };
  const chooseAssist = (who: string | null) => {
    if (open?.k !== "goal" || !active) return;
    update((s) => setAssist(s, open.id, who));
    setOpen(null);
    const scorer = active.scorer ? nameOf(active.scorer) : "";
    toast.show({ tag: j, message: `Gol ${active.n}: ${scorer}, ${who ? `pase de ${nameOf(who)}` : "sin asistencia"}` });
  };
  const removeGoal = () => {
    if (open?.k !== "goal" || !active) return;
    const e = sheet.events.find((x) => x.id === open.id);
    setOpen(null);
    if (e) removeWithUndo(e, `Gol ${active.n} quitado`);
  };

  // ── rival goals ──
  const addRival = () => {
    const id = newId();
    update((s) => addRivalGoal(s, id).sheet);
    focusMinute.current = id;
  };

  // ── Lo demás ──
  const groups = GROUPS.map((g) => {
    const list = others.filter((e) => groupOfEvent(e) === g.key);
    const log = liveLog(list, rival, nameOf).reverse();
    return { ...g, list, log };
  });
  const saveEvent = (e: MatchEvent) => {
    const editing = open?.k === "ev" && open.editId;
    update((s) => upsertEvent(s, e));
    setOpen(null);
    const who = e.type === "substitution" ? `Entra ${nameOf(e.inPlayerId ?? "")}, sale ${nameOf(e.playerId ?? "")}` : `${kindLabel(e.type)} · ${nameOf(e.playerId ?? "")}`;
    toast.show({ tag: j, message: `${editing ? "Corregido" : "Apuntado"}: ${who} · ${e.minute}′` });
  };

  const cuenta = cuentaOf(rows);

  return (
    <div className="acta">
      <div className="acol" ref={mainRef}>
        <section aria-labelledby="ad-h-gp">
          <div className="ah">
            <h3 id="ad-h-gp">Goles del Piti</h3>
            <span className="n">{rows.length}</span>
            <button type="button" className="btn sm line add" onClick={addGoal} aria-haspopup="dialog">
              <AdIcon name="plus" size={16} />
              Gol del Piti
            </button>
          </div>
          <div className="gl">
            {rows.map((g) => {
              const act = open?.k === "goal" && open.id === g.id;
              const edit = () => setOpen(act ? null : { k: "goal", id: g.id, step: "s" });
              return (
                <Fragment key={g.id}>
                  <div className={["gr", act ? "act" : g.open ? "miss" : ""].filter(Boolean).join(" ")}>
                    <input className="m" data-minute={g.id} value={g.minute ?? ""} onChange={(e) => update((s) => setMinute(s, g.id, e.target.value))} aria-label={`Minuto del gol ${g.n}`} inputMode="numeric" maxLength={3} placeholder="min" />
                    <button ref={act ? anchorRef : undefined} type="button" className="gw" onClick={edit} aria-expanded={act} aria-haspopup="dialog">
                      <b>{goalWho(g, rival, nameOf)}</b>
                      <small>{goalSub(g, nameOf)}</small>
                    </button>
                    {g.open ? (
                      <button type="button" className="btn sm sky" onClick={() => setOpen({ k: "goal", id: g.id, step: "s" })} aria-label={`Elegir quién marcó el gol ${g.n}`}>
                        Elegir
                      </button>
                    ) : (
                      <button type="button" className="e" onClick={() => setOpen({ k: "goal", id: g.id, step: "s" })} aria-label={`Cambiar goleador del gol ${g.n}`}>
                        <AdIcon name="pencil" />
                      </button>
                    )}
                  </div>
                  {act && open.k === "goal" && (
                    <ScorerPicker
                      key={`${g.id}-${open.step}`}
                      step={open.step}
                      goal={{ n: g.n, minute: g.minute, scorerName: g.scorer ? nameOf(g.scorer) : "" }}
                      field={open.step === "a" ? field.filter((o) => o.id !== g.scorer) : field}
                      bench={open.step === "a" ? bench.filter((o) => o.id !== g.scorer) : bench}
                      current={open.step === "s" ? (g.kind === "og" ? "og" : g.scorer) : g.assist}
                      rival={rival}
                      anchorRef={anchorRef}
                      onScorer={chooseScorer}
                      onAssist={chooseAssist}
                      onBack={() => setOpen({ k: "goal", id: g.id, step: "s" })}
                      onRemove={removeGoal}
                      onClose={close}
                      onGoConvocatoria={() => {
                        setOpen(null);
                        onGoConvocar();
                      }}
                    />
                  )}
                </Fragment>
              );
            })}
            {!rows.length && <p className="hint">Sin goles del Piti. «Gol del Piti» apunta uno.</p>}
          </div>
        </section>

        <section aria-labelledby="ad-h-gr">
          <div className="ah">
            <h3 id="ad-h-gr">Goles de {rival}</h3>
            <span className="n">{rivals.length}</span>
            <button type="button" className="btn sm line add" onClick={addRival}>
              <AdIcon name="plus" size={16} />
              Gol en contra
            </button>
          </div>
          <div className="gl">
            {rivals.map((r) => {
              const noMin = r.minute === undefined;
              const e = sheet.events.find((x) => x.id === r.id);
              return (
                <div key={r.id} className={`gr rvl${noMin ? " miss" : ""}`}>
                  <input className="m" data-minute={r.id} value={r.minute ?? ""} onChange={(ev) => update((s) => setMinute(s, r.id, ev.target.value))} aria-label={`Minuto del gol ${r.n} de ${rival}`} inputMode="numeric" maxLength={3} placeholder="min" />
                  <span>
                    <b>{r.own ? `Gol en propia de ${nameOf(r.playerId ?? "")}` : `Gol de ${rival}`}</b>
                    <small>{noMin ? "Falta el minuto · apúntalo para publicar" : "En contra"}</small>
                  </span>
                  <button type="button" className="e" onClick={() => e && removeWithUndo(e, `Gol de ${rival} quitado`)} aria-label={`Quitar el gol ${r.n} de ${rival}`}>
                    <AdIcon name="trash" />
                  </button>
                </div>
              );
            })}
            {!rivals.length && <p className="hint">Portería a cero.</p>}
          </div>
        </section>

        <section aria-labelledby="ad-h-ev">
          <div className="ah">
            <h3 id="ad-h-ev">Lo demás</h3>
          </div>
          <div className="evg">
            {groups.map((g) => {
              const here = open?.k === "ev" && open.group === g.key ? open : null;
              const editing = here?.editId ? (g.list.find((e) => e.id === here.editId) ?? null) : null;
              return (
                <div key={g.key} className="eg" style={here ? { gridColumn: "1 / -1" } : undefined}>
                  <div className="ah">
                    <h3>{g.title}</h3>
                    <span className="n">{g.list.length}</span>
                    <button
                      ref={here && !here.editId ? anchorRef : undefined}
                      type="button"
                      className="ib2 add"
                      style={{ width: 40, height: 40 }}
                      onClick={() => setOpen(here && !here.editId ? null : { k: "ev", group: g.key, editId: null, newId: newId() })}
                      aria-label={`Añadir en ${g.title}`}
                      aria-haspopup="dialog"
                      aria-expanded={!!here && !here.editId}
                    >
                      <AdIcon name="plus" size={16} />
                    </button>
                  </div>
                  {g.log.length ? (
                    <ul className="evl">
                      {g.log.map((x) => (
                        <li key={x.id} className={x.cls || undefined}>
                          <span className="m">{x.minute}′</span>
                          <span className="ic">{x.icon ? <AdIcon name={x.icon} size={18} /> : null}</span>
                          <span>
                            {x.text} {x.detail ? <small>{x.detail}</small> : null}
                          </span>
                          <button
                            ref={here?.editId === x.id ? anchorRef : undefined}
                            type="button"
                            className="ib2"
                            onClick={() => setOpen(here?.editId === x.id ? null : { k: "ev", group: g.key, editId: x.id, newId: x.id })}
                            aria-label={`Editar: ${x.text} (${x.minute}′)`}
                            aria-haspopup="dialog"
                            aria-expanded={here?.editId === x.id}
                          >
                            <AdIcon name="pencil" size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="emp">{g.empty}</p>
                  )}
                  {here && (
                    <EventPanel
                      key={`${g.key}-${here.editId ?? here.newId}`}
                      group={g.key}
                      title={g.title}
                      event={editing}
                      newId={here.newId}
                      duration={sheet.duration}
                      field={field}
                      bench={bench}
                      anchorRef={anchorRef}
                      onSave={saveEvent}
                      onRemove={(e) => {
                        setOpen(null);
                        removeWithUndo(e, `${kindLabel(e.type)} quitado`);
                      }}
                      onClose={close}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="cuenta" aria-label="Comprobación del acta">
        <div className="calm">
          <h3>La cuenta</h3>
          <div className="dots">
            {cuenta.map((c) => (
              <div key={c.title} className="r" role="group" aria-label={`${c.title}: ${c.value}`}>
                <span>
                  {c.title} <b>{c.value}</b>
                </span>
                <i aria-hidden="true">
                  {c.dots.map((d, i) => (
                    <u key={i} className={d || undefined} />
                  ))}
                </i>
              </div>
            ))}
          </div>
        </div>
        <div className="calm">
          <h3>¿Cuadra?</h3>
          <ul className="ck2">
            {review.items.map((q) => (
              <li key={`${q.key}-${q.title}`} className={q.tone === "warn" ? "no" : undefined}>
                <span className="i" aria-hidden="true">
                  {q.tone === "ok" ? <AdIcon name="check" size={13} /> : q.tone === "warn" ? "!" : "i"}
                </span>
                <span>
                  {q.title}
                  <small>{q.key === "goles" && q.tone === "warn" && review.missingScorers ? "Toca la fila en ámbar" : q.detail}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
