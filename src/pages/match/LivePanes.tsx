// The live panes of the match page (canvas «Lo que ve la afición»): Directo as a rail of plays with its
// filters and halves, the Campo under floodlights with stickers, the pulse track with «Quién suma», and the
// side column's «El partido en números» and «Los siete y sus minutos». All from the match's events
// (directoModel / ficha), told by eventMeta.
import { useMemo, useState } from "react";
import type { ClubMatch } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";
import { clockReading } from "../../../functions/src/matchClock";
import { EVENT_FILTERS, type EventFilter } from "../../lib/eventMeta";
import { liveCounts, matchNumbers, matchSnapshot } from "../../lib/ficha";
import { scoreOf } from "../../lib/partidos";
import { nameSegments } from "../../lib/derived/names";
import { wholeMinutes } from "../../lib/derived/minutes";
import { isGuestId } from "../../lib/derived/guests";
import { campoLayout } from "./campoPositions";
import { currentHalf, feedOf, filterCounts, halvesOf, pulseTrack, rivalTag, stickerWords, sumLine, type FeedItem } from "./directoModel";
import { GloveIcon, PlayNode, Shirt, ShirtDefs, StickerKey, Stickers } from "./livePieces";
import { useNumOf } from "./useNumOf";
import { Who } from "./Who";

type NameOf = (id: string) => string;

const madridTime = (ms: number) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(ms);

/** A title with each of ours it names as a quiet link to his page. */
function Linked({ text, people, nameOf, seasonId }: { text: string; people: string[]; nameOf: NameOf; seasonId?: string }) {
  const segs = nameSegments(text, people.map((id) => ({ id, name: nameOf(id) })));
  return (
    <>
      {segs.map((s, i) =>
        s.id && !isGuestId(s.id) ? (
          <Who key={i} id={s.id} seasonId={seasonId}>
            {s.text}
          </Who>
        ) : (
          s.text
        ),
      )}
    </>
  );
}

