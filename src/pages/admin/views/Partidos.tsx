// Partidos (/admin/partidos, /admin/partidos/$matchId?tab=&vitrina=) — master–detail, as on the canvas
// (stats-gen/ad-v2-full.mjs `partidosD`, `mPartidos`; shots-adv2f/partidos-acta.png, m-partidos-lista.png):
// the header «Partidos» (N jornadas · N por hacer) with «Nuevo partido», the list (search, filter, sticky
// groups) and the selected match's workspace (MatchEditor). Desktop shows a match even without one in the
// URL (the first to do). Phones: the list alone (with the shell's header and bar), then the match full
// screen (the bar hides) with ←. `?vitrina` on a played match = the publish peak. «Nuevo partido» is a modal
// (?nuevo; the N key opens it too). Archiving is reversible; deletion is permanent and only reported
// after backend confirmation. Archived documents live in a separate, read-only collection view.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { flushSync } from "react-dom";
import { apiError, deleteMatch } from "../../../lib/clubApi";
import { jLabel, type AdminMatch } from "../data/adminLogic";
import type { AdminData } from "../data/useAdminData";
import type { MatchLifecycleRequest } from "../data/archivedMatches";
import { useWhistled } from "../data/whistleStore";
import { ShirtBack } from "../kit";
import { useMatchShortcuts } from "../palette/matchShortcuts";
import { useRegisterCommands } from "../palette/registry";
import type { PaletteCommand } from "../palette/search";
import { useAdmin } from "../shell/context";
import { MATCH_TABS, type MatchTab } from "../shell/nav";
import { useFrame } from "../ui/frame";
import { AdIcon } from "../ui/icons";
import { useLayerStack } from "../ui/layerCore";
import { useToast } from "../ui/toastContext";
import { buildMatchList, defaultMatch, groupOf, type ListFilter } from "../partidos/listModel";
import { useMatchNote } from "../partidos/live";
import { MatchEditor } from "../partidos/MatchEditor";
import { MatchList } from "../partidos/MatchList";
import { ArchivedMatchList, ArchivedMatchPane } from "../partidos/ArchivedMatches";
import { MatchLifecycleDialog } from "../partidos/MatchLifecycleDialog";
import { NuevoPartido } from "../partidos/NuevoPartido";
import { phaseOf } from "../partidos/workspaceModel";
import { Publicado } from "../publicado/Publicado";
import "../partidos/partidos.css";
import { plural } from "../../../lib/derived/words";

interface PartidosSearch {
  tab?: string;
  nuevo?: boolean | string;
  vitrina?: boolean | string;
}
const isTab = (t: unknown): t is MatchTab => typeof t === "string" && (MATCH_TABS as readonly string[]).includes(t);
const isOn = (v: unknown) => v === true || v === "true";
const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

