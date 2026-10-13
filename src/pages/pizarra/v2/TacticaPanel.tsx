// La pizarra · Bloque 4 — the Plan tab's tactical depth, as thin views over pure data (phases.ts, tacStyles.ts,
// condPlan.ts, record.ts, chemPlayer.ts): what this seven has done, «Con balón · Sin balón · Transición» with
// the shape without the ball, the «Fases» scrubber, the predefined styles (previewed before applying), the
// conditional plan and its live suggestion, and the «+2 química aquí» badge while a cromo is carried. The
// board does the changes and says them (its one announcer): nothing here is a live region.
import { useId } from "react";
import { createPortal } from "react-dom";
import type { FormationName } from "../formations";
import { systemDef } from "../../../lib/formations";
import type { CondKey, CondRule, CondWhen, StyleId } from "../../../lib/tacticaSchemas";
import { COND_KEYS, COND_WHEN, TACTICA_LIMITS } from "../../../lib/tacticaSchemas";
import { Icon } from "./icons";
import { SYSTEMS } from "./geometry";
import { FASES, SHAPE_VIEWS, type FaseId, type ShapeView } from "./phases";
import { STYLES, type StyleDiff } from "./tacStyles";
import { COND_MAX, condOptions, KEY_LABEL, ruleTxt, WHEN_LABEL, type RulePatch } from "./condPlan";
import { vars } from "./view";
import "../../../styles/pizarra-tactica.css";

// ── lo planeado frente a lo jugado ──
export function PlanRecord({ rec, pvp }: { rec: string | null; pvp: string | null }) {
  if (!rec && !pvp) return null;
  return (
    <div className="t4-rec" role="group" aria-label="Lo planeado frente a lo jugado">
      {rec && <b>{rec}</b>}
      {pvp && <small>{pvp}</small>}
    </div>
  );
}

// ── con balón · sin balón · transición, and the fases ──
export interface PhasePanelProps {
  ro: boolean;
  shape: ShapeView;
  fase: FaseId;
  onShape: (v: ShapeView) => void;
  onFase: (f: FaseId) => void;
  /** The shape without the ball: its system, in words, whether it is the board's own. */
  off: { formation: FormationName; txt: string; own: boolean };
  /** «ALCIDES corre demasiado entre fases (24 m)». */
  runners: string[];
  onOffSystem: (f: FormationName) => void;
  onOffBlock: (d: 1 | -1) => void;
  onOffWiden: (d: 1 | -1) => void;
  onOffClear: () => void;
}

