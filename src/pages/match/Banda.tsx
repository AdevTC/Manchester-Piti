// Modo banda: the admin writes the acta live from the touchline — big buttons, the minute from the
// clock, the players on the pitch one tap away. Each tap goes to the liveEvent callable; every visitor
// sees the score move (and the ¡GOL!) through the match's realtime listener.
import { useState } from "react";
import type { ClubMatch } from "../../lib/clubData";
import { liveEvent, apiError } from "../../lib/clubApi";
import { onPitch } from "../../lib/ficha";
import { useClock } from "../../hooks/useClock";
import { liveMinute } from "../../lib/partidos";
import { Icon } from "../../components/celeste/icons";

type Action = "goal" | "opponent_goal" | "yellow_card" | "red_card" | "substitution" | "penalty_saved" | "woodwork" | "penalty_missed";
const ACTIONS: { type: Action; label: string; ours: boolean }[] = [
  { type: "goal", label: "Gol del Piti", ours: true },
  { type: "opponent_goal", label: "Gol rival", ours: false },
  { type: "yellow_card", label: "Amarilla", ours: true },
  { type: "red_card", label: "Roja", ours: true },
  { type: "substitution", label: "Cambio", ours: true },
  { type: "penalty_saved", label: "Penalti parado", ours: true },
  { type: "woodwork", label: "Al palo", ours: true },
  { type: "penalty_missed", label: "Penalti fallado", ours: true },
];

export function Banda({ match, nameOf }: { match: ClubMatch; nameOf: (id: string) => string }) {
  const now = useClock(15_000);
  const clock = liveMinute(match, now) ?? 0;
  const [minute, setMinute] = useState<number | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [player, setPlayer] = useState<string | null>(null);
  const [second, setSecond] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const shown = minute ?? clock;
  const pitch = onPitch(match.starters, match.events);
  const bench = [...(match.starters ?? []), ...(match.bench ?? [])].filter((id) => !pitch.includes(id));
  const needsPlayer = action && action !== "opponent_goal";
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
    void send({ action: "add", matchId: match.id, event }, `${ACTIONS.find((a) => a.type === action)?.label} apuntado en el ${shown}′.`);
  };
  const ready = action && (!needsPlayer || player) && (action !== "substitution" || second);

  return (
    <section className="fc-sec fc-banda" aria-labelledby="fc-banda">
      <span className="hm-kick">Solo administradores · lo ve todo el mundo al momento</span>
      <h2 className="hm-h2" id="fc-banda">
        Modo banda
      </h2>
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
          <button key={a.type} type="button" className={a.type === "goal" ? "gold" : a.ours ? "" : "them"} aria-pressed={action === a.type} onClick={() => (setAction(a.type), setPlayer(null), setSecond(null))}>
            {a.label}
          </button>
        ))}
      </div>
      {needsPlayer && (
        <>
          <span className="hm-kick">{action === "substitution" ? "Sale" : action === "penalty_saved" ? "¿Quién lo paró?" : "¿Quién?"}</span>
          <div className="fc-pick">
            {pitch.map((id) => (
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
        <button type="button" className="hm-btn" disabled={!ready || busy} onClick={submit}>
          {busy ? "Apuntando…" : "Apuntar"} <Icon name="check" size={16} stroke={2.4} />
        </button>
        <button type="button" className="hm-ghostbtn" disabled={busy} onClick={() => void send({ action: "undo", matchId: match.id }, "Deshecho lo último apuntado.")}>
          <Icon name="turn" size={16} /> Deshacer lo último
        </button>
      </div>
      {msg && (
        <p className="fc-status" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
