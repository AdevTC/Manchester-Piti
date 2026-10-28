// HOY Y PARTIDOS · Archivados (/admin/partidos/archivados) and one archived match (/archivados/<id>), as the board
// (partidos.js archVals / part-partidos.html § 3): out of the calendar and the statistics, searchable by rival; one
// opens in read only (when, why it is archived, the ground, the competition, el siete, the banquillo, its events)
// with «Reactivar» (blocked, saying why, while its season is archived) and «Borrar definitivamente», each asking first.
// ≥ 1100 the list and the match side by side; below, the list, and the match on its own screen.
import { useMemo, useState } from "react";
import { eventMinute } from "../../../../../functions/src/matchEngine";
import { EVENT_LABELS, dateMillis } from "../../../../lib/clubData";
import { apiError, deleteMatch, setMatchArchived } from "../../../../lib/clubApi";
import { VIcon } from "../../../../components/vidrio/VIcon";
import { namesFor } from "../../acta/roster";
import { clockTime } from "../../data/adminLogic";
import { archivedScore, type ArchivedMatch } from "../../data/archivedMatches";
import { resultLetter } from "../../kit/result";
import { useParams } from "@tanstack/react-router";
import { useAdmin } from "../../shell/context";
import { Region, SalaScreen, ScreenError, ScreenLoading } from "../../shell/Screen";
import { SalaLink } from "../../shell/SalaLink";
import { SalaSheet } from "../../shell/Sheet";
import { useSalaGo } from "../../shell/salaHref";
import { useStatus } from "../../shell/statusContext";
import { useFrame } from "../../ui/frame";
import { DayLong, fold, plural, yearOf } from "./fmt";
import { opponentInitials } from "../../../../lib/clubAnalytics";
// (the Vidrio controls these screens use, vd-seg and vd-switch: the sala does not load them by itself)
import "../../../../styles/vidrio/components.css";
import "./partidos.css";

export function ArchivadosScreen() {
  return <Archive id={null} />;
}
export function ArchivadoScreen() {
  const { matchId = "" } = useParams({ strict: false }) as { matchId?: string };
  return <Archive id={matchId} />;
}

function Archive({ id }: { id: string | null }) {
  const data = useAdmin();
  const { desktop } = useFrame();
  const [q, setQ] = useState("");
  const list = useMemo(() => [...data.archivedMatches].sort((a, b) => dateMillis(b.date) - dateMillis(a.date)), [data.archivedMatches]);
  const fq = fold(q);
  const shown = list.filter((m) => !fq || fold(m.rival).includes(fq));
  const one = id ? (list.find((m) => m.id === id) ?? null) : null;
  const loading = data.archivesLoading && !list.length;
  const title = id ? (one ? `Piti ${archivedScore(one) ?? "–"} ${one.rival || "Rival"}` : "No está") : "Archivados";
  const lede = `Fuera del calendario y de las estadísticas: ${plural(list.length, "partido", "partidos")}. Se consulta su acta o se reactiva.`;
  const back = id && !desktop ? { to: "/admin/partidos/archivados", label: "Volver a Archivados" } : { to: "/admin/partidos", label: "Volver a Partidos" };
  if (data.archivesError && !list.length) return <ScreenError what="los partidos archivados" onRetry={() => window.location.reload()} />;
  const listRegion = (
    <Region title="Partidos archivados" count={loading ? "…" : String(list.length)} className="pa-arch__list">
      <label className="pa-search">
        <span className="vd-vh">Buscar partido archivado</span>
        <VIcon name="search" size={18} className="sc-i" />
        <input className="vd-input" type="search" placeholder="Buscar rival archivado" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </label>
      {loading ? (
        <ScreenLoading label="Cargando los archivados" />
      ) : (
        <ol className="sc-rows pa-arows">
          {shown.map((m) => (
            <ArchRow key={m.id} m={m} current={m.id === id} />
          ))}
        </ol>
      )}
      {!loading && !list.length && <p className="pa-empty">No hay partidos archivados. Los que archives aparecerán aquí para consultarlos o reactivarlos.</p>}
      {!loading && list.length > 0 && !shown.length && <p className="pa-empty">Ningún partido archivado con «{q}».</p>}
    </Region>
  );
  const detail = (
    <Region label="El partido archivado" className="pa-arch__one">
      {!id && <p className="pa-empty pa-arch__hint">Elige uno de la lista para ver su acta en solo lectura.</p>}
      {id && !one && !loading && <p className="pa-empty">Ese partido ya no está en el archivo.</p>}
      {one && <ArchDetail m={one} />}
    </Region>
  );
  return (
    <SalaScreen title={title} headTitle={id ? title : "Archivados"} kicker={!id ? <SalaLink className="vd-link pa-up" to="/admin/partidos">‹ Partidos</SalaLink> : undefined} lede={id ? undefined : lede} headSub={id ? "Archivado" : `${plural(list.length, "partido", "partidos")} fuera del calendario`} back={back} fit className="pa pa-arch">
      {desktop ? (
        <div className="sc-split pa-arch__grid">
          {listRegion}
          {detail}
        </div>
      ) : id ? (
        detail
      ) : (
        listRegion
      )}
    </SalaScreen>
  );
}

