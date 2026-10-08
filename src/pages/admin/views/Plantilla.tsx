// Plantilla — the squad as a table card: live search (name or dorsal; «/» focuses it), position filter,
// count, sticky head Dorsal · Jugador · Posición · Temporadas · Estado. A row opens the player drawer
// (`?jugador=id`); «Alta de jugador» opens it empty (`?nuevo`). Guardar / alta / baja wait behind an undo
// toast (the table shows the change at once; «Deshacer» means the write never happens — a baja keeps the
// very same document). «Exportar CSV» hands the plantilla to a spreadsheet.
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { PlayerDoc } from "../../../lib/schemas";
import { downloadText } from "../club/download";
import { PlayerDrawer } from "../club/PlayerDrawer";
import { LoadError } from "../club/ClubStates";
import {
  POS_LABEL,
  POSITIONS,
  csvFileName,
  filterRows,
  nameIn,
  numberIn,
  plantillaRows,
  playerPayload,
  previewDoc,
  rosterCsv,
  rosterSummary,
  type PlayerForm,
  type PosFilter,
} from "../club/plantillaLogic";
import { useClubWrites } from "../club/useClubWrites";
import { useSlashFocus } from "../club/useSlashFocus";
import { useRegisterCommands } from "../palette/registry";
import type { PaletteCommand } from "../palette/search";
import { AdminView } from "../shell/AdminView";
import { useAdmin } from "../shell/context";
import { Chip, EmptyState, Segmented, SkeletonRows } from "../ui/controls";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";
import "../../../styles/admin-club.css";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const truthy = (v: unknown) => v === true || v === 1 || v === "1" || v === "true";

