// Plantilla (/admin/plantilla?jugador=&nuevo&dorsal=) — «el tablón»: the season's players grouped by line,
// each row his real kit (the photo of the 3D shirt), dorsal, name, the line and Activo / Lesionado set in
// place, his account, GOL · ASI · PJ and the ficha's slots (what it lacks). Above it the collection («4 de 12
// fichas completas») and the gap chips (Sin posición · Sin foto · Faltan datos · Lesionados · Sin cuenta ·
// Piden su ficha · Dorsal repetido) that isolate who needs what; rows can be selected for the batch bar
// (line, estado). Beside it, the open ficha (club/PlayerDrawer: his cromo with the kit flown in from the row
// by a view transition, the form, his account and web) or, with none open, the squad at a glance
// (club/PlantillaSide: lines, injured, free dorsals that start an «Alta»). Every write waits behind a lower
// third with «Deshacer» (the tablón shows it at once; undone, nothing is written). «Dar de baja» takes him
// off the season (his doc, actas and carta stay). While searching, players of other seasons show too,
// dimmed (that is how one comes back). CSV export. Phones: the rows fold, the ficha is a sheet.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useShirtStills } from "../../../components/jersey3d/useShirtStills";
import { useDocumentTheme } from "../../../hooks/useDocumentTheme";
import type { PlayerDoc } from "../../../lib/schemas";
import { LoadError } from "../club/ClubStates";
import { downloadText } from "../club/download";
import { PlayerDrawer } from "../club/PlayerDrawer";
import { PlantillaSide } from "../club/PlantillaSide";
import {
  FILTER_LABEL,
  boardGroups,
  boardRows,
  collection,
  dorsalParam,
  filterChips,
  matchesFilter,
  repeatedDorsals,
  type BoardFilter,
  type BoardRow,
} from "../club/plantillaBoard";
import { POSITIONS, bajaPayload, csvFileName, filterRows, nameIn, numberIn, playerPayload, plantillaRows, previewDoc, rosterCsv, seasonCode, type PlayerForm, type Position } from "../club/plantillaLogic";
import { Tablon } from "../club/Tablon";
import { useClubWrites } from "../club/useClubWrites";
import { useSlashFocus } from "../club/useSlashFocus";
import { useRegisterCommands } from "../palette/registry";
import type { PaletteCommand } from "../palette/search";
import { useAdmin } from "../shell/context";
import { useFrame } from "../ui/frame";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";
import { canTransition, viewTransition, vtName } from "../ui/viewTransition";
import "../club/plantilla.css";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const truthy = (v: unknown) => v === true || v === 1 || v === "1" || v === "true";
const FRESH_MS = 1600;
/** «pasa a la defensa» / «pasa al medio». */
const LINE_TO: Record<Position, string> = { POR: "a la portería", DEF: "a la defensa", MED: "al medio", DEL: "a la delantera" };
/** How long a flying kit / row keeps its transition name (longer than the morph). */
const FLIGHT_MS = 900;

type Pending = Record<string, PlayerDoc | null>;

