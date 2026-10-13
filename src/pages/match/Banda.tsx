import { MatchClockControl } from "../../components/celeste/MatchClockControl";
import { clockReading } from "../../../functions/src/matchClock";
// Mesa de partido: the admin writes the acta live from the touchline — big buttons, the minute from the
// clock, the players on the pitch one tap away. Each tap goes to the liveEvent callable; every visitor
// sees the score move (and the ¡GOL!) through the match's realtime listener.
import { useState } from "react";
import type { ClubMatch } from "../../lib/clubData";
import { liveEvent, apiError } from "../../lib/clubApi";
import { liveSides } from "../admin/live/liveModel";
import { useClock } from "../../hooks/useClock";
import { liveMinute } from "../../lib/partidos";
import { Icon } from "../../components/celeste/icons";

type Action = "goal" | "opponent_goal" | "yellow_card" | "double_yellow" | "red_card" | "substitution" | "penalty_saved" | "woodwork" | "penalty_missed" | "chance" | "opponent_chance" | "corner" | "opponent_corner";
const ACTIONS: { type: Action; label: string; ours: boolean }[] = [
  { type: "goal", label: "Gol del Piti", ours: true },
  { type: "opponent_goal", label: "Gol rival", ours: false },
  { type: "yellow_card", label: "Amarilla", ours: true },
  { type: "double_yellow", label: "Segunda amarilla", ours: true },
  { type: "red_card", label: "Roja", ours: true },
  { type: "substitution", label: "Cambio", ours: true },
  { type: "penalty_saved", label: "Penalti parado", ours: true },
  { type: "woodwork", label: "Al palo", ours: true },
  { type: "penalty_missed", label: "Penalti fallado", ours: true },
  { type: "chance", label: "Ocasión del Piti", ours: true },
  { type: "opponent_chance", label: "Ocasión rival", ours: false },
  { type: "corner", label: "Córner del Piti", ours: true },
  { type: "opponent_corner", label: "Córner rival", ours: false },
];

export function Banda({ match, nameOf }: { match: ClubMatch; nameOf: (id: string) => string }) {
  const now = useClock(1000);
  const playing = clockReading(match.clock, now).playing;
  const clock = liveMinute(match, now) ?? 0;
  const [minute, setMinute] = useState<number | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [player, setPlayer] = useState<string | null>(null);
  const [second, setSecond] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const shown = minute ?? clock;
  const { field: pitch, bench } = liveSides(match.starters, match.bench, match.events);
  const optionalPlayer = action === "chance" || action === "corner";
  const needsPlayer = action && !action.startsWith("opponent_");
  const options = action && /card|yellow/.test(action) ? [...pitch, ...bench] : pitch;
  const secondList = action === "goal" ? pitch.filter((id) => id !== player) : action === "substitution" ? bench : [];

  const reset = () => {
    setAction(null);
    setPlayer(null);
    setSecond(null);
    setMinute(null);
  };
  const send = async (payload: Parameters<typeof liveEvent>[0], done: string) => {
    setBusy(true);
    setMsg("");
    try {
      await liveEvent(payload);
      setMsg(done);
      reset();
    } catch (e) {
      setMsg(apiError(e));
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    if (!action) return;
    const event: { type: string; minute: number; playerId?: string; assistPlayerId?: string; inPlayerId?: string } = { type: action, minute: shown };
    if (needsPlayer) event.playerId = player ?? undefined;
    if (action === "goal" && second) event.assistPlayerId = second;
    if (action === "substitution") event.inPlayerId = second ?? undefined;
    void send({ action: "add", matchId: match.id, requestId: crypto.randomUUID(), clockRevision: match.clock?.revision, manualTime: minute != null, event }, `${ACTIONS.find((a) => a.type === action)?.label} apuntado en el ${shown}′.`);
  };
  const ready = action && (!needsPlayer || optionalPlayer || player) && (action !== "substitution" || second);

  return (
    <section className="fc-sec fc-banda" aria-labelledby="fc-banda">
      <span className="hm-kick">Administradores y anotadores designados · sincronizado para todos</span>
      <h2 className="hm-h2" id="fc-banda">
        Mesa de partido
      </h2>
      <MatchClockControl match={match} />
      <fieldset disabled={(!playing && match.clock?.phase !== "halftime") || busy} style={{ border: 0, padding: 0, margin: 0 }}>
      <div className="fc-banda-min">
        <button type="button" aria-label="Un minuto menos" onClick={() => setMinute(Math.max(0, shown - 1))}>
          −
        </button>
        <output aria-live="polite">{shown}′</output>
        <button type="button" aria-label="Un minuto más" onClick={() => setMinute(shown + 1)}>
          +
        </button>
        {minute != null && (
          <button type="button" className="now" onClick={() => setMinute(null)}>
            Ahora ({clock}′)
          </button>
        )}
      </div>
      <div className="fc-banda-acts" role="group" aria-label="Qué ha pasado">
        {ACTIONS.map((a) => (
          <button key={a.type} type="button" className={a.type === "goal" ? "gold" : a.ours ? "" : "them"} disabled={!playing && !["substitution", "yellow_card", "double_yellow", "red_card"].includes(a.type)} aria-pressed={action === a.type} onClick={() => (setAction(a.type), setPlayer(null), setSecond(null))}>
            {a.label}
          </button>
        ))}
      </div>
      {needsPlayer && (
        <>
          <span className="hm-kick">{action === "substitution" ? "Sale" : action === "penalty_saved" ? "¿Quién lo paró?" : "¿Quién?"}</span>
          <div className="fc-pick">
            {optionalPlayer && <button type="button" aria-pressed={!player} onClick={() => setPlayer(null)}>Equipo · sin jugador</button>}
            {options.map((id) => (
              <button key={id} type="button" aria-pressed={player === id} onClick={() => setPlayer(id)}>
                {nameOf(id)}
              </button>
            ))}
          </div>
        </>
      )}
      {action && secondList.length > 0 && (action !== "goal" || player) && (
        <>
          <span className="hm-kick">{action === "goal" ? "Asistencia (opcional)" : "Entra"}</span>
          <div className="fc-pick">
            {secondList.map((id) => (
              <button key={id} type="button" aria-pressed={second === id} onClick={() => setSecond(second === id ? null : id)}>
                {nameOf(id)}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="fc-acts" style={{ marginTop: 18 }}>
        <button type="button" className="hm-btn" disabled={!ready || busy || (!playing && !["substitution", "yellow_card", "double_yellow", "red_card"].includes(action ?? ""))} onClick={submit}>
          {busy ? "Apuntando…" : "Apuntar"} <Icon name="check" size={16} stroke={2.4} />
        </button>
        <button type="button" className="hm-ghostbtn" disabled={busy} onClick={() => void send({ action: "undo", matchId: match.id, eventId: match.events?.filter(e => e.id.startsWith("live-")).at(-1)?.id }, "Deshecho lo último apuntado.")}>
          <Icon name="turn" size={16} /> Deshacer lo último
        </button>
      </div>
      </fieldset>
      {msg && (
        <p className="fc-status" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
