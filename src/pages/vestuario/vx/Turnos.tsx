// /vestuario/turnos · «Turnos» as the canvas prototype draws it (SalaTurnos.dc.html): the match the turns are for, its
// jobs as tiles (his big: «Te toca», and once played «Marcar como hecho», markTurnDone; the backend checks it is his),
// «La rueda» (who carries each job over the next jornadas, derived as the backend hands turns out: turnosModel) and his
// turns to come. Without a match, a rota or turns, the app's words; a captain gets «Crear los turnos».
import { useMemo, useState } from "react";
import { apiError } from "../../../lib/clubApi";
import { dateMillis } from "../../../lib/clubData";
import { jobApplies, rotaMatch, turnDone, type RotaTurnsDoc } from "../../../lib/derived/rota";
import { jornadaNumbers } from "../../../lib/derived/jornada";
import { madridDate, madridTime } from "../../../lib/derived/madrid";
import { useRota } from "../../../lib/useRotaTurns";
import { weekdayDay } from "../../club/cb/model";
import { Go } from "../../club/cb/ui";
import { useAbsences, useSeasonRotaTurns } from "../live";
import { markTurnDone } from "../writes";
import "../../../styles/vestuario/turnos.css";
import type { VxCtx } from "./ctx";
import { Ic, PShirt, RoomHead } from "./kit";
import { matchChip, mineWhen, ROTA_VICON, ruedaMatches, ruedaRows, ruedaSchedule, turnPlayed, turnTiles, turnosHead, type TurnosState } from "./turnosModel";

const FOOT = "Los turnos los reparten los capitanes. ¿No puedes? Cámbialo con alguien y díselo al capitán.";
const BTN = "vd-glass vd-press nx-btn";
const COLS = 5;

