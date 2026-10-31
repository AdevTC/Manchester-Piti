// «Entrenos · cuándo entrenamos» (/vestuario/entrenos), as the canvas prototype draws it (SalaEntrenos.dc.html): the
// confirmed training as a ticket («¿Vas al entreno?», the seven, who goes, the calendar, the proposer's or a captain's
// reopen / cancel), the open proposal's slots with their calendar leaf and vote bar («Me viene» / «Me viene bien»)
// next to the proposal and the confirm card, the empty week's three ghost slots, and the propose form (up to three
// ranges). Pure pieces in entrenosModel.ts; styles in styles/vestuario/entrenos.css (vet-).
import { useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { AddToCalendar } from "../../../components/celeste/AddToCalendar";
import { apiError, confirmTraining, deleteTraining, proposeTraining } from "../../../lib/clubApi";
import { andNames, MIN_PLAYERS, nextWeekday, plural, trainingOver } from "../../../lib/vestuario";
import "../../../styles/vestuario/entrenos.css";
import { useOpenTrainings, useTrainingVotes, type Training, type TrainingVote } from "../live";
import { useWrite } from "../shared/useWrite";
import { voteTraining } from "../writes";
import type { VxCtx } from "./ctx";
import { barOf, confirmable, EMPTY_RANGE, formErrors, ghostRange, ghosts, headOf, hoursPlace, leaf, localDay, matchParts, proposal, sevenLine, slotDayMonth, trainRows, type Range, type TrainRow } from "./entrenosModel";
import { Ic, PShirt, RoomHead, Tile } from "./kit";

const BTN = "vd-glass vd-press nx-btn";

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (e) {
      setError(apiError(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}
const Err = ({ text }: { text: string }) =>
  text ? (
    <p className="ve-err" role="alert">
      {text}
    </p>
  ) : null;

type Ask = null | "cancel" | "retirar";

export function EntrenosBlock({ c }: { c: VxCtx }) {
  const trainings = useOpenTrainings(c.now);
  const training = trainings.data.find((t) => !trainingOver(t, c.now));
  const votes = useTrainingVotes(training?.id);
  const [form, setForm] = useState<{ first: Range } | null>(null);
  const [ask, setAsk] = useState<Ask>(null);
  const [saidNo, setSaidNo] = useState(false);
  const act = useAction();
  const vote = useWrite();
  const mine = votes.data.find((v) => v.uid === c.uid)?.slotIds ?? [];
  const canManage = !!training && (training.proposedBy === c.uid || c.admin);
  const numOf = (pid: string | null | undefined) => (pid ? (c.squad.find((s) => s.id === pid)?.num ?? "") : "");
  const write = (slotIds: string[], said?: string, undo?: string[]) => {
    const me = c.me;
    if (!training || !me) return;
    vote.write(
      () => voteTraining(me, training.id, slotIds),
      said ? () => c.say(said, undo ? () => vote.write(() => voteTraining(me, training.id, undo)) : undefined) : undefined,
    );
  };
  const run = (fn: () => Promise<unknown>, said: string) => {
    void act.run(fn).then((ok) => {
      if (ok) {
        setAsk(null);
        c.say(said);
      }
    });
  };
  const openForm = (first: Range) => {
    setAsk(null);
    setForm({ first });
  };

  const conf = training?.confirmed;
  const going = conf ? votes.data.filter((v) => v.slotIds.includes(conf.slotId)).sort((a, b) => (a.uid === c.uid ? -1 : b.uid === c.uid ? 1 : 0)) : [];
  const imGoing = !!conf && mine.includes(conf.slotId);
  const head = !training
    ? headOf({ kind: "empty" })
    : conf
      ? headOf({ kind: "conf", at: conf.at, byMe: !!conf.by && conf.by === c.uid, byName: conf.byName, going: going.length, answered: imGoing || saidNo })
      : headOf({ kind: "vote", byMe: training.proposedBy === c.uid, byName: training.proposedByName });
  const loading = !training && trainings.loading;

  const formEl = form && <ProposeTraining key={JSON.stringify(form.first)} first={form.first} now={c.now} onDone={() => setForm(null)} say={c.say} />;
  const nextAt = c.next ? dateMillis(c.next.date) : NaN;
  const m = matchParts(c.nextLine);

  return (
    <section className="vet" aria-labelledby="ve-room-h">
      <RoomHead room="entrenos" icon="whistle" kick="Entrenos · cuándo entrenamos" title={loading ? "¿Cuándo entrenamos?" : head.title} sub={loading ? "" : head.sub} />
      {!loading && (
        <div className="ve-cols">
          <div className="ve-stack">
            {formEl}
            {training && conf && (
              <Ticket
                c={c}
                training={training}
                going={going}
                numOf={numOf}
                mine={imGoing}
                saidNo={saidNo && !imGoing}
                onGo={(go) => {
                  if (go === imGoing && (go || saidNo)) return;
                  setSaidNo(!go);
                  if (go) write([conf.slotId], "Apuntado: vas al entreno.", []);
                  // (not going yet: there is nothing to take back, the answer only shows here — a «no» isn't stored)
                  else if (imGoing) write([], "Apuntado: no puedes ir al entreno.", [conf.slotId]);
                }}
                canManage={canManage}
                busy={act.busy}
                ask={ask}
                setAsk={setAsk}
                onReopen={() => run(() => confirmTraining({ trainingId: training.id, slotId: null }), "Votación reabierta: el equipo puede volver a votar.")}
                onCancel={() => run(() => deleteTraining({ trainingId: training.id }), "Entreno cancelado.")}
                error={act.error || vote.error}
              />
            )}
            {training && !conf && (
              <Voting
                rows={trainRows(training.slots, votes.data, mine, c.now)}
                numOf={numOf}
                squadN={c.squad.length}
                onToggle={(r) => {
                  const day = r.day.toLowerCase();
                  write(r.on ? mine.filter((s) => s !== r.id) : [...mine, r.id], r.on ? `Quitado: ya no te viene el ${day}.` : `Apuntado: te viene bien el ${day}.`);
                }}
                showMore={!form}
                onMore={() => openForm(EMPTY_RANGE)}
                error={vote.error}
              />
            )}
            {!training && !form && (
              <div className="ve-empty vet-empty">
                <Tile icon="whistle" />
                <h2>Nadie ha propuesto huecos esta semana · sé el primero</h2>
                <p>Elige un hueco y lo rellenamos a las 10:00–11:30; cámbialo si quieres. Puedes proponer hasta tres y el equipo vota.</p>
                <ul className="vet-ghosts" aria-label="Huecos para proponer">
                  {ghosts(nextWeekday(c.now, 6, 10), nextWeekday(c.now, 0, 10), Number.isFinite(nextAt) && /^J\d+/.test(c.nextLine) ? { at: nextAt, j: c.nextLine.split(" · ")[0] } : null).map((g) => (
                    <li key={g.key} className="vet-ghost">
                      <div className="vet-cal is-ghost" aria-hidden="true">
                        <span>{g.dow}</span>
                        <b>{g.big}</b>
                        <span>{g.mon}</span>
                      </div>
                      <div className="vet-ghost__t">
                        <b>{g.t}</b>
                        <span>{g.s}</span>
                      </div>
                      <button type="button" className={BTN} aria-label={g.aria} onClick={() => openForm(ghostRange(g.at))}>
                        Proponer
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="ve-side ve-stack">
            {training && conf && <WhoGoes c={c} going={going} numOf={numOf} />}
            {training && !conf && (
              <>
                <section className="ve-panel" aria-labelledby="vet-prop-h">
                  <h2 className="nx-h3" id="vet-prop-h">
                    La propuesta
                  </h2>
                  <div className="vet-prop">
                    <PShirt n={numOf(votes.data.find((v) => v.uid === training.proposedBy)?.playerId)} />
                    <div className="ve-row__t">
                      <b>{training.proposedBy === c.uid ? "Propuesto por ti" : `Propuesto por ${training.proposedByName}`}</b>
                      <span>Vota los huecos que te vienen bien.</span>
                    </div>
                  </div>
                  {training.note && <p className="vet-note">«{training.note}»</p>}
                  {!canManage && (
                    <p className="nx-meta" style={{ marginTop: 12 }}>
                      {training.proposedByName} o un capitán fijan el hueco definitivo. Lo verás aquí y en el tablón.
                    </p>
                  )}
                </section>
                {canManage && (
                  <Owner
                    kick={training.proposedBy === c.uid ? "Tu propuesta" : "Capitán"}
                    rows={confirmable(trainRows(training.slots, votes.data, mine, c.now))}
                    busy={act.busy}
                    ask={ask}
                    setAsk={setAsk}
                    onConfirm={(r) => run(() => confirmTraining({ trainingId: training.id, slotId: r.id }), `Entreno confirmado: ${r.day.toLowerCase()}, ${r.t}.`)}
                    onWithdraw={() => run(() => deleteTraining({ trainingId: training.id }), "Propuesta retirada.")}
                    error={act.error}
                  />
                )}
              </>
            )}
            {!training && (
              <section className="ve-panel" aria-labelledby="vet-how-h">
                <h2 className="nx-h3" id="vet-how-h">
                  Cómo se fija un entreno
                </h2>
                <ul className="vet-how">
                  <li>
                    <Tile icon="plus" />
                    Propones hasta tres huecos, de qué hora a qué hora.
                  </li>
                  <li>
                    <Tile icon="users" />
                    El equipo vota los que le vienen bien. Con {MIN_PLAYERS}, hay equipo.
                  </li>
                  <li>
                    <Tile icon="check" />
                    Tú o un capitán fijáis el definitivo y le llega a todo el equipo.
                  </li>
                </ul>
              </section>
            )}
            <section className="ve-panel" aria-labelledby="vet-m-h">
              <h2 className="nx-h3" id="vet-m-h">
                El próximo partido
              </h2>
              <div className="vet-match">
                <Tile icon="ball" />
                <div>
                  <b>{m.t}</b>
                  {m.s && <span>{m.s}</span>}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- voting: the proposed slots
function Voting({ rows, numOf, squadN, onToggle, showMore, onMore, error }: { rows: TrainRow[]; numOf: (pid: string | null) => string; squadN: number; onToggle: (r: TrainRow) => void; showMore: boolean; onMore: () => void; error: string }) {
  const live = rows.filter((r) => !r.past).length;
  const n = barOf(0, squadN).n;
  return (
    <section aria-labelledby="vet-hus-h">
      <div className="nx-sec__head">
        <h2 className="nx-h3" id="vet-hus-h">
          Huecos propuestos
        </h2>
        <p className="nx-meta">{plural(live, "hueco", "huecos")} · vota todos los que te vengan</p>
      </div>
      <ul className="vet-hus" aria-labelledby="vet-hus-h">
        {rows.map((r) => {
          const bar = barOf(r.count, squadN);
          const nums = r.voters
            .map(numOf)
            .sort((a, b) => (Number(a) || 99) - (Number(b) || 99))
            .slice(0, 8);
          return (
            <li key={r.id} className={`vd-glass ve-card vet-hu${r.top ? " is-top" : ""}${r.past ? " is-past" : ""}`}>
              <div className="vet-cal" aria-hidden="true">
                <span>{r.leaf.dow}</span>
                <b>{r.leaf.dnum}</b>
                <span>{r.leaf.mon}</span>
              </div>
              <div className="vet-hu__b">
                <div>
                  <h3 className="vet-hu__day">{r.day}</h3>
                  <p className="vet-hu__when">{r.when}</p>
                </div>
                <div className="vet-bar" role="img" aria-label={bar.aria} style={{ "--p": bar.pw, "--s7": bar.s7 } as CSSProperties}>
                  <span className="vet-bar__fill" />
                  <span className="vet-bar__seven" />
                </div>
                <div className="vet-hu__row">
                  <p className="vet-hu__n">
                    <b>{r.nT}</b>
                    {r.tag && <span className={`ve-st ${r.past ? "is-off" : "is-ok"}`}>{r.tag}</span>}
                  </p>
                  {nums.length > 0 && (
                    <div className="ve-shirts" aria-hidden="true">
                      {nums.map((num, i) => (
                        <PShirt key={i} n={num} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="vet-hu__act">
                <button
                  type="button"
                  className={`${BTN} vet-me`}
                  aria-pressed={r.on}
                  aria-label={`${r.on ? "Te viene bien el" : "Me viene el"} ${r.day.toLowerCase()}, ${r.t}${r.past ? ". Ya pasó" : ""}`}
                  disabled={r.past}
                  onClick={() => onToggle(r)}
                >
                  {r.on && <Ic name="check" />}
                  {r.on ? "Me viene bien" : "Me viene"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="nx-meta vet-seven-k" style={{ marginTop: 10 }}>
        La raya de cada barra marca {MIN_PLAYERS} de {n}: con {MIN_PLAYERS}, hay equipo.
      </p>
      <Err text={error} />
      {showMore && (
        <div className="ve-acts vet-more" style={{ marginTop: 14 }}>
          <button type="button" className={BTN} onClick={onMore}>
            <Ic name="plus" />
            Proponer otros huecos
          </button>
        </div>
      )}
    </section>
  );
}

// ---------- voting: the proposer's (or a captain's) card
function Owner({ kick, rows, busy, ask, setAsk, onConfirm, onWithdraw, error }: { kick: string; rows: TrainRow[]; busy: boolean; ask: Ask; setAsk: (a: Ask) => void; onConfirm: (r: TrainRow) => void; onWithdraw: () => void; error: string }) {
  const first = rows[0];
  return (
    <section className="vd-glass ve-card vet-own" aria-labelledby="vet-own-h">
      <p className="ve-card__k">{kick}</p>
      <h2 className="vet-own__k" id="vet-own-h">
        Confirma el hueco definitivo:
      </h2>
      {rows.length > 0 && (
        <div className="vet-own__bs" role="group" aria-label="Confirmar el entreno">
          {rows.map((r) => (
            <button key={r.id} type="button" className={`${BTN}${r === first && r.count > 0 ? " nx-btn--pri" : ""}`} aria-label={`${r.day} · ${r.t}, ${r.nT}`} disabled={busy} onClick={() => onConfirm(r)}>
              <span>
                {r.day} · {r.t}
              </span>
              <span>{r.nT}</span>
            </button>
          ))}
        </div>
      )}
      <p>Le llega a todo el equipo y se cierra la votación.</p>
      {ask !== "retirar" && (
        <div className="ve-acts" style={{ marginTop: 4 }}>
          <button type="button" className={`${BTN} nx-btn--danger`} disabled={busy} onClick={() => setAsk("retirar")}>
            <Ic name="trash" />
            Retirar propuesta
          </button>
        </div>
      )}
      {ask === "retirar" && (
        <div className="ve-confirm" role="alertdialog" aria-label="Retirar la propuesta">
          <p>¿Retirar la propuesta? Se borran los huecos y sus votos.</p>
          <div className="ve-acts">
            <button type="button" className={`${BTN} nx-btn--danger`} disabled={busy} onClick={onWithdraw}>
              Sí, retirarla
            </button>
            <button type="button" className={BTN} onClick={() => setAsk(null)}>
              No, se queda
            </button>
          </div>
        </div>
      )}
      <Err text={error} />
    </section>
  );
}

// ---------- confirmed: the ticket
function Ticket({
  c,
  training,
  going,
  numOf,
  mine,
  saidNo,
  onGo,
  canManage,
  busy,
  ask,
  setAsk,
  onReopen,
  onCancel,
  error,
}: {
  c: VxCtx;
  training: Training;
  going: TrainingVote[];
  numOf: (pid: string | null | undefined) => string;
  mine: boolean;
  saidNo: boolean;
  onGo: (go: boolean) => void;
  canManage: boolean;
  busy: boolean;
  ask: Ask;
  setAsk: (a: Ask) => void;
  onReopen: () => void;
  onCancel: () => void;
  error: string;
}) {
  const conf = training.confirmed!;
  const l = leaf(conf.at);
  const day = slotDayMonth(conf.at).toLowerCase();
  const time = hoursPlace({ at: conf.at, end: conf.end });
  const n = going.length;
  const byMe = !!conf.by && conf.by === c.uid;
  const answered = mine || saidNo;
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const opts = [
    { go: true, t: "Voy", on: mine },
    { go: false, t: "No puedo", on: saidNo },
  ];
  const onKey = (e: KeyboardEvent, i: number) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const j = 1 - i;
    radios.current[j]?.focus();
    onGo(opts[j].go);
  };
  return (
    <section className="vd-glass vd-glass--deep vet-tk" aria-labelledby="vet-tk-h">
      <div className="vet-tk__stub" aria-hidden="true">
        <span className="vet-tk__dow">{l.dow}</span>
        <b className="vet-tk__d">{l.dnum}</b>
        <span className="vet-tk__mon">{l.mon}</span>
        <span className="vet-tk__hr">{time.split("–")[0]}</span>
      </div>
      <div className="vet-tk__main">
        <div>
          <div className="vet-tk__k">
            <p className="ve-card__k" id="vet-tk-h">
              Entreno · {day}
            </p>
            <span className="ve-st is-ok">
              <Ic name="check" />
              Confirmado
            </span>
          </div>
          <p className="vet-tk__time">{time}</p>
          {conf.place && (
            <p className="vet-tk__place">
              <Ic name="pin" />
              {conf.place}
            </p>
          )}
          <p className="vet-tk__by">{conf.byName ? `Lo fijó ${byMe ? `${conf.byName} (tú)` : conf.byName}` : "Confirmado"} · votación cerrada</p>
        </div>
        <div className="vet-ask">
          <div className="vet-ask__h">
            <h2 id="vet-ask-h">¿Vas al entreno?</h2>
            <p className="nx-meta">{mine ? "Vas. Puedes cambiarlo." : saidNo ? "No puedes. Puedes cambiarlo." : "Aún no has respondido."}</p>
          </div>
          <div className="vd-glass vd-seg nx-seg" role="radiogroup" aria-labelledby="vet-ask-h" style={{ "--n": 2, "--i": saidNo ? 1 : 0 } as CSSProperties}>
            {answered && <span className="vd-shelf__bead" aria-hidden="true" />}
            {opts.map((o, i) => (
              <button
                key={o.t}
                ref={(el) => {
                  radios.current[i] = el;
                }}
                type="button"
                role="radio"
                className="vd-seg__b"
                aria-checked={o.on}
                tabIndex={(answered ? o.on : i === 0) ? 0 : -1}
                onClick={() => onGo(o.go)}
                onKeyDown={(e) => onKey(e, i)}
              >
                {o.t}
              </button>
            ))}
          </div>
        </div>
        <div className="vet-go">
          <div className="vet-go__row">
            <div className="ve-seven" role="img" aria-label={`${n} de ${MIN_PLAYERS} para hacer equipo`}>
              {Array.from({ length: MIN_PLAYERS }, (_, i) => (
                <i key={i} className={i < n ? "is-yes" : ""} />
              ))}
              <b>{sevenLine(n)}</b>
            </div>
            {n > 0 && (
              <div className="ve-shirts" aria-hidden="true">
                {going.map((v) => (
                  <PShirt key={v.uid} n={numOf(v.playerId)} />
                ))}
              </div>
            )}
          </div>
          {n > 0 && <p className="vet-go__t">Van: {andNames(going.map((v) => (v.uid === c.uid ? "tú" : v.playerId ? c.nameOf(v.playerId) : v.name)))}</p>}
        </div>
        <div className="ve-acts">
          <AddToCalendar
            className={BTN}
            label="Añadir al calendario"
            event={{ uid: `training-${training.id}`, title: "Entreno Manchester Piti", start: conf.at, end: conf.end ?? conf.at + 90 * 60_000, location: conf.place || undefined, url: `${location.origin}/vestuario/entrenos` }}
          />
          {canManage && ask !== "cancel" && (
            <>
              <button type="button" className={BTN} disabled={busy} onClick={onReopen}>
                <Ic name="undo" />
                Reabrir votación
              </button>
              <button type="button" className={`${BTN} nx-btn--danger`} disabled={busy} onClick={() => setAsk("cancel")}>
                <Ic name="close" />
                Cancelar entreno
              </button>
            </>
          )}
        </div>
        {canManage && ask === "cancel" && (
          <div className="ve-confirm" role="alertdialog" aria-label="Cancelar el entreno">
            <p>¿Cancelar el entreno? Se borra para todo el equipo, con quién iba y quién no.</p>
            <div className="ve-acts">
              <button type="button" className={`${BTN} nx-btn--danger`} disabled={busy} onClick={onCancel}>
                Sí, cancelarlo
              </button>
              <button type="button" className={BTN} onClick={() => setAsk(null)}>
                No, se queda
              </button>
            </div>
          </div>
        )}
        <Err text={error} />
      </div>
    </section>
  );
}

// ---------- confirmed: who goes
function WhoGoes({ c, going, numOf }: { c: VxCtx; going: TrainingVote[]; numOf: (pid: string | null | undefined) => string }) {
  return (
    <section className="ve-panel" aria-labelledby="vet-who-h">
      <div className="nx-sec__head" style={{ marginBottom: 4 }}>
        <h2 className="nx-h3" id="vet-who-h">
          Quién va
        </h2>
        <p className="nx-meta">{going.length >= MIN_PLAYERS ? `${plural(going.length, "va", "van")} · hay equipo` : `${plural(going.length, "va", "van")} · con ${MIN_PLAYERS} hay equipo`}</p>
      </div>
      {going.length ? (
        <ul className="ve-list vet-who" aria-label="Quién va al entreno">
          {going.map((v) => {
            const me = v.uid === c.uid;
            return (
              <li key={v.uid} className={`ve-row${me ? " is-me" : ""}`}>
                <PShirt n={numOf(v.playerId)} />
                <span className="ve-row__t">
                  <b>
                    {v.playerId ? c.nameOf(v.playerId) : v.name}
                    {me && <span className="ve-you">tú</span>}
                  </b>
                </span>
                <span className="ve-st is-ok">Va</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="nx-meta">Todavía no se ha apuntado nadie.</p>
      )}
    </section>
  );
}

// ---------- the propose form
function ProposeTraining({ first, now, onDone, say }: { first: Range; now: number; onDone: () => void; say: (t: string) => void }) {
  const [slots, setSlots] = useState<Range[]>([first, EMPTY_RANGE, EMPTY_RANGE]);
  const [errs, setErrs] = useState(["", "", ""]);
  const [place, setPlace] = useState("");
  const act = useAction();
  const minDay = localDay(now);
  const setField = (i: number, key: keyof Range, value: string) => {
    setSlots(slots.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
    setErrs(errs.map((e, j) => (j === i ? "" : e)));
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const bad = formErrors(slots);
    const out = proposal(slots, place);
    if (bad.some(Boolean) || !out) {
      setErrs(bad);
      return;
    }
    const ok = await act.run(() => proposeTraining({ slots: out, note: "" }));
    if (ok) {
      say("Entreno propuesto: el equipo ya puede votar.");
      onDone();
    }
  };
  return (
    <form className="vd-glass vd-glass--deep ve-card vet-form" onSubmit={(e) => void submit(e)} aria-labelledby="vet-f-h" noValidate>
      <div className="vet-form__h">
        <Tile icon="whistle" />
        <div>
          <h2 id="vet-f-h">Proponer entreno</h2>
          <p>Propón hasta tres huecos, de qué hora a qué hora, y el equipo vota el que mejor le venga.</p>
        </div>
      </div>
      <div className="ve-form">
        {slots.map((r, i) => {
          const n = i + 1;
          return (
            <fieldset key={i} className={`vet-slot${errs[i] ? " is-bad" : ""}`}>
              <legend>{i === 0 ? "Hueco 1" : `Hueco ${n} (opcional)`}</legend>
              <div className="vet-slot__g">
                <label className="ve-lab vet-slot__day">
                  Día
                  <input className="ve-in" type="date" min={minDay} value={r.day} aria-label={`Hueco ${n} · día`} onChange={(e) => setField(i, "day", e.target.value)} />
                </label>
                <label className="ve-lab">
                  Desde
                  <input className="ve-in" type="time" step={900} value={r.from} aria-label={`Hueco ${n} · desde`} onChange={(e) => setField(i, "from", e.target.value)} />
                </label>
                <label className="ve-lab">
                  Hasta
                  <input className="ve-in" type="time" step={900} value={r.to} aria-label={`Hueco ${n} · hasta`} onChange={(e) => setField(i, "to", e.target.value)} />
                </label>
              </div>
              {errs[i] && (
                <p className="ve-err" role="alert">
                  {errs[i]}
                </p>
              )}
            </fieldset>
          );
        })}
        <label className="ve-lab">
          <span className="vet-lab">
            <span>Lugar (opcional)</span>
            <span className="ve-count">{place.length}/80</span>
          </span>
          <input className="ve-in" type="text" maxLength={80} value={place} aria-label="Lugar (opcional)" onChange={(e) => setPlace(e.target.value.slice(0, 80))} placeholder="Campo de siempre" autoComplete="off" />
        </label>
        <Err text={act.error} />
        <div className="ve-acts">
          <button type="submit" className={`${BTN} nx-btn--pri`} disabled={act.busy}>
            <Ic name="send" />
            {act.busy ? "Proponiendo…" : "Proponer entreno"}
          </button>
          <button type="button" className={BTN} onClick={onDone}>
            Cancelar
          </button>
        </div>
      </div>
    </form>
  );
}
