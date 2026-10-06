// The tabs of the match page. Public data comes from the acta (events, ledger); the Vestuario tab
// reads and writes the team's private bits (convocatoria, porra, MVP) only for members.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { EVENT_LABELS, isCompleted, playerForSeason, playerName, type ClubMatch } from "../../lib/clubData";
import { useSeason } from "../../context/SeasonContext";
import { useTeam } from "../../context/TeamContext";
import { useAuth } from "../../context/AuthContext";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { useClock } from "../../hooks/useClock";
import { ShirtBack } from "../../components/celeste/ShirtBack";
import { Icon } from "../../components/celeste/icons";
import { Jersey3D } from "../../components/jersey3d/Jersey3D";
import { useShirtStills } from "../../components/jersey3d/useShirtStills";
import { chapters, F7_SPOTS, keyNumbers, playerLine, pulse, stintRows } from "../../lib/ficha";
import { dateParts, resultOf, scoreOf } from "../../lib/partidos";
import { useAvailability, useMatchPredictions, useMeetingNote, useMvpResults, useMyMvpVote, useMyPrediction } from "../vestuario/live";
import { predictScore, setAvailability, useMe, voteMvp } from "../vestuario/writes";
import { apiError } from "../../lib/clubApi";
import { Banda } from "./Banda";
import type { PlayerDoc } from "../../lib/schemas";

type NameOf = (id: string) => string;
const OURS = new Set(["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"]);

function useNumOf(players: PlayerDoc[], seasonId?: string) {
  const { seasons } = useSeason();
  return (id: string) => {
    const p = players.find((x) => x.id === id);
    if (!p) return "";
    const n = playerForSeason(p, seasonId ?? "all", seasons).number;
    return n != null ? String(n) : "";
  };
}

