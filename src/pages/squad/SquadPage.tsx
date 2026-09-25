import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "@tanstack/react-router";
import { useSeason } from "../../context/SeasonContext";
import { nextFixture, playerForSeason, useClubData } from "../../lib/clubData";
import { analysePlayer, chronological } from "../../lib/clubAnalytics";
import { currentSeasonId } from "../../lib/vestuario";
import { matchesQuery, sortSquad, squadRow, squadSummary, type SquadRow } from "../../lib/squad";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteBackdrop, CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { Icon } from "../../components/celeste/icons";
import { PRINT_FONTS } from "../../components/jersey3d/fonts";
import { useShirtStills } from "../../components/jersey3d/useShirtStills";
import { Percha } from "./Percha";
import { FichaModal } from "./FichaModal";
import { CaraACara } from "./CaraACara";
import "../../styles/home.css";
import "../../styles/squad.css";

/** The duel angles each shirt towards the middle. */
const DUEL_YAW = { a: 0.42, b: -0.42 };

function scrollToId(id: string) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}
/** Shared-element transition when the browser supports it; plain state change otherwise. */
function transition(update: () => void) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) return update();
  document.startViewTransition(() => flushSync(update));
}

/** Public squad page: the shirts on the rail (each opens its ficha) and the head-to-head. */
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
  const [kit, setKit] = useState<"home" | "away">("home");
  const [openId, setOpenId] = useState<string | null>(null);
  const [vtId, setVtId] = useState<string | null>(null);
  const [duel, setDuel] = useState<[string, string] | null>(null);

  const visible = rows.filter((r) => matchesQuery(r, query));
  const open = rows.find((r) => r.id === openId);
  const summary = squadSummary(rows);

  // Head-to-head: starts with the two first players that have a full ficha.
  const complete = rows.filter((r) => !r.missing.length);
  const [aId, bId] = duel ?? [complete[0]?.id ?? rows[0]?.id ?? "", complete[1]?.id ?? rows.find((r) => r.id !== (complete[0]?.id ?? rows[0]?.id))?.id ?? ""];
  const a = rows.find((r) => r.id === aId);
  const b = rows.find((r) => r.id === bId);

  const shot = (r: SquadRow, yaw = 0) => ({ kit, theme, name: r.name.toUpperCase(), num: r.num, yaw });
  const still = useShirtStills(rows.map((r) => shot(r)));
  const duelStills = useShirtStills([a && shot(a, DUEL_YAW.a), b && shot(b, DUEL_YAW.b)].filter((x) => x != null));
  const stillOf = (r: SquadRow) => still(shot(r));

  const openFicha = (id: string) => {
    flushSync(() => setVtId(id));
    transition(() => setOpenId(id));
  };
  const closeFicha = () => transition(() => setOpenId(null));
  const step = (dir: 1 | -1) => {
    const list = visible.length ? visible : rows;
    const at = list.findIndex((r) => r.id === openId);
    const next = list[(at + dir + list.length) % list.length].id;
    setOpenId(next);
    setVtId(next);
  };
  const pickSide = (side: "a" | "b", id: string) => {
    if (side === "a") setDuel(id === bId ? [id, aId] : [id, bId]);
    else setDuel(id === aId ? [bId, id] : [aId, id]);
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
          <p className="hm-lede">{loading ? "Cargando la plantilla…" : "Toca una camiseta para descolgarla y abrir su ficha."}</p>
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
            <Percha rows={visible} still={stillOf} openId={openId} vtId={vtId} onOpen={openFicha} />
            {!loading && !visible.length && <p className="sq-empty">{rows.length ? "Nadie lleva ese nombre ni ese dorsal." : `Todavía no hay jugadores en ${seasonName}.`}</p>}
            {visible.length > 0 && (
              <p className="sq-hint">
                <span className="m">Desliza la percha · </span>
                {visible.length} {visible.length === 1 ? "jugador" : "jugadores"} · toca una camiseta para ver su ficha
              </p>
            )}
            {!loading && rows.length > 0 && (
              <div className="sq-sum">
                <div>
                  <b>{summary.size}</b>
                  <span>jugadores</span>
                </div>
                <div>
                  <b>{summary.avgAge ?? "—"}</b>
                  <span>años de media</span>
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
          </>
        )}
      </section>

      {a && b && a.id !== b.id && (
        <section className="hm-sec" id="sq-cara" aria-labelledby="sq-cara-t">
          <span className="hm-kick">Cara a cara</span>
          <h2 className="hm-h2" id="sq-cara-t">
            Elige dos y <em>compáralos</em>
          </h2>
          <p className="hm-lede">
            {withStats ? "Toca una esquina para cambiar de jugador. Con sus fichas y lo que llevan de temporada." : "Toca una esquina para cambiar de jugador. Desde la jornada 1 se suman partidos, goles, asistencias y minutos."}
          </p>
          <CaraACara
            rows={rows}
            a={a}
            b={b}
            withStats={withStats}
            kit={kit}
            still={stillOf}
            duelStill={(r, side) => duelStills(shot(r, DUEL_YAW[side]))}
            onPick={pickSide}
            onSwap={() => setDuel([bId, aId])}
          />
        </section>
      )}

      <CelesteFooter />
      <CelesteDock active="plantilla" />

      {open && (
        <FichaModal
          row={open}
          still={stillOf(open)}
          seasonName={seasonName}
          withStats={withStats}
          kit={kit}
          theme={theme}
          onClose={closeFicha}
          onStep={step}
          onCompare={() => {
            setDuel([open.id, open.id === bId ? aId : bId]);
            closeFicha();
            window.setTimeout(() => scrollToId("sq-cara"), 60);
          }}
        />
      )}
    </div>
  );
}
