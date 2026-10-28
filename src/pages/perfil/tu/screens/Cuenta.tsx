// /perfil/cuenta (TU boards isCuenta): his Google, how he is called, his access, «Salir en este dispositivo» (with
// its confirmation; the «Tú» sheet's «Salir» lands here with it open: ?salir=1), what the club keeps of him, his id
// and «Darme de baja» (blocked for the superadmin).
import { useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { TuIcon } from "../../../../components/vidrio/tu/ui";
import { copyText } from "../../fxRuntime";
import { initials, secDesc, signOutFailText, sinceLong } from "../model";
import type { ScreenProps } from "../MiPagina";
import { wantedNumber } from "../view";
import { Screen } from "./Head";

export function Cuenta(p: ScreenProps) {
  const { data, who, say } = p;
  const salir = useLocation({ select: (l) => (l.search as Record<string, unknown>).salir === "1" || (l.search as Record<string, unknown>).salir === 1 });
  const [so, setSo] = useState(salir);
  const [priv, setPriv] = useState(false);
  const [tech, setTech] = useState(false);
  const [baja, setBaja] = useState<"" | "open" | "done">("");
  const [bajaOk, setBajaOk] = useState(false);
  const [danger, setDanger] = useState(false);
  const shirt = who.kind === "jugador" ? `${data.shirt.current.toUpperCase()} · dorsal ${data.card.number}` : who.kind === "nuevo" ? (data.ficha.state === "pendiente" ? `Cuando el capitán acepte tu ficha del ${wantedNumber(data)}` : "Cuando tengas ficha") : "Sin ficha de jugador";
  const role = `${data.isCaptain ? "Capitán del vestuario" : who.kind === "jugador" ? "Jugador" : "Socio"} del Manchester Piti`;
  const g = data.google;
  return (
    <Screen title="Cuenta" desc={secDesc("cuenta", who.kind, false)}>
      <div className="tu-cols">
        <section className="tu-blk" aria-labelledby="tu-c1">
          <h3 className="tu-h3" id="tu-c1">
            Tu cuenta de Google
          </h3>
          <div className="tu-gacc">
            <span className="tu-ava" aria-hidden="true">
              {g.photo ? <img src={g.photo} alt="" referrerPolicy="no-referrer" /> : initials(g.name || data.nickname)}
              <i>
                <TuIcon name="google" />
              </i>
            </span>
            <span>
              <b>{g.name || `@${data.nickname}`}</b>
              <small>{g.email}</small>
              <small>{role}</small>
            </span>
          </div>
          <dl className="tu-dl">
            <div>
              <dt>Apodo</dt>
              <dd>@{data.nickname}</dd>
            </div>
            <div>
              <dt>En la espalda</dt>
              <dd>{shirt}</dd>
            </div>
            <div>
              <dt>Socio desde</dt>
              <dd>{sinceLong(data.access.sinceText)}</dd>
            </div>
            <div>
              <dt>Cómo entraste</dt>
              <dd>{data.access.howIn}</dd>
            </div>
            <div>
              <dt>Te abrió</dt>
              <dd>{data.access.whoOpened}</dd>
            </div>
            <div>
              <dt>Caducidad</dt>
              <dd>No caduca, hasta que un capitán te quite el acceso</dd>
            </div>
          </dl>
          <p className="tu-small">
            Entras con tu Google: no hay contraseña del equipo. Los nombres se cambian en{" "}
            <button type="button" className="vd-link" onClick={() => p.go({ page: "perfil", sec: "nombre", open: null })}>
              Tu nombre
            </button>
            .
          </p>
        </section>
        <section className="tu-blk" aria-labelledby="tu-c2">
          <h3 className="tu-h3" id="tu-c2">
            Salir en este dispositivo
          </h3>
          <p className="tu-blk__d">Cierra la sesión solo aquí. En tus otros móviles sigues dentro.</p>
          {!so ? (
            <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm tu-self" onClick={() => setSo(true)}>
              <TuIcon name="logout" />
              Salir en este dispositivo
            </button>
          ) : (
            <div className="tu-confirm" role="group" aria-label="Confirmar la salida">
              <p>
                <b>¿Salir aquí?</b> Para volver, entra otra vez con tu Google.
              </p>
              <div className="tu-row">
                <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm vd-btn--pri" onClick={() => void p.actions.signOut().catch((e: unknown) => say(signOutFailText(e)))}>
                  Sí, salir
                </button>
                <button type="button" className="vd-link" onClick={() => setSo(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
          <button type="button" className="tu-disc" aria-expanded={priv} aria-controls="tu-priv" onClick={() => setPriv(!priv)}>
            Qué guarda el club de ti · {priv ? "Ocultar" : "Léelo en dos líneas"}
            <TuIcon name="chev-r" />
          </button>
          {priv && (
            <ul className="tu-priv" id="tu-priv">
              <li>
                <b>Tu nombre, correo y foto de Google</b>, para saber que eres tú.
              </li>
              <li>
                <b>Tu apodo y tu ficha</b> (dorsal y posición), si la tienes.
              </li>
              <li>
                <b>Lo que haces en el vestuario</b>: convocatorias, porra, votos al MVP y pizarras.
              </li>
              <li>
                <b>Tus avisos</b>: un identificador por móvil, qué has leído y lo que has silenciado.
              </li>
              <li>Nada más. No se vende ni se comparte con nadie.</li>
            </ul>
          )}
          <button type="button" className="tu-disc" aria-expanded={tech} aria-controls="tu-tech" onClick={() => setTech(!tech)}>
            Datos técnicos · {tech ? "Ocultar" : "Ver tu id de usuario"}
            <TuIcon name="chev-r" />
          </button>
          {tech && (
            <div className="tu-uid" id="tu-tech">
              <code className="tu-code">{data.uid}</code>
              <button type="button" className="vd-link" onClick={() => void copyText(data.uid).then((ok) => say(ok ? "Id copiado." : "No se ha podido copiar el id."))}>
                Copiar id
              </button>
            </div>
          )}
          {/* (its content only while it is open: a closed <details> still lays out its button, under the dock) */}
          <details className="tu-danger" open={danger} onToggle={(e) => setDanger(e.currentTarget.open)}>
            <summary>Darme de baja del vestuario</summary>
            {!danger ? null : data.isSuperadmin ? (
              <p className="tu-blk__d">
                <b>Eres el superadministrador del club:</b> esta cuenta no se puede dar de baja. Si lo dejas, habla antes con el resto de capitanes.
              </p>
            ) : baja === "" ? (
              <>
                <p className="tu-blk__d">Pierdes el acceso en todos tus móviles. Tus goles y partidos siguen en la historia del club. Para volver, un capitán tendrá que abrirte otra vez.</p>
                <button
                  type="button"
                  className="vd-glass vd-press vd-btn vd-btn--sm tu-btn-red"
                  onClick={() => {
                    setBaja("open");
                    setBajaOk(false);
                  }}
                >
                  Quiero darme de baja
                </button>
              </>
            ) : baja === "open" ? (
              <div className="tu-confirm is-red" role="group" aria-label="Confirmar la baja">
                <label className="tu-ck">
                  <input type="checkbox" checked={bajaOk} onChange={(e) => setBajaOk(e.target.checked)} />
                  <span>Entiendo que dejo el vestuario y que, para volver, un capitán tendrá que abrirme otra vez.</span>
                </label>
                <div className="tu-row">
                  <button
                    type="button"
                    className="vd-glass vd-press vd-btn vd-btn--sm tu-btn-red"
                    aria-disabled={!bajaOk}
                    onClick={() => {
                      if (!bajaOk) return;
                      setBaja("done");
                      p.actions.leaveVestuario().catch(() => {
                        setBaja("open");
                        say("No se ha podido completar la baja. Inténtalo otra vez.");
                      });
                    }}
                  >
                    Darme de baja
                  </button>
                  <button type="button" className="vd-link" onClick={() => setBaja("")}>
                    Me quedo
                  </button>
                </div>
              </div>
            ) : (
              <p className="tu-blk__d" role="status">
                <b>Te has dado de baja.</b> Saliendo de este dispositivo…
              </p>
            )}
          </details>
        </section>
      </div>
    </Screen>
  );
}
