// /profile › Tu carta › «Tus posiciones» (vinculada only): the player marks where he plays on the map
// and sends it to the captain, who approves, adjusts or rejects it from the admin ficha. The map starts
// from the pending proposal, else what the ficha says; the status line follows the ficha live.
import { useRef, useState } from "react";
import { MapaPosiciones } from "../../components/posiciones/MapaPosiciones";
import { summaryText } from "../../components/posiciones/mapaNav";
import type { PositionSet } from "../../lib/positions";
import type { ProposalState } from "../../lib/positionsEdit";
import { buzz, isOffline, OFFLINE } from "./fxRuntime";
import { Ic } from "./icons";
import { canSendPositions, type PositionsInfo } from "./profileData";

export interface PosicionesField {
  info: PositionsInfo;
  /** Writes the proposal (a set) or withdraws it (null). */
  save: (set: PositionSet | null) => Promise<void>;
  /** The page's toast. */
  say: (msg: string, bad?: boolean) => void;
}

const STATUS: Record<Exclude<ProposalState, "ninguna">, { tone: "ok" | "warn" | "bad"; icon: "check" | "clock" | "alert"; text: string }> = {
  pendiente: { tone: "warn", icon: "clock", text: "Pendiente de que el capitán la vea" },
  aprobada: { tone: "ok", icon: "check", text: "Aprobadas por el capitán" },
  ajustada: { tone: "ok", icon: "check", text: "El capitán la ajustó" },
  rechazada: { tone: "bad", icon: "alert", text: "El capitán no la aceptó: siguen las de antes" },
};
const FAILED = "No se ha podido enviar al capitán. Vuelve a intentarlo.";
const isEmpty = (s: PositionSet) => !s.main && !s.also.length;

function Status({ info }: { info: PositionsInfo }) {
  if (info.state === "ninguna")
    return (
      <p className="note" role="status">
        <Ic n="info" w={18} />
        <span>
          {isEmpty(info.approved) ? (
            <>
              <b>Aún no has dicho dónde juegas.</b> Márcalo en el campo y envíaselo al capitán.
            </>
          ) : (
            <>
              <b>Las de tu ficha.</b> Las puso el capitán; si no son, propón las tuyas.
            </>
          )}
        </span>
      </p>
    );
  const s = STATUS[info.state];
  return (
    <p className={"note " + s.tone} role="status">
      <Ic n={s.icon} w={18} />
      <span>
        <b>{s.text}</b>
        {info.state === "pendiente" && !isEmpty(info.approved) && <span className="ps-now">Ahora en tu ficha: {summaryText(info.approved)}</span>}
      </span>
    </p>
  );
}

export function Posiciones({ f }: { f: PosicionesField }) {
  const { info } = f;
  const [draft, setDraft] = useState<PositionSet | null>(null);
  const [busy, setBusy] = useState<"send" | "withdraw" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  const value = draft ?? info.proposal ?? info.approved;
  const pending = info.state === "pendiente";
  const canSend = canSendPositions(value, info) && !busy;

  const write = async (set: PositionSet | null) => {
    if (sending.current) return;
    if (isOffline()) {
      setError(OFFLINE);
      return;
    }
    sending.current = true;
    setBusy(set ? "send" : "withdraw");
    setError(null);
    try {
      await f.save(set);
      // the map follows the ficha again (the proposal just sent, or what it says without one)
      setDraft(null);
      buzz(set ? [15, 30, 15] : 15);
      f.say(set ? "Propuesta enviada al capitán" : "Propuesta retirada");
    } catch {
      setError(FAILED);
    } finally {
      sending.current = false;
      setBusy(null);
    }
  };

  return (
    <div className="bk" id="pe-posiciones">
      <h3 className="bk-h">Tus posiciones</h3>
      <p className="bk-d">Dónde juegas. El capitán lo confirma.</p>
      <Status info={info} />
      <div className="ps-pitch">
        <MapaPosiciones
          value={value}
          onChange={(next) => {
            setDraft(next);
            setError(null);
          }}
          onRefuse={(msg) => f.say(msg, true)}
          size="m"
          label="Tus posiciones: toca una para marcarla"
          emptyText="Nada marcado todavía"
        />
      </div>
      <p className="fi-foot">Un toque: también juegas ahí (✓). Dos: tu preferida (★). Tres: se quita.</p>
      {error && (
        <p className="note bad" role="alert">
          <Ic n="alert" />
          <span>{error}</span>
        </p>
      )}
      <div className={pending ? "fi-act" : "ps-act"}>
        <button type="button" className="btn gold" disabled={!canSend} aria-busy={busy === "send" || undefined} onClick={() => void write(value)}>
          <Ic n="arrow" w={16} />
          {busy === "send" ? "Enviando…" : "Enviar al capitán"}
        </button>
        {pending && (
          <button type="button" className="btn" disabled={!!busy} aria-busy={busy === "withdraw" || undefined} onClick={() => void write(null)}>
            <Ic n="x" />
            {busy === "withdraw" ? "Retirando…" : "Retirar propuesta"}
          </button>
        )}
      </div>
    </div>
  );
}
