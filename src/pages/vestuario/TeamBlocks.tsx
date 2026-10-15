import { Fragment, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { ClubMatch } from "../../lib/clubData";
import { apiError, confirmTraining, deleteTraining, proposeTraining } from "../../lib/clubApi";
import { deleteBoardMessage, postBoardMessage, useMe, voteTraining } from "./writes";
import { initials, MIN_PLAYERS, mvpAnnouncement, mvpRace, nextWeekday, slotStanding, slotTime, trainingOver, plural, porraPosition, slotParts, voteLeft, type MvpResult } from "../../lib/vestuario";
import {
  useMvpResultsSync,
  useMvpReveal,
  useMvpVoters,
  useMyMvpVote,
  useTrainingVotes,
  type BoardMessage,
  type PorraRow,
  type Training,
} from "./live";
import { Icon } from "../../components/celeste/icons";
import type { PlayerDoc } from "../../lib/schemas";
import { AddToCalendar } from "../../components/celeste/AddToCalendar";
import { PlayerLink } from "../../components/celeste/PlayerLink";
import { useWrite } from "./shared/useWrite";
import { PORRA_RULE, PorraCard } from "./shared/PorraCard";
import { MvpBallot } from "./shared/MvpBallot";

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
    <p className="vx-error" role="alert">
      {text}
    </p>
  ) : null;

