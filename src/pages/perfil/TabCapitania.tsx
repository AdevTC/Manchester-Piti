// /profile › Capitanía (captains only): La puerta — the LED count of who is knocking and their requests,
// each one taking you to the vestuario's La puerta where you open or say no (same actions, same undo) —,
// Administrar el club, and Aviso de la puerta (this device's «Alguien llama a la puerta» + «Cambiarlo en
// Avisos»). As designed (pf-g.mjs pCap).
import { Link } from "@tanstack/react-router";
import type { DoorRequestRow } from "../vestuario/live";
import { Ic } from "./icons";
import { agoText, doorLead } from "./panels";
import type { SquadShirt } from "./rules";
import { usePushDevice } from "./usePushDevice";

const SHOWN = 5;

export interface CapitaniaProps {
  requests: DoorRequestRow[];
  squad: SquadShirt[];
  now: number;
  /** Switches to Avisos and puts the focus on the door's switch. */
  onGoAvisos: () => void;
}

export function TabCapitania({ requests, squad, now, onGoAvisos }: CapitaniaProps) {
  const dev = usePushDevice();
  const doorOn = dev.state === "ready" && dev.topics.includes("door");
  const queue = [...requests].sort((a, b) => a.at - b.at);
  const n = queue.length;
  const byId = new Map(squad.map((s) => [s.id, s]));
  return (
    <>
      <div className="bk">
        <h3 className="bk-h">La puerta</h3>
        <p className="bk-d">Quién pide entrar al vestuario. Solo lo ven los capitanes.</p>
        <Link className="door" to="/vestuario" hash="puerta">
          <span className="door-led" role="img" aria-label={n === 1 ? "1 persona llamando" : `${n} personas llamando`}>
            <b>{n}</b>
            <small>LLAMANDO</small>
          </span>
          <span className="door-t">
            <b>Abrir La puerta</b>
            <small>{doorLead(n)}</small>
          </span>
        </Link>
        {n > 0 && (
          <ul className="rq" aria-label="Peticiones para entrar">
            {queue.slice(0, SHOWN).map((r) => {
              const p = r.playerId ? byId.get(r.playerId) : undefined;
              const num = p?.number != null && p.number !== "" ? String(p.number) : "";
              const who = r.name || r.googleName || r.email || "Sin nombre";
              const asks = r.playerId ? (num ? `Pide la carta del ${num}` : `Pide la carta de ${p?.name ?? r.playerName ?? "su ficha"}`) : "Sin dorsal todavía";
              return (
                <li key={r.uid} className="go">
                  <Link to="/vestuario" hash="puerta">
                    <span className="n" aria-hidden="true">
                      {num || "?"}
                    </span>
                    <span>
                      <b>{who}</b>
                      <small>{[asks, agoText(r.at, now)].filter(Boolean).join(" · ")}</small>
                    </span>
                    <Ic n="right" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {n > SHOWN && <p className="bk-d">Y {n - SHOWN} más en La puerta.</p>}
      </div>
      <div className="bk">
        <h3 className="bk-h">Administrar el club</h3>
        <p className="bk-d">Partidos, plantilla, contenido y temporadas.</p>
        <ul className="lks">
          <li>
            <Link className="lk" to="/admin">
              <span className="lk-ic">
                <Ic n="gear" />
              </span>
              <span className="lk-t">
                <b>Administrar el club</b>
                <small>Partidos, plantilla, contenido y temporadas</small>
              </span>
              <Ic n="right" />
            </Link>
          </li>
        </ul>
      </div>
      <div className="bk">
        <h3 className="bk-h">Aviso de la puerta</h3>
        <p className="bk-d">
          «Alguien llama a la puerta» en este móvil: <b>{doorOn ? "activado" : "desactivado"}</b>.
        </p>
        <button type="button" className="btn" onClick={onGoAvisos}>
          <Ic n="bell" w={17} />
          Cambiarlo en Avisos
        </button>
      </div>
    </>
  );
}
