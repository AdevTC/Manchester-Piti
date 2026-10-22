// «El partido» · the Partido screen (P- boards, place-partido): the now. Before the whistle, the plan of the day
// (the day hour by hour, the place, the weather, the kit on the printed shirt); live, jugada a jugada with its
// filters and, beside it, «si acaba así», the goals by blocks, la mesa and the avisos; after, the acta (the
// crónica, the moments with the members' reactions, the MVP, the nota, the signature, logros, photos and what's
// next); aplazado and pendiente, what changes. The words and shapes are pure in partidoModel.ts.
import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { PageCtx } from "./ctx";
import type { Avisos } from "./avisos";
import { chapters, nearestPlay, autoCronica, type Play } from "./model";
import { longDay, shortWhen } from "./words";
import { Go, Icon, Tee, type IconName } from "./bits";
import { asiOf, atVenue, blocksTitle, dayPlan, firmaGoals, firmaOf, goalBlocks, halvesOf, headOf, icsWithDescription, meetTimeOf, mvpView, notifyLabel, offOf, rivalShort, sevenLine } from "./partidoModel";
import { madridTime } from "../../../lib/derived/madrid";
import { mesaOf } from "../../../lib/derived/mesa";
import { sunPosition } from "../../../lib/derived/sun";
import { mapsUrl, siteOrigin, venueName } from "../../../lib/derived/venue";
import { jornadaOf } from "../../../lib/derived/jornada";
import { matchLogros } from "../../../lib/derived/vidrio/matchLogros";
import { momentsFull, momentTally, nextMoments, notaLine, ratingSummary, reactionsOpen, whoReacted, type ReactionId } from "../../../lib/derived/trasElPartido";
import { dateMillis, type ClubMatch } from "../../../lib/clubData";
import { mvpWinners } from "../../../lib/vestuario";
import { useStandings } from "../../../lib/useStandings";
import { projectTable } from "../../../lib/derived/vidrio/table";
import { useMatchWeatherHourly } from "../../../lib/weather";
import { googleEventUrl, outlookEventUrl } from "../../../lib/calendarLinks";
import { downloadIcs, eventIcs } from "../../../lib/ics";
import { matchEvent } from "../../../lib/home";
import { useMatchRatings, useMatchReactions, useMeetingNote, useMvpResults } from "../../vestuario/live";
import { setReactions, useMe } from "../../vestuario/writes";
import { useVenuePlace, tilesAround } from "../../partidos/vidrio/venuePlace";
import "./partido.css";

type Filter = "todo" | "goles" | "tarjetas" | "cambios";
const FILTERS: [Filter, string][] = [
  ["todo", "Todo"],
  ["goles", "Goles"],
  ["tarjetas", "Tarjetas"],
  ["cambios", "Cambios"],
];
const KEEP: Record<Filter, ReadonlySet<Play["k"]> | null> = {
  todo: null,
  goles: new Set(["gol", "rival"]),
  tarjetas: new Set(["tarjeta", "roja", "tarjetaRival", "penalti"]),
  cambios: new Set(["cambio"]),
};
/** The reactions each kind of moment offers (the board's words; the stored ids of trasElPartido). */
const REACTS: Partial<Record<Play["k"], [ReactionId, string][]>> = {
  gol: [
    ["fuego", "Golazo"],
    ["aplauso", "Bien"],
  ],
  rival: [["uy", "Uy"]],
  parada: [
    ["aplauso", "Bien"],
    ["fuego", "Golazo"],
  ],
  palo: [
    ["uy", "Uy"],
    ["aplauso", "Bien"],
  ],
  penalti: [
    ["uy", "Uy"],
    ["aplauso", "Bien"],
  ],
};
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const MIN = 60_000;

