// ACTA · the match's Acta (/admin/partidos/<id>/acta), as its board (part-partido-acta.html, acta.js): the goals first
// (ours with scorer and pass, chosen in their row by dorsal, the pitch at that minute first; theirs with their minute
// and an own goal), cards, penalties and the rest (each with its editor in place), the guests, the minutes of each
// player (one bar per player, its stints, M-08) with the changes under it; on the right «La cuenta» and «¿Cuadra?»
// with each fix. Over it the bars: another captain's change or the draft the published acta overtook (B-ACTA-01,
// «Recargar y conservar mis cambios» / «Descartar borrador», M-44), this device's edits, la mesa's jugadas. A match
// that never reached la mesa asks «¿Cómo acabó?» first (B-HOY-11). Its foot: the save line, «Guardar borrador» and
// «Ir a publicar» (or «Guardar cambios» on a published acta). Removing a play brings its narrated detail back with
// «Deshacer» (B-ACTA-02).
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { EventType, MatchEvent } from "../../../../../functions/src/matchEngine";
import { isGuestId } from "../../../../lib/derived/guests";
import { addGuest, guestInUse, guestSlot, removeGuest } from "../../acta/guests";
import { addOurGoal, addRivalGoal, goalRows, newId, otherEvents, removeEvent, restoreEvent, rivalInitialsOf, rivalRows, setAssist, setMinute, setScorer, upsertEvent, type GoalRow, type MatchSheet } from "../../acta/sheetModel";
import { checkEvent, fieldAt, groupOfEvent, KINDS, kindLabel, playerMode, type EventGroup } from "../../partidos/pickModel";
import { goalSub, goalWho } from "../../partidos/workspaceModel";
import { rivalCode } from "../../../../lib/eventMeta";
import { usePartido } from "../../partido/partidoContext";
import { useMatchShortcuts } from "../../palette/matchShortcuts";
import { useRegisterCommands } from "../../palette/registry";
import type { PaletteCommand } from "../../palette/search";
import { ScreenLoading } from "../../shell/Screen";
import { useSalaGo } from "../../shell/salaHref";
import { useStatus } from "../../shell/statusContext";
import { VIcon } from "../../../../components/vidrio/VIcon";
import { checkRows, minutesBars, playLines, type CheckRow } from "./actaModel";
import { AcIcon, ActaBars, ActaEmpty, ActaFoot, ActaNav, ActaStills, MinuteBox, Shirt } from "./parts";
import { useSheetSession, type SheetSession } from "./sheetSession";
import "./acta.css";

export function ActaScreen() {
  const s = useSheetSession();
  const { phase } = usePartido();
  const go = useSalaGo();
  const base = `/admin/partidos/${s.match.id}`;
  useActaCommands(s, () => go(`${base}/publicar`));
  useMatchShortcuts(s.match);
  if (s.loading) return <ScreenLoading label="Cargando el acta" />;
  const body = (() => {
    if (phase === "antes") return <ActaEmpty title="El acta se escribe en el partido" body="El día del partido, cada gol, tarjeta y cambio se apunta a un toque en la mesa y llega aquí solo. Después, aquí se repasa, se completa y se publica." />;
    if (phase === "juego" || phase === "descanso")
      return (
        <ActaEmpty kicker={<p className="sc-k"><span className="sc-tag sc-tag--live">En juego</span></p>} title="Se está jugando ahora" body="Apunta los goles en la mesa: llegan aquí solos. Cuando se pite el final, el acta se repasa aquí.">
          <a className="vd-btn vd-glass vd-press vd-btn--pri" href={`/partidos/${s.match.id}/mesa`}>
            Abrir la mesa
          </a>
        </ActaEmpty>
      );
    if (phase === "aplazado" || phase === "cancelado")
      return (
        <ActaEmpty title={phase === "cancelado" ? "Partido cancelado" : "Partido aplazado"} body={phase === "cancelado" ? "No tiene acta: no cuenta para las estadísticas." : "Pon la nueva fecha en «Datos»: el acta se escribe el día que se juegue."}>
          <button type="button" className="vd-btn vd-glass vd-press" onClick={() => go(`${base}/datos`)}>
            Ir a los datos del partido
          </button>
        </ActaEmpty>
      );
    if (phase === "pendiente" && s.value.status === "scheduled" && !s.value.events.length) return <HowItEnded s={s} />;
    return <ActaEditor s={s} />;
  })();
  return (
    <ActaStills s={s}>
      <section className="sac sac-acta" aria-label="El acta del partido">
        <ActaNav on="" />
        {body}
      </section>
    </ActaStills>
  );
}

