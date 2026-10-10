// «El tablón» (Plantilla): the season's players grouped by line (Porteros · Defensas · Medios ·
// Delanteros · Sin posición), each row his kit (the photo of the real 3D shirt), dorsal, name, the line
// set in place (POR DEF MED DEL), Activo / Lesionado, his account, GOL · ASI · PJ and the ficha's slots
// (what it lacks, dashed). A checkbox per row selects for the batch bar. Rows of other seasons (while
// searching) hang dimmed at the end. On phones the row folds to kit · dorsal · name with a line under it.
import type { CSSProperties, MouseEvent, Ref } from "react";
import { ShirtBack } from "../kit";
import { AdIcon } from "../ui/icons";
import { vtName } from "../ui/viewTransition";
import { ACCOUNT_LABEL, GAPS, gapsText, type BoardGroup, type BoardRow } from "./plantillaBoard";
import { POSITIONS, type Position } from "./plantillaLogic";

export interface TablonProps {
  groups: readonly BoardGroup[];
  /** Players of other seasons that match the search (dimmed). */
  others: readonly BoardRow[];
  /** «T1»: what «fuera de la T1» says. */
  code: string;
  selectedId: string | null;
  picked: ReadonlySet<string>;
  onPick: (ids: readonly string[], on: boolean) => void;
  onOpen: (id: string) => void;
  onPosition: (rows: readonly BoardRow[], p: Position) => void;
  onInjured: (row: BoardRow, injured: boolean) => void;
  /** The photo of his kit, once rendered. */
  still: (row: BoardRow) => string | undefined;
  /** Rows whose kit flies (shared element) in the running transition. */
  flying: ReadonlySet<string>;
  /** Dorsals worn twice in the season. */
  dup: ReadonlySet<number>;
  /** Stats of a player in the season (GOL · ASI · PJ). */
  stats: (id: string) => { goals: number; assists: number; played: number } | undefined;
  /** Rows just written (a short sky wash). */
  fresh: string;
  empty: string | null;
  /** The scrolling box (the page measures which rows are in view before a transition). */
  boxRef?: Ref<HTMLDivElement>;
}

const stop = (e: MouseEvent) => e.stopPropagation();

function Kit({ row, src, fly, dim }: { row: BoardRow; src: string | undefined; fly: boolean; dim: boolean }) {
  const style: CSSProperties | undefined = fly ? { viewTransitionName: vtName("pl-kit", row.id) } : undefined;
  return (
    <span className={dim ? "kit dim" : "kit"} style={style} aria-hidden="true">
      {src ? <img src={src} alt="" width={44} height={49} decoding="async" /> : <ShirtBack num={row.number ?? ""} size={40} state={dim ? "dim" : ""} />}
    </span>
  );
}

function Slots({ row }: { row: BoardRow }) {
  return (
    <span className="slots" role="img" aria-label={gapsText(row.gaps)}>
      {GAPS.map((g) => (
        <i key={g.key} className={row.gaps.includes(g.key) ? "no" : ""} title={`${g.label}${row.gaps.includes(g.key) ? " · falta" : ""}`} />
      ))}
    </span>
  );
}

