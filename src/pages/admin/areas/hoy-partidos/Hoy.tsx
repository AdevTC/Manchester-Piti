// HOY Y PARTIDOS · Hoy (/admin), as the board (hoy.js / part-hoy.html): the week from the last jornada to the next with
// its hitos (M-02), the match that matters now with its carril and what its station asks (antes: who answered, el
// siete; en juego: the score, the clock and the plays; after: the acta or what the web says; «¿Se jugó?» for one
// that never reached la mesa, M-04, B-HOY-11), «Te toca» with one action per row and the done ones folded (M-05),
// and what comes next. ≥ 1100 it is one screen: the hero and Te toca scroll inside.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { VIcon } from "../../../../components/vidrio/VIcon";
import { withGuestNames } from "../../../../lib/derived/guests";
import { madridDate } from "../../../../lib/derived/madrid";
import { rivalCode } from "../../../../lib/eventMeta";
import { venueName, kitLabel } from "../../../../lib/derived/venue";
import { clockTime, shortDate, type AdminMatch } from "../../data/adminLogic";
import type { AdminData } from "../../data/useAdminData";
import { useMatchAnswers, useTeamAbsences } from "../../convocar/live";
import { useOpenTrainings } from "../../../vestuario/live";
import { resultLetter, resultWord } from "../../kit/result";
import { LiveClock } from "../../live/LiveParts";
import { liveLog } from "../../live/liveModel";
import { stationLabel } from "../../partido/carril";
import { useAdmin } from "../../shell/context";
import { SalaScreen, ScreenError, ScreenLoading, type PrimarySpec } from "../../shell/Screen";
import { SalaLink } from "../../shell/SalaLink";
import { useSalaGo } from "../../shell/salaHref";
import { useFrame } from "../../ui/frame";
import { left, list, plural, relDay } from "./fmt";
import { hechas, hoyLede, semana, type TocaItem } from "./hoyModel";
import { useHoyToca } from "./useHoyToca";
import { heroKicker, isLive, jWord, matchVt } from "./matchWords";
import { answersOf, type Answers } from "./rsvp";
import { Shirt, type Kit } from "./Shirt";
import { useShirts } from "./useShirts";
import { useMatchRows, type MatchRowView } from "./useMatchRows";
import "./hoy.css";

export function HoyScreen() {
  const data = useAdmin();
  if (data.loading && !data.matches.length) return <ScreenLoading label="Cargando Hoy" />;
  if (data.error && !data.matches.length) return <ScreenError what="Hoy" onRetry={() => window.location.reload()} />;
  return <HoyBody data={data} />;
}

