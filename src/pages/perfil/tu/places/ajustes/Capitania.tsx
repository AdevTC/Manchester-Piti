// Ajustes › Capitanía (TuCarta ajCapitania; captains only): who knocks at La puerta (the printed shirt of the
// ficha he asks for, else his initials) with «Abrir La puerta», the door's notice on this device as a toggle that
// follows the device live (bug 15: it reads la bandeja's topics, not a value read once) and «Ir a la Sala de
// control» — the club's admin lives there now, not as seven links here.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { pushSaveError, toggleTopic } from "../../../../../lib/push";
import { TuIcon } from "../../../../../components/vidrio/tu/ui";
import type { ThisDevice } from "../../../bandeja/device";
import { Shirt } from "../../TuCard";
import { doorLine, doorToggle, knockRows } from "../ajustesView";
import type { PlaceProps } from "../types";
import { Tog } from "./Tog";

export function Capitania(p: PlaceProps & { d: ThisDevice }) {
  const { data, d, say } = p;
  const navigate = useNavigate();
  const reqs = data.captain?.doorRequests ?? [];
  const rows = knockRows(reqs, data.shirt.squad, p.now);
  const on = d.ready && p.pending.inbox.topics.includes("door");
  const [busy, setBusy] = useState(false);
  const flip = () => {
    if (!d.ready) {
      say("Primero, este móvil tiene que estar listo.");
      p.go({ page: "perfil", sec: "ajustes", aj: "avisos", open: null });
      return;
    }
    if (busy) return;
    setBusy(true);
    toggleTopic("door", !on)
      .then(
        () => say(on ? "Aviso de la puerta desactivado en este móvil." : "Aviso de la puerta activado en este móvil."),
        (e: unknown) => say(pushSaveError(e)),
      )
      .finally(() => setBusy(false));
  };
  const puerta = () => void navigate({ to: "/vestuario/puerta" });
  return (
    <>
      <section className="tc-ajrow" aria-labelledby="tc-cap-door">
        <h3 id="tc-cap-door">La puerta</h3>
        <p>{doorLine(rows.length)}</p>
        {rows.length > 0 && (
          <ul className="tk-list tc-knock" aria-label="Peticiones para entrar">
            {rows.map((k) => (
              <li key={k.key} className="tk-row">
                {k.num ? (
                  <Shirt num={k.num} className="tc-knock__img" />
                ) : (
                  <span className="tc-ini" aria-hidden="true">
                    {k.ini}
                  </span>
                )}
                <span className="tk-row__t">
                  <b>{k.name}</b>
                  <span>{k.line}</span>
                </span>
                <span className="nx-meta">{k.at}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="tk-acts">
          <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={puerta}>
            <TuIcon name="door" className="nx-ic" />
            Abrir La puerta
          </button>
        </div>
      </section>
      <section className="tc-ajrow" aria-labelledby="tc-cap-av">
        <h3 id="tc-cap-av">Aviso de la puerta</h3>
        <Tog id="tc-cap-door-tog" on={on} dis={busy} onFlip={flip}>
          {doorToggle(on, d.ready)}
        </Tog>
        <p>«Alguien llama a la puerta» en este móvil, en cuanto alguien pide entrar. Los demás temas, en Ajustes › Avisos.</p>
      </section>
      <section className="tc-ajrow" aria-labelledby="tc-cap-sala">
        <h3 id="tc-cap-sala">Lo demás del club</h3>
        <p>Partidos, convocatoria, plantilla, socios y caja se llevan desde la sala de control, no desde tu página.</p>
        <div className="tk-acts">
          <button type="button" className="vd-glass vd-press nx-btn" onClick={() => void navigate({ to: "/admin" })}>
            <TuIcon name="flag" className="nx-ic" />
            Ir a la Sala de control
          </button>
        </div>
      </section>
    </>
  );
}