export function ScreenPartido({ c, avisos }: { c: PageCtx; avisos: Avisos }) {
  const { match, fase: f } = c;
  const venue = venueName(match.venue ?? "");
  const mesa = mesaOf(match)?.name ?? null;
  const cancelled = match.status === "cancelled";
  const postponedRaw = (match as ClubMatch & { postponedTo?: unknown }).postponedTo;
  const postponedTo = typeof postponedRaw === "number" ? postponedRaw : null;
  const home = match.home !== false;
  const R = c.result;
  const head = headOf(f, { kick: c.kickMs, venue, rival: c.rival, home, result: R, mesa, cancelled, postponedTo });
  const isLiveSide = c.live || f === "final";

  return (
    <section className={`pp-place pp-place--partido ${[c.pre ? "is-pre" : "", isLiveSide ? "is-live" : "", c.done ? "is-done" : "", c.off ? "is-off" : ""].join(" ").trim()}`} aria-labelledby="pa-h">
      <header className="pp-place__head">
        <div>
          <h2 id="pa-h">{head.h}</h2>
          <p>{head.sub}</p>
        </div>
        {c.done && (
          <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm pa-headact" onClick={() => c.open("cartel")} aria-haspopup="dialog">
            <Icon name="share" />
            <span className="pa-l">Compartir el resultado</span>
            <span className="pa-s">Compartir</span>
          </button>
        )}
      </header>
      <div className="pp-place__body">
        {c.pre && <Plan c={c} venue={venue} mesa={mesa} home={home} />}
        {isLiveSide && <Live c={c} avisos={avisos} mesa={mesa} />}
        {c.done && <Acta c={c} venue={venue} />}
        {c.off && <Off c={c} avisos={avisos} cancelled={cancelled} postponedTo={postponedTo} />}
      </div>
    </section>
  );
}

