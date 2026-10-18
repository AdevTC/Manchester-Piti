// Inicio below the hero: the boards strip, the slot of «La primera fila», the phase block (what this moment of the
// match day needs), «La temporada», «Lo que viene» with each kick-off's light, «En el club» and the fans'
// invitation to the vestuario. Everything here is public data: it renders on the server.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AddToCalendar } from "../../components/celeste/AddToCalendar";
import { Icon } from "../../components/celeste/icons";
import { lightingOf } from "../../components/palomeras3d";
import { dateMillis, type ClubMatch } from "../../lib/clubData";
import type { MatchdayModel } from "../../lib/derived/matchday";
import { madridTime, madridDay } from "../../lib/derived/madrid";
import { sunTimes } from "../../lib/derived/sun";
import { kitLabel, KIT_LABEL, mapsUrl, siteOrigin } from "../../lib/derived/venue";
import { eventMetaOf, eventSentence } from "../../lib/eventMeta";
import { withGuestNames } from "../../lib/derived/guests";
import { RESULT_WORD, type ResultLetter } from "../../lib/derived/result";
import { matchEvent, type ClubMedal, type PlayerLine } from "../../lib/home";
import { momentTally, notaLine, ratingSummary, type RatingDoc, type ReactionDoc } from "../../lib/derived/trasElPartido";
import type { MatchWeather } from "../../lib/weather";
import { eventSeconds } from "../../../functions/src/matchAnalysis";
import { andList, dayWord, isLive, niceName, skyChipOf, type MatchView, type TableRow } from "./inicioModel";

const cap = (s: string) => s.charAt(0).toLocaleUpperCase("es") + s.slice(1);

