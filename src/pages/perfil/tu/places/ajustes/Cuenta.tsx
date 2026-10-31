// Ajustes › Cuenta (TuCarta ajCuenta; today's screens/Cuenta): his Google, how he is called and his access, «Salir
// en este dispositivo» with its confirmation in place (the account sheet's «Salir» lands here with it open:
// ?salir=1), what the club keeps of him, his id with «Copiar id» and «Darme de baja» with its «Entiendo…» step
// (blocked for the superadmin).
import { useState } from "react";
import { TuIcon } from "../../../../../components/vidrio/tu/ui";
import { initials, signOutFailText, sinceLong } from "../../model";
import { wantedNumber } from "../../view";
import { backLine, roleLine } from "../ajustesView";
import type { PlaceProps } from "../types";
import { copyText } from "./clip";
import { Tog } from "./Tog";

export function Cuenta(p: PlaceProps) {
  const { data, who, say } = p;
  const [so, setSo] = useState(!!p.query.salir);
  const [leaving, setLeaving] = useState(false);
  // (the account sheet's «Salir» while he is already here: ?salir=1 arrives later, and opens it too)
  const [salirWas, setSalirWas] = useState(p.query.salir);
  if (p.query.salir !== salirWas) {
    setSalirWas(p.query.salir);
    if (p.query.salir) setSo(true);
  }
  const [baja, setBaja] = useState<"" | "open" | "done">("");
  const [bajaOk, setBajaOk] = useState(false);
  const g = data.google;
  const rows: { k: string; v: string }[] = [
    { k: "Apodo", v: `@${data.nickname}` },
    { k: "En la espalda", v: backLine(who.kind, data.shirt.current, data.card.number, data.ficha.state === "pendiente", wantedNumber(data)) },
    { k: "Socio desde", v: sinceLong(data.access.sinceText) },
    { k: "Cómo entraste", v: data.access.howIn },
    { k: "Te abrió", v: data.access.whoOpened },
    { k: "Caducidad", v: "No caduca, hasta que un capitán te quite el acceso" },
  ];
  const salir = () => {
    if (leaving) return;
    setLeaving(true);
    p.actions.signOut().catch((e: unknown) => {
      setLeaving(false);
      say(signOutFailText(e));
    });
  };
  const darBaja = () => {
    if (!bajaOk || baja === "done") return;
    setBaja("done");
    p.actions.leaveVestuario().catch(() => {
      setBaja("open");
      say("No se ha podido completar la baja. Inténtalo otra vez.");
    });
  };
  return (
    <>
      <section className="tc-ajrow" aria-labelledby="tc-cu-g">
        <h3 id="tc-cu-g">Tu cuenta de Google</h3>
        <div className="tc-who">
          <span className="tc-ini tc-ini--g" aria-hidden="true">
            {g.photo ? <img src={g.photo} alt="" referrerPolicy="no-referrer" /> : initials(g.name || data.nickname)}
          </span>
          <span>
            <b>{g.name || `@${data.nickname}`}</b>
            <br />
            <span className="nx-meta">
              {g.email}
              {g.email ? " · " : ""}
              {roleLine(data.isCaptain, who.kind)}
            </span>
          </span>
        </div>
        <dl className="nx-dl tc-dl">
          {rows.map((r) => (
            <div key={r.k}>
              <dt>{r.k}</dt>
              <dd>{r.v}</dd>
            </div>
          ))}
        </dl>
        <p>
          Entras con tu Google: no hay contraseña del equipo. Los nombres se cambian en{" "}
          <button type="button" className="nx-lnk tc-inl" onClick={() => p.go({ page: "perfil", sec: "ajustes", aj: "nombre", open: null })}>
            Ajustes › {who.kind === "socio" ? "Tu apodo" : "Tu nombre"}
          </button>
          .
        </p>
      </section>
      <section className="tc-ajrow" aria-labelledby="tc-cu-out">
        <h3 id="tc-cu-out">Salir en este dispositivo</h3>
        <p>Cierra la sesión solo aquí. En tus otros móviles sigues dentro.</p>
        {!so ? (
          <div className="tk-acts">
            <button type="button" className="vd-glass vd-press nx-btn" onClick={() => setSo(true)}>
              <TuIcon name="logout" className="nx-ic" />
              Salir en este dispositivo
            </button>
          </div>
        ) : (
          <div className="tk-confirm" role="group" aria-labelledby="tc-cu-so">
            <p id="tc-cu-so">
              <b>¿Salir aquí?</b> Para volver, entra otra vez con tu Google.
            </p>
            <div className="tk-acts">
              <button type="button" className="vd-glass vd-press nx-btn nx-btn--danger" aria-disabled={leaving || undefined} onClick={salir}>
                {leaving ? "Saliendo…" : "Sí, salir"}
              </button>
              <button type="button" className="nx-lnk" onClick={() => setSo(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
      <details className="tc-det">
        <summary>Qué guarda el club de ti</summary>
        <div>
          <p>
            <b>Tu nombre, correo y foto de Google</b>, para saber que eres tú (el correo solo lo ven los capitanes).
          </p>
          <p>
            <b>Tu apodo y tu ficha</b>: dorsal, posición y lo que pone en tu espalda, si la tienes.
          </p>
          <p>
            <b>Lo que haces en el vestuario</b>: convocatorias y ausencias (solo las ven los capitanes y tú), porra, votos al MVP y a las encuestas, y pizarras.
          </p>
          <p>
            <b>Tus avisos</b>: un identificador por móvil, qué has leído y lo que has silenciado.
          </p>
          <p>Nada más. No se vende ni se comparte con nadie.</p>
        </div>
      </details>
      <details className="tc-det">
        <summary>Datos técnicos · Ver tu id de usuario</summary>
        <div>
          <code className="tc-uid">{data.uid}</code>
          <button type="button" className="nx-lnk tc-self" onClick={() => void copyText(data.uid).then((ok) => say(ok ? "Id copiado." : "No se ha podido copiar el id."))}>
            Copiar id
          </button>
        </div>
      </details>
      <details className="tc-det tc-det--red">
        <summary>Darme de baja del vestuario</summary>
        <div>
          {data.isSuperadmin ? (
            <p>
              <b>Eres el superadministrador del club:</b> esta cuenta no se puede dar de baja. Si lo dejas, habla antes con el resto de capitanes.
            </p>
          ) : baja === "" ? (
            <>
              <p>Pierdes el acceso en todos tus móviles. Tus goles y partidos siguen en la historia del club. Para volver, un capitán tendrá que abrirte otra vez.</p>
              <div className="tk-acts">
                <button
                  type="button"
                  className="vd-glass vd-press nx-btn nx-btn--danger"
                  onClick={() => {
                    setBaja("open");
                    setBajaOk(false);
                  }}
                >
                  Quiero darme de baja
                </button>
              </div>
            </>
          ) : baja === "open" ? (
            <div className="tk-confirm" role="group" aria-label="Confirmar la baja">
              <Tog on={bajaOk} onFlip={() => setBajaOk(!bajaOk)}>
                Entiendo que dejo el vestuario y que, para volver, un capitán tendrá que abrirme otra vez.
              </Tog>
              <div className="tk-acts">
                <button type="button" className="vd-glass vd-press nx-btn nx-btn--danger" aria-disabled={!bajaOk || undefined} onClick={darBaja}>
                  Darme de baja
                </button>
                <button type="button" className="nx-lnk" onClick={() => setBaja("")}>
                  Me quedo
                </button>
              </div>
            </div>
          ) : (
            <p role="status">
              <b>Te has dado de baja.</b> Saliendo de este dispositivo…
            </p>
          )}
        </div>
      </details>
    </>
  );
}