// ---------- before: the plan of the day
function Plan({ c, venue, mesa, home }: { c: PageCtx; venue: string; mesa: string | null; home: boolean }) {
  const { match } = c;
  const member = c.viewer.member;
  const note = useMeetingNote(member ? match.id : undefined).data;
  const meet = meetTimeOf(note, c.kickMs);
  const plan = dayPlan({ kick: c.kickMs, duration: c.duration, member, meet, meetNote: note, mesa, whistle: c.fase === "pitido" });
  const capSlot = c.captain ? c.lineup.slots.find((s) => s.id === c.captain) : undefined;
  const seven = sevenLine({ published: c.lineup.published, system: c.lineup.system, captain: capSlot ? c.captain : null, captainName: c.captain ? c.nameOf(c.captain) : "", captainCode: capSlot?.code ?? null });
  const hourly = useMatchWeatherHourly(match, c.now);
  const place = useVenuePlace(venue || null);
  const district = place?.district ?? null;
  const where = home ? `En casa${district ? `, en ${district}` : ""}` : `Fuera, en casa de ${c.rival}${district ? `, en ${district}` : ""}`;
  const [calMenu, setCalMenu] = useState(false);
  const [calOn, setCalOn] = useState(false);
  const kit = c.kit;
  const player = c.viewer.playerId;
  const myNum = player ? c.numOf(player) : "";
  const other = kit === "away" ? "La 1ª, la celeste, se queda para casa." : "La 2ª, negra y roja, se queda para fuera.";
  const kitNote = player ? `La tuya${myNum ? `, con tu ${myNum} a la espalda` : ""}. ${other}` : other;

  // «Al calendario»: the match from the kick-off, the quedada in its notes for a member
  const quedada = member && Number.isFinite(c.kickMs) ? `Quedada a las ${madridTime(meet)}${note.trim() ? `: ${note.trim()}` : "."}` : "";
  const event = Number.isFinite(c.kickMs) ? { ...matchEvent(match, siteOrigin()), url: `${siteOrigin()}${c.base}`, details: quedada || undefined } : null;
  const added = (name: string) => {
    setCalOn(true);
    setCalMenu(false);
    c.say(`Añadido a ${name}${quedada ? ", con la quedada" : ""}.`);
  };
  const calOpts = event
    ? [
        { t: "Google Calendar", d: "Se abre con el evento ya relleno", pick: () => (window.open(googleEventUrl(event), "_blank", "noopener"), added("Google Calendar")) },
        {
          t: "Apple Calendar u otro",
          d: "iPhone, Mac o cualquier app (.ics)",
          pick: () => {
            downloadIcs(`${event.uid}.ics`, icsWithDescription(eventIcs({ uid: event.uid, start: event.start, end: event.end, summary: event.title, location: event.location, url: event.url }), quedada));
            added("Apple Calendar u otro");
          },
        },
        { t: "Outlook", d: "Outlook.com o Microsoft 365", pick: () => (window.open(outlookEventUrl(event), "_blank", "noopener"), added("Outlook")) },
      ]
    : [];

  // «El tiempo»: by hour around the kick-off, within the week the forecast reaches
  const hours = (hourly?.hours ?? []).map((w) => ({
    key: w.at,
    h: madridTime(w.at),
    t: `${w.temp}°`,
    icon: (w.sky === "sun" ? (sunPosition(w.at + 30 * MIN).elevation > 0 ? "sun" : "moon") : "cloud") as IconName,
    on: w.kickoff,
  }));
  const kickHour = hourly?.hours.find((w) => w.kickoff);
  const wSub = kickHour ? (kickHour.rain != null ? `${kickHour.rain} % de lluvia` : lc(kickHour.label)) + (hourly?.approx ? " (el de Madrid)" : "") : "";
  const wEmpty = Number.isFinite(c.kickMs) && c.kickMs - c.now < 7 * 86_400_000 ? "La previsión aún no ha llegado." : "La previsión por horas llega una semana antes.";
  const grid = place ? tilesAround(place.lat, place.lng) : null;

  return (
    <div className="pa-plan">
      {c.fase === "pitido" && (
        <p className="pa-banner">
          <span className="vd-livedot" aria-hidden="true" />
          La mesa está a punto de arrancar el reloj. Si hay retraso, aquí lo verás.
        </p>
      )}
      <section className="pa-day" aria-labelledby="pa-day-h">
        <h3 className="pa-k" id="pa-day-h">
          El día, hora a hora
        </h3>
        {plan.length ? (
          <ol className="pa-steps">
            {plan.map((s) => (
              <li key={s.t} className={`pa-step ${s.cls}`.trim()}>
                <b className="vd-clock pa-step__h">{s.h}</b>
                <div>
                  <p className="pa-step__t">{s.t}</p>
                  <p className="pa-step__d">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="pa-note">Sin fecha todavía: el plan sale en cuanto la liga ponga el día y la hora.</p>
        )}
        <p className="pa-seven">
          <Icon name="shirt" />
          <span>{seven ?? "El siete sale aquí en cuanto el capitán lo publique."}</span>
          <button type="button" className="vd-link" onClick={() => c.go("siete")}>
            Ver el siete
          </button>
        </p>
      </section>
      {venue && (
        <section className="pa-where" aria-labelledby="pa-where-h">
          <div className={`pa-map${grid ? " pa-map--real" : ""}`} role="img" aria-label={`Mapa: ${atVenue(venue).replace(/^en /, "")}${district ? `, en ${district}` : ""}`}>
            {grid ? (
              <span className="pa-map__tiles" style={{ left: `calc(50% - ${grid.px}px)`, top: `calc(50% - ${grid.py}px)` }} aria-hidden="true">
                {grid.tiles.map((t) => (
                  <img key={`${t.x}-${t.y}`} src={`https://tile.openstreetmap.org/15/${t.x}/${t.y}.png`} alt="" width={256} height={256} loading="lazy" decoding="async" style={{ left: t.left, top: t.top }} />
                ))}
              </span>
            ) : (
              <svg viewBox="0 0 320 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
                <path className="pa-map__road" d="M-10 102 C 60 90, 120 106, 180 80 S 290 50, 340 56" />
                <path className="pa-map__road pa-map__road--s" d="M40 -10 L 70 150 M150 -10 C 160 40, 140 90, 170 150 M250 -10 L 230 150" />
                <path className="pa-map__road pa-map__road--s" d="M-10 30 L 340 18" />
                <rect className="pa-map__pitch" x="176" y="36" width="62" height="38" rx="5" />
                <line className="pa-map__line" x1="207" y1="36" x2="207" y2="74" />
              </svg>
            )}
            <span className="pa-map__pin">
              <Icon name="pin" />
            </span>
            {grid && (
              <a className="pa-map__osm" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                © OpenStreetMap
              </a>
            )}
          </div>
          <h3 className="pa-where__t" id="pa-where-h">
            {venue}
          </h3>
          <p className="pa-where__d">{where}</p>
          <div className="pa-btns">
            <a className="vd-glass vd-press vd-btn vd-btn--sm" href={mapsUrl(venue)} target="_blank" rel="noopener noreferrer">
              <Icon name="pin" />
              Cómo llegar
            </a>
            {event && (
              <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={() => setCalMenu((v) => !v)} aria-expanded={calMenu} aria-controls="pa-calm">
                <Icon name={calOn ? "check" : "cal"} />
                {calOn ? "En tu calendario" : "Al calendario"}
              </button>
            )}
          </div>
          {calMenu && (
            <ul
              className="pa-calm"
              id="pa-calm"
              aria-label="Añadir al calendario"
              onKeyDown={(e) => {
                if (e.key === "Escape") setCalMenu(false);
              }}
            >
              {calOpts.map((o) => (
                <li key={o.t}>
                  <button type="button" className="pa-calm__b" onClick={o.pick}>
                    <b>{o.t}</b>
                    <span>{o.d}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <section className="pa-weather" aria-labelledby="pa-w-h">
        <h3 className="pa-k" id="pa-w-h">
          El tiempo {wSub && <span>{wSub}</span>}
        </h3>
        {hours.length ? (
          <ol className="pa-hours">
            {hours.map((w) => (
              <li key={w.key} className={w.on ? "is-on" : undefined}>
                <span className="vd-clock">{w.h}</span>
                <Icon name={w.icon} />
                <b>{w.t}</b>
                {w.on && <i>pitido</i>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="pa-note">{wEmpty}</p>
        )}
      </section>
      <section className="pa-kit" aria-labelledby="pa-kit-h">
        <Tee kit={kit} num={myNum || undefined} className="pa-kit__tee" />
        <div>
          <h3 className="pa-k" id="pa-kit-h">
            Se juega con la {kit === "away" ? "2ª" : "1ª"}
          </h3>
          <p className="pa-kit__t">{kit === "away" ? "Negra y roja" : "Celeste y pantalón marino"}</p>
          <p className="pa-note">{kitNote}</p>
        </div>
      </section>
    </div>
  );
}

// ---------- the goals in blocks of ten and by halves (live side and acta)
function Blocks({ c, id }: { c: PageCtx; id: string }) {
  const upto = c.played ? c.minute : 0;
  const blocks = goalBlocks(c.plays, upto, c.duration, c.rival);
  const parts = halvesOf(c.plays, upto, c.duration);
  return (
    <section className="pa-blocks" aria-labelledby={id}>
      <h3 className="pa-k" id={id}>
        {blocksTitle(upto, c.duration)}
      </h3>
      <ol className="pa-bl" style={blocks.length !== 5 ? { gridTemplateColumns: `repeat(${blocks.length},minmax(0,1fr))` } : undefined}>
        {blocks.map((b) => (
          <li key={b.lab} className={`pa-bl__c${b.later ? " is-later" : ""}`} role="img" aria-label={b.aria}>
            <span className="pa-bl__us" aria-hidden="true">
              <i style={{ height: `${b.usH}%` }} />
              <b>{b.us ? b.us : ""}</b>
            </span>
            <span className="pa-bl__them" aria-hidden="true">
              <i style={{ height: `${b.themH}%` }} />
              <b>{b.them ? b.them : ""}</b>
            </span>
            <span className="pa-bl__l" aria-hidden="true">
              {b.lab}
            </span>
          </li>
        ))}
      </ol>
      <p className="pa-bl__key" aria-hidden="true">
        <span className="pa-bl__ku">Piti, arriba</span>
        <span className="pa-bl__kt">{c.rival}, abajo</span>
      </p>
      <ul className="pa-parts">
        {parts.map((x) => (
          <li key={x.t}>
            <span>{x.t}</span>
            <b>{x.s}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- live: jugada a jugada and what surrounds it
function Live({ c, avisos, mesa }: { c: PageCtx; avisos: Avisos; mesa: string | null }) {
  const f = c.fase;
  const m = c.minute;
  const [fk, setFk] = useState<Filter>("todo");
  const [all, setAll] = useState(false);
  const chaps = useMemo(() => chapters(c.plays, c.nameOf), [c.plays, c.nameOf]);
  const keep = KEEP[fk];
  const played = chaps
    .filter((p) => p.m <= m)
    .reverse()
    .filter((p) => !keep || keep.has(p.k));
  let near = nearestPlay(c.plays, m);
  if (near && near.k === "cambio") near = { ...near, id: `c${near.m}` };
  const rest = played.length - 6;
  const fi = Math.max(0, FILTERS.findIndex((x) => x[0] === fk));
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (fi + d + FILTERS.length) % FILTERS.length;
    setFk(FILTERS[n][0]);
    (e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[n] ?? null)?.focus();
  };

  // «Si acaba así»: the table only when the season has a published one
  const { standings } = useStandings(c.match.seasonId);
  const hasTable = !!standings && standings.rows.length > 0 && standings.rows.some((r) => r.pj > 0);
  const proj = hasTable && standings ? projectTable(standings.rows, { rival: c.rival, gf: c.score.us, ga: c.score.them }) : null;
  const asi = asiOf({ fase: f, us: c.score.us, them: c.score.them, m, table: proj ? { position: proj.position } : null });
  const half = c.duration / 2;
  const best = c.plays.filter((p) => p.m <= half && (p.k === "gol" || p.k === "rival"));

  return (
    <div className="pa-live">
      <div className="pa-live__main">
        <div className="pa-feedhead">
          <h3 className="pa-k">
            Jugada a jugada{" "}
            <span>
              {played.length} {played.length === 1 ? "momento" : "momentos"}
              {m < c.edge ? ` hasta el ${m}′` : ""}, la última arriba
            </span>
          </h3>
          <div className="vd-glass vd-seg pa-filter" role="radiogroup" aria-label="Qué jugadas ver" style={{ "--n": 4, "--i": fi } as CSSProperties} onKeyDown={onKey}>
            <span className="vd-shelf__bead" aria-hidden="true" />
            {FILTERS.map(([k, t]) => (
              <button key={k} type="button" role="radio" className="vd-seg__b" aria-checked={fk === k} tabIndex={fk === k ? 0 : -1} onClick={() => setFk(k)}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <ol className="pa-feed" aria-live="polite" aria-label="Jugada a jugada, la más reciente arriba">
          {played.map((p, i) => {
            const at = !!near && near.id === p.id && m - p.m <= 2;
            const fresh = i === 0 && c.live && !c.dragged && f !== "descanso";
            const cls = [at ? "is-at" : "", fresh ? "is-new" : "", !all && i >= 6 ? "is-extra" : ""].filter(Boolean).join(" ");
            const text = (
              <>
                <b>{p.title}</b>
                {p.sub && <span>{p.sub}</span>}
              </>
            );
            return (
              <li key={p.id} className={`pa-row${cls ? ` ${cls}` : ""}`}>
                <div className="pa-row__us">{p.side === "us" && text}</div>
                <button type="button" className={`pa-row__min${p.k === "gol" ? " is-gold" : ""}`} onClick={() => c.seek(p.m)} aria-label={`Minuto ${p.m}, ${lc(p.title).replace(/\.$/, "")}. Ir a ese minuto en la moviola`}>
                  <span className="vd-clock">{p.m}′</span>
                </button>
                <div className="pa-row__them">{p.side === "them" && text}</div>
              </li>
            );
          })}
        </ol>
        {played.length === 0 && <p className="pa-note pa-empty">{fk === "todo" ? "Aún no ha pasado nada: la primera jugada de la mesa entra aquí." : "Nada de eso hasta este minuto."}</p>}
        {(rest > 0 || (all && played.length > 6)) && (
          <div className="vd-more pa-more">
            <p>
              <b>{all ? `${played.length} momentos` : `${rest} ${rest === 1 ? "momento más" : "momentos más"}`}</b> desde el pitido
            </p>
            <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm vd-more__btn" onClick={() => setAll((v) => !v)} aria-expanded={all}>
              {all ? "Ver solo las últimas" : "Ver todo el partido"}
              <Icon name={all ? "collapse" : "expand"} />
            </button>
          </div>
        )}
      </div>
      <aside className="pa-live__side" aria-label="Lo que rodea al directo">
        {f === "final" && <p className="pa-banner pa-banner--calm">Final, {c.result.dash}. La mesa está cerrando el acta: al publicarla se abre el voto del MVP.</p>}
        <section className="pa-asi" aria-labelledby="pa-asi-h">
          <p className="pa-asi__k" id="pa-asi-h">
            {asi.k}
          </p>
          <p className="pa-asi__t">{asi.t}</p>
          <p className="pa-note">{asi.sub}</p>
          <button type="button" className="vd-link pa-asi__go" onClick={() => c.go("numeros")}>
            {asi.go}
          </button>
        </section>
        <Blocks c={c} id="pa-bl-h1" />
        {f === "descanso" && (
          <section className="pa-best" aria-labelledby="pa-best-h">
            <h3 className="pa-k" id="pa-best-h">
              Lo mejor de la primera parte
            </h3>
            {best.length ? (
              <ul>
                {best.map((p) => (
                  <li key={p.id} className={p.side === "them" ? "is-them" : undefined}>
                    <span className="vd-clock">{p.m}′</span>
                    <span>{p.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pa-note">Sin goles en la primera parte.</p>
            )}
          </section>
        )}
        {mesa && (
          <p className="pa-mesa">
            <Icon name="mesa" />
            <span>Lo anota {mesa} desde la mesa · al día</span>
          </p>
        )}
        {c.live && (
          <p className="pa-av">
            <Icon name="bell" />
            <span>{avisos.line}</span>
            <button type="button" className="vd-link" onClick={() => c.open("avisos")} aria-haspopup="dialog">
              Elegir avisos
            </button>
          </p>
        )}
      </aside>
    </div>
  );
}

// ---------- after: the acta
function Acta({ c, venue }: { c: PageCtx; venue: string }) {
  const { match } = c;
  const id = match.id;
  const me = useMe();
  const canReact = c.viewer.member && !!me && reactionsOpen(match);
  const reactions = useMatchReactions(id).data;
  const ratings = useMatchRatings(id).data;
  const mvpResults = useMvpResults();
  const [cronOpen, setCronOpen] = useState(false);
  const [whoOpen, setWhoOpen] = useState<string | null>(null);

  const w = match.weatherAtKickoff;
  const meta = [longDay(c.kickMs), venue, w ? `Hizo ${Math.round(w.temp)}°${w.label ? `, ${lc(w.label)}` : ""}` : ""].filter(Boolean).join(" · ");
  const report = (match.report ?? "").trim();
  const cron = report ? { text: report, auto: false } : { text: autoCronica(c.plays, c.rival, c.duration, c.nameOf), auto: true };

  let near = nearestPlay(c.plays, c.minute);
  if (near && near.k === "cambio") near = null;
  const mine = (me && reactions.find((d) => d.uid === me.uid)?.moments) || {};
  const moments = c.plays.filter((p) => REACTS[p.k]);
  const react = (momentId: string, r: ReactionId) => {
    if (!me || !canReact) return;
    if (momentsFull(mine, momentId)) return c.say("Ya has reaccionado a 30 momentos de este partido: quita alguna para reaccionar a este.");
    setReactions(me, id, nextMoments(mine, momentId, r)).catch(() => c.say("No se ha guardado tu reacción. Inténtalo otra vez."));
  };

  // the MVP
  const mvp = c.mvp;
  const winners = mvpWinners(match, mvp, c.now);
  const mv = mvpView({
    fase: c.fase,
    member: c.viewer.member,
    jornada: c.jornada,
    winners,
    counts: mvp?.counts ?? {},
    total: mvp?.total ?? 0,
    eligible: mvp?.eligible ?? null,
    closesAt: typeof match.voteClosesAt === "number" ? match.voteClosesAt : null,
    now: c.now,
    nameOf: c.nameOf,
  });
  const nota = notaLine(ratingSummary(ratings)) || "Nota del vestuario: aún sin votos.";

  const firma = firmaOf(c.pulse, c.plays, c.duration);
  const short = rivalShort(c.rival);
  const logros = useMemo(
    () =>
      matchLogros(match, c.matches, c.nameOf, { mvpResults, now: c.now }).map((l) => {
        const i = l.text.indexOf(", ");
        return { id: l.id, t: i < 0 ? l.text : l.text.slice(0, i), d: i < 0 ? "" : l.text.slice(i + 2) };
      }),
    [match, c.matches, c.nameOf, mvpResults, c.now],
  );
  const photos = [match.photoUrl, ...(match.gallery ?? [])].filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u));

  return (
    <div className="pa-acta">
      <div className="pa-acta__main">
        <p className="pa-acta__meta">{meta}</p>
        <section className="pa-cronica" aria-labelledby="pa-cro-h">
          <h3 className="pa-k" id="pa-cro-h">
            {cron.auto ? "Así fue, según el acta" : "La crónica"}
          </h3>
          <p className={`pa-cronica__t${!cron.auto && !cronOpen ? " is-clamp" : ""}`} id="pa-cro-t">
            {cron.text}
          </p>
          {!cron.auto && (
            <button type="button" className="vd-link pa-cronica__more" onClick={() => setCronOpen((v) => !v)} aria-expanded={cronOpen} aria-controls="pa-cro-t">
              {cronOpen ? "Leer menos" : "Leer la crónica entera"}
            </button>
          )}
        </section>
        {moments.length > 0 && (
          <section className="pa-moments" aria-labelledby="pa-mo-h">
            <h3 className="pa-k" id="pa-mo-h">
              Los momentos <span>toca uno y la moviola va a ese minuto</span>
            </h3>
            <ol className="pa-mo" data-scroll-x="">
              {moments.map((p) => {
                const tally = momentTally(reactions, p.id, me?.uid);
                const reacts = (REACTS[p.k] ?? [])
                  .map(([rid, word]) => {
                    const r = tally.find((x) => x.id === rid);
                    return { rid, word, n: r?.count ?? 0, mine: !!r?.mine };
                  })
                  .filter((r) => c.viewer.member || r.n > 0);
                const names = reactions.filter((d) => d.moments[p.id]).map((d) => (me && d.uid === me.uid ? "Tú" : d.name));
                names.sort((a, b) => (a === "Tú" ? -1 : b === "Tú" ? 1 : a.localeCompare(b, "es")));
                const open = whoOpen === p.id;
                const cls = [p.side === "them" ? "is-them" : "", p.k === "gol" ? "is-gold" : "", near && near.id === p.id && c.minute - p.m <= 2 && c.minute < c.duration ? "is-at" : ""].filter(Boolean).join(" ");
                return (
                  <li key={p.id} className={`pa-mo__i${cls ? ` ${cls}` : ""}`}>
                    <button type="button" className="pa-mo__go" onClick={() => c.seek(p.m)} aria-label={`Minuto ${p.m}, ${p.title.replace(/\.$/, "")}. Ir a ese minuto en la moviola`}>
                      <span className="pa-mo__m vd-clock">{p.m}′</span>
                      <b>{p.title}</b>
                      <span>{p.sub || (p.side === "them" ? c.rival : "")}</span>
                    </button>
                    {(reacts.length > 0 || names.length > 0) && (
                      <div className="pa-react" role="group" aria-label={c.viewer.member ? "Reacciona a este momento" : "Reacciones del vestuario"}>
                        {reacts.map((r) => (
                          <button key={r.rid} type="button" className="pa-react__b" aria-pressed={r.mine} onClick={() => react(p.id, r.rid)} disabled={!canReact}>
                            <span>{r.word}</span>
                            <b>{r.n > 0 ? r.n : ""}</b>
                          </button>
                        ))}
                        {names.length > 0 && (
                          <button type="button" className="vd-link pa-react__who" aria-expanded={open} onClick={() => setWhoOpen(open ? null : p.id)}>
                            {open ? "Ocultar" : "Ver quién"}
                          </button>
                        )}
                      </div>
                    )}
                    {open && <p className="pa-note pa-react__list">{whoReacted(names)}</p>}
                  </li>
                );
              })}
            </ol>
          </section>
        )}
        <Blocks c={c} id="pa-bl-h2" />
      </div>
      <div className="pa-acta__side">
        <section className={`pa-mvp${mv.decided ? " is-gold" : ""}`} aria-labelledby="pa-mvp-h">
          {mv.decided && <Tee kit={c.kit} num={c.numOf(mv.winners[0]) || undefined} className="pa-mvp__tee" />}
          <div className="pa-mvp__t">
            <h3 className="pa-k" id="pa-mvp-h">
              {mv.k}
            </h3>
            <p className="pa-mvp__l">{mv.line}</p>
            <p className="pa-note">{nota}</p>
            {mv.vote && (
              <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm vd-btn--gold pa-mvp__go" onClick={() => c.go("vestuario")}>
                Votar en el vestuario
              </button>
            )}
          </div>
        </section>
        <section className="pa-firma" aria-labelledby="pa-firma-h">
          <svg className="pa-firma__svg" viewBox="0 0 160 160" role="img" aria-label={`La firma del partido: hacia fuera aprieta el Piti, hacia dentro ${c.rival}; ${firmaGoals(c.result.us, c.result.them)}`} focusable="false">
            <circle className="pa-firma__base" cx="80" cy="80" r="52" />
            <line className="pa-firma__half" x1="80" y1="18" x2="80" y2="34" />
            <line className="pa-firma__half" x1="80" y1="126" x2="80" y2="142" />
            <path className="pa-firma__path" d={firma.d} />
            {firma.dots.map((d, i) => (
              <circle key={i} className={`pa-firma__dot${d.them ? " is-them" : ""}`} cx={d.x} cy={d.y} r="4.5" />
            ))}
            <text className="pa-firma__c" x="80" y="78" textAnchor="middle">
              {c.result.dash}
            </text>
            <text className="pa-firma__c2" x="80" y="98" textAnchor="middle">
              {c.duration} minutos
            </text>
          </svg>
          <div>
            <h3 className="pa-k" id="pa-firma-h">
              La firma del partido
            </h3>
            <p className="pa-note">Hacia fuera aprieta el Piti, hacia dentro {short}. Arriba el pitido; abajo, el descanso.</p>
          </div>
        </section>
        {logros.length > 0 && (
          <section className="pa-logros" aria-labelledby="pa-log-h">
            <h3 className="pa-k" id="pa-log-h">
              Logros del partido
            </h3>
            <ul className="pa-logros__l">
              {logros.map((l) => (
                <li key={l.id} className="pa-logro">
                  <b>{l.t}</b>
                  {l.d && <span>{l.d}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {photos.length ? (
          <section className="pa-photo pa-photo--on" aria-label="Las fotos">
            <ul className="pa-photo__l">
              {photos.slice(0, 6).map((u, i) => (
                <li key={u}>
                  <a href={u} target="_blank" rel="noopener noreferrer" aria-label={`Abrir la foto ${i + 1} de ${photos.length}`}>
                    <img src={u} alt="" loading="lazy" decoding="async" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="pa-photo" aria-label="Las fotos">
            <Icon name="tab" />
            <p>
              <b>Aún no hay fotos de este partido</b>
              <span>Las sube el capitán desde la Sala de control y salen aquí y en el cartel.</span>
            </p>
          </section>
        )}
        <NextLink c={c} long={false} />
        {c.next.length > 1 && (
          <section className="pa-fix" aria-labelledby="pa-fix-h">
            <h3 className="pa-k" id="pa-fix-h">
              Lo que queda de la temporada
            </h3>
            <ol className="pa-fix__l">
              {c.next.slice(1, 4).map((x) => {
                const j = jornadaOf(c.matches, x.id);
                return (
                  <li key={x.id}>
                    <b>{j ? `J${j}` : "—"}</b>
                    <span>
                      {x.home === false ? "Fuera" : "En casa"} · {x.rival ?? "Rival por decidir"}
                    </span>
                    <span className="pa-fix__w">{shortWhen(dateMillis(x.date))}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}

/** «Lo siguiente»: the next match of the season, a link to its page. */
function NextLink({ c, long }: { c: PageCtx; long: boolean }) {
  const x = c.next[0];
  if (!x) return null;
  const j = jornadaOf(c.matches, x.id);
  const rival = x.rival ?? "rival por decidir";
  const at = dateMillis(x.date);
  const when = Number.isFinite(at) ? (long ? `${longDay(at)}, ${madridTime(at)}` : shortWhen(at)) : "Sin fecha todavía";
  return (
    <Go className="vd-glass vd-press pa-next" href={`/partidos/${encodeURIComponent(x.id)}`}>
      <span className="pa-k">Lo siguiente</span>
      <b>
        {j ? `J${j} · ` : ""}
        {x.home === false ? `En casa de ${rival}` : `En casa, contra ${rival}`}
      </b>
      <span>{when}</span>
      <Icon name="chev-r" />
    </Go>
  );
}

// ---------- aplazado / pendiente
function Off({ c, avisos, cancelled, postponedTo }: { c: PageCtx; avisos: Avisos; cancelled: boolean; postponedTo: number | null }) {
  const f = c.off ?? "pendiente";
  const reason = (c.match as ClubMatch & { postponedReason?: string }).postponedReason ?? "";
  const o = offOf(f, { reason, mesa: c.viewer.mesa, cancelled, postponedTo });
  const on = avisos.notify.on;
  const toggle = () => {
    avisos.notify.toggle();
    c.say(on ? "Aviso quitado." : "Te avisaremos.");
  };
  return (
    <div className="pa-off">
      <div className="pa-off__main">
        <p className="pa-off__big">{o.big}</p>
        <p className="pa-off__d">{o.d}</p>
        <h3 className="pa-k pa-off__k">Lo que cambia</h3>
        <ul className="pa-off__facts">
          {o.facts.map((x) => (
            <li key={x.t}>
              <Icon name={x.icon} />
              <span>{x.t}</span>
            </li>
          ))}
        </ul>
        {(o.notify || o.mesa) && (
          <div className="pa-btns">
            {o.notify && (
              <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={toggle} aria-pressed={on}>
                <Icon name={on ? "check" : "bell"} />
                {notifyLabel(f, on)}
              </button>
            )}
            {o.mesa && (
              <a
                className="vd-glass vd-press vd-btn vd-btn--pri"
                href={`${c.base}/mesa`}
                onClick={(e) => {
                  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  c.go("mesa");
                }}
              >
                <Icon name="mesa" />
                Publicar el acta en la mesa
              </a>
            )}
          </div>
        )}
      </div>
      <div className="pa-off__side">
        <NextLink c={c} long />
        {o.side && <p className="pa-note">{o.side}</p>}
      </div>
    </div>
  );
}