// ───────────── the boards: sponsors running, the live message over them
export function BoardsStrip({ sponsors, message }: { sponsors: readonly string[]; message: { text: string; kind: string } | null }) {
  const run = [...sponsors, "Manchester Piti"];
  const tones = ["a", "b", "c", "e"];
  return (
    <div className="ei-board">
      {message && <div className={`ei-board-msg ${message.kind}`}>{message.text}</div>}
      <div className="ei-board-run" aria-hidden="true">
        {[...run, ...run].map((s, i) => (
          <span key={i} className={`ei-board-p ${tones[i % run.length % tones.length]}`}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

// ───────────── shared bits
function Fact({ ic, b, s, action }: { ic: string; b: string; s?: string; action?: ReactNode }) {
  return (
    <div className="ei-fact">
      <span className="ic" aria-hidden="true">
        {ic}
      </span>
      <span className="tx">
        <b>{b}</b>
        {s && <span>{s}</span>}
      </span>
      {action}
    </div>
  );
}

export interface PlayRow {
  id: string;
  minute: string;
  k: string;
  tone: "g" | "r" | "y" | "c" | "";
  text: string;
}
/** A play as a row: «21′ · G · Gol de Adrián T.C., pase de Jordi». */
export function playRow(match: ClubMatch, e: NonNullable<ClubMatch["events"]>[number], nameOf: (id: string) => string): PlayRow {
  const meta = eventMetaOf(e);
  const s = eventSentence(e, { nameOf: withGuestNames(match, nameOf), rival: match.rival?.trim() || "el rival" });
  const tone = meta.goal === "for" ? "g" : meta.goal === "against" ? "r" : meta.card === "a" ? "y" : meta.card === "r" ? "r" : e.type === "substitution" ? "c" : "";
  const k = meta.goal === "for" ? "G" : meta.goal === "against" ? (match.rivalShort ?? match.rivalInitials ?? "R").slice(0, 2).toUpperCase() : meta.card === "a" ? "A" : meta.card === "r" ? "R" : e.type === "substitution" ? "⇄" : "·";
  return { id: e.id, minute: `${Math.max(1, Math.ceil(eventSeconds(e) / 60))}′`, k, tone, text: s.sub && meta.goal ? `${s.title}, ${s.sub.charAt(0).toLocaleLowerCase("es")}${s.sub.slice(1)}` : s.title };
}
function Plays({ rows }: { rows: readonly PlayRow[] }) {
  return (
    <ol className="ei-plist">
      {rows.map((p) => (
        <li key={p.id} className="ei-play">
          <span className="m">{p.minute}</span>
          <span className={`ic ${p.tone}`} aria-hidden="true">
            {p.k}
          </span>
          <span className="tx">{p.text}</span>
        </li>
      ))}
    </ol>
  );
}

// ───────────── the phase block
interface PhaseProps {
  day: MatchdayModel;
  view: MatchView;
  now: number;
  member: boolean;
  weather: MatchWeather | null;
  nameOf: (id: string) => string;
  squadSize: number;
  reactions: readonly ReactionDoc[];
  ratings: readonly RatingDoc[];
  mvp: { name: string } | null;
}

/** The most-celebrated play of the acta, from the public reactions: the moment with the most of them. */
export function mostCelebrated(match: ClubMatch, docs: readonly ReactionDoc[], nameOf: (id: string) => string) {
  const counts = new Map<string, number>();
  for (const d of docs) for (const id of Object.keys(d.moments)) counts.set(id, (counts.get(id) ?? 0) + 1);
  const [top] = [...counts.entries()].filter(([id]) => (match.events ?? []).some((e) => e.id === id)).sort((a, b) => b[1] - a[1]);
  if (!top) return null;
  const e = match.events!.find((x) => x.id === top[0])!;
  return { row: playRow(match, e, nameOf), tally: momentTally(docs, top[0]).filter((t) => t.count > 0) };
}

export function PhaseBlock({ day, view, now, member, weather, nameOf, squadSize, reactions, ratings, mvp }: PhaseProps) {
  const m = day.match;
  const origin = siteOrigin();
  const p = view.phase;
  const toMatch = (label: string, primary = true) =>
    m ? (
      <Link className={`ei-btn wide${primary ? " pri" : ""}`} to="/matches/$matchId" params={{ matchId: m.id }}>
        {label} <Icon name="arrow" size={16} stroke={2.2} />
      </Link>
    ) : null;
  let h = "";
  let meta = "";
  let body: ReactNode = null;
  let cta: ReactNode = null;
  if (p === "pretemporada") {
    h = "La temporada, a punto";
    meta = "Lo que ya está";
    body = (
      <div className="ei-facts">
        <Fact ic={String(squadSize || "?")} b={`${squadSize || "Las"} camisetas, una percha`} s="La plantilla completa, con dorsales" />
        <Fact ic="7" b="Fútbol 7, 2 × 25 minutos" s="Liga de Madrid" />
        <Fact ic="P" b="CDM Palomeras" s="Nuestro campo, en Vallecas" action={<a className="ei-fact-a" href={mapsUrl("CDM Palomeras")} target="_blank" rel="noreferrer">Cómo llegar<span className="hm-sr"> (se abre en otra pestaña)</span></a>} />
      </div>
    );
    cta = (
      <Link className="ei-btn wide pri" to="/plantilla">
        Conoce a los {squadSize || "jugadores"} <Icon name="arrow" size={16} stroke={2.2} />
      </Link>
    );
  } else if ((p === "semana" || p === "antes" || p === "pitido") && m) {
    const ko = dateMillis(m.date);
    h = p === "pitido" ? "A punto de empezar" : "Lo que hay que saber";
    meta = Number.isFinite(ko) ? cap(`${dayWord(ko, now)}, ${madridDay(ko)}`) : "Fecha por confirmar";
    body = (
      <div className="ei-facts">
        <Fact
          ic="P"
          b={m.venue || "Campo por confirmar"}
          s={m.home === false ? `En casa de ${m.rival ?? "el rival"}` : "En casa"}
          action={m.venue ? <a className="ei-fact-a" href={mapsUrl(m.venue)} target="_blank" rel="noreferrer">Cómo llegar<span className="hm-sr"> (se abre en otra pestaña)</span></a> : undefined}
        />
        <Fact ic={m.kit === "away" ? "2ª" : "1ª"} b={kitLabel(m, KIT_LABEL.home)} s={m.kit === "away" ? "Segunda equipación" : "Celeste, la de casa"} />
        {Number.isFinite(ko) && (
          <Fact
            ic={weather ? `${weather.temp}°` : "☀"}
            b={weather ? `${weather.temp}°, ${weather.label.toLocaleLowerCase("es")}` : "La luz del partido"}
            s={`${weather?.rain != null ? `Lluvia ${weather.rain}%. ` : ""}El sol se pone a las ${madridTime(sunTimes(ko).sunset)}`}
          />
        )}
        {Number.isFinite(ko) && (
          <Fact
            ic={madridTime(ko).slice(0, 2)}
            b={`${cap(madridDay(ko))}, ${madridTime(ko)}`}
            s={`2 × ${Math.round((m.duration ?? 50) / 2)} minutos`}
            action={<AddToCalendar className="ei-fact-a" label="Al calendario" event={matchEvent(m, origin)} />}
          />
        )}
      </div>
    );
    cta = toMatch("Ver la previa");
  } else if (isLive(p) && m) {
    const rows = view.events.filter((e) => eventMetaOf(e).group !== "otros" || e.type === "substitution").slice(-4).reverse().map((e) => playRow(m, e, nameOf));
    h = p === "descanso" ? "Así va, al descanso" : `Hasta el ${view.minute ?? 0}′${view.added ? ` +${view.added}` : ""}`;
    meta = "Lo apunta la mesa y llega solo";
    body = rows.length ? <Plays rows={rows} /> : <p className="ei-lead">Aún no ha pasado nada que contar: rueda el balón.</p>;
    cta = toMatch("Seguir el partido");
  } else if ((p === "final" || p === "acta") && m) {
    const goals = view.events.filter((e) => eventMetaOf(e).goal).reverse().map((e) => playRow(m, e, nameOf));
    const top = p === "acta" ? mostCelebrated(m, reactions, nameOf) : null;
    h = p === "final" ? `Así fue el ${view.gf}–${view.ga}` : "Ya está el acta";
    meta = p === "final" ? "El acta está pendiente: la publica la mesa en unos minutos" : `Goles, tarjetas y minutos de ${andList([`Piti ${view.gf}`, `${m.rival ?? "rival"} ${view.ga}`])}`;
    body = (
      <>
        {goals.length ? <Plays rows={goals} /> : <p className="ei-lead">Sin goles: un partido de los que se cuentan por las paradas.</p>}
        {top && (
          <>
            <p className="ei-meta ei-gap">La jugada más celebrada: {top.row.text.charAt(0).toLocaleLowerCase("es") + top.row.text.slice(1)}</p>
            <div className="ei-react">
              {top.tally.map((t) => (
                <span key={t.id}>
                  {t.word} <i>{t.count}</i>
                </span>
              ))}
            </div>
          </>
        )}
      </>
    );
    cta = toMatch(p === "final" ? "Ver el partido entero" : "Leer el acta");
  } else if (p === "despues" && m) {
    const top = mostCelebrated(m, reactions, nameOf);
    const nota = notaLine(ratingSummary(ratings));
    h = m.report?.trim() ? "La crónica" : `Así quedó ante ${m.rival ?? "el rival"}`;
    meta = m.photoUrl ? "Con la foto del equipo" : "Lo que dejó el partido";
    body = (
      <>
        {m.photoUrl && <img className="ei-photo" src={m.photoUrl} alt={`La foto del equipo ante ${m.rival ?? "el rival"}`} loading="lazy" />}
        {m.report?.trim() && <p className="ei-lead ei-report">{m.report.trim()}</p>}
        <div className="ei-facts">
          {top && <Fact ic="G" b="La jugada más celebrada" s={`${top.row.minute} ${top.row.text}: ${top.tally.map((t) => `${t.count} «${t.word}»`).join(", ")}`} />}
          {mvp && <Fact ic="★" b={`${mvp.name}, MVP`} s="Lo eligió el vestuario" />}
          {nota && <Fact ic="N" b={nota} s="De 1 a 5, la nota de los socios" />}
        </div>
      </>
    );
    cta = toMatch(m.report?.trim() ? "Leer la crónica" : "Ver el partido");
  } else if (p === "aplazado" && m) {
    h = "Qué pasa ahora";
    meta = `${cap(m.status === "cancelled" ? "suspendido" : "aplazado")}: ${m.rival ?? "el rival"}`;
    body = (
      <div className="ei-facts">
        <Fact ic="?" b="Nueva fecha por confirmar" s="Saldrá aquí y en los avisos" />
        <Fact ic="C" b="La convocatoria se guarda" s={member ? "Tus respuestas valen para el nuevo día" : "El siete se mantiene"} />
        {day.next && <Fact ic="→" b={`Sigue ${day.next.rival ?? "el siguiente"}`} s={Number.isFinite(dateMillis(day.next.date)) ? `${cap(madridDay(dateMillis(day.next.date)))}, ${madridTime(dateMillis(day.next.date))}` : "Fecha por confirmar"} />}
      </div>
    );
    cta = (
      <Link className="ei-btn wide pri" to="/partidos">
        Ver el calendario <Icon name="arrow" size={16} stroke={2.2} />
      </Link>
    );
  } else {
    h = "El calendario";
    meta = "Sin partido a la vista";
    body = <p className="ei-lead">El próximo saldrá aquí en cuanto tenga fecha.</p>;
    cta = (
      <Link className="ei-btn wide pri" to="/partidos">
        Ver el calendario <Icon name="arrow" size={16} stroke={2.2} />
      </Link>
    );
  }
  return (
    <section className="ei-card" aria-labelledby="ei-pa-h">
      <h2 className="ei-h2" id="ei-pa-h">
        {h}
      </h2>
      <p className="ei-meta ei-under">{meta}</p>
      {body}
      {cta}
    </section>
  );
}

// ───────────── la temporada
interface SeasonProps {
  form: readonly ResultLetter[];
  table: readonly TableRow[];
  tableTitle: string;
  tableNote: string;
  scorers: readonly PlayerLine[];
  assisters: readonly PlayerLine[];
  note: string;
}
function Leaders({ title, lines, stat }: { title: string; lines: readonly PlayerLine[]; stat: (l: PlayerLine) => number }) {
  const rows = lines.slice(0, 3);
  return (
    <div>
      <h3>{title}</h3>
      {rows.length ? (
        <ol className="ei-leaders">
          {rows.map((l) => (
            <li key={l.id} className="ei-lead2">
              <span className="k" aria-hidden="true">
                {l.num || "–"}
              </span>
              <Link className="nm" to="/jugadores/$playerId" params={{ playerId: l.id }}>
                {niceName(l.name)}
              </Link>
              <span className="v">{stat(l)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="ei-meta">Por estrenar</p>
      )}
    </div>
  );
}
export function Temporada({ form, table, tableTitle, tableNote, scorers, assisters, note }: SeasonProps) {
  const slots: (ResultLetter | null)[] = [...form, ...Array<null>(Math.max(0, 5 - form.length)).fill(null)].slice(0, 5);
  return (
    <section className="ei-card" aria-labelledby="ei-te-h">
      <h2 className="ei-h2" id="ei-te-h">
        La temporada
      </h2>
      <div className="ei-formrow">
        <span className="ei-meta">Forma</span>
        <div className="ei-form" role="img" aria-label={form.length ? `Últimos partidos: ${form.map((x) => RESULT_WORD[x]).join(", ")}` : "Aún sin partidos"}>
          {slots.map((x, i) => (
            <span key={i} className={x ?? "x"} aria-hidden="true">
              {x ?? "–"}
            </span>
          ))}
        </div>
      </div>
      {table.length > 0 && (
        <table className="ei-stand" aria-label="Clasificación: puesto, equipo y puntos">
          <caption>
            <b>{tableTitle}</b>
            <em>{tableNote}</em>
          </caption>
          <colgroup>
            <col className="cp" />
            <col />
            <col className="cv" />
          </colgroup>
          <tbody>
            {table.map((r) => (
              <tr key={r.team} className={`${r.us ? "us" : ""}${r.projected ? " proj" : ""}`}>
                <td className="p">{r.pos}</td>
                <td className="n">{r.team}</td>
                <td className="v">
                  {r.pts}
                  {r.projected && <span className="hm-sr"> (si acaba así)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="ei-two">
        <Leaders title="Pichichi" lines={scorers} stat={(l) => l.stats.goals} />
        <Leaders title="Asistencias" lines={assisters} stat={(l) => l.stats.assists} />
      </div>
      <p className="ei-meta ei-gap">{note}</p>
    </section>
  );
}

// ───────────── lo que viene: each jornada with its light
export function LoQueViene({ upcoming, now, jornadaOf }: { upcoming: readonly ClubMatch[]; now: number; jornadaOf: (id: string) => number | null }) {
  const origin = siteOrigin();
  return (
    <section className="ei-card" aria-labelledby="ei-vi-h">
      <h2 className="ei-h2" id="ei-vi-h">
        Lo que viene
      </h2>
      <p className="ei-meta ei-under">Cada jornada con su luz: el sol a la hora del pitido</p>
      {upcoming.length ? (
        <ul className="ei-next">
          {upcoming.map((m) => {
            const at = dateMillis(m.date);
            const ok = Number.isFinite(at);
            const chip = ok ? skyChipOf(at, lightingOf(at).sky, m.duration ?? 50) : null;
            const j = jornadaOf(m.id);
            return (
              <li key={m.id}>
                <Link to="/matches/$matchId" params={{ matchId: m.id }}>
                  <span className="j">{j ? `J${j}` : "·"}</span>
                  <span className="ei-chip" style={chip ? { background: chip.bg } : undefined} aria-hidden="true">
                    {chip && <i className={chip.moon ? "moon" : undefined} style={{ left: `${chip.x}%`, top: `${chip.y}%` }} />}
                    <u />
                    <s className={chip?.lights ? "on" : undefined} style={{ left: 6 }} />
                    <s className={chip?.lights ? "on" : undefined} style={{ right: 6 }} />
                  </span>
                  <span className="tx">
                    <b>{m.home === false ? `En casa de ${m.rival ?? "rival"}` : `Contra ${m.rival ?? "rival por anunciar"}`}</b>
                    <span>{ok ? `${cap(dayWord(at, now))}, ${madridDay(at)}, ${madridTime(at)}${chip ? `, ${chip.words}` : ""}` : "Fecha por confirmar"}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="ei-lead">El calendario llega pronto. Suscríbete y cada partido entrará solo en tu calendario, con hora y campo.</p>
      )}
      <div className="ei-acts">
        <Link className="ei-btn ghost" to="/partidos">
          Todo el calendario
        </Link>
        <AddToCalendar className="ei-btn ghost" iconName="cal" label="Suscribirme al calendario" feed={`${origin}/calendario.ics`} />
      </div>
    </section>
  );
}

// ───────────── en el club
export function EnElClub({ birthdays, medals, sponsors, squadSize }: { birthdays: readonly { id: string; name: string; num: string; label: string; days: number }[]; medals: readonly ClubMedal[]; sponsors: readonly { name: string; url: string }[]; squadSize: number }) {
  const earned = medals.filter((m) => m.earned);
  const latest = earned.at(-1);
  return (
    <section className="ei-card" aria-labelledby="ei-cl-h">
      <h2 className="ei-h2" id="ei-cl-h">
        En el club
      </h2>
      <div className="ei-facts">
        {birthdays.slice(0, 2).map((b) => (
          <Fact key={b.id} ic={b.num || "🎂"} b={`${niceName(b.name)} cumple ${b.days === 0 ? "hoy" : b.days === 1 ? "mañana" : `el ${b.label}`}`} s={b.num ? `Dorsal ${b.num}` : "De la plantilla"} />
        ))}
        <Fact
          ic="V"
          b={latest ? `En la vitrina: ${latest.kicker.toLocaleLowerCase("es")}` : "La vitrina, por estrenar"}
          s={latest ? `${latest.title}, ${latest.detail} · ${earned.length} de ${medals.length}` : "El primer trofeo se gana esta temporada"}
          action={
            <Link className="ei-fact-a" to="/club">
              Ver
            </Link>
          }
        />
        <Fact ic="16" b={`Conoce a los ${squadSize || "jugadores"}`} s="Camisetas, fichas y cara a cara" action={<Link className="ei-fact-a" to="/plantilla" aria-label={`Conoce a los ${squadSize || "jugadores"} en Plantilla`}>Plantilla</Link>} />
      </div>
      {sponsors.length > 0 && (
        <>
          <p className="ei-meta ei-gap">Patrocinan las vallas de Palomeras</p>
          <div className="ei-sp">
            {sponsors.map((s, i) =>
              s.url ? (
                <a key={s.name} className={`t${i % 4}`} href={s.url} target="_blank" rel="noreferrer">
                  {s.name}
                  <span className="hm-sr"> (se abre en otra pestaña)</span>
                </a>
              ) : (
                <span key={s.name} className={`t${i % 4}`}>
                  {s.name}
                </span>
              ),
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ───────────── the fans' spot: never an empty member slot
export function FanInvite() {
  return (
    <section className="ei-card lit ei-yo" aria-labelledby="ei-yo-h">
      <p className="ei-meta">¿Juegas en el Piti?</p>
      <h2 className="ei-h2" id="ei-yo-h">
        Pide entrar al vestuario
      </h2>
      <p className="ei-lead">Dentro respondes a la convocatoria, ves tu sitio en el siete, votas al MVP y llevas tu carta.</p>
      <div className="ei-acts">
        <Link className="ei-btn pri" to="/vestuario">
          Pedir entrar
        </Link>
        <Link className="ei-btn ghost" to="/club">
          Cómo funciona
        </Link>
      </div>
    </section>
  );
}

export function YoSkeleton() {
  return (
    <section className="ei-card lit ei-yo" aria-busy="true" aria-label="Tu vestuario, cargando">
      <p className="ei-meta">Tu vestuario</p>
      <h2 className="ei-h2">Cargando lo tuyo</h2>
      <div className="ei-skel" aria-hidden="true">
        <i style={{ width: "72%" }} />
        <i />
        <i style={{ width: "54%" }} />
      </div>
    </section>
  );
}
