// «El rival» on the match page (idea 12): the record against this rival (PJ · G-E-P · GF:GC), the last
// meetings, our scorers against them, the biggest win and the first meeting — all from rivalDossier, the
// same pure function the stats page's Rivales pane reads — and, for members only, the notes the pizarra's
// RivalPanel keeps on their seven (the official board of this match: the caller passes them only to
// members). The previa shows it whole; the crónica too, with a one-line summary at its top that leads here.
import { Link } from "@tanstack/react-router";
import { formatDate, type ClubMatch } from "../../lib/clubData";
import type { RivalDossier } from "../../lib/derived/rival";
import { resultLetter, resultTitle } from "../../lib/derived/result";
import { PlayerLink } from "../../components/celeste/PlayerLink";
import { Icon } from "../../components/celeste/icons";
import { rivalName, type RivalSeven } from "../pizarra/v2/rival";
import { systemText } from "../../lib/derived/system";

/** The section's anchor (the crónica's summary line leads to it). */
const RIVAL_ANCHOR = "fc-rival";

const veces = (n: number) => (n === 1 ? "una vez" : `${n} veces`);
const goles = (n: number) => (n === 1 ? "gol" : "goles");
/** «3 victorias, 1 empate y 0 derrotas». */
function recordWords(r: RivalDossier["record"]) {
  const w = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return `${w(r.wins, "victoria", "victorias")}, ${w(r.draws, "empate", "empates")} y ${w(r.losses, "derrota", "derrotas")}`;
}
const score = (m: ClubMatch) => `${m.goalsFor ?? 0}–${m.goalsAgainst ?? 0}`;
const letterOf = (m: ClubMatch) => resultLetter(m.goalsFor ?? 0, m.goalsAgainst ?? 0);

/** The crónica's line: «Contra MAD SKY: 3G 1E 0P», leading down to «El rival». */
export function RivalLine({ match, dossier }: { match: ClubMatch; dossier: RivalDossier }) {
  const rival = match.rival ?? "el rival";
  const r = dossier.record;
  const go = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(RIVAL_ANCHOR);
    if (!el) return;
    e.preventDefault();
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
  };
  return (
    <p className="fc-riv-line">
      <a href={`#${RIVAL_ANCHOR}`} onClick={go}>
        {r.played <= 1 ? (
          <span>Primera vez contra {rival}</span>
        ) : (
          <>
            <span>Contra {rival}:</span>{" "}
            <b aria-hidden="true">
              {r.wins}G {r.draws}E {r.losses}P
            </b>
            <span className="hm-sr">{recordWords(r)}</span>
          </>
        )}
        <Icon name="down" size={16} />
      </a>
    </p>
  );
}

/** One meeting in the list: a link to its page (this very match is no link: «este partido»). */
function Meeting({ m, current }: { m: ClubMatch; current: boolean }) {
  const l = letterOf(m);
  const body = (
    <>
      <span className={`pt-res ${l}`} aria-hidden="true">
        {l}
      </span>
      <b>{score(m)}</b>
      <span className="dt">{current ? "Este partido" : formatDate(m.date)}</span>
      <small>{m.home === false ? "fuera" : "en casa"}</small>
    </>
  );
  const label = `${resultTitle(l)} ${score(m)}, ${current ? "este partido" : formatDate(m.date)}, ${m.home === false ? "fuera" : "en casa"}`;
  return (
    <li>
      {current ? (
        <span className="fc-riv-m" aria-label={label} aria-current="page">
          {body}
        </span>
      ) : (
        <Link className="fc-riv-m" to="/matches/$matchId" params={{ matchId: m.id }} aria-label={label}>
          {body}
          <Icon name="right" size={16} />
        </Link>
      )}
    </li>
  );
}

