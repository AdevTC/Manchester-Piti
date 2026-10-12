// Siete → Cambios: the match day on the sheet. The live card while the match is played (the minute, the
// score, the tanda that is due or the next one with its countdown, «Hacer el cambio» for the captains,
// «Anotar en el acta», who can't go on and «Recalcular»); the timeline 0′…90′ with the tandas as markers
// (drag one, or move it with the arrows) and the scrub that shows the seven at any minute on the pitch;
// the tandas as FUT rows «SALE X → ENTRA Y»; «Repartir minutos» with its preview; the minutes table; and
// the galones in order (brazalete, vice, 1º · 2º · 3º of each dead ball). A thin view: useCambios does
// the changes and the board's one announcer says them.
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import type { TakerKind } from "../formations";
import { Icon } from "./icons";
import type { CambiosView, Opt, SubRow } from "./cambiosView";
import { ORDINAL, TAKER_KINDS, TAKER_LABEL, TAKER_LETTER } from "./takers";
import { vars } from "./view";

export interface LiveCard {
  minute: number;
  score: string;
  /** «Toca el cambio · 25′» / «Próximo cambio · 25′ (en 2′)» / «Sin más cambios en el plan». */
  line: string;
  due: boolean;
  /** The cambios of that tanda still to make. */
  pending: { id: string; txt: string }[];
  /** Captains: «Hacer el cambio» writes them in the acta. */
  canWrite: boolean;
  busy: boolean;
  /** «Anotar en el acta» (captains): the admin's En juego for goals and cards. */
  actaHref: string | null;
  /** Who is in the match now (on the pitch, then the bench) and who can't go on. */
  people: { id: string; label: string; field: boolean; off: boolean }[];
  /** «P TELLO · F — · E KEVIN». */
  takers: { l: string; who: string; k: string }[];
}

export interface TakersEdit {
  options: Opt[];
  captainId: string;
  viceId: string;
  lists: Record<TakerKind, string[]>;
}

export interface CambiosTabProps {
  v: CambiosView;
  ro: boolean;
  live: LiveCard | null;
  /** More on the live card (the conditional plan's suggestion). */
  liveExtra?: ReactNode;
  /** «Rotar portero» for «Repartir minutos». */
  rotK: boolean;
  /** «Repartir minutos» / «Recalcular»'s proposal, until it is applied or dropped. */
  preview: { title: string; waves: string[]; rows: { id: string; name: string; was: number; now: number }[] } | null;
  takers: TakersEdit;
  onScrub: (t: number) => void;
  onNow?: () => void;
  onAdd: (min?: number) => void;
  onOut: (id: string, out: string) => void;
  onIn: (id: string, inn: string) => void;
  onDel: (id: string) => void;
  onMoveWave: (from: number, to: number) => void;
  onRepartir: () => void;
  onRotK: () => void;
  onApply: () => void;
  onDiscard: () => void;
  onHacer: () => void;
  onRecalc: () => void;
  onOff: (id: string) => void;
  onCaptain: (role: "captainId" | "viceId", id: string) => void;
  onTaker: (kind: TakerKind, pos: number, id: string) => void;
}

