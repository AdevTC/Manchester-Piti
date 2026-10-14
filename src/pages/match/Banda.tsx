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
import { liveMinute, shownOffset } from "../../lib/partidos";
import { Icon } from "../../components/celeste/icons";
import { LIVE_ACTIONS, buildLiveEvent, liveAction, liveReady, type LiveActionType } from "../../lib/liveActions";

export function Banda({ match, nameOf }: { match: ClubMatch; nameOf: (id: string) => string }) {
  const now = useClock(1000);
  const playing = clockReading(match.clock, now).playing;
  const clock = liveMinute(match, now) ?? 0;
  const [minute, setMinute] = useState<number | null>(null);
  const [action, setAction] = useState<LiveActionType | null>(null);
  const [player, setPlayer] = useState<string | null>(null);
  const [second, setSecond] = useState<string | null>(null);
  // «Lo completo luego»: a goal written without its scorer (the acta asks «¿Quién marcó?» afterwards)
  const [later, setLater] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const shown = minute ?? clock;
  // (the stepper counts as the events are stamped; people read football's minute: +1 on a clock)
  const off = shownOffset(match);
  const { field: pitch, bench } = liveSides(match.starters, match.bench, match.events);
  const act = action ? liveAction(action) : null;
  const needsPlayer = !!act && act.player !== "none";
  const options = act?.pool === "squad" ? [...pitch, ...bench] : pitch;
  const secondList = act?.second === "assist" ? pitch.filter((id) => id !== player) : act?.second === "in" ? bench : [];

  const reset = () => {
    setAction(null);
    setPlayer(null);
    setSecond(null);
    setLater(false);
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
    if (!act) return;
    const event = buildLiveEvent(act, { playerId: player, assistPlayerId: second, inPlayerId: second }, shown);
    const missing = act.player === "later" && !event.playerId ? " Falta el goleador: complétalo en el acta." : "";
    void send({ action: "add", matchId: match.id, requestId: crypto.randomUUID(), clockRevision: match.clock?.revision, manualTime: minute != null, event }, `${act.label} apuntado en el ${shown + off}′.${missing}`);
  };
  const ready = !!act && liveReady(act, { playerId: player, inPlayerId: second, later });
  const pickPlayer = (id: string | null) => {
    setPlayer(id);
    setLater(false);
    // (no assist without a scorer, and never the scorer himself)
    if (id === null || id === second) setSecond(null);
  };

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
        <output aria-live="polite">{shown + off}′</output>
        <button type="button" aria-label="Un minuto más" onClick={() => setMinute(shown + 1)}>
          +
        </button>
        {minute != null && (
          <button type="button" className="now" onClick={() => setMinute(null)}>
            Ahora ({clock + off}′)
          </button>
        )}
      </div>
      <div className="fc-banda-acts" role="group" aria-label="Qué ha pasado">
        {LIVE_ACTIONS.map((a) => (
          <button key={a.type} type="button" className={a.type === "goal" ? "gold" : a.side === "them" ? "them" : ""} disabled={!playing && !a.atBreak} aria-pressed={action === a.type} onClick={() => (setAction(a.type), setPlayer(null), setSecond(null), setLater(false))}>
            {a.icon && <Icon name={a.icon} size={18} />}
            {a.label}
          </button>
        ))}
      </div>
      {act && needsPlayer && (
        <>
          <span className="hm-kick">{act.ask}</span>
          <div className="fc-pick">
            {act.player === "optional" && <button type="button" aria-pressed={!player} onClick={() => pickPlayer(null)}>Equipo · sin jugador</button>}
            {act.player === "later" && (
              <button type="button" aria-pressed={later} onClick={() => (pickPlayer(null), setLater(true))}>
                Lo completo luego · sin goleador
              </button>
            )}
            {options.map((id) => (
              <button key={id} type="button" aria-pressed={player === id} onClick={() => pickPlayer(id)}>
                {nameOf(id)}
              </button>
            ))}
          </div>
        </>
      )}
      {act && secondList.length > 0 && (act.second !== "assist" || player) && (
        <>
          <span className="hm-kick">{act.second === "assist" ? `${act.askSecond} (opcional)` : act.askSecond}</span>
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
        <button type="button" className="hm-btn" disabled={!ready || busy || (!playing && !act?.atBreak)} onClick={submit}>
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