export function Plantilla() {
  const data = useAdmin();
  const { desktop } = useFrame();
  const toast = useToast();
  const writes = useClubWrites();
  const navigate = useNavigate();
  const theme = useDocumentTheme();
  const search: { jugador?: unknown; nuevo?: unknown; dorsal?: unknown } = useSearch({ strict: false });
  const openId = search.jugador != null && search.jugador !== "" ? String(search.jugador) : null;
  const altaOpen = !openId && truthy(search.nuevo);
  const altaDorsal = dorsalParam(search.dorsal);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<BoardFilter>("todos");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  /** Writes waiting behind «Deshacer»: the doc as it will be, or null when it is being deleted. */
  const [pending, setPending] = useState<Pending>({});
  const [fresh, setFresh] = useState("");
  /** Re-mounts the ficha after a save (its starting point becomes what was saved). */
  const [saves, setSaves] = useState(0);
  /** What carries a view-transition name right now («kit:id» flies to / from the ficha, «row:id» moves). */
  const [flying, setFlying] = useState<ReadonlySet<string>>(new Set());
  const flightT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const freshT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useSlashFocus(searchRef);
  useEffect(
    () => () => {
      clearTimeout(flightT.current);
      clearTimeout(freshT.current);
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
  // the filter of a chip that no longer matches anybody stays on (it says «nadie»), so a fix doesn't jump
  const term = q.trim();
  const hits = new Set(filterRows(squad, q, "Todos").map((r) => r.id));
  const shown = squad.filter((r) => hits.has(r.id) && matchesFilter(r, filter, dup));
  const others = active && term ? board.filter((r) => !r.inSeason && filterRows([r], q, "Todos").length) : [];
  const groups = boardGroups(shown);
  const editing = openId ? (players.find((p) => p.id === openId) ?? null) : null;
  const editingRow = editing ? board.find((r) => r.id === editing.id) : undefined;
  const drawerOpen = !data.loading && (altaOpen || !!editing);

  // The photos of the real kit (rendered once per name and dorsal, then kept on the device).
  const shot = (r: BoardRow) => ({ kit: "home" as const, theme, name: r.name.toLocaleUpperCase("es"), num: r.number != null ? String(r.number) : "" });
  const still = useShirtStills([...squad, ...others].map(shot), { offMainThread: true });
  const stillOf = (r: BoardRow) => still(shot(r));

  // ── flights (view transitions) ──
  const fly = (keys: string[]) => {
    clearTimeout(flightT.current);
    flushSync(() => setFlying(new Set(keys)));
    flightT.current = setTimeout(() => setFlying(new Set()), FLIGHT_MS);
  };
  const vt = desktop && canTransition();
  const goTo = (s: { jugador?: string; nuevo?: true; dorsal?: number }) => void navigate({ to: "/admin/plantilla", search: s, viewTransition: vt });
  const openPlayer = (id: string) => {
    if (id === openId) return;
    if (vt) fly([`kit:${id}`]);
    goTo({ jugador: id });
  };
  const closeDrawer = () => {
    if (vt && openId) fly([`kit:${openId}`]);
    void navigate({ to: "/admin/plantilla", search: {}, viewTransition: vt });
  };
  const openAlta = (dorsal: number | null) => goTo(dorsal ? { nuevo: true, dorsal } : { nuevo: true });

  const mark = (id: string) => {
    setFresh(id);
    clearTimeout(freshT.current);
    freshT.current = setTimeout(() => setFresh((f) => (f === id ? "" : f)), FRESH_MS);
  };
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
    const box = boxRef.current?.getBoundingClientRect();
    const keys = new Set(also.map((id) => `row:${id}`));
    if (!box) return [...keys];
    for (const el of boxRef.current?.querySelectorAll<HTMLElement>("tr[data-id], tr[data-g]") ?? []) {
      const r = el.getBoundingClientRect();
      if (r.bottom > box.top && r.top < box.bottom) keys.add(el.dataset.id ? `row:${el.dataset.id}` : `gh:${el.dataset.g}`);
    }
    return [...keys];
  };
  /** Changes the tablón with its rows gliding to their new place (a plain update without the API). */
  const reflow = (apply: () => void, also: readonly string[] = []) => {
    if (!canTransition()) return apply();
    fly(inView(also));
    void viewTransition(apply);
  };
  /** Shows docs at once; with `move`, the rows glide to their new place. */
  const show = (docs: Pending, move: boolean) => {
    const apply = () => setPending((p) => ({ ...p, ...docs }));
    if (!move) return apply();
    reflow(apply, Object.keys(docs));
  };

  // ── quick edits in the tablón (line, estado; one or a selection) ──
  const setLine = (targets: readonly BoardRow[], p: Position) => {
    const list = targets.filter((r) => r.position !== p);
    if (!list.length) return;
    const docs: Pending = Object.fromEntries(list.map((r) => [r.id, { ...r.doc, naturalPosition: p }]));
    show(docs, true);
    const done = settle(docs);
    toast.defer({
      tag: "LÍNEA",
      message: list.length === 1 ? `${list[0].name} pasa ${LINE_TO[p]}` : `${plural(list.length, "jugador pasa", "jugadores pasan")} ${LINE_TO[p]}`,
      commit: () => Promise.all(list.map((r) => writes.savePlayer(r.id, { naturalPosition: p }))),
      onUndo: () => reflow(done, list.map((r) => r.id)),
      onError: done,
      onDone: done,
      errorMessage: list.length === 1 ? `No se ha podido cambiar la línea de ${list[0].name}` : "No se han podido cambiar las líneas",
    });
  };
  const setInjured = (targets: readonly BoardRow[], injured: boolean) => {
    const list = targets.filter((r) => r.injured !== injured);
    if (!list.length) return;
    const docs: Pending = Object.fromEntries(list.map((r) => [r.id, { ...r.doc, injured }]));
    show(docs, filter === "lesion");
    const done = settle(docs);
    const who = list.length === 1 ? list[0].name : plural(list.length, "jugador", "jugadores");
    toast.defer({
      tag: "PARTE",
      message: injured ? `${who}, ${list.length === 1 ? "lesionado" : "lesionados"}` : `${who} ${list.length === 1 ? "vuelve" : "vuelven"} a estar disponible${list.length === 1 ? "" : "s"}`,
      commit: () => Promise.all(list.map((r) => writes.savePlayer(r.id, { injured }))),
      onUndo: done,
      onError: done,
      onDone: done,
      errorMessage: `No se ha podido cambiar el estado de ${who}`,
    });
  };
  const pick = (ids: readonly string[], on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      for (const id of ids) {
        if (on) n.add(id);
        else n.delete(id);
      }
      return n;
    });
  const pickedRows = squad.filter((r) => picked.has(r.id));
  const batch = (fn: () => void) => {
    fn();
    setPicked(new Set());
  };

  // ── the ficha: save, alta, baja ──
  const save = (player: PlayerDoc | null, form: PlayerForm) => {
    const id = player?.id ?? writes.newPlayerId();
    const payload = playerPayload(form, player ? null : { createdAt: new Date() });
    const doc = previewDoc(player, id, payload);
    const sid = active && (doc.seasons ?? []).includes(active.id) ? active.id : undefined;
    const name = nameIn(doc, sid);
    const num = numberIn(doc, sid);
    const docs: Pending = { [id]: doc };
    const done = settle(docs);
    setPending((p) => ({ ...p, ...docs }));
    mark(id);
    if (player) {
      // Guardar: the ficha stays open on what was saved; «Deshacer» closes it, as it was.
      setSaves((n) => n + 1);
      const back = () => {
        done();
        setSaves((n) => n + 1);
      };
      toast.defer({
        tag: "FICHA",
        message: `Ficha de ${name} guardada`,
        commit: () => writes.savePlayer(id, payload),
        onUndo: () => {
          done();
          closeDrawer();
        },
        onError: back,
        onDone: done,
        errorMessage: `No se ha podido guardar a ${name}`,
      });
      return;
    }
    void navigate({ to: "/admin/plantilla", search: {} });
    toast.defer({
      tag: "ALTA",
      message: `${name} entra en la plantilla con el ${num ?? "—"}`,
      commit: () => writes.savePlayer(id, payload),
      onUndo: done,
      onError: done,
      onDone: done,
      errorMessage: `No se ha podido dar de alta a ${name}`,
    });
  };

  const baja = (player: PlayerDoc) => {
    const sid = active && (player.seasons ?? []).includes(active.id) ? active.id : undefined;
    const name = nameIn(player, sid);
    void navigate({ to: "/admin/plantilla", search: {} });
    if (active) {
      const payload = bajaPayload(player, active.id);
      const docs: Pending = { [player.id]: { ...player, ...payload } };
      const done = settle(docs);
      setPending((p) => ({ ...p, ...docs }));
      toast.defer({
        tag: "BAJA",
        message: `${name} de baja · sus actas y estadísticas se quedan`,
        commit: () => writes.savePlayer(player.id, payload),
        onUndo: () => {
          done();
          mark(player.id);
        },
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

  const exportCsv = useCallback(() => {
    downloadText(csvFileName(active?.name), rosterCsv(rows));
    toast.show({ tag: "CSV", message: `Plantilla exportada · ${plural(rows.length, "jugador", "jugadores")} en el CSV` });
  }, [active?.name, rows, toast]);
  useRegisterCommands(
    useMemo<PaletteCommand[]>(
      () => [{ id: "plantilla:exportar", group: "Acciones", icon: "↓", title: "Exportar plantilla (CSV)", description: `${plural(rows.length, "jugador", "jugadores")} · se abre en Excel`, hint: "acción", keywords: "csv excel descargar hoja", run: exportCsv }],
      [rows.length, exportCsv],
    ),
  );

  const toggleFilter = (f: BoardFilter) => {
    const next = filter === f ? "todos" : f;
    reflow(() => setFilter(next));
  };
  const empty = shown.length || others.length ? null : term ? `Nadie con «${term}».` : filter !== "todos" ? `Ya no queda nadie en «${FILTER_LABEL[filter as Exclude<BoardFilter, "todos">]}».` : "La plantilla está vacía: da de alta al primero.";
  const lead = filter !== "todos" || term ? `${shown.length} de ${plural(squad.length, "jugador", "jugadores")}` : `${active?.name ?? "Sin temporada"} · ${plural(squad.length, "jugador", "jugadores")}`;
  const stats = (id: string) => data.squad.byId.get(id)?.stats;

  const table = data.error ? (
    <LoadError what="la plantilla" />
  ) : data.loading ? (
    <div className="skel" aria-label="Cargando la plantilla" role="status" style={{ flex: 1 }}>
      <i />
      <i />
      <i />
    </div>
  ) : (
    <Tablon
      groups={groups}
      others={others}
      code={code}
      selectedId={editing?.id ?? null}
      picked={desktop ? picked : new Set()}
      onPick={pick}
      onOpen={openPlayer}
      onPosition={setLine}
      onInjured={(r, v) => setInjured([r], v)}
      still={stillOf}
      flying={flying}
      dup={dup}
      stats={stats}
      fresh={fresh}
      empty={empty}
      boxRef={boxRef}
    />
  );

  const drawer = drawerOpen ? (
    <PlayerDrawer
      key={editing ? `${editing.id}:${saves}` : `nuevo:${altaDorsal ?? ""}`}
      player={editing}
      players={players}
      seasons={data.seasons}
      activeSeason={active}
      cromo={editing ? data.squad.byId.get(editing.id) : undefined}
      games={data.games}
      inline={desktop}
      onClose={closeDrawer}
      onSave={(form) => save(editing, form)}
      onBaja={() => editing && baja(editing)}
      still={editingRow ? stillOf(editingRow) : undefined}
      vt={desktop && editing ? vtName("pl-kit", editing.id) : undefined}
      gaps={editingRow?.gaps}
      account={editingRow ? { state: editingRow.account, who: editingRow.who } : undefined}
      story={!!(editing?.bio?.trim() || editing?.quote?.trim())}
      initialNumber={altaOpen ? altaDorsal : null}
    />
  ) : null;

  const searchBox = (
    <label className="srch">
      <AdIcon name="search" size={18} />
      <input ref={searchRef} id="plq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o dorsal" aria-label="Buscar jugador" aria-keyshortcuts="/" autoComplete="off" />
    </label>
  );
  const altaButton = (
    <button type="button" className={desktop ? "btn sm gold" : "btn sm gold ic"} onClick={() => openAlta(null)} aria-label={desktop ? undefined : "Alta de jugador"}>
      <AdIcon name="plus" size={16} />
      {desktop ? "Alta de jugador" : null}
    </button>
  );
  const bar =
    desktop && pickedRows.length ? (
      <div className="plbar bulk" role="toolbar" aria-label="Cambiar a los seleccionados">
        <b>{plural(pickedRows.length, "seleccionado", "seleccionados")}</b>
        <span className="pseg" role="group" aria-label="Línea de los seleccionados">
          {POSITIONS.map((p) => (
            <button key={p} type="button" onClick={() => batch(() => setLine(pickedRows, p))}>
              {p}
            </button>
          ))}
        </span>
        <button type="button" className="btn sm line" onClick={() => batch(() => setInjured(pickedRows, true))}>
          Lesionados
        </button>
        <button type="button" className="btn sm line" onClick={() => batch(() => setInjured(pickedRows, false))}>
          Disponibles
        </button>
        <button type="button" className="btn sm line clr" onClick={() => setPicked(new Set())}>
          <AdIcon name="x" size={14} />
          Quitar selección
        </button>
      </div>
    ) : (
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

  if (!desktop)
    return (
      <>
        <div className="msc plm">
          <div className="mtop">
            {searchBox}
            {altaButton}
          </div>
          {bar}
          {table}
        </div>
        {drawer}
      </>
    );
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
          {altaButton}
        </div>
      </div>
      {bar}
      <div className="plg2">
        {table}
        {drawer ?? (
          <PlantillaSide rows={squad} still={stillOf} onFilter={toggleFilter} onOpen={openPlayer} onAlta={openAlta} onExport={exportCsv} />
        )}
      </div>
    </>
  );
}
