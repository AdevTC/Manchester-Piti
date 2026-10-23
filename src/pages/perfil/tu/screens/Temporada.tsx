// /perfil/temporada (TU boards isTemporada): his numbers (the goal in gold), «tramo a tramo» of his one match (or
// the one he watched from outside), gol a gol and the last five, his partner with his shirt and when he scores,
// his medals and the next ones, and what is his in the vestuario. «Ver tus cromos» is the screen's action.
import { useNavigate } from "@tanstack/react-router";
import { isCompleted } from "../../../../../functions/src/matchEngine";
import { useClubData } from "../../../../lib/clubData";
import { TuIcon, Seg } from "../../../../components/vidrio/tu/ui";
import { seasonCalendar } from "../../card";
import { ago, matchTime } from "../../lines";
import { dayName } from "../model";
import { pl, secDesc } from "../model";
import type { ScreenProps } from "../MiPagina";
import { goalClock, minutesTogether, oneMatch, stretchesOf, watchedLine, winsWith } from "../season";
import { Shirt } from "../TuCard";
import { Screen, type Act } from "./Head";
import { PorraBlock, PORRA_ID } from "./Porra";
import type { MatchMark } from "../../../../lib/derived/vidrio/matchMarks";
import { useState } from "react";
import { setAvailability, useMe } from "../../../vestuario/writes";

const CLOCK = ["0–10′", "10–20′", "20–30′", "30–40′", "40–50′"];
const RSVP: { v: "yes" | "maybe" | "no"; t: string }[] = [
  { v: "yes", t: "Voy" },
  { v: "maybe", t: "Duda" },
  { v: "no", t: "No voy" },
];
const ANSWERED = { yes: "Has dicho que vas.", maybe: "Has dicho que tienes duda.", no: "Has dicho que no vas." };

function Marks({ marks }: { marks: MatchMark[] }) {
  return (
    <>
      {marks.map((m, i) => (
        <i key={i} className={`k-${m.k}`} style={{ left: `${m.left.toFixed(1)}%` }} />
      ))}
    </>
  );
}

