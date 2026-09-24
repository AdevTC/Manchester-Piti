import { useEffect, useMemo, useState } from "react";
import { Link, useBlocker } from "@tanstack/react-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import {
  Plus,
  Trash2,
  Save,
  Send,
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
} from "lucide-react";
import { db } from "../../firebase";
import {
  useClubData,
  calculateLedger,
  dateMillis,
  EVENT_LABELS,
  formatDate,
  playerName,
  type MatchSheet,
  type MatchEvent,
  type ClubMatch,
} from "../../lib/clubData";
import { useSeason } from "../../context/SeasonContext";
import { saveMatchSheet, apiError } from "../../lib/clubApi";
import { SectionTitle } from "../../components/club/ClubUI";
import { downloadMatchPoster } from "../../lib/matchPoster";
const defaultSheet = (): MatchSheet => ({
  version: 2,
  revision: 0,
  seasonId: "",
  rival: "",
  competition: "Liga",
  date: Date.now(),
  duration: 60,
  venue: "",
  home: true,
  status: "scheduled",
  starters: [],
  bench: [],
  notCalled: [],
  events: [],
  report: "",
  goalsFor: 0,
  goalsAgainst: 0,
});
function dateInput(ms: number) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(ms)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function madridTime(value: string): number {
  const base = Date.parse(`${value}Z`);
  if (!Number.isFinite(base)) return NaN;
  let ms = base;
  for (let i = 0; i < 3; i++) ms += base - Date.parse(`${dateInput(ms)}Z`);
  return dateInput(ms) === value ? ms : NaN;
}
export function MatchEditor() {
  const { matches, players, loading, error: loadError } = useClubData();
  const { seasons } = useSeason();
  const [active, setActive] = useState<string | null>(null);
  const [sheet, setSheet] = useState<MatchSheet>(defaultSheet);
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<ClubMatch[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [event, setEvent] = useState<MatchEvent>({
    id: crypto.randomUUID(),
    type: "goal",
    minute: 0,
    playerId: "",
    assistPlayerId: "",
    inPlayerId: "",
  });
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "matchDrafts"), orderBy("updatedAt", "desc")),
        (snap) =>
          setDrafts(
            snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClubMatch),
          ),
        () => {},
      ),
    [],
  );
  useBlocker({
    shouldBlockFn: () =>
      dirty &&
      !window.confirm(
        "Hay cambios sin guardar. ¿Quieres salir y descartarlos?",
      ),
    enableBeforeUnload: dirty,
  });
  const update = <K extends keyof MatchSheet>(key: K, value: MatchSheet[K]) => {
    setSheet((s) => ({ ...s, [key]: value }));
    setDirty(true);
    setMessage("");
  };
  const roster = players.filter((p) => p.seasons?.includes(sheet.seasonId));
  const names = Object.fromEntries(players.map((p) => [p.id, playerName(p)]));
  const ledger = useMemo(
    () => calculateLedger(sheet, sheet.status === "finished"),
    [sheet],
  );
  const choose = async (match?: ClubMatch, draft = false) => {
    if (
      dirty &&
      !window.confirm("Hay cambios sin guardar. ¿Quieres descartarlos?")
    )
      return;
    setError("");
    setMessage("");
    setDirty(false);
    setStep(0);
    setEditingEvent(null);
    const id = match?.id || crypto.randomUUID();
    setActive(id);
    if (!match) {
      setSheet({ ...defaultSheet(), seasonId: seasons.at(-1)?.id || "" });
      return;
    }
    const raw = draft
      ? (await getDoc(doc(db, "matchDrafts", id))).data()
      : match;
    setSheet({
      ...defaultSheet(),
      ...raw,
      status:
        raw?.status ??
        (typeof raw?.goalsFor === "number" ? "finished" : "scheduled"),
      date: dateMillis(raw?.date),
      events: ((raw?.events ?? []) as MatchEvent[]).map((e) => ({
        ...e,
        id: e.id || crypto.randomUUID(),
      })),
      starters: raw?.starters ?? [],
      bench: raw?.bench ?? [],
      notCalled: raw?.notCalled ?? [],
    } as MatchSheet);
    try {
      const note = await getDoc(doc(db, "matchPrivate", id));
      if (note.exists())
        setSheet((s) => ({ ...s, meetingNote: note.data().meetingNote ?? "" }));
    } catch {
      /* Old games may not have a private note. */
    }
  };
  const assign = (id: string, role: string) => {
    if (
      role === "starters" &&
      sheet.starters.length >= 7 &&
      !sheet.starters.includes(id)
    ) {
      setError(
        "Ya hay siete titulares. Cambia primero la situación de otro jugador.",
      );
      return;
    }
    setError("");
    setDirty(true);
    setSheet((s) => ({
      ...s,
      starters: s.starters
        .filter((x) => x !== id)
        .concat(role === "starters" ? [id] : []),
      bench: s.bench
        .filter((x) => x !== id)
        .concat(role === "bench" ? [id] : []),
      notCalled: s.notCalled
        .filter((x) => x !== id)
        .concat(role === "notCalled" ? [id] : []),
    }));
  };
  const addEvent = () => {
    if (
      !Number.isInteger(event.minute) ||
      event.minute! < 0 ||
      event.minute! > sheet.duration
    ) {
      setError("Indica el minuto del evento.");
      return;
    }
    const external = ["opponent_goal", "opponent_own_goal"].includes(
      event.type,
    );
    if (!external && !event.playerId) {
      setError("Selecciona al jugador.");
      return;
    }
    const clean: MatchEvent = {
      id: event.id,
      type: event.type,
      minute: event.minute,
      ...(!external ? { playerId: event.playerId } : {}),
      ...(["goal", "goal_penalty", "goal_freekick"].includes(event.type) &&
      event.assistPlayerId
        ? { assistPlayerId: event.assistPlayerId }
        : {}),
      ...(event.type === "substitution"
        ? { inPlayerId: event.inPlayerId }
        : {}),
      ...(event.note ? { note: event.note } : {}),
    };
    update(
      "events",
      editingEvent
        ? sheet.events.map((e) => (e.id === editingEvent ? clean : e))
        : [...sheet.events, clean],
    );
    setEditingEvent(null);
    setEvent({
      id: crypto.randomUUID(),
      type: event.type,
      minute: event.minute,
      playerId: "",
      assistPlayerId: "",
      inPlayerId: "",
    });
    setError("");
  };
  const save = async (draft: boolean) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (
        !sheet.seasonId ||
        !sheet.rival.trim() ||
        !Number.isFinite(sheet.date)
      )
        throw new Error("Completa temporada, rival y fecha.");
      if (
        !draft &&
        sheet.status === "finished" &&
        roster.some(
          (p) =>
            ![...sheet.starters, ...sheet.bench, ...sheet.notCalled].includes(
              p.id,
            ),
        )
      )
        throw new Error(
          "Asigna una situación inicial a todos los jugadores de la temporada.",
        );
      if (!draft && ledger.errors.length)
        throw new Error(ledger.errors.join(" "));
      const payload = { ...sheet };
      delete payload.id;
      await saveMatchSheet({ id: active!, sheet: payload, draft });
      if (!draft) setSheet((s) => ({ ...s, revision: (s.revision ?? 0) + 1 }));
      setDirty(false);
      setMessage(
        draft
          ? "Borrador guardado. Solo lo ven los administradores."
          : "Partido publicado. Calendario, perfiles y estadísticas actualizados.",
      );
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };
  if (!active)
    return (
      <div className="club-page">
        <header className="club-page-head">
          <span className="club-kicker">ADMINISTRACIÓN</span>
          <h1>
            El partido
            <br />
            <em>empieza aquí.</em>
          </h1>
          <p>Programa encuentros. Prepara el siete. Cuenta lo que pasó.</p>
        </header>
        <div className="club-toolbar">
          <button className="club-button" onClick={() => void choose()}>
            <Plus size={18} />
            Nuevo partido
          </button>
          <div className="club-actions">
            <Link
              to="/admin"
              search={{ tab: "roster" }}
              className="club-button secondary"
            >
              Jugadores
            </Link>
            <Link
              to="/admin"
              search={{ tab: "seasons" }}
              className="club-button secondary"
            >
              Temporadas
            </Link>
            <Link
              to="/admin"
              search={{ tab: "admins" }}
              className="club-button secondary"
            >
              Permisos
            </Link>
            <Link to="/admin/contenido" className="club-button secondary">
              Contenido y fotos
            </Link>
          </div>
        </div>
        {drafts.length > 0 && (
          <>
            <SectionTitle title="Borradores" />
            <div className="club-admin-list">
              {drafts.map((m) => (
                <button key={m.id} onClick={() => void choose(m, true)}>
                  <span>
                    <b>{m.rival}</b>
                    <small>{formatDate(m.date, true)}</small>
                  </span>
                  <span>Continuar borrador →</span>
                </button>
              ))}
            </div>
          </>
        )}
        <SectionTitle title="Calendario y actas" />
        {loading && <p>Cargando partidos…</p>}
        {loadError && <p role="alert">No se han podido cargar los partidos.</p>}
        <div className="club-admin-list">
          {matches.map((m) => (
            <button key={m.id} onClick={() => void choose(m)}>
              <span>
                <b>Manchester Piti vs {m.rival}</b>
                <small>
                  {formatDate(m.date, true)} · {m.competition}
                </small>
              </span>
              <span>
                {m.status === "scheduled"
                  ? "Programado"
                  : m.status === "cancelled"
                    ? "Cancelado"
                    : m.status === "postponed"
                      ? "Aplazado"
                      : `${m.goalsFor ?? "—"} – ${m.goalsAgainst ?? "—"}`}
                <small>Editar acta →</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  const selected = [...sheet.starters, ...sheet.bench];
  return (
    <div className="club-page club-editor">
      <button
        className="club-text-link"
        onClick={() => {
          if (!dirty || window.confirm("¿Descartar los cambios sin guardar?")) {
            setActive(null);
            setDirty(false);
          }
        }}
      >
        <ArrowLeft size={16} />
        Todos los partidos
      </button>
      <header className="club-editor-head">
        <div>
          <span className="club-kicker">ACTA DE PARTIDO</span>
          <h1>Piti vs {sheet.rival || "nuevo rival"}</h1>
        </div>
        <span>
          {dirty
            ? "Cambios sin guardar"
            : matches.some((m) => m.id === active) ||
                drafts.some((m) => m.id === active)
              ? "Guardado"
              : "Sin guardar"}{" "}
          · Hora de Madrid
        </span>
      </header>
      <div className="club-editor-steps">
        {["Encuentro", "Convocatoria", "Eventos", "Revisión"].map((t, i) => (
          <button
            className={step === i ? "active" : ""}
            onClick={() => setStep(i)}
            key={t}
          >
            <b>{i + 1}</b>
            {t}
          </button>
        ))}
      </div>
      {step === 0 && (
        <div className="club-panel">
          <h2>El encuentro</h2>
          <div className="club-form-grid">
            <label>
              Temporada
              <select
                value={sheet.seasonId}
                onChange={(e) => {
                  if (
                    sheet.events.length &&
                    !window.confirm(
                      "Cambiar la temporada vaciará la convocatoria y los eventos. ¿Continuar?",
                    )
                  )
                    return;
                  setSheet((s) => ({
                    ...s,
                    seasonId: e.target.value,
                    starters: [],
                    bench: [],
                    notCalled: [],
                    events: [],
                  }));
                  setDirty(true);
                }}
              >
                <option value="">Seleccionar temporada</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rival
              <input
                value={sheet.rival}
                onChange={(e) => update("rival", e.target.value)}
                maxLength={100}
              />
            </label>
            <label>
              Escudo del rival (URL HTTPS)
              <input
                type="url"
                value={sheet.rivalLogoUrl || ""}
                onChange={(e) => update("rivalLogoUrl", e.target.value)}
                placeholder="Opcional · si falta, se mostrarán sus iniciales"
              />
            </label>
            <label>
              Iniciales del rival
              <input
                value={sheet.rivalInitials || ""}
                maxLength={3}
                onChange={(e) =>
                  update(
                    "rivalInitials",
                    e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase(),
                  )
                }
                placeholder="Automáticas · puedes corregirlas aquí"
              />
            </label>
            <label>
              Fecha y hora (Madrid)
              <input
                type="datetime-local"
                value={Number.isFinite(sheet.date) ? dateInput(sheet.date) : ""}
                onChange={(e) => update("date", madridTime(e.target.value))}
              />
            </label>
            <label>
              Competición
              <input
                value={sheet.competition}
                onChange={(e) => update("competition", e.target.value)}
              />
            </label>
            <label>
              Campo
              <input
                value={sheet.venue}
                onChange={(e) => update("venue", e.target.value)}
                placeholder="Nombre y dirección del campo"
              />
            </label>
            <label>
              Condición
              <select
                value={sheet.home ? "home" : "away"}
                onChange={(e) => update("home", e.target.value === "home")}
              >
                <option value="home">Local</option>
                <option value="away">Visitante</option>
              </select>
            </label>
            <label>
              Duración deportiva (minutos)
              <input
                type="number"
                min={1}
                max={150}
                value={sheet.duration}
                onChange={(e) => update("duration", Number(e.target.value))}
              />
            </label>
            <label>
              Estado
              <select
                value={sheet.status}
                onChange={(e) =>
                  update("status", e.target.value as MatchSheet["status"])
                }
              >
                <option value="scheduled">Programado</option>
                <option value="finished">Finalizado</option>
                <option value="postponed">Aplazado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </label>
          </div>
          <p className="club-muted">
            La franja «JUGANDO» dura una hora desde el inicio. La duración
            deportiva determina los minutos del acta.
          </p>
          <label className="club-field">
            Aviso para el vestuario
            <textarea
              value={sheet.meetingNote || ""}
              onChange={(e) => update("meetingNote", e.target.value)}
              placeholder="Hora de quedada, camiseta, material… Solo lo verá el equipo."
              maxLength={500}
            />
          </label>
        </div>
      )}
      {step === 1 && (
        <div className="club-panel">
          <div className="club-section-title">
            <div>
              <h2>El siete y los nuestros</h2>
              <p>Los cambios se registran después, en Eventos.</p>
            </div>
            <b className="club-counter">{sheet.starters.length}/7 titulares</b>
          </div>
          <div className="club-roster-table">
            {roster.map((p) => (
              <div key={p.id}>
                <span>
                  <b>{p.number ?? "—"}</b>
                  {playerName(p)}
                </span>
                <select
                  aria-label={`Situación de ${playerName(p)}`}
                  value={
                    sheet.starters.includes(p.id)
                      ? "starters"
                      : sheet.bench.includes(p.id)
                        ? "bench"
                        : sheet.notCalled.includes(p.id)
                          ? "notCalled"
                          : ""
                  }
                  onChange={(e) => assign(p.id, e.target.value)}
                >
                  <option value="">Sin asignar</option>
                  <option value="starters">Titular</option>
                  <option value="bench">Suplente</option>
                  <option value="notCalled">No convocado</option>
                </select>
              </div>
            ))}
          </div>
          {!roster.length && (
            <p>
              Asocia jugadores a esta temporada desde la gestión de plantilla.
            </p>
          )}
          <button
            className="club-button secondary"
            onClick={() =>
              update(
                "notCalled",
                roster.filter((p) => !selected.includes(p.id)).map((p) => p.id),
              )
            }
          >
            Marcar los restantes como no convocados
          </button>
        </div>
      )}
      {step === 2 && (
        <>
          <div className="club-panel">
            <h2>
              {editingEvent ? "Editar evento" : "Lo que pasó en el campo"}
            </h2>
            <div className="club-form-grid">
              <label>
                Evento
                <select
                  value={event.type}
                  onChange={(e) =>
                    setEvent({
                      ...event,
                      type: e.target.value as MatchEvent["type"],
                    })
                  }
                >
                  {Object.entries(EVENT_LABELS)
                    .filter(([k]) => !["assist", "match_played"].includes(k))
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Minuto
                <input
                  type="number"
                  min={0}
                  max={sheet.duration}
                  value={event.minute ?? ""}
                  onChange={(e) =>
                    setEvent({
                      ...event,
                      minute:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                />
              </label>
              {!["opponent_goal", "opponent_own_goal"].includes(event.type) && (
                <label>
                  {event.type === "substitution" ? "Sale del campo" : "Jugador"}
                  <select
                    value={event.playerId || ""}
                    onChange={(e) =>
                      setEvent({ ...event, playerId: e.target.value })
                    }
                  >
                    <option value="">Seleccionar</option>
                    {selected.map((id) => (
                      <option key={id} value={id}>
                        {names[id] || id}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {event.type === "substitution" && (
                <label>
                  Entra al campo
                  <select
                    value={event.inPlayerId || ""}
                    onChange={(e) =>
                      setEvent({ ...event, inPlayerId: e.target.value })
                    }
                  >
                    <option value="">Seleccionar</option>
                    {selected
                      .filter((id) => id !== event.playerId)
                      .map((id) => (
                        <option key={id} value={id}>
                          {names[id] || id}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {["goal", "goal_penalty", "goal_freekick"].includes(
                event.type,
              ) && (
                <label>
                  Asistente
                  <select
                    value={event.assistPlayerId || ""}
                    onChange={(e) =>
                      setEvent({ ...event, assistPlayerId: e.target.value })
                    }
                  >
                    <option value="">Sin asistencia</option>
                    {selected
                      .filter((id) => id !== event.playerId)
                      .map((id) => (
                        <option key={id} value={id}>
                          {names[id] || id}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label>
                Nota opcional
                <input
                  value={event.note || ""}
                  maxLength={300}
                  onChange={(e) => setEvent({ ...event, note: e.target.value })}
                />
              </label>
            </div>
            <button className="club-button" onClick={addEvent}>
              <Plus size={16} />
              {editingEvent ? "Guardar evento" : "Añadir evento"}
            </button>
            <p className="club-muted">
              Los cambios admiten reingresos. En el mismo minuto se respeta el
              orden del acta. Registra también los goles rivales.
            </p>
          </div>
          <div className="club-panel">
            <h2>Cronología · {sheet.events.length} eventos</h2>
            <div className="club-event-list">
              {[...sheet.events]
                .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
                .map((e) => (
                  <div key={e.id}>
                    <b>{e.minute ?? "?"}′</b>
                    <span>
                      <strong>{EVENT_LABELS[e.type] || e.type}</strong>
                      {names[e.playerId || ""] || ""}
                      {e.inPlayerId && ` → ${names[e.inPlayerId]}`}
                      {e.assistPlayerId &&
                        ` · Asiste ${names[e.assistPlayerId]}`}
                      {e.note && <small>{e.note}</small>}
                    </span>
                    <button
                      aria-label={`Editar ${EVENT_LABELS[e.type]} minuto ${e.minute}`}
                      onClick={() => {
                        setEvent(e);
                        setEditingEvent(e.id);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      aria-label={`Eliminar evento minuto ${e.minute}`}
                      onClick={() =>
                        update(
                          "events",
                          sheet.events.filter((x) => x.id !== e.id),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
            </div>
            {!sheet.events.length && (
              <p>Todavía no hay eventos. Añade el primero.</p>
            )}
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <div className="club-panel">
            <h2>Antes de publicar</h2>
            <p>
              <b>Manchester Piti vs {sheet.rival || "Rival pendiente"}</b>
              <br />
              {formatDate(sheet.date, true)} · Hora de Madrid
              <br />
              {sheet.venue || "Campo pendiente"} · {sheet.competition}
            </p>
            {sheet.status === "finished" ? (
              <>
                <div className="club-form-grid">
                  <label>
                    Goles del Piti
                    <input
                      type="number"
                      min={0}
                      value={sheet.goalsFor ?? 0}
                      onChange={(e) =>
                        update("goalsFor", Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    Goles del rival
                    <input
                      type="number"
                      min={0}
                      value={sheet.goalsAgainst ?? 0}
                      onChange={(e) =>
                        update("goalsAgainst", Number(e.target.value))
                      }
                    />
                  </label>
                </div>
                <p>
                  Según los eventos:{" "}
                  <b>
                    {ledger.goalsFor} – {ledger.goalsAgainst}
                  </b>
                  . Para finalizar, ambos marcadores deben coincidir.
                </p>
              </>
            ) : (
              <p>
                Se publicará sin marcador. El contador se actualizará
                automáticamente según la fecha y el estado del encuentro.
              </p>
            )}
            <label className="club-field">
              Crónica
              <textarea
                rows={5}
                value={sheet.report}
                onChange={(e) => update("report", e.target.value)}
                placeholder="Cuenta cómo se vivió el encuentro…"
              />
            </label>
            <button
              className="club-text-link"
              onClick={() =>
                update(
                  "report",
                  `Manchester Piti ${sheet.goalsFor ?? 0}–${sheet.goalsAgainst ?? 0} ${sheet.rival}. ${sheet.competition}, ${formatDate(sheet.date)}. ${sheet.events
                    .filter((e) =>
                      ["goal", "goal_penalty", "goal_freekick"].includes(
                        e.type,
                      ),
                    )
                    .map(
                      (e) =>
                        `${names[e.playerId || ""] || "Gol"} (${e.minute}′)`,
                    )
                    .join(", ")}.`,
                )
              }
            >
              Preparar resumen con los datos del acta
            </button>
            <label className="club-field">
              Foto del partido (URL HTTPS)
              <input
                type="url"
                value={sheet.photoUrl || ""}
                onChange={(e) => update("photoUrl", e.target.value)}
              />
            </label>
            <label className="club-field">
              Galería (una URL HTTPS por línea)
              <textarea
                value={(sheet.gallery ?? []).join("\n")}
                onChange={(e) =>
                  update("gallery", e.target.value.split("\n").filter(Boolean))
                }
              />
            </label>
          </div>
          <div className="club-panel">
            <h2>Minutos y participación</h2>
            <div className="club-table-scroll">
              <table className="club-table">
                <thead>
                  <tr>
                    <th>Jugador</th>
                    <th>Inicial</th>
                    <th>Minutos</th>
                    <th>Entradas</th>
                    <th>Salidas</th>
                    <th>Tramos</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(ledger.players).map(([id, p]) => (
                    <tr key={id}>
                      <td>{names[id]}</td>
                      <td>
                        {p.started
                          ? "Titular"
                          : p.benched
                            ? "Suplente"
                            : "No convocado"}
                      </td>
                      <td>{p.minutes}′</td>
                      <td>{p.subIn}</td>
                      <td>{p.subOut}</td>
                      <td>
                        {p.stints
                          .map((s) => `${s.from}–${s.to}′`)
                          .join(" · ") || "—"}
                        {p.dismissed ? " · Expulsado" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="club-muted">
              La previsualización supone el acta completa. Las estadísticas se
              incorporan al publicar como finalizado.
            </p>
          </div>
        </>
      )}
      {ledger.errors.length > 0 && (
        <div className="club-validation">
          <b>Por revisar en el acta</b>
          <ul>
            {ledger.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p className="club-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="club-success" role="status">
          <CheckCircle2 size={18} />
          {message}
        </p>
      )}
      <div className="club-save-bar">
        <button
          className="club-button secondary"
          disabled={busy}
          onClick={() => void save(true)}
        >
          <Save size={16} />
          Guardar borrador
        </button>
        {step < 3 ? (
          <button className="club-button" onClick={() => setStep(step + 1)}>
            Continuar <ArrowRightLeft size={16} />
          </button>
        ) : (
          <button
            className="club-button"
            disabled={busy}
            onClick={() => void save(false)}
          >
            <Send size={16} />
            {busy
              ? "Guardando…"
              : sheet.status === "finished"
                ? "Publicar acta"
                : "Publicar encuentro"}
          </button>
        )}
        <button
          className="club-text-link"
          onClick={() =>
            void downloadMatchPoster({ ...sheet, id: active }, "square")
          }
        >
          Descargar cartel
        </button>
      </div>
    </div>
  );
}