function why(m: ArchivedMatch): string {
  return m.individuallyArchived ? "Archivado a mano" : "Temporada archivada";
}

function ArchRow({ m, current }: { m: ArchivedMatch; current: boolean }) {
  const data = useAdmin();
  const t = dateMillis(m.date);
  const score = archivedScore(m);
  const season = data.seasons.find((s) => s.id === m.seasonId)?.name ?? "Sin temporada";
  const letter = score ? resultLetter(m.goalsFor ?? 0, m.goalsAgainst ?? 0) : null;
  const rival = (m.rival || "Rival pendiente").replace(/\s+/g, " ");
  return (
    <li>
      <SalaLink
        to={`/admin/partidos/archivados/${m.id}`}
        className="sc-row sc-row--btn pa-arow"
        aria-current={current ? "page" : undefined}
        aria-label={`Archivado: Manchester Piti ${score ? `${score} ` : ""}${rival}, ${Number.isFinite(t) ? `${DayLong(t)} de ${yearOf(t)}` : "sin fecha"}, ${season}, ${why(m).toLowerCase()}${m.published ? "" : ", borrador"}`}
      >
        <span className="pa-arow__when">
          <b>{Number.isFinite(t) ? DayLong(t).split(" ").slice(1).join(" ") : "—"}</b>
          <span>{Number.isFinite(t) ? yearOf(t) : ""}</span>
        </span>
        <span className="sc-row__t">
          <b className="sc-rival">
            <i aria-hidden="true">{opponentInitials(rival).slice(0, 2)}</i>
            {rival}
          </b>
          <span>
            {season} · {why(m)}
            {!m.published ? " · borrador" : m.draft ? " · con borrador" : ""}
          </span>
        </span>
        <span className="pa-arow__res">
          {letter && <span className={`sc-res sc-res--${letter}`}>{letter}</span>}
          <b className="sc-score">{score ?? "sin acta"}</b>
        </span>
      </SalaLink>
    </li>
  );
}

