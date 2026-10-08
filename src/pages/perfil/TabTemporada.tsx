// /profile › «Temporada»: Tus números → Gol a gol (+ the last five results) → Tu socio en el campo →
// Tus cosas en el vestuario (the next convocatoria, your boards, your porra, your answers). Real data,
// empty states as designed (pf-g.mjs pTemp).
import { useNavigate } from "@tanstack/react-router";
import type { MouseEvent, ReactNode } from "react";
import type { CardView } from "./card";
import { vars } from "./fx";
import { Ic, type PIcon } from "./icons";
import { firstMatchText, jornadaRange, longDay, type StuffLine } from "./lines";

/** The goal bars keep a readable width on a phone: the last 10 jornadas at most. */
export const GB_MAX = 10;

/** An in-app link to a built href (the board's ?tablero= link): the router navigates, a modified click opens a tab. */
function HrefLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  const navigate = useNavigate();
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    void navigate({ href });
  };
  return (
    <a className={className} href={href} onClick={go}>
      {children}
    </a>
  );
}

const STUFF_ICON: Record<StuffLine["key"], PIcon> = { call: "cal", boards: "board", porra: "target", conv: "vote" };

export function TabTemporada({ card, seasonName, stuff, stuffLoading, onGoPick }: { card: CardView; seasonName: string; stuff: StuffLine[]; stuffLoading: boolean; onGoPick: () => void }) {
  const vinc = card.state === "vinculada";
  const t = card.totals;
  const bars = card.series.slice(-GB_MAX);
  const range = jornadaRange(card.series);
  const first = card.first;
  return (
    <>
      {!vinc && (
        <div className="bk">
          <h3 className="bk-h">Tus números</h3>
          <p className="note">
            <Ic n="shirt" w={18} />
            <span>
              {card.state === "pendiente"
                ? "En cuanto el capitán confirme tu carta, aquí salen tus goles, asistencias, minutos y tu socio en el campo."
                : "Reclama tu ficha y aquí salen tus goles, asistencias, minutos y tu socio en el campo."}
            </span>
          </p>
          {card.state === "sin-ficha" && (
            <button type="button" className="btn gold" onClick={onGoPick}>
              <Ic n="shirt" w={18} />
              Reclamar mi ficha
            </button>
          )}
        </div>
      )}
      {vinc && (
        <>
          <div className="bk">
            <h3 className="bk-h">Tus números</h3>
            <p className="bk-d">{card.started ? `${seasonName}, ${range}: lo mismo que ve el vestuario en tu cartel.` : `La ${seasonName} aún no ha empezado: todo a cero.`}</p>
            <div className={"sb" + (card.started ? "" : " dim")}>
              <div className="hero">
                <b>{t.goals}</b>
                <span>Goles</span>
              </div>
              <div>
                <b>{t.assists}</b>
                <span>Asistencias</span>
              </div>
              <div>
                <b>{t.mvps}</b>
                <span>MVP</span>
              </div>
              <div>
                <b>{t.minutes}</b>
                <span>Minutos</span>
              </div>
              <div>
                <b>{t.played}</b>
                <span>Partidos</span>
              </div>
            </div>
            <p className="rk">
              <Ic n="trophy" w={16} />
              <span>{card.started ? card.rankText || "Aún sin minutos esta temporada" : `El marcador se enciende ${firstMatchText(card)}`}</span>
            </p>
          </div>
          <div className="bk">
            <h3 className="bk-h">Gol a gol</h3>
            <p className="bk-d">Tus goles en cada jornada y cómo acabaron los últimos cinco partidos.</p>
            {card.started ? (
              <>
                <div className="gb" role="img" aria-label={"Goles por jornada: " + card.series.map((x) => `${x.label} ${x.goals}`).join(", ")} style={{ gridTemplateColumns: `repeat(${Math.max(1, bars.length)},minmax(0,1fr))` }}>
                  {bars.map((g) => (
                    <span key={g.j}>
                      <i style={vars({ "--p": g.p.toFixed(2) })} />
                      <b>{g.goals}</b>
                      <small>{g.label}</small>
                    </span>
                  ))}
                </div>
                <ol className="fm" aria-label="Últimos cinco resultados">
                  {card.last5.map((f) => (
                    <li key={f.j}>
                      <span className={"res " + f.r} role="img" aria-label={f.aria}>
                        {f.l}
                      </span>
                      <small>{f.j}</small>
                    </li>
                  ))}
                </ol>
                <p className="legend">G victoria · E empate · P derrota</p>
              </>
            ) : (
              <p className="note">
                <Ic n="cal" w={18} />
                <span>
                  {first ? (
                    <>
                      Sin partidos todavía. Todo empieza el <b>{longDay(first.dateMs)}</b> contra <b>{first.rival}</b>.
                    </>
                  ) : (
                    "Sin partidos todavía. Todo empieza con el primer partido de la temporada."
                  )}
                </span>
              </p>
            )}
          </div>
          <div className="bk">
            <h3 className="bk-h">Tu socio en el campo</h3>
            <p className="bk-d">El compañero con el que más goles has combinado.</p>
            <div className="duo">
              <span className="n me">{card.number || "?"}</span>
              <span className="n">{card.partner ? card.partner.number || "?" : "?"}</span>
              <span className="t">
                <b>{card.partner ? [card.partner.name, card.partner.number].filter(Boolean).join(" · ") : "Por decidir"}</b>
                {card.partner ? card.partner.note : "Tu socio en el campo sale con los primeros goles."}
              </span>
            </div>
          </div>
        </>
      )}
      <div className="bk">
        <h3 className="bk-h">Tus cosas en el vestuario</h3>
        <p className="bk-d">Lo tuyo en la pizarra, la porra y las convocatorias.</p>
        <ul className="lks" aria-busy={stuffLoading || undefined}>
          {stuff.map((l) => (
            <li key={l.key}>
              <HrefLink className={"lk" + (l.call ? " call" : "")} href={l.href}>
                <span className="lk-ic">
                  <Ic n={STUFF_ICON[l.key]} w={20} />
                </span>
                <span className="lk-t">
                  <b>{l.title}</b>
                  <small>{stuffLoading && l.key !== "call" ? "Cargando…" : l.text}</small>
                </span>
                <Ic n="right" />
              </HrefLink>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
