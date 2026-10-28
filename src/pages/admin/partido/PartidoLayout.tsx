// /admin/partidos/<id>[/<station>] — the match (r12 M-03): its head (J, the rival with its code, the date, its state
// in words; «Ver en la web», «Gestionar» and the station's primary action) and the carril as its navigation (six
// stations, the current one lit, ← → between them), with the station's screen under it (the outlet). Without a
// station it opens the one of its moment. `proximo` (an old /admin/convocar without a match) becomes the next match
// once the data is in; an archived match goes to Archivados. Inside a match the dock hides and «‹ Volver» leads to
// Partidos (the frame's head says «J3 · Red Demons»).
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { VIcon } from "../../../components/vidrio/VIcon";
import { rivalCode } from "../../../lib/eventMeta";
import { NEXT_MATCH, type Station } from "../../../lib/adminUrls";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { toBePlayed } from "../../../lib/derived/kickoff";
import { clockTime, jLabel, shortDate } from "../data/adminLogic";
import type { MatchLifecycleRequest } from "../data/archivedMatches";
import { useWhistled } from "../data/whistleStore";
import { MatchLifecycleDialog } from "../partidos/MatchLifecycleDialog";
import { useAdmin } from "../shell/context";
import { useSalaHead } from "../shell/head";
import { screenOf, stationName } from "../shell/places";
import { PrimaryAction, ScreenLoading } from "../shell/Screen";
import { SalaLink } from "../shell/SalaLink";
import { useSalaGo } from "../shell/salaHref";
import { isTypingTarget } from "../shell/shortcuts";
import { useStatus } from "../shell/statusContext";
import { useLayerStack, useLayer } from "../ui/layerCore";
import { useFrame } from "../ui/frame";
import { resultLetter } from "../kit/result";
import { carrilPhase, phaseWord, stationOf, stationsOf, stepStation } from "./carril";
import { Carril } from "./CarrilNav";
import { PartidoContext, type Partido } from "./partidoContext";
import { LifecycleContext } from "./lifecycle";
import { PrimaryContext, PrimaryStore, useStationPrimaryValue } from "./primary";

export function PartidoLayout() {
  const { matchId = "" } = useParams({ strict: false }) as { matchId?: string };
  const data = useAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const go = useSalaGo();
  const info = screenOf(pathname);
  // (the next match: the calendar's, else the first still to be played, a draft too — as Convocar picked it)
  const next =
    data.next?.match.id ??
    data.matches
      .filter((m) => m.status !== "cancelled" && toBePlayed(m, data.now))
      .sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0]?.id;
  const archived = data.archivedMatches.some((m) => m.id === matchId);
  // (the old addresses without a match, and an archived one: replaced once the data says where)
  const resolveTo = matchId === NEXT_MATCH && next ? pathname.replace(`/admin/partidos/${NEXT_MATCH}`, `/admin/partidos/${next}`) : archived ? `/admin/partidos/archivados/${matchId}` : null;
  useEffect(() => {
    if (resolveTo) go(resolveTo, { replace: true });
  }, [resolveTo, go]);
  const match = data.matches.find((m) => m.id === matchId) ?? null;
  if (resolveTo || ((data.loading || data.archivesLoading) && !match)) return <ScreenLoading label="Abriendo el partido" />;
  if (!match) return <MissingMatch next={matchId === NEXT_MATCH} />;
  return <MatchFrame key={match.id} matchId={match.id} station={info.station} sub={info.screen.startsWith("acta-") ? info.screen : undefined} />;
}

function MissingMatch({ next }: { next: boolean }) {
  useSalaHead({ title: next ? "Sin próximo partido" : "Ese partido no está", back: { to: "/admin/partidos", label: "Volver a Partidos" } }, 1);
  return (
    <section className="sc-failed">
      <h1>{next ? "No hay un próximo partido" : "Ese partido no está"}</h1>
      <p>{next ? "Crea el siguiente con su rival, la fecha y la hora; la convocatoria se hace desde él." : "Puede que se haya borrado, archivado o que aún se esté creando."}</p>
      <SalaLink className="vd-btn vd-glass vd-press vd-btn--pri" to={next ? "/admin/partidos/nuevo" : "/admin/partidos"}>
        {next ? "Nuevo partido" : "Volver a la lista"}
      </SalaLink>
    </section>
  );
}

