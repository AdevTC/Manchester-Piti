// «Te toca» in la bandeja (TuCarta «avisos»: the same cards as Tú's «Lo que te toca», tc-todo / tc-do / tc-opt):
// each open thing answered in place — the convocatoria (Voy · Duda · No voy), la caja («Ya la he pagado», only he
// sees it), his turno («Marcar como hecho»), the open poll, his porra, the MVP vote, a captain's door — with the
// writes usePending / useInbox already hold. What he has answered folds into a line of chips («Cambiar» opens it
// again). Errors stay under their card.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { TuIcon, type TuIconName } from "../../../components/vidrio/tu/ui";
import type { PendingItem } from "../tu/usePending";
import type { Say } from "../tu/places/types";
import { useCandStills, type AvisoActions } from "./actions";
import { ANSWER_SAID, ANSWER_WORD, pl, type Answer } from "./model";
import type { Pend } from "./useInbox";

const ANSWERS: Answer[] = ["yes", "maybe", "no"];
const isPend = (p: PendingItem): p is Pend => "noticeIds" in p;

/** The chip of an answered item; `again`: it can be changed («Cambiar»). */
function doneOf(p: PendingItem): { t: string; again: boolean } {
  switch (p.kind) {
    case "rsvp":
      return { t: p.value ? `${ANSWER_WORD[p.value]}: ${p.title.replace(/^¿|\?$/g, "")}` : p.title, again: true };
    case "caja":
      return { t: "Pago avisado: el capitán lo apunta", again: false };
    case "turno":
      return { t: `${p.title}: hecho`, again: true };
    case "poll":
      return { t: `Votado: ${p.opts.filter((o) => o.on).map((o) => `«${o.label}»`).join(", ")}`, again: true };
    case "porra":
      return { t: p.saved ? `Porra: ${p.saved.gf}–${p.saved.ga}` : "Porra guardada", again: true };
    case "mvp":
      return { t: `MVP: ${p.cands.find((c) => c.on)?.name ?? "votado"}`, again: true };
    default:
      return { t: p.title, again: false };
  }
}

/** The card's small line above its title and its glyph. */
function headOf(p: PendingItem): { k: string; icon: TuIconName; priv?: boolean; warn?: boolean } {
  switch (p.kind) {
    case "rsvp":
      return { k: "Convocatoria", icon: "cal" };
    case "caja":
      return { k: "La caja", icon: "euro", priv: true, warn: true };
    case "turno":
      return { k: "Tu turno", icon: p.icon };
    case "poll":
      return { k: "Encuesta", icon: "poll" };
    case "porra":
      return { k: "Tu porra", icon: "star" };
    case "mvp":
      return { k: p.matchJ ? `El MVP · J${p.matchJ}` : "El MVP", icon: "star" };
    default:
      return { k: "Capitanía · la puerta", icon: "door" };
  }
}