export function TurnosBlock({ c }: { c: VxCtx }) {
  const m = c.next;
  const off = !!m && (m.status === "cancelled" || m.status === "postponed");
  const rota = useRota(m?.seasonId ?? c.seasonId, !!c.uid);
  const jobs = rota.data?.jobs ?? [];
  const on = !!m && !off && jobs.length > 0;
  const docs = useSeasonRotaTurns(m?.seasonId, on);
  const absences = useAbsences(madridDate(c.now), on);
  const jornada = useMemo(() => jornadaNumbers(c.matches), [c.matches]);
  const all = useMemo(() => c.matches.map(rotaMatch), [c.matches]);
  const byId = useMemo(() => Object.fromEntries(docs.data.map((d) => [d.id, d.doc])) as Record<string, RotaTurnsDoc | undefined>, [docs.data]);
  const me = c.playerId;
  const socio = !me;
  const mine = c.summary.myTurn;
  const played = turnPlayed(m, c.now);
  const canMark = !!m && !!mine && played;
  const [sent, setSent] = useState<{ id: string; done: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const pins = m ? byId[m.id] : undefined;
  const done = sent && m && sent.id === m.id ? sent.done : turnDone(pins, c.uid);

  const turns = c.summary.turns;
  const rm = m ? rotaMatch(m) : null;
  const state: TurnosState = !m
    ? "nomatch"
    : off
      ? "off"
      : rota.loading
        ? "loading"
        : rota.error && !turns.length
          ? "error"
          : !jobs.length
            ? "norota"
            : // (jobs for this match but no turns yet: the season's turns are still loading)
              !turns.length && rm && jobs.some((j) => jobApplies(j, rm))
              ? docs.error
                ? "error"
                : "loading"
              : !turns.length
                ? "noturns"
                : "turns";

  const info = (id: string) => {
    const n = jornada.get(id);
    return { j: n ? `J${n}` : "", rival: c.matches.find((x) => x.id === id)?.rival?.trim() || "Rival" };
  };
  const at = m ? dateMillis(m.date) : NaN;
  const dated = Number.isFinite(at);
  const nm = m ? info(m.id) : { j: "", rival: "" };
  const myJob = mine && state === "turns" ? mine.job : null;
  const tiles = state === "turns" && rm ? turnTiles(jobs, turns, rm, me, c.nameOf) : [];
  const head = turnosHead({
    state,
    j: nm.j,
    rival: nm.rival,
    cancelled: m?.status === "cancelled",
    cap: c.admin,
    socio,
    myJob: myJob?.name ?? null,
    played,
    done,
    when: dated ? `${weekdayDay(at, c.now)} a las ${madridTime(at)}` : "",
    home: m?.home !== false,
    jobs: tiles.filter((t) => !t.off).length,
  });
  const sched = useMemo(
    () => (state === "turns" && m && rota.data && !docs.loading ? ruedaSchedule(ruedaMatches(rotaMatch(m), all, c.now, COLS), turns, all, rota.data, byId, absences.data, c.now) : []),
    [state, m, all, c.now, rota.data, docs.loading, turns, byId, absences.data],
  );
  const wheel = ruedaRows(jobs, sched, (id) => ({ j: info(id).j || "Partido", rival: info(id).rival }), me, c.nameOf);
  const numOf = (id: string | null) => (id ? (c.squad.find((s) => s.id === id)?.num ?? "") : "");
  const chip = m ? matchChip(m, c.now) : null;

  const toggle = () => {
    if (!c.me || busy || !m) return;
    const next = !done;
    setBusy(true);
    markTurnDone(c.me, m.id, next).then(
      (r) => {
        setBusy(false);
        setSent({ id: m.id, done: r });
        c.say(r ? "Turno hecho." : "Turno sin hacer.");
      },
      (e: unknown) => {
        setBusy(false);
        c.say(apiError(e));
      },
    );
  };

  const empty =
    state === "error"
      ? { t: "No se han podido cargar los turnos", p: "Prueba a recargar la página.", icon: "warn" as const }
      : state === "nomatch"
        ? { t: "Sin partido a la vista", p: "Los turnos salen con el próximo: en cuanto el capitán publique el partido, verás aquí qué te toca.", icon: "cal" as const }
        : state === "off"
          ? { t: "Sin turnos ni caja hasta que se juegue", p: `${nm.j ? `La ${nm.j}` : "El partido"} está ${m?.status === "cancelled" ? "cancelado" : "aplazado"}. Cuando tenga fecha nueva, los turnos vuelven a salir aquí.`, icon: "clock" as const }
          : state === "norota"
            ? {
                t: "Aún no hay turnos esta temporada",
                p: c.admin ? "Pon los trabajos (el agua, las camisetas, los balones…) y el orden: la rueda reparte uno por partido." : "Los reparten los capitanes. Cuando los creen, verás aquí qué te toca y cuándo.",
                icon: "rota" as const,
              }
            : state === "noturns"
              ? { t: "Este partido no tiene turnos", p: "Nadie lleva nada esta jornada. Si hace falta algo, los pone un capitán.", icon: "rota" as const }
              : null;

  const capLink = c.admin && jobs.length > 0;
  const socioAct = socio && state === "turns";
  const nCols = wheel.cols.length;
  const colsStyle = nCols && nCols !== COLS ? { gridTemplateColumns: `repeat(${nCols},minmax(0,1fr))` } : undefined;

  return (
    <section className="vtu" aria-labelledby="ve-room-h">
      <RoomHead
        room="turnos"
        icon={myJob ? ROTA_VICON[myJob.icon] : "rota"}
        kick="Turnos · los trabajos del partido"
        title={head.title}
        sub={head.sub}
        acts={
          capLink || socioAct ? (
            <>
              {capLink && (
                <Go className={BTN} href="/admin/club/turnos">
                  <Ic name="flag" />
                  Repartir en la sala de control
                </Go>
              )}
              {socioAct && (
                <button type="button" className={`${BTN} nx-btn--pri`} onClick={() => c.go("/vestuario/ficha")}>
                  <Ic name="shirt" />
                  Elegir mi ficha
                </button>
              )}
            </>
          ) : undefined
        }
      />

      {m && state !== "error" && chip && (
        <section className="ve-panel vtu-match" aria-label="El partido de estos turnos">
          {nm.j && (
            <span className="vtu-match__j" aria-hidden="true">
              {nm.j}
            </span>
          )}
          <span className="vtu-match__t">
            <b>{m.home === false ? `En casa de ${nm.rival}` : `${nm.rival}, en casa`}</b>
            <span>
              {dated ? `${played ? "Se jugó el " : ""}${weekdayDay(at, c.now)} · ${madridTime(at)}` : "Sin fecha todavía"}
              {m.venue ? ` · ${m.venue}` : ""}
            </span>
          </span>
          <span className={`ve-st ${chip.cls}`}>{chip.t}</span>
        </section>
      )}

      {state === "loading" && (
        <p className="nx-meta" aria-busy="true">
          Cargando los turnos…
        </p>
      )}

      {empty && (
        <>
          <div className="ve-empty" role={state === "error" ? "alert" : undefined}>
            <span className="ve-tile" aria-hidden="true">
              <Ic name={empty.icon} />
            </span>
            <h2>{empty.t}</h2>
            <p>{empty.p}</p>
            {state === "norota" && c.admin && (
              <div className="ve-acts">
                <Go className={`${BTN} nx-btn--pri`} href="/admin/club/turnos">
                  <Ic name="rota" />
                  Crear los turnos
                </Go>
                <span className="nx-meta">En la sala de control: los trabajos y el orden de la rueda.</span>
              </div>
            )}
          </div>
          <p className="nx-note vtu-note">{FOOT}</p>
        </>
      )}

      {state === "turns" && (
        <>
          <section aria-labelledby="vtu-jobs-h">
            <h2 className="nx-vh" id="vtu-jobs-h">
              {nm.j ? `Los trabajos de la ${nm.j}` : "Los trabajos del partido"}
            </h2>
            <ul className={`vtu-jobs${tiles.some((t) => t.mine) ? "" : " is-nome"}`}>
              {tiles.map((t) => {
                const big = t.mine;
                const cls = ["vtu-job", big ? "is-me" : "", big && played ? "vd-glass vd-glass--deep" : "", t.off ? "is-off" : ""].filter(Boolean).join(" ");
                return (
                  <li key={t.key} className={cls}>
                    {big && (
                      <p className="vtu-mine__k">
                        <span className="vtu-tetoca">
                          <Ic name="check" />
                          Te toca
                        </span>
                        <span className="nx-meta">{nm.j ? `${nm.j} contra ${nm.rival}` : `Contra ${nm.rival}`}</span>
                      </p>
                    )}
                    <span className="vtu-job__g" aria-hidden="true">
                      <Ic name={t.icon} />
                    </span>
                    <h3 className="vtu-job__t">{t.job}</h3>
                    <div className="vtu-who">
                      {t.playerId && !t.off ? (
                        <PShirt n={numOf(t.playerId)} />
                      ) : (
                        <span className="vtu-nobody" aria-hidden="true">
                          –
                        </span>
                      )}
                      <span className="vtu-who__t">
                        <b>{t.who}</b>
                        {t.sub && (
                          <small>
                            <span className="nx-vh"> · </span>
                            {t.sub}
                          </small>
                        )}
                      </span>
                    </div>
                    {t.off && (
                      <p>
                        <span className="ve-st is-off">Solo fuera · este partido no</span>
                      </p>
                    )}
                    {big && (
                      <p className="vtu-mine__p">
                        {played
                          ? done
                            ? "Hecho. El equipo lo ve en tu turno."
                            : `${nm.j ? `La ${nm.j}` : "El partido"} ya se jugó. Márcalo como hecho y el equipo lo ve.`
                          : `${dated ? `Es el ${weekdayDay(at, c.now)} a las ${madridTime(at)}. ` : ""}¿No puedes? Cámbialo con alguien y díselo al capitán.`}
                      </p>
                    )}
                    {big && canMark && (
                      <div className="vtu-done">
                        <button type="button" className={`${BTN} nx-btn--pri`} aria-pressed={done} disabled={busy || !c.me} aria-busy={busy || undefined} onClick={toggle}>
                          <Ic name="check" />
                          {done ? "Hecho" : "Marcar como hecho"}
                        </button>
                        <p>{done ? "Toca otra vez si no lo hiciste." : "Solo tú puedes marcar el tuyo."}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="ve-cols vtu-cols">
            <section className="nx-sec nx-sec--first" aria-labelledby="vtu-rueda-h">
              <div className="nx-sec__head">
                <h2 className="nx-h3" id="vtu-rueda-h">
                  La rueda
                </h2>
                <p className="nx-meta">Quién lleva cada cosa, jornada a jornada · si nadie cambia nada</p>
              </div>
              {sched.length === 0 ? (
                <p className="nx-meta" aria-busy="true">
                  Cargando los turnos…
                </p>
              ) : (
                <div className="vtu-rueda">
                  <div className="vtu-rh" aria-hidden="true">
                    <span />
                    <ol style={colsStyle}>
                      {wheel.cols.map((col) => (
                        <li key={col.id}>
                          <b>{col.j}</b>
                          <span>{col.rival}</span>
                          <span>{col.where}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <ul aria-label="La rueda de los turnos">
                    {wheel.rows.map((r) => (
                      <li key={r.key} className="vtu-rw">
                        <p className="vtu-rw__job">
                          <span className="ve-tile" aria-hidden="true">
                            <Ic name={r.icon} />
                          </span>
                          {r.job}
                        </p>
                        <ol className="vtu-strip" aria-label={r.aria} style={colsStyle}>
                          {r.cells.map((cell, i) => (
                            <li key={cell.key} className={["vtu-c", i === 0 ? "is-now" : "", cell.me ? "is-me" : cell.off ? "is-off" : ""].filter(Boolean).join(" ")} aria-label={cell.aria}>
                              <span className="vtu-c__j" aria-hidden="true">
                                {cell.j}
                              </span>
                              {cell.playerId ? (
                                <PShirt n={numOf(cell.playerId)} />
                              ) : (
                                <span className="vtu-c__off" aria-hidden="true">
                                  –
                                </span>
                              )}
                              <span className="vtu-c__n" aria-hidden="true">
                                {cell.name}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <div className="ve-side ve-stack">
              {wheel.mine.length > 0 && (
                <section className="ve-panel" aria-labelledby="vtu-mine-h">
                  <div className="nx-sec__head vtu-mine__head">
                    <h2 className="nx-h3" id="vtu-mine-h">
                      Tus turnos
                    </h2>
                    <p className="nx-meta">
                      {wheel.mine.length === 1 ? "1 turno" : `${wheel.mine.length} turnos`} en las próximas {nCols === 1 ? "1 jornada" : `${nCols} jornadas`}
                    </p>
                  </div>
                  <ul className="ve-list vtu-mineList" aria-label="Tus próximos turnos">
                    {wheel.mine.map((t) => (
                      <li key={t.key} className={`ve-row${t.i === 0 ? " is-me" : ""}`}>
                        <span className="ve-tile" aria-hidden="true">
                          <Ic name={t.icon} />
                        </span>
                        <span className="ve-row__t">
                          <b>{t.job}</b>
                          <span>{t.line}</span>
                        </span>
                        <span className="ve-row__v">{mineWhen(t.i, played, done)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="ve-panel" aria-labelledby="vtu-how-h">
                <h2 className="nx-h3 vtu-how__h" id="vtu-how-h">
                  ¿No puedes?
                </h2>
                <p className="vtu-foot">{FOOT}</p>
              </section>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