export function Plantilla() {
  const data = useAdmin();
  const toast = useToast();
  const writes = useClubWrites();
  const navigate = useNavigate();
  const search: { jugador?: unknown; nuevo?: unknown } = useSearch({ strict: false });
  const openId = search.jugador != null && search.jugador !== "" ? String(search.jugador) : null;
  const altaOpen = !openId && truthy(search.nuevo);

  const [q, setQ] = useState("");
  const [pos, setPos] = useState<PosFilter>("Todos");
  /** Writes waiting behind «Deshacer»: the doc as it will be, or null for a baja. */
  const [pending, setPending] = useState<Record<string, PlayerDoc | null>>({});
  const [fresh, setFresh] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useSlashFocus(searchRef);

  const players = useMemo(() => {
    const base = data.players.filter((p) => pending[p.id] !== null).map((p) => pending[p.id] ?? p);
    const added = Object.values(pending).filter((p): p is PlayerDoc => !!p && !data.players.some((x) => x.id === p.id));
    return [...base, ...added];
  }, [data.players, pending]);
  const active = data.season;
  const rows = useMemo(() => plantillaRows(players, data.seasons, active?.id), [players, data.seasons, active?.id]);
  const shown = filterRows(rows, q, pos);
  const squad = rows.filter((r) => r.inSeason).length;
  const others = rows.length - squad;
  const editing = openId ? (players.find((p) => p.id === openId) ?? null) : null;

  const closeDrawer = useCallback(() => void navigate({ to: "/admin/plantilla", search: {} }), [navigate]);
  const openPlayer = (id: string) => void navigate({ to: "/admin/plantilla", search: { jugador: id } });
  const openAlta = () => void navigate({ to: "/admin/plantilla", search: { nuevo: true } });

  const flash = (id: string) => {
    setFresh(id);
    setTimeout(() => setFresh((f) => (f === id ? "" : f)), 1600);
    requestAnimationFrame(() => {
      const li = [...(listRef.current?.children ?? [])].find((el) => el instanceof HTMLElement && el.dataset.id === id);
      li?.scrollIntoView?.({ block: "nearest" });
    });
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
    setPending((p) => ({ ...p, [id]: doc }));
    closeDrawer();
    flash(id);
    const done = settle(id);
    toast.defer({
      message: player ? `Guardado · ${name} lleva el ${num ?? "—"}.` : `Alta: ${name} con el ${num ?? "—"}.`,
      commit: () => writes.savePlayer(id, payload),
      onUndo: done,
      onError: done,
      onDone: done,
      errorMessage: player ? `No se ha podido guardar a ${name}` : `No se ha podido dar de alta a ${name}`,
    });
  };
  const baja = (player: PlayerDoc) => {
    const sid = active && (player.seasons ?? []).includes(active.id) ? active.id : undefined;
    const name = nameIn(player, sid);
    const num = numberIn(player, sid);
    setPending((p) => ({ ...p, [player.id]: null }));
    closeDrawer();
    const done = settle(player.id);
    toast.defer({
      message: `${name} dado de baja · ${num != null ? `el ${num}` : "su dorsal"} queda libre.`,
      commit: () => writes.deletePlayer(player.id),
      onUndo: () => {
        done();
        flash(player.id);
      },
      onError: done,
      onDone: done,
      errorMessage: `No se ha podido dar de baja a ${name}`,
    });
  };

  const exportCsv = useCallback(() => {
    downloadText(csvFileName(active?.name), rosterCsv(rows));
    toast.show({ message: `Plantilla exportada · ${plural(rows.length, "jugador", "jugadores")} en el CSV.` });
  }, [active?.name, rows, toast]);
  useRegisterCommands(
    useMemo<PaletteCommand[]>(
      () => [{ id: "plantilla:exportar", group: "Acciones", icon: "↓", title: "Exportar plantilla (CSV)", description: `${plural(rows.length, "jugador", "jugadores")} · se abre en Excel`, hint: "acción", keywords: "csv excel descargar hoja", run: exportCsv }],
      [rows.length, exportCsv],
    ),
  );

  const linkedTo = (id: string) => {
    const person = data.people.find((p) => !p.removed && p.playerId === id);
    return person ? (person.nickname ? `@${person.nickname}` : person.email) : undefined;
  };

  const lead = `${plural(squad, "jugador", "jugadores")}${active ? ` en la ${active.name}` : ""}${others ? ` (+${others} de otras temporadas)` : ""} · toca una fila para editarla. El dorsal es único por temporada.`;
  const count = shown.length === rows.length ? plural(rows.length, "jugador", "jugadores") : `${shown.length} de ${rows.length}`;
  const drawerOpen = !data.loading && (altaOpen || !!editing);

  return (
    <AdminView
      kicker="Club"
      title="Plantilla"
      lead={lead}
      chips={
        rows.length ? (
          <li>
            <Chip tone="sky" icon="team">
              {rosterSummary(rows)}
            </Chip>
          </li>
        ) : undefined
      }
      actions={
        <>
          <button type="button" className="btn sm line" onClick={exportCsv} disabled={!rows.length}>
            <AdIcon name="doc" size={16} />
            <span className="ss">Exportar CSV</span>
            <span className="sl">CSV</span>
          </button>
          <button type="button" className="btn sm pri" onClick={openAlta} aria-haspopup="dialog">
            <AdIcon name="plus" size={16} />
            Alta de jugador
          </button>
        </>
      }
    >
      {data.error ? (
        <LoadError what="la plantilla" />
      ) : (
        <div className="vb cd tbl">
          <div className="tools">
            <label className="srch">
              <AdIcon name="search" size={18} />
              <span className="sr">Buscar jugador</span>
              <input ref={searchRef} className="inp" id="pl-q" type="search" placeholder="Buscar por nombre o dorsal" value={q} onChange={(e) => setQ(e.target.value)} aria-keyshortcuts="/" autoComplete="off" />
            </label>
            <Segmented<PosFilter> label="Filtrar por posición" value={pos} options={(["Todos", ...POSITIONS] as PosFilter[]).map((p) => ({ value: p, label: p }))} onChange={setPos} />
            <span className="cnt" aria-live="polite">
              {count}
            </span>
          </div>
          <div className="scr">
            <div className="th" aria-hidden="true">
              <span>Dorsal</span>
              <span>Jugador</span>
              <span>Posición</span>
              <span className="c4h">Temporadas</span>
              <span>Estado</span>
              <span />
            </div>
            {data.loading ? (
              <div className="rows">
                <SkeletonRows rows={8} label="Cargando la plantilla…" />
              </div>
            ) : (
              <>
                <ul className="rows" ref={listRef} aria-label="Jugadores">
                  {shown.map((r) => {
                    const posL = r.position ? POS_LABEL[r.position] : "Sin posición";
                    return (
                      <li key={r.id} data-id={r.id}>
                        <button
                          type="button"
                          className={`prw ${fresh === r.id ? "fresh" : ""} ${r.inSeason ? "" : "ad-out"}`.replace(/\s+/g, " ").trim()}
                          aria-current={editing?.id === r.id ? "true" : undefined}
                          aria-haspopup="dialog"
                          aria-label={`Editar a ${r.name}${r.number != null ? `, dorsal ${r.number}` : ""}`}
                          onClick={() => openPlayer(r.id)}
                        >
                          <span className={`dn ${r.position === "POR" ? "por" : ""}`.trim()}>{r.number ?? "—"}</span>
                          <span className="nm2">
                            <b>{r.name}</b>
                            <small>
                              <span className="mob">{posL} · </span>
                              {r.full}
                              {!r.inSeason && active ? ` · no juega la ${active.name}` : ""}
                            </small>
                          </span>
                          <span className="c3">{posL}</span>
                          <span className="c4">{r.seasons}</span>
                          <span className="c5">
                            {r.injured ? (
                              <Chip tone="warn" icon="plus">
                                Lesionado
                              </Chip>
                            ) : (
                              <Chip tone="ok">Activo</Chip>
                            )}
                          </span>
                          <span className="go">
                            <AdIcon name="pencil" size={15} />
                            Editar
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {!shown.length && (
                  <EmptyState icon="search" className="ad-m12" title={q.trim() ? `Nadie con «${q.trim()}»` : rows.length && pos !== "Todos" ? `Ningún ${POS_LABEL[pos].toLowerCase()}` : "Todavía no hay jugadores"}>
                    {rows.length ? "Busca por nombre en camiseta o por dorsal." : "Empieza con «Alta de jugador»."}
                  </EmptyState>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {drawerOpen && (
        <PlayerDrawer
          key={editing?.id ?? "nuevo"}
          player={editing}
          players={players}
          seasons={data.seasons}
          activeSeason={active}
          linkedTo={editing ? linkedTo(editing.id) : undefined}
          onClose={closeDrawer}
          onSave={(form) => save(editing, form)}
          onBaja={() => editing && baja(editing)}
        />
      )}
    </AdminView>
  );
}