/** The timeline: 0′…D′ with the tandas as markers (drag one, or arrows: 1′, ⇧ 5′) and the scrub. */
function Timeline({ v, ro, live, onScrub, onNow, onMoveWave }: Pick<CambiosTabProps, "v" | "ro" | "onScrub" | "onNow" | "onMoveWave"> & { live: number | null }) {
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  // (a marker just dragged doesn't also take its click: the scrub goes where it was let go)
  const dragged = useRef(false);
  const D = v.duration;
  const minAt = (clientX: number): number => {
    const r = track.current?.getBoundingClientRect();
    if (!r || !r.width) return 0;
    return Math.max(1, Math.min(D - 1, Math.round(((clientX - r.left) / r.width) * D)));
  };
  const onDown = (e: RPointerEvent<HTMLButtonElement>, min: number) => {
    if (ro) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ from: min, to: min });
  };
  const onMove = (e: RPointerEvent<HTMLButtonElement>) => {
    if (drag) setDrag({ ...drag, to: minAt(e.clientX) });
  };
  const onUp = () => {
    dragged.current = !!drag && drag.to !== drag.from;
    if (drag && drag.to !== drag.from) onMoveWave(drag.from, drag.to);
    setDrag(null);
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, min: number) => {
    if (ro || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    e.stopPropagation();
    const d = (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 5 : 1);
    onMoveWave(min, min + d);
  };
  const ticks = Array.from(new Set([0, Math.round(D / 2), D]));
  return (
    <div className="cb-tl">
      <div className="cb-tr" ref={track}>
        <i className="cb-sc" style={vars({ "--p": (v.scrub / D) * 100 })} aria-hidden="true" />
        {live != null && <i className="cb-now" style={vars({ "--p": (live / D) * 100 })} aria-hidden="true" />}
        {v.markers.map((m) => {
          const at = drag?.from === m.min ? drag.to : m.min;
          return (
            <button
              key={m.min}
              type="button"
              className={"cb-mk" + (drag?.from === m.min ? " drag" : "")}
              style={vars({ "--p": (at / D) * 100 })}
              aria-label={m.aria}
              aria-disabled={ro || undefined}
              onPointerDown={(e) => onDown(e, m.min)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={() => setDrag(null)}
              onKeyDown={(e) => onKey(e, m.min)}
              onClick={() => {
                if (dragged.current) dragged.current = false;
                else onScrub(m.min);
              }}
            >
              <b>{at}′</b>
              {m.n > 1 && <small>×{m.n}</small>}
            </button>
          );
        })}
      </div>
      <div className="cb-tk" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={vars({ "--p": (t / D) * 100 })}>
            {t}′
          </span>
        ))}
      </div>
      <label className="cb-scr">
        <span>El campo en el minuto</span>
        <input type="range" min={0} max={D} step={1} value={v.scrub} onChange={(e) => onScrub(+e.target.value)} aria-valuetext={v.scrubTxt} />
        <b aria-hidden="true">{v.scrub}′</b>
        {onNow && (
          <button type="button" className="b3" onClick={onNow}>
            Ahora
          </button>
        )}
      </label>
      <p className="cb-st">{v.scrubTxt}</p>
    </div>
  );
}