/** The pizarra's notes on their seven (members only: the caller passes `plan` only to them). */
function RivalPlan({ plan }: { plan: RivalSeven }) {
  const notes = plan.players.map((p, i) => ({ i, note: p.note })).filter((x): x is { i: number; note: string } => !!x.note);
  const sys = systemText(plan.formation);
  return (
    <div className="fc-riv-plan" aria-labelledby="fc-riv-plan-h">
      <span className="hm-kick">
        <Icon name="padlock" size={14} /> Solo el vestuario · de la pizarra oficial
      </span>
      <h3 id="fc-riv-plan-h">{sys ? `Su sistema: ${sys}` : "Su siete"}</h3>
      {notes.length ? (
        <ol>
          {notes.map(({ i, note }) => (
            <li key={i}>
              <b>{rivalName(plan, i)}</b>
              <span>{note}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="fc-note">La pizarra tiene su siete, todavía sin notas sobre ninguno.</p>
      )}
    </div>
  );
}

/**
 * The section. `plan`: the RivalPanel's rival seven of this match's official board (members only, the
 * previa only); undefined or null shows nothing of it.
 */
export function RivalSection({ match, dossier, plan }: { match: ClubMatch; dossier: RivalDossier; plan?: RivalSeven | null }) {
  const rival = match.rival ?? "el rival";
  const r = dossier.record;
  const done = dossier.games.some((m) => m.id === match.id);
  // (on the crónica this match is one of the meetings: «primera vez» while it is the only one)
  const history = r.played - (done ? 1 : 0) > 0;
  return (
    <section className="fc-sec fc-reveal fc-riv" id={RIVAL_ANCHOR} tabIndex={-1} aria-labelledby="fc-riv-h">
      <span className="hm-kick">El rival · {rival}</span>
      {!history ? (
        <>
          <h2 className="hm-h2" id="fc-riv-h">
            Primera vez contra <em>{rival}</em>
          </h2>
          <p className="fc-riv-first">
            {done
              ? "Este fue el primer cara a cara: el historial contra ellos empieza aquí."
              : "No hay precedentes: este partido abre el historial. Lo que pase, aquí se queda escrito."}
          </p>
        </>
      ) : (
        <>
          <h2 className="hm-h2" id="fc-riv-h">
            Ya nos hemos visto <em>{veces(r.played)}</em>
          </h2>
          <dl className="fc-rec">
            <div>
              <dt>Partidos</dt>
              <dd>{r.played}</dd>
            </div>
            {(
              [
                ["G", r.wins, r.wins === 1 ? "ganado" : "ganados"],
                ["E", r.draws, r.draws === 1 ? "empate" : "empates"],
                ["P", r.losses, r.losses === 1 ? "perdido" : "perdidos"],
              ] as const
            ).map(([l, n, word]) => (
              <div key={l} className={l}>
                <dt>
                  <span className={`pt-res ${l}`} aria-hidden="true">
                    {l}
                  </span>
                  {word}
                </dt>
                <dd>{n}</dd>
              </div>
            ))}
          </dl>
          <div className="fc-goalbar">
            <p>
              <span>
                <b>{r.gf}</b> a favor
              </span>
              <span className="mono" aria-hidden="true">
                {r.gf}:{r.ga}
              </span>
              <span>
                <b>{r.ga}</b> en contra
              </span>
            </p>
            {r.gf + r.ga > 0 && (
              <span className="bar" aria-hidden="true">
                <i className="us" style={{ flexGrow: r.gf }} />
                <i className="them" style={{ flexGrow: r.ga }} />
              </span>
            )}
          </div>

          <h3 className="fc-riv-h3">{dossier.last.length === 1 ? "El último" : `Los últimos ${dossier.last.length}`}</h3>
          <ol className="fc-riv-last">
            {dossier.last.map((m) => (
              <Meeting key={m.id} m={m} current={m.id === match.id} />
            ))}
          </ol>

          <div className="fc-riv-two">
            <div>
              <h3 className="fc-riv-h3">Les marcan</h3>
              {dossier.scorers.length ? (
                <ol className="fc-riv-sc">
                  {dossier.scorers.map((s) => (
                    <li key={s.id}>
                      <PlayerLink id={s.id} seasonId={s.seasonId} variant="quiet" />
                      <span>
                        <b>{s.goals}</b> {goles(s.goals)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="fc-note">{r.gf ? "Sus goles son de actas antiguas, sin goleador apuntado." : "Todavía no les hemos marcado."}</p>
              )}
            </div>
            <div>
              <h3 className="fc-riv-h3">La mayor victoria</h3>
              {dossier.biggestWin ? (
                dossier.biggestWin.id === match.id ? (
                  <p className="fc-riv-big">
                    <b>{score(dossier.biggestWin)}</b>
                    <span>Este partido</span>
                  </p>
                ) : (
                  <Link className="fc-riv-big" to="/matches/$matchId" params={{ matchId: dossier.biggestWin.id }} aria-label={`La mayor victoria: ${score(dossier.biggestWin)}, ${formatDate(dossier.biggestWin.date)}`}>
                    <b>{score(dossier.biggestWin)}</b>
                    <span>{formatDate(dossier.biggestWin.date)}</span>
                  </Link>
                )
              ) : (
                <p className="fc-note">{done ? "Aún sin victoria contra ellos." : "Aún sin victoria contra ellos: la primera puede ser esta."}</p>
              )}
            </div>
          </div>

          {dossier.first && dossier.first.id !== match.id && (
            <p className="fc-riv-since">
              Primer cara a cara: {formatDate(dossier.first.date)} · {resultTitle(letterOf(dossier.first)).toLowerCase()} {score(dossier.first)}
            </p>
          )}
        </>
      )}
      {plan && <RivalPlan plan={plan} />}
    </section>
  );
}