// ---------- trainings
const dayLabel = (ms: number) => {
  const p = slotParts(ms);
  return `${p.day} ${p.date} ${p.month}`;
};
export function TrainingPoll({ trainings, uid, admin, now }: { trainings: Training[]; uid: string; admin: boolean; now: number }) {
  const training = trainings.find((t) => !trainingOver(t, now));
  const votes = useTrainingVotes(training?.id);
  const [proposing, setProposing] = useState<{ first: number | null } | null>(null);
  const act = useAction();
  const vote = useWrite();
  const me = useMe();
  const mine = votes.data.find((v) => v.uid === uid)?.slotIds ?? [];
  const standing = training ? slotStanding(training.slots, votes.data) : null;
  const canManage = !!training && (training.proposedBy === uid || admin);
  const toggle = (slotId: string) => {
    if (!training) return;
    const next = mine.includes(slotId) ? mine.filter((s) => s !== slotId) : [...mine, slotId];
    if (me) vote.write(() => voteTraining(me, training.id, next));
  };
  const confirm = (slotId: string | null) => training && void act.run(() => confirmTraining({ trainingId: training.id, slotId }));
  const withdraw = () => training && void act.run(() => deleteTraining({ trainingId: training.id }));
  const c = training?.confirmed;
  return (
    <section className="vx-train" id="vx-train">
      <span className="vx-kick">El equipo · entrenos</span>
      <h2 className="vx-h2">{c ? "Entreno confirmado" : "¿Cuándo entrenamos?"}</h2>
      {training && c && !proposing ? (
        <ConfirmedTraining
          training={training}
          going={votes.data.filter((v) => v.slotIds.includes(c.slotId))}
          mine={mine.includes(c.slotId)}
          busy={act.busy}
          onGo={(go) => me && vote.write(() => voteTraining(me, training.id, go ? [c.slotId] : []))}
          canManage={canManage}
          onReopen={() => confirm(null)}
          onWithdraw={withdraw}
          error={act.error || vote.error}
        />
      ) : training && !proposing ? (
        <>
          <p className="vx-sub">
            {training.proposedByName} propone {plural(training.slots.length, "hueco", "huecos")} ·{" "}
            {mine.length ? "tú ya votaste" : "marca los que te vengan bien"}
          </p>
          {training.note && <p className="vx-sub">{training.note}</p>}
          <div className="vx-slots" role="group" aria-label="Huecos propuestos">
            {training.slots.map((s) => {
              const p = slotParts(s.at);
              const on = mine.includes(s.id);
              const past = s.at <= now;
              const ready = standing?.ready.has(s.id);
              const top = standing?.top.has(s.id);
              return (
                <button key={s.id} type="button" className={`vx-slot${top ? " top" : ""}`} aria-pressed={on} disabled={past} onClick={() => toggle(s.id)}>
                  {on && (
                    <span className="tick">
                      <Icon name="check" size={12} stroke={3.5} />
                    </span>
                  )}
                  <span className="day">{p.day}</span>
                  <span className="date">{p.date}</span>
                  <span className="time">{slotTime(s)}</span>
                  <span className="votes">{plural(standing?.counts.get(s.id) ?? 0, "voto", "votos")}</span>
                  {(ready || top) && <span className="flag">{ready ? "Ya hay equipo" : "Más votado"}</span>}
                  {s.place && <span className="vx-sr">en {s.place}</span>}
                </button>
              );
            })}
          </div>
          {canManage && (
            <div className="vx-confirm" role="group" aria-label="Confirmar el entreno">
              <span>Confirma el hueco definitivo:</span>
              <div className="row">
                {training.slots
                  .filter((s) => s.at > now)
                  .sort((x, y) => (standing?.counts.get(y.id) ?? 0) - (standing?.counts.get(x.id) ?? 0) || x.at - y.at)
                  .map((s) => (
                    <button key={s.id} type="button" className={`vx-mini-btn${standing?.top.has(s.id) ? "" : " sky"}`} disabled={act.busy} onClick={() => confirm(s.id)}>
                      <Icon name="check" size={14} stroke={2.6} />
                      {dayLabel(s.at)} · {slotTime(s)}
                    </button>
                  ))}
              </div>
            </div>
          )}
          <Err text={act.error || vote.error} />
          <div className="vx-train-foot">
            <button type="button" className="vx-link-btn" onClick={() => setProposing({ first: null })}>
              Proponer otros huecos
            </button>
            {canManage && (
              <button type="button" className="vx-link-btn" disabled={act.busy} onClick={withdraw}>
                Retirar propuesta
              </button>
            )}
          </div>
        </>
      ) : proposing ? (
        <ProposeTraining key={proposing.first ?? "free"} first={proposing.first} onDone={() => setProposing(null)} canCancel now={now} />
      ) : (
        <>
          <p className="vx-sub">Nadie ha propuesto huecos esta semana · sé el primero</p>
          <div className="vx-slots">
            {[
              { day: "Sábado", time: "propón hora", at: nextWeekday(now, 6, 10) },
              { day: "Domingo", time: "propón hora", at: nextWeekday(now, 0, 10) },
              { day: "Otro día", time: "elige", at: null },
            ].map((g) => (
              <button key={g.day} type="button" className="vx-slot ghost" onClick={() => setProposing({ first: g.at })}>
                <span className="plus" aria-hidden="true">
                  <Icon name="plus" size={20} stroke={2.4} />
                </span>
                <span className="day">{g.day}</span>
                <span className="time">{g.time}</span>
                <span className="vx-sr"> · proponer entreno</span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ConfirmedTraining({
  training,
  going,
  mine,
  busy,
  onGo,
  canManage,
  onReopen,
  onWithdraw,
  error,
}: {
  training: Training;
  going: { uid: string; name: string }[];
  mine: boolean;
  busy: boolean;
  onGo: (go: boolean) => void;
  canManage: boolean;
  onReopen: () => void;
  onWithdraw: () => void;
  error: string;
}) {
  const c = training.confirmed!;
  return (
    <div className="vx-confirmed">
      <span className="k">{c.byName ? `Lo fijó ${c.byName}` : "Confirmado"} · votación cerrada</span>
      <b className="when">{dayLabel(c.at)}</b>
      <span className="range">
        {slotTime(c)}
        {c.place ? ` · ${c.place}` : ""}
      </span>
      <div className="vx-rsvp two" role="group" aria-label="¿Vas al entreno?">
        <button type="button" aria-pressed={mine} onClick={() => onGo(true)}>
          {mine && <Icon name="check" size={15} stroke={3} />}
          Voy
        </button>
        <button type="button" aria-pressed={false} disabled={!mine} onClick={() => onGo(false)}>
          No puedo
        </button>
      </div>
      <div className="vx-attend">
        {going.length > 0 && (
          <div className="vx-faces" aria-hidden="true">
            {going.slice(0, 5).map((v, i) => (
              <span key={v.uid} className={`vx-face ${["g-sky", "g-gold", "g-grey"][i % 3]}`}>
                {initials(v.name)}
              </span>
            ))}
            {going.length > 5 && <span className="vx-face more">+{going.length - 5}</span>}
          </div>
        )}
        <span>
          <b>{going.length ? `${plural(going.length, "va", "van")}.` : "Todavía no se ha apuntado nadie."}</b>{" "}
          {going.length >= MIN_PLAYERS ? "Hay equipo." : `Con ${MIN_PLAYERS} hay equipo.`}
        </span>
      </div>
      <Err text={error} />
      <div className="vx-train-foot">
        <AddToCalendar
          className="vx-link-btn"
          label="Añadir al calendario"
          event={{ uid: `training-${training.id}`, title: "Entreno Manchester Piti", start: c.at, end: c.end ?? c.at + 90 * 60_000, location: c.place || undefined, url: `${location.origin}/vestuario` }}
        />
        {canManage && (
          <>
            <button type="button" className="vx-link-btn" disabled={busy} onClick={onReopen}>
              Reabrir votación
            </button>
            <button type="button" className="vx-link-btn" disabled={busy} onClick={onWithdraw}>
              Cancelar entreno
            </button>
          </>
        )}
      </div>
    </div>
  );
}
const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const localTime = (ms: number) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
interface Range { day: string; from: string; to: string }
const emptyRange: Range = { day: "", from: "", to: "" };
/** A range the backend accepts: complete, ending after it starts. */
const rangeMs = (r: Range) => {
  if (!r.day || !r.from || !r.to) return null;
  const at = new Date(`${r.day}T${r.from}`).getTime(), end = new Date(`${r.day}T${r.to}`).getTime();
  return end > at ? { at, end } : null;
};
function ProposeTraining({ first, onDone, canCancel, now }: { first: number | null; onDone: () => void; canCancel: boolean; now: number }) {
  // Ghost slots prefill their day with a 1 h 30 range from the suggested start.
  const [slots, setSlots] = useState<Range[]>([first ? { day: localDay(first), from: localTime(first), to: localTime(first + 90 * 60_000) } : emptyRange, emptyRange, emptyRange]);
  const [place, setPlace] = useState("");
  const act = useAction();
  const minDay = localDay(now);
  const started = slots.filter((r) => r.day || r.from || r.to);
  const ranges = started.map(rangeMs);
  const valid = started.length > 0 && ranges.every(Boolean);
  const setField = (i: number, key: keyof Range, value: string) => setSlots(slots.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const ok = await act.run(() => proposeTraining({ slots: ranges.map((r) => ({ at: r!.at, end: r!.end, place })), note: "" }));
    if (ok) {
      setSlots([emptyRange, emptyRange, emptyRange]);
      onDone();
    }
  };
  return (
    <form className="vx-propose" onSubmit={submit}>
      <p className="vx-sub">Propón hasta tres huecos, de qué hora a qué hora, y el equipo vota el que mejor le venga.</p>
      <div className="vx-propose-slots">
        {slots.map((r, i) => {
          const bad = (r.day || r.from || r.to) && !rangeMs(r);
          return (
            <fieldset key={i} className="vx-range">
              <legend>Hueco {i + 1}{i > 0 ? " (opcional)" : ""}</legend>
              <label className="vx-field day">
                Día
                <input type="date" min={minDay} value={r.day} aria-label={`Hueco ${i + 1} · día`} required={i === 0} onChange={(e) => setField(i, "day", e.target.value)} />
              </label>
              <label className="vx-field">
                Desde
                <input type="time" step={900} value={r.from} aria-label={`Hueco ${i + 1} · desde`} required={i === 0} onChange={(e) => setField(i, "from", e.target.value)} />
              </label>
              <label className="vx-field">
                Hasta
                <input type="time" step={900} value={r.to} aria-label={`Hueco ${i + 1} · hasta`} required={i === 0} onChange={(e) => setField(i, "to", e.target.value)} />
              </label>
              {bad && (
                <p className="vx-range-err" role="alert">
                  {r.day && r.from && r.to ? "La hora de fin debe ser posterior a la de inicio." : "Completa día, desde y hasta."}
                </p>
              )}
            </fieldset>
          );
        })}
      </div>
      <label className="vx-field">
        Lugar (opcional)
        <input type="text" maxLength={80} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Campo de siempre" />
      </label>
      <Err text={act.error} />
      <div className="vx-train-foot">
        <button className="vx-btn" disabled={!valid || act.busy}>
          {act.busy ? "Proponiendo…" : "Proponer entreno"}
        </button>
        {canCancel && (
          <button type="button" className="vx-link-btn" onClick={onDone}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

/** To the match page's Vestuario tab (?tab=vestuario), where the match's porra and MVP vote live too. */
function ToMatch({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p className="vx-tomatch">
      <Link to="/matches/$matchId" params={{ matchId: id }} search={{ tab: "vestuario" }}>
        {children}
        <Icon name="arrow" size={14} stroke={2.2} />
      </Link>
    </p>
  );
}

// ---------- porra
export function Porra({ next, uid, rows, players = [] }: { next: ClubMatch | undefined; uid: string; rows: PorraRow[]; now: number; players?: PlayerDoc[] }) {
  const me = porraPosition(rows, uid);
  const leader = rows[0];
  return (
    <section className="vx-porra">
      <span className="vx-kick">Tu porra</span>
      <h2 className="vx-h2">¿Cómo acaba?</h2>
      {next ? (
        <>
          {/* (the shared member control: the same porra and write as the match page's Vestuario tab) */}
          <PorraCard match={next} players={players} uid={uid} />
          <ToMatch id={next.id}>La porra, en la ficha del partido</ToMatch>
        </>
      ) : (
        <>
          <div className="vx-board-score" aria-hidden="true">
            <div className="vx-side-score">
              <span className="lbl">Piti</span>
              <div className="vx-flap q">
                <b>?</b>
              </div>
            </div>
            <span className="vx-vs-dash">–</span>
            <div className="vx-side-score">
              <span className="lbl">Rival</span>
              <div className="vx-flap them q">
                <b>?</b>
              </div>
            </div>
          </div>
          <p className="vx-note">Se abre con el próximo partido. {PORRA_RULE}</p>
        </>
      )}
      {(next || leader) && (
      <p className="vx-note">
        {me && leader ? (
          me.position === 1 ? (
            <>
              Mandas tú con <span className="g">{plural(me.row.points, "punto", "puntos")}</span>.
            </>
          ) : (
            <>
              Vas <b>{me.position}.º</b>. {leader.name} manda con <span className="g">{plural(leader.points, "punto", "puntos")}</span>.
            </>
          )
        ) : leader ? (
          <>
            {leader.name} manda con <span className="g">{plural(leader.points, "punto", "puntos")}</span>. Tu primera porra cuenta desde el próximo partido.
          </>
        ) : (
          "La clasificación arranca con el primer partido con porra."
        )}
      </p>
      )}
    </section>
  );
}
// ---------- MVP
export function MvpBlock({ match, result, uid, admin, member, now, playerName }: { match: ClubMatch | undefined; result: MvpResult | undefined; uid: string; admin: boolean; member: boolean; now: number; playerName: (id: string) => string }) {
  const myVote = useMyMvpVote(match?.id, uid);
  const voters = useMvpVoters(match?.id, admin);
  // the live race while the vote is open (counts only, never who voted whom), the podium once it closes
  const race = mvpRace(match?.voteClosesAt, result, now);
  const open = race.state === "open";
  const sync = useMvpResultsSync();
  const reveal = useMvpReveal({ id: match?.id, open, winner: !!match && race.winners.length > 0, closesAt: match?.voteClosesAt, now });
  if (!match) {
    return (
      <section className="vx-mvp">
        <span className="vx-kick">Tras cada partido · 48 h</span>
        <h2 className="vx-h2">El MVP</h2>
        <div className="vx-podium" aria-hidden="true">
          {[
            { rank: 2, size: 60, step: 74 },
            { rank: 1, size: 80, step: 112 },
            { rank: 3, size: 56, step: 54 },
          ].map((p) => (
            <div key={p.rank} className="vx-pod ghost">
              <span className="face" style={{ width: p.size, height: p.size, fontSize: Math.round(p.size / 3.4) }}>
                ?
              </span>
              <span className="nm">—</span>
              <span className="vt">&nbsp;</span>
              <span className="step" style={{ height: p.step }}>
                {p.rank}
              </span>
            </div>
          ))}
        </div>
        <p className="vx-note">El equipo elige aquí a su MVP después del próximo partido.</p>
      </section>
    );
  }
  const { rows } = race;
  // the podium: 2nd · 1st · 3rd, three steps at most (360 px); the rest of a tie goes in a line below
  const steps = rows.slice(0, 3);
  const order = steps.length === 3 ? [steps[1], steps[0], steps[2]] : steps.length === 2 ? [steps[1], steps[0]] : steps;
  const more = rows.slice(3);
  const STEP = [112, 74, 54];
  const FACE = [80, 60, 56];
  return (
    <section className="vx-mvp">
      <span className="vx-kick">
        Piti {match.goalsFor ?? 0}–{match.goalsAgainst ?? 0} {match.rival} · {open ? `Cierra en ${voteLeft(match.voteClosesAt ?? 0, now)}` : "votación cerrada"}
      </span>
      <h2 className="vx-h2">{open ? "La carrera del MVP" : race.winners.length > 1 ? "MVP compartido" : "El MVP"}</h2>
      <p className="sr-only" aria-live="polite">
        {mvpAnnouncement(race, (open ? race.leaders : race.winners).map(playerName))}
      </p>
      {sync.stale && <p className="vx-note">Sin conexión: puede faltar algún voto en el recuento.</p>}
      {!rows.length ? (
        <p className="vx-empty">{open ? "Todavía no ha votado nadie. Abre tú la votación." : "No hubo votos en este partido."}</p>
      ) : open ? (
        <ol className="vx-race" aria-label="La carrera del MVP">
          {rows.map((r) => (
            <li key={r.playerId} className={`${r.rank === 1 ? "lead" : ""}${r.playerId === myVote.data ? " mine" : ""}`}>
              <span className="rk">{r.rank}.º</span>
              <span className="nm">
                {r.shared && <span className="sr-only">empatado, </span>}
                <PlayerLink id={r.playerId} seasonId={match.seasonId}>
                  {playerName(r.playerId)}
                </PlayerLink>
                {r.playerId === myVote.data && <small> · tu voto</small>}
              </span>
              <b>
                {r.votes}
                <span className="sr-only"> {r.votes === 1 ? "voto" : "votos"}</span>
              </b>
              <span className="vx-pbar" aria-hidden="true">
                <i style={{ width: `${(r.votes / rows[0].votes) * 100}%` }} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <>
          <div className={`vx-podium${reveal ? " reveal" : ""}`}>
            {order.map((p) => {
              const first = p.rank === 1;
              const size = FACE[p.rank - 1];
              return (
                <div key={p.playerId} className={`vx-pod${first ? " first" : ""}${p.playerId === myVote.data ? " mine" : ""}`} style={{ animationDelay: `${(3 - p.rank) * 140}ms` }}>
                  {first && (
                    <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true" style={{ marginBottom: 6 }}>
                      <path d="M1 5l6 5 6-9 6 9 6-5-3 12H4Z" fill="#FFC659" />
                    </svg>
                  )}
                  <span className={`face ${first ? "g-sky" : p.rank === 2 ? "g-gold" : "g-grey"}`} style={{ width: size, height: size, fontSize: Math.round(size / 4.2) }} aria-hidden="true">
                    {initials(playerName(p.playerId))}
                  </span>
                  <span className="nm">
                    <PlayerLink id={p.playerId} seasonId={match.seasonId}>
                      {playerName(p.playerId)}
                    </PlayerLink>
                  </span>
                  <span className="vt">
                    {plural(p.votes, "voto", "votos")}
                    {p.shared ? " · empate" : ""}
                    {p.playerId === myVote.data ? " · tu voto" : ""}
                  </span>
                  <span className="step" style={{ height: STEP[p.rank - 1] }}>
                    {p.rank}
                  </span>
                </div>
              );
            })}
          </div>
          {more.length > 0 && (
            <p className="vx-note">
              y {more.length} {more.length === 1 ? "más empatado" : "más empatados"} con {plural(more[0].votes, "voto", "votos")}:{" "}
              {more.map((r, i) => (
                <Fragment key={r.playerId}>
                  {i === 0 ? "" : i === more.length - 1 ? " y " : ", "}
                  <PlayerLink id={r.playerId} seasonId={match.seasonId}>
                    {playerName(r.playerId)}
                  </PlayerLink>
                </Fragment>
              ))}
            </p>
          )}
        </>
      )}
      {/* (the shared member ballot: the same vote and write as the match page's Vestuario tab) */}
      {member && <MvpBallot match={match} now={now} uid={uid} counts={result?.counts} total={result?.total ?? 0} nameOf={playerName} />}
      <ToMatch id={match.id}>El MVP, en la ficha del partido</ToMatch>
      {admin && voters.data.length > 0 && (
        <details className="vx-voters">
          <summary>Ver quién ha votado · Solo administradores</summary>
          <ul>
            {voters.data.map((v) => (
              <li key={v.uid}>
                {v.voterName} → <b>{playerName(v.playerId)}</b>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

// ---------- board
const QUICK = ["¡Hola, equipo!", "¿Pachanga el sábado?", "Yo llevo balones"];
export function Board({ messages, uid, admin, loading, now }: { messages: BoardMessage[]; uid: string; admin: boolean; loading: boolean; now: number }) {
  const [text, setText] = useState("");
  const act = useWrite();
  const me = useMe();
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!me || !text.trim()) return;
    const sent = text;
    setText("");
    act.write(() =>
      postBoardMessage(me, sent).catch((error: unknown) => {
        setText((t) => t || sent); // give the text back if it did not go out
        throw error;
      }),
    );
  };
  const quick = (t: string) => me && act.write(() => postBoardMessage(me, t));
  const ordered = [...messages].reverse();
  const ago = (at: number) => {
    const m = Math.round((now - at) / 60_000);
    if (m < 1) return "ahora";
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    return d === 1 ? "ayer" : `hace ${d} días`;
  };
  return (
    <section className="vx-board-sec" id="vx-board">
      <span className="vx-kick">Tablón</span>
      <h2 className="vx-h2">El vestuario habla</h2>
      <div className="vx-msgs" aria-live="polite">
        {!loading && !ordered.length && (
          <div>
            <p className="vx-empty-line">Nadie ha escrito todavía. Preséntate con un toque:</p>
            <div className="vx-chips">
              {QUICK.map((t) => (
                <button key={t} type="button" className="vx-chip" onClick={() => quick(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        {ordered.map((m, i) =>
          m.uid === uid ? (
            <div key={m.id} className="vx-msg mine">
              <div className="bd">
                {m.text}
                <button type="button" className="vx-msg-del" onClick={() => act.write(() => deleteBoardMessage(m.id))}>
                  Borrar<span className="vx-sr"> tu mensaje</span>
                </button>
              </div>
            </div>
          ) : (
            <div key={m.id} className="vx-msg">
              <span className={`av ${i % 2 ? "g-gold" : "g-sky"}`} aria-hidden="true">
                {initials(m.name)}
              </span>
              <div className="bd">
                <span className={`who${i % 2 ? " g" : ""}`}>
                  {m.name} · {ago(m.at)}
                </span>
                <p>{m.text}</p>
                {admin && (
                  <button type="button" className="vx-msg-del" onClick={() => act.write(() => deleteBoardMessage(m.id))}>
                    Borrar<span className="vx-sr"> el mensaje de {m.name}</span>
                  </button>
                )}
              </div>
            </div>
          ),
        )}
        <form className="vx-compose" onSubmit={send}>
          <label className="vx-sr" htmlFor="vx-compose">
            Escribe al vestuario
          </label>
          <input id="vx-compose" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="Escribe al vestuario…" autoComplete="off" />
          <button className="vx-send" aria-label="Enviar" disabled={!text.trim()}>
            <Icon name="send" size={18} stroke={2.2} />
          </button>
        </form>
        <Err text={act.error} />
      </div>
    </section>
  );
}

// ---------- access
export function Access({ admin, playerId, onLogout }: { admin: boolean; playerId?: string; onLogout: () => void }) {
  return (
    <section className="vx-access">
      <Link className="vx-cta" to="/pizarra">
        <span>Abrir la pizarra</span>
        <span className="dot">
          <Icon name="arrow" size={20} stroke={2.2} />
        </span>
      </Link>
      <div>
        <div className="vx-links">
          <Link className="vx-link" to="/stats">
            <Icon name="stats" size={22} />
            Estadísticas
          </Link>
          {playerId ? (
            <Link className="vx-link" to="/jugadores/$playerId" params={{ playerId }}>
              <Icon name="user" size={22} />
              Mi ficha
            </Link>
          ) : (
            <Link className="vx-link" to="/profile">
              <Icon name="user" size={22} />
              Mi perfil
            </Link>
          )}
          {admin ? (
            <Link className="vx-link gold" to="/admin">
              <Icon name="shield" size={22} />
              Administrar el club
            </Link>
          ) : (
            <Link className="vx-link" to="/plantilla">
              <Icon name="team" size={22} />
              Plantilla
            </Link>
          )}
        </div>
        <button type="button" className="vx-logout" onClick={onLogout}>
          <Icon name="logout" size={16} />
          Salir en este dispositivo
        </button>
      </div>
    </section>
  );
}
