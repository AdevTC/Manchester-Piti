// «Lo que te toca» (TuCarta tc-todo; la bandeja's «Te toca» will reuse it): one glass card per open thing, answered
// in place with its write (tu/usePending: rsvp · caja · turno · poll · porra · mvp · door), the answered ones as
// chips in «Lo que ya has hecho» (with «Cambiar» where the answer can change), and «Estás al día» when nothing is
// open. Every answer says so in the toast; «Deshacer» where there is a write that undoes it (the previous answer
// again, the turno unmarked). Errors stay on the card (role=alert). Real buttons, ≥44 px, the state in words.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Seg, TuIcon } from "../../../../../components/vidrio/tu/ui";
import { tuGo } from "../../../../../components/vidrio/tu/kit";
import { useCandStills, isAppPath } from "../../../bandeja/actions";
import type { Pend } from "../../../bandeja/useInbox";
import { ANSWER_SAID, type Answer } from "../../../bandeja/model";
import type { CajaPend, PendingItem, PorraPend } from "../../usePending";
import type { Say } from "../types";
import { canChange, doneText, todoView } from "../tuView";

type Rsvp = Extract<Pend, { kind: "rsvp" }>;
type Mvp = Extract<Pend, { kind: "mvp" }>;
type Poll = Extract<Pend, { kind: "poll" }>;
type Turno = Extract<Pend, { kind: "turno" }>;
type Door = Extract<Pend, { kind: "door" }>;

const RSVP: { v: Answer; t: string }[] = [
  { v: "yes", t: "Voy" },
  { v: "maybe", t: "Duda" },
  { v: "no", t: "No voy" },
];
const MAX_GOALS = 15;
const quiet = () => undefined;

export interface TodoCardsProps {
  /** usePending's items (open and answered). */
  items: readonly PendingItem[];
  say: Say;
  /** «board»: Tú's two columns with the convocatoria across (default); «list»: one column (la bandeja). */
  layout?: "board" | "list";
  /** A match's jornada (the porra's «· J3»). */
  jornadaOf?: (matchId: string) => number | null;
  /** The line under «Estás al día.» (Lo próximo: …). */
  calm?: string;
  /** The heading the list is labelled by. */
  labelledBy?: string;
}

