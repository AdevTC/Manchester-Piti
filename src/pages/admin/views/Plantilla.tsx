// Plantilla (/admin/plantilla?jugador=&nuevo) — la percha: the season's shirts hung on rails (7 per rail; 5
// with the cajón open beside it; 3 on phones), search by name or dorsal («/» focuses it), the position
// filter, and the last peg «Alta de jugador» (the empty shirt). While searching, players of other seasons
// show too, dimmed (that is how one comes back). A shirt opens his cajón (club/PlayerDrawer: the cromo + the
// form); Guardar keeps it open, Dar de alta closes it and the new shirt hangs with a swing. Every write waits
// behind a lower third with «Deshacer» (the wall shows the change at once; undone, nothing is written).
// «Dar de baja» takes his shirt off the season's percha (his doc, actas and carta stay). CSV export.
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { PlayerDoc } from "../../../lib/schemas";
import { LoadError } from "../club/ClubStates";
import { downloadText } from "../club/download";
import { PlayerDrawer } from "../club/PlayerDrawer";
import {
  POS_LABEL,
  POSITIONS,
  bajaPayload,
  csvFileName,
  nameIn,
  numberIn,
  perchaOf,
  plantillaRows,
  playerPayload,
  previewDoc,
  rosterCsv,
  seasonCode,
  type PlantillaRow,
  type PlayerForm,
  type PosFilter,
} from "../club/plantillaLogic";
import { useClubWrites } from "../club/useClubWrites";
import { useSlashFocus } from "../club/useSlashFocus";
import { Peg, PegRail, pegsPerRail, railsOf } from "../kit";
import { useRegisterCommands } from "../palette/registry";
import type { PaletteCommand } from "../palette/search";
import { useAdmin } from "../shell/context";
import { useFrame } from "../ui/frame";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const truthy = (v: unknown) => v === true || v === 1 || v === "1" || v === "true";
const FILTERS: PosFilter[] = ["Todos", ...POSITIONS];
const FRESH_MS = 1600;

type WallItem = { kind: "player"; row: PlantillaRow; other: boolean } | { kind: "alta" };