/** ⌘K while the acta is on screen: «Guardar borrador de la J3», «Publicar el acta de la J3» / «Ir a publicar». */
function useActaCommands(s: SheetSession, toPublicar: () => void) {
  const latest = useRef(s);
  useEffect(() => {
    latest.current = s;
  });
  const { j, foot, published, match } = s;
  const cmds = useMemo<PaletteCommand[]>(
    () =>
      foot.mode === "acta" || foot.mode === "publicada"
        ? [
            { id: `acta:guardar:${match.id}`, group: "Acciones", icon: "↓", title: `Guardar borrador de la ${j}`, description: "Solo lo ven los capitanes", hint: "acción", keywords: "guardar borrador acta", run: () => void latest.current.saveDraft() },
            published
              ? { id: `acta:corregir:${match.id}`, group: "Acciones", icon: "✓", title: `Guardar los cambios del acta de la ${j}`, description: "Corrige la web al momento", hint: "acción", keywords: "guardar cambios corregir acta", run: () => void latest.current.publish() }
              : { id: `acta:publicar:${match.id}`, group: "Acciones", icon: "✓", title: `Publicar el acta de la ${j}`, description: foot.why, hint: "ir", keywords: "publicar acta", run: toPublicar },
          ]
        : [],
    [foot.mode, foot.why, published, j, match.id, toPublicar],
  );
  useRegisterCommands(cmds);
}

/** B-HOY-11: a match that never reached la mesa — its result first, then who scored. */
function HowItEnded({ s }: { s: SheetSession }) {
  const go = useSalaGo();
  const status = useStatus();
  const [gf, setGf] = useState(0);
  const [ga, setGa] = useState(0);
  const base = `/admin/partidos/${s.match.id}`;
  const t = s.sheet.date;
  const when = Number.isFinite(t) ? `Era el ${new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" }).format(t)} a las ${new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(t)}${s.sheet.home ? " en casa" : " fuera"}. ` : "";
  const done = () => {
    s.update((v) => {
      let x: MatchSheet = { ...v, status: "finished" };
      for (let i = 0; i < gf; i++) x = addOurGoal(x).sheet;
      for (let i = 0; i < ga; i++) x = addRivalGoal(x).sheet;
      return x;
    });
    status.show({ tag: `Acta ${s.j}`, message: `Así acabó: ${gf}–${ga}${gf ? " · ahora, quién marcó cada gol" : ""}` });
  };
  const step = (who: string, n: number, set: (n: number) => void, rival?: string) => (
    <div className="sac-step">
      <p className={`sac-step__t${rival ? " sc-rival" : ""}`}>{rival ?? "Manchester Piti"}</p>
      <div className="sac-step__ctl">
        <button type="button" className="vd-ibtn vd-glass vd-press" onClick={() => set(Math.max(0, n - 1))} aria-label={`Un gol menos ${who}`}>
          −
        </button>
        <output className="sc-score sac-step__n" aria-live="polite" aria-label={`Goles ${who === "del Piti" ? "del Piti" : `de ${rival}`}: ${n}`}>
          {n}
        </output>
        <button type="button" className="vd-ibtn vd-glass vd-press" onClick={() => set(Math.min(30, n + 1))} aria-label={`Un gol más ${who}`}>
          +
        </button>
      </div>
    </div>
  );
  return (
    <div className="sac-pend">
      <h2 className="sc-h2" id="sac-pend-t">
        ¿Cómo acabó?
      </h2>
      <p className="sc-p">{when}La mesa no llegó a abrirse: apunta cómo acabó y después, quién marcó.</p>
      <div className="sac-pend__score" role="group" aria-labelledby="sac-pend-t">
        {step("del Piti", gf, setGf)}
        <span className="sac-pend__dash" aria-hidden="true">
          –
        </span>
        {step("del rival", ga, setGa, s.rival)}
      </div>
      <div className="sc-primary sc-primary--pin sac-pend__a">
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" onClick={done}>
          Así acabó
        </button>
        <button type="button" className="vd-link sac-link" onClick={() => go(`${base}/datos?estado=aplazado`)}>
          Se aplazó
        </button>
        <button type="button" className="vd-link sac-link" onClick={() => go(`${base}/datos?estado=cancelado`)}>
          No se jugó
        </button>
      </div>
    </div>
  );
}

/** The goal row's second line: «Gol 1 · sin asistencia · por confirmar» while its pass is not confirmed. */
const goalSubLine = (g: GoalRow, nameOf: (id: string) => string) => {
  const line = goalSub(g, nameOf);
  return !g.open && g.kind !== "og" && !g.assist && g.assistReviewed !== true && /sin asistencia$/.test(line) ? `${line} · por confirmar` : line;
};

type Pick = { id: string; step: 1 | 2 } | null;
type Editing = { group: EventGroup; id: string | null; type?: EventType } | null;
const GROUP_NAME: Record<Exclude<EventGroup, "cam">, string> = { tar: "Tarjetas", pen: "Penaltis", otro: "Ocasiones y otras jugadas" };
const GROUP_EMPTY: Record<Exclude<EventGroup, "cam">, string> = { tar: "Sin tarjetas.", pen: "Sin penaltis.", otro: "Ocasiones, córners, palos…" };