export function Partidos() {
  const data = useAdmin();
  const navigate = useNavigate();
  const toast = useToast();
  const { stack } = useLayerStack();
  const { desktop } = useFrame();
  const whistled = useWhistled();
  const params = useParams({ strict: false }) as { matchId?: string };
  const search = useSearch({ strict: false }) as PartidosSearch;
  const matchId = params.matchId;
  const tabParam = isTab(search.tab) ? search.tab : undefined;
  const nuevo = isOn(search.nuevo);
  const [filter, setFilter] = useState<ListFilter>("todo");
  const [query, setQuery] = useState("");
  const [archiveMode, setArchiveMode] = useState(false);
  const [lifecycle, setLifecycle] = useState<MatchLifecycleRequest | null>(null);
  // A confirmed deletion stays hidden while realtime snapshots catch up.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  // Just created: its workspace waits for the first snapshot instead of saying «no está».
  const [created, setCreated] = useState<string | null>(null);

  const { reviewOf, now } = data;
  const matches = useMemo(() => data.matches.filter((m) => !hidden.has(m.id)), [data.matches, hidden]);
  const archivedMatches = useMemo(() => data.archivedMatches.filter((m) => !hidden.has(m.id)), [data.archivedMatches, hidden]);
  const showingArchives = archiveMode || !!(matchId && archivedMatches.some((m) => m.id === matchId));
  const nextId = data.next?.match.id ?? null;
  const ctx = useMemo(() => ({ now, whistled, nextId, reviewOf }), [now, whistled, nextId, reviewOf]);
  const model = useMemo(() => buildMatchList(matches, ctx, filter, query), [matches, ctx, filter, query]);
  const fallback = useMemo(() => defaultMatch(matches, ctx)?.id ?? null, [matches, ctx]);
  const selectedId = matchId ?? (desktop ? showingArchives ? archivedMatches[0]?.id ?? null : fallback : null);
  const selected = matchId && hidden.has(matchId) ? null : (matches.find((m) => m.id === selectedId) ?? null);
  const selectedArchive = archivedMatches.find((m) => m.id === selectedId) ?? null;

  const open = useCallback((id: string, tab?: MatchTab) => void navigate({ to: "/admin/partidos/$matchId", params: { matchId: id }, search: { tab } }), [navigate]);
  const setTab = (tab: MatchTab) => selectedId && void navigate({ to: "/admin/partidos/$matchId", params: { matchId: selectedId }, search: { tab }, replace: true });
  const back = () => void navigate({ to: "/admin/partidos" });
  const openNuevo = useCallback(() => {
    if (matchId) void navigate({ to: "/admin/partidos/$matchId", params: { matchId }, search: { tab: tabParam, nuevo: true } });
    else void navigate({ to: "/admin/partidos", search: { nuevo: true } });
  }, [navigate, matchId, tabParam]);
  const closeNuevo = () => {
    if (matchId) void navigate({ to: "/admin/partidos/$matchId", params: { matchId }, search: { tab: tabParam }, replace: true });
    else void navigate({ to: "/admin/partidos", replace: true });
  };

  // N = «Nuevo partido» (no field focused, no layer open).
  const layerOpen = stack.length > 0;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "n" && e.key !== "N") || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || layerOpen || isTyping(e.target)) return;
      e.preventDefault();
      openNuevo();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [layerOpen, openNuevo]);

  // Palette: «Abrir el acta de la Jn» for every acta to do (the shell already pins the pending one).
  const commands = useMemo<PaletteCommand[]>(
    () =>
      matches
        .filter((m) => groupOf(m, ctx) === "hacer")
        .map((m) => ({
          id: `partidos:acta:${m.id}`,
          group: "Acciones",
          icon: "✎",
          title: `Abrir el acta de la ${jLabel(m)}`,
          description: m.rival ?? "Rival",
          hint: "acción",
          keywords: "acta editar",
          run: () => open(m.id, "acta"),
        })),
    [matches, ctx, open],
  );
  useRegisterCommands(commands);

  const lifecycleComplete = (request: MatchLifecycleRequest) => {
    // Commit the clean editor state before navigation so the unsaved guard does not ask twice.
    flushSync(() => {
      request.onDone?.();
      if (request.action === "delete") setHidden((s) => new Set(s).add(request.match.id));
      else setArchiveMode(request.action === "archive");
      setLifecycle(null);
      setQuery("");
    });
    void navigate({ to: "/admin/partidos" });
    toast.show({ message: `${request.match.rival || "Partido"} · ${request.action === "delete" ? "partido eliminado definitivamente" : request.action === "archive" ? "partido archivado" : "partido reactivado"}` });
  };
  // (a new match is a draft: it takes its jornada when it is published)
  const onCreated = ({ id, rival }: { id: string; rival: string }) => {
    setArchiveMode(false);
    setCreated(id);
    void navigate({ to: "/admin/partidos/$matchId", params: { matchId: id }, search: { tab: "encuentro" } });
    toast.show({
      tag: "Borrador",
      message: `Borrador · ${rival} creado · completa el campo cuando lo sepas`,
      undo: () => {
        setHidden((s) => new Set(s).add(id));
        void navigate({ to: "/admin/partidos" });
        deleteMatch({ id }).then(
          () => toast.show({ tag: "Borrador", message: `Borrador · ${rival} quitado` }),
          (e: unknown) => {
            setHidden((s) => {
              const n = new Set(s);
              n.delete(id);
              return n;
            });
            toast.show({ tone: "error", message: `No se ha podido quitar el borrador de ${rival}: ${apiError(e)}` });
          },
        );
      },
    });
  };

  const hacer = model.counts.hacer;
  // (the jornadas are the numbered matches — derived/jornada; drafts not published yet are told apart)
  const jornadas = data.matches.filter((m) => m.jornada != null).length;
  const drafts = data.matches.filter((m) => !m.published).length;
  const nuevoModal = nuevo && <NuevoPartido matches={data.matches} seasons={data.seasons} season={data.season} now={now} onClose={closeNuevo} onCreated={onCreated} />;
  const lifecycleModal = lifecycle && <MatchLifecycleDialog key={`${lifecycle.match.id}:${lifecycle.action}`} request={lifecycle} data={data} onClose={() => setLifecycle(null)} onComplete={lifecycleComplete} />;

  // The publish peak (a played match only).
  if (isOn(search.vitrina) && selected && phaseOf(selected, now, whistled.has(selected.id)) === "jugado") return <><Publicado match={selected} onLifecycle={setLifecycle} />{lifecycleModal}</>;

  const detail = data.loading || (data.archivesLoading && (showingArchives || (!selected && !!matchId))) ? (
    <section className="det" aria-label="Partido">
      <div className="db">
        <div className="skel" role="status" aria-label="Cargando el partido">
          <i />
          <i />
          <i />
        </div>
      </div>
    </section>
  ) : selectedArchive ? (
    <ArchivedMatchPane match={selectedArchive} data={data} onBack={() => { setArchiveMode(true); back(); }} onLifecycle={setLifecycle} />
  ) : selected ? (
    <MatchPane key={selected.id} match={selected} data={data} tab={tabParam} onTab={setTab} onBack={back} onLifecycle={setLifecycle} onPublished={() => void navigate({ to: "/admin/partidos/$matchId", params: { matchId: selected.id }, search: { vitrina: true } })} />
  ) : matchId && matchId === created && !hidden.has(matchId) ? (
    <section className="det" aria-label="Partido">
      <div className="db">
        <div className="skel" role="status" aria-label="Abriendo el partido">
          <i />
          <i />
        </div>
      </div>
    </section>
  ) : desktop || matchId ? (
    <section className="det" aria-label="Partido">
      <div className="db" style={{ display: "flex" }}>
        <div className="void" style={{ flex: 1 }}>
          <ShirtBack size={90} big state="empty" />
          {matchId ? (
            <>
              <h3>Ese partido no está</h3>
              <p>Puede que se haya borrado o que aún se esté creando.</p>
              <button type="button" className="btn line" onClick={back}>
                <AdIcon name="back" size={18} />
                Volver a la lista
              </button>
            </>
          ) : (
            <>
              <h3>{showingArchives ? "No hay partidos archivados" : "Todavía no hay partidos"}</h3>
              <p>{showingArchives ? "Los partidos que archives aparecerán aquí para consultarlos o reactivarlos." : "Crea el primero: rival, fecha y hora. El resto, cuando lo sepas."}</p>
              <button type="button" className="btn gold" onClick={openNuevo}>
                <AdIcon name="plus" size={18} />
                Nuevo partido
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  ) : null;

  const list = <div className="match-list-stack"><div className="seg2" role="group" aria-label="Calendario y archivo">
    <button type="button" aria-pressed={!showingArchives} onClick={() => { setArchiveMode(false); setQuery(""); back(); }}>Activos</button>
    <button type="button" aria-pressed={showingArchives} onClick={() => { setArchiveMode(true); setQuery(""); back(); }}>Archivados{archivedMatches.length ? ` · ${archivedMatches.length}` : ""}</button>
  </div>{showingArchives ? <ArchivedMatchList matches={archivedMatches} query={query} selectedId={desktop ? selectedId : null} loading={data.archivesLoading} error={data.archivesError} onQuery={setQuery} onOpen={(id) => open(id)} /> : <MatchList model={model} filter={filter} query={query} selectedId={desktop ? selectedId : null} loading={data.loading} error={data.error && !data.matches.length} onFilter={setFilter} onQuery={setQuery} onOpen={(id) => open(id)} />}</div>;

  if (!desktop)
    return (
      <>
        {matchId ? (
          detail
        ) : (
          <div className="msc">
            <button type="button" className="btn line" onClick={openNuevo} aria-haspopup="dialog">
              <AdIcon name="plus" />
              Nuevo partido
            </button>
            {list}
          </div>
        )}
        {nuevoModal}
        {lifecycleModal}
      </>
    );
  return (
    <>
      <div className="vh">
        <div>
          <h1 className="ttl">Partidos</h1>
          <p className="ld">
            {plural(jornadas, "jornada", "jornadas")}
            {drafts ? ` · ${plural(drafts, "borrador", "borradores")}` : ""} · {hacer} por hacer · por hacer primero
          </p>
        </div>
        <div className="r">
          <button type="button" className="btn line" onClick={openNuevo} aria-haspopup="dialog" aria-keyshortcuts="N">
            <AdIcon name="plus" />
            Nuevo partido
          </button>
        </div>
      </div>
      <div className="pt">
        {list}
        {detail}
      </div>
      {nuevoModal}
      {lifecycleModal}
    </>
  );
}

/** The selected match: its private note (loaded first), then the workspace. */
function MatchPane({ match, data, tab, onTab, onBack, onLifecycle, onPublished }: { match: AdminMatch; data: AdminData; tab: MatchTab | undefined; onTab: (t: MatchTab) => void; onBack: () => void; onLifecycle: (request: MatchLifecycleRequest) => void; onPublished: () => void }) {
  const whistled = useWhistled();
  const note = useMatchNote(match.id);
  // ⌘K: «Ver en la web» and «Abrir la pizarra (J8 · MAD SKY)» for the match on screen
  useMatchShortcuts(match);
  if (note.loading)
    return (
      <section className="det" aria-label="Partido">
        <div className="db">
          <div className="skel" role="status" aria-label="Cargando el acta">
            <i />
            <i />
            <i />
          </div>
        </div>
      </section>
    );
  const phase = phaseOf(match, data.now, whistled.has(match.id));
  const current: MatchTab = tab ?? (phase === "jugado" || phase === "juego" ? "acta" : "encuentro");
  return <MatchEditor match={match} data={data} note={note.data} tab={current} onTab={onTab} onBack={onBack} onLifecycle={onLifecycle} onPublished={onPublished} />;
}

/** /admin/partidos/$matchId — the Partidos view renders the selected match itself (master–detail). */
export function PartidoDetail() {
  return null;
}
