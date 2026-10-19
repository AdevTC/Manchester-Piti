// El club: what happens off the pitch this week (the next birthday, the vitrina, the plantilla's door with
// every dorsal, the members' open poll, who backs us), «Ponte la del Piti» (your name and number on the real
// kit, made on your device), the calendar to subscribe to, and for a fan the vestuario's invitation.
import { useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { AddToCalendar } from "../../../components/celeste/AddToCalendar";
import { useShirtStills } from "../../../components/jersey3d/useShirtStills";
import { siteOrigin } from "../../../lib/derived/venue";
import { Ico } from "./icons";

export interface ClubData {
  birthday: { id: string; name: string; num: string; when: string } | null;
  vitrina: { title: string; sub: string };
  dorsales: readonly { id: string; num: string; name: string }[];
  squadSize: number;
  /** The members' newest open poll. */
  poll: { title: string; sub: string } | null;
  sponsors: readonly { name: string; url: string }[];
}

export const cleanName = (v: string) => v.toLocaleUpperCase("es").replace(/[^A-ZÁÉÍÓÚÜÑÇ .'-]/g, "").slice(0, 12);
export const cleanNum = (v: string) => v.replace(/\D/g, "").slice(0, 2);

/** The shirt with a name and a number on its back: the kit's still with the print drawn over it. */
export function Tee({ name, num, light, kit, label, className }: { name: string; num: string; light: boolean; kit: "home" | "away"; label?: string; className?: string }) {
  const req = { kit, theme: light ? ("light" as const) : ("dark" as const), name: "", num: "", yaw: 0 };
  const still = useShirtStills([req], { offMainThread: true })(req);
  return (
    <div className={`vi-tee${light ? " vi-tee--day" : ""}${still ? " vi-tee--still" : ""}${className ? ` ${className}` : ""}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <span className="vi-tee__spot" />
      <span className="vi-tee__img" style={still ? ({ backgroundImage: `url(${still})` } as CSSProperties) : undefined} />
      <span className="vi-tee__name">
        <b>{name}</b>
      </span>
      <span className="vi-tee__num">{num}</span>
    </div>
  );
}

export function ShirtMaker({ initialName, initialNum, kit }: { initialName: string; initialNum: string; kit: "home" | "away" }) {
  const [name, setName] = useState(initialName);
  const [num, setNum] = useState(initialNum);
  const [light, setLight] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const printed = { name: name.trim() || "TU NOMBRE", num: num || "10" };
  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const { renderStill } = await import("../../../components/jersey3d/scene");
      const blob = await renderStill({ kit, theme: light ? "light" : "dark", name: printed.name, num: printed.num }, "image/png", 3);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `camiseta-piti-${printed.name.toLocaleLowerCase("es").replace(/\s+/g, "-")}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      setError("No se ha podido hacer la imagen en este navegador.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="vi-maker">
      <Tee name={printed.name} num={printed.num} light={light} kit={kit} label={`Tu camiseta con ${printed.name} y el dorsal ${printed.num}`} />
      <div className="vi-maker__form">
        <h3 className="vd-h3">Ponte la del Piti</h3>
        <p className="vd-small">Tu nombre y tu dorsal en la espalda, para el fondo de pantalla o para mandarla al grupo.</p>
        <div className="vi-maker__row">
          <label>
            <span className="vd-label">Tu nombre</span>
            <input className="vd-input" type="text" value={name} placeholder="TU NOMBRE" maxLength={12} autoComplete="off" onChange={(e) => setName(cleanName(e.target.value))} />
          </label>
          <label>
            <span className="vd-label">Dorsal</span>
            <input className="vd-input" type="text" inputMode="numeric" value={num} placeholder="10" maxLength={2} onChange={(e) => setNum(cleanNum(e.target.value))} />
          </label>
        </div>
        <div className="vd-glass vd-seg vi-teeseg" role="group" aria-label="La foto" style={{ "--n": 2, "--i": light ? 1 : 0 } as CSSProperties}>
          <span className="vd-shelf__bead" aria-hidden="true" />
          <button type="button" className="vd-seg__b" aria-pressed={!light} onClick={() => setLight(false)}>
            Con focos
          </button>
          <button type="button" className="vd-seg__b" aria-pressed={light} onClick={() => setLight(true)}>
            De día
          </button>
        </div>
        <div className="vi-maker__acts">
          <button type="button" className="vd-glass vd-btn vd-btn--pri vd-press" onClick={() => void download()} disabled={busy}>
            <Ico id="down" />
            {busy ? "Haciendo la imagen…" : "Descargar la imagen"}
          </button>
        </div>
        {error && (
          <p className="vi-err" role="alert">
            {error}
          </p>
        )}
        <p className="vd-small vi-tiny">Tu nombre no se guarda: la imagen se hace en tu móvil.</p>
      </div>
    </div>
  );
}

export function FanInvite() {
  return (
    <section className="vi-invite" aria-labelledby="vi-invite-h">
      <div>
        <p className="vi-kick">¿Juegas en el Piti?</p>
        <h3 className="vd-h3" id="vi-invite-h">
          Pide entrar al vestuario
        </h3>
        <p className="vd-small">Dentro, el partido también es tuyo:</p>
        <ol className="vi-steps">
          <li>Respondes a la convocatoria</li>
          <li>Ves tu sitio en el siete</li>
          <li>Votas al MVP y llevas tu carta</li>
        </ol>
        <div className="vi-acts vi-acts--left">
          <Link className="vd-glass vd-btn vd-btn--pri vd-press" to="/vestuario">
            <Ico id="lock" />
            Pedir entrar
          </Link>
          <Link className="vd-glass vd-btn vd-press" to="/vestuario">
            Ya tengo invitación
          </Link>
        </div>
      </div>
    </section>
  );
}

function Rows({ d, full }: { d: ClubData; full: boolean }) {
  return (
    <ul className="vi-rows">
      {d.birthday && (
        <li>
          <span className="vi-ic" aria-hidden="true">
            <Ico id="cake" />
          </span>
          <div className="vi-t">
            <b>
              {d.birthday.name} cumple años {d.birthday.when}
            </b>
            <span>{d.birthday.num ? `Dorsal ${d.birthday.num}. ` : ""}Que no se te pase felicitarle.</span>
          </div>
          <Link className="vd-link" to="/jugadores/$playerId" params={{ playerId: d.birthday.id }} aria-label={`La ficha de ${d.birthday.name}`}>
            Su ficha
          </Link>
        </li>
      )}
      <li>
        <span className="vi-case" aria-hidden="true" />
        <div className="vi-t">
          <b>{d.vitrina.title}</b>
          <span>{d.vitrina.sub}</span>
        </div>
        <Link className="vd-link" to="/club" aria-label="Ver la vitrina, en El club">
          Verla
        </Link>
      </li>
      {full && (
        <li className="vi-row--wrap">
          <span className="vi-ic" aria-hidden="true">
            <Ico id="shirt" />
          </span>
          <div className="vi-t">
            <b>{d.squadSize ? `Los ${d.squadSize} de la plantilla` : "La plantilla"}</b>
            <span>Camisetas, fichas y cara a cara.</span>
          </div>
          <Link className="vd-link" to="/plantilla" aria-label={`Conoce a los ${d.squadSize || "jugadores"} en Plantilla`}>
            Conocerlos
          </Link>
          {d.dorsales.length > 0 && (
            <ul className="vi-dorsales" aria-label="Los dorsales">
              {d.dorsales.map((p) => (
                <li key={p.id}>
                  <Link to="/jugadores/$playerId" params={{ playerId: p.id }} aria-label={`${p.name}, dorsal ${p.num}`}>
                    {p.num}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      )}
      {full && d.poll && (
        <li>
          <span className="vi-ic" aria-hidden="true">
            <Ico id="chart" />
          </span>
          <div className="vi-t">
            <b>{d.poll.title}</b>
            <span>{d.poll.sub}</span>
          </div>
          <Link className="vd-link" to="/vestuario" aria-label={`Votar «${d.poll.title}», en el vestuario`}>
            Votar
          </Link>
        </li>
      )}
      {full && d.sponsors.length > 0 && (
        <li className="vi-row--wrap">
          <div className="vi-t">
            <b>Nos apoyan</b>
            <div className="vi-spons">
              {d.sponsors.map((s, i) =>
                s.url ? (
                  <a key={s.name} className={`t${i % 2}`} href={s.url} target="_blank" rel="noreferrer">
                    {s.name}
                    <span className="vd-vh"> (se abre en otra pestaña)</span>
                  </a>
                ) : (
                  <span key={s.name} className={`t${i % 2}`}>
                    {s.name}
                  </span>
                ),
              )}
            </div>
          </div>
        </li>
      )}
    </ul>
  );
}

export interface ClubProps {
  d: ClubData;
  fan: boolean;
  /** The shirt's name and number to start with (a jugador's own). */
  shirt: { name: string; num: string };
  kit: "home" | "away";
  /** sum: the 1920 zone (two rows and the small shirt) · min: one line · full: the place. */
  variant: "full" | "sum" | "min";
  onOpen?: () => void;
  region?: (n: 1 | 2 | 3 | 4) => string;
}

export function Club({ d, fan, shirt, kit, variant, onOpen, region = () => "" }: ClubProps) {
  if (variant === "min")
    return (
      <p className="vi-zmin">
        <span>
          {d.birthday ? (
            <>
              <b>{d.birthday.name}</b> cumple {d.birthday.when}; {d.vitrina.title.toLocaleLowerCase("es").replace(/^la vitrina/, "la vitrina")}.
            </>
          ) : (
            <>
              <b>{d.vitrina.title}.</b> {d.squadSize ? `${d.squadSize} en la plantilla.` : ""}
            </>
          )}
        </span>
      </p>
    );
  if (variant === "sum")
    return (
      <div className="vi-club vi-club--sum">
        <Rows d={d} full={false} />
        <div className="vi-minitee">
          <Tee name={shirt.name || "TU NOMBRE"} num={shirt.num || "10"} light={false} kit={kit} />
          <div>
            <h3 className="vi-sub">Ponte la del Piti</h3>
            <p className="vd-small">Tu nombre y tu dorsal en la espalda, para el fondo de pantalla.</p>
            <button type="button" className="vd-link" onClick={onOpen}>
              Hacerme la mía
            </button>
          </div>
        </div>
      </div>
    );
  const origin = siteOrigin();
  return (
    <div className="vi-club">
      <div className={`vi-club__rows ${region(2)}`}>
        <Rows d={d} full />
        <div className="vi-club__cal">
          <AddToCalendar className="vd-glass vd-btn vd-press" iconName="cal" label="Suscribirme al calendario" feed={`${origin}/calendario.ics`} />
          <span className="vd-small">Cada partido entra solo en tu calendario, con hora y campo.</span>
        </div>
        {fan && <FanInvite />}
      </div>
      <div className={`vi-club__maker ${region(3)}`}>
        <ShirtMaker key={`${shirt.name}·${shirt.num}`} initialName={shirt.name} initialNum={shirt.num} kit={kit} />
      </div>
    </div>
  );
}
