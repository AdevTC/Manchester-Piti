import { useRef, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Jersey3D, type Jersey3DRef } from "../../components/jersey3d/Jersey3D";
import { Icon } from "../../components/celeste/icons";
import { dateMillis, type ClubMatch } from "../../lib/clubData";
import { countdownParts, matchEvent, type Narrative, type PlayerLine } from "../../lib/home";
import { AddToCalendar } from "../../components/celeste/AddToCalendar";
import { kickoffLabel } from "../../lib/vestuario";
import { shareClubPage } from "../../lib/share";

interface Props {
  narrative: Narrative;
  seasonName: string;
  squad: PlayerLine[];
  sel: number;
  onSelect: (i: number) => void;
  kit: "home" | "away";
  onKit: (k: "home" | "away") => void;
  theme: "dark" | "light";
  moment: string;
  next: ClubMatch | undefined;
  live: ClubMatch | undefined;
  now: number;
}

export function Vestidor({ narrative, seasonName, squad, sel, onSelect, kit, onKit, theme, moment, next, live, now }: Props) {
  const shirt = useRef<Jersey3DRef>(null);
  const rail = useRef<HTMLDivElement>(null);
  const p = squad[sel];
  const n = squad.length;
  const step = (d: number) => onSelect((sel + d + n) % n);
  const shuffle = () => {
    if (n < 2) return;
    let r = sel;
    while (r === sel) r = Math.floor(Math.random() * n);
    onSelect(r);
  };
  const onRailKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const to = (sel + (e.key === "ArrowRight" ? 1 : -1) + n) % n;
    onSelect(to);
    rail.current?.querySelectorAll<HTMLButtonElement>("button")[to]?.focus();
  };
  const kickoff = next ? dateMillis(next.date) : 0;
  const cd = next ? countdownParts(kickoff, now) : null;
  const stats = p?.stats;
  const blank = !stats || (!stats.goals && !stats.assists && !stats.matchesPlayed);

  return (
    <section className="hm-hero" aria-label="Portada">
      {live && (
        <div className="hm-live" role="status">
          <span className="on">
            <i />
            EN DIRECTO
          </span>
          <b>
            PITI {live.goalsFor ?? 0} – {live.goalsAgainst ?? 0} {(live.rival ?? "RIVAL").toUpperCase()}
          </b>
          <Link to="/matches/$matchId" params={{ matchId: live.id }}>
            Seguir el partido →
          </Link>
        </div>
      )}
      <div className="hm-in">
        <div className="hm-intro hm-rise">
          <span className="k">{narrative.kick}</span>
          <h1>
            MANCHESTER <em>PITI</em>
          </h1>
          <p className="hm-narr" aria-live="polite">
            {narrative.head} <em>{narrative.em}</em>
          </p>
          <div className="hm-next">
            <div>
              <span className="k">{next ? (next.competition || "Próximo partido") : "Partido inaugural"}</span>
              <b>{next ? `Piti vs ${next.rival ?? "rival"}` : "Fecha por confirmar"}</b>
            </div>
            <span className="k" style={{ textAlign: "right" }}>
              {next ? kickoffLabel(next.date) : seasonName}
            </span>
            <div
              className={`hm-cd${cd ? "" : " ph"}`}
              role="timer"
              aria-label={cd ? `Faltan ${cd.d} días, ${cd.h} horas y ${cd.m} minutos` : "La cuenta atrás empieza cuando se publique la fecha"}
            >
              <span>
                <b>{cd?.d ?? 0}</b>días
              </span>
              <span>
                <b>{cd?.h ?? 0}</b>horas
              </span>
              <span>
                <b>{cd?.m ?? 0}</b>min
              </span>
            </div>
            <div className="acts">
              {next && <AddToCalendar className="hm-mini sky" label="Añadir este partido" event={matchEvent(next, location.origin)} />}
              <AddToCalendar className="hm-mini" iconName="cal" label="Suscribirme al calendario" feed={`${location.origin}/calendario.ics`} />
            </div>
          </div>
        </div>

        <div className="hm-poster">
          <div className="num" aria-hidden="true">
            {p?.num}
          </div>
          {p && (
            <Jersey3D
              ref={shirt}
              className="hm-shirt3d"
              kit={kit}
              theme={theme}
              name={p.name.toUpperCase()}
              num={p.num}
              zoom={0.86}
              lift={0.28}
              label={`Camiseta de ${p.name}, dorsal ${p.num}, ${kit === "home" ? "1ª" : "2ª"} equipación. Arrástrala o usa las flechas para girarla.`}
            />
          )}
          <button type="button" className="hm-nav l" onClick={() => step(-1)} aria-label="Jugador anterior">
            <Icon name="left" size={20} stroke={2.2} />
          </button>
          <button type="button" className="hm-nav r" onClick={() => step(1)} aria-label="Jugador siguiente">
            <Icon name="right" size={20} stroke={2.2} />
          </button>
          <div className="hm-kit" role="group" aria-label="Equipación">
            <button type="button" aria-pressed={kit === "home"} onClick={() => onKit("home")}>
              1ª
            </button>
            <button type="button" aria-pressed={kit === "away"} onClick={() => onKit("away")}>
              2ª
            </button>
          </div>
          <button type="button" className="hm-turn" onClick={() => shirt.current?.turn()}>
            <Icon name="turn" size={14} />
            Gírala
          </button>
        </div>

        {p && (
          <div className="hm-player" aria-live="polite">
            <span className="pos">
              Dorsal {p.num} · {seasonName}
            </span>
            <h2>{p.name}</h2>
            <div className={`hm-nums${blank ? " ph" : ""}`}>
              <div>
                <b>{stats.goals}</b>
                <span>goles</span>
              </div>
              <div>
                <b>{stats.assists}</b>
                <span>asistencias</span>
              </div>
              <div>
                <b>{stats.matchesPlayed}</b>
                <span>partidos</span>
              </div>
            </div>
            <p className="hm-moment">{moment}</p>
            <div className="hm-row hm-acts">
              <Link className="hm-link" to="/jugadores/$playerId" params={{ playerId: p.id }}>
                Ver su ficha <Icon name="arrow" size={15} stroke={2.2} />
              </Link>
              <button type="button" className="hm-mini" onClick={shuffle}>
                <Icon name="shuffle" size={15} stroke={2.2} />
                Sorpréndeme
              </button>
              <button type="button" className="hm-mini" onClick={() => void shareClubPage("jugador", p.id, `${p.name} · Manchester Piti`).catch(() => {})}>
                <Icon name="share" size={15} stroke={2.2} />
                Compartir
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="hm-rail-wrap">
        <div className="hm-rail-head">
          <span>
            La plantilla · {n} jugadores<span className="kbd"> · usa ← →</span>
          </span>
          <span className="swipe" aria-hidden="true">
            Desliza →
          </span>
        </div>
        <div className="hm-rail" role="group" aria-label="Elige jugador" ref={rail} onKeyDown={onRailKey}>
          {squad.map((q, i) => (
            <button key={q.id} type="button" className={`hm-chip${i === sel ? " on" : ""}`} aria-pressed={i === sel} tabIndex={i === sel ? 0 : -1} onClick={() => onSelect(i)}>
              <b>{q.num}</b>
              <span>{q.name}</span>
              {(q.stats.goals > 0 || q.stats.assists > 0) && (
                <span className="g">
                  {q.stats.goals}G · {q.stats.assists}A
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
