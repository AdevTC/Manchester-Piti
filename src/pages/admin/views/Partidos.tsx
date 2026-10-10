// Partidos y actas — master–detail. The list (search, filters, sticky groups) and the selected match:
// an acta to do (a draft, or a played match not published) opens as the editor (tabs Encuentro ·
// Convocatoria · Acta · Publicar, in the URL: /admin/partidos/$matchId?tab=); a published match or one
// still to be played opens as its summary with its action. On phones the list and the match take the
// whole screen in turn (← back). «Nuevo partido» is a modal (?nuevo; the N key opens it too).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import type { AdminData } from "../data/useAdminData";
import { jLabel, matchGroup, type AdminMatch } from "../data/adminLogic";
import { useRegisterCommands } from "../palette/registry";
import type { PaletteCommand } from "../palette/search";
import { AdminView } from "../shell/AdminView";
import { useAdmin } from "../shell/context";
import { MATCH_TABS, type MatchTab } from "../shell/nav";
import { EmptyState, SkeletonRows } from "../ui/controls";
import { AdIcon } from "../ui/icons";
import { useFrame } from "../ui/frame";
import { useLayerStack } from "../ui/layerCore";
import { useToast } from "../ui/toastContext";
import { rosterFor } from "../acta/roster";
import { buildMatchList, type ListFilter } from "../partidos/listModel";
import { useMatchNote } from "../partidos/live";
import { MatchEditor } from "../partidos/MatchEditor";
import { MatchList } from "../partidos/MatchList";
import { MatchSummary } from "../partidos/MatchSummary";
import { NuevoPartido } from "../partidos/NuevoPartido";

interface PartidosSearch {
  tab?: string;
  nuevo?: boolean | string;
}
const isTab = (t: unknown): t is MatchTab => typeof t === "string" && (MATCH_TABS as readonly string[]).includes(t);
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
  const params = useParams({ strict: false }) as { matchId?: string };
  const search = useSearch({ strict: false }) as PartidosSearch;
  const matchId = params.matchId;
  const tabParam = isTab(search.tab) ? search.tab : undefined;
  const nuevo = search.nuevo === true || search.nuevo === "true";
  const [filter, setFilter] = useState<ListFilter>("todo");
  const [query, setQuery] = useState("");

  const { matches, stateOf, reviewOf, players, seasons } = data;
  const lastId = data.last?.match.id;
  const rosterIds = useCallback((m: AdminMatch) => rosterFor(players, seasons, m.seasonId).map((p) => p.id), [players, seasons]);
  const model = useMemo(() => buildMatchList(matches, { stateOf, reviewOf, rosterIds }, filter, query), [matches, stateOf, reviewOf, rosterIds, filter, query]);
  // Desktop shows a match even without one in the URL: the first one to do (else the latest).
  const fallback = useMemo(() => {
    const todo = matches.filter((m) => matchGroup(stateOf(m)) === "hacer");
    return todo[0]?.id ?? matches.at(-1)?.id ?? null;
  }, [matches, stateOf]);
  const selectedId = matchId ?? (desktop ? fallback : null);
  const selected = data.matches.find((m) => m.id === selectedId) ?? null;

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

  // Palette: «Abrir el acta de la Jn» for every acta to do (the shell already lists the latest one).
  const commands = useMemo<PaletteCommand[]>(
    () =>
      matches
        .filter((m) => ["draft", "acta"].includes(stateOf(m)) && m.id !== lastId)
        .map((m) => ({
          id: `partidos:acta:${m.id}`,
          group: "Acciones",
          icon: "✎",
          title: `Abrir el acta de la ${jLabel(m)}`,
          description: `${m.rival ?? "Rival"} · ${stateOf(m) === "draft" ? "borrador" : "sin empezar"}`,
          hint: "acción",
          keywords: "acta editar",
          run: () => open(m.id, "acta"),
        })),
    [matches, stateOf, lastId, open],
  );
  useRegisterCommands(commands);

  const hacer = model.counts.hacer;
  return (
    <AdminView
      kicker="Jornada"
      title="Partidos y actas"
      lead={`${data.matches.length} ${data.matches.length === 1 ? "jornada" : "jornadas"} · ${hacer} por hacer · toca un partido para abrirlo`}
      className={`vpa${matchId ? " det" : ""}`}
      actions={
        <button type="button" className="btn sm gold" onClick={openNuevo} aria-haspopup="dialog" aria-keyshortcuts="N">
          <AdIcon name="plus" size={16} />
          Nuevo partido
        </button>
      }
    >
      <div className="vb md">
        <MatchList model={model} filter={filter} query={query} selectedId={selectedId} loading={data.loading} error={data.error && !data.matches.length} onFilter={setFilter} onQuery={setQuery} onOpen={(id) => open(id)} onNew={openNuevo} />
        <div className="cd dp" role="region" aria-label="Partido seleccionado">
          {data.loading ? (
            <div className="dp-b">
              <SkeletonRows rows={4} label="Cargando el partido…" />
            </div>
          ) : selected ? (
            <MatchPane key={selected.id} match={selected} data={data} tabParam={tabParam} onTab={setTab} onOpenTab={(t) => open(selected.id, t)} onBack={back} />
          ) : (
            <div className="dp-b">
              {matchId ? (
                <EmptyState icon="search" title="No encontramos ese partido">
                  Puede que se haya borrado o que aún se esté creando.
                </EmptyState>
              ) : (
                <EmptyState icon="cal" title="Todavía no hay partidos">
                  Crea el primero con «Nuevo partido».
                </EmptyState>
              )}
              {matchId && (
                <div className="row ad-ml-new">
                  <button type="button" className="btn sm line" onClick={back}>
                    <AdIcon name="back" size={16} />
                    Volver a la lista
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {nuevo && (
        <NuevoPartido
          matches={data.matches}
          seasons={data.seasons}
          season={data.season}
          now={data.now}
          onClose={closeNuevo}
          onCreated={(id, message) => {
            toast.show({ message });
            void navigate({ to: "/admin/partidos/$matchId", params: { matchId: id }, search: { tab: "encuentro" } });
          }}
        />
      )}
    </AdminView>
  );
}

/** The selected match: its editor (an acta to do, or a tab asked for) or its summary. */
function MatchPane({ match, data, tabParam, onTab, onOpenTab, onBack }: { match: AdminMatch; data: AdminData; tabParam: MatchTab | undefined; onTab: (t: MatchTab) => void; onOpenTab: (t: MatchTab) => void; onBack: () => void }) {
  const navigate = useNavigate();
  const state = data.stateOf(match);
  const editing = state === "draft" || state === "acta" || !!tabParam;
  const note = useMatchNote(editing ? match.id : undefined);
  if (!editing)
    return (
      <MatchSummary
        match={match}
        data={data}
        state={state}
        onEdit={onOpenTab}
        onConvocatoria={() => void navigate({ to: "/admin/convocatorias", search: { j: match.id } })}
        onBack={onBack}
      />
    );
  if (note.loading)
    return (
      <div className="dp-b">
        <SkeletonRows rows={4} label="Cargando el acta…" />
      </div>
    );
  const played = data.reviewOf(match).finished;
  const tab: MatchTab = tabParam ?? (played ? "acta" : "encuentro");
  return <MatchEditor match={match} data={data} note={note.data} tab={tab} onTab={onTab} onBack={onBack} onDeleted={onBack} />;
}

/** /admin/partidos/$matchId — the Partidos view renders the selected match itself (master–detail). */
export function PartidoDetail() {
  return null;
}
