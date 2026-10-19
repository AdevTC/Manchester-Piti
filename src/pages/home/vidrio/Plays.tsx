// Jugada a jugada: the ornament with the latest plays (a few rows, «N jugadas más · Ver todo el partido») and
// the window it grows into (every play by half, with the filters Todo · Goles · Tarjetas · Cambios and
// «Cerrar»). The rows are playsLog's (derived/vidrio/plays): the site's own sentences, newest first.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { GrowWindow, SeeAll, Shelf, type Grow } from "../../../components/vidrio";
import { filterPlays, playHalves, PLAY_FILTERS, type PlayFilter, type PlayRow, type PlaysLog } from "../../../lib/derived/vidrio/plays";
import { Ico, type IconId } from "./icons";

const GLYPH: Record<string, IconId> = { ball: "ball", palo: "post", ocasion: "pass", parada: "glove", faltaH: "whistle", faltaR: "whistle", cambio: "swap", corner: "flag", offside: "flag", penalti: "whistle", tocado: "whistle", accion: "pass" };

export function PlayItem({ r }: { r: PlayRow }) {
  return (
    <li className={`vd-play${r.ours ? "" : " vd-play--them"}`}>
      <span className="vd-clock">{r.minuteText || "·"}</span>
      <span className="vd-ico" aria-hidden="true">
        {r.card ? <i className={r.card === "r" ? "r" : undefined} /> : <Ico id={GLYPH[r.glyph] ?? "pass"} />}
      </span>
      <div>
        <b>{r.title}</b>
        {r.sub && <span>{r.sub}</span>}
      </div>
    </li>
  );
}

export interface PlaysOrnProps {
  title: string;
  sub: string;
  log: PlaysLog;
  grow: Grow;
  matchId: string;
  className?: string;
}

/** The summary: the newest rows (CSS shows 3 to 5 by width), the count of the rest and «Ver todo el partido». */
export function PlaysOrn({ title, sub, log, grow, matchId, className }: PlaysOrnProps) {
  const shown = log.rows.slice(0, 5);
  return (
    <section className={`vd-glass vd-glass--clear vd-orn vi-orn vi-plays ${grow.summaryProps.className}${className ? ` ${className}` : ""}`} style={grow.summaryProps.style} aria-label={title}>
      <div className="vd-orn__head">
        <h2>{title}</h2>
        <span>{sub}</span>
      </div>
      {shown.length ? (
        <ol className="vd-plays">
          {shown.map((r) => (
            <PlayItem key={r.id} r={r} />
          ))}
        </ol>
      ) : (
        <p className="vi-orn-p">Todavía no hay jugadas: la primera llega con el pitido.</p>
      )}
      <div className="vi-orn-foot" data-more={log.count > 5 ? 5 : log.count > 4 ? 4 : log.count > 3 ? 3 : 0}>
        {log.count > 3 && <SeeAll summary={plural(log.count)} count={log.count} label="Ver todo el partido" onOpen={grow.grow} />}
        <Link className="vd-link vi-openmatch" to="/matches/$matchId" params={{ matchId }}>
          Abrir el partido
        </Link>
      </div>
    </section>
  );
}

/** «2 jugadas más» for the rows not shown (the CSS shows 3, 4 or 5 rows by width: the words follow it). */
const moreText = (n: number) => (n <= 0 ? "Todas a la vista" : n === 1 ? "1 jugada más" : `${n} jugadas más`);
function plural(total: number) {
  return (
    <>
      <span className="vi-more-5">{moreText(total - 5)}</span>
      <span className="vi-more-4">{moreText(total - 4)}</span>
      <span className="vi-more-3">{moreText(total - 3)}</span>
    </>
  );
}

export interface PlaysGrowProps {
  log: PlaysLog;
  grow: Grow;
  sub: string;
  className?: string;
}

/** The grown window: every play, by half, with its filters. */
export function PlaysGrow({ log, grow, sub, className }: PlaysGrowProps) {
  const [filter, setFilter] = useState<PlayFilter>("todo");
  const rows = filterPlays(log.rows, filter);
  const halves = playHalves(rows);
  return (
    <GrowWindow
      open={grow.open}
      title="Jugada a jugada"
      sub={sub}
      onClose={grow.close}
      name={grow.windowProps.name}
      className={`vi-grow vi-grow--plays${className ? ` ${className}` : ""}`}
      filters={
        <Shelf
          variant="seg"
          className="vi-pfseg"
          label="Filtrar jugadas"
          idBase="vi-pf"
          value={filter}
          onChange={(id) => setFilter(id as PlayFilter)}
          places={PLAY_FILTERS.map((f) => ({ id: f.id, label: f.label }))}
        />
      }
    >
      <div id={`vi-pf-panel-${filter}`} role="tabpanel" aria-labelledby={`vi-pf-tab-${filter}`}>
        {halves.length ? (
          halves.map((h) => (
            <div key={h.label}>
              <p className="vd-grow__sec">
                {h.label}, {h.rows.length === 1 ? "1 jugada" : `${h.rows.length} jugadas`}
              </p>
              <ol className="vd-plays vi-grow-cols">
                {h.rows.map((r) => (
                  <PlayItem key={r.id} r={r} />
                ))}
              </ol>
            </div>
          ))
        ) : (
          <p className="vi-grow-empty">Nada de esto todavía en este partido.</p>
        )}
      </div>
    </GrowWindow>
  );
}
