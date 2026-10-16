// /profile › «Temporada»: Tus números → Dónde has jugado → Gol a gol (+ the last five results) → Tu socio en el campo →
// Tus cosas en el vestuario (the next convocatoria, your boards, your porra, your answers). Real data,
// empty states as designed (pf-g.mjs pTemp).
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { PosCode, PositionSet } from "../../lib/positions";
import type { PlayerPositions } from "../../lib/positionStats";
import type { CardView } from "./card";
import { DondeHasJugado } from "./DondeHasJugado";
import { vars } from "./fx";
import { Ic, type PIcon } from "./icons";
import { firstMatchText, jornadaRange, longDay, type StuffLine, type StuffLink } from "./lines";
import { RESULT_LEGEND } from "../../lib/derived/result";
import { CREST } from "./icons";
import { RecapStory } from "./RecapStory";
import type { RecapCtx, RecapOffer } from "./recapView";

/** The goal bars keep a readable width on a phone: the last 10 jornadas at most. */
export const GB_MAX = 10;

/** A line's link through the typed routes (the board's one carries ?tablero= and its season). */
function StuffLinkTo({ link, className, children }: { link: StuffLink; className: string; children: ReactNode }) {
  return link.to === "/pizarra" ? (
    <Link className={className} to="/pizarra" search={link.search}>
      {children}
    </Link>
  ) : (
    <Link className={className} to={link.to}>
      {children}
    </Link>
  );
}

const STUFF_ICON: Record<StuffLine["key"], PIcon> = { call: "cal", boards: "board", porra: "target", conv: "vote" };

/** «Dónde has jugado»: his minutes by position this season, what his ficha says, and the nudge (or null). */
export interface PlayedField {
  played: PlayerPositions;
  positions: PositionSet | null;
  nudge: PosCode | null;
  onGoPositions: () => void;
}

/** «Tu temporada en 10 cromos»: the recap on offer (linked members, when recapAvailable says so) and its story. */
export interface CromosField {
  offer: RecapOffer;
  ctx: RecapCtx;
  open: boolean;
  rm: boolean;
  onOpen: () => void;
  onClose: () => void;
}

function Cromos({ c }: { c: CromosField }) {
  const partial = c.offer.status === "partial";
  const r = c.offer.recap;
  const count = r.cards.length;
  return (
    <div className="bk" id="pe-cromos">
      <h3 className="bk-h">Tu temporada en 10 cromos</h3>
      <div className="rc-peek">
        <span className="rc-stack" aria-hidden="true">
          <i />
          <i />
          <i>
            <img src={CREST} alt="" />
          </i>
        </span>
        <span className="rc-peek-t">
          {partial && <span className="rc-tag">Hasta ahora</span>}
          <b>{r.seasonName}</b>
          <span>
            {partial
              ? `Tu temporada hasta ahora en ${count} cromos: se completa cuando acabe.`
              : `Tu temporada en ${count} cromos. Pásalos y comparte el que quieras.`}
          </span>
        </span>
      </div>
      <button type="button" id="rc-open" className="rc-open" onClick={c.onOpen} aria-haspopup="dialog">
        <Ic n="spark" w={18} />
        Ver mis cromos
      </button>
      {c.open && <RecapStory recap={r} ctx={c.ctx} rm={c.rm} onClose={c.onClose} returnFocusId="rc-open" />}
    </div>
  );
}

export function TabTemporada({ card, seasonId, seasonName, stuff, stuffLoading, onGoPick, played, cromos = null }: { card: CardView; seasonId: string; seasonName: string; stuff: StuffLine[]; stuffLoading: boolean; onGoPick: () => void; played: PlayedField | null; cromos?: CromosField | null }) {
  const vinc = card.state === "vinculada";
  // the season on the public pages it links to («all» or none adds no ?season=)
  const season = seasonId && seasonId !== "all" ? { season: seasonId } : {};
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
          {cromos && <Cromos c={cromos} />}
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
                <b>{t.minutes ?? "—"}</b>
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
            {/* (his public page: his numbers of the season, as the club sees them) */}
            {card.playerId && (
              <Link className="btn sm bk-go" to="/jugadores/$playerId" params={{ playerId: card.playerId }} search={season}>
                Ver tus estadísticas
                <Ic n="right" />
              </Link>
            )}
          </div>
          {played && <DondeHasJugado played={played.played} positions={played.positions} seasonId={seasonId} seasonName={seasonName} nudge={played.nudge} onGoPositions={played.onGoPositions} />}
          <div className="bk">
            <h3 className="bk-h">Gol a gol</h3>
            <p className="bk-d">Tus goles en cada jornada y cómo acabaron los últimos cinco partidos.</p>
            {card.started ? (
              <>
                <div className="gb" role="img" aria-label={"Goles por jornada: " + card.series.map((x) => `${x.label} ${x.goals}`).join(", ")} style={{ gridTemplateColumns: `repeat(${Math.max(1, bars.length)},minmax(0,1fr))` }}>
                  {bars.map((g) => (
                    <span key={g.id}>
                      <i style={vars({ "--p": g.p.toFixed(2) })} />
                      <b>{g.goals}</b>
                      <small>{g.label}</small>
                    </span>
                  ))}
                </div>
                <ol className="fm" aria-label="Últimos cinco resultados">
                  {card.last5.map((f) => (
                    <li key={f.id}>
                      <span className={"res " + f.r} role="img" aria-label={f.aria}>
                        {f.l}
                      </span>
                      <small>{f.j}</small>
                    </li>
                  ))}
                </ol>
                <p className="legend">{RESULT_LEGEND}</p>
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
              <StuffLinkTo className={"lk" + (l.call ? " call" : "")} link={l.link}>
                <span className="lk-ic">
                  <Ic n={STUFF_ICON[l.key]} w={20} />
                </span>
                <span className="lk-t">
                  <b>{l.title}</b>
                  <small>{stuffLoading && l.key !== "call" ? "Cargando…" : l.text}</small>
                </span>
                <Ic n="right" />
              </StuffLinkTo>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