function SubLine({ r, ro, onOut, onIn, onDel }: { r: SubRow; ro: boolean } & Pick<CambiosTabProps, "onOut" | "onIn" | "onDel">) {
  const uid = useId();
  return (
    <li className={"cb-r" + (r.why ? " bad" : "") + (r.made ? " made" : "")}>
      <div className="cb-io">
        <span className="cb-k out">Sale</span>
        {ro ? (
          <b>
            {r.outNum} · {r.outName}
          </b>
        ) : (
          <select value={r.out} onChange={(e) => onOut(r.id, e.target.value)} aria-label={"Sale en el " + r.min + "′"} aria-describedby={r.why ? uid : undefined}>
            {r.outOpts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <Icon n="swap" w={16} />
      <div className="cb-io">
        <span className="cb-k in">Entra</span>
        {ro ? (
          <b>
            {r.inNum} · {r.inName}
          </b>
        ) : (
          <select value={r.in} onChange={(e) => onIn(r.id, e.target.value)} aria-label={"Entra en el " + r.min + "′"} aria-describedby={r.why ? uid : undefined}>
            {r.inOpts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {r.made && (
        <em className="cb-ok">
          <Icon n="check" w={13} />
          En el acta
        </em>
      )}
      {!ro && (
        <button type="button" className="ib" onClick={() => onDel(r.id)} aria-label={"Quitar el cambio: entra " + r.inName + " por " + r.outName + " en el " + r.min + "′"}>
          <Icon n="trash" w={16} />
        </button>
      )}
      {r.why && (
        <p className="cb-why" id={uid}>
          <Icon n="alert" w={13} />
          {r.why}
        </p>
      )}
    </li>
  );
}

export function CambiosTab(p: CambiosTabProps) {
  const { v, ro, live } = p;
  const rotId = useId();
  return (
    <div className="pg cbt">
      {live && (
        <section className={"cb-live" + (live.due ? " due" : "")} aria-label="Partido en directo">
          <h3 className="lg-h">
            En directo · {live.minute}′ <span className="cnt">{live.score}</span>
          </h3>
          <p className="cb-nx">
            <Icon n={live.due ? "whistle" : "bell"} w={16} />
            <b>{live.line}</b>
          </p>
          {p.liveExtra}
          {live.pending.length > 0 && (
            <ul className="cb-pend">
              {live.pending.map((x) => (
                <li key={x.id}>{x.txt}</li>
              ))}
            </ul>
          )}
          <div className="cb-act">
            {live.canWrite ? (
              <button type="button" className="b3 cb-go" onClick={p.onHacer} disabled={live.busy || !live.pending.length}>
                <Icon n="swap" w={16} />
                {live.busy ? "Apuntando…" : "Hacer el cambio"}
                <kbd aria-hidden="true">H</kbd>
              </button>
            ) : (
              <p className="empty">Los capitanes apuntan los cambios en el acta.</p>
            )}
            {live.actaHref && (
              <a className="b3" href={live.actaHref}>
                <Icon n="plan" w={16} />
                Anotar en el acta
              </a>
            )}
          </div>
          <p className="cb-tn">
            Lanzadores ahora:{" "}
            {live.takers.map((t) => (
              <span key={t.k}>
                <b aria-hidden="true">{t.l}</b>
                <span className="sr-only">{TAKER_LABEL[t.k as TakerKind]}: </span>
                {t.who}
              </span>
            ))}
          </p>
          {!ro && (
            <>
              <h3>¿Quién no puede seguir?</h3>
              <div className="cb-ppl" role="group" aria-label="Quién no puede seguir o no ha llegado">
                {live.people.map((x) => (
                  <button key={x.id} type="button" className={"chip3" + (x.off ? " on" : "")} aria-pressed={x.off} aria-label={x.label + (x.field ? ", en el campo" : ", en el banquillo")} onClick={() => p.onOff(x.id)}>
                    {x.label}
                    <small>{x.off ? "no puede" : x.field ? "en el campo" : "banquillo"}</small>
                  </button>
                ))}
              </div>
              <button type="button" className="b3" onClick={p.onRecalc}>
                <Icon n="rot" w={16} />
                Recalcular desde el {live.minute}′
              </button>
            </>
          )}
        </section>
      )}
      <h3 className="lg-h">
        Los cambios <span className="cnt">{v.count}</span>
      </h3>
      <Timeline v={v} ro={ro} live={live?.minute ?? null} onScrub={p.onScrub} onNow={p.onNow} onMoveWave={p.onMoveWave} />
      {v.waves.length === 0 && <p className="empty">{ro ? "Este tablero no tiene cambios planeados." : "Añade un cambio o reparte los minutos: el plan sale en la charla y en el cartel."}</p>}
      {v.waves.map((w) => (
        <section key={w.min} className={"cb-w" + (w.past ? " past" : "")} aria-label={"Tanda del " + w.min + "′"}>
          <div className="cb-wh">
            <b>{w.min}′</b>
            {!ro && (
              <div className="stp" role="group" aria-label={"Minuto de la tanda del " + w.min + "′"}>
                <button type="button" className="ib" onClick={() => p.onMoveWave(w.min, w.min - 1)} disabled={w.min <= 1} aria-label={"Tanda del " + w.min + "′: un minuto antes"}>
                  <Icon n="chevL" w={16} />
                </button>
                <button type="button" className="ib" onClick={() => p.onMoveWave(w.min, w.min + 1)} disabled={w.min >= v.duration - 1} aria-label={"Tanda del " + w.min + "′: un minuto después"}>
                  <Icon n="chevR" w={16} />
                </button>
              </div>
            )}
            {!ro && v.canAdd && (
              <button type="button" className="b3" onClick={() => p.onAdd(w.min)}>
                <Icon n="plus" w={15} />
                Otro en el {w.min}′
              </button>
            )}
          </div>
          <ul className="cb-rs">
            {w.rows.map((r) => (
              <SubLine key={r.id} r={r} ro={ro} onOut={p.onOut} onIn={p.onIn} onDel={p.onDel} />
            ))}
          </ul>
        </section>
      ))}
      {!ro && (
        <div className="cb-tools">
          <button type="button" className="b3" onClick={() => p.onAdd()} disabled={!v.canAdd}>
            <Icon n="plus" w={16} />
            Añadir cambio
            <kbd aria-hidden="true">N</kbd>
          </button>
          {!live && (
            <>
              <button type="button" className="b3" onClick={p.onRepartir}>
                <Icon n="wand" w={16} />
                Repartir minutos
                <kbd aria-hidden="true">M</kbd>
              </button>
              <button type="button" className="tg" onClick={p.onRotK} aria-pressed={p.rotK} aria-describedby={rotId}>
                Rotar portero
              </button>
              <p id={rotId} className="empty">
                {p.rotK ? "El portero también rota, con otro portero natural." : "El portero juega el partido entero."}
              </p>
            </>
          )}
        </div>
      )}
      {p.preview && (
        <section className="cb-pv" aria-label={p.preview.title}>
          <h3 className="lg-h">{p.preview.title}</h3>
          {p.preview.waves.length ? (
            <ol className="cb-pw">
              {p.preview.waves.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          ) : (
            <p className="empty">Sin cambios: nadie en el banquillo para entrar.</p>
          )}
          {p.preview.rows.length > 0 && (
            <ul className="cb-pd" aria-label="Minutos, antes y después">
              {p.preview.rows.map((r) => (
                <li key={r.id}>
                  <b>{r.name}</b>
                  <span>
                    {r.was}′ → {r.now}′
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="cb-act">
            <button type="button" className="b3 cb-go" onClick={p.onApply}>
              <Icon n="check" w={16} />
              Aplicar
            </button>
            <button type="button" className="b3" onClick={p.onDiscard}>
              Descartar
            </button>
          </div>
        </section>
      )}
      <h3 className="lg-h">
        Minutos <span className="cnt">{v.table.txt}</span>
      </h3>
      <ul className="cb-mt" aria-label="Minutos planeados de cada uno">
        {v.table.rows.map((r) => (
          <li key={r.id} className={"cb-m" + (r.eaten ? " eaten" : "") + (r.off ? " " + r.off : "")}>
            <span className="cb-mn">
              <b>{r.num}</b>
              {r.name}
              {r.keeper && <em>POR</em>}
            </span>
            <i style={vars({ "--v": r.pct, "--t": r.keeper ? 100 : v.table.fairPct })} aria-hidden="true" />
            <b>{r.min}′</b>
            <small>{r.eaten ? "Se come banquillo" : r.delta}</small>
          </li>
        ))}
      </ul>
      <h3 className="lg-h">Galones en orden</h3>
      <div className="cb-gal">
        {(["captainId", "viceId"] as const).map((role) => (
          <label key={role} className="selw">
            {role === "captainId" ? "Capitán" : "Vice-capitán"}
            <select value={role === "captainId" ? p.takers.captainId : p.takers.viceId} disabled={ro} onChange={(e) => p.onCaptain(role, e.target.value)}>
              <option value="">Nadie</option>
              {p.takers.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        {TAKER_KINDS.map((k) => (
          <fieldset key={k} className="cb-tk3">
            <legend>
              <b aria-hidden="true">{TAKER_LETTER[k]}</b>
              {TAKER_LABEL[k]}
            </legend>
            {ORDINAL.map((o, pos) => (
              <select key={o} value={p.takers.lists[k][pos] ?? ""} disabled={ro || pos > p.takers.lists[k].length} onChange={(e) => p.onTaker(k, pos, e.target.value)} aria-label={TAKER_LABEL[k] + ": " + o + " lanzador"}>
                <option value="">{o} · nadie</option>
                {p.takers.options.map((op) => (
                  <option key={op.id} value={op.id}>
                    {o} · {op.label}
                  </option>
                ))}
              </select>
            ))}
          </fieldset>
        ))}
        <p className="empty">Tira el primero de cada lista que esté en el campo: si sale, la toca el siguiente.</p>
      </div>
    </div>
  );
}