export function Plantilla() {
  const data = useAdmin();
  const { desktop } = useFrame();
  const toast = useToast();
  const writes = useClubWrites();
  const navigate = useNavigate();
  const search: { jugador?: unknown; nuevo?: unknown } = useSearch({ strict: false });
  const openId = search.jugador != null && search.jugador !== "" ? String(search.jugador) : null;
  const altaOpen = !openId && truthy(search.nuevo);

  const [q, setQ] = useState("");
  const [pos, setPos] = useState<PosFilter>("Todos");
  /** Writes waiting behind «Deshacer»: the doc as it will be, or null when it is being deleted. */
  const [pending, setPending] = useState<Record<string, PlayerDoc | null>>({});
  const [fresh, setFresh] = useState("");
  /** Re-mounts the cajón after a save (its starting point becomes what was saved). */
  const [saves, setSaves] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  useSlashFocus(searchRef);

  const players = useMemo(() => {
    const base = data.players.filter((p) => pending[p.id] !== null).map((p) => pending[p.id] ?? p);
    const added = Object.values(pending).filter((p): p is PlayerDoc => !!p && !data.players.some((x) => x.id === p.id));
    return [...base, ...added];
  }, [data.players, pending]);
  const active = data.season;
  const rows = useMemo(() => plantillaRows(players, data.seasons, active?.id), [players, data.seasons, active?.id]);
  const { squad, others } = perchaOf(rows, q, pos, !!active);
  const editing = openId ? (players.find((p) => p.id === openId) ?? null) : null;
  const drawerOpen = !data.loading && (altaOpen || !!editing);
  const per = pegsPerRail(desktop, drawerOpen);
  const code = active ? seasonCode(active.name) : "";

  const closeDrawer = useCallback(() => void navigate({ to: "/admin/plantilla", search: {} }), [navigate]);
  const openPlayer = (id: string) => void navigate({ to: "/admin/plantilla", search: { jugador: id } });
  const openAlta = () => void navigate({ to: "/admin/plantilla", search: { nuevo: true } });

  const hang = (id: string) => {
    setFresh(id);
    setTimeout(() => setFresh((f) => (f === id ? "" : f)), FRESH_MS);
    requestAnimationFrame(() => wallRef.current?.querySelector(".peg.open")?.scrollIntoView?.({ block: "nearest" }));
  };
  const settle = (id: string) => () =>
    setPending((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });

  const save = (player: PlayerDoc | null, form: PlayerForm) => {
    const id = player?.id ?? writes.newPlayerId();
    const payload = playerPayload(form, player ? null : { createdAt: new Date() });
    const doc = previewDoc(player, id, payload);
    const sid = active && (doc.seasons ?? []).includes(active.id) ? active.id : undefined;
    const name = nameIn(doc, sid);
    const num = numberIn(doc, sid);
    const done = settle(id);
    setPending((p) => ({ ...p, [id]: doc }));
    hang(id);
    if (player) {
      // Guardar: the cajón stays open on what was saved; «Deshacer» closes it, as it was.
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
    closeDrawer();
    toast.defer({
      tag: "ALTA",
      message: `${name} cuelga su camiseta, el ${num ?? "—"}`,
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
    const done = settle(player.id);
    closeDrawer();
    if (active) {
      const payload = bajaPayload(player, active.id);
      setPending((p) => ({ ...p, [player.id]: { ...player, ...payload } }));
      toast.defer({
        tag: "BAJA",
        message: `${name} de baja · sus actas y estadísticas se quedan`,
        commit: () => writes.savePlayer(player.id, payload),
        onUndo: () => {
          done();
          hang(player.id);
        },
        onError: done,
        onDone: done,
        errorMessage: `No se ha podido dar de baja a ${name}`,
      });
      return;
    }
    setPending((p) => ({ ...p, [player.id]: null }));
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

  const items: WallItem[] = [...squad.map((row): WallItem => ({ kind: "player", row, other: false })), ...others.map((row): WallItem => ({ kind: "player", row, other: true }))];
  if (!q.trim()) items.push({ kind: "alta" });
  const shown = squad.length + others.length;
  const emptyText = q.trim() ? `Ninguna camiseta con «${q.trim()}».` : pos !== "Todos" ? `Ningún ${POS_LABEL[pos].toLowerCase()} en la percha.` : "La percha está vacía: da de alta al primero.";

  const peg = (it: WallItem): ReactNode => {
    if (it.kind === "alta")
      return <Peg key="alta" num="+" label="Alta de jugador" sub="percha libre" size={desktop ? 96 : 80} big state="empty" className={altaOpen ? "alta sel" : "alta"} onClick={openAlta} ariaLabel="Dar de alta a un jugador" />;
    const r = it.row;
    const sub = it.other ? `fuera de la ${code}` : `${r.position || "Sin posición"}${r.injured ? " · lesionado" : ""}`;
    return (
      <Peg
        key={r.id}
        num={r.number ?? ""}
        shirtName={r.name}
        label={r.name}
        sub={sub}
        subTone={!it.other && r.injured ? "duda" : ""}
        size={desktop ? 96 : 80}
        big
        state={it.other ? "dim" : ""}
        fresh={fresh === r.id}
        className={editing?.id === r.id ? "sel" : ""}
        onClick={() => openPlayer(r.id)}
        ariaLabel={it.other ? `Abrir la ficha de ${r.name} (no está en la ${active?.name ?? "temporada"})` : `Abrir la ficha de ${r.name}`}
      />
    );
  };

  const wall = data.error ? (
    <LoadError what="la plantilla" />
  ) : data.loading ? (
    <div className="skel" aria-label="Cargando la plantilla" role="status" style={{ flex: 1 }}>
      <i />
      <i />
      <i />
    </div>
  ) : (
    <div className="wall" role="group" aria-label="La percha del vestuario" ref={wallRef}>
      {railsOf(items, per).map((row, i) => (
        <PegRail key={i}>{row.map(peg)}</PegRail>
      ))}
      {!shown ? <p className="nores">{emptyText}</p> : null}
    </div>
  );

  const drawer = drawerOpen ? (
    <PlayerDrawer
      key={editing ? `${editing.id}:${saves}` : "nuevo"}
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
    />
  ) : null;

  const searchBox = (
    <label className="srch" style={desktop ? { width: 230 } : undefined}>
      <AdIcon name="search" size={18} />
      <input ref={searchRef} id="plq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o dorsal" aria-label="Buscar jugador" aria-keyshortcuts="/" autoComplete="off" />
    </label>
  );
  const filter = (
    <div className={desktop ? "seg2" : "mfil seg2"} role="group" aria-label="Posición">
      {FILTERS.map((f) => (
        <button key={f} type="button" aria-pressed={pos === f} onClick={() => setPos(f)}>
          {f}
        </button>
      ))}
    </div>
  );

  if (!desktop)
    return (
      <>
        <div className="msc">
          {searchBox}
          {filter}
          {wall}
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
            {plural(squad.length, "camiseta", "camisetas")} en la percha · toca una para abrir su ficha
          </p>
        </div>
        <div className="r">
          {searchBox}
          {filter}
          <button type="button" className="btn sm line" onClick={exportCsv} disabled={!rows.length} aria-label="Exportar la plantilla (CSV)">
            <AdIcon name="doc" size={16} />
            CSV
          </button>
        </div>
      </div>
      <div className="plg">
        {wall}
        {drawer}
      </div>
    </>
  );
}