export function TodoCards({ items, say, layout = "board", jornadaOf, calm, labelledBy }: TodoCardsProps) {
  // answered cards he chose to change (open again until he answers)
  const [editing, setEditing] = useState<ReadonlySet<string>>(() => new Set());
  // (the toast's «Deshacer» runs later: it reads the latest items, never a closure of the click's render)
  const latest = useRef(items);
  useEffect(() => {
    latest.current = items;
  });
  const now = (key: string) => latest.current.find((x) => x.key === key);
  const stillOf = useCandStills(items.filter((x): x is Pend => x.kind !== "caja" && x.kind !== "porra"));
  const settle = (key: string) =>
    setEditing((s) => {
      if (!s.has(key)) return s;
      const n = new Set(s);
      n.delete(key);
      return n;
    });

  const open = items.filter((x) => !x.done || editing.has(x.key));
  const done = items.filter((x) => x.done && !editing.has(x.key));
  const card = (x: PendingItem) => <TodoCard key={x.key} x={x} say={say} now={now} settle={() => settle(x.key)} stillOf={stillOf} jornadaOf={jornadaOf} />;

  return (
    <>
      {open.length > 0 ? (
        <ul className={`tc-todo${layout === "list" ? " tc-todo--list" : ""}`} aria-labelledby={labelledBy}>
          {open.map(card)}
        </ul>
      ) : (
        <p className="tc-calm">
          <span className="tk-tile" aria-hidden="true">
            <TuIcon name="check" className="nx-ic" />
          </span>
          <span>
            <b>Estás al día.</b> {calm ?? ""}
          </span>
        </p>
      )}
      {done.length > 0 && (
        <ul className="tc-done" aria-label="Lo que ya has hecho">
          {done.map((x) => (
            <li key={x.key}>
              <TuIcon name="check" className="nx-ic" />
              {doneText(x)}
              {canChange(x) && (
                <button type="button" onClick={() => setEditing((s) => new Set(s).add(x.key))} aria-label={`Cambiar: ${doneText(x) ?? ""}`}>
                  Cambiar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface CardProps {
  x: PendingItem;
  say: Say;
  now: (key: string) => PendingItem | undefined;
  settle: () => void;
  stillOf: (num: string) => string | undefined;
  jornadaOf?: (matchId: string) => number | null;
}

function TodoCard({ x, say, now, settle, stillOf, jornadaOf }: CardProps) {
  const v = todoView(x, jornadaOf);
  const tid = `tc-do-${x.key}`;
  const err = x.error;
  return (
    <li className={`vd-glass tc-do${v.lead ? " tc-do--lead" : ""}`} aria-labelledby={tid}>
      <span className={`tk-tile${v.warn ? " tk-tile--warn" : ""}`} aria-hidden="true">
        <TuIcon name={v.icon} className="nx-ic" />
      </span>
      <div className="tc-do__b">
        <p className="tc-do__k">
          {v.kick}
          {v.priv && (
            <span className="tc-priv">
              <TuIcon name="lock" className="nx-ic" />
              Solo lo ves tú
            </span>
          )}
        </p>
        <h3 className="tc-do__t" id={tid}>
          {v.title}
        </h3>
        {v.line && <p className="tc-do__s">{v.line}</p>}
        <div className="tc-do__ctl">
          {x.kind === "rsvp" && <RsvpCtl p={x} say={say} settle={settle} labelledBy={tid} />}
          {x.kind === "caja" && <CajaCtl p={x} say={say} />}
          {x.kind === "turno" && <TurnoCtl p={x} say={say} now={now} />}
          {x.kind === "poll" && <PollCtl p={x} say={say} settle={settle} />}
          {x.kind === "porra" && <PorraCtl p={x} say={say} settle={settle} rivalLabel={v.title} />}
          {x.kind === "mvp" && <MvpCtl p={x} say={say} settle={settle} stillOf={stillOf} />}
          {x.kind === "door" && <DoorCtl p={x} />}
        </div>
        {err ? (
          <p className="tc-do__err" role="alert">
            {err}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function RsvpCtl({ p, say, settle, labelledBy }: { p: Rsvp; say: Say; settle: () => void; labelledBy: string }) {
  const pick = (a: Answer) => {
    if (p.busy) return;
    const prev = p.value;
    p.pick(a).then(
      () => {
        settle();
        say(`${ANSWER_SAID[a]} El capitán ya lo ve.`, prev && prev !== a ? () => void p.pick(prev).then(() => say("Vuelve a estar como antes."), quiet) : undefined);
      },
      quiet,
    );
  };
  return <Seg opts={RSVP} value={p.value} onPick={pick} labelledBy={labelledBy} cls="nx-seg" bead={!!p.value} />;
}

function CajaCtl({ p, say }: { p: CajaPend; say: Say }) {
  const pay = () => {
    if (p.busy || p.claimed) return;
    p.claim().then(() => say("Avisado: el capitán lo apunta en la caja."), quiet);
  };
  return (
    <button type="button" className="vd-glass vd-press nx-btn" aria-disabled={p.busy || undefined} onClick={pay}>
      <TuIcon name="check" className="nx-ic" />
      {p.busy ? "Avisando…" : "Ya la he pagado"}
    </button>
  );
}

function TurnoCtl({ p, say, now }: { p: Turno; say: Say; now: (key: string) => PendingItem | undefined }) {
  const mark = () => {
    if (p.busy) return;
    const undo = () => {
      const cur = now(p.key);
      if (cur?.kind === "turno" && cur.done && !cur.busy) void cur.mark().then(() => say("Turno sin marcar."), quiet);
    };
    p.mark().then(() => say("Turno hecho. Gracias.", undo), quiet);
  };
  return (
    <button type="button" className="vd-glass vd-press nx-btn" aria-pressed={p.done} aria-disabled={p.busy || undefined} onClick={mark}>
      <TuIcon name="check" className="nx-ic" />
      {p.busy ? "Marcando…" : "Marcar como hecho"}
    </button>
  );
}

function PollCtl({ p, say, settle }: { p: Poll; say: Say; settle: () => void }) {
  return (
    <div className="tc-opts" role="group" aria-label={p.body}>
      {p.opts.map((o) => (
        <button
          key={o.id}
          type="button"
          className="vd-glass vd-press tc-opt"
          aria-pressed={o.on}
          aria-label={`${o.label}: ${o.n === 1 ? "1 voto" : `${o.n} votos`}`}
          onClick={() =>
            p.pick(o.id).then(() => {
              settle();
              say(o.on ? `Quitado tu voto a «${o.label}».` : `Votado: «${o.label}».`);
            }, quiet)
          }
        >
          {o.on && <TuIcon name="check" className="nx-ic" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({ label, value, set, less, more, name }: { label: string; value: number; set: (n: number) => void; less: string; more: string; name: string }) {
  return (
    <div className="tc-step" role="group" aria-label={label}>
      <span>{name}</span>
      <button type="button" className="vd-glass vd-press" aria-label={less} aria-disabled={value <= 0 || undefined} onClick={() => value > 0 && set(value - 1)}>
        <TuIcon name="minus" className="nx-ic" />
      </button>
      <b aria-live="polite">{value}</b>
      <button type="button" className="vd-glass vd-press" aria-label={more} aria-disabled={value >= MAX_GOALS || undefined} onClick={() => value < MAX_GOALS && set(value + 1)}>
        <TuIcon name="plus" className="nx-ic" />
      </button>
    </div>
  );
}

function PorraCtl({ p, say, settle, rivalLabel }: { p: PorraPend; say: Say; settle: () => void; rivalLabel: string }) {
  const [gf, setGf] = useState(p.saved?.gf ?? 0);
  const [ga, setGa] = useState(p.saved?.ga ?? 0);
  const save = () => {
    if (p.busy) return;
    const prev = p.saved;
    p.save(gf, ga).then(() => {
      settle();
      say(`Pronóstico guardado: ${gf}–${ga}.`, prev && (prev.gf !== gf || prev.ga !== ga) ? () => void p.save(prev.gf, prev.ga).then(() => say(`Vuelve a ser ${prev.gf}–${prev.ga}.`), quiet) : undefined);
    }, quiet);
  };
  return (
    <div className="tc-porra" aria-label={`Tu pronóstico: ${rivalLabel}`} role="group">
      <Stepper name="Piti" label="Goles del Piti" value={gf} set={setGf} less="Un gol menos del Piti" more="Un gol más del Piti" />
      <Stepper name={p.rival} label={`Goles de ${p.rival}`} value={ga} set={setGa} less="Un gol menos del rival" more="Un gol más del rival" />
      <button type="button" className="vd-glass vd-press nx-btn" aria-disabled={p.busy || undefined} onClick={save}>
        {p.busy ? "Guardando…" : "Guardar pronóstico"}
      </button>
    </div>
  );
}

function MvpCtl({ p, say, settle, stillOf }: { p: Mvp; say: Say; settle: () => void; stillOf: (num: string) => string | undefined }) {
  return (
    <div className="tc-opts" role="group" aria-label={`Candidatos al MVP${p.matchJ ? ` de la J${p.matchJ}` : ""}: los que jugaron`}>
      {p.cands.map((c) => {
        const src = stillOf(c.num);
        return (
          <button
            key={c.id}
            type="button"
            className="vd-glass vd-press tc-opt"
            aria-pressed={c.on}
            aria-label={`Votar a ${c.name}, ${c.min} minutos`}
            onClick={() => {
              const prev = p.cands.find((x) => x.on);
              p.pick(c.id).then(() => {
                settle();
                say(`Votado: ${c.name}.`, prev && prev.id !== c.id ? () => void p.pick(prev.id).then(() => say(`Vuelve a ser ${prev.name}.`), quiet) : undefined);
              }, quiet);
            }}
          >
            {src ? <img className="tc-opt__shirt" src={src} alt="" /> : <span className="tc-opt__num" aria-hidden="true">{c.num}</span>}
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

function DoorCtl({ p }: { p: Door }) {
  const navigate = useNavigate();
  const go = () => {
    if (!isAppPath(p.path)) return;
    tuGo("right", async () => {
      await navigate({ href: p.path });
    });
  };
  return (
    <button type="button" className="vd-glass vd-press nx-btn" onClick={go}>
      <TuIcon name="door" className="nx-ic" />
      Abrir La puerta
    </button>
  );
}