export function Temporada(p: ScreenProps) {
  const { data, go, say } = p;
  const navigate = useNavigate();
  const me = useMe();
  const { matches, players } = useClubData();
  const [rsvp, setRsvp] = useState<"yes" | "maybe" | "no" | null>(null);
  const c = data.card;
  const pid = data.ficha.playerId ?? "";
  const t = c.totals;
  const started = c.started && t.played > 0;
  const nameOf = (id: string) => {
    const pl0 = players.find((x) => x.id === id);
    return pl0 ? pl0.shirtName || pl0.firstName || "" : "";
  };
  const games = seasonCalendar(matches, data.seasonId).filter((m) => isCompleted(m));
  const jOf = new Map(c.series.map((s) => [s.id, s.j]));
  const lastJ = c.series.length ? c.series[c.series.length - 1].j : null;
  const one = games.length === 1 ? games[0] : null;
  const stretch = one ? stretchesOf(one, jOf.get(one.id) ?? 1, pid, c.posLong, nameOf) : null;
  const watched = one && !stretch ? watchedLine(one, jOf.get(one.id) ?? 1, pid, nameOf) : null;
  const clock = goalClock(games, pid);
  const best = clock.indexOf(Math.max(...clock));
  const wins = winsWith(games, c.series);
  const partner = c.partner;
  const partnerLine = partner ? (one ? `${minutesTogether(one, pid, partner.playerId, nameOf)}′ juntos en el campo en la J${jOf.get(one.id) ?? 1}` : `${pl(partner.together, "partido juntos", "partidos juntos")} · ${partner.fromThem ? pl(partner.fromThem, "pase suyo", "pases suyos") + " para tus goles" : partner.fromYou ? pl(partner.fromYou, "pase tuyo", "pases tuyos") + " para los suyos" : "aún sin combinar un gol"}`) : "";
  const bars = c.series.slice(-10);
  const gmax = Math.max(1, ...bars.map((b) => b.goals));
  const oneResult = one ? oneMatch(one, jOf.get(one.id) ?? 1).result : "";
  const rankBits = [t.goals ? (c.goalRank === 1 ? "Máximo goleador del equipo" : `${c.goalRank}.º en goles del equipo`) : "", one ? `J${jOf.get(one.id) ?? 1}: ${oneResult.charAt(0).toLowerCase()}${oneResult.slice(1)}` : pl(wins, "victoria", "victorias") + " contigo en el campo"].filter(Boolean);
  const nx = data.next;
  const answer = rsvp ?? data.stuff.convocatorias.next;
  const pick = (v: "yes" | "maybe" | "no") => {
    if (!me || !nx) return;
    setRsvp(v);
    setAvailability(me, nx.id, v)
      .then(() => say({ yes: "Apuntado: vas.", maybe: "Apuntado: tienes duda.", no: "Apuntado: no vas." }[v] + " El capitán ya lo ve."))
      .catch(() => {
        setRsvp(null);
        say("No se ha guardado tu respuesta. Inténtalo otra vez.");
      });
  };
  const sub = started ? `${data.seasonName}, tras la ${lastJ ? `J${lastJ}` : "última jornada"}` : c.started ? `${data.seasonName}, tras la ${lastJ ? `J${lastJ}` : "última jornada"}: aún sin minutos.` : `La ${data.seasonName} aún no ha empezado.`;
  const big = [
    { v: String(t.played), t: t.played === 1 ? "Partido" : "Partidos", cls: "" },
    { v: t.minutes === null ? "—" : `${t.minutes}′`, t: "Minutos", cls: "" },
    { v: String(t.goals), t: "Goles", cls: t.goals ? "is-gold" : "" },
    { v: String(t.assists), t: "Asistencias", cls: "" },
    { v: String(t.mvps), t: "MVP", cls: "" },
  ];
  const conv = data.stuff.convocatorias;
  const boards = data.stuff.boards;
  const porra = data.stuff.porra;
  const stuff = [
    nx && { k: "conv", t: `¿Vas a ${nx.rival}?`, d: `J${nx.j ?? ""} · ${dayName(nx.dateMs)} · ${matchTime(nx.dateMs)}${nx.home === null ? "" : nx.home ? " · en casa" : " · fuera"}. ${answer ? ANSWERED[answer] : "Aún no has respondido."}`, icon: "check" as const, call: !answer, go: () => void navigate({ to: "/vestuario" }) },
    { k: "piz", t: "Tus pizarras", d: boards.count ? `${pl(boards.count, "tablero", "tableros")}${boards.last ? ` · el último, «${boards.last.name}», ${ago(boards.last.at, p.now)}` : ""}` : "Aún ningún tablero tuyo", icon: "poll" as const, call: false, go: () => void navigate({ to: "/pizarra", search: boards.last ? { tablero: boards.last.id } : {} } as never) },
    { k: "porra", t: "Tu porra", d: porra ? `${pl(porra.predictions, "pronóstico", "pronósticos")} · ${pl(porra.exact, "exacto", "exactos")} · vas ${porra.rank}.º de ${porra.of}` : "Aún sin pronósticos esta temporada", icon: "star" as const, call: false, go: () => void navigate({ to: "/perfil/temporada", hash: PORRA_ID, replace: true, resetScroll: false }) },
    { k: "convs", t: "Convocatorias", d: conv.total ? `${conv.answered} de ${conv.total} respondidas` : "Aún ninguna esta temporada", icon: "cal" as const, call: false, go: () => void navigate({ to: "/vestuario" }) },
  ].filter((x): x is Exclude<typeof x, null | undefined | false> => !!x);
  const medals = (data.logros?.list ?? []).filter((m) => m.earned);
  const nexts = data.logros?.next ?? [];

  const act: Act | null = started ? { t: "Ver tus cromos", icon: "play", go: () => go({ page: "perfil", sec: "temporada", open: "cromos" }) } : null;
  const more = [
    { t: "Tu página pública", icon: "arrow" as const, go: () => void navigate({ to: "/jugadores/$playerId/temporada", params: { playerId: pid } }) },
    { t: "Los números del equipo", icon: "chart" as const, go: () => void navigate({ to: "/numeros" }) },
  ];
  return (
    <Screen title="Temporada" desc={secDesc("temporada", "jugador", false)} act={act} more={more}>
      <section className="tu-season" aria-labelledby="tu-tn-t">
        <h3 className="vd-vh" id="tu-tn-t">
          Tus números
        </h3>
        <p className="tu-blk__d">{sub}</p>
        <dl className="tu-big">
          {big.map((b) => (
            <div key={b.t} className={b.cls}>
              <dt>{b.t}</dt>
              <dd>{b.v}</dd>
            </div>
          ))}
        </dl>
        {started && <p className="tu-rank">{rankBits.join(" · ")}</p>}
      </section>
      {stretch && (
        <section className="tu-blk" aria-labelledby="tu-j1-t">
          <div className="tu-blk__hd">
            <h3 className="tu-h3" id="tu-j1-t">
              Tu J{stretch.j}, tramo a tramo
            </h3>
            <span className="tu-small">
              {stretch.minutes}′ en {pl(stretch.stints.length, "tramo", "tramos")}
            </span>
          </div>
          <p className="tu-blk__d">{stretch.line}</p>
          <div className="tu-tlw">
            <div className="tu-stints" role="img" aria-label={stretch.alt}>
              <span className="tu-tl__half" aria-hidden="true" />
              {stretch.stints.map((s) => (
                <span key={s.from} className="tu-stint" style={{ left: `${s.left}%`, width: `${s.width}%` }}>
                  {/* (a stretch too short for its words keeps them for the line's label: they spilled out on the board) */}
                  {s.width >= 9 && <small>{s.t}</small>}
                </span>
              ))}
              <Marks marks={stretch.marks} />
            </div>
            <small className="tu-tl__a" aria-hidden="true">
              0′
            </small>
            <small className="tu-tl__b" aria-hidden="true">
              {stretch.duration}′
            </small>
          </div>
          <p className="tu-small">Barras: cuando estabas en el campo. Puntos: los goles (coral, {stretch.rival}; oro, los nuestros) y las tarjetas.</p>
        </section>
      )}
      {watched && (
        <section className="tu-blk" aria-labelledby="tu-w-t">
          <h3 className="tu-h3" id="tu-w-t">
            La J{jOf.get(one?.id ?? "") ?? 1}, desde fuera
          </h3>
          <p className="tu-blk__d">{watched.line}</p>
          <div className="tu-tlw">
            <div className="tu-tl tu-tl--lg" role="img" aria-label={`Los goles de la J${jOf.get(one?.id ?? "") ?? 1}`}>
              <span className="tu-tl__half" aria-hidden="true" />
              <Marks marks={watched.marks} />
            </div>
            <small className="tu-tl__a" aria-hidden="true">
              0′
            </small>
            <small className="tu-tl__b" aria-hidden="true">
              50′
            </small>
          </div>
        </section>
      )}
      {!started && nx && (
        <section className="tu-call" aria-labelledby="tu-call2-t">
          <div>
            <h3 className="tu-h3" id="tu-call2-t">
              ¿Vas el {dayName(nx.dateMs)} a {nx.rival}?
            </h3>
            <p className="tu-blk__d">
              Tu estreno puede ser la J{nx.j ?? ""}: {matchTime(nx.dateMs)}
              {nx.home === null ? "" : nx.home ? ", en casa" : ", fuera"}.{answer ? ` ${ANSWERED[answer]}` : ""}
            </p>
          </div>
          <Seg opts={RSVP} value={answer} onPick={pick} labelledBy="tu-call2-t" bead={!!answer} />
        </section>
      )}
      <div className="tu-cols tu-cols--3">
        {bars.length > 1 && (
          <section className="tu-blk" aria-labelledby="tu-gg-t">
            <h3 className="tu-h3" id="tu-gg-t">
              Gol a gol
            </h3>
            <div className="tu-gbars" role="img" aria-label={`Goles por jornada: ${bars.map((b) => `${b.label} ${b.goals}`).join(", ")}`}>
              {bars.map((b) => (
                <span key={b.id} className={`${b.played ? "" : "is-no "}${b.goals ? "is-goal" : ""}`.trim()}>
                  <b>{b.played ? b.goals : "·"}</b>
                  <i style={{ height: `${b.played ? Math.max(6, Math.round((b.goals / gmax) * 100)) : 3}%` }} />
                  <small>{b.label}</small>
                </span>
              ))}
            </div>
            <ol className="tu-form" aria-label="Últimos cinco resultados">
              {c.last5.map((f) => (
                <li key={f.id}>
                  <span className={`tu-res is-${f.l}`} role="img" aria-label={f.aria}>
                    {f.l}
                  </span>
                  <small>{f.j}</small>
                </li>
              ))}
            </ol>
            <p className="tu-small">G victoria · E empate · P derrota</p>
          </section>
        )}
        <section className="tu-blk" aria-labelledby="tu-socio-t">
          <h3 className="tu-h3" id="tu-socio-t">
            Tu socio en el campo
          </h3>
          {partner ? (
            <div className="tu-partner">
              <Shirt num={partner.number} className="tu-partner__img" />
              <span>
                <b>{partner.name}</b>
                <span>{partnerLine}</span>
              </span>
            </div>
          ) : (
            <p className="tu-blk__d">Sale con tus primeros minutos: el compañero con el que más tiempo compartes campo.</p>
          )}
          {t.goals > 0 && (
            <>
              <h4 className="tu-h4">Cuándo marcas</h4>
              <div className="tu-clock" role="img" aria-label={`Cuándo marcas: ${clock.map((n, i) => `${n} entre el ${i * 10} y el ${i * 10 + 10}`).join(", ")}`}>
                {clock.map((n, i) => (
                  <span key={CLOCK[i]} className={n && i === best ? "is-best" : ""}>
                    <i style={{ height: `${Math.max(4, Math.round((n / Math.max(1, clock[best])) * 100))}%` }} />
                    <b>{n}</b>
                    <small>{CLOCK[i]}</small>
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
        <section className="tu-blk" aria-labelledby="tu-log-t">
          <h3 className="tu-h3" id="tu-log-t">
            Tus logros
          </h3>
          {medals.length > 0 && (
            <ul className="tu-medals">
              {medals.map((m) => (
                <li key={m.id}>
                  <TuIcon name="trophy" />
                  <b>{m.label}</b>
                  <small>{m.detail}</small>
                </li>
              ))}
            </ul>
          )}
          <ul className="tu-nexts">
            {nexts.map((n) => {
              const pr = n.progress ?? { now: 0, goal: 1 };
              const txt = `${Math.min(pr.now, pr.goal)} de ${pr.goal}`;
              return (
                <li key={n.id}>
                  <b>{n.label}</b>
                  <span className="tu-bar" role="img" aria-label={`${n.label}: ${txt}`}>
                    <i style={{ width: `${Math.max(4, Math.round((Math.min(pr.now, pr.goal) / pr.goal) * 100))}%` }} />
                  </span>
                  <small>{txt}</small>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="tu-blk tu-blk--wide" aria-labelledby="tu-stuff-t">
          <h3 className="tu-h3" id="tu-stuff-t">
            Lo tuyo en el vestuario
          </h3>
          <ul className="tu-links">
            {stuff.map((l) => (
              <li key={l.k}>
                <button type="button" className={`tu-link${l.call ? " is-call" : ""}`} onClick={l.go}>
                  <span className="tu-link__i">
                    <TuIcon name={l.icon} />
                  </span>
                  <span>
                    <b>{l.t}</b>
                    <small>{l.d}</small>
                  </span>
                  <TuIcon name="chev-r" />
                </button>
              </li>
            ))}
          </ul>
        </section>
        <PorraBlock seasonId={data.seasonId} uid={data.uid} />
      </div>
    </Screen>
  );
}