function HoyBody({ data }: { data: AdminData }) {
  const go = useSalaGo();
  const { width } = useFrame();
  const rows = useMatchRows(data);
  const toca = useHoyToca(data, rows);
  const trainingsQ = useOpenTrainings(data.now);
  const heroRow = data.hero ? (rows.find((r) => r.m.id === data.hero?.match.id) ?? null) : null;
  const lede = hoyLede(data.now, heroRow ? { m: heroRow.m, phase: heroRow.phase } : null);
  const lastPlayed = [...rows].reverse().find((r) => r.phase === "publicado" || r.phase === "final" || r.phase === "pendiente")?.m ?? null;
  const days = useMemo(
    () =>
      semana({
        now: data.now,
        matches: rows,
        last: lastPlayed,
        next: data.next?.match ?? null,
        trainings: trainingsQ.data.map((t) => {
          const slot = t.confirmed ? t.slots.find((s) => s.id === t.confirmed?.slotId) : t.slots[0];
          return { at: t.confirmed?.at ?? slot?.at ?? t.lastSlotAt, place: t.confirmed?.place ?? slot?.place ?? "", confirmed: !!t.confirmed };
        }),
        reminders: () => true,
      }),
    [data.now, rows, lastPlayed, data.next, trainingsQ.data],
  );
  const done = useMemo(() => {
    const mvpClosed = [...rows].reverse().find((r) => r.phase === "publicado" && r.m.voteClosesAt && r.m.voteClosesAt <= data.now);
    return hechas({ matches: rows, mvp: mvpClosed ? { j: jWord(mvpClosed.m), total: 0 } : null, next: data.next ? { m: data.next.match, called: data.next.match.starters?.length ?? 0 } : null }).map((h) => (h.title.startsWith("MVP") ? { ...h, detail: data.mvp ? capitalize(data.mvp) : "Cerrado" } : h));
  }, [rows, data.now, data.next, data.mvp]);
  const after = rows.filter((r) => r.phase === "antes" && (!heroRow || r.t > heroRow.t) && r.m.id !== heroRow?.m.id).slice(0, width >= 1800 ? 4 : 3);

  const answersHero = useMatchAnswers(heroRow && heroRow.phase === "antes" ? heroRow.m.id : undefined);
  const absences = useTeamAbsences(madridDate(data.now));
  const answers = useMemo(() => (heroRow ? answersOf({ match: heroRow.m, roster: data.roster, answers: answersHero.data, absences }) : null), [heroRow, data.roster, answersHero.data, absences]);

  const primary = heroPrimary(heroRow, answers, go, data.season && !rows.some((r) => r.m.seasonId === data.season?.id));
  return (
    <SalaScreen title="Hoy" lede={lede} primary={primary} fit className="hy">
      <section className="hy-week" aria-labelledby="hy-week-t">
        <h2 className="vd-vh" id="hy-week-t">
          La semana
        </h2>
        <ol className="hy-days" aria-label="Los días hasta el próximo partido">
          {days.map((d) => (
            <li key={d.key} className={["hy-day", d.today ? "is-today" : "", d.past ? "is-past" : "", d.hitos.length ? "has-hitos" : ""].filter(Boolean).join(" ")} aria-current={d.today ? "date" : undefined}>
              <p className="hy-day__d">
                <span>{d.dn}</span>
                <b>{d.dd}</b>
                {d.showMo && <span>{d.mo}</span>}
              </p>
              {d.today && <p className="hy-day__now">Hoy</p>}
              {d.hitos.map((h) => (
                <SalaLink key={`${h.t}-${h.text}`} to={h.path} className={`hy-hito is-${h.kind}`} aria-label={`${d.dn} ${d.dd}: ${h.kind === "toca" ? "te toca · " : h.kind === "hecho" ? "hecho · " : h.kind === "ahora" ? "ahora · " : ""}${h.text}`}>
                  {h.text}
                </SalaLink>
              ))}
            </li>
          ))}
        </ol>
      </section>

      <div className="hy-grid">
        {heroRow ? <Hero row={heroRow} answers={answers} /> : <NoHero emptySeason={data.season ? data.season.name : null} hasMatches={rows.length > 0} />}
        <Toca items={toca} done={done} after={after} now={data.now} />
      </div>
    </SalaScreen>
  );
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase("es") + s.slice(1);

function heroPrimary(h: MatchRowView | null, a: Answers | null, go: (to: string) => void, emptySeason: boolean | null): PrimarySpec | null {
  if (!h) return emptySeason ? { label: "Nuevo partido", onClick: () => go("/admin/partidos/nuevo"), keys: "n" } : null;
  const base = `/admin/partidos/${h.m.id}`;
  const j = jWord(h.m);
  const called = (h.m.starters?.length ?? 0) + (h.m.bench?.length ?? 0);
  switch (h.phase) {
    case "antes":
      if (h.m.convocatoriaNotifiedAt && a && a.counts.none) return { label: `Recordar a los ${a.counts.none} que faltan`, onClick: () => go(`${base}/convocatoria`) };
      if (h.m.convocatoriaNotifiedAt) return { label: `Ver la convocatoria de la ${j}`, onClick: () => go(`${base}/convocatoria`) };
      return { label: called >= 7 ? `Mandar la convocatoria de la ${j}` : `Hacer la convocatoria de la ${j}`, onClick: () => go(`${base}/convocatoria`) };
    case "juego":
    case "descanso":
      return { label: "Abrir la mesa", onClick: () => go(`/partidos/${h.m.id}/mesa`) };
    case "final":
      return h.review.missingScorers || !h.review.cuadra ? { label: `Completar el acta de la ${j}`, onClick: () => go(`${base}/acta`) } : { label: `Publicar el acta de la ${j}`, onClick: () => go(`${base}/publicar`) };
    case "pendiente":
      return { label: `Apuntar el resultado de la ${j}`, onClick: () => go(`${base}/acta`) };
    case "publicado":
      return h.m.draft ? { label: `Revisar la corrección de la ${j}`, onClick: () => go(`${base}/acta`) } : { label: "Después del partido", onClick: () => go(`${base}/despues`) };
    default:
      return { label: "Datos del partido", onClick: () => go(`${base}/datos`) };
  }
}

// ───────────────────────── the hero ─────────────────────────
function Hero({ row, answers }: { row: MatchRowView; answers: Answers | null }) {
  const data = useAdmin();
  const { m, phase, t } = row;
  const rival = m.rival || "Rival por confirmar";
  const venue = m.venue ? venueName(m.venue) : "";
  const kit: Kit = m.kit === "away" ? "away" : m.kit === "home" ? "home" : m.home === false ? "away" : "home";
  const meta = [Number.isFinite(t) ? `${shortDate(t)} · ${clockTime(t)}` : "sin fecha", m.home === false ? "fuera" : "en casa", venue, kitLabel({ kit }, "1ª equipación")].filter(Boolean).join(" · ");
  const titleId = `hy-hero-t`;
  return (
    <section className="hy-hero" aria-labelledby={titleId}>
      <header className="hy-hero__h">
        <p className="sc-k">{heroKicker(phase)}</p>
        <h2 className="hy-hero__t" id={titleId}>
          <span className="sc-morph" style={{ viewTransitionName: matchVt(m.id) }}>
            {m.jornada ? `J${m.jornada} · ` : ""}
            {rival}
          </span>
        </h2>
        <p className="hy-hero__m">{meta}</p>
        {phase === "antes" && Number.isFinite(t) && t > data.now && (
          <p className="hy-hero__left">
            <span>Faltan</span>
            <b className="sc-num">{left(t, data.now)}</b>
          </p>
        )}
      </header>
      <ol className="sc-carril hy-carril" style={{ ["--n" as string]: row.stations.length }} aria-label="Las estaciones de la jornada">
        {row.stations.map((s) => (
          <li key={s.id}>
            <SalaLink to={s.path} className={`sc-station is-${s.state}`} aria-label={stationLabel(s)}>
              <span className="sc-station__dot vd-glass">
                <VIcon name={s.icon} size={19} className="sc-i" />
              </span>
              <b aria-hidden="true">{s.name}</b>
              <small aria-hidden="true">{s.word}</small>
            </SalaLink>
          </li>
        ))}
      </ol>
      {phase === "antes" && answers && <HeroAntes row={row} answers={answers} kit={kit} />}
      {isLive(phase) && <HeroLive row={row} />}
      {(phase === "final" || phase === "publicado") && <HeroAfter row={row} />}
      {phase === "pendiente" && <HeroPendiente row={row} />}
      {(phase === "aplazado" || phase === "cancelado") && (
        <div className="hy-after">
          <p className="sc-p hy-after__line">{phase === "aplazado" ? `Aplazado${m.postponedReason ? `: ${m.postponedReason}` : ""}. ${m.postponedTo ? `Nueva fecha: ${shortDate(m.postponedTo)} a las ${clockTime(m.postponedTo)}.` : "La nueva fecha, por decidir."}` : "Cancelado: no cuenta para las estadísticas."}</p>
          <div className="hy-hero__a">
            <SalaLink className="vd-btn vd-glass vd-press" to={`/admin/partidos/${m.id}/datos`}>
              Datos del partido
            </SalaLink>
          </div>
        </div>
      )}
    </section>
  );
}

const SCORE_DASH = "⁠–⁠";

function HeroAntes({ row, answers, kit }: { row: MatchRowView; answers: Answers; kit: Kit }) {
  const data = useAdmin();
  const { width } = useFrame();
  const { m } = row;
  const people = useMemo(() => data.roster.map((p) => ({ name: p.name, number: p.number })), [data.roster]);
  const still = useShirts(people, kit);
  const byId = new Map(data.roster.map((p) => [p.id, p]));
  const notified = m.convocatoriaNotifiedAt;
  const called = (m.starters?.length ?? 0) + (m.bench?.length ?? 0);
  const max = width < 700 ? 6 : width >= 1800 ? 16 : 12;
  const convLine = notified ? `Mandada ${relDay(notified, data.now)} · ${answers.counts.yes} de ${answers.counts.all} vienen` : called ? `${called} colgados · sin mandar todavía` : "Nadie colgado todavía · se responde cuando la mandes";
  const starters = m.starters ?? [];
  const nameOf = withGuestNames(m, (id) => byId.get(id)?.name ?? "");
  const sevenWhy = starters.length >= 7 ? "Siete de siete · el resto, al banquillo" : starters.length ? `${starters.length} de 7 · el resto se decide en la mesa` : "Por decidir · se elige en la pizarra o en la convocatoria";
  const base = `/admin/partidos/${m.id}`;
  return (
    <div className="hy-conv hy-antes">
      <div className="hy-conv__h">
        <h3 className="sc-h3">La convocatoria</h3>
        <p className="sc-small">{convLine}</p>
      </div>
      <ul className="hy-ans" aria-label="Respuestas a la convocatoria">
        {answers.groups.map((g) => {
          const aus = g.people.filter((x) => x.absent).length;
          return (
            <li key={g.id} className={`hy-ans__g is-${g.id}`}>
              <p className="hy-ans__t">
                <b>{g.name}</b>
                <span className="sc-num">{g.people.length}</span>
              </p>
              {aus > 0 && <p className="hy-ans__sub">{plural(aus, "ausente", "ausentes")} con fecha</p>}
              <div className="hy-ans__shirts">
                {g.people.slice(0, max).map((x) => {
                  const p = byId.get(x.id);
                  const who = { name: p?.name ?? "", number: p?.number ?? null };
                  const word = x.absent ? `ausente hasta el ${x.until}` : g.word;
                  return (
                    <span key={x.id} className={`hy-ans__p${x.absent ? " is-absent" : ""}`} title={`${who.name} · ${word}`} role="img" aria-label={`${who.name}, ${word}`}>
                      <Shirt src={still(who)} who={who} kit={kit} size="s" />
                    </span>
                  );
                })}
                {g.people.length > max && <span className="hy-ans__more">+{g.people.length - max}</span>}
                {!g.people.length && <span className="sc-small">Nadie</span>}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="hy-seven">
        <p className="hy-seven__t">
          <b>El siete</b>
          <span>{sevenWhy}</span>
        </p>
        <ol className="hy-seven__slots" aria-label={`El siete: ${starters.length} de 7`}>
          {Array.from({ length: 7 }, (_, i) => {
            const id = starters[i];
            if (!id)
              return (
                <li key={`free-${i}`} className="hy-slot is-free">
                  <span className="hy-slot__free" aria-hidden="true" />
                  <small>Libre</small>
                </li>
              );
            const p = byId.get(id);
            const who = { name: p?.name ?? nameOf(id), number: p?.number ?? null };
            return (
              <li key={id} className="hy-slot is-on">
                <Shirt src={p ? still(who) : undefined} who={who} kit={kit} size="m" />
                <small>{who.name}</small>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="hy-hero__a">
        <SalaLink className="vd-btn vd-glass vd-press vd-btn--pri" to={`${base}/convocatoria`}>
          {notified ? "Ver la convocatoria" : called >= 7 ? "Mandar la convocatoria" : "Hacer la convocatoria"}
        </SalaLink>
        <SalaLink className="vd-btn vd-glass vd-press" to={`${base}/datos`}>
          Datos del partido
        </SalaLink>
      </div>
    </div>
  );
}

function useNameOf(m: AdminMatch) {
  const data = useAdmin();
  const byId = new Map(data.roster.map((p) => [p.id, p.name]));
  return withGuestNames(m, (id) => byId.get(id) ?? data.players.find((p) => p.id === id)?.shirtName ?? "—");
}

function Score({ m, gf, ga, letter }: { m: AdminMatch; gf: number; ga: number; letter?: boolean }) {
  const rival = m.rival || "Rival";
  const r = resultLetter(gf, ga);
  return (
    <p className="hy-live__score">
      <span className="vd-vh">
        Manchester Piti {gf}, {rival} {ga}
        {letter ? ` · ${resultWord(r).toLowerCase()}` : ""}
      </span>
      <span className="hy-live__us" aria-hidden="true">
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
}

function HeroLive({ row }: { row: MatchRowView }) {
  const { m, review, t } = row;
  const { desktop } = useFrame();
  const nameOf = useNameOf(m);
  const plays = liveLog(m.events, m.rival || "el rival", nameOf).slice(0, desktop ? 6 : 4);
  const second = m.clock?.phase === "second";
  return (
    <div className="hy-live">
      <Score m={m} gf={review.goalsFor} ga={review.goalsAgainst} />
      <p className="hy-live__clock">
        <span className="sc-tag sc-tag--live">{row.phase === "descanso" ? "Descanso" : "En juego"}</span>
        <span className="sc-clock">
          <LiveClock start={t} match={m} />
        </span>
        <span>{row.phase === "descanso" ? "Descanso" : second ? "2ª parte" : "1ª parte"}</span>
        <span className="sc-small">Anota {m.mesa?.name || "un capitán"} desde la mesa</span>
      </p>
      <ol className="sc-rows hy-plays" aria-label="Lo que va pasando">
        {plays.map((p) => (
          <li key={p.id} className={`sc-row hy-play is-${p.cls === "rv" ? "suyo" : p.icon === "ball" ? "gol" : "otro"}`}>
            <span className="hy-play__min">{p.minute}′</span>
            <span className="sc-row__t">
              <b>{p.text}</b>
              {p.detail && <span>{p.detail}</span>}
            </span>
          </li>
        ))}
        {!plays.length && (
          <li className="sc-row hy-play">
            <span className="sc-row__t">
              <span>Todavía nada: cada gol, tarjeta y cambio de la mesa sale aquí.</span>
            </span>
          </li>
        )}
      </ol>
      <div className="hy-hero__a">
        <Link className="vd-btn vd-glass vd-press vd-btn--pri" to="/partidos/$matchId/mesa" params={{ matchId: m.id }}>
          Abrir la mesa
        </Link>
        <SalaLink className="vd-btn vd-glass vd-press" to={`/admin/partidos/${m.id}/en-juego`}>
          Ver lo que llega al acta
        </SalaLink>
      </div>
    </div>
  );
}

function HeroAfter({ row }: { row: MatchRowView }) {
  const data = useAdmin();
  const { m, review, phase } = row;
  const nameOf = useNameOf(m);
  const base = `/admin/partidos/${m.id}`;
  const ours = (m.events ?? []).filter((e) => e.type === "goal" || e.type === "goal_penalty" || e.type === "goal_freekick");
  const goals = ours.filter((e) => e.playerId).map((e) => `${nameOf(e.playerId!)} ${typeof e.minute === "number" ? `${e.minute}′` : ""}`.trim());
  const miss = review.missingScorers;
  const r = resultLetter(review.goalsFor, review.goalsAgainst);
  if (phase === "final") {
    const fix = miss || !review.cuadra;
    return (
      <div className="hy-after">
        <Score m={m} gf={review.goalsFor} ga={review.goalsAgainst} letter />
        <p className="sc-p hy-after__line">Pitado el final en la mesa. {miss ? `Falta el goleador de ${plural(miss, "gol", "goles")}: sin él no se publica.` : review.cuadra ? "El acta cuadra: revisa y publica." : "Falta completar el acta antes de publicarla."}</p>
        <ul className="sc-rows hy-after__rows">
          <li className="sc-row">
            <span className="sc-row__t">
              <b>Goles del Piti</b>
              <span>{goals.join(" · ") || "Ninguno"}</span>
            </span>
            {miss > 0 && <span className="sc-tag sc-tag--toca">Falta {miss}</span>}
          </li>
          <li className="sc-row">
            <span className="sc-row__t">
              <b>La mesa</b>
              <span>
                Anotó {m.mesa?.name || "un capitán"} · {plural((m.events ?? []).length, "jugada", "jugadas")}
              </span>
            </span>
          </li>
        </ul>
        <div className="hy-hero__a">
          <SalaLink className="vd-btn vd-glass vd-press vd-btn--pri" to={`${base}${fix ? "/acta" : "/publicar"}`}>
            {fix ? "Completar el acta" : "Revisar y publicar"}
          </SalaLink>
        </div>
      </div>
    );
  }
  const notas = m.notas ? Object.entries(m.notas.players ?? {}).map(([id, n]) => ({ id, n: n.nota })).sort((a, b) => b.n - a.n) : [];
  const open = (m.voteClosesAt ?? 0) > data.now;
  return (
    <div className="hy-after">
      <Score m={m} gf={review.goalsFor} ga={review.goalsAgainst} letter />
      <p className="sc-p hy-after__line">
        {m.draft ? "La web cuenta el acta publicada; hay una corrección en borrador sin publicar. " : ""}
        Así lo cuenta la web: {r === "G" ? "ganamos" : r === "P" ? "perdimos" : "empatamos"} {review.goalsFor}–{review.goalsAgainst} {m.home === false ? "fuera" : "en casa"}
        {goals.length ? `, con goles de ${list(goals)}` : ""}.
      </p>
      <ul className="sc-rows hy-after__rows">
        <li className="sc-row">
          <span className="sc-row__t">
            <b>MVP</b>
            <span>{open && m.voteClosesAt ? `Votación abierta · cierra el ${shortDate(m.voteClosesAt)} a las ${clockTime(m.voteClosesAt)}` : m.voteClosesAt ? "Votación cerrada" : "Se abre al publicar"}</span>
          </span>
          {open && <span className="sc-tag sc-tag--quiet">Abierta</span>}
        </li>
        <li className="sc-row">
          <span className="sc-row__t">
            <b>Las notas</b>
            <span>{notas.length ? `Congeladas al publicar · mejor ${nameOf(notas[0].id)} ${String(notas[0].n.toFixed(1)).replace(".", ",")}` : "Se calculan al publicar el acta"}</span>
          </span>
        </li>
      </ul>
      <div className="hy-hero__a">
        <SalaLink className="vd-btn vd-glass vd-press vd-btn--pri" to={m.draft ? `${base}/acta` : `${base}/despues`}>
          {m.draft ? "Revisar la corrección" : "Después del partido"}
        </SalaLink>
        <a className="vd-btn vd-glass vd-press" href={`/partidos/${m.id}`} target="_blank" rel="noopener">
          Ver en la web
          <span className="vd-vh"> (se abre en otra pestaña)</span>
        </a>
      </div>
    </div>
  );
}

function HeroPendiente({ row }: { row: MatchRowView }) {
  const { m, t } = row;
  const base = `/admin/partidos/${m.id}`;
  return (
    <div className="hy-after">
      <p className="sc-p hy-after__line">
        Era el {shortDate(t)} a las {clockTime(t)} y no llegó a la mesa: sin reloj y sin acta. ¿Se jugó? Apunta el resultado, o márcalo aplazado o cancelado.
      </p>
      <div className="hy-hero__a">
        <SalaLink className="vd-btn vd-glass vd-press vd-btn--pri" to={`${base}/acta`}>
          Apuntar el resultado
        </SalaLink>
        <SalaLink className="vd-btn vd-glass vd-press" to={`${base}/datos?estado=aplazado`}>
          Aplazado
        </SalaLink>
        <SalaLink className="vd-btn vd-glass vd-press" to={`${base}/datos?estado=cancelado`}>
          No se jugó
        </SalaLink>
      </div>
    </div>
  );
}

function NoHero({ emptySeason, hasMatches }: { emptySeason: string | null; hasMatches: boolean }) {
  return (
    <section className="hy-hero hy-empty" aria-labelledby="hy-none-t">
      <Shirt blank size="l" />
      <h2 className="sc-h2" id="hy-none-t">
        Sin partidos a la vista
      </h2>
      <p className="sc-p">
        {!hasMatches && emptySeason
          ? `La ${emptySeason} está en preparación: sin partidos todavía. Cuando programéis el primero, aquí estará su convocatoria; el día del partido, su marcador.`
          : "Cuando programéis el siguiente, aquí estará su convocatoria; el día del partido, su marcador."}
      </p>
      <div className="hy-hero__a">
        <SalaLink className="vd-btn vd-glass vd-press vd-btn--pri" to="/admin/partidos/nuevo">
          Nuevo partido
        </SalaLink>
      </div>
    </section>
  );
}

// ───────────────────────── Te toca ─────────────────────────
function Toca({ items, done, after, now }: { items: TocaItem[]; done: { title: string; detail: string }[]; after: MatchRowView[]; now: number }) {
  const { width } = useFrame();
  const [more, setMore] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const cap = width >= 1800 ? 8 : 6;
  const shown = more ? items : items.slice(0, cap);
  return (
    <section className="hy-toca" aria-labelledby="hy-toca-t">
      <header className="sc-sec__h">
        <h2 className="sc-h2" id="hy-toca-t">
          Te toca
        </h2>
        {items.length > 0 && <span className="sc-sec__n">{items.length}</span>}
      </header>
      {!items.length && <p className="hy-clear">Nada pendiente. Todo al día.</p>}
      <ul className="sc-rows hy-rows">
        {shown.map((t) => (
          <li key={t.id} className="sc-row hy-row">
            <span className="sc-row__t">
              <b>{t.title}</b>
              <span>{t.detail}</span>
              {t.alt && t.alt.length > 0 && (
                <span className="hy-row__alt">
                  {t.alt.map((a) => (
                    <SalaLink key={a.t} className="hy-row__link" to={a.path}>
                      {a.t}
                    </SalaLink>
                  ))}
                </span>
              )}
            </span>
            <SalaLink className="vd-btn vd-glass vd-press vd-btn--sm hy-row__go" to={t.path} aria-label={`${t.action}: ${t.title}`}>
              {t.action}
            </SalaLink>
          </li>
        ))}
      </ul>
      {items.length > cap && (
        <button type="button" className="hy-more" onClick={() => setMore((o) => !o)} aria-expanded={more}>
          {more ? "Ver menos" : `${items.length - cap} más · Ver todo`}
        </button>
      )}
      <div className="hy-done">
        <button type="button" className="hy-done__b" onClick={() => setDoneOpen((o) => !o)} aria-expanded={doneOpen} disabled={!done.length}>
          <span className="sc-tag sc-tag--hecho">{done.length ? plural(done.length, "hecha", "hechas") : "Nada hecho todavía"}</span>
        </button>
        {doneOpen && (
          <ul className="sc-rows hy-done__rows">
            {done.map((x) => (
              <li key={x.title} className="sc-row">
                <span className="sc-row__t">
                  <b>{x.title}</b>
                  <span>{x.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {after.length > 0 && (
        <section className="hy-next" aria-labelledby="hy-next-t">
          <h3 className="sc-h3" id="hy-next-t">
            Lo que viene
          </h3>
          <ul className="sc-rows">
            {after.map((r) => (
              <li key={r.m.id}>
                <SalaLink className="sc-row sc-row--btn hy-next__r" to={`/admin/partidos/${r.m.id}`}>
                  <span className="sc-row__t">
                    <b>
                      {jWord(r.m)} · {r.m.rival || "Rival"}
                    </b>
                    <span>
                      {Number.isFinite(r.t) ? `${shortDate(r.t)} · ${clockTime(r.t)}` : "sin fecha"} · {r.m.home === false ? "fuera" : "en casa"}
                    </span>
                  </span>
                  <span className="sc-small">{Number.isFinite(r.t) ? relDay(r.t, now) : ""}</span>
                </SalaLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
