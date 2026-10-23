// «¿Cuándo entrenamos?» grown in place (/vestuario/entrenos, CL- boards part-vestuario vx.g.entrenos): the open
// proposal's slots to vote («Me viene» / «Me viene bien»), the proposer's or a captain's confirm, the propose form
// (up to three ranges), the confirmed training («Voy» / «No puedo», calendar, reopen, cancel) and the empty week.
import { useState, type FormEvent } from "react";
import { AddToCalendar } from "../../../components/celeste/AddToCalendar";
import { apiError, confirmTraining, deleteTraining, proposeTraining } from "../../../lib/clubApi";
import { MIN_PLAYERS, nextWeekday, plural, trainingOver } from "../../../lib/vestuario";
import { useOpenTrainings, useTrainingVotes, type Training } from "../live";
import { useWrite } from "../shared/useWrite";
import { voteTraining } from "../writes";
import type { VxCtx } from "./ctx";
import { confirmable, EMPTY_RANGE, firstRange, hoursPlace, localDay, proposal, rangeProblem, slotDayMonth, trainRows, type Range } from "./entrenosModel";

const BTN = "vd-glass vd-press vd-btn vd-btn--sm";

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
    <p className="cb-small" role="alert">
      {text}
    </p>
  ) : null;

export function EntrenosBlock({ c }: { c: VxCtx }) {
  const trainings = useOpenTrainings(c.now);
  const training = trainings.data.find((t) => !trainingOver(t, c.now));
  const votes = useTrainingVotes(training?.id);
  const [proposing, setProposing] = useState<{ first: number | null } | null>(null);
  const act = useAction();
  const vote = useWrite();
  const mine = votes.data.find((v) => v.uid === c.uid)?.slotIds ?? [];
  const canManage = !!training && (training.proposedBy === c.uid || c.admin);
  const setMine = (slotIds: string[]) => {
    const me = c.me;
    if (training && me) vote.write(() => voteTraining(me, training.id, slotIds));
  };
  const toggle = (slotId: string) => setMine(mine.includes(slotId) ? mine.filter((s) => s !== slotId) : [...mine, slotId]);
  const confirm = (slotId: string | null) => {
    if (training) void act.run(() => confirmTraining({ trainingId: training.id, slotId }));
  };
  const withdraw = () => {
    if (training) void act.run(() => deleteTraining({ trainingId: training.id }));
  };

  if (proposing) return <ProposeTraining key={proposing.first ?? "free"} first={proposing.first} now={c.now} onDone={() => setProposing(null)} say={c.say} />;

  if (!training) {
    if (trainings.loading) return null;
    const ghosts = [
      { day: "Sábado", time: "Propón hora", at: nextWeekday(c.now, 6, 10) },
      { day: "Domingo", time: "Propón hora", at: nextWeekday(c.now, 0, 10) },
      { day: "Otro día", time: "Elige el día", at: null },
    ];
    return (
      <>
        <p className="cb-small">Nadie ha propuesto huecos esta semana · sé el primero</p>
        <ul className="cb-train">
          {ghosts.map((g) => (
            <li key={g.day}>
              <div>
                <b>{g.day}</b>
                <span>{g.time}</span>
              </div>
              <button type="button" className={BTN} aria-label={`${g.day} · proponer entreno`} onClick={() => setProposing({ first: g.at })}>
                Proponer
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  }

  const conf = training.confirmed;
  if (conf) return <Confirmed c={c} training={training} going={votes.data.filter((v) => v.slotIds.includes(conf.slotId))} mine={mine.includes(conf.slotId)} onGo={(go) => setMine(go ? [conf.slotId] : [])} canManage={canManage} busy={act.busy} onReopen={() => confirm(null)} onWithdraw={withdraw} error={act.error || vote.error} />;

  const rows = trainRows(training.slots, votes.data, mine, c.now);
  const fixable = canManage ? confirmable(rows) : [];
  return (
    <>
      <p className="cb-small">Propuesto por {training.proposedByName}. Vota los huecos que te vienen bien.</p>
      {training.note && <p className="cb-small">{training.note}</p>}
      <ul className="cb-train" aria-label="Huecos propuestos">
        {rows.map((s) => (
          <li key={s.id}>
            <div>
              <b>{s.d}</b>
              <span>{s.h}</span>
              <span>{s.n}</span>
            </div>
            <button type="button" className={BTN} aria-pressed={s.on} disabled={s.past} aria-label={`${s.d} · ${s.h}: ${s.on ? "me viene bien" : "me viene"}`} onClick={() => toggle(s.id)}>
              {s.on ? "Me viene bien" : "Me viene"}
            </button>
          </li>
        ))}
      </ul>
      {fixable.length > 0 && (
        <div role="group" aria-label="Confirmar el entreno">
          <p className="cb-small">Confirma el hueco definitivo:</p>
          <div className="cb-row-acts">
            {fixable.map((s) => (
              <button key={s.id} type="button" className={`${BTN}${s.top ? " vd-btn--pri" : ""}`} disabled={act.busy} onClick={() => confirm(s.id)}>
                {s.d} · {s.t}
              </button>
            ))}
          </div>
        </div>
      )}
      <Err text={act.error || vote.error} />
      <div className="cb-row-acts">
        <button type="button" className="vd-link" onClick={() => setProposing({ first: null })}>
          Proponer otros huecos
        </button>
        {canManage && (
          <button type="button" className="vd-link" disabled={act.busy} onClick={withdraw}>
            Retirar propuesta
          </button>
        )}
      </div>
    </>
  );
}

function Confirmed({
  c,
  training,
  going,
  mine,
  onGo,
  canManage,
  busy,
  onReopen,
  onWithdraw,
  error,
}: {
  c: VxCtx;
  training: Training;
  going: { uid: string; name: string }[];
  mine: boolean;
  onGo: (go: boolean) => void;
  canManage: boolean;
  busy: boolean;
  onReopen: () => void;
  onWithdraw: () => void;
  error: string;
}) {
  const conf = training.confirmed!;
  const enough = going.length >= MIN_PLAYERS ? "Hay equipo." : `Con ${MIN_PLAYERS} hay equipo.`;
  return (
    <>
      <p className="cb-small">{conf.byName ? `Lo fijó ${conf.byName}` : "Confirmado"} · votación cerrada</p>
      <ul className="cb-train">
        <li>
          <div>
            <b>{slotDayMonth(conf.at)}</b>
            <span>{hoursPlace(conf)}</span>
            <span>
              {going.length ? `${plural(going.length, "va", "van")}.` : "Todavía no se ha apuntado nadie."} {enough}
            </span>
          </div>
        </li>
      </ul>
      <div className="cb-row-acts" role="group" aria-label="¿Vas al entreno?">
        <button type="button" className={`${BTN}${mine ? " vd-btn--pri" : ""}`} aria-pressed={mine} onClick={() => onGo(true)}>
          Voy
        </button>
        <button type="button" className={BTN} aria-pressed={false} disabled={!mine} onClick={() => onGo(false)}>
          No puedo
        </button>
      </div>
      {going.length > 0 && (
        <p className="cb-small">
          <b>Van:</b> {going.map((v) => (v.uid === c.uid ? "tú" : v.name)).join(", ")}
        </p>
      )}
      <Err text={error} />
      <div className="cb-row-acts">
        <AddToCalendar
          className="vd-link"
          label="Añadir al calendario"
          event={{ uid: `training-${training.id}`, title: "Entreno Manchester Piti", start: conf.at, end: conf.end ?? conf.at + 90 * 60_000, location: conf.place || undefined, url: `${location.origin}/vestuario/entrenos` }}
        />
        {canManage && (
          <>
            <button type="button" className="vd-link" disabled={busy} onClick={onReopen}>
              Reabrir votación
            </button>
            <button type="button" className="vd-link" disabled={busy} onClick={onWithdraw}>
              Cancelar entreno
            </button>
          </>
        )}
      </div>
    </>
  );
}

function ProposeTraining({ first, now, onDone, say }: { first: number | null; now: number; onDone: () => void; say: (t: string) => void }) {
  const [slots, setSlots] = useState<Range[]>([firstRange(first), EMPTY_RANGE, EMPTY_RANGE]);
  const [place, setPlace] = useState("");
  const act = useAction();
  const minDay = localDay(now);
  const out = proposal(slots, place);
  const setField = (i: number, key: keyof Range, value: string) => setSlots(slots.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!out) return;
    const ok = await act.run(() => proposeTraining({ slots: out, note: "" }));
    if (ok) {
      say("Entreno propuesto: el equipo ya puede votar.");
      onDone();
    }
  };
  return (
    <form className="cb-abs" onSubmit={(e) => void submit(e)} aria-label="Proponer entreno">
      <p className="cb-small">Propón hasta tres huecos, de qué hora a qué hora, y el equipo vota el que mejor le venga.</p>
      {slots.map((r, i) => {
        const bad = rangeProblem(r);
        const n = i + 1;
        return (
          <fieldset key={i} className="cb-abs__form">
            <legend className="vd-label">
              Hueco {n}
              {i > 0 ? " (opcional)" : ""}
            </legend>
            <label className="cb-abs__note">
              <span className="vd-label">Día</span>
              <input className="vd-input" type="date" min={minDay} value={r.day} aria-label={`Hueco ${n} · día`} required={i === 0} onChange={(e) => setField(i, "day", e.target.value)} />
            </label>
            <label>
              <span className="vd-label">Desde</span>
              <input className="vd-input" type="time" step={900} value={r.from} aria-label={`Hueco ${n} · desde`} required={i === 0} onChange={(e) => setField(i, "from", e.target.value)} />
            </label>
            <label>
              <span className="vd-label">Hasta</span>
              <input className="vd-input" type="time" step={900} value={r.to} aria-label={`Hueco ${n} · hasta`} required={i === 0} onChange={(e) => setField(i, "to", e.target.value)} />
            </label>
            {bad && (
              <p className="cb-small cb-abs__note" role="alert">
                {bad}
              </p>
            )}
          </fieldset>
        );
      })}
      <label>
        <span className="vd-label">Lugar (opcional)</span>
        <input className="vd-input" type="text" maxLength={80} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Campo de siempre" />
      </label>
      <Err text={act.error} />
      <div className="cb-row-acts">
        <button type="submit" className={`${BTN} vd-btn--pri`} disabled={!out || act.busy}>
          {act.busy ? "Proponiendo…" : "Proponer entreno"}
        </button>
        <button type="button" className="vd-link" onClick={onDone}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
