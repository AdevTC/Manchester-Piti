// Plantilla (/admin/plantilla?jugador=&nuevo&dorsal=&vista=cromos) — «ficha a ficha»: on the left the season
// grouped by line, «Sin posición» first with POR · DEF · MED · DEL right in the row (club/PlantillaList); on the
// right one player's ficha, big (club/FichaWorkspace: his real kit, his exact Posiciones on a map — and the
// proposal he made from his profile, to approve, adjust or reject — and Estado one tap each — «Sancionado»
// by hand, matches or «hasta la J…», derived with the acta's red cards in club/sanctionLogic —, the cards
// Camiseta · Datos · Cuenta y web that save themselves, «Siguiente sin completar», ↑ ↓). With no player in
// the URL the ficha shows the first one that still lacks something. «Todos en cromos» (?vista=cromos) shows the
// whole squad big (club/CromosGrid); «Alta de jugador» takes the ficha's place (club/AltaWorkspace). Above it
// the collection («4/16 fichas completas») and the gap chips that isolate who needs what. Every write waits
// behind a lower third with «Deshacer» (the screen shows it at once; undone, nothing is written). «Dar de baja»
// takes him off the season (his doc, actas and carta stay). While searching, players of other seasons show at
// the end, dimmed. View Transitions: the kit flies from the row / cromo into the ficha, rows glide to their new
// line. Phones: the list (or cromos) is the screen; a player opens his ficha full screen. CSV export.
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { serverTimestamp } from "firebase/firestore";
import { useShirtStills } from "../../../components/jersey3d/useShirtStills";
import { summaryText } from "../../../components/posiciones/mapaNav";
import { useDocumentTheme } from "../../../hooks/useDocumentTheme";
import { sanitizePositions, type PositionSet } from "../../../lib/positions";
import { positionsPayload, reviewPayload } from "../../../lib/positionsEdit";
import type { PlayerDoc } from "../../../lib/schemas";
import { AltaWorkspace } from "../club/AltaWorkspace";
import { LoadError } from "../club/ClubStates";
import { CromosGrid } from "../club/CromosGrid";
import { downloadText } from "../club/download";
import { FichaWorkspace } from "../club/FichaWorkspace";
import { PlantillaList } from "../club/PlantillaList";
import {
  FILTER_LABEL,
  boardGroups,
  boardRows,
  collection,
  dorsalParam,
  filterChips,
  freeDorsals,
  listOrder,
  matchesFilter,
  nextIncomplete,
  repeatedDorsals,
  stepIn,
  type BoardFilter,
  type BoardRow,
} from "../club/plantillaBoard";
import { bajaPayload, csvFileName, filterRows, linePickPayload, nameIn, numberIn, playerPayload, plantillaRows, previewDoc, rosterCsv, seasonCode, type PlayerForm, type Position } from "../club/plantillaLogic";
import { liftedDoc, liftWrite, sanctionedDoc, sanctionStatus, sanctionToast, sanctionWrite, seasonSuspensions, upcomingFor, type SanctionChoice } from "../club/sanctionLogic";
import { useClubWrites } from "../club/useClubWrites";
import { useAuth } from "../../../context/AuthContext";
import { useSlashFocus } from "../club/useSlashFocus";
import { useRegisterCommands } from "../palette/registry";
import type { PaletteCommand } from "../palette/search";
import { useAdmin } from "../shell/context";
import { isTypingTarget } from "../shell/shortcuts";
import { useFrame } from "../ui/frame";
import { AdIcon } from "../ui/icons";
import { useLayerStack } from "../ui/layerCore";
import { useToast } from "../ui/toastContext";
import { canTransition, viewTransition, vtName } from "../ui/viewTransition";
import "../club/plantilla.css";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const truthy = (v: unknown) => v === true || v === 1 || v === "1" || v === "true";
/** «pasa a la defensa» / «pasa al medio». */
const LINE_TO: Record<Position, string> = { POR: "a la portería", DEF: "a la defensa", MED: "al medio", DEL: "a la delantera" };
/** How long a flying kit / row keeps its transition name (longer than the morph). */
const FLIGHT_MS = 900;