/** The Directo: «Lo que va pasando», the filters with their counts, and the plays by half on a rail. */
export function DirectoFeed({ match, nameOf, live, now, freshId = null }: { match: ClubMatch; nameOf: NameOf; live: boolean; now: number; freshId?: string | null }) {
  const [filter, setFilter] = useState<EventFilter>("all");
  const items = useMemo(() => feedOf(match, nameOf), [match, nameOf]);
  const counts = filterCounts(items);
  const halves = halvesOf(items, filter, live ? currentHalf(match, now) : null);
  const tag = rivalTag(match);
  const latest = items[0];
  const kickoff = match.clock?.firstStartedAt;
  return (
    <section className="fc-sec" aria-labelledby="fc-live">
      <span className="ml-sub">{live ? "Desde la mesa, se actualiza solo" : "Registro provisional, pendiente de publicar el acta"}</span>
      <h2 className="hm-h2 ml-h2" id="fc-live">
        Lo que va pasando
      </h2>
      {items.length ? (
        <>
          <div className="ml-fs">
            <div className="ml-seg" role="group" aria-label="Filtrar jugadas">
              {EVENT_FILTERS.map((f) => (
                <button key={f.id} type="button" className="ml-sg" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label}
                  <span className="n">
                    <span className="sr-only">: </span>
                    {counts[f.id]}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {/* (no live region: the card's strap already says each new play, once) */}
          {halves.map((h) => (
            <div key={h.half}>
              <p className="ml-half">
                <b>{h.label}</b>
                {h.meta}
              </p>
              <ol className="ml-list" key={filter}>
                {h.items.map((it: FeedItem, i) => (
                  <li key={it.id} className={`ml-ev${it.tone ? ` ${it.tone}` : ""}${it.id === freshId ? " fresh" : ""}`} style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
                    {it.id === freshId && <span className="fl" aria-hidden="true" />}
                    <span className="m">{it.minute}</span>
                    <PlayNode meta={it.meta} tone={it.tone} />
                    <span className="tx">
                      <b>
                        <Linked text={it.title} people={it.people} nameOf={nameOf} seasonId={match.seasonId} />
                      </b>
                      {it.sub && (
                        <small>
                          <Linked text={it.sub} people={it.people} nameOf={nameOf} seasonId={match.seasonId} />
                        </small>
                      )}
                    </span>
                    <span>
                      {live && it.id === latest?.id && it.meta.goal === "for" ? <span className="ml-tg">Ahora</span> : it.tone === "them" ? <span className="ml-rt" title={match.rival ?? "Rival"}>{tag}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {typeof kickoff === "number" && filter === "all" && (
            <p className="ml-end">
              <span />
              <i aria-hidden="true" />
              <span>Pitido inicial a las {madridTime(kickoff)}</span>
            </p>
          )}
        </>
      ) : (
        <p className="fc-note ml-empty">Aún no hay nada apuntado. Cada gol, ocasión, falta, tarjeta o cambio sale aquí en cuanto la mesa lo apunta.</p>
      )}
    </section>
  );
}

/** «El partido en números»: mirrored bars, Piti left and the rival right, and the keeper's saves. */
export function NumbersPanel({ match, nameOf, className = "", live = true }: { match: ClubMatch; nameOf: NameOf; className?: string; live?: boolean }) {
  const { rows, saves } = matchNumbers(match.events, scoreOf(match));
  const rival = match.rival ?? "Rival";
  const short = rival.split(/\s+/)[0] ?? rival;
  return (
    <section className={`ml-panel ${className}`.trim()} aria-label="El partido en números">
      <span className="ml-sub">{live ? "En directo, desde la mesa" : "Desde el acta"}</span>
      <h3>El partido en números</h3>
      <p className="ml-legend" aria-hidden="true">
        <span>Piti</span>
        <span>{short}</span>
      </p>
      {rows.map((r, i) => {
        const mx = Math.max(r.us, r.them, 1);
        return (
          <div className="ml-dr" key={r.label} role="group" aria-label={`${r.label}: Piti ${r.us}, ${rival} ${r.them}`}>
            <b aria-hidden="true">{r.us}</b>
            <div className="c" aria-hidden="true">
              <span>{r.label}</span>
              <div className="ml-mir">
                <span className="ml-gr l">
                  <i style={{ width: `${Math.round((r.us / mx) * 100)}%`, animationDelay: `${250 + i * 110}ms` }} />
                </span>
                <span className="ml-gr r">
                  <i style={{ width: `${Math.round((r.them / mx) * 100)}%`, animationDelay: `${250 + i * 110}ms` }} />
                </span>
              </div>
            </div>
            <b className="th" aria-hidden="true">
              {r.them}
            </b>
          </div>
        );
      })}
      {saves.map((s) => (
        <p className="ml-sv" key={s.id}>
          <span className="ic">
            <GloveIcon />
          </span>
          <span>Paradas de {nameOf(s.id)}</span>
          <b>{s.count}</b>
        </p>
      ))}
    </section>
  );
}

/** «Los siete y sus minutos»: who is on the pitch now, with stickers and minutes. */
export function SevenPanel({ match, players, nameOf, now }: { match: ClubMatch; players: PlayerDoc[]; nameOf: NameOf; now: number }) {
  const numOf = useNumOf(players, match.seasonId);
  const snap = matchSnapshot(match, now);
  const field = snap.field.filter((id): id is string => !!id);
  const elapsed = match.clock ? clockReading(match.clock, now).elapsedSeconds / 60 : null;
  return (
    <section className="ml-panel" aria-label="Los siete y sus minutos">
      <span className="ml-sub">Ahora en el campo</span>
      <h3>Los siete y sus minutos</h3>
      <ul className="ml-who">
        {field.map((id, i) => {
          const c = liveCounts(id, match.events);
          const p = snap.players[id];
          const entered = p?.exchanges.find((x) => x.direction === "in");
          const fresh = !!entered && elapsed !== null && elapsed - entered.minute < 2;
          const words = stickerWords(c);
          return (
            <li key={id} className={`ml-wr${fresh ? " in" : ""}`} aria-label={`${nameOf(id)}, ${wholeMinutes(p?.minutes ?? 0)} minutos${words ? `, ${words}` : ""}${fresh ? ", acaba de entrar" : ""}`}>
              <Shirt n={isGuestId(id) ? "Inv" : numOf(id)} keeper={i === 0} kind="mini" />
              <span className="nmw" aria-hidden="true">
                {nameOf(id)}
              </span>
              <span className="sk" aria-hidden="true">
                <Stickers c={c} />
                {fresh && <span className="nw">acaba de entrar</span>}
              </span>
              <em aria-hidden="true">{wholeMinutes(p?.minutes ?? 0)}′</em>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The side column (desktop): the numbers and the seven. */
export function LiveSide({ match, players, nameOf, now }: { match: ClubMatch; players: PlayerDoc[]; nameOf: NameOf; now: number }) {
  return (
    <aside className="ml-side" aria-label="El partido en números y los siete">
      <NumbersPanel match={match} nameOf={nameOf} />
      <SevenPanel match={match} players={players} nameOf={nameOf} now={now} />
    </aside>
  );
}

/** The Campo, live: the seven on floodlit turf (the keeper in navy and gold), their minutes and stickers,
 *  and the bench below the touchline. `freshScorer` pops his ball while a goal is shown. */
export function LiveCampo({ match, players, nameOf, now, freshScorer = null }: { match: ClubMatch; players: PlayerDoc[]; nameOf: NameOf; now: number; freshScorer?: string | null }) {
  const numOf = useNumOf(players, match.seasonId);
  const snap = matchSnapshot(match, now);
  const field = snap.field.filter((id): id is string => !!id);
  const keeper = snap.field[0] ?? null;
  const layout = campoLayout({ field, ledger: null, system: null, codes: null });
  const bench = [...(match.starters ?? []), ...(match.bench ?? [])].filter((id) => !field.includes(id));
  const unused = bench.filter((id) => !snap.players[id]?.played).length;
  const minuteNow = match.clock ? Math.floor(clockReading(match.clock, now).elapsedSeconds / 60) + 1 : null;
  if (!field.length)
    return (
      <section className="fc-sec">
        <h2 className="hm-h2">El campo, ahora</h2>
        <p className="fc-note">La convocatoria se publica con el acta.</p>
      </section>
    );
  return (
    <section className="fc-sec" aria-labelledby="fc-xi">
      <span className="ml-sub">{minuteNow ? `Ahora mismo, minuto ${minuteNow}` : "Ahora mismo"}</span>
      <h2 className="hm-h2 ml-h2" id="fc-xi">
        Así están en el campo
      </h2>
      <div className="ml-pitch">
        <span className="ml-cl box" />
        <span className="ml-cl circ" />
        <span className="ml-cl area" />
        <span className="ml-spot" />
        <span className="ml-net" />
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {layout.dots.map((d) => {
            const c = liveCounts(d.id, match.events);
            const mins = wholeMinutes(snap.players[d.id]?.minutes ?? 0);
            const words = stickerWords(c);
            const n = isGuestId(d.id) ? "Inv" : numOf(d.id);
            return (
              <li key={d.id} className="ml-tok" style={{ left: `${d.x}%`, top: `${d.y}%` }} aria-label={`${nameOf(d.id)}${n ? `, dorsal ${n}` : ""}${d.id === keeper ? ", portero" : ""}, ${mins} minutos${words ? `, ${words}` : ""}`}>
                <Shirt n={n} keeper={d.id === keeper}>
                  <span className="ml-stk">
                    <Stickers c={c} pop={freshScorer === d.id} />
                  </span>
                </Shirt>
                <span className="ml-tag" aria-hidden="true">
                  <span className="ml-nm">{nameOf(d.id)}</span>
                  <span className="ml-mn">{mins}′</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="ml-dug">
        <p className="ml-dhead" style={{ margin: 0 }}>
          <b>Banquillo</b>
          {unused > 0 && <em>{unused} sin jugar</em>}
        </p>
        {bench.length ? (
          <ul className="ml-row">
            {bench.map((id) => {
              const p = snap.players[id];
              const rest = p?.dismissed ? "expulsado" : p?.played ? `jugó ${wholeMinutes(p.minutes)}′` : "sin jugar";
              return (
                <li key={id} className="ml-bt" aria-label={`${nameOf(id)}, ${rest}`}>
                  <Shirt n={isGuestId(id) ? "Inv" : numOf(id)} kind="bench" />
                  <span className="ml-nm" aria-hidden="true">
                    {nameOf(id)}
                  </span>
                  <span className={`ml-mn${p?.played ? "" : " z"}`} aria-hidden="true">
                    {rest}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="fc-note" style={{ margin: "0 12px" }}>
            Sin suplentes en la convocatoria.
          </p>
        )}
      </div>
      <StickerKey />
      <p className="fc-note">Posiciones orientativas. Los cambios y las expulsiones actualizan el campo; los minutos son provisionales hasta publicar el acta.</p>
    </section>
  );
}

/** Pulso: the numbers (a phone; the desktop has them in the side column), the pulse track — up the Piti,
 *  down the rival, a ball on each goal — and «Quién suma». */
export function PulsoLive({ match, players, nameOf, live, now }: { match: ClubMatch; players: PlayerDoc[]; nameOf: NameOf; live: boolean; now: number }) {
  const numOf = useNumOf(players, match.seasonId);
  const duration = match.duration ?? 50;
  const items = feedOf(match, nameOf);
  const { ticks, labels } = pulseTrack(items, duration);
  const rival = match.rival ?? "Rival";
  const short = rival.split(/\s+/)[0] ?? rival;
  const cur = live && match.clock ? Math.min(100, (clockReading(match.clock, now).elapsedSeconds / (duration * 60)) * 100) : null;
  const people = [...new Set([...(match.starters ?? []), ...(match.bench ?? [])])];
  const sums = people.map((id) => ({ id, line: sumLine(id, match.events) })).filter((s) => s.line);
  return (
    <>
      <NumbersPanel match={match} nameOf={nameOf} className="ml-pulso-numbers" live={live} />
      <section className="fc-sec" aria-labelledby="fc-pu">
        <span className="ml-sub">Minuto a minuto, arriba el Piti y abajo {short}</span>
        <h2 className="hm-h2 ml-h2" id="fc-pu">
          El pulso
        </h2>
        <div className="ml-glass">
          <div className="ml-trk" role="img" aria-label={`Jugadas por minuto: arriba el Piti, abajo ${rival}. ${ticks.filter((t) => t.side === "us").length} del Piti y ${ticks.filter((t) => t.side === "them").length} de ${rival}.`}>
            <span className="sd" style={{ top: 0 }}>
              Piti
            </span>
            <span className="sd r" style={{ top: 112 }}>
              {short}
            </span>
            <span className="ax" />
            {ticks.map((k, i) => (
              <span key={k.id} className={`tk ${k.side}${k.goal ? " gl" : ""}`} style={{ left: `${k.x}%`, height: `${k.h}px`, animationDelay: `${60 + i * 30}ms` }} />
            ))}
            {ticks
              .filter((k) => k.goal)
              .map((k) => (
                <span key={`b${k.id}`} className={`bl${k.side === "them" ? " them" : ""}`} style={{ left: `${k.x}%`, top: k.side === "them" ? 120 : 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0c1733" strokeWidth="2.6" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7l4 3-1.5 5h-5L8 10z" />
                  </svg>
                </span>
              ))}
            {cur !== null && <span className="cur" style={{ left: `${cur}%` }} />}
            <div className="ticks" aria-hidden="true">
              {labels.map((m) => (
                <span key={m}>{m}′</span>
              ))}
            </div>
          </div>
        </div>
        {sums.length > 0 && (
          <>
            <p className="ml-half">
              <b>Quién suma</b>según lo que apunta la mesa
            </p>
            <ul className="ml-qs">
              {sums.map((s) => (
                <li className="ml-qr" key={s.id}>
                  <Shirt n={isGuestId(s.id) ? "Inv" : numOf(s.id)} kind="mini" />
                  <span className="q">
                    <b>
                      <Who id={s.id} seasonId={match.seasonId}>
                        {nameOf(s.id)}
                      </Who>
                    </b>
                    <span>{s.line}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="fc-note">Cada marca es una jugada apuntada: goles, ocasiones, palos, paradas, faltas, tarjetas, córners y cambios. No mide la posesión{live ? " y se llena durante el partido" : ""}.</p>
      </section>
    </>
  );
}

export { ShirtDefs };
