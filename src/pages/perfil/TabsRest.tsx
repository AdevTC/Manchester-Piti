// /profile › Avisos · Ajustes · Cuenta · Capitanía: their blocks' headings and descriptions as designed
// (pf-g.mjs pAvisos/pAjustes/pCuenta/pCap), so the menu is complete. Phase 3 fills them with the device
// state, the settings, the account and the door; «Cómo te llaman» and «Administrar el club» already work.
import { Link } from "@tanstack/react-router";
import { Ic } from "./icons";

function Head({ title, desc, nv = false }: { title: string; desc?: string; nv?: boolean }) {
  return (
    <div className="bk">
      <h3 className="bk-h">
        {title}
        {nv && (
          <>
            {" "}
            <span className="nv">nuevo</span>
          </>
        )}
      </h3>
      {desc && <p className="bk-d">{desc}</p>}
    </div>
  );
}

export function TabAvisos() {
  return (
    <>
      <Head title="Este móvil" desc="Los avisos van por dispositivo: actívalos en cada móvil donde quieras enterarte." />
      <Head title="Qué te avisamos" />
      <Head title="Calendario" desc="Los partidos del club en tu calendario de siempre. Se actualiza solo." />
    </>
  );
}

export function TabAjustes() {
  return <Head title="En este móvil" desc="Cambia un valor con las flechas; se guarda solo." />;
}

export function TabCuenta({ nick, shirtLine, onChange }: { nick: string; shirtLine: string; onChange: () => void }) {
  return (
    <>
      <div className="bk">
        <h3 className="bk-h">Cómo te llaman</h3>
        <p className="bk-d">Se cambian en Tu carta › Tu nombre.</p>
        <div className="names">
          <dl>
            <div>
              <dt>Apodo</dt>
              <dd className="mono">@{nick}</dd>
            </div>
            <div>
              <dt>En la espalda</dt>
              <dd>{shirtLine}</dd>
            </div>
          </dl>
          <button type="button" className="btn sm" onClick={onChange}>
            Cambiarlos <Ic n="right" w={16} />
          </button>
        </div>
      </div>
      <Head title="Tu cuenta de Google" desc="Entras con ella. No hay contraseña del equipo." />
      <Head title="Tu acceso" desc="Lo mismo que lleva el dorso de tu carta." />
      <Head title="Salir en este dispositivo" desc="Cierra la sesión solo aquí. En tus otros móviles sigues dentro." />
      <Head title="Qué guarda el club de ti" desc="En palabras normales, sin letra pequeña." nv />
      <Head title="Datos técnicos" desc="Solo para soporte, por si algo falla." />
      <Head title="Darme de baja" desc="Dejar el equipo tú mismo. Tus goles y partidos siguen en la historia del club." nv />
    </>
  );
}

export function TabCapitania() {
  return (
    <>
      <Head title="La puerta" desc="Quién pide entrar al vestuario. Solo lo ven los capitanes." />
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
      <Head title="Aviso de la puerta" />
    </>
  );
}
