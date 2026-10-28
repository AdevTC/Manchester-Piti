// HOY Y PARTIDOS · the match's «La mesa» (/admin/partidos/<id>/en-juego), as the board (partidos.js juegoVals /
// part-partidos.html § 7): while it is played, the score, the clock, who keeps la mesa and «Abrir la mesa» (the one
// primary action); before, when it opens and who keeps it; after, that it is in the acta; «No llegó a la mesa» for
// one nobody whistled (B-HOY-11, never an «E 0–0»); and «La crónica de la mesa», the plays as they arrive, newest first.
import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { dateMillis } from "../../../../../functions/src/matchEngine";
import { rivalCode } from "../../../../lib/eventMeta";
import { withGuestNames } from "../../../../lib/derived/guests";
import { clockTime } from "../../data/adminLogic";
import { resultLetter, resultWord } from "../../kit/result";
import { LiveClock } from "../../live/LiveParts";
import { liveLog } from "../../live/liveModel";
import { usePartido } from "../../partido/partidoContext";
import { useStationPrimary } from "../../partido/primary";
import { useAdmin } from "../../shell/context";
import type { PrimarySpec } from "../../shell/Screen";
import { SalaLink } from "../../shell/SalaLink";
import { dayLong, plural } from "./fmt";
import { isLive, isOff, isPlayed } from "./matchWords";
// (the Vidrio controls these screens use, vd-seg and vd-switch: the sala does not load them by itself)
import "../../../../styles/vidrio/components.css";
import "./partidos.css";

const SCORE_DASH = "⁠–⁠";

