// Partidos (/admin/partidos, /admin/partidos/$matchId?tab=&vitrina=) — master–detail, as on the canvas
// (stats-gen/ad-v2-full.mjs `partidosD`, `mPartidos`; shots-adv2f/partidos-acta.png, m-partidos-lista.png):
// the header «Partidos» (N jornadas · N por hacer) with «Nuevo partido», the list (search, filter, sticky
// groups) and the selected match's workspace (MatchEditor). Desktop shows a match even without one in the
// URL (the first to do). Phones: the list alone (with the shell's header and bar), then the match full
// screen (the bar hides) with ←. `?vitrina` on a played match = the publish peak. «Nuevo partido» is a modal
// (?nuevo; the N key opens it too); «Borrar partido» hides the match at once and deletes it behind
// «Deshacer».
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { apiError, deleteMatch } from "../../../lib/clubApi";
import { jLabel, type AdminMatch } from "../data/adminLogic";
import type { AdminData } from "../data/useAdminData";
import { useWhistled } from "../data/whistleStore";
import { ShirtBack } from "../kit";
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
import { NuevoPartido } from "../partidos/NuevoPartido";
import { phaseOf } from "../partidos/workspaceModel";
import { Publicado } from "../publicado/Publicado";
import "../partidos/partidos.css";

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
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

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
  // Deleted here, waiting behind «Deshacer»: out of the list already.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  // Just created: its workspace waits for the first snapshot instead of saying «no está».
  const [created, setCreated] = useState<string | null>(null);

  const { reviewOf, now } = data;
  const matches = useMemo(() => data.matches.filter((m) => !hidden.has(m.id)), [data.matches, hidden]);
  const nextId = data.next?.match.id ?? null;
  const ctx = useMemo(() => ({ now, whistled, nextId, reviewOf }), [now, whistled, nextId, reviewOf]);
  const model = useMemo(() => buildMatchList(matches, ctx, filter, query), [matches, ctx, filter, query]);
  const fallback = useMemo(() => defaultMatch(matches, ctx)?.id ?? null, [matches, ctx]);
  const selectedId = matchId ?? (desktop ? fallback : null);
  const selected = matchId && hidden.has(matchId) ? null : (matches.find((m) => m.id === selectedId) ?? null);

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

  const remove = (m: AdminMatch) => {
    const j = jLabel(m);
    const unhide = () =>
      setHidden((s) => {
        const n = new Set(s);
        n.delete(m.id);
        return n;
      });
    setHidden((s) => new Set(s).add(m.id));
    void navigate({ to: "/admin/partidos" });
    toast.defer({
      tag: j,
      message: `${j} borrada del calendario`,
      commit: () => deleteMatch({ id: m.id }),
      errorMessage: `No se ha podido borrar la ${j}`,
      onUndo: () => {
        unhide();
        open(m.id, "encuentro");
      },
      onError: unhide,
    });
  };
  const onCreated = ({ id, j, rival }: { id: string; j: string; rival: string }) => {
    setCreated(id);
    void navigate({ to: "/admin/partidos/$matchId", params: { matchId: id }, search: { tab: "encuentro" } });
    toast.show({
      tag: j,
      message: `${j} · ${rival} creada · completa el campo cuando lo sepas`,
      undo: () => {
        setHidden((s) => new Set(s).add(id));
        void navigate({ to: "/admin/partidos" });
        deleteMatch({ id }).then(
          () => toast.show({ tag: j, message: `${j} · ${rival} quitada` }),
          (e: unknown) => {
            setHidden((s) => {
              const n = new Set(s);
              n.delete(id);
              return n;
            });
            toast.show({ tone: "error", message: `No se ha podido quitar la ${j}: ${apiError(e)}` });
          },
        );
      },
    });
  };

  const hacer = model.counts.hacer;
  const nuevoModal = nuevo && <NuevoPartido matches={data.matches} seasons={data.seasons} season={data.season} now={now} onClose={closeNuevo} onCreated={onCreated} />;

  // The publish peak (a played match only).
  if (isOn(search.vitrina) && selected && phaseOf(selected, now, whistled.has(selected.id)) === "jugado") return <Publicado match={selected} />;

  const detail = data.loading ? (
    <section className="det" aria-label="Partido">
      <div className="db">
        <div className="skel" role="status" aria-label="Cargando el partido">
          <i />
          <i />
          <i />
        </div>
      </div>
    </section>
  ) : selected ? (
    <MatchPane key={selected.id} match={selected} data={data} tab={tabParam} onTab={setTab} onBack={back} onDelete={remove} onPublished={() => void navigate({ to: "/admin/partidos/$matchId", params: { matchId: selected.id }, search: { vitrina: true } })} />
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
              <h3>Todavía no hay partidos</h3>
              <p>Crea el primero: rival, fecha y hora. El resto, cuando lo sepas.</p>
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

  const list = (
    <MatchList model={model} filter={filter} query={query} selectedId={desktop ? selectedId : null} loading={data.loading} error={data.error && !data.matches.length} onFilter={setFilter} onQuery={setQuery} onOpen={(id) => open(id)} />
  );

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
      </>
    );
  return (
    <>
      <div className="vh">
        <div>
          <h1 className="ttl">Partidos</h1>
          <p className="ld">
            {plural(data.matches.length, "jornada", "jornadas")} · {hacer} por hacer · por hacer primero
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
    </>
  );
}

/** The selected match: its private note (loaded first), then the workspace. */
function MatchPane({ match, data, tab, onTab, onBack, onDelete, onPublished }: { match: AdminMatch; data: AdminData; tab: MatchTab | undefined; onTab: (t: MatchTab) => void; onBack: () => void; onDelete: (m: AdminMatch) => void; onPublished: () => void }) {
  const whistled = useWhistled();
  const note = useMatchNote(match.id);
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
  return <MatchEditor match={match} data={data} note={note.data} tab={current} onTab={onTab} onBack={onBack} onDelete={onDelete} onPublished={onPublished} />;
}

/** /admin/partidos/$matchId — the Partidos view renders the selected match itself (master–detail). */
export function PartidoDetail() {
  return null;
}
