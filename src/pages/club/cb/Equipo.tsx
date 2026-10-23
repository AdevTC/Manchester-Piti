// /club/equipo · El equipo (CL- boards, part-equipo): the two kits by the front and the back (the 3D scene's own
// stills), «Ponte la del Piti» (the viewer's own printed shirt opens it), the squad in their printed shirts, the
// crest and its colours, the team photo and the grounds.
import { useState, type CSSProperties } from "react";
import type { Kit } from "../../../components/jersey3d/kitStill";
import { Go, I, CREST } from "./ui";

export interface EquipoShirt {
  id: string;
  src: string | undefined;
  alt: string;
}
export interface Venue {
  name: string;
  tag: string;
  address: string;
  transit: string;
  next: string;
  maps: string;
}
export interface EquipoProps {
  /** The kit's still by the front and the back, for a kit. */
  still: (kit: Kit, side: "front" | "back") => string | undefined;
  mk: { shirt: string | undefined; line: string; open: () => void };
  squad: EquipoShirt[];
  captain: string;
  toCrest: () => void;
  photo: string;
  venues: Venue[];
  cap: boolean;
}

const KITS = {
  home: { note: "Celeste de la casa, con el oro en el cuello y el bajo.", sw: [["celeste", "Celeste"], ["tinta", "Tinta"], ["oro", "Oro"]] },
  away: { note: "Negra de fuera, con la franja roja en diagonal.", sw: [["noche", "Noche"], ["tiza", "Tiza"], ["rojo", "Rojo"]] },
} as const;