function ActaEditor({ s }: { s: SheetSession }) {
  const status = useStatus();
  const go = useSalaGo();
  const base = `/admin/partidos/${s.match.id}`;
  const { sheet, rival, nameOf, info, review } = s;
  const [pick, setPick] = useState<Pick>(null);
  const [ed, setEd] = useState<Editing>(null);
  const [guest, setGuest] = useState("");
  const [allSubs, setAllSubs] = useState(false);
  const focusMinute = useRef<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const name = (id: string) => nameOf(id);

  // (a rival goal just added: its minute box takes the focus)
  useEffect(() => {
    const id = focusMinute.current;
    if (!id) return;
    focusMinute.current = null;
    mainRef.current?.querySelector<HTMLInputElement>(`input[data-minute="${CSS.escape(id)}"]`)?.focus();
  });

  const rows = goalRows(sheet);
  const rivals = rivalRows(sheet);
  const others = otherEvents(sheet);
  const called = [...sheet.starters, ...sheet.bench];
  const noConv = !called.length;
  const pool = noConv ? s.roster.map((p) => p.id) : called;
  const num = (id: string) => (isGuestId(id) ? "INV" : (info(id).number ?? "—").toString());

  /** Removes a play with «Deshacer»: the play and its narrated detail come back together (B-ACTA-02). */
  const removeWithUndo = (id: string, message: string) => {
    const before = s.value;
    const linked = (before.analysis?.observations ?? []).some((o) => o.canonicalEventId === id && o.validity !== "void");
    s.update((v) => removeEvent(v, id));
    status.show({ tag: s.j, message: `${message}${linked ? " · y su detalle narrado" : ""}`, undo: () => s.update((v) => restoreEvent(v, before, id)) });
  };

  // ── our goals ──
  const addGoal = () => {
    const id = newId();
    s.update((v) => addOurGoal(v, "goal", id).sheet);
    setPick({ id, step: 1 });
  };
  const n = (id: string) => rows.find((r) => r.id === id)?.n ?? rows.length + 1;
  const chooseScorer = (goalId: string, who: string | "og") => {
    s.update((v) => setScorer(v, goalId, who));
    if (who === "og") {
      setPick(null);
      status.show({ tag: `Gol ${n(goalId)}`, message: `Gol ${n(goalId)}: autogol de ${rival}` });
    } else setPick({ id: goalId, step: 2 });
  };
  const chooseAssist = (goalId: string, who: string | null) => {
    const g = rows.find((r) => r.id === goalId);
    s.update((v) => setAssist(v, goalId, who));
    setPick(null);
    status.show({ tag: `Gol ${n(goalId)}`, message: `Gol ${n(goalId)}: ${g?.scorer ? name(g.scorer) : ""}, ${who ? `pase de ${name(who)}` : "sin asistencia"}` });
  };

  // ── theirs ──
  const addRival = () => {
    const id = newId();
    s.update((v) => addRivalGoal(v, id).sheet);
    focusMinute.current = id;
    status.show({ tag: "Gol en contra", message: `Gol de ${rival} apuntado · pon su minuto` });
  };
  const setRivalWho = (id: string, who: string, k: number) => {
    s.update((v) => upsertEvent(v, { ...v.events.find((e) => e.id === id)!, type: who ? "own_goal" : "opponent_goal", playerId: who || undefined }));
    status.show({ tag: "Gol en contra", message: who ? `Gol ${k} de ${rival}: en propia de ${name(who)}` : `Gol ${k} de ${rival}` });
  };

  // ── the guests ──
  const addGuestNamed = (e: FormEvent) => {
    e.preventDefault();
    const r = addGuest(s.value, guest);
    if (!r.ok) {
      status.show({ tone: "error", message: r.error });
      return;
    }
    s.update((v) => {
      const x = addGuest(v, guest);
      return x.ok ? x.value : v;
    });
    status.show({ tag: "Invitado", message: `${r.guest.name} (invitado), en el banquillo · ya sale en los selectores` });
    setGuest("");
  };
  const dropGuest = (id: string) => {
    const r = removeGuest(s.value, id);
    if (!r.ok) {
      status.show({ tone: "error", message: r.error });
      return;
    }
    s.update((v) => {
      const x = removeGuest(v, id);
      return x.ok ? x.value : v;
    });
    status.show({ tag: "Invitado", message: "Invitado quitado de la convocatoria" });
  };

  // ── the checks and their fixes ──
  const checks = checkRows(review, { mesa: s.clash?.kind === "mesa" ? s.clash.count : 0 });
  const blockers = checks.filter((c) => c.k === "mal");
  const fix = (c: CheckRow) => {
    if (c.fix === "scorer") {
      const open = rows.find((r) => r.open);
      if (open) setPick({ id: open.id, step: 1 });
    } else if (c.fix === "convocatoria") go(`${base}/convocatoria`);
    else if (c.fix === "datos") go(`${base}/datos`);
    else if (c.fix === "minute") mainRef.current?.querySelector<HTMLInputElement>('input[data-minute]:placeholder-shown')?.focus();
  };

  // ── minutes ──
  const mins = useMemo(() => minutesBars(sheet, info), [sheet, info]);
  const subs = others.filter((e) => groupOfEvent(e) === "cam");
  const subsShown = allSubs || subs.length <= 8 ? subs : subs.slice(0, 8);
  const subLines = playLines(subs, rival, name);

  const withP = rows.filter((r) => !r.open).length;
  const withA = rows.filter((r) => r.assist).length;
  const gf = rows.length;
  const ga = rivals.length;

  const editorFor = (group: EventGroup) =>
    ed?.group === group ? (
      <PlayEditor
        key={`${group}:${ed.id ?? `new-${ed.type ?? ""}`}`}
        s={s}
        group={group}
        initial={ed.type}
        event={ed.id ? (sheet.events.find((e) => e.id === ed.id) ?? null) : null}
        onClose={() => setEd(null)}
        onRemove={(e) => {
          setEd(null);
          removeWithUndo(e.id, `${kindLabel(e.type)} quitada`);
        }}
      />
    ) : null;

  return (
    <div className="sac-sheet-body">
      <ActaBars s={s} onPublishTo={() => (s.published ? void s.publish() : go(`${base}/publicar`))} />
      <div className="sac-cols">
        <div className="sac-left" ref={mainRef}>
          <div className="sac-main">
            <section className="sc-sec sac-sec" aria-labelledby="sac-us-t">
              <header className="sc-sec__h">
                <h2 className="sc-h2" id="sac-us-t">
                  Goles del Piti
                </h2>
                <span className="sc-sec__n">{gf}</span>
                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={addGoal}>
                  <VIcon name="plus" size={17} />
                  Gol del Piti
                </button>
              </header>
              {!gf && <p className="sac-none">Sin goles del Piti. «Gol del Piti» apunta uno.</p>}
              <ol className="sc-rows sac-goals">
                {rows.map((g) => {
                  const falta = g.open;
                  const open = pick?.id === g.id;
                  return (
                    <li key={g.id} className={`sac-goal${falta ? " is-falta" : ""}`}>
                      <div className="sac-goal__row">
                        <MinuteBox id={g.id} value={g.minute} label={`Minuto del gol ${g.n}`} onChange={(t) => s.update((v) => setMinute(v, g.id, t))} />
                        <button type="button" className="sac-who" aria-expanded={open} aria-label={`${falta ? "Elegir el goleador del gol " : "Cambiar goleador del gol "}${g.n}`} onClick={() => setPick(open ? null : { id: g.id, step: 1 })}>
                          {!falta && g.kind !== "og" && g.scorer && <Shirt kit={sheet.kit} num={num(g.scorer)} alt={name(g.scorer)} />}
                          <span className="sac-who__t">
                            <b>{goalWho(g, rival, name)}</b>
                            <span>{goalSubLine(g, name)}</span>
                          </span>
                          {falta ? <span className="sc-tag sc-tag--toca">Falta</span> : <AcIcon name="edit" className="sac-who__pen" />}
                        </button>
                      </div>
                      {open && (
                        <ScorerPick
                          s={s}
                          goal={g}
                          step={pick.step}
                          pool={pool}
                          noConv={noConv}
                          onScorer={(who) => chooseScorer(g.id, who)}
                          onAssist={(who) => chooseAssist(g.id, who)}
                          onBack={() => setPick({ id: g.id, step: 1 })}
                          onLater={() => setPick(null)}
                          onDrop={() => {
                            setPick(null);
                            removeWithUndo(g.id, `Gol ${g.n} quitado`);
                          }}
                          onClose={() => setPick(null)}
                          onConv={() => go(`${base}/convocatoria`)}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="sc-sec sac-sec" aria-labelledby="sac-them-t">
              <header className="sc-sec__h">
                <h2 className="sc-h2" id="sac-them-t">
                  Goles de {rival}
                </h2>
                <span className="sc-sec__n">{ga}</span>
                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={addRival}>
                  <VIcon name="plus" size={17} />
                  Gol en contra
                </button>
              </header>
              {!ga && <p className="sac-none">Portería a cero.</p>}
              <ol className="sc-rows sac-against">
                {rivals.map((r) => {
                  const noMin = r.minute === undefined;
                  return (
                    <li key={r.id} className={`sac-goal sac-goal--them${noMin ? " is-falta" : ""}`}>
                      <div className="sac-goal__row">
                        <MinuteBox id={r.id} value={r.minute} label={`Minuto del gol ${r.n} de ${rival}`} onChange={(t) => s.update((v) => setMinute(v, r.id, t))} />
                        <span className="sac-them__t">
                          <b>{r.own ? `Gol en propia de ${name(r.playerId ?? "")}` : `Gol de ${rival}`}</b>
                          <span>{noMin ? "Falta el minuto · apúntalo para publicar" : "En contra"}</span>
                        </span>
                        <label className="sac-them__sel">
                          <span className="vd-vh">Quién marcó el gol {r.n} de {rival}</span>
                          <select className="vd-input" value={r.own ? (r.playerId ?? "") : ""} onChange={(e) => setRivalWho(r.id, e.target.value, r.n)}>
                            <option value="">Gol de {rival}</option>
                            {pool
                              .filter((id) => !isGuestId(id))
                              .map((id) => (
                                <option key={id} value={id}>
                                  En propia de {name(id)}
                                </option>
                              ))}
                          </select>
                        </label>
                        <button type="button" className="vd-ibtn vd-glass vd-press" onClick={() => removeWithUndo(r.id, `Gol ${r.n} de ${rival} quitado`)} aria-label={`Quitar el gol ${r.n} de ${rival}`}>
                          <AcIcon name="trash" size={20} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            {(["tar", "pen", "otro"] as const).map((g) => {
              const list = others.filter((e) => groupOfEvent(e) === g);
              const lines = playLines(list, rival, name);
              return (
                <section key={g} className="sc-sec sac-sec" aria-labelledby={`sac-g-${g}`}>
                  <header className="sc-sec__h">
                    <h2 className="sc-h3" id={`sac-g-${g}`}>
                      {GROUP_NAME[g]}
                    </h2>
                    <span className="sc-sec__n">{list.length || ""}</span>
                    <button type="button" className="vd-ibtn vd-glass vd-press" onClick={() => setEd({ group: g, id: null })} aria-label={`Añadir en ${GROUP_NAME[g]}`} aria-expanded={ed?.group === g && !ed.id}>
                      <VIcon name="plus" size={20} />
                    </button>
                  </header>
                  {!list.length && <p className="sac-none">{GROUP_EMPTY[g]}</p>}
                  {list.length > 0 && (
                    <ul className="sc-rows sac-plays">
                      {lines.map((x) => (
                        <li key={x.id}>
                          <button type="button" className={`sc-row sc-row--btn sac-play${x.cls === "rv" ? " is-suyo" : ""}`} onClick={() => setEd({ group: g, id: x.id })} aria-label={`Editar: ${x.text} (${x.minute}′)`} aria-expanded={ed?.id === x.id}>
                            <span className="sac-play__m">{x.minute}′</span>
                            <span className="sc-row__t">
                              <b>{x.text}</b>
                              {x.detail && <span>{x.detail}</span>}
                            </span>
                            <AcIcon name="edit" className="sac-who__pen" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {editorFor(g)}
                </section>
              );
            })}

            <section className="sc-sec sac-sec" aria-labelledby="sac-inv-t">
              <header className="sc-sec__h">
                <h2 className="sc-h3" id="sac-inv-t">
                  Invitados
                </h2>
              </header>
              {!(sheet.guests ?? []).length && <p className="sac-none">Sin invitados. Si juega alguien de fuera, apúntalo y saldrá en los selectores.</p>}
              {(sheet.guests ?? []).length > 0 && (
                <ul className="sc-rows">
                  {(sheet.guests ?? []).map((g) => {
                    const inPlay = guestInUse(sheet.events, g.id);
                    const where = guestSlot(sheet, g.id) === "T" ? "En el siete" : "En el banquillo";
                    return (
                      <li key={g.id} className="sc-row sac-guest">
                        <Shirt kit={sheet.kit} />
                        <span className="sc-row__t">
                          <b>{g.name}</b>
                          <span>Invitado · {where}</span>
                        </span>
                        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-disabled={inPlay || undefined} aria-label={inPlay ? `No se puede quitar a ${g.name}: sale en el acta` : `Quitar a ${g.name}`} onClick={() => (inPlay ? status.show({ tone: "error", message: `No se puede quitar a ${g.name}: sale en el acta` }) : dropGuest(g.id))}>
                          Quitar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <form className="sac-inline" onSubmit={addGuestNamed}>
                <label className="sc-field">
                  <span>Añadir invitado</span>
                  <input className="vd-input" type="text" maxLength={30} placeholder="Rafa" value={guest} onChange={(e) => setGuest(e.target.value)} />
                </label>
                <button type="submit" className="vd-btn vd-glass vd-press vd-btn--sm">
                  Añadir
                </button>
              </form>
            </section>
          </div>

          <div className="sac-mins">
            <section className="sc-sec sac-sec" aria-labelledby="sac-sub-t">
              <header className="sc-sec__h">
                <h2 className="sc-h3" id="sac-sub-t">
                  Cambios · los minutos de cada jugador
                </h2>
                <span className="sc-sec__n">{subs.length}</span>
              </header>
              <p className="sc-small sac-mins__from">Sacados de la convocatoria y los cambios{mins.errors.length ? "" : ", como los calcula la web al publicar"}.</p>
              {mins.errors[0] && <p className="sac-err">{mins.errors[0]}</p>}
              {mins.rows.length > 0 ? (
                <>
                  <div className="sac-axis" aria-hidden="true">
                    {[0, Math.round(mins.duration / 2), mins.duration].map((t) => (
                      <span key={t} style={{ left: `${(100 * t) / mins.duration}%` }}>
                        {t}′
                      </span>
                    ))}
                  </div>
                  <ul className="sac-bars-list">
                    {mins.rows.map((x) => (
                      <li key={x.id} className="sac-mrow" aria-label={x.label}>
                        <Shirt kit={sheet.kit} num={x.num} />
                        <span className="sac-mrow__n">
                          <b>{x.name}</b>
                          <span>{x.word}</span>
                        </span>
                        <span className="sac-track" aria-hidden="true">
                          {x.spans.map((sp) => (
                            <i key={sp.t} className="sac-span" style={{ left: `${sp.left.toFixed(2)}%`, width: `${sp.width.toFixed(2)}%` }} title={sp.t} />
                          ))}
                        </span>
                        <b className="sac-mrow__m">{x.minutes}′</b>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="sac-none">Salen de la convocatoria: hazla primero.</p>
              )}
              <h3 className="sac-sub-h">Los cambios</h3>
              {!subs.length && <p className="sac-none">Sin cambios.</p>}
              {subs.length > 0 && (
                <ul className="sac-chips">
                  {subsShown.map((e) => {
                    const l = subLines.find((x) => x.id === e.id);
                    const t = l ? `${l.text}${l.detail ? ` · ${l.detail}` : ""}` : kindLabel(e.type);
                    return (
                      <li key={e.id}>
                        <button type="button" className="sac-chip vd-press" onClick={() => setEd({ group: "cam", id: e.id })} aria-label={`Corregir: ${t} (${l?.minute ?? "–"}′)`} aria-expanded={ed?.id === e.id}>
                          <b>{l?.minute ?? "–"}′</b>
                          <span>{t}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {subs.length > 8 && (
                <button type="button" className="vd-link sac-link" aria-expanded={allSubs} onClick={() => setAllSubs((a) => !a)}>
                  {allSubs ? "Ver menos" : `Ver los ${subs.length} cambios`}
                </button>
              )}
              <div className="sc-btnrow sac-mins__a">
                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => setEd({ group: "cam", id: null, type: "substitution" })} aria-expanded={ed?.group === "cam" && !ed.id && ed.type === "substitution"}>
                  Cambio
                </button>
                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => setEd({ group: "cam", id: null, type: "position_swap" })} aria-expanded={ed?.group === "cam" && !ed.id && ed.type === "position_swap"}>
                  Cambio de sitio
                </button>
              </div>
              {editorFor("cam")}
            </section>
          </div>
        </div>

        <aside className="sac-side" aria-label="¿Cuadra? y la cuenta">
          <section className="sac-sec sac-cuenta" aria-labelledby="sac-cuenta-t">
            <h2 className="sc-h3" id="sac-cuenta-t">
              La cuenta
            </h2>
            <p className="sac-cuenta__score" aria-label={`Manchester Piti ${gf}–${ga} ${rival}`}>
              <span className="sac-us">PITI</span>
              <b className="sc-score">
                {gf}–{ga}
              </b>
              <span className="sc-rival">
                <i aria-hidden="true">{rivalInitialsOf(sheet)}</i>
                {rivalCode(rival, sheet.rivalShort)}
              </span>
            </p>
            <dl className="sac-dl">
              <div>
                <dt>Marcador</dt>
                <dd>{gf + ga === 1 ? "1 gol" : `${gf + ga} goles`}</dd>
              </div>
              <div>
                <dt>Con goleador</dt>
                <dd aria-label={`Con goleador: ${withP} de ${gf}`}>
                  {withP} de {gf}
                </dd>
              </div>
              <div>
                <dt>
                  Con pase <small>(opcional)</small>
                </dt>
                <dd aria-label={`Con pase: ${withA} de ${gf} (opcional)`}>
                  {withA} de {gf}
                </dd>
              </div>
            </dl>
            {gf > 0 && (
              <ul className="sac-dots" aria-label="Los goles del Piti, uno a uno">
                {rows.map((g) => (
                  <li key={g.id} className={`sac-dot ${g.open ? "is-falta" : g.assist ? "is-pase" : "is-ok"}`}>
                    <span className="vd-vh">
                      Gol {g.n}: {g.open ? "falta el goleador" : g.assist ? "con goleador y pase" : "con goleador"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="sac-sec sac-chk" aria-labelledby="sac-chk-t">
            <header className="sc-sec__h">
              <h2 className="sc-h3" id="sac-chk-t">
                ¿Cuadra?
              </h2>
              {blockers.length > 0 && <span className="sc-tag sc-tag--toca">Faltan {blockers.length}</span>}
            </header>
            <ul className="sac-checks">
              {checks.map((c, i) => (
                <li key={`${c.title}-${i}`} className={`sac-check is-${c.k}`}>
                  <span className="sac-check__i" aria-hidden="true">
                    {c.icon}
                  </span>
                  <span className="sac-check__t">
                    <b>{c.title}</b>
                    {c.detail && <span>{c.detail}</span>}
                    {c.fix && c.fixLabel && (
                      <button type="button" className="vd-link sac-link" onClick={() => fix(c)}>
                        {c.fixLabel}
                      </button>
                    )}
                  </span>
                  <span className="sac-check__w">{c.word}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <ActaFoot s={s} onPublishTo={() => go(`${base}/publicar`)} />
    </div>
  );
}

/** «¿Quién marcó?» in its row: by dorsal, who was on the pitch at that minute first; then «¿Quién le dio el pase?». */
function ScorerPick(p: {
  s: SheetSession;
  goal: ReturnType<typeof goalRows>[number];
  step: 1 | 2;
  pool: string[];
  noConv: boolean;
  onScorer: (who: string | "og") => void;
  onAssist: (who: string | null) => void;
  onBack: () => void;
  onLater: () => void;
  onDrop: () => void;
  onClose: () => void;
  onConv: () => void;
}) {
  const { s, goal: g, step } = p;
  const [dorsal, setDorsal] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    box.current?.scrollIntoView?.({ block: "nearest" });
  }, [step]);
  const at = g.minute;
  const field = (at != null ? fieldAt(s.sheet, at) : s.sheet.starters).filter((id) => p.noConv || p.pool.includes(id));
  let rest = p.pool.filter((id) => !field.includes(id));
  let onField = field;
  if (step === 2) {
    onField = onField.filter((id) => id !== g.scorer);
    rest = rest.filter((id) => id !== g.scorer);
  }
  const num = (id: string) => (isGuestId(id) ? "INV" : (s.info(id).number ?? "—").toString());
  const choose = (id: string) => (step === 1 ? p.onScorer(id) : p.onAssist(id));
  // (a dorsal picks as soon as no other dorsal starts with it: «1» waits while there is a 10 or a 14; Enter picks it)
  const typed = (v: string, enter = false) => {
    const d = v.replace(/\D/g, "").slice(0, 2);
    const all = [...onField, ...rest];
    const exact = d ? all.find((id) => num(id) === d) : undefined;
    const longer = d ? all.some((id) => num(id) !== d && num(id).startsWith(d)) : false;
    const hit = exact && (enter || !longer) ? exact : undefined;
    if (hit) {
      setDorsal("");
      choose(hit);
      return;
    }
    setDorsal(d);
  };
  const title = step === 1 ? "¿Quién marcó?" : "¿Quién le dio el pase?";
  const grid = (ids: string[]) => (
    <ul className="sac-pick__grid">
      {ids.map((id) => (
        <li key={id}>
          <button type="button" className="sac-pp vd-press" onClick={() => choose(id)} aria-label={step === 1 ? `${s.nameOf(id)} marcó el gol ${g.n}` : `Pase de ${s.nameOf(id)}`} aria-pressed={(step === 1 ? g.scorer : g.assist) === id}>
            <Shirt kit={s.sheet.kit} num={num(id)} />
            <b className="sc-num">{num(id)}</b>
            <span>{s.nameOf(id)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      p.onClose();
    }
  };
  return (
    <div ref={box} className="sac-pick vd-glass vd-glass--deep" role="group" aria-label={title} onKeyDown={onKey}>
      <header className="sac-pick__h">
        <h3 className="sc-h3">{title}</h3>
        <p className="sc-small">
          Gol {g.n}
          {at != null ? ` (${at}′)` : ""} · paso {step} de 2
        </p>
        <button type="button" className="vd-ibtn vd-glass vd-press" onClick={p.onClose} aria-label="Cerrar el selector">
          <VIcon name="close" size={20} />
        </button>
      </header>
      {p.noConv && (
        <p className="sac-pick__note">
          Aún no hay convocados en este partido: elige de la plantilla o{" "}
          <button type="button" className="vd-link sac-link" onClick={p.onConv}>
            haz la convocatoria
          </button>
          .
        </p>
      )}
      <label className="sac-pick__dorsal">
        <span>Teclea el dorsal del {step === 1 ? "goleador" : "asistente"}</span>
        <input className="vd-input" type="text" inputMode="numeric" maxLength={2} value={dorsal} onChange={(e) => typed(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), typed(dorsal, true))} placeholder="Dorsal" />
      </label>
      <p className="sac-pick__gt">{at != null ? `En el campo en el ${at}′ · titulares primero` : "En el campo · titulares primero"}</p>
      {grid(onField)}
      {rest.length > 0 && (
        <>
          <p className="sac-pick__gt">{p.noConv ? "El resto de la plantilla" : at != null ? "Banquillo y los que ya salieron" : "Banquillo"}</p>
          {grid(rest)}
        </>
      )}
      <footer className="sac-pick__f">
        {step === 1 ? (
          <>
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => p.onScorer("og")}>
              Autogol de {s.rival}
            </button>
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={p.onLater}>
              Lo completo luego
            </button>
            <button type="button" className="vd-link sac-link sac-link--mal" onClick={p.onDrop}>
              Quitar este gol
            </button>
          </>
        ) : (
          <>
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm vd-btn--pri" onClick={() => p.onAssist(null)}>
              Sin asistencia
            </button>
            <button type="button" className="vd-link sac-link" onClick={p.onBack}>
              ← Cambiar goleador
            </button>
          </>
        )}
      </footer>
    </div>
  );
}

/** A card, a change, a penalty or the rest, added or corrected in place (board `sac-ed`). */
function PlayEditor({ s, group, event, initial, onClose, onRemove }: { s: SheetSession; group: EventGroup; event: MatchEvent | null; initial?: EventType; onClose: () => void; onRemove: (e: MatchEvent) => void }) {
  const status = useStatus();
  const kinds = KINDS[group];
  const [type, setType] = useState<EventType>(event?.type ?? initial ?? kinds[0].type);
  const [minute, setMinuteText] = useState(event?.minute !== undefined ? String(event.minute) : "");
  const [player, setPlayer] = useState(event?.playerId ?? "");
  const [inPlayer, setInPlayer] = useState(event?.inPlayerId ?? "");
  const [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    form.current?.querySelector<HTMLSelectElement | HTMLInputElement>("select,input")?.focus({ preventScroll: true });
    form.current?.scrollIntoView?.({ block: "nearest" });
  }, []);
  const D = Number.isFinite(s.sheet.duration) ? s.sheet.duration : 50;
  const sub = type === "substitution";
  const swap = type === "position_swap";
  const noP = playerMode(type) === "none";
  const m = minute.trim() === "" ? null : Number(minute);
  const onAt = m != null && Number.isInteger(m) && m <= D ? fieldAt(s.sheet, m, event?.id) : null;
  const called = [...s.sheet.starters, ...s.sheet.bench];
  const opts = (called.length ? called : s.roster.map((p) => p.id)).map((id) => ({ id, t: `${isGuestId(id) ? "INV" : (s.info(id).number ?? "—")} · ${s.nameOf(id)}` }));
  const label = (e: MatchEvent) => {
    const nm = (id?: string) => (id ? s.nameOf(id) : "");
    if (e.type === "substitution") return `Entra ${nm(e.inPlayerId)} · sale ${nm(e.playerId)}`;
    if (e.type === "position_swap") return `${nm(e.playerId)} y ${nm(e.inPlayerId)} se cambian el sitio`;
    return `${kindLabel(e.type)}${e.playerId ? ` · ${nm(e.playerId)}` : ""}`;
  };
  const save = (e: FormEvent) => {
    e.preventDefault();
    let why = checkEvent({ type, minute, player, inPlayer, duration: D, field: swap && onAt ? onAt : undefined });
    if (!why && sub && onAt) {
      if (!onAt.includes(player)) why = `En el minuto ${minute}, ${s.nameOf(player)} no está en el campo: elige quién sale.`;
      else if (onAt.includes(inPlayer)) why = `En el minuto ${minute}, ${s.nameOf(inPlayer)} ya está en el campo: elige uno del banquillo.`;
    }
    if (why) {
      setError(why);
      return;
    }
    const next: MatchEvent = { ...event, id: event?.id ?? newId(), type, minute: Number(minute), elapsedSeconds: event?.minute === Number(minute) ? event.elapsedSeconds : undefined, playerId: player && !noP ? player : undefined, inPlayerId: sub || swap ? inPlayer : undefined };
    s.update((v) => upsertEvent(v, next));
    status.show({ tag: event ? "Corregido" : "Apuntado", message: `${event ? "Corregido" : "Apuntado"}: ${label(next)} · ${next.minute}′` });
    onClose();
  };
  const title = event ? "Corregir la jugada" : `Añadir en ${group === "cam" ? "Cambios" : GROUP_NAME[group]}`;
  const sel = (value: string, set: (v: string) => void, lab: string, none?: string) => (
    <label className="sc-field">
      <span>{lab}</span>
      <select
        className="vd-input"
        value={value}
        onChange={(e) => {
          set(e.target.value);
          setError("");
        }}
      >
        <option value="">{none ?? "Elige por dorsal…"}</option>
        {opts.map((o) => (
          <option key={o.id} value={o.id}>
            {o.t}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <form ref={form} className="sac-ed vd-glass vd-glass--deep" onSubmit={save} onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), onClose())} aria-label={title}>
      <h3 className="sc-h3">{title}</h3>
      <div className="sc-form">
        {kinds.length > 1 && (
          <label className="sc-field">
            <span>Qué pasó</span>
            <select
              className="vd-input"
              value={type}
              onChange={(e) => {
                setType(e.target.value as EventType);
                setError("");
              }}
            >
              {kinds.map((k) => (
                <option key={k.type} value={k.type}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="sc-field">
          <span>Minuto (de 0 a {D})</span>
          <input
            className="vd-input"
            type="text"
            inputMode="numeric"
            maxLength={3}
            value={minute}
            onChange={(e) => {
              setMinuteText(e.target.value.replace(/\D/g, "").slice(0, 3));
              setError("");
            }}
          />
        </label>
        {!noP && sel(player, setPlayer, sub ? "Sale del campo" : swap ? "¿Quiénes se cambian? El primero" : "Jugador", playerMode(type) === "optional" ? "Equipo · sin jugador" : undefined)}
        {(sub || swap) && sel(inPlayer, setInPlayer, sub ? "Entra al campo · del banquillo" : "Con quién se cambia")}
        {noP && (
          <p className="sc-field sac-ed__team">
            <span>Equipo · sin jugador</span>
          </p>
        )}
      </div>
      {onAt && (sub || swap) && <p className="sc-small">En el {minute}′ están en el campo: {onAt.map((id) => s.nameOf(id)).join(", ") || "nadie"}</p>}
      {error && (
        <p className="sac-err" role="alert">
          {error}
        </p>
      )}
      <div className="sc-btnrow">
        <button type="submit" className="vd-btn vd-glass vd-press vd-btn--sm vd-btn--pri">
          Guardar
        </button>
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={onClose}>
          Cancelar
        </button>
        {event && (
          <button type="button" className="vd-link sac-link sac-link--mal" onClick={() => onRemove(event)}>
            Quitar
          </button>
        )}
      </div>
    </form>
  );
}

