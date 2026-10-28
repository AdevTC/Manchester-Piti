// HOY Y PARTIDOS · Partidos, la temporada (/admin/partidos), as the board (partidos.js listVals / part-partidos.html
// § 1): the season's jornadas as a table with the mini carril in every row (where each one goes, in words), the
// filters (Todo · Te toca · Por jugar · Jugados · Fuera), search by rival or «J8» (`/`), «Archivados · N» and
// «Nuevo partido» (`n`, the one primary action). ≥ 1100 the table scrolls inside with its head stuck, and the match
// of now stays pinned while the rest scrolls (20+ jornadas). /admin/partidos/nuevo is this same list with the
// «Nuevo partido» sheet over it (Nuevo.tsx).
import { useMemo, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { VIcon } from "../../../../components/vidrio/VIcon";
import { venueName } from "../../../../lib/derived/venue";
import { opponentInitials } from "../../../../lib/clubAnalytics";
import { clockTime, shortDate } from "../../data/adminLogic";
import { MiniCarril } from "../../partido/CarrilNav";
import { useRegisterCommands } from "../../palette/registry";
import type { PaletteCommand } from "../../palette/search";
import { useAdmin } from "../../shell/context";
import { SalaScreen, ScreenError, ScreenLoading } from "../../shell/Screen";
import { SalaLink } from "../../shell/SalaLink";
import { useSalaGo } from "../../shell/salaHref";
import { resultLetter, resultWord } from "../../kit/result";
import { DayLong, fold, plural } from "./fmt";
import { groupOf, hasScore, isDraftOnly, isLive, isOff, isPlayed, jWord, matchVt, rowToca } from "./matchWords";
import { useMatchRows, type MatchRowView } from "./useMatchRows";
import { listUi, type Filter } from "./listUi";
// (the Vidrio controls these screens use, vd-seg and vd-switch: the sala does not load them by itself)
import "../../../../styles/vidrio/components.css";
import "./partidos.css";

const FILTERS: [Filter, string][] = [
  ["todo", "Todo"],
  ["toca", "Te toca"],
  ["jugar", "Por jugar"],
  ["jugados", "Jugados"],
  ["fuera", "Fuera"],
];

export function TemporadaScreen() {
  return <TemporadaList />;
}

/** The season's list; `sheet`: what opens over it (Nuevo partido). */
export function TemporadaList({ sheet }: { sheet?: ReactNode }) {
  const data = useAdmin();
  if (data.loading && !data.matches.length) return <ScreenLoading label="Cargando los partidos" />;
  if (data.error && !data.matches.length) return <ScreenError what="los partidos" onRetry={() => window.location.reload()} />;
  return <SeasonTable sheet={sheet} />;
}

function SeasonTable({ sheet }: { sheet?: ReactNode }) {
  const data = useAdmin();
  const go = useSalaGo();
  const { filter, q } = useSyncExternalStore(listUi.subscribe, listUi.get, listUi.get);
  const all = useMatchRows(data);
  const sid = data.season?.id;
  const rows = useMemo(() => all.filter((r) => !sid || r.m.seasonId === sid).sort((a, b) => (Number.isFinite(a.t) ? a.t : 9e15) - (Number.isFinite(b.t) ? b.t : 9e15)), [all, sid]);
  const nextId = data.next?.match.id;
  const nowId = data.hero?.match.id ?? nextId;
  const toca = (r: MatchRowView) => rowToca({ phase: r.phase, stations: r.stations, date: r.t, isNext: r.m.id === nextId, now: data.now });
  const counts: Record<Filter, number> = { todo: rows.length, toca: 0, jugar: 0, jugados: 0, fuera: 0 };
  for (const r of rows) {
    counts[groupOf(r.phase)]++;
    if (toca(r)) counts.toca++;
  }
  const fq = fold(q);
  const jq = /^j?\s*(\d{1,2})$/.exec(fq);
  const shown = rows.filter((r) => {
    if (filter === "toca" && !toca(r)) return false;
    if (filter !== "todo" && filter !== "toca" && groupOf(r.phase) !== filter) return false;
    if (!fq) return true;
    if (jq) return r.m.jornada === Number(jq[1]);
    return fold(r.m.rival).includes(fq);
  });
  const name = data.season?.name ?? "Temporada";
  const jornadas = rows.filter((r) => r.m.jornada).length;
  const jugadas = rows.filter((r) => isPlayed(r.phase)).length;
  const drafts = rows.filter((r) => isDraftOnly(r.m)).length;
  const line = [name, plural(jornadas, "jornada", "jornadas"), plural(jugadas, "jugada", "jugadas"), ...(drafts ? [plural(drafts, "borrador", "borradores")] : []), counts.toca ? `te toca ${counts.toca}` : "nada pendiente"].join(" · ");
  const fi = Math.max(0, FILTERS.findIndex((f) => f[0] === filter));

  const cmds = useMemo<PaletteCommand[]>(
    () => [
      { id: "partidos:archivados", group: "Acciones", icon: "▤", title: "Partidos archivados", description: plural(data.archivedMatches.length, "partido", "partidos"), keywords: "archivo reactivar", run: () => go("/admin/partidos/archivados") },
      ...(data.next ? [{ id: "partidos:datos", group: "Acciones" as const, icon: "✎", title: `Datos de la ${jWord(data.next.match)}`, description: `${data.next.match.rival || "Rival"} · campo, hora, anotadores`, keywords: "encuentro campo hora anotador datos", run: () => go(`/admin/partidos/${data.next!.match.id}/datos`) }] : []),
    ],
    [data.archivedMatches.length, data.next, go],
  );
  useRegisterCommands(cmds);

  return (
    <SalaScreen title="Partidos" lede={line} fit className="pa pa-list" primary={{ label: "Nuevo partido", icon: "plus", keys: "n", popup: true, onClick: () => go("/admin/partidos/nuevo") }}>
      <div className="pa-tools">
        <div className="vd-seg vd-glass pa-seg" role="tablist" aria-label="Qué partidos ver" style={{ "--n": FILTERS.length, "--i": fi } as CSSProperties}>
          <span className="vd-shelf__bead" aria-hidden="true" />
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" role="tab" className="vd-seg__b" aria-selected={filter === id} aria-controls="pa-rows" onClick={() => listUi.set({ filter: id })}>
              {label}
              {id !== "todo" && <span className="pa-seg__n">{counts[id]}</span>}
            </button>
          ))}
        </div>
        <label className="pa-search">
          <span className="vd-vh">Buscar partido</span>
          <VIcon name="search" size={18} className="sc-i" />
          <input className="vd-input" type="search" placeholder="Rival o jornada (J8)" value={q} onChange={(e) => listUi.set({ q: e.target.value })} aria-keyshortcuts="/" autoComplete="off" />
        </label>
        <SalaLink to="/admin/partidos/archivados" className="vd-link pa-archlink">
          <VIcon name="post" size={18} className="sc-i" />
          Archivados · {data.archivesLoading ? "…" : data.archivedMatches.length}
        </SalaLink>
      </div>

      <section className="pa-season" aria-labelledby="pa-season-t">
        <h2 className="vd-vh" id="pa-season-t">
          La temporada
        </h2>
        <div className="pa-scroll sc-scroll">
          <div className="pa-thead" aria-hidden="true">
            <span>J</span>
            <span>Fecha</span>
            <span>Rival</span>
            <span>Dónde</span>
            <span>Resultado</span>
            <span>El carril</span>
            <span className="pa-xl">Campo</span>
            <span className="pa-xl">Anota</span>
            <span className="pa-xl">MVP</span>
          </div>
          <ol className="pa-rows" id="pa-rows" aria-label={`Partidos de la ${name}: ${plural(shown.length, "fila", "filas")}`}>
            {shown.map((r) => (
              <Row key={r.m.id} r={r} isNow={r.m.id === nowId} toca={toca(r)} />
            ))}
          </ol>
          {!shown.length && fq && <p className="pa-empty">Ningún partido con «{q}».</p>}
          {!shown.length && !fq && rows.length > 0 && <p className="pa-empty">Ningún partido con ese filtro.</p>}
          {!rows.length && (
            <div className="pa-empty pa-empty--all">
              <h3 className="sc-h3">Todavía no hay partidos</h3>
              <p className="sc-p">Crea el primero con «Nuevo partido»: rival, fecha y hora. El resto, cuando lo sepas.</p>
            </div>
          )}
        </div>
      </section>
      {sheet}
    </SalaScreen>
  );
}