export function EnJuegoScreen() {
  const data = useAdmin();
  const navigate = useNavigate();
  const { match: m, phase, review, base, j } = usePartido();
  const kick = dateMillis(m.date);
  const byId = new Map(data.roster.map((p) => [p.id, p.name]));
  const nameOf = withGuestNames(m, (id) => byId.get(id) ?? data.players.find((p) => p.id === id)?.shirtName ?? "—");
  const plays = liveLog(m.events, m.rival || "el rival", nameOf);
  const live = isLive(phase);
  const played = isPlayed(phase);
  const scorer = m.mesa?.name ?? "";
  const rival = m.rival || "Rival";
  const gf = review.goalsFor;
  const ga = review.goalsAgainst;
  const r = resultLetter(gf, ga);
  const primary = useMemo<PrimarySpec | null>(() => (live ? { label: "Abrir la mesa", onClick: () => void navigate({ to: "/partidos/$matchId/mesa", params: { matchId: m.id } }) } : null), [live, navigate, m.id]);
  useStationPrimary(primary);
  const score = (letter: boolean) => (
    <p className="pa-live__score">
      <span className="vd-vh">
        Manchester Piti {gf}, {rival} {ga}
        {letter ? ` · ${resultWord(r).toLowerCase()}` : ""}
      </span>
      <span className="pa-live__us" aria-hidden="true">
        PITI
      </span>
      <b className="sc-score" aria-hidden="true">
        {gf}
        {SCORE_DASH}
        {ga}
      </b>
      <span className="sc-rival" aria-hidden="true">
        <i>{rivalCode(rival, m.rivalShort)}</i>
        {rival}
      </span>
      {letter && (
        <span className={`sc-res sc-res--${r}`} aria-hidden="true">
          {r}
        </span>
      )}
    </p>
  );
  return (
    <div className="pa-juego">
      {live && (
        <section className="pa-live" aria-labelledby="pa-live-t">
          <h2 className="vd-vh" id="pa-live-t">
            El marcador en vivo
          </h2>
          {score(false)}
          <p className="pa-live__clock">
            <span className="sc-tag sc-tag--live">{phase === "descanso" ? "Descanso" : "En juego"}</span>
            <span className="sc-clock">
              <LiveClock start={kick} match={m} />
            </span>
            <span>{phase === "descanso" ? "Descanso" : m.clock?.phase === "second" ? "2ª parte" : "1ª parte"}</span>
          </p>
          <p className="sc-small pa-live__who">{scorer ? `Anota ${scorer} desde la mesa` : "Nadie anota: lo hace un capitán"}</p>
        </section>
      )}
      {phase === "antes" && (
        <section className="pa-jnote" aria-labelledby="pa-jb-t">
          <h2 className="sc-h2" id="pa-jb-t">
            La mesa se abre el día del partido
          </h2>
          <p className="sc-p">La mesa se abre el día del partido ({Number.isFinite(kick) ? `${dayLong(kick)} a las ${clockTime(kick)}` : "sin fecha"}): se pasa lista, se pita el inicio y cada gol llega aquí al momento.</p>
          <p className="sc-p">
            <b>{scorer ? `Lo anota ${scorer} desde la mesa.` : "Nadie anota todavía."}</b>{" "}
            <SalaLink className="vd-link pa-mini-link" to={`${base}/datos`}>
              Elegir quién anota
            </SalaLink>
          </p>
        </section>
      )}
      {phase === "pendiente" && (
        <section className="pa-jnote" aria-labelledby="pa-jp-t">
          <h2 className="sc-h2" id="pa-jp-t">
            No llegó a la mesa
          </h2>
          <p className="sc-p">La {j} no llegó a la mesa: nadie pitó el inicio el {Number.isFinite(kick) ? dayLong(kick) : "día del partido"}.</p>
          <div className="sc-btnrow">
            <SalaLink className="vd-btn vd-glass vd-press vd-btn--pri" to={`${base}/acta`}>
              Apuntar el resultado
            </SalaLink>
            <SalaLink className="vd-btn vd-glass vd-press" to={`${base}/datos?estado=aplazado`}>
              Aplazado o no se jugó
            </SalaLink>
          </div>
        </section>
      )}
      {isOff(phase) && (
        <section className="pa-jnote" aria-labelledby="pa-jo-t">
          <h2 className="sc-h2" id="pa-jo-t">
            Sin mesa
          </h2>
          <p className="sc-p">{phase === "aplazado" ? `Aplazado${m.postponedReason ? ` · ${m.postponedReason}` : ""}: la mesa se abrirá el día de la nueva fecha.` : "Cancelado: no habrá mesa."}</p>
        </section>
      )}
      {played && (
        <section className="pa-jnote" aria-labelledby="pa-ja-t">
          <h2 className="sc-h2" id="pa-ja-t">
            Ya está en el acta
          </h2>
          {score(true)}
          <p className="sc-p">
            {m.clock ? "Ya está en el acta: la mesa pitó el final" : "Ya está en el acta"} con {plural(m.events?.length ?? 0, "jugada", "jugadas")}.
          </p>
          <SalaLink className="vd-btn vd-glass vd-press vd-btn--pri" to={`${base}/acta`}>
            Ir al acta
          </SalaLink>
        </section>
      )}
      <section className="pa-cron" aria-labelledby="pa-cron-t">
        <header className="sc-sec__h">
          <h2 className="sc-h3" id="pa-cron-t">
            La crónica de la mesa
          </h2>
          <span className="sc-sec__n">{plural(plays.length, "jugada", "jugadas")} · lo último arriba</span>
        </header>
        <ol className="sc-rows pa-plays" aria-live={live ? "polite" : undefined}>
          {plays.map((p) => (
            <li key={p.id} className={`sc-row pa-play is-${p.cls === "rv" ? "suyo" : p.icon === "ball" ? "gol" : "otro"}`}>
              <span className="pa-play__min sc-clock">{p.minute}′</span>
              <span className="sc-row__t">
                <b>{p.text}</b>
                {p.detail && <span>{p.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
        {!plays.length && <p className="sc-small">Todavía nada: cada gol, tarjeta y cambio de la mesa sale aquí al momento.</p>}
      </section>
    </div>
  );
}