function ArchDetail({ m }: { m: ArchivedMatch }) {
  const data = useAdmin();
  const go = useSalaGo();
  const status = useStatus();
  const [ask, setAsk] = useState<"react" | "del" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const season = data.seasons.find((s) => s.id === m.seasonId);
  const seasonName = season?.name ?? "Sin temporada";
  const players = useMemo(() => [...data.players, ...data.archivedPlayers.filter((p) => !data.players.some((a) => a.id === p.id))], [data.players, data.archivedPlayers]);
  const names = namesFor(players, data.seasons, m.seasonId ?? "");
  const guestName = (id: string) => m.guests?.find((g) => `guest:${g.id}` === id)?.name;
  const who = (id: string) => (guestName(id) ? `${guestName(id)} (invitado)` : names(id));
  const t = dateMillis(m.date);
  const score = archivedScore(m);
  const rival = (m.rival || "Rival pendiente").replace(/\s+/g, " ");
  const blocked = !!season?.archived;
  const reactWhy = blocked
    ? `Reactiva primero «${seasonName}» desde Club › Temporadas: un partido no vuelve al calendario de una temporada archivada.`
    : `Reactivar lo devuelve al calendario y a las estadísticas${m.draft || !m.published ? ", y recupera su borrador." : "."}`;
  const events = [...(m.events ?? [])].sort((a, b) => (eventMinute(a) ?? Infinity) - (eventMinute(b) ?? Infinity));
  const facts = [
    { k: "Campo", v: m.venue || "Sin datos registrados" },
    { k: "Competición", v: m.competition || "Sin datos registrados" },
    { k: "Siete inicial", v: m.starters?.length ? m.starters.map(who).join(", ") : "Sin datos registrados" },
    { k: "Banquillo", v: m.bench?.length ? m.bench.map(who).join(", ") : "Sin datos registrados" },
    { k: "Eventos", v: `${plural(events.length, "evento", "eventos")} (se conservan)` },
  ];
  const run = async (action: "react" | "del") => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (action === "del") await deleteMatch({ id: m.id });
      else await setMatchArchived({ id: m.id, archived: false });
      setAsk(null);
      status.show({ tag: action === "del" ? "Borrado" : "Reactivado", message: `${rival} · ${action === "del" ? "partido eliminado definitivamente" : "vuelve al calendario y a las estadísticas"}` });
      go(action === "del" ? "/admin/partidos/archivados" : `/admin/partidos/${m.id}`);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };
  const lede = Number.isFinite(t) ? `${DayLong(t)} de ${yearOf(t)} · ${clockTime(t)}` : "Sin fecha";
  return (
    <div className="pa-arch__d">
      <p className="sc-k">Archivado · {seasonName}</p>
      <h2 className="sc-h2 pa-arch__t">
        Manchester Piti {score ?? "–"} {rival}
      </h2>
      <p className="sc-small">
        {lede} · {m.individuallyArchived ? `Archivado a mano${m.draft || !m.published ? " · con borrador" : ""}` : "Su temporada está archivada"}
      </p>
      <p className="pa-ro">
        <span className="sc-tag sc-tag--quiet">Solo lectura</span>
        <span>No aparece en el calendario ni suma a las estadísticas. Conserva sus eventos, votos y porras.</span>
      </p>
      <dl className="pa-dl">
        {facts.map((x) => (
          <div key={x.k}>
            <dt>{x.k}</dt>
            <dd>{x.v}</dd>
          </div>
        ))}
      </dl>
      {events.length > 0 && (
        <ol className="sc-rows pa-arch__ev" aria-label="Eventos del acta archivada">
          {events.map((e) => (
            <li key={e.id} className="sc-row pa-play">
              <span className="pa-play__min sc-clock">{eventMinute(e) == null ? "—" : `${eventMinute(e)}′`}</span>
              <span className="sc-row__t">
                <b>
                  {EVENT_LABELS[e.type] ?? e.type}
                  {e.playerId ? ` · ${who(e.playerId)}` : ""}
                  {e.inPlayerId ? ` → ${who(e.inPlayerId)}` : ""}
                </b>
                {e.assistPlayerId && <span>Pase de {who(e.assistPlayerId)}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {m.report?.trim() && (
        <section className="pa-arch__cr" aria-label="La crónica">
          <h3 className="sc-h3">La crónica</h3>
          <p className="sc-p">{m.report}</p>
        </section>
      )}
      <div className="pa-arch__a">
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" aria-disabled={blocked || undefined} aria-describedby="pa-react-why" aria-haspopup="dialog" onClick={() => (blocked ? status.show({ tone: "error", message: `No se puede: reactiva primero «${seasonName}» desde Club › Temporadas.` }) : setAsk("react"))}>
          Reactivar
        </button>
        <button type="button" className="vd-btn vd-glass vd-press pa-danger" aria-haspopup="dialog" onClick={() => setAsk("del")}>
          Borrar definitivamente
        </button>
      </div>
      <p className="sc-small pa-why" id="pa-react-why">
        {reactWhy}
      </p>
      <SalaSheet
        open={ask === "react"}
        center
        onClose={() => !busy && setAsk(null)}
        title={`¿Reactivar el partido contra ${rival}?`}
        className="pa-dlg"
        footer={
          <>
            <button type="button" className="vd-btn vd-glass vd-press" onClick={() => setAsk(null)} aria-disabled={busy || undefined}>
              Cancelar
            </button>
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" onClick={() => void run("react")} aria-disabled={busy || undefined}>
              {busy ? "Reactivando…" : "Reactivar partido"}
            </button>
          </>
        }
      >
        <p className="sc-p">{lede}</p>
        <ul className="pa-cons">
          <li>{m.published ? "Vuelve al calendario y a la web" : "Vuelve como borrador: sigue sin salir en el calendario hasta que lo publiques"}</li>
          <li>Suma otra vez a las estadísticas, los perfiles y el MVP</li>
        </ul>
        {error && (
          <p className="sc-small pa-bad" role="alert">
            {error}
          </p>
        )}
      </SalaSheet>
      <SalaSheet
        open={ask === "del"}
        center
        alert
        onClose={() => !busy && setAsk(null)}
        title={`¿Borrar definitivamente ${rival}?`}
        className="pa-dlg"
        footer={
          <>
            <button type="button" className="vd-btn vd-glass vd-press" onClick={() => setAsk(null)} aria-disabled={busy || undefined}>
              Cancelar
            </button>
            <button type="button" className="vd-btn vd-glass vd-press pa-danger" onClick={() => void run("del")} aria-disabled={busy || undefined}>
              {busy ? "Borrando…" : "Borrar partido"}
            </button>
          </>
        }
      >
        <p className="sc-p">{lede}</p>
        <ul className="pa-cons">
          <li>Se borran su acta, sus eventos, votos y porras</li>
          <li>Sus minutos y goles desaparecen de los perfiles</li>
          <li>
            <b>No se puede deshacer</b>
          </li>
        </ul>
        {error && (
          <p className="sc-small pa-bad" role="alert">
            {error}
          </p>
        )}
      </SalaSheet>
    </div>
  );
}