export function Tablon(props: TablonProps) {
  const { groups, others, code, selectedId, picked, onPick, onOpen, onPosition, onInjured, still, flying, dup, stats, fresh, empty, boxRef } = props;
  const all = groups.flatMap((g) => g.rows.map((r) => r.id));
  const allOn = all.length > 0 && all.every((id) => picked.has(id));
  const someOn = !allOn && all.some((id) => picked.has(id));

  const row = (r: BoardRow, other: boolean) => {
    const on = selectedId === r.id;
    const s = stats(r.id);
    const sub = other ? `fuera de la ${code}` : [r.position || "Sin posición", r.injured ? "lesionado" : "", r.gaps.length ? `faltan ${r.gaps.length}` : "ficha completa"].filter(Boolean).join(" · ");
    const style: CSSProperties | undefined = flying.has(`row:${r.id}`) ? { viewTransitionName: vtName("pl-row", r.id) } : undefined;
    const cls = ["tr", on ? "on" : "", other ? "other" : "", r.injured ? "inj" : "", fresh === r.id ? "fresh" : ""].filter(Boolean).join(" ");
    return (
      <tr key={r.id} role="row" className={cls} style={style} data-id={r.id} aria-current={on || undefined} onClick={() => onOpen(r.id)}>
        <td role="cell" className="c-sel" onClick={stop}>
          {other ? null : (
            <input type="checkbox" className="ck" checked={picked.has(r.id)} onChange={(e) => onPick([r.id], e.target.checked)} aria-label={`Seleccionar a ${r.name}`} />
          )}
        </td>
        <td role="cell" className="c-kit">
          <Kit row={r} src={still(r)} fly={flying.has(`kit:${r.id}`) && !on} dim={other} />
        </td>
        <td role="cell" className="c-num">
          <b className={r.number != null && dup.has(r.number) ? "dup" : undefined}>{r.number ?? "—"}</b>
        </td>
        <td role="cell" className="c-name">
          <button type="button" className="nmb" onClick={(e) => {
              stop(e);
              onOpen(r.id);
            }} aria-label={other ? `Abrir la ficha de ${r.name} (no está en la temporada)` : `Abrir la ficha de ${r.name}`}>
            <b>{r.name}</b>
            <small className="nfu">{other ? sub : r.injured ? `${r.full} · lesionado` : r.full}</small>
            <small className="nsb">{sub}</small>
          </button>
        </td>
        <td role="cell" className="c-pos" onClick={stop}>
          {other ? (
            <span className="mut">{r.position || "—"}</span>
          ) : (
            <span className="pseg" role="group" aria-label={`Línea de ${r.name}`}>
              {POSITIONS.map((p) => (
                <button key={p} type="button" aria-pressed={r.position === p} onClick={() => r.position !== p && onPosition([r], p)}>
                  {p}
                </button>
              ))}
            </span>
          )}
        </td>
        <td role="cell" className="c-st" onClick={stop}>
          {other ? null : (
            <button type="button" role="switch" aria-checked={r.injured} className={r.injured ? "stb inj" : "stb"} onClick={() => onInjured(r, !r.injured)} aria-label={`${r.name} lesionado`}>
              <AdIcon name={r.injured ? "alert" : "check"} size={14} />
              <span className="stx">{r.injured ? "Lesionado" : "Activo"}</span>
            </button>
          )}
        </td>
        <td role="cell" className="c-acc">
          <span className={`acc ${r.account}`} title={`${ACCOUNT_LABEL[r.account]}${r.who ? ` · ${r.who}` : ""}`} role="img" aria-label={ACCOUNT_LABEL[r.account]}>
            <AdIcon name={r.account === "vinculada" ? "link" : r.account === "pide" ? "inbox" : "lock"} size={15} />
          </span>
        </td>
        <td role="cell" className="c-stats">
          <span>{s?.goals ?? 0}</span>
          <span>{s?.assists ?? 0}</span>
          <span>{s?.played ?? 0}</span>
        </td>
        <td role="cell" className="c-slots">
          <Slots row={r} />
        </td>
      </tr>
    );
  };

  return (
    <div className="tbn" role="region" aria-label="El tablón de la plantilla" tabIndex={-1} ref={boxRef}>
      <table role="table">
        <thead role="rowgroup">
          <tr role="row">
            <th className="c-sel" scope="col" role="columnheader">
              <input
                type="checkbox"
                className="ck"
                checked={allOn}
                ref={(el) => {
                  if (el) el.indeterminate = someOn;
                }}
                onChange={(e) => onPick(all, e.target.checked)}
                aria-label="Seleccionar a todos"
                disabled={!all.length}
              />
            </th>
            <th className="c-kit" scope="col" role="columnheader">
              <span className="sr">Camiseta</span>
            </th>
            <th className="c-num" scope="col" role="columnheader">
              Nº
            </th>
            <th className="c-name" scope="col" role="columnheader">
              Jugador
            </th>
            <th className="c-pos" scope="col" role="columnheader">
              Línea
            </th>
            <th className="c-st" scope="col" role="columnheader">
              Estado
            </th>
            <th className="c-acc" scope="col" role="columnheader">
              <span className="sr">Cuenta</span>
              <AdIcon name="link" size={14} />
            </th>
            <th className="c-stats" scope="col" role="columnheader">
              <span title="Goles">GOL</span>
              <span title="Asistencias">ASI</span>
              <span title="Partidos jugados">PJ</span>
            </th>
            <th className="c-slots" scope="col" role="columnheader">
              <span className="sr">Ficha: posición, foto, nacimiento, altura y peso</span>
              <span className="lgd" aria-hidden="true">
                {GAPS.map((g) => (
                  <i key={g.key} title={g.label}>
                    {g.short.slice(0, 2)}
                  </i>
                ))}
              </span>
            </th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.key} role="rowgroup" className={g.key === "none" ? "grp none" : "grp"}>
            <tr role="row" className="gh" data-g={g.key} style={flying.has(`gh:${g.key}`) ? { viewTransitionName: vtName("pl-gh", g.key) } : undefined}>
              <th colSpan={9} scope="rowgroup" role="rowheader">
                {g.title}
                <em>{g.rows.length}</em>
                {g.key === "none" ? <small>Toca su línea para colocarlos</small> : null}
              </th>
            </tr>
            {g.rows.map((r) => row(r, false))}
          </tbody>
        ))}
        {others.length ? (
          <tbody role="rowgroup" className="grp other">
            <tr role="row" className="gh">
              <th colSpan={9} scope="rowgroup" role="rowheader">
                Otras temporadas
                <em>{others.length}</em>
                <small>Ábrele la ficha para volver a darle de alta</small>
              </th>
            </tr>
            {others.map((r) => row(r, true))}
          </tbody>
        ) : null}
      </table>
      {empty ? <p className="nores">{empty}</p> : null}
    </div>
  );
}