function Row({ r, isNow, toca }: { r: MatchRowView; isNow: boolean; toca: boolean }) {
  const data = useAdmin();
  const { m, phase, review, stations, station, t } = r;
  const cur = stations.find((s) => s.id === station) ?? stations[0];
  const sc = hasScore(phase);
  const letter = sc && isPlayed(phase) ? resultLetter(review.goalsFor, review.goalsAgainst) : null;
  const score = `${review.goalsFor}–${review.goalsAgainst}`;
  const resText = sc
    ? ""
    : isOff(phase)
      ? phase === "aplazado"
        ? m.postponedTo
          ? `Nueva fecha ${shortDate(m.postponedTo)}`
          : "Por decidir"
        : "No se juega"
      : phase === "pendiente"
        ? "sin resultado"
        : Number.isFinite(t)
          ? clockTime(t)
          : "—";
  const tag = isDraftOnly(m) ? (phase === "cancelado" ? "Borrador cancelado" : "Borrador") : phase === "aplazado" ? "Aplazado" : phase === "cancelado" ? "Cancelado" : m.draft && phase === "publicado" ? "Corrección en borrador" : "";
  const rival = m.rival || "Rival por confirmar";
  const mvp = phase === "publicado" ? ((m.voteClosesAt ?? 0) > data.now ? "Votando" : m.voteClosesAt ? "Cerrado" : "—") : "—";
  const label = [
    m.jornada ? `J${m.jornada}` : jWord(m),
    rival,
    Number.isFinite(t) ? `${DayLong(t)} a las ${clockTime(t)}` : "sin fecha",
    m.home === false ? "fuera" : "en casa",
    sc ? (letter ? `${resultWord(letter)} ${score}` : `En juego ${score}`) : resText,
    tag,
    `${cur.name}: ${cur.word}`,
    isNow ? "ahora" : "",
    toca ? "te toca" : "",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <li className={["pa-r", isNow ? "is-now" : "", toca ? "is-toca" : "", isOff(phase) ? "is-off" : ""].filter(Boolean).join(" ")}>
      <SalaLink to={`/admin/partidos/${m.id}`} className="pa-row" aria-label={label}>
        <span className="pa-row__j">{m.jornada ? `J${m.jornada}` : "—"}</span>
        <span className="pa-row__when">
          <b>{Number.isFinite(t) ? shortDate(t) : "sin fecha"}</b>
          <span className="sc-clock">{Number.isFinite(t) ? clockTime(t) : ""}</span>
        </span>
        <span className="pa-row__rival">
          <span className="sc-rival">
            <i aria-hidden="true">{(m.rivalInitials || opponentInitials(rival)).slice(0, 2)}</i>
            <span className="sc-morph pa-row__name" style={{ viewTransitionName: matchVt(m.id) }}>
              {rival}
            </span>
          </span>
          {tag && <span className="sc-tag sc-tag--quiet">{tag}</span>}
          {isNow && <span className="sc-tag sc-tag--toca">Ahora</span>}
        </span>
        <span className="pa-row__where">{m.home === false ? "Fuera" : "Casa"}</span>
        <span className={`pa-row__res${phase === "pendiente" ? " is-toca" : ""}`}>
          {sc ? (
            <>
              {letter && <span className={`sc-res sc-res--${letter}`}>{letter}</span>}
              {isLive(phase) && <span className="sc-tag sc-tag--live">En juego</span>}
              <b className="sc-score pa-row__score">{score}</b>
            </>
          ) : (
            <span className="pa-row__restext">{resText}</span>
          )}
        </span>
        <span className="pa-row__carril">
          <MiniCarril stations={stations} current={station} className="pa-mini" />
        </span>
        <span className="pa-xl pa-row__x">{m.venue ? venueName(m.venue) : "—"}</span>
        <span className="pa-xl pa-row__x">{m.mesa?.name || "—"}</span>
        <span className="pa-xl pa-row__x">{mvp}</span>
      </SalaLink>
    </li>
  );
}
