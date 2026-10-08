// /profile › Cuenta: Cómo te llaman (→ Tu carta › Tu nombre), Tu cuenta de Google, Tu acceso (the card's
// back), Salir en este dispositivo (with its confirmation), Qué guarda el club de ti, Datos técnicos (your
// id, copy) and Darme de baja (checkbox + confirm; the superadmin can't). As designed (pf-g.mjs pCuenta).
import { useEffect, useRef, useState } from "react";
import { buzz, copyText, errorMessage, isOffline } from "./fxRuntime";
import { GLogo, Ic } from "./icons";
import type { AccessInfo } from "./profileData";

export interface CuentaProps {
  nick: string;
  shirtLine: string;
  onChange: () => void;
  google: { name: string; email: string; photo: string | null };
  /** The avatar's letters when there is no photo. */
  initials: string;
  roleLong: string;
  access: AccessInfo;
  uid: string;
  isSuperadmin: boolean;
  /** Signs out here only (the door shows up). */
  onSignOut: () => Promise<void>;
  /** leaveVestuario + sign out here. */
  onLeave: () => Promise<void>;
  say: (msg: string, bad?: boolean) => void;
}

export function TabCuenta(p: CuentaProps) {
  const [photoOk, setPhotoOk] = useState(true);
  const [so, setSo] = useState(false);
  const [soBusy, setSoBusy] = useState(false);
  const [priv, setPriv] = useState(false);
  const [tech, setTech] = useState(false);
  const [idCp, setIdCp] = useState(false);
  const [baja, setBaja] = useState<"" | "open" | "done">("");
  const [bajaOk, setBajaOk] = useState(false);
  const [bajaBusy, setBajaBusy] = useState(false);
  const [bajaErr, setBajaErr] = useState<string | null>(null);
  const soBtn = useRef<HTMLButtonElement>(null);
  const soYes = useRef<HTMLButtonElement>(null);
  const bajaBtn = useRef<HTMLButtonElement>(null);
  const bajaCk = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  // The focus goes into each confirmation when it opens and back to its button when it closes.
  const soOpened = useRef(false);
  useEffect(() => {
    if (so) soYes.current?.focus();
    else if (soOpened.current) soBtn.current?.focus();
    soOpened.current = so;
  }, [so]);
  const bajaOpened = useRef(false);
  useEffect(() => {
    if (baja === "open") bajaCk.current?.focus();
    else if (baja === "" && bajaOpened.current) bajaBtn.current?.focus();
    bajaOpened.current = baja === "open";
  }, [baja]);

  const signOut = async () => {
    if (soBusy || inFlight.current) return;
    inFlight.current = true;
    setSoBusy(true);
    buzz(15);
    try {
      await p.onSignOut();
    } catch (e) {
      p.say(errorMessage(e), true);
    } finally {
      inFlight.current = false;
      setSoBusy(false);
    }
  };
  const copyId = async () => {
    const ok = await copyText(p.uid);
    if (ok) {
      setIdCp(true);
      p.say("Id copiado");
    } else p.say("No se ha podido copiar: mantén pulsado el id para copiarlo", true);
  };
  const doBaja = async () => {
    if (!bajaOk || bajaBusy || inFlight.current || p.isSuperadmin) return;
    if (isOffline()) {
      setBajaErr("Sin conexión: no te hemos dado de baja. Vuelve a intentarlo cuando tengas cobertura.");
      return;
    }
    inFlight.current = true;
    setBajaBusy(true);
    setBajaErr(null);
    buzz(60);
    try {
      await p.onLeave();
      setBaja("done");
    } catch (e) {
      setBajaErr(errorMessage(e));
    } finally {
      inFlight.current = false;
      setBajaBusy(false);
    }
  };

  const g = p.google;
  return (
    <>
      <div className="bk">
        <h3 className="bk-h">Cómo te llaman</h3>
        <p className="bk-d">Se cambian en Tu carta › Tu nombre.</p>
        <div className="names">
          <dl>
            <div>
              <dt>Apodo</dt>
              <dd className="mono">@{p.nick}</dd>
            </div>
            <div>
              <dt>En la espalda</dt>
              <dd>{p.shirtLine}</dd>
            </div>
          </dl>
          <button type="button" className="btn sm" onClick={p.onChange}>
            Cambiarlos <Ic n="right" w={16} />
          </button>
        </div>
      </div>

      <div className="bk">
        <h3 className="bk-h">Tu cuenta de Google</h3>
        <p className="bk-d">Entras con ella. No hay contraseña del equipo.</p>
        <div className="gacc">
          <span className="av" aria-hidden="true">
            {g.photo && photoOk ? <img src={g.photo} alt="" referrerPolicy="no-referrer" onError={() => setPhotoOk(false)} /> : p.initials}
            <span className="g">
              <GLogo />
            </span>
          </span>
          <span className="gacc-t">
            <b>{g.name || "@" + p.nick}</b>
            {g.email && <small className="mail">{g.email}</small>}
            <small>{p.roleLong} del Manchester Piti</small>
          </span>
        </div>
      </div>

      <div className="bk">
        <h3 className="bk-h">Tu acceso</h3>
        <p className="bk-d">Lo mismo que lleva el dorso de tu carta.</p>
        <dl className="acc">
          <div>
            <dt>Socio desde</dt>
            <dd>{p.access.sinceText}</dd>
          </div>
          <div>
            <dt>Cómo entraste</dt>
            <dd>{p.access.howIn}</dd>
          </div>
          <div>
            <dt>Te abrió</dt>
            <dd>{p.access.whoOpened}</dd>
          </div>
          <div>
            <dt>Caducidad</dt>
            <dd className="inf">
              <Ic n="inf" w={16} />
              No caduca
            </dd>
            <dd>
              <small>Hasta que un capitán te quite el acceso</small>
            </dd>
          </div>
        </dl>
      </div>

      <div className="bk">
        <h3 className="bk-h">Salir en este dispositivo</h3>
        <p className="bk-d">Cierra la sesión solo aquí. En tus otros móviles sigues dentro.</p>
        {!so ? (
          <button type="button" className="btn" ref={soBtn} onClick={() => setSo(true)}>
            <Ic n="out" />
            Salir en este dispositivo
          </button>
        ) : (
          <div className="cf" role="group" aria-label="Confirmar la salida">
            <p>
              <b>¿Salir aquí?</b> Para volver, entra otra vez con tu Google.
            </p>
            <div className="row">
              <button type="button" className="btn gold" ref={soYes} disabled={soBusy} aria-busy={soBusy || undefined} onClick={() => void signOut()}>
                {soBusy ? "Saliendo…" : "Sí, salir"}
              </button>
              <button type="button" className="btn" disabled={soBusy} onClick={() => setSo(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bk">
        <h3 className="bk-h">
          Qué guarda el club de ti <span className="nv">nuevo</span>
        </h3>
        <p className="bk-d">En palabras normales, sin letra pequeña.</p>
        <button type="button" className="disc" aria-expanded={priv} aria-controls="pe-priv" onClick={() => setPriv((v) => !v)}>
          <span>{priv ? "Ocultar" : "Léelo en dos líneas"}</span>
          <Ic n="chev" />
        </button>
        {priv && (
          <ul className="priv" id="pe-priv">
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
              <b>Tus avisos</b>: un identificador por móvil para mandarte notificaciones.
            </li>
            <li>Nada más. No se vende ni se comparte con nadie.</li>
          </ul>
        )}
      </div>

      <div className="bk">
        <h3 className="bk-h">Datos técnicos</h3>
        <p className="bk-d">Solo para soporte, por si algo falla.</p>
        <button type="button" className="disc" aria-expanded={tech} aria-controls="pe-tech" onClick={() => setTech((v) => !v)}>
          <span>{tech ? "Ocultar" : "Ver tu id de usuario"}</span>
          <Ic n="chev" />
        </button>
        {tech && (
          <div className="uid" id="pe-tech">
            <code>{p.uid}</code>
            <button type="button" className="btn sm" onClick={() => void copyId()}>
              <Ic n="copy" w={16} />
              {idCp ? "Copiado" : "Copiar id"}
            </button>
          </div>
        )}
      </div>

      <div className="bk">
        <h3 className="bk-h">
          Darme de baja <span className="nv">nuevo</span>
        </h3>
        <p className="bk-d">Dejar el equipo tú mismo. Tus goles y partidos siguen en la historia del club.</p>
        <div className="danger">
          {p.isSuperadmin ? (
            <p>
              <b>Eres el superadministrador del club:</b> esta cuenta no se puede dar de baja. Si lo dejas, habla antes con el resto de capitanes.
            </p>
          ) : baja === "" ? (
            <>
              <p>Pierdes el acceso al vestuario en todos tus móviles. Para volver, un capitán tendrá que abrirte otra vez.</p>
              <button
                type="button"
                className="btn red"
                ref={bajaBtn}
                onClick={() => {
                  setBaja("open");
                  setBajaOk(false);
                  setBajaErr(null);
                }}
              >
                <Ic n="minus" />
                Darme de baja del vestuario
              </button>
            </>
          ) : baja === "open" ? (
            <div className="cf red" role="group" aria-label="Confirmar la baja">
              <label className="ck">
                <input type="checkbox" ref={bajaCk} checked={bajaOk} disabled={bajaBusy} onChange={(e) => setBajaOk(e.target.checked)} />
                <span>Entiendo que dejo el vestuario y que, para volver, un capitán tendrá que abrirme otra vez.</span>
              </label>
              <div className="row">
                <button type="button" className="btn red solid" disabled={!bajaOk || bajaBusy} aria-busy={bajaBusy || undefined} onClick={() => void doBaja()}>
                  {bajaBusy ? "Dándote de baja…" : "Darme de baja"}
                </button>
                <button type="button" className="btn" disabled={bajaBusy} onClick={() => setBaja("")}>
                  Me quedo
                </button>
              </div>
              {bajaErr && (
                <p className="note bad" role="alert">
                  <Ic n="alert" />
                  <span>{bajaErr}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="cf red" role="status">
              <p>
                <b>Te has dado de baja.</b> Saliendo de este dispositivo…
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