type Pending = Record<string, PlayerDoc | null>;
type Search = { jugador?: string; nuevo?: true; dorsal?: number; vista?: "cromos" };

export function Plantilla() {
  const data = useAdmin();
  const { desktop } = useFrame();
  const phone = !desktop;
  const toast = useToast();
  const writes = useClubWrites();
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useDocumentTheme();
  const { modalOpen } = useLayerStack();
  const search: { jugador?: unknown; nuevo?: unknown; dorsal?: unknown; vista?: unknown } = useSearch({ strict: false });
  const openId = search.jugador != null && search.jugador !== "" ? String(search.jugador) : null;
  const altaOpen = !openId && truthy(search.nuevo);
  const altaDorsal = dorsalParam(search.dorsal);
  const cromos = !openId && !altaOpen && search.vista === "cromos";
  /** A ficha opened from «Todos en cromos» goes back there. */
  const fromCromos = search.vista === "cromos";

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<BoardFilter>("todos");
  /** Writes waiting behind «Deshacer»: the doc as it will be, or null when it is being deleted. */
  const [pending, setPending] = useState<Pending>({});
  /** Re-mounts a ficha after an «Deshacer» (its starting point goes back to what is written). */
  const [revs, setRevs] = useState<Record<string, number>>({});
  /** What carries a view-transition name right now («kit:id» flies to / from the ficha, «row:id» glides). */
  const [flying, setFlying] = useState<ReadonlySet<string>>(new Set());
  const flightT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLElement>(null);
  useSlashFocus(searchRef);
  useEffect(
    () => () => {
      clearTimeout(flightT.current);
    },
    [],
  );

  const players = useMemo(() => {
    const base = data.players.filter((p) => pending[p.id] !== null).map((p) => pending[p.id] ?? p);
    const added = Object.values(pending).filter((p): p is PlayerDoc => !!p && !data.players.some((x) => x.id === p.id));
    return [...base, ...added];
  }, [data.players, pending]);
  const active = data.season;
  const code = active ? seasonCode(active.name) : "";
  const rows = useMemo(() => plantillaRows(players, data.seasons, active?.id), [players, data.seasons, active?.id]);
  const board = useMemo(() => boardRows(rows, { people: data.people, claims: data.claims }), [rows, data.people, data.claims]);
  const squad = useMemo(() => (active ? board.filter((r) => r.inSeason) : board), [board, active]);
  const dup = useMemo(() => repeatedDorsals(squad), [squad]);
  const chips = useMemo(() => filterChips(squad), [squad]);
  const coll = collection(squad);
  const term = q.trim();
  const hits = new Set(filterRows(squad, q, "Todos").map((r) => r.id));
  const shown = squad.filter((r) => hits.has(r.id) && matchesFilter(r, filter, dup));
  const others = active && term ? board.filter((r) => !r.inSeason && filterRows([r], q, "Todos").length) : [];
  const groups = boardGroups(shown);
  // ↑ ↓ / Anterior · Siguiente walk what is shown; «Siguiente sin completar» the whole season
  const order = [...listOrder(groups), ...others.map((r) => r.id)];
  const fullOrder = useMemo(() => listOrder(boardGroups(squad)), [squad]);
  // desktop: with nobody in the URL the ficha shows the first one that still lacks something
  const fallbackId = desktop && !altaOpen && !cromos ? (nextIncomplete(fullOrder, squad, null) ?? fullOrder[0] ?? null) : null;
  const curId = openId ?? fallbackId;
  // …and pins it in the URL, so fixing his line (he leaves «Sin posición») doesn't swap the ficha under you
  useEffect(() => {
    if (!openId && fallbackId) void navigate({ to: "/admin/plantilla", search: { jugador: fallbackId }, replace: true });
  }, [openId, fallbackId, navigate]);
  // who is out (red card or sanction by hand), with the changes still behind «Deshacer»; the matches to sanction until
  const suspended = useMemo(() => seasonSuspensions(data.matches, active?.id, players), [data.matches, active?.id, players]);
  const upcoming = useMemo(() => upcomingFor(data.matches, active?.id, data.now), [data.matches, active?.id, data.now]);
  const editing = curId ? (players.find((p) => p.id === curId) ?? null) : null;
  const editingRow = editing ? board.find((r) => r.id === editing.id) : undefined;
  const editingSusp = editing ? suspended.get(editing.id) : undefined;

  // The photos of the real kit (rendered once per name and dorsal, then kept on the device).
  const shot = (r: BoardRow) => ({ kit: "home" as const, theme, name: r.name.toLocaleUpperCase("es"), num: r.number != null ? String(r.number) : "" });
  const still = useShirtStills([...squad, ...others].map(shot), { offMainThread: true });
  const stillOf = (r: BoardRow) => still(shot(r));

  // ── navigation and flights (view transitions) ──
  const fly = (keys: string[]) => {
    clearTimeout(flightT.current);
    flushSync(() => setFlying(new Set(keys)));
    flightT.current = setTimeout(() => setFlying(new Set()), FLIGHT_MS);
  };
  const vt = canTransition();
  const go = (s: Search, flight: string[] = []) => {
    if (vt && flight.length) fly(flight);
    void navigate({ to: "/admin/plantilla", search: s, viewTransition: vt });
  };
  const openPlayer = (id: string) => {
    if (id === openId) return;
    go(phone && fromCromos ? { jugador: id, vista: "cromos" } : { jugador: id }, desktop ? [`kit:${id}`] : []);
  };
  const backToList = () => go(fromCromos ? { vista: "cromos" } : {});
  const openNow = useRef(openId);
  useEffect(() => {
    openNow.current = openId;
  });
  const openAlta = (dorsal: number | null = null) => go(dorsal ? { nuevo: true, dorsal } : { nuevo: true });
  const setView = (v: "lista" | "cromos") => go(v === "cromos" ? { vista: "cromos" } : {});
  const step = (dir: 1 | -1) => {
    const id = stepIn(order, curId, dir);
    if (id && id !== curId) openPlayer(id);
  };
  const nextGapId = nextIncomplete(fullOrder, squad, curId);

  // the selected row stays in view in the list (↑ ↓, «Siguiente sin completar»)
  useEffect(() => {
    if (!curId) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(curId)}"]`);
    row?.scrollIntoView?.({ block: "nearest" });
  }, [curId]);

  // ↑ ↓ walk the list (never while typing, with a modifier or a modal open)
  const keys = useRef({ step, modalOpen, enabled: !altaOpen && !cromos && (desktop || !!openId) });
  useEffect(() => {
    keys.current = { step, modalOpen, enabled: !altaOpen && !cromos && (desktop || !!openId) };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      if (!k.enabled || k.modalOpen || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      k.step(e.key === "ArrowDown" ? 1 : -1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /** Drops the pending docs once their write is settled — unless a newer change replaced them meanwhile. */
  const settle = (docs: Pending) => () =>
    setPending((p) => {
      const n = { ...p };
      let changed = false;
      for (const [id, doc] of Object.entries(docs))
        if (n[id] === doc) {
          delete n[id];
          changed = true;
        }
      return changed ? n : p;
    });
  /** The rows and group heads in view (plus `also`): they glide in a transition; the rest just appears. */
  const inView = (also: readonly string[] = []) => {
    const keySet = new Set(also.map((id) => `row:${id}`));
    const box = listRef.current?.getBoundingClientRect();
    if (!box) return [...keySet];
    for (const el of listRef.current?.querySelectorAll<HTMLElement>("[data-id], [data-g]") ?? []) {
      const r = el.getBoundingClientRect();
      if (r.bottom > box.top && r.top < box.bottom) keySet.add(el.dataset.id ? `row:${el.dataset.id}` : `gh:${el.dataset.g}`);
    }
    return [...keySet];
  };
  /** Changes the list with its rows gliding to their new place (a plain update without the API). */
  const reflow = (apply: () => void, also: readonly string[] = []) => {
    if (!vt) return apply();
    fly(inView(also));
    void viewTransition(apply);
  };
  /** «Deshacer» on a ficha: it remounts on what is written, dropping what was typed (no save on the way out). */
  const resetting = useRef<string | null>(null);
  const reopen = (id: string) => {
    resetting.current = id;
    setRevs((r) => ({ ...r, [id]: (r[id] ?? 0) + 1 }));
  };
  useEffect(() => {
    resetting.current = null;
  }, [revs]);

  // ── quick edits: the line (from the list or the ficha) and Activo / Lesionado ──
  const setLine = (target: BoardRow, p: Position) => {
    if (target.position === p) return;
    const write = linePickPayload(target.doc, p);
    const docs: Pending = { [target.id]: { ...target.doc, ...write } };
    reflow(() => setPending((s) => ({ ...s, ...docs })), [target.id]);
    const done = settle(docs);
    toast.defer({
      tag: "LÍNEA",
      message: `${target.name} pasa ${LINE_TO[p]}`,
      commit: () => writes.savePlayer(target.id, write),
      onUndo: () => reflow(done, [target.id]),
      onError: done,
      onDone: done,
      errorMessage: `No se ha podido cambiar la línea de ${target.name}`,
    });
  };
  // ── Posiciones: the ficha's map (a direct edit, or the captain's adjustment of a proposal) and the verdict
  //    on a proposal. Writes replace `positions` whole (main + also), with naturalPosition in step. ──
  const writePositions = (target: BoardRow, write: Partial<PlayerDoc>, tag: string, message: string, error: string) => {
    const docs: Pending = { [target.id]: { ...target.doc, ...write } };
    reflow(() => setPending((s) => ({ ...s, ...docs })), [target.id]);
    const done = settle(docs);
    toast.defer({
      tag,
      message,
      commit: () => writes.savePlayer(target.id, write),
      onUndo: () => reflow(done, [target.id]),
      onError: done,
      onDone: done,
      errorMessage: error,
    });
  };
  const setPositions = (target: BoardRow, set: PositionSet, adjusted: boolean) => {
    if (adjusted)
      writePositions(target, reviewPayload("ajustada", set, user?.uid ?? "", serverTimestamp()), "PROPUESTA", `${target.name}: propuesta ajustada · ${summaryText(set)}`, `No se ha podido ajustar la propuesta de ${target.name}`);
    else writePositions(target, positionsPayload(set), "POSICIÓN", `Posiciones de ${target.name}: ${summaryText(set)}`, `No se han podido cambiar las posiciones de ${target.name}`);
  };
  const reviewProposal = (target: BoardRow, kind: "aprobada" | "rechazada") => {
    const proposal = sanitizePositions(target.doc.positionsProposal);
    if (!proposal) return;
    const write = reviewPayload(kind, kind === "aprobada" ? proposal : null, user?.uid ?? "", serverTimestamp());
    if (kind === "aprobada") writePositions(target, write, "PROPUESTA", `${target.name}: propuesta aprobada · ${summaryText(proposal)}`, `No se ha podido aprobar la propuesta de ${target.name}`);
    else writePositions(target, write, "PROPUESTA", `${target.name}: propuesta rechazada · siguen las de antes`, `No se ha podido rechazar la propuesta de ${target.name}`);
  };
  // ── Sancionado: set by hand (matches or «hasta la J…») and lifted (the acta's red card too) ──
  const setSanction = (target: BoardRow, choice: SanctionChoice) => {
    const sanction = sanctionWrite(choice, data.now, user?.uid ?? "");
    const docs: Pending = { [target.id]: sanctionedDoc(target.doc, sanction) };
    setPending((s) => ({ ...s, ...docs }));
    const done = settle(docs);
    toast.defer({
      tag: "SANCIÓN",
      message: sanctionToast(target.name, choice, data.matches),
      commit: () => writes.savePlayer(target.id, { sanction }),
      onUndo: done,
      onError: done,
      onDone: done,
      errorMessage: `No se ha podido sancionar a ${target.name}`,
    });
  };
  const liftSanction = (target: BoardRow) => {
    const at = data.now;
    const docs: Pending = { [target.id]: liftedDoc(target.doc, at) };
    setPending((s) => ({ ...s, ...docs }));
    const done = settle(docs);
    toast.defer({
      tag: "SANCIÓN",
      message: `${target.name}, sanción levantada · vuelve a estar disponible`,
      commit: () => writes.savePlayer(target.id, liftWrite(at)),
      onUndo: done,
      onError: done,
      onDone: done,
      errorMessage: `No se ha podido levantar la sanción de ${target.name}`,
    });
  };
  const setInjured = (target: BoardRow, injured: boolean) => {
    if (target.injured === injured) return;
    const docs: Pending = { [target.id]: { ...target.doc, injured } };
    setPending((s) => ({ ...s, ...docs }));
    const done = settle(docs);
    toast.defer({
      tag: "PARTE",
      message: injured ? `${target.name}, lesionado` : `${target.name} vuelve a estar disponible`,
      commit: () => writes.savePlayer(target.id, { injured }),
      onUndo: done,
      onError: done,
      onDone: done,
      errorMessage: `No se ha podido cambiar el estado de ${target.name}`,
    });
  };

  // ── the ficha saving itself, the alta, the baja ──
  const save = (player: PlayerDoc, form: PlayerForm) => {
    const id = player.id;
    const payload = playerPayload(form, { stored: player });
    const doc = previewDoc(player, id, payload);
    const sid = active && (doc.seasons ?? []).includes(active.id) ? active.id : undefined;
    const name = nameIn(doc, sid);
    const docs: Pending = { [id]: doc };
    const done = settle(docs);
    setPending((p) => ({ ...p, ...docs }));
    toast.defer({
      tag: "FICHA",
      message: `Ficha de ${name} guardada`,
      commit: () => writes.savePlayer(id, payload),
      onUndo: () => {
        done();
        reopen(id);
      },
      onError: () => {
        done();
        reopen(id);
      },
      onDone: done,
      errorMessage: `No se ha podido guardar a ${name}`,
    });
  };
  const alta = (form: PlayerForm, positions: PositionSet) => {
    const id = writes.newPlayerId();
    const payload = playerPayload(form, { createdAt: new Date(), positions });
    const doc = previewDoc(null, id, payload);
    const sid = active && (doc.seasons ?? []).includes(active.id) ? active.id : undefined;
    const name = nameIn(doc, sid);
    const num = numberIn(doc, sid);
    const docs: Pending = { [id]: doc };
    const done = settle(docs);
    setPending((p) => ({ ...p, ...docs }));
    go({ jugador: id });
    toast.defer({
      tag: "ALTA",
      message: `${name} entra en la plantilla con el ${num ?? "—"}`,
      commit: () => writes.savePlayer(id, payload),
      onUndo: () => {
        done();
        if (openNow.current === id) go({});
      },
      onError: done,
      onDone: done,
      errorMessage: `No se ha podido dar de alta a ${name}`,
    });
  };
  const baja = (player: PlayerDoc) => {
    const sid = active && (player.seasons ?? []).includes(active.id) ? active.id : undefined;
    const name = nameIn(player, sid);
    go({});
    if (active) {
      const payload = bajaPayload(player, active.id);
      const docs: Pending = { [player.id]: { ...player, ...payload } };
      const done = settle(docs);
      setPending((p) => ({ ...p, ...docs }));
      toast.defer({
        tag: "BAJA",
        message: `${name} de baja · sus actas y estadísticas se quedan`,
        commit: () => writes.savePlayer(player.id, payload),
        onUndo: done,
        onError: done,
        onDone: done,
        errorMessage: `No se ha podido dar de baja a ${name}`,
      });
      return;
    }
    const docs: Pending = { [player.id]: null };
    const done = settle(docs);
    setPending((p) => ({ ...p, ...docs }));
    toast.defer({
      tag: "BAJA",
      message: `${name} de baja · su ficha se borra`,
      commit: () => writes.deletePlayer(player.id),
      onUndo: done,
      onError: done,
      onDone: done,
      errorMessage: `No se ha podido dar de baja a ${name}`,
    });
  };

  const exportCsv = () => {
    downloadText(csvFileName(active?.name), rosterCsv(rows));
    toast.show({ tag: "CSV", message: `Plantilla exportada · ${plural(rows.length, "jugador", "jugadores")} en el CSV` });
  };
  const exportRef = useRef(exportCsv);
  useEffect(() => {
    exportRef.current = exportCsv;
  });
  useRegisterCommands(
    useMemo<PaletteCommand[]>(
      () => [{ id: "plantilla:exportar", group: "Acciones", icon: "↓", title: "Exportar plantilla (CSV)", description: `${plural(rows.length, "jugador", "jugadores")} · se abre en Excel`, hint: "acción", keywords: "csv excel descargar hoja", run: () => exportRef.current() }],
      [rows.length],
    ),
  );

  const toggleFilter = (f: BoardFilter) => {
    const next = filter === f ? "todos" : f;
    reflow(() => setFilter(next));
  };
  const empty = shown.length || others.length ? null : term ? `Nadie con «${term}».` : filter !== "todos" ? `Ya no queda nadie en «${FILTER_LABEL[filter as Exclude<BoardFilter, "todos">]}».` : "La plantilla está vacía: da de alta al primero.";
  const lead = filter !== "todos" || term ? `${shown.length} de ${plural(squad.length, "jugador", "jugadores")}` : `${active?.name ?? "Sin temporada"} · ${plural(squad.length, "jugador", "jugadores")}`;
  const stats = (id: string) => data.squad.byId.get(id)?.stats;
  const free = freeDorsals(squad, 24);

  // ── pieces ──
  const searchBox = (
    <label className="srch">
      <AdIcon name="search" size={18} />
      <input ref={searchRef} id="plq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o dorsal" aria-label="Buscar jugador" aria-keyshortcuts="/" autoComplete="off" />
    </label>
  );
  const viewSeg = (
    <span className="vseg" role="group" aria-label="Vista">
      <button type="button" aria-pressed={!cromos} onClick={() => setView("lista")}>
        <AdIcon name="team" size={16} />
        {phone ? "Lista" : "Ficha a ficha"}
      </button>
      <button type="button" aria-pressed={cromos} onClick={() => setView("cromos")}>
        <AdIcon name="card" size={16} />
        {phone ? "Cromos" : "Todos en cromos"}
      </button>
    </span>
  );
  const altaButton = (
    <button type="button" className={phone ? "btn sm gold ic" : "btn sm gold"} onClick={() => openAlta()} aria-label={phone ? "Alta de jugador" : undefined}>
      <AdIcon name="plus" size={16} />
      {phone ? null : "Alta de jugador"}
    </button>
  );
  const bar = (
    <div className="plbar">
      <div className="coll" role="img" aria-label={`Fichas completas: ${coll.done} de ${coll.total}`}>
        <span className="tx" aria-hidden="true">
          <b>{coll.done}</b>/{coll.total} fichas completas
        </span>
        <span className="cells" aria-hidden="true">
          {squad
            .map((r) => !r.gaps.length)
            .sort((a, b) => Number(b) - Number(a))
            .map((done, i) => (
              <i key={i} className={done ? "on" : ""} />
            ))}
        </span>
      </div>
      {chips.length ? (
        <div className="chips" role="group" aria-label="Qué falta">
          {chips.map((c) => (
            <button key={c.key} type="button" aria-pressed={filter === c.key} onClick={() => toggleFilter(c.key)}>
              {c.label}
              <em>{c.n}</em>
            </button>
          ))}
          {filter !== "todos" && !chips.some((c) => c.key === filter) ? (
            <button type="button" aria-pressed onClick={() => toggleFilter("todos")}>
              {FILTER_LABEL[filter]}
              <em>0</em>
            </button>
          ) : null}
        </div>
      ) : (
        <p className="ok">
          <AdIcon name="check" size={16} />
          Todo en orden: fichas completas, sin repetidos
        </p>
      )}
    </div>
  );
  const list = (
    <PlantillaList
      groups={groups}
      others={others}
      code={code}
      selectedId={curId}
      still={stillOf}
      onOpen={openPlayer}
      onLine={setLine}
      flying={flying}
      boxRef={listRef}
      empty={empty}
      quickLine
      sanctioned={suspended}
    />
  );
  const grid = <CromosGrid rows={shown} still={stillOf} onOpen={openPlayer} onAlta={() => openAlta()} flying={flying} empty={empty} phone={phone} />;
  const csv = (
    <button type="button" className="btn sm line csv" onClick={exportCsv} disabled={!rows.length} aria-label="Exportar la plantilla (CSV)">
      <AdIcon name="doc" size={16} />
      Exportar CSV
    </button>
  );
  const ficha =
    editing && editingRow ? (
      <FichaWorkspace
        key={`${editing.id}:${revs[editing.id] ?? 0}`}
        player={editing}
        row={editingRow}
        players={players}
        seasons={data.seasons}
        activeSeason={active}
        stats={stats(editing.id)}
        still={stillOf(editingRow)}
        vt={vt ? vtName("pl-kit", editing.id) : undefined}
        index={Math.max(1, order.indexOf(editing.id) + 1)}
        total={order.length || squad.length}
        story={!!(editing.bio?.trim() || editing.quote?.trim())}
        phone={phone}
        onPositions={(set, adjusted) => setPositions(editingRow, set, adjusted)}
        onReview={(kind) => reviewProposal(editingRow, kind)}
        onInjured={(v) => setInjured(editingRow, v)}
        suspension={editingSusp}
        suspensionText={editingSusp ? sanctionStatus(editingSusp, data.matches) : undefined}
        upcoming={upcoming}
        onSanction={(c) => setSanction(editingRow, c)}
        onLift={() => liftSanction(editingRow)}
        onSave={(form) => save(editing, form)}
        onBaja={() => baja(editing)}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onNextGap={nextGapId ? () => openPlayer(nextGapId) : null}
        onBack={backToList}
        keepOnLeave={() => resetting.current !== editing.id}
      />
    ) : null;
  const altaWs = <AltaWorkspace key={`alta:${altaDorsal ?? ""}`} players={players} seasons={data.seasons} activeSeason={active} free={free} initialNumber={altaDorsal} phone={phone} onCancel={() => go({})} onAlta={alta} />;
  const noFicha = (
    <section className="pl3f none" aria-label="Sin ficha abierta">
      <p>{squad.length ? "Elige un jugador de la lista para ver su ficha." : "Todavía no hay nadie en la plantilla."}</p>
      <button type="button" className="btn gold" onClick={() => openAlta()}>
        <AdIcon name="plus" size={16} />
        Alta de jugador
      </button>
    </section>
  );

  if (data.error) return <LoadError what="la plantilla" />;
  if (data.loading)
    return (
      <div className="skel" aria-label="Cargando la plantilla" role="status" style={{ flex: 1 }}>
        <i />
        <i />
        <i />
      </div>
    );

  if (phone) {
    if (altaOpen) return <div className="msc plm">{altaWs}</div>;
    if (openId && ficha) return <div className="msc plm">{ficha}</div>;
    return (
      <div className="msc plm">
        <div className="mtop">
          {searchBox}
          {altaButton}
        </div>
        {bar}
        {viewSeg}
        {cromos ? grid : list}
        {csv}
      </div>
    );
  }
  return (
    <>
      <div className="vh">
        <div>
          <h1 className="ttl">Plantilla</h1>
          <p className="ld" aria-live="polite">
            {lead}
          </p>
        </div>
        <div className="r">
          {searchBox}
          {viewSeg}
          {altaButton}
        </div>
      </div>
      {bar}
      {cromos ? (
        <div className="pl3c">
          {grid}
          {csv}
        </div>
      ) : (
        <div className="pl3s">
          <div className="pl3lw">
            {list}
            {csv}
          </div>
          {altaOpen ? altaWs : (ficha ?? noFicha)}
        </div>
      )}
    </>
  );
}
