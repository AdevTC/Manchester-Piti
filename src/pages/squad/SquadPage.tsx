import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSeason } from "../../context/SeasonContext";
import { nextFixture, playerForSeason, useClubData } from "../../lib/clubData";
import { analysePlayer, chronological } from "../../lib/clubAnalytics";
import { currentSeasonId } from "../../lib/vestuario";
import { matchesQuery, sortSquad, squadRow, squadSummary, type SquadSort } from "../../lib/squad";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteBackdrop, CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { Icon } from "../../components/celeste/icons";
import { PRINT_FONTS } from "../../components/jersey3d/fonts";
import { Percha } from "./Percha";
import { Ficha } from "./Ficha";
import { CaraACara } from "./CaraACara";
import { SquadCards } from "./SquadCards";
import "../../styles/home.css";
import "../../styles/squad.css";

const SORTS: [SquadSort, string][] = [["num", "Dorsal"], ["name", "Nombre"], ["age", "Edad"], ["height", "Altura"]];
const SORT_LABEL: Record<SquadSort, string> = { num: "dorsal", name: "nombre", age: "edad", height: "altura" };

function scrollToId(id: string) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/** Public squad page: the shirts on the rail, the selected player's ficha, a head-to-head and every card. */
export function SquadPage() {
  const { matches, players, loading, error } = useClubData();
  const { selectedSeasonId, seasons } = useSeason();
  const theme = useDocumentTheme();
  const [now] = useState(() => Date.now());
  const seasonId =
    selectedSeasonId !== "all" && seasons.some((s) => s.id === selectedSeasonId) ? selectedSeasonId : currentSeasonId(nextFixture(matches, now), matches, seasons);
  const seasonName = seasons.find((s) => s.id === seasonId)?.name ?? "Temporada";

  const { rows, withStats } = useMemo(() => {
    const games = chronological(matches.filter((m) => m.seasonId === seasonId));
    const list = players
      .filter((p) => p.seasons?.includes(seasonId))
      .map((raw) => {
        const p = playerForSeason(raw, seasonId, seasons);
        return squadRow(p, analysePlayer(p, games), now);
      });
    return { rows: sortSquad(list, "num"), withStats: games.length > 0 };
  }, [matches, players, seasonId, seasons, now]);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SquadSort>("num");
  const [kit, setKit] = useState<"home" | "away">("home");
  // A random player on every visit, then whoever the viewer picks.
  const [seed] = useState(() => Math.random());
  const [picked, setPicked] = useState<string | null>(null);
  const [duel, setDuel] = useState<[string, string] | null>(null);

  const visible = sortSquad(
    rows.filter((r) => matchesQuery(r, query)),
    sort,
  );
  const selected = rows.find((r) => r.id === picked) ?? rows[Math.floor(seed * rows.length)];
  const summary = squadSummary(rows);

  // Head-to-head: starts with the featured player against the next one with a full ficha.
  const partner = rows.find((r) => r.id !== selected?.id && r.height) ?? rows.find((r) => r.id !== selected?.id);
  const [aId, bId] = duel ?? [selected?.id ?? "", partner?.id ?? ""];
  const a = rows.find((r) => r.id === aId);
  const b = rows.find((r) => r.id === bId);

  const step = (dir: 1 | -1) => {
    const list = visible.length ? visible : sortSquad(rows, sort);
    const at = list.findIndex((r) => r.id === selected?.id);
    setPicked(list[(at + dir + list.length) % list.length].id);
  };
  const pickSide = (side: "a" | "b", id: string) => {
    if (side === "a") setDuel(id === bId ? [id, aId] : [id, bId]);
    else setDuel(id === aId ? [bId, id] : [aId, id]);
  };
  const compareWith = (id: string) => {
    if (id !== aId) setDuel([aId, id]);
    scrollToId("sq-cara");
  };

  return (
    <div className="vx sq" data-kit={kit}>
      <CelesteBackdrop />
      <link rel="stylesheet" href={PRINT_FONTS} precedence="default" />
      <CelesteHeader
        active="plantilla"
        sub="Plantilla"
        actions={
          <>
            <ThemeToggle />
            <Link className="hm-cta-top" to="/vestuario">
              <Icon name="padlock" size={16} stroke={2.2} />
              <span className="t">Vestuario</span>
              <span className="hm-sr">Entrar al vestuario</span>
            </Link>
          </>
        }
      />

      <section className="sq-hero" aria-labelledby="sq-title" aria-busy={loading}>
        <div className="sq-copy">
          <span className="hm-kick">Plantilla · {seasonName}</span>
          <h1 id="sq-title">
            {loading ? (
              "Plantilla"
            ) : (
              <>
                {summary.size} {summary.size === 1 ? "camiseta" : "camisetas"}. <em>Una percha.</em>
              </>
            )}
          </h1>
          <p className="hm-lede">
            {loading ? "Cargando la plantilla…" : "Toca una camiseta para descolgarla: su ficha, la camiseta en 3D y el cara a cara con quien quieras."}
          </p>
          {!loading && rows.length > 0 && (
            <div className="sq-sum">
              <div>
                <b>{summary.size}</b>
                <span>jugadores</span>
              </div>
              <div>
                <b>{summary.avgAge ?? "—"}</b>
                <span>{summary.avgAge ? `años de media (${summary.agesKnown} con fecha)` : "años de media"}</span>
              </div>
              <div>
                <b>{summary.quinta?.count ?? "—"}</b>
                <span>{summary.quinta ? `de la quinta del ${String(summary.quinta.year).slice(2)}` : "sin fechas"}</span>
              </div>
              <div className="g">
                <b>{summary.incomplete}</b>
                <span>fichas por completar</span>
              </div>
            </div>
          )}
          <div className="sq-tools">
            <div className="sq-kit" role="group" aria-label="Equipación">
              <button type="button" aria-pressed={kit === "home"} onClick={() => setKit("home")}>
                <i className="sw" />
                1ª
              </button>
              <button type="button" aria-pressed={kit === "away"} onClick={() => setKit("away")}>
                <i className="sw a" />
                2ª
              </button>
            </div>
            <label className="sq-search">
              <Icon name="search" size={18} stroke={2} />
              <input type="search" aria-label="Buscar jugador" placeholder="Nombre o dorsal" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
        </div>
        {error ? (
          <p className="sq-empty">No se ha podido cargar la plantilla. Prueba a recargar la página.</p>
        ) : (
          <>
            <Percha rows={visible} selId={selected?.id} onSelect={setPicked} />
            {!loading && !visible.length && <p className="sq-empty">{rows.length ? "Nadie lleva ese nombre ni ese dorsal." : `Todavía no hay jugadores en ${seasonName}.`}</p>}
            {visible.length > 0 && (
              <p className="sq-hint">
                <span className="m">Desliza la percha · </span>
                {visible.length} {visible.length === 1 ? "jugador" : "jugadores"} · por {SORT_LABEL[sort]}
              </p>
            )}
          </>
        )}
      </section>

      {selected && (
        <Ficha
          row={selected}
          seasonName={seasonName}
          withStats={withStats}
          kit={kit}
          theme={theme}
          onStep={step}
          onCompare={() => {
            setDuel([selected.id, selected.id === bId ? aId : bId]);
            scrollToId("sq-cara");
          }}
        />
      )}

      {a && b && a.id !== b.id && (
        <section className="hm-sec" id="sq-cara" aria-labelledby="sq-cara-t">
          <span className="hm-kick">Cara a cara</span>
          <h2 className="hm-h2" id="sq-cara-t">
            Elige dos y <em>compáralos</em>
          </h2>
          <p className="hm-lede">
            {withStats ? "Con sus fichas y lo que llevan de temporada." : "Con lo que dicen sus fichas hoy. Desde la jornada 1 se suman partidos, goles, asistencias y minutos."}
          </p>
          <CaraACara rows={rows} a={a} b={b} withStats={withStats} onPick={pickSide} onSwap={() => setDuel([bId, aId])} />
        </section>
      )}

      {rows.length > 0 && (
        <section className="hm-sec" aria-labelledby="sq-all-t">
          <div className="sq-allhead">
            <div>
              <span className="hm-kick">Toda la plantilla</span>
              <h2 className="hm-h2" id="sq-all-t">
                Todos, <em>de un vistazo</em>
              </h2>
            </div>
            <div className="sq-pills" role="group" aria-label="Ordenar jugadores">
              {SORTS.map(([key, label]) => (
                <button key={key} type="button" aria-pressed={sort === key} onClick={() => setSort(key)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {visible.length ? (
            <SquadCards
              rows={visible}
              selId={selected?.id}
              compareIds={[aId, bId]}
              withStats={withStats}
              onOpen={(id) => {
                setPicked(id);
                scrollToId("sq-ficha");
              }}
              onCompare={compareWith}
            />
          ) : (
            <p className="sq-empty">Nadie lleva ese nombre ni ese dorsal.</p>
          )}
        </section>
      )}

      <CelesteFooter />
      <CelesteDock active="plantilla" />
    </div>
  );
}