function HeadToHead({ match, matches }: { match: ClubMatch; matches: ClubMatch[] }) {
  const past = matches.filter((m) => m.id !== match.id && m.rival === match.rival && isCompleted(m));
  if (!past.length) return null;
  return (
    <section className="fc-sec fc-reveal" aria-labelledby="fc-h2h">
      <span className="hm-kick">Contra {match.rival}</span>
      <h2 className="hm-h2" id="fc-h2h">
        Ya nos hemos visto
      </h2>
      <ul className="fc-h2h">
        {past.slice(0, 6).map((m) => {
          const { gf, ga } = scoreOf(m);
          return (
            <li key={m.id}>
              <Link className="hm-ghostbtn" to="/matches/$matchId" params={{ matchId: m.id }}>
                <span className={`pt-res ${resultOf(m)}`}>{resultOf(m)}</span> {gf}–{ga} · {dateParts(m.date).long}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function CronicaTab({ match, matches, players, nameOf }: { match: ClubMatch; matches: ClubMatch[]; players: PlayerDoc[]; nameOf: NameOf }) {
  const numOf = useNumOf(players, match.seasonId);
  const rival = match.rival ?? "Rival";
  const story = chapters(match.events, nameOf, rival, scoreOf(match));
  return (
    <>
      <div>
        {match.report && (
          <section className="fc-sec fc-reveal" aria-labelledby="fc-rep">
            <span className="hm-kick">Así lo vivimos</span>
            <h2 className="hm-h2" id="fc-rep">
              La crónica
            </h2>
            <p className="fc-report">{match.report}</p>
          </section>
        )}
        {match.photoUrl && <img className="fc-photo" src={match.photoUrl} alt={`Manchester Piti contra ${rival}`} />}
        {story.length > 1 ? (
          story.map((c, i) => (
            <article key={i} className={`fc-ch ${c.side}`}>
              {c.minute != null && (
                <span className="min" aria-hidden="true">
                  {c.minute}′
                </span>
              )}
              <div className="tx">
                <span className="hm-kick" style={{ margin: 0 }}>
                  {c.minute != null ? `Minuto ${c.minute}` : "Pitido final"}
                </span>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </div>
              {c.side !== "end" && (
                <div className="sb">
                  {c.playerId ? (
                    <ShirtBack name={nameOf(c.playerId).toUpperCase()} num={numOf(c.playerId)} />
                  ) : (
                    <span className="ball">
                      <Icon name="ball" size={34} />
                    </span>
                  )}
                </div>
              )}
            </article>
          ))
        ) : (
          <p className="fc-note">{match.version === 2 ? "No se registraron goles ni jugadas destacadas en el acta." : "Este partido pertenece al archivo anterior: su acta no tiene minuto a minuto."}</p>
        )}
      </div>
      <div>
        {match.gallery && match.gallery.length > 0 && (
          <section className="fc-sec fc-reveal" aria-labelledby="fc-gal">
            <span className="hm-kick">Fotos del partido</span>
            <h2 className="hm-h2" id="fc-gal">
              La galería
            </h2>
            <div className="fc-gal">
              {match.gallery.map((url, i) => (
                <img key={url} src={url} alt={`Foto ${i + 1} del partido`} loading="lazy" />
              ))}
            </div>
          </section>
        )}
        <HeadToHead match={match} matches={matches} />
      </div>
    </>
  );
}

export function PreviaTab({ match, matches }: { match: ClubMatch; matches: ClubMatch[] }) {
  const theme = useDocumentTheme();
  const d = dateParts(match.date);
  const kit = match.kit === "away" ? "away" : "home";
  return (
    <div className="fc-two">
      <section className="fc-sec fc-reveal" aria-labelledby="fc-kit">
        <span className="hm-kick">La equipación del partido · gírala</span>
        <h2 className="hm-h2" id="fc-kit">
          Se juega con la {kit === "away" ? "2ª" : "1ª"}
        </h2>
        <div className="fc-kit">
          <Jersey3D kit={kit} theme={theme} name="PITI" num="" label={`La ${kit === "away" ? "2ª" : "1ª"} equipación del Manchester Piti en 3D. Arrástrala para girarla.`} />
          <span>{match.home === false ? `${match.rival ?? "El rival"} juega en casa` : "Jugamos en casa"}</span>
        </div>
      </section>
      <div>
        <section className="fc-sec fc-reveal" aria-labelledby="fc-plan">
          <span className="hm-kick">El día del partido</span>
          <h2 className="hm-h2" id="fc-plan">
            El plan
          </h2>
          <ol className="fc-plan">
            <li>
              <b>—</b>
              <span>
                Quedada
                <small>La hora la ve el equipo en la pestaña Vestuario</small>
              </span>
            </li>
            <li>
              <b>{d.time}</b>
              <span>
                Pitido inicial
                <small>{match.duration ? `${match.duration} minutos` : "Fútbol 7"}</small>
              </span>
            </li>
            <li>
              <b>Final</b>
              <span>
                Se abre el voto del MVP
                <small>48 horas, en esta misma página</small>
              </span>
            </li>
          </ol>
        </section>
        <HeadToHead match={match} matches={matches} />
      </div>
    </div>
  );
}

export function DirectoTab({ match, nameOf }: { match: ClubMatch; nameOf: NameOf }) {
  const { member } = useTeam();
  const { profile } = useAuth();
  const isAdmin = member && (profile?.role === "admin" || profile?.role === "superadmin");
  const rival = match.rival ?? "Rival";
  const feed = [...(match.events ?? [])].filter((e) => typeof e.minute === "number" && e.type !== "match_played").sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0));
  return (
    <>
    {isAdmin && <Banda match={match} nameOf={nameOf} />}
    <section className="fc-sec" aria-labelledby="fc-live">
      <span className="hm-kick">Desde el acta · se actualiza solo</span>
      <h2 className="hm-h2" id="fc-live">
        Lo que va pasando
      </h2>
      {feed.length ? (
        <ol className="fc-feed" aria-live="polite">
          {feed.map((e) => {
            const us = OURS.has(e.type);
            const who = e.type === "opponent_goal" ? rival : e.type === "substitution" && e.inPlayerId ? nameOf(e.inPlayerId) : e.playerId ? nameOf(e.playerId) : rival;
            return (
              <li key={e.id} className={us ? "us" : ""}>
                <b>{e.minute}′</b>
                <span className="ic">{/yellow|red/.test(e.type) ? <i className="fc-yc" style={e.type === "red_card" ? { background: "#ff5a4f" } : undefined} /> : <Icon name={/goal/.test(e.type) ? "ball" : e.type === "substitution" ? "swap" : "flag"} size={15} />}</span>
                <span>
                  <strong>{who}</strong>
                  <small>
                    {EVENT_LABELS[e.type] ?? e.type}
                    {e.assistPlayerId ? ` · asistencia de ${nameOf(e.assistPlayerId)}` : ""}
                    {e.type === "substitution" && e.playerId ? ` · sale ${nameOf(e.playerId)}` : ""}
                  </small>
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="fc-note">Aún no hay nada en el acta. Cada gol, tarjeta o cambio aparece aquí en cuanto se apunta.</p>
      )}
    </section>
    </>
  );
}

export function CampoTab({ match, players, nameOf, live }: { match: ClubMatch; players: PlayerDoc[]; nameOf: NameOf; live: boolean }) {
  const numOf = useNumOf(players, match.seasonId);
  const starters = match.starters ?? [];
  const [sel, setSel] = useState<string | null>(null);
  const done = isCompleted(match);
  const pick = sel ?? starters[0];
  const line = pick ? playerLine(pick, match.ledger, match.events) : null;
  const rows = done ? stintRows(match.ledger, match.events, match.duration ?? 50) : [];
  if (!starters.length)
    return (
      <section className="fc-sec">
        <h2 className="hm-h2">El siete</h2>
        <p className="fc-note">{match.version === 2 ? "La convocatoria se publica con el acta." : "Este partido pertenece al archivo anterior: no se registró la convocatoria."}</p>
      </section>
    );
  return (
    <div className="fc-two">
      <section className="fc-sec" aria-labelledby="fc-xi">
        <span className="hm-kick">{live ? "En el campo ahora · toca a un jugador" : "Los siete titulares · toca a uno"}</span>
        <h2 className="hm-h2" id="fc-xi">
          {done ? "Quién hizo qué" : live ? "El campo, ahora" : "El siete"}
        </h2>
        <div className="fc-pitch">
          <span className="l mid" />
          <span className="l circ" />
          <span className="l bx1" />
          <span className="l bx2" />
          {starters.slice(0, 7).map((id, i) => {
            const [x, y] = F7_SPOTS[i] ?? [50, 50];
            const g = playerLine(id, match.ledger, match.events).goals;
            return (
              <button key={id} type="button" className="fc-pl" style={{ left: `${x}%`, top: `${y}%` }} aria-pressed={pick === id} onClick={() => setSel(id)} aria-label={`${nameOf(id)}, dorsal ${numOf(id)}`}>
                <span>
                  {numOf(id)}
                  {g > 0 && <i>{g}</i>}
                </span>
                <b>{nameOf(id)}</b>
              </button>
            );
          })}
        </div>
        {line && pick && (
          <dl className="fc-pinfo">
            <span className="nm">
              {numOf(pick)} · {nameOf(pick)}
            </span>
            <div>
              <dt>min</dt>
              <dd>{done ? line.minutes : "–"}</dd>
            </div>
            <div>
              <dt>goles</dt>
              <dd>{line.goals}</dd>
            </div>
            <div>
              <dt>asist.</dt>
              <dd>{line.assists}</dd>
            </div>
            <div>
              <dt>tarjetas</dt>
              <dd>{line.cards}</dd>
            </div>
          </dl>
        )}
        <p className="fc-note">Posiciones orientativas, por el orden de la convocatoria.</p>
        {(match.bench ?? []).length > 0 && (
          <>
            <span className="hm-kick" style={{ marginTop: 18 }}>
              Banquillo
            </span>
            <ul className="fc-bench">
              {(match.bench ?? []).map((id) => {
                const p = match.ledger?.[id];
                return (
                  <li key={id} className={p?.played ? "in" : ""}>
                    <b>{numOf(id)}</b>
                    {nameOf(id)}
                    <small>{p ? (p.played ? `entra ${p.subIn}′` : "no jugó") : ""}</small>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
      {rows.length > 0 && (
        <section className="fc-sec fc-reveal" aria-labelledby="fc-st">
          <span className="hm-kick">Quién estuvo en el campo y cuándo</span>
          <h2 className="hm-h2" id="fc-st">
            Los minutos de cada uno
          </h2>
          <div className="fc-stints">
            <div className="hd" aria-hidden="true">
              <span />
              <span>
                <i>0′</i>
                <i>{Math.round((match.duration ?? 50) / 2)}′</i>
                <i>{match.duration ?? 50}′</i>
              </span>
              <span />
            </div>
            {rows.map((r, i) => (
              <div className="r" key={r.id}>
                <span className="nm">
                  {numOf(r.id)} · {nameOf(r.id)}
                </span>
                <span className="tr" role="img" aria-label={`${nameOf(r.id)}: ${r.minutes} minutos`}>
                  {r.spans.map((s, k) => (
                    <i key={k} style={{ left: `${s.left}%`, width: `${s.width}%`, animationDelay: `${(i * 0.06).toFixed(2)}s` }} />
                  ))}
                  {r.goals.map((g, k) => (
                    <b key={k} style={{ left: `${g}%` }} />
                  ))}
                </span>
                <span className="m">{r.minutes}′</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function PulsoTab({ match, live, minute }: { match: ClubMatch; live: boolean; minute: number | null }) {
  const duration = match.duration ?? 50;
  const bars = pulse(match.events, duration, live ? (minute ?? 0) : isCompleted(match) ? duration : 0);
  const k = keyNumbers(match.events);
  const { gf, ga } = scoreOf(match);
  const started = live || isCompleted(match);
  return (
    <section className="fc-sec" aria-labelledby="fc-pu">
      <span className="hm-kick">Minuto a minuto, desde el acta</span>
      <h2 className="hm-h2" id="fc-pu">
        {started ? "El pulso del partido" : "Se llena durante el partido"}
      </h2>
      <div className="fc-mom" role="img" aria-label={`Pulso del partido minuto a minuto: arriba el Piti, abajo ${match.rival ?? "el rival"}`}>
        {bars.map((b, i) => (
          <span key={b.minute} className={`c${b.played ? "" : " off"}`}>
            <span className="u" style={{ height: `${Math.round(b.us * 0.88)}px`, animationDelay: `${(i * 0.012).toFixed(3)}s` }} />
            <span className="t" style={{ height: `${Math.round(b.them * 0.88)}px`, animationDelay: `${(i * 0.012).toFixed(3)}s` }} />
          </span>
        ))}
      </div>
      <div className="fc-axis" aria-hidden="true">
        <span>0′</span>
        <span>{Math.round(duration / 2)}′</span>
        <span>{duration}′</span>
      </div>
      <dl className="fc-kpis">
        <div>
          <dt>marcador</dt>
          <dd>{started ? `${gf}–${ga}` : "–"}</dd>
        </div>
        <div>
          <dt>paradas</dt>
          <dd>{started ? k.saves : "–"}</dd>
        </div>
        <div>
          <dt>palos</dt>
          <dd>{started ? k.woodwork : "–"}</dd>
        </div>
        <div>
          <dt>tarjetas</dt>
          <dd>{started ? k.cards : "–"}</dd>
        </div>
      </dl>
      <p className="fc-note">Cada barra es un minuto: arriba el Piti, abajo {match.rival ?? "el rival"}. Se calcula con lo que apunta el acta (goles, palos, penaltis, paradas y tarjetas){live ? " y se va llenando minuto a minuto" : ""}.</p>
    </section>
  );
}

const RSVP = [
  ["yes", "Voy"],
  ["maybe", "Duda"],
  ["no", "No puedo"],
] as const;

export function VestuarioTab({ match, players, phase }: { match: ClubMatch; players: PlayerDoc[]; phase: string }) {
  const { member } = useTeam();
  const { user } = useAuth();
  const me = useMe();
  const now = useClock(30_000);
  const theme = useDocumentTheme();
  const numOf = useNumOf(players, match.seasonId);
  const nameOf = (id: string) => playerName(players.find((p) => p.id === id));
  const uid = member ? user?.uid : undefined;
  const kickedOff = phase !== "scheduled" && phase !== "unscheduled";
  const availability = useAvailability(member && !kickedOff ? match.id : undefined);
  const note = useMeetingNote(member ? match.id : undefined);
  const myPrediction = useMyPrediction(match.id, uid);
  const predictions = useMatchPredictions(match.id, !!member && kickedOff);
  const mvp = useMvpResults().get(match.id);
  const myVote = useMyMvpVote(match.id, uid);
  const [pu, setPu] = useState<number | null>(null);
  const [pt, setPt] = useState<number | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [error, setError] = useState("");
  const done = isCompleted(match);
  const { gf, ga } = scoreOf(match);

  const leader = mvp ? Object.entries(mvp.counts).sort((a, b) => b[1] - a[1])[0] : undefined;
  const leaderShot = leader ? [{ kit: "home" as const, theme, name: nameOf(leader[0]).toUpperCase(), num: numOf(leader[0]) }] : [];
  const still = useShirtStills(leaderShot, { offMainThread: true });
  const leaderStill = leaderShot[0] && still(leaderShot[0]);

  if (!member || !me)
    return (
      <section className="fc-sec">
        <span className="hm-kick">Solo para el equipo</span>
        <h2 className="hm-h2">El vestuario</h2>
        {done && mvp && leader && (
          <p className="fc-note">
            MVP: {nameOf(leader[0])} con {leader[1]} de {mvp.total} votos.
          </p>
        )}
        <div className="fc-lock">
          <Icon name="padlock" size={18} />
          <span>
            Convocatoria, quedada, porra y voto del MVP son del vestuario. <Link to="/vestuario">Entrar al vestuario</Link>
          </span>
        </div>
      </section>
    );

  const act = (p: Promise<unknown>) => {
    setError("");
    p.catch((e: unknown) => setError(apiError(e)));
  };
  const mine = availability.data.find((a) => a.uid === me.uid)?.response;
  const counts = { yes: 0, maybe: 0, no: 0 };
  for (const a of availability.data) counts[a.response]++;
  const total = counts.yes + counts.maybe + counts.no;
  const rsvpIndex = Math.max(0, RSVP.findIndex(([v]) => v === mine));
  const shownUs = pu ?? myPrediction.data?.goalsFor ?? 2;
  const shownThem = pt ?? myPrediction.data?.goalsAgainst ?? 1;
  const voteOpen = done && (match.voteClosesAt ?? 0) > now;
  const candidates = Object.entries(match.ledger ?? {})
    .filter(([, p]) => p.played)
    .map(([id]) => id)
    .sort((a, b) => (mvp?.counts[b] ?? 0) - (mvp?.counts[a] ?? 0));
  const exact = predictions.data.filter((p) => p.goalsFor === gf && p.goalsAgainst === ga).length;
  const dist = new Map<string, number>();
  for (const p of predictions.data) dist.set(`${p.goalsFor}–${p.goalsAgainst}`, (dist.get(`${p.goalsFor}–${p.goalsAgainst}`) ?? 0) + 1);
  const top = [...dist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topMax = Math.max(1, ...top.map(([, n]) => n));
  const hours = Math.max(0, Math.round(((match.voteClosesAt ?? 0) - now) / 3_600_000));

  return (
    <div className="fc-two">
      {!kickedOff && (
        <>
          <section className="fc-sec" aria-labelledby="fc-rs">
            <span className="hm-kick">Convocatoria</span>
            <h2 className="hm-h2" id="fc-rs">
              ¿Vas?
            </h2>
            <div className="fc-rsvp" role="radiogroup" aria-label="Tu respuesta">
              <span className="th" style={{ transform: `translateX(${rsvpIndex * 100}%)`, opacity: mine ? 1 : 0 }} />
              {RSVP.map(([value, label]) => (
                <button key={value} type="button" role="radio" aria-checked={mine === value} onClick={() => act(setAvailability(me, match.id, value))}>
                  {label}
                </button>
              ))}
            </div>
            {note.data && (
              <div className="pt-chips" style={{ justifyContent: "flex-start" }}>
                <span className="pt-chip">{note.data}</span>
              </div>
            )}
            {total > 0 && (
              <div className="fc-conv">
                <div className="bar" aria-hidden="true">
                  <i style={{ width: `${(counts.yes / total) * 100}%`, background: "#6CABDD" }} />
                  <i style={{ width: `${(counts.maybe / total) * 100}%`, background: "#FFC659" }} />
                  <i style={{ width: `${(counts.no / total) * 100}%`, background: "var(--muted)" }} />
                </div>
                <small>
                  {counts.yes} {counts.yes === 1 ? "va" : "van"} · {counts.maybe} en duda · {counts.no} {counts.no === 1 ? "no puede" : "no pueden"}
                </small>
              </div>
            )}
          </section>
          <section className="fc-sec" aria-labelledby="fc-po">
            <span className="hm-kick">La porra · se cierra al pitido inicial</span>
            <h2 className="hm-h2" id="fc-po">
              ¿Cómo acaba?
            </h2>
            <div className="fc-porra">
              {(
                [
                  ["PITI", shownUs, setPu, "del Piti"],
                  ["–", 0, null, ""],
                  [match.rival ?? "Rival", shownThem, setPt, `de ${match.rival ?? "el rival"}`],
                ] as const
              ).map(([label, value, set, who], i) =>
                set ? (
                  <div className="fc-step" key={i}>
                    <small>{label}</small>
                    <output aria-live="polite">{value}</output>
                    <div>
                      <button type="button" aria-label={`Un gol menos ${who}`} onClick={() => set(Math.max(0, value - 1))}>
                        −
                      </button>
                      <button type="button" aria-label={`Un gol más ${who}`} onClick={() => set(Math.min(30, value + 1))}>
                        +
                      </button>
                    </div>
                  </div>
                ) : (
                  <i key={i}>–</i>
                ),
              )}
            </div>
            <div className="fc-pick">
              <button type="button" aria-pressed={!!myPrediction.data && myPrediction.data.goalsFor === shownUs && myPrediction.data.goalsAgainst === shownThem} onClick={() => act(predictScore(me, match.id, shownUs, shownThem))}>
                {myPrediction.data ? (myPrediction.data.goalsFor === shownUs && myPrediction.data.goalsAgainst === shownThem ? "Porra guardada" : "Cambiar mi porra") : "Guardar mi porra"}
              </button>
            </div>
            <p className="fc-note">3 puntos si clavas el resultado, 1 si aciertas quién gana.</p>
          </section>
        </>
      )}
      {phase === "playing" && (
        <section className="fc-sec" aria-labelledby="fc-pl">
          <span className="hm-kick">La porra en vivo</span>
          <h2 className="hm-h2" id="fc-pl">
            Si acaba {gf}–{ga}…
          </h2>
          <p className="fc-note">
            …la clavarían {exact} de {predictions.data.length}.{myPrediction.data ? ` Tú dijiste ${myPrediction.data.goalsFor}–${myPrediction.data.goalsAgainst}.` : ""}
          </p>
        </section>
      )}
      {done && (
        <>
          {match.voteClosesAt != null && (
            <section className="fc-sec" aria-labelledby="fc-mvp">
              <article className="fc-mvp">
                <div className="sh">{leaderStill ? <img src={leaderStill} alt="" /> : leader ? <ShirtBack name={nameOf(leader[0]).toUpperCase()} num={numOf(leader[0])} /> : <ShirtBack name="MVP" num="?" />}</div>
                <div>
                  <span className="hm-kick" style={{ margin: 0 }}>
                    MVP · {voteOpen ? `cierra en ${hours} h` : "votación cerrada"}
                  </span>
                  <h2 className="hm-h2" id="fc-mvp">
                    {leader ? nameOf(leader[0]) : "Sin votos todavía"}
                  </h2>
                  <p>{mvp ? `${mvp.total} ${mvp.total === 1 ? "voto" : "votos"} del equipo.` : "Nadie ha votado aún."}</p>
                </div>
              </article>
              {candidates.length > 0 && (
                <ul className="fc-votes">
                  {candidates.slice(0, 6).map((id) => (
                    <li key={id}>
                      <span>{nameOf(id)}</span>
                      <span className="bar">
                        <i style={{ width: `${mvp?.total ? ((mvp.counts[id] ?? 0) / mvp.total) * 100 : 0}%` }} />
                      </span>
                      <b>{mvp?.counts[id] ?? 0}</b>
                    </li>
                  ))}
                </ul>
              )}
              {voteOpen && (
                <div className="fc-pick" role="group" aria-label="Tu voto">
                  {candidates.map((id) => (
                    <button key={id} type="button" aria-pressed={(pick ?? myVote.data) === id} onClick={() => setPick(id)}>
                      {nameOf(id)}
                    </button>
                  ))}
                  {pick && pick !== myVote.data && (
                    <button type="button" aria-pressed="true" onClick={() => act(voteMvp(me, match.id, pick).then(() => setPick(null)))}>
                      {myVote.data ? "Cambiar mi voto" : "Votar"}
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
          <section className="fc-sec" aria-labelledby="fc-pr">
            <span className="hm-kick">La porra de la jornada</span>
            <h2 className="hm-h2" id="fc-pr">
              {predictions.data.length ? `${exact} de ${predictions.data.length} clavaron el ${gf}–${ga}` : "Nadie hizo porra"}
            </h2>
            {top.length > 0 && (
              <ul className="fc-votes">
                {top.map(([res, n]) => (
                  <li key={res}>
                    <span>{res}</span>
                    <span className="bar">
                      <i style={{ width: `${(n / topMax) * 100}%`, background: res === `${gf}–${ga}` ? "#FFC659" : "var(--accent)" }} />
                    </span>
                    <b>{n}</b>
                  </li>
                ))}
              </ul>
            )}
            {myPrediction.data && (
              <p className="fc-note">
                Tú dijiste {myPrediction.data.goalsFor}–{myPrediction.data.goalsAgainst}.
              </p>
            )}
          </section>
        </>
      )}
      {error && (
        <p className="fc-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