export function Equipo({ still, mk, squad, captain, toCrest, photo, venues, cap }: EquipoProps) {
  const [kit, setKit] = useState<Kit>("home");
  const k = KITS[kit];
  const which = kit === "away" ? "La 2ª equipación" : "La 1ª equipación";
  const front = still(kit, "front");
  const back = still(kit, "back");
  return (
    <>
      <section className="cb-kits" aria-labelledby="cb-kits-t">
        <div className="cb-kits__stage">
          <figure className="cb-kits__fig">
            {front ? <img src={front} alt={`${which} del Manchester Piti, por delante, con el escudo`} width={540} height={600} /> : <span className="cb-kits__ph" role="img" aria-label={`${which} del Manchester Piti, por delante, con el escudo`} />}
            <figcaption>Por delante</figcaption>
          </figure>
          <figure className="cb-kits__fig">
            {back ? <img src={back} alt={`${which} por detrás, sin nombre ni dorsal`} width={540} height={600} /> : <span className="cb-kits__ph" role="img" aria-label={`${which} por detrás, sin nombre ni dorsal`} />}
            <figcaption>Por detrás</figcaption>
          </figure>
        </div>
        <div className="cb-kits__txt">
          <h2 id="cb-kits-t" className="cb-h2">
            Las equipaciones
          </h2>
          <div className="vd-glass vd-seg cb-kits__seg" role="radiogroup" aria-label="Equipación" style={{ "--n": 2, "--i": kit === "away" ? 1 : 0 } as CSSProperties}>
            <span className="vd-shelf__bead" aria-hidden="true" />
            <button type="button" role="radio" className="vd-seg__b" aria-checked={kit === "home"} onClick={() => setKit("home")}>
              1ª equipación
            </button>
            <button type="button" role="radio" className="vd-seg__b" aria-checked={kit === "away"} onClick={() => setKit("away")}>
              2ª equipación
            </button>
          </div>
          <p className="cb-kits__note">{k.note}</p>
          <ul className="cb-sw" aria-label="Colores de la equipación">
            {k.sw.map(([key, t]) => (
              <li key={key}>
                <i className={`cb-sw__dot cb-sw__dot--${key}`} aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
          <p className="cb-kits__next">Cada partido dice con cuál se juega, en su previa.</p>
        </div>
      </section>

      <button type="button" className="cb-mkdoor" onClick={mk.open}>
        <span className="cb-mkdoor__pic" style={{ viewTransitionName: "cb-mk-shirt" }}>
          {mk.shirt ? <img src={mk.shirt} alt="" width={540} height={600} /> : <span className="cb-mkdoor__ph" />}
        </span>
        <span className="cb-mkdoor__txt">
          <span className="cb-mkdoor__k">Para el fondo de pantalla o el grupo</span>
          <b>Ponte la del Piti</b>
          <span>{mk.line}</span>
        </span>
        <I n="chev-r" />
      </button>

      <section className="cb-squad" aria-labelledby="cb-squad-t">
        <div className="cb-squad__head">
          <h2 id="cb-squad-t" className="cb-h2">
            Los {squad.length} de la plantilla
          </h2>
          <Go className="vd-link" href="/plantilla">
            Conocerlos en Plantilla
          </Go>
        </div>
        <p className="cb-squad__s">{captain}Cada camiseta, con su nombre y su dorsal.</p>
        <ul className="cb-squad__rail">
          {squad.map((p) => (
            <li key={p.id}>
              <Go href={`/jugadores/${p.id}`} aria-label={`${p.alt}, su ficha`}>
                {p.src ? <img src={p.src} alt="" width={540} height={600} loading="lazy" /> : <span className="cb-squad__ph" />}
              </Go>
            </li>
          ))}
        </ul>
      </section>

      <div className="cb-eqgrid">
        <section className="cb-crest" aria-labelledby="cb-crest-t">
          <img src={CREST} alt="El escudo del Manchester Piti" width={88} height={88} />
          <div>
            <h2 id="cb-crest-t" className="cb-h2">
              El escudo
            </h2>
            <p>Pieza nº 01 de la vitrina. Celeste, marino y oro: los colores del club.</p>
            <ul className="cb-sw cb-sw--club" aria-label="Los colores del club">
              <li>
                <i className="cb-sw__dot cb-sw__dot--celeste" aria-hidden="true" />
                Celeste
              </li>
              <li>
                <i className="cb-sw__dot cb-sw__dot--marino" aria-hidden="true" />
                Marino
              </li>
              <li>
                <i className="cb-sw__dot cb-sw__dot--oro" aria-hidden="true" />
                Oro
              </li>
            </ul>
            <button type="button" className="vd-link" onClick={toCrest}>
              Verlo girar en la vitrina
            </button>
          </div>
        </section>
        <section className="cb-photo" aria-labelledby="cb-photo-t">
          <h2 id="cb-photo-t" className="cb-h2">
            La foto de equipo
          </h2>
          {photo ? (
            <img className="cb-photo__img" src={photo} alt="La foto de equipo del Manchester Piti" loading="lazy" />
          ) : (
            <div className="cb-photo__empty">
              <img src={CREST} alt="" width={48} height={48} />
              <span>La próxima foto de equipo va aquí</span>
            </div>
          )}
          <p className="cb-small">
            {photo ? "La de esta temporada." : "La sube el capitán desde la sala de control."}
            {cap && (
              <>
                {" "}
                <Go className="vd-link" href="/admin/contenido?seccion=foto">
                  Subir la foto
                </Go>
              </>
            )}
          </p>
        </section>
      </div>

      <section className="cb-venues" aria-labelledby="cb-venues-t">
        <h2 id="cb-venues-t" className="cb-h2">
          Los campos
        </h2>
        {venues.length ? (
          <ul className="cb-venues__l">
            {venues.map((v) => (
              <li key={v.name}>
                <span className="cb-venues__pin" aria-hidden="true">
                  <svg aria-hidden="true" focusable="false">
                    <use href="#vi-pin" />
                  </svg>
                </span>
                <div>
                  <b>{v.name}</b>
                  <span className="cb-venues__tag">{v.tag}</span>
                  {v.address && <span>{v.address}</span>}
                  {v.transit && <span>{v.transit}</span>}
                  {v.next && <span className="cb-venues__next">{v.next}</span>}
                </div>
                <a className="vd-glass vd-press vd-btn vd-btn--sm" href={v.maps} target="_blank" rel="noopener noreferrer" aria-label={`Cómo llegar a ${v.name} (se abre en otra pestaña)`}>
                  Cómo llegar
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cb-small">Campo y dirección por publicar.</p>
        )}
      </section>
    </>
  );
}