export function TocaList({ items, a, say, calm }: { items: readonly PendingItem[]; a: AvisoActions; say: Say; calm: string }) {
  const [again, setAgain] = useState<ReadonlySet<string>>(() => new Set());
  const latest = useRef(items);
  useEffect(() => {
    latest.current = items;
  });
  const stillOf = useCandStills(items.filter(isPend));
  const open = items.filter((p) => !p.done || again.has(p.key));
  const done = items.filter((p) => p.done && !again.has(p.key));
  /** Runs a write; the item folds again once answered; `said` in the toast (with «Deshacer» when given). */
  const run = (p: PendingItem, t: Promise<void>, said: string, undo?: () => void) => {
    if (isPend(p)) a.answered(p);
    t.then(
      () => {
        setAgain((s) => {
          const n = new Set(s);
          n.delete(p.key);
          return n;
        });
        say(said, undo);
      },
      () => undefined,
    );
  };
  return (
    <>
      {open.length > 0 ? (
        <ul className="tc-todo" aria-labelledby="tc-ibt-h">
          {open.map((p) => (
            <Card key={p.key} p={p} a={a} run={run} stillOf={stillOf} latest={latest} />
          ))}
        </ul>
      ) : (
        <p className="tc-calm">
          <span className="tk-tile">
            <TuIcon name="check" className="nx-ic" />
          </span>
          <span>
            <b>Todo hecho.</b> {calm}
          </span>
        </p>
      )}
      {done.length > 0 && (
        <ul className="tc-done" aria-label="Lo que ya has hecho">
          {done.map((p) => {
            const x = doneOf(p);
            return (
              <li key={p.key}>
                <TuIcon name="check" className="nx-ic" />
                {x.t}
                {x.again && (
                  <button type="button" onClick={() => setAgain((s) => new Set(s).add(p.key))} aria-label={`Cambiar: ${x.t}`}>
                    Cambiar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

type Run = (p: PendingItem, t: Promise<void>, said: string, undo?: () => void) => void;

function Card({ p, a, run, stillOf, latest }: { p: PendingItem; a: AvisoActions; run: Run; stillOf: (num: string) => string | undefined; latest: { current: readonly PendingItem[] } }) {
  const h = headOf(p);
  const lead = p.kind === "rsvp";
  const title = p.kind === "porra" ? `Piti – ${p.rival}` : p.kind === "poll" ? p.body : p.title;
  const sub = p.kind === "porra" ? "Se cierra con el pitido." : p.kind === "poll" ? p.after || pl(p.opts.reduce((s, o) => s + o.n, 0), "voto hasta ahora", "votos hasta ahora") : p.body;
  const err = p.error;
  return (
    <li className={`vd-glass tc-do${lead ? " tc-do--lead" : ""}`}>
      <span className={`tk-tile${h.warn ? " tk-tile--warn" : ""}`}>
        <TuIcon name={h.icon} className="nx-ic" />
      </span>
      <div className="tc-do__b">
        <p className="tc-do__k">
          {h.k}
          {h.priv && (
            <span className="tc-priv">
              <TuIcon name="lock" className="nx-ic" />
              Solo lo ves tú
            </span>
          )}
        </p>
        <h3 className="tc-do__t">{title}</h3>
        {sub && <p className="tc-do__s">{sub}</p>}
        <div className="tc-do__ctl">
          {p.kind === "rsvp" && (
            <div className="vd-glass vd-seg nx-seg" role="group" aria-label={p.title} style={{ "--n": 3, "--i": Math.max(0, ANSWERS.indexOf(p.value as Answer)) } as CSSProperties}>
              {p.value && <span className="vd-shelf__bead" aria-hidden="true" />}
              {ANSWERS.map((v) => (
                <button key={v} type="button" className="vd-seg__b" aria-pressed={p.value === v} aria-disabled={p.busy || undefined} onClick={() => !p.busy && run(p, p.pick(v), `${ANSWER_SAID[v]} El capitán ya lo ve.`)}>
                  {ANSWER_WORD[v]}
                </button>
              ))}
            </div>
          )}
          {p.kind === "poll" &&
            p.opts.map((o) => (
              <button key={o.id} type="button" className="vd-glass vd-press tc-opt" aria-pressed={o.on} aria-label={`${o.label}: ${pl(o.n, "voto", "votos")}`} onClick={() => run(p, p.pick(o.id), "Voto guardado.")}>
                {o.label}
                <small aria-hidden="true">{o.n}</small>
              </button>
            ))}
          {p.kind === "mvp" &&
            p.cands.map((c) => {
              const src = stillOf(c.num);
              const name = c.name.toLocaleUpperCase("es");
              return (
                <button key={c.id} type="button" className="vd-glass vd-press tc-opt" aria-pressed={c.on} aria-label={`Votar a ${c.name}, ${c.min} minutos`} onClick={() => run(p, p.pick(c.id), `Voto al MVP guardado: ${name}.`)}>
                  <span className={`vd-shirt${src ? " vd-shirt--img" : ""}`} style={src ? ({ "--vd-shirt-img": `url("${src}")` } as CSSProperties) : undefined} aria-hidden="true">
                    {!src && c.num ? <b>{c.num}</b> : null}
                  </span>
                  {name}
                  <small aria-hidden="true">{c.min}′</small>
                </button>
              );
            })}
          {p.kind === "porra" && <Porra p={p} run={run} />}
          {p.kind === "caja" && (
            <button type="button" className="vd-glass vd-press nx-btn" aria-disabled={p.busy || p.claimed || undefined} onClick={() => !p.busy && !p.claimed && run(p, p.claim(), "Avisado: el capitán lo apunta en la caja.")}>
              <TuIcon name="check" className="nx-ic" />
              Ya la he pagado
            </button>
          )}
          {p.kind === "turno" && (
            <button
              type="button"
              className="vd-glass vd-press nx-btn"
              aria-pressed={p.done}
              aria-disabled={p.busy || undefined}
              onClick={() => {
                if (p.busy) return;
                const undo = () => {
                  const now = latest.current.find((x) => x.key === p.key);
                  if (now?.kind === "turno" && now.done !== p.done) void now.mark().catch(() => undefined);
                };
                run(p, p.mark(), p.done ? "Turno sin marcar." : "Turno hecho. Gracias.", undo);
              }}
            >
              <TuIcon name="check" className="nx-ic" />
              {p.done ? "Hecho" : "Marcar como hecho"}
            </button>
          )}
          {p.kind === "door" && (
            <button type="button" className="vd-glass vd-press nx-btn" onClick={() => a.go(p.path)}>
              <TuIcon name="door" className="nx-ic" />
              Abrir La puerta
            </button>
          )}
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

/** His porra: our goals first, then theirs (0–15), «Guardar pronóstico». */
function Porra({ p, run }: { p: Extract<PendingItem, { kind: "porra" }>; run: Run }) {
  const [us, setUs] = useState(p.saved?.gf ?? 0);
  const [them, setThem] = useState(p.saved?.ga ?? 0);
  const clamp = (n: number) => Math.max(0, Math.min(15, n));
  return (
    <>
      <div className="tc-step" role="group" aria-label="Goles del Piti">
        <span>Piti</span>
        <button type="button" className="vd-glass vd-press" onClick={() => setUs((n) => clamp(n - 1))} aria-label="Un gol menos del Piti">
          <TuIcon name="minus" className="nx-ic" />
        </button>
        <b aria-live="polite">{us}</b>
        <button type="button" className="vd-glass vd-press" onClick={() => setUs((n) => clamp(n + 1))} aria-label="Un gol más del Piti">
          <TuIcon name="plus" className="nx-ic" />
        </button>
      </div>
      <span className="tc-step__sep" aria-hidden="true">
        –
      </span>
      <div className="tc-step" role="group" aria-label={`Goles de ${p.rival}`}>
        <button type="button" className="vd-glass vd-press" onClick={() => setThem((n) => clamp(n - 1))} aria-label="Un gol menos del rival">
          <TuIcon name="minus" className="nx-ic" />
        </button>
        <b aria-live="polite">{them}</b>
        <button type="button" className="vd-glass vd-press" onClick={() => setThem((n) => clamp(n + 1))} aria-label="Un gol más del rival">
          <TuIcon name="plus" className="nx-ic" />
        </button>
        <span>{p.rival}</span>
      </div>
      <button type="button" className="vd-glass vd-press nx-btn" aria-disabled={p.busy || undefined} onClick={() => !p.busy && run(p, p.save(us, them), `Pronóstico guardado: ${us}–${them}.`)}>
        Guardar pronóstico
      </button>
    </>
  );
}
