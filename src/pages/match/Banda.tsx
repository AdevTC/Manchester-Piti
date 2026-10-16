import { QuickMatchEntry } from "../../components/celeste/QuickMatchEntry";
import { MatchClockControl } from "../../components/celeste/MatchClockControl";
import { clockReading } from "../../../functions/src/matchClock";
// Mesa de partido: the admin writes the acta live from the touchline — big buttons, the minute from the
// clock, the players on the pitch one tap away. Each tap goes to the liveEvent callable; every visitor
// sees the score move (and the ¡GOL!) through the match's realtime listener.
import { useRef, useState } from "react";
import type { ClubMatch } from "../../lib/clubData";
import { liveEvent, apiError } from "../../lib/clubApi";
import { liveSides } from "../admin/live/liveModel";
import { useClock } from "../../hooks/useClock";
import { liveMinute, shownOffset } from "../../lib/partidos";
import { Icon } from "../../components/celeste/icons";
import { LIVE_ACTIONS, buildLiveEvent, guestsLast, liveAction, liveReady, type LiveActionType } from "../../lib/liveActions";
import { isGuestId } from "../../lib/derived/guests";

export function Banda({ match, nameOf }: { match: ClubMatch; nameOf: (id: string) => string }) {
  const [quick,setQuick] = useState(true);
  const sending = useRef(false);
  const [retry, setRetry] = useState<{payload: NonNullable<Parameters<typeof liveEvent>[0]>; label: string} | null>(null);
  const [ownId,setOwnId] = useState<string | null>(null);
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
  // (the guests after the members: liveSides orders each side, and the convocatoria as a whole here)
  const options = act?.pool === "squad" ? guestsLast([...pitch, ...bench]) : pitch;
  const secondList = act?.second === "assist" ? pitch.filter((id) => id !== player) : act?.second === "in" ? bench : [];

  const reset = () => {
    setAction(null);
    setPlayer(null);
    setSecond(null);
    setLater(false);
    setMinute(null);
  };
  const send = async (payload: NonNullable<Parameters<typeof liveEvent>[0]>, done: string) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setMsg("");
    try {
      setRetry({payload,label:done});
      await liveEvent(payload);
      setOwnId(payload.action === "add" ? `live-${payload.requestId}` : null);
      setRetry(null);
      setMsg(done);
      reset();
    } catch (e) {
      setMsg(apiError(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const submit = () => {
    if (!act) return;
    const event = buildLiveEvent(act, { playerId: player, assistPlayerId: second, inPlayerId: second }, shown);
    if (act.type === "goal") event.assistReviewed = !!player;
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
      <div className="qm-mode" role="group" aria-label="Modo de anotación"><button type="button" aria-pressed={quick} onClick={()=>setQuick(true)}>Banquillo rápido</button><button type="button" aria-pressed={!quick} onClick={()=>setQuick(false)}>Con detalle</button></div>
      <div hidden={!quick}><QuickMatchEntry key={match.id} match={match} nameOf={nameOf}/></div>
      <div hidden={quick}>
      <fieldset disabled={(!playing && match.clock?.phase !== "halftime") || busy || !!retry} style={{ border: 0, padding: 0, margin: 0 }}>
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
              <button key={id} type="button" className={isGuestId(id) ? "guest" : undefined} aria-pressed={player === id} onClick={() => pickPlayer(id)}>
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
              <button key={id} type="button" className={isGuestId(id) ? "guest" : undefined} aria-pressed={second === id} onClick={() => setSecond(second === id ? null : id)}>
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
        <button type="button" className="hm-ghostbtn" disabled={busy || !ownId || !match.events?.some(e=>e.id===ownId)} onClick={() => void send({ action: "undo", matchId: match.id, eventId: ownId ?? undefined }, "Deshecho lo último apuntado.")}>
          <Icon name="turn" size={16} /> Deshacer mi última jugada
        </button>
      </div>
      </fieldset>
      {retry && !busy && <div className="fc-acts"><button type="button" className="hm-btn" onClick={()=>void send(retry.payload,retry.label)}>Reintentar la misma jugada</button><button type="button" className="hm-ghostbtn" onClick={()=>{setRetry(null);reset();setMsg("Revisa las jugadas sincronizadas antes de volver a anotarla.");}}>Revisar la jugada antes de continuar</button></div>}
      {msg && (
        <p className="fc-status" role="status">
          {msg}
        </p>
      )}
      </div>
    </section>
  );
}
