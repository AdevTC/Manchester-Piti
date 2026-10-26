// /perfil/capitania (TU boards isCapitania, captains): La puerta with who knocks (the shirt of the ficha he asks
// for, else his initials), «Abrir La puerta» as the screen's action, «Administrar el club» (straight into the admin's
// sections) and whether this device rings when someone knocks (changed in Avisos a medida, its switch focused).
import { useNavigate } from "@tanstack/react-router";
import { pushState, savedTopics } from "../../../../lib/push";
import { TuIcon, type TuIconName } from "../../../../components/vidrio/tu/ui";
import type { SectionKey } from "../../../admin/shell/nav";
import { ago } from "../../lines";
import { adminLinks, doorLead, initials, secDesc } from "../model";
import type { ScreenProps } from "../MiPagina";
import { Shirt } from "../TuCard";
import { Screen } from "./Head";

const ADMIN_ICON: Record<SectionKey, TuIconName> = {
  hoy: "shield",
  partidos: "fixtures",
  convocar: "shirt",
  plantilla: "user",
  fichas: "cardi",
  caja: "euro",
  temporadas: "flag",
  contenido: "post",
  capitanes: "shield",
  clasificacion: "chart",
  turnos: "swap",
};

export function Capitania(p: ScreenProps) {
  const { data, who } = p;
  const navigate = useNavigate();
  const reqs = data.captain?.doorRequests ?? [];
  const doorOn = pushState() === "ready" && savedTopics().includes("door");
  const numOf = (playerId: string | null) => (playerId ? String(data.shirt.squad.find((s) => s.id === playerId)?.number ?? "") || null : null);
  const open = () => void navigate({ to: "/vestuario/puerta" });
  return (
    <Screen title="Capitanía" desc={secDesc("capitania", who.kind, false)} act={{ t: "Abrir La puerta", icon: "door", go: open }}>
      <div className="tu-cols">
        <section className="tu-blk" aria-labelledby="tu-door-h">
          <div className="tu-blk__hd">
            <h3 className="tu-h3" id="tu-door-h">
              La puerta
            </h3>
            <span className="tu-small">{doorLead(reqs.length)}</span>
          </div>
          {reqs.length > 0 && (
            <ul className="tu-reqs" aria-label="Peticiones para entrar">
              {reqs.map((r) => {
                const num = numOf(r.playerId);
                const who0 = r.name || r.googleName || r.email;
                return (
                  <li key={r.uid}>
                    <button type="button" className="tu-link" onClick={open}>
                      {num ? (
                        <Shirt num={num} className="tu-reqs__img" />
                      ) : (
                        <span className="tu-ava tu-ava--sm" aria-hidden="true">
                          {initials(who0)}
                        </span>
                      )}
                      <span>
                        <b>{who0}</b>
                        <small>
                          {num ? `Pide la carta del ${num}` : "Sin dorsal todavía"} · {ago(r.at, p.now)}
                        </small>
                      </span>
                      <TuIcon name="chev-r" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="tu-blk" aria-labelledby="tu-adm-h">
          <h3 className="tu-h3" id="tu-adm-h">
            Aviso de la puerta
          </h3>
          <p className="tu-blk__d">
            «Alguien llama a la puerta» en este móvil: <b>{doorOn ? "activado" : "desactivado"}</b>.{" "}
            <button
              type="button"
              className="vd-link"
              onClick={() => {
                p.go({ page: "avisos", sec: "carta", open: null });
                window.setTimeout(() => {
                  const el = document.getElementById("tu-tp-door");
                  el?.focus({ preventScroll: true });
                  el?.scrollIntoView({ block: "center" });
                }, 450);
              }}
            >
              Cambiarlo
            </button>
          </p>
        </section>
        <section className="tu-blk tu-blk--wide tu-adm" aria-labelledby="tu-adm-links-h">
          <h3 className="tu-h3" id="tu-adm-links-h">
            Administrar el club
          </h3>
          <nav className="tu-mlist" aria-labelledby="tu-adm-links-h">
            {adminLinks().map((l) => (
              <button key={l.key} type="button" className="tu-mi" onClick={() => void navigate({ href: l.path })}>
                <TuIcon name={ADMIN_ICON[l.key]} />
                <span className="tu-mi__t">{l.t}</span>
                <small className="tu-mi__h">{l.hint}</small>
                <TuIcon name="chev-r" className="tu-mi__c" />
              </button>
            ))}
          </nav>
        </section>
      </div>
    </Screen>
  );
}
