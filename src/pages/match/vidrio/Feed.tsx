// The match page's play-by-play as a two-sided feed (V-Vivo «La página del partido, con mucho partido»): ours on
// the left (aligned to the middle), the rival's on the right, the minute in a pill down the centre (gold for
// our goals), the newest first; eight in the summary and «N jugadas más · Ver todo el partido» growing into
// «Todo el partido» with its filters (Todo · Goles · Tarjetas · Cambios) and «Cerrar».
import { useState, type CSSProperties } from "react";
import { GrowWindow, SeeAll, useGrow } from "../../../components/vidrio";
import type { ClubMatch } from "../../../lib/clubData";
import { filterPlays, playsLog, PLAY_FILTERS, type PlayFilter, type PlayRow } from "../../../lib/derived/vidrio/plays";

const SHOWN = 8;

function FeedRow({ r, fresh }: { r: PlayRow; fresh: boolean }) {
  // (a goal sits with whom it counts for: their own goal is ours, ours in our own net theirs)
  const side = r.goal ? (r.goal === "for" ? "us" : "them") : r.side === "us" ? "us" : r.side === "them" ? "them" : "mid";
  const gold = r.goal === "for";
  const words = (
    <>
      <b>{r.title}</b>
      {r.sub && <span>{r.sub}</span>}
    </>
  );
  return (
    <li className={`mp-frow mp-frow--${side}${r.kind === "otro" ? " is-minor" : ""}${fresh ? " is-fresh" : ""}`}>
      <div className="mp-frow__us">{side === "us" && words}</div>
      <span className={`mp-frow__min${gold ? " is-gold" : ""}`}>
        {r.minuteText || "·"}
        {gold && <span className="vd-vh">, gol nuestro</span>}
      </span>
      <div className="mp-frow__them">{side !== "us" && words}</div>
    </li>
  );
}

export function Feed({ match, nameOf, live, freshId = null }: { match: ClubMatch; nameOf: (id: string) => string; live: boolean; freshId?: string | null }) {
  const g = useGrow("mp-feed");
  const [pf, setPf] = useState<PlayFilter>("todo");
  const rival = match.rival ?? "el rival";
  const log = playsLog(match, nameOf, rival);
  if (!log.rows.length)
    return <p className="mp-feed__none">{live ? "Aún no ha pasado nada: la primera jugada de la mesa entra aquí." : "La mesa no apuntó jugadas de este partido."}</p>;
  const shown = log.rows.slice(0, SHOWN);
  const more = log.rows.length - shown.length;
  const all = filterPlays(log.rows, pf);
  const seg = PLAY_FILTERS.findIndex((f) => f.id === pf);
  return (
    <>
      <div className={`mp-feed__sum ${g.summaryProps.className}`} style={g.summaryProps.style}>
        <ol className="mp-feed" aria-label={`Jugada a jugada: las del Piti a la izquierda, las de ${rival} a la derecha`} aria-live={live ? "polite" : undefined}>
          {shown.map((r) => (
            <FeedRow key={r.id} r={r} fresh={r.id === freshId} />
          ))}
        </ol>
        <SeeAll
          summary={
            <>
              <b>{more === 1 ? "1 jugada más" : `${more} jugadas más`}</b> desde el pitido
            </>
          }
          count={more}
          label="Ver todo el partido"
          onOpen={() => {
            setPf("todo");
            g.grow();
          }}
        />
      </div>
      <GrowWindow
        open={g.open}
        title="Todo el partido"
        sub={`${log.rows.length} jugadas. Las nuestras a la izquierda, las de ${rival} a la derecha; la más reciente arriba.`}
        filters={
          <div className="vd-glass vd-seg mp-pfilt" role="group" aria-label="Qué jugadas" style={{ "--n": 4, "--i": seg } as CSSProperties}>
            <span className="vd-shelf__bead" aria-hidden="true" />
            {PLAY_FILTERS.map((f) => (
              <button key={f.id} type="button" className="vd-seg__b" aria-pressed={pf === f.id} onClick={() => setPf(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        }
        onClose={g.close}
        className="mp-grow"
        {...g.windowProps}
      >
        {all.length ? (
          <ol className="mp-feed">
            {all.map((r) => (
              <FeedRow key={r.id} r={r} fresh={false} />
            ))}
          </ol>
        ) : (
          <p className="mp-feed__none">Nada de eso en este partido.</p>
        )}
      </GrowWindow>
    </>
  );
}