function MatchFrame({ matchId, station: inAddress, sub }: { matchId: string; station?: Station; sub?: string }) {
  const data = useAdmin();
  const status = useStatus();
  const go = useSalaGo();
  const whistled = useWhistled();
  const { modalOpen } = useLayerStack();
  const { desktop } = useFrame();
  const match = data.matches.find((m) => m.id === matchId)!;
  const review = data.reviewOf(match);
  const publishedFinal = data.published.some((p) => p.id === match.id && p.status === "finished");
  const phase = carrilPhase(match, data.now, whistled.has(match.id), publishedFinal);
  const auto = stationOf(phase);
  const station = inAddress ?? auto;
  const stations = useMemo(
    () => stationsOf({ match, now: data.now, whistled: whistled.has(match.id), review, rsvp: data.next?.match.id === match.id ? data.next.rsvp : null, mvpOpen: /abiert/i.test(data.mvp) && phase === "publicado", publishedFinal }),
    [match, data.now, whistled, review, data.next, data.mvp, phase, publishedFinal],
  );
  const j = jLabel(match);
  const rival = match.rival || "Rival por confirmar";
  const t = dateMillis(match.date);
  const kicker = [match.jornada ? `J${match.jornada}` : "Borrador", match.competition || "Liga", Number.isFinite(t) ? `${shortDate(t)} · ${clockTime(t)}` : "sin fecha", match.home === false ? "fuera" : "en casa"].join(" · ");
  const played = phase === "final" || phase === "publicado";
  const gf = review.goalsFor;
  const ga = review.goalsAgainst;
  const base = `/admin/partidos/${match.id}`;
  const subName = sub === "acta-narracion" ? "El análisis narrado" : sub === "acta-historial" ? "El historial del acta" : stationName(station);
  useSalaHead({ title: `${match.jornada ? `J${match.jornada}` : "Borrador"} · ${rival}`, sub: `${subName} · ${phaseWord(phase, match)}`, back: sub ? { to: `${base}/acta`, label: "Volver al acta" } : { to: "/admin/partidos", label: "Volver a Partidos" } }, 1);

  // ← → walk the stations (not while typing, not under a layer)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || modalOpen || isTypingTarget(e.target)) return;
      // (a focused slider, tab list or radio group keeps its own arrows)
      const t = e.target as HTMLElement | null;
      if (t?.closest('[role="tablist"],[role="radiogroup"],[role="slider"],[role="listbox"],[role="menu"],[role="grid"]')) return;
      const to = stepStation(station, e.key);
      if (!to) return;
      e.preventDefault();
      go(`${base}/${to}`);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [station, base, go, modalOpen]);

  const [lifecycle, setLifecycle] = useState<MatchLifecycleRequest | null>(null);
  const [primaryStore] = useState(() => new PrimaryStore());
  const primary = useStationPrimaryValue(primaryStore);
  const partido = useMemo<Partido>(() => ({ match, phase, station, auto, stations, review, j, base }), [match, phase, station, auto, stations, review, j, base]);
  const onComplete = (r: MatchLifecycleRequest) => {
    // (the editor's clean state first, so its unsaved-changes guard does not ask on the way out)
    flushSync(() => {
      r.onDone?.();
      setLifecycle(null);
    });
    status.show({ tag: r.action === "delete" ? "Borrado" : "Archivado", message: `${r.match.rival || "Partido"} · ${r.action === "delete" ? "partido eliminado definitivamente" : r.action === "archive" ? "fuera del calendario; se reactiva desde Archivados" : "partido reactivado"}` });
    go(r.action === "archive" ? `/admin/partidos/archivados/${r.match.id}` : "/admin/partidos");
  };

  return (
    <PartidoContext.Provider value={partido}>
      <LifecycleContext.Provider value={setLifecycle}>
        <PrimaryContext.Provider value={primaryStore}>
          <div className="sc-screen sc-match">
            <header className="sc-mhead">
              <div className="sc-mhead__t">
                {/* (below 1100 the frame's header says the match: the kicker and the h1 stay for the readers) */}
                <p className={`sc-k sc-mhead__k${desktop ? "" : " vd-vh"}`}>
                  <SalaLink className="sc-mhead__up" to="/admin/partidos">
                    ‹ Partidos
                  </SalaLink>
                  <span>{kicker}</span>
                </p>
                <h1 className={`sc-h1 sc-mhead__h${desktop ? "" : " vd-vh"}`}>
                  <span className="sc-morph" style={{ viewTransitionName: `sc-m-${match.id.replace(/[^a-zA-Z0-9_-]/g, "_")}` }}>
                    Manchester Piti {played ? `${gf}–${ga}` : "–"} {rival}
                  </span>
                  {played && <span className={`sc-res sc-res--${resultLetter(gf, ga)}`}>{resultLetter(gf, ga)}<span className="vd-vh"> · {resultLetter(gf, ga) === "G" ? "ganado" : resultLetter(gf, ga) === "P" ? "perdido" : "empate"}</span></span>}
                </h1>
                <p className="sc-mhead__s">
                  <span className="sc-rival" title={rival}>
                    <i aria-hidden="true">{rivalCode(rival, match.rivalShort)}</i>
                    <span className="vd-vh">Código del rival: {rivalCode(rival, match.rivalShort)}</span>
                  </span>
                  <span className={`sc-tag ${phase === "juego" || phase === "descanso" ? "sc-tag--live" : phase === "final" || phase === "pendiente" || !match.published ? "sc-tag--toca" : phase === "aplazado" || phase === "cancelado" ? "sc-tag--mal" : "sc-tag--quiet"}`}>{phaseWord(phase, match)}</span>
                  <span className="sc-mhead__kp">{kicker}</span>
                </p>
              </div>
              <div className="sc-mhead__a">
                {match.published && (
                  <a className="vd-btn vd-glass vd-press vd-btn--sm" href={`/partidos/${match.id}`} target="_blank" rel="noopener">
                    Ver en la web
                    <VIcon name="expand" size={16} />
                    <span className="vd-vh"> (se abre en otra pestaña)</span>
                  </a>
                )}
                <Manage rival={rival} onArchive={() => setLifecycle({ action: "archive", match })} onDelete={() => setLifecycle({ action: "delete", match })} />
                {primary && (
                  <div className="sc-mhead__pri">
                    <PrimaryAction spec={primary} place="head" />
                  </div>
                )}
              </div>
            </header>
            <nav className="sc-carril-wrap" aria-label="Las estaciones del partido">
              <Carril stations={stations} current={station} />
            </nav>
            <div className="sc-match__body">
              <Outlet />
              {primary && <PrimaryAction spec={primary} place="pin" />}
            </div>
          </div>
          {lifecycle && <MatchLifecycleDialog key={`${lifecycle.match.id}:${lifecycle.action}`} request={lifecycle} data={data} onClose={() => setLifecycle(null)} onComplete={onComplete} />}
        </PrimaryContext.Provider>
      </LifecycleContext.Provider>
    </PartidoContext.Provider>
  );
}

