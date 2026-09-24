import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { dateMillis, type ClubMatch } from "../../lib/clubData";
import {
  apiError,
  deleteBoardMessage,
  deleteTraining,
  postBoardMessage,
  predictScore,
  proposeTraining,
  voteMvp,
  voteTraining,
} from "../../lib/clubApi";
import { countdown, initials, nextWeekday, slotTime, plural, podium, porraPosition, slotParts, slotVotes, type MvpResult } from "../../lib/vestuario";
import {
  useMvpVoters,
  useMyMvpVote,
  useMyPrediction,
  useTrainingVotes,
  type BoardMessage,
  type PorraRow,
  type Training,
} from "./live";
import { Icon } from "../../components/celeste/icons";

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
export function TrainingPoll({ trainings, uid, admin, now }: { trainings: Training[]; uid: string; admin: boolean; now: number }) {
  const training = trainings[0];
  const votes = useTrainingVotes(training?.id);
  const [proposing, setProposing] = useState<{ first: number | null } | null>(null);
  const act = useAction();
  const mine = votes.data.find((v) => v.uid === uid)?.slotIds ?? [];
  const counts = training ? slotVotes(training.slots, votes.data) : new Map<string, number>();
  const toggle = (slotId: string) => {
    if (!training) return;
    const next = mine.includes(slotId) ? mine.filter((s) => s !== slotId) : [...mine, slotId];
    void act.run(() => voteTraining({ trainingId: training.id, slotIds: next }));
  };
  return (
    <section className="vx-train">
      <span className="vx-kick">El equipo · entrenos</span>
      <h2 className="vx-h2">¿Cuándo entrenamos?</h2>
      {training && !proposing ? (
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
              return (
                <button key={s.id} type="button" className="vx-slot" aria-pressed={on} disabled={act.busy || past} onClick={() => toggle(s.id)}>
                  {on && (
                    <span className="tick">
                      <Icon name="check" size={12} stroke={3.5} />
                    </span>
                  )}
                  <span className="day">{p.day}</span>
                  <span className="date">{p.date}</span>
                  <span className="time">{slotTime(s)}</span>
                  <span className="votes">{plural(counts.get(s.id) ?? 0, "voto", "votos")}</span>
                  {s.place && <span className="vx-sr">en {s.place}</span>}
                </button>
              );
            })}
          </div>
          <Err text={act.error} />
          <div className="vx-train-foot">
            <button type="button" className="vx-link-btn" onClick={() => setProposing({ first: null })}>
              Proponer otros huecos
            </button>
            {(training.proposedBy === uid || admin) && (
              <button type="button" className="vx-link-btn" disabled={act.busy} onClick={() => void act.run(() => deleteTraining({ trainingId: training.id }))}>
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

// ---------- porra
export function Porra({ next, uid, rows, now }: { next: ClubMatch | undefined; uid: string; rows: PorraRow[]; now: number }) {
  const saved = useMyPrediction(next?.id, uid);
  const [draft, setDraft] = useState<{ id: string; gf: number; ga: number } | null>(null);
  const act = useAction();
  const open = !!next && next.status === "scheduled" && dateMillis(next.date) > now;
  const gf = draft?.id === next?.id && draft ? draft.gf : (saved.data?.goalsFor ?? 0);
  const ga = draft?.id === next?.id && draft ? draft.ga : (saved.data?.goalsAgainst ?? 0);
  const dirty = !!draft && draft.id === next?.id && (draft.gf !== saved.data?.goalsFor || draft.ga !== saved.data?.goalsAgainst);
  const set = (side: "gf" | "ga", delta: number) => {
    if (!next) return;
    const base = { id: next.id, gf, ga };
    setDraft({ ...base, [side]: Math.max(0, Math.min(30, base[side] + delta)) });
  };
  const save = async () => {
    if (!next) return;
    if (await act.run(() => predictScore({ matchId: next.id, goalsFor: gf, goalsAgainst: ga }))) setDraft(null);
  };
  const me = porraPosition(rows, uid);
  const leader = rows[0];
  return (
    <section className="vx-porra">
      <span className="vx-kick">Tu porra</span>
      <h2 className="vx-h2">¿Cómo acaba?</h2>
      {next ? (
        <>
          <div className="vx-board-score">
            <Side label="Piti" value={gf} disabled={!open || act.busy} onChange={(d) => set("gf", d)} them={false} />
            <span className="vx-vs-dash" aria-hidden="true">
              –
            </span>
            <Side label={next.rival ?? "Rival"} value={ga} disabled={!open || act.busy} onChange={(d) => set("ga", d)} them />
          </div>
          {open ? (
            <div className="vx-porra-save">
              <button type="button" className="vx-btn" disabled={act.busy || (!dirty && !!saved.data)} onClick={() => void save()}>
                {act.busy ? "Guardando…" : saved.data && !dirty ? "Porra guardada" : saved.data ? "Cambiar mi porra" : "Guardar mi porra"}
              </button>
            </div>
          ) : (
            <p className="vx-porra-open">La porra se cerró al empezar el partido.</p>
          )}
          {open && <p className="vx-porra-open">Cierra en {countdown(dateMillis(next.date), now)} · exacto 3 pts · acierto 1 pt</p>}
          <Err text={act.error} />
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
          <p className="vx-note">
            Se abre con el próximo partido · <b>exacto 3 pts</b>, acierto 1.
          </p>
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
function Side({ label, value, disabled, onChange, them }: { label: string; value: number; disabled: boolean; onChange: (d: number) => void; them: boolean }) {
  return (
    <div className="vx-side-score">
      <span className="lbl">{label}</span>
      <div className={`vx-flap${them ? " them" : ""}`}>
        <b aria-live="polite">{value}</b>
      </div>
      <div className="vx-steps">
        <button type="button" className="vx-step" aria-label={`Un gol menos ${them ? "del rival" : "del Piti"}`} disabled={disabled || value === 0} onClick={() => onChange(-1)}>
          −
        </button>
        <button type="button" className="vx-step plus" aria-label={`Un gol más ${them ? "del rival" : "del Piti"}`} disabled={disabled} onClick={() => onChange(1)}>
          +
        </button>
      </div>
    </div>
  );
}

// ---------- MVP
export function MvpBlock({ match, result, uid, admin, member, now, playerName }: { match: ClubMatch | undefined; result: MvpResult | undefined; uid: string; admin: boolean; member: boolean; now: number; playerName: (id: string) => string }) {
  const myVote = useMyMvpVote(match?.id, uid);
  const voters = useMvpVoters(match?.id, admin);
  const [selection, setSelection] = useState<{ id: string; pick: string } | null>(null);
  const act = useAction();
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
  const open = (match.voteClosesAt ?? 0) > now;
  const pick = selection?.id === match.id ? selection.pick : myVote.data;
  const top = podium(result);
  const order = top.length === 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : top;
  const total = result?.total ?? 0;
  const candidates = Object.entries(match.ledger ?? {})
    .filter(([, row]) => row.played)
    .map(([id]) => id)
    .sort((a, b) => (result?.counts[b] ?? 0) - (result?.counts[a] ?? 0) || playerName(a).localeCompare(playerName(b), "es"));
  const vote = () => void act.run(() => voteMvp({ matchId: match.id, playerId: pick }));
  const heights = [74, 112, 54];
  return (
    <section className="vx-mvp">
      <span className="vx-kick">
        Piti {match.goalsFor ?? 0}–{match.goalsAgainst ?? 0} {match.rival} · {open ? `cierra en ${countdown(match.voteClosesAt ?? 0, now)}` : "votación cerrada"}
      </span>
      <h2 className="vx-h2">El MVP</h2>
      {order.length ? (
        <div className="vx-podium">
          {order.map((p) => {
            const rank = top.indexOf(p);
            const first = rank === 0;
            const size = first ? 80 : rank === 1 ? 60 : 56;
            return (
              <div key={p.playerId} className={`vx-pod${first ? " first" : ""}${p.playerId === myVote.data ? " mine" : ""}`}>
                {first && (
                  <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true" style={{ marginBottom: 6 }}>
                    <path d="M1 5l6 5 6-9 6 9 6-5-3 12H4Z" fill="#FFC659" />
                  </svg>
                )}
                <span className={`face ${first ? "g-sky" : rank === 1 ? "g-gold" : "g-grey"}`} style={{ width: size, height: size, fontSize: Math.round(size / 4.2) }}>
                  {initials(playerName(p.playerId))}
                </span>
                <span className="nm">{playerName(p.playerId)}</span>
                <span className="vt">
                  {plural(p.votes, "voto", "votos")}
                  {p.playerId === myVote.data ? " · tu voto" : ""}
                </span>
                <span className="step" style={{ height: heights[rank] }}>
                  {rank + 1}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="vx-empty">{open ? "Todavía no ha votado nadie. Abre tú la votación." : "No hubo votos en este partido."}</p>
      )}
      {open && member && (
        <div className="vx-vote">
          <fieldset>
            <legend>Tu voto</legend>
            <div className="vx-vote-list">
              {candidates.map((id) => (
                <label key={id}>
                  <input type="radio" name={`mvp-${match.id}`} value={id} checked={pick === id} disabled={act.busy} onChange={() => setSelection({ id: match.id, pick: id })} />
                  {playerName(id)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="vx-vote-foot">
            <button type="button" className="vx-btn" disabled={!pick || act.busy || pick === myVote.data} onClick={vote}>
              {act.busy ? "Guardando…" : pick && pick === myVote.data ? "Voto guardado" : myVote.data ? "Cambiar mi voto" : "Votar al MVP"}
            </button>
            <span className="vx-muted">{total} {total === 1 ? "voto del equipo" : "votos del equipo"}</span>
          </div>
          <Err text={act.error} />
        </div>
      )}
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
  const act = useAction();
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (await act.run(() => postBoardMessage({ text }))) setText("");
  };
  const quick = (t: string) => void act.run(() => postBoardMessage({ text: t }));
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
                <button key={t} type="button" className="vx-chip" disabled={act.busy} onClick={() => quick(t)}>
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
                <button type="button" className="vx-msg-del" onClick={() => void act.run(() => deleteBoardMessage({ id: m.id }))}>
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
                  <button type="button" className="vx-msg-del" onClick={() => void act.run(() => deleteBoardMessage({ id: m.id }))}>
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
          <button className="vx-send" aria-label="Enviar" disabled={!text.trim() || act.busy}>
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
          Cerrar sesión
        </button>
      </div>
    </section>
  );
}