export function PhasePanel(p: PhasePanelProps) {
  const uid = useId();
  const fi = Math.max(0, FASES.findIndex((f) => f.id === p.fase));
  const cur = FASES[fi];
  return (
    <section className="t4-box" aria-labelledby={uid + "h"}>
      <h3 id={uid + "h"} className="lg-h">
        El plan en el campo
      </h3>
      <div className="t4-seg" role="group" aria-label="Con balón, sin balón o transición">
        {SHAPE_VIEWS.map((s) => (
          <button key={s.id} type="button" aria-pressed={p.shape === s.id} onClick={() => p.onShape(s.id)}>
            {s.l}
          </button>
        ))}
      </div>
      {p.shape !== "con" && (
        <>
          <p className="t4-d">
            <b>Sin balón:</b> {p.off.txt}
            {!p.off.own && " (propuesta: tócala para guardarla)"}
          </p>
          {!p.ro && (
            <div className="t4-row">
              <label className="t4-sr" htmlFor={uid + "sys"}>
                Sistema sin balón
              </label>
              <select id={uid + "sys"} value={p.off.formation} onChange={(e) => p.onOffSystem(e.target.value as FormationName)}>
                {SYSTEMS.map((f) => (
                  <option key={f} value={f}>
                    {systemDef(f).label} · {systemDef(f).name}
                  </option>
                ))}
              </select>
              <button type="button" className="b3" onClick={() => p.onOffBlock(1)}>
                Bloque atrás
              </button>
              <button type="button" className="b3" onClick={() => p.onOffBlock(-1)}>
                Bloque arriba
              </button>
              <button type="button" className="b3" onClick={() => p.onOffWiden(-1)}>
                Más juntos
              </button>
              <button type="button" className="b3" onClick={() => p.onOffWiden(1)}>
                Más abiertos
              </button>
              {p.off.own && (
                <button type="button" className="b3" onClick={p.onOffClear}>
                  <Icon n="reset" />
                  Quitar
                </button>
              )}
            </div>
          )}
        </>
      )}
      {p.runners.map((r) => (
        <p key={r} className="t4-warn">
          <Icon n="alert" w={14} />
          <span>{r}</span>
        </p>
      ))}
      <div className="t4-fases">
        <label htmlFor={uid + "f"} className="t4-d">
          <b>Fases</b> · {cur.l}: {cur.d}
        </label>
        <input
          id={uid + "f"}
          type="range"
          min={0}
          max={FASES.length - 1}
          step={1}
          value={p.shape === "con" ? fi : 0}
          aria-valuetext={cur.l}
          disabled={p.shape !== "con"}
          onChange={(e) => p.onFase(FASES[Number(e.target.value)]?.id ?? "plan")}
        />
        <div className="t4-ticks" aria-hidden="true">
          {FASES.map((f, k) => (
            <span key={f.id} className={k === fi && p.shape === "con" ? "on" : ""}>
              {f.l}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── estilos predefinidos ──
export interface StylePanelProps {
  ro: boolean;
  /** The style the board plays now («Presión alta (retocado)»), if any. */
  current: string | null;
  /** The style being previewed (its diff on screen and on the pitch). */
  pick: StyleId | null;
  diff: StyleDiff | null;
  onPick: (id: StyleId | null) => void;
  onApply: () => void;
}

export function StylePanel(p: StylePanelProps) {
  const uid = useId();
  const s = STYLES.find((x) => x.id === p.pick) ?? null;
  return (
    <section className="t4-box" aria-labelledby={uid + "h"}>
      <h3 id={uid + "h"} className="lg-h">
        Estilos {p.current && <span className="cnt">· ahora: {p.current}</span>}
      </h3>
      <div className="t4-sty" role="group" aria-label="Estilos predefinidos: elige uno para ver qué cambia">
        {STYLES.map((x) => (
          <button key={x.id} type="button" aria-pressed={p.pick === x.id} onClick={() => p.onPick(p.pick === x.id ? null : x.id)} disabled={p.ro}>
            {x.name}
            <small>{x.pro}</small>
          </button>
        ))}
      </div>
      {s && p.diff && (
        <div className="t4-pv" role="group" aria-label={"Vista previa: " + s.name}>
          <dl className="t4-pc">
            <dt>A favor</dt>
            <dd>{s.pro}</dd>
            <dt>En contra</dt>
            <dd>{s.con}</dd>
          </dl>
          {p.diff.rows.length ? (
            <ul aria-label="Lo que cambia">
              {p.diff.rows.map((r) => (
                <li key={r.key}>
                  <b>{r.label}:</b> {r.from} → {r.to}
                </li>
              ))}
            </ul>
          ) : (
            <p className="t4-d">Ya juegas así: no cambia nada.</p>
          )}
          {p.diff.shape && <p className="t4-d">{p.diff.shape}.</p>}
          <div className="t4-row">
            <button type="button" className="b3" onClick={p.onApply} disabled={p.ro || !p.diff.rows.length}>
              <Icon n="check" />
              Aplicar «{s.name}»
            </button>
            <button type="button" className="b3" onClick={() => p.onPick(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── el plan condicional ──
export interface CondPanelProps {
  ro: boolean;
  rules: CondRule[];
  /** The players who can be in a rule's cambio (the squad), with their names. */
  people: { id: string; label: string }[];
  name: (id: string) => string;
  /** In the live match, what the plan says to do now. */
  live: LiveSuggestionView | null;
  onAdd: () => void;
  onDel: (id: string) => void;
  onPatch: (id: string, p: RulePatch) => void;
}

export interface LiveSuggestionView {
  txt: string;
  canApply: boolean;
  onApply: () => void;
}

/** «Toca el plan: …» and «Aplicar» (the live card and the Plan tab show the same). */
export function LiveSuggestion({ v }: { v: LiveSuggestionView }) {
  return (
    <div className="t4-live" role="group" aria-label="El plan condicional, ahora">
      <p>
        <Icon n="whistle" w={15} /> {v.txt}
      </p>
      {v.canApply && (
        <button type="button" className="b3" onClick={v.onApply}>
          <Icon n="check" />
          Aplicar el plan
        </button>
      )}
    </div>
  );
}

function RuleRow({ r, ro, people, name, onDel, onPatch }: { r: CondRule; ro: boolean; people: CondPanelProps["people"]; name: (id: string) => string; onDel: () => void; onPatch: (p: RulePatch) => void }) {
  const uid = useId();
  const txt = ruleTxt(r, name);
  return (
    <li className="t4-rule">
      <p>{txt}</p>
      {!ro && (
        <div className="t4-row" role="group" aria-label={"Editar: " + txt}>
          <label className="t4-sr" htmlFor={uid + "w"}>
            Si vamos
          </label>
          <select id={uid + "w"} value={r.when} onChange={(e) => onPatch({ when: e.target.value as CondWhen })}>
            {COND_WHEN.map((w) => (
              <option key={w} value={w}>
                {WHEN_LABEL[w]}
              </option>
            ))}
          </select>
          {r.when !== "empate" && (
            <>
              <label className="t4-sr" htmlFor={uid + "b"}>
                Por cuántos goles
              </label>
              <select id={uid + "b"} value={r.by} onChange={(e) => onPatch({ by: Number(e.target.value) })}>
                {Array.from({ length: TACTICA_LIMITS.by }, (_, k) => k + 1).map((n) => (
                  <option key={n} value={n}>
                    por {n}
                  </option>
                ))}
              </select>
            </>
          )}
          <span className="t4-d" aria-hidden="true">
            desde el
          </span>
          <input type="number" inputMode="numeric" min={0} max={TACTICA_LIMITS.from} value={r.from} onChange={(e) => onPatch({ from: Number(e.target.value) })} aria-label="Desde el minuto" />
          <span aria-hidden="true">′ →</span>
          <label className="t4-sr" htmlFor={uid + "k"}>
            Consigna
          </label>
          <select id={uid + "k"} value={r.key} onChange={(e) => onPatch({ key: e.target.value as CondKey })}>
            {COND_KEYS.map((k) => (
              <option key={k} value={k}>
                {KEY_LABEL[k]}
              </option>
            ))}
          </select>
          <label className="t4-sr" htmlFor={uid + "v"}>
            Valor
          </label>
          <select id={uid + "v"} value={r.value} onChange={(e) => onPatch({ value: e.target.value })}>
            {condOptions(r.key).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <label className="t4-sr" htmlFor={uid + "o"}>
            Cambio: sale
          </label>
          <select id={uid + "o"} value={r.sub?.out ?? ""} onChange={(e) => onPatch({ sub: e.target.value ? { out: e.target.value, in: r.sub?.in ?? "" } : null })}>
            <option value="">Sin cambio</option>
            {people.map((x) => (
              <option key={x.id} value={x.id}>
                sale {x.label}
              </option>
            ))}
          </select>
          <label className="t4-sr" htmlFor={uid + "i"}>
            Cambio: entra
          </label>
          <select id={uid + "i"} value={r.sub?.in ?? ""} disabled={!r.sub} onChange={(e) => onPatch({ sub: r.sub && e.target.value ? { out: r.sub.out, in: e.target.value } : null })}>
            <option value="">—</option>
            {people
              .filter((x) => x.id !== r.sub?.out)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  entra {x.label}
                </option>
              ))}
          </select>
          <button type="button" className="ib" onClick={onDel} aria-label={"Quitar la regla: " + txt}>
            <Icon n="trash" w={16} />
          </button>
        </div>
      )}
    </li>
  );
}

export function CondPanel(p: CondPanelProps) {
  const uid = useId();
  return (
    <section className="t4-box" aria-labelledby={uid + "h"}>
      <h3 id={uid + "h"} className="lg-h">
        Plan condicional <span className="cnt">· {p.rules.length} de {COND_MAX}</span>
      </h3>
      {p.live && <LiveSuggestion v={p.live} />}
      {p.rules.length ? (
        <ul className="t4-rules">
          {p.rules.map((r) => (
            <RuleRow key={r.id} r={r} ro={p.ro} people={p.people} name={p.name} onDel={() => p.onDel(r.id)} onPatch={(x) => p.onPatch(r.id, x)} />
          ))}
        </ul>
      ) : (
        <p className="t4-d">Sin reglas: «si vamos ganando por 2 desde el 30′, mentalidad defensiva».</p>
      )}
      {!p.ro && p.rules.length < COND_MAX && (
        <div className="t4-row">
          <button type="button" className="b3" onClick={p.onAdd}>
            <Icon n="plus" w={15} />
            Añadir regla
          </button>
        </div>
      )}
    </section>
  );
}

// ── «+2 química aquí» over the spot a carried cromo would land on (in the pitch frame) ──
export function DropBadge({ host, at, txt, down }: { host: HTMLElement | null; at: { x: number; y: number } | null; txt: string; down: boolean }) {
  if (!host || !at) return null;
  return createPortal(
    <span className={"t4-drop" + (down ? " dn" : "")} style={vars({ "--x": at.x.toFixed(2), "--y": at.y.toFixed(2) })} aria-hidden="true">
      {txt}
    </span>,
    host,
  );
}

/** «14 de 21 ◆» next to the química's 0–100. */
export function TeamDiamonds({ n }: { n: number }) {
  return (
    <p className="t4-dm">
      Química por jugador: <b>{n}</b> de 21 <span aria-hidden="true">◆</span>
    </p>
  );
}