/** «⋯ Gestionar»: archive or delete (each one asks first, saying what happens). */
function Manage({ rival, onArchive, onDelete }: { rival: string; onArchive: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <div className="sc-acctwrap">
      <button ref={btn} type="button" className="vd-ibtn vd-glass vd-press" aria-label="Gestionar el partido" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <VIcon name="dots" size={20} />
      </button>
      {open && (
        <ManageMenu
          rival={rival}
          returnRef={btn}
          onClose={() => setOpen(false)}
          onArchive={() => {
            setOpen(false);
            onArchive();
          }}
          onDelete={() => {
            setOpen(false);
            onDelete();
          }}
        />
      )}
    </div>
  );
}

function ManageMenu({ rival, returnRef, onClose, onArchive, onDelete }: { rival: string; returnRef: RefObject<HTMLButtonElement | null>; onClose: () => void; onArchive: () => void; onDelete: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  useLayer({ modal: false, trap: false, onClose, ref, initialFocus: first, returnFocus: returnRef });
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t || ref.current?.contains(t) || returnRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose, returnRef]);
  return (
    <div ref={ref} className="sc-menu vd-glass vd-glass--deep" role="menu" aria-label="Gestionar el partido" onKeyDown={(e) => e.key === "Tab" && onClose()}>
      <p className="sc-menu__who" role="none">
        <b>Gestionar</b>
        <span>{rival}</span>
      </p>
      <button ref={first} type="button" role="menuitem" onClick={onArchive}>
        Archivar…
      </button>
      <button type="button" role="menuitem" onClick={onDelete}>
        Borrar…
      </button>
    </div>
  );
}
