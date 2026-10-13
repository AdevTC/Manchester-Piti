// Plantilla's list (the left column on desktop, the screen itself on phones): the season grouped by line with
// «Sin posición» first — those carry POR · DEF · MED · DEL right under their name, so a line is one tap without
// opening the ficha. Each row: his kit (the photo of the real 3D shirt), name, what his ficha lacks and a dot
// (filled = complete, dashed = something missing). While searching, players of other seasons hang at the end,
// dimmed (that is how one comes back).
import type { CSSProperties, Ref } from "react";
import { ShirtBack } from "../kit";
import { vtName } from "../ui/viewTransition";
import type { BoardGroup, BoardRow } from "./plantillaBoard";
import { POSITIONS, type Position } from "./plantillaLogic";

export interface PlantillaListProps {
  groups: readonly BoardGroup[];
  others: readonly BoardRow[];
  /** «T1»: what «fuera de la T1» says. */
  code: string;
  selectedId: string | null;
  still: (row: BoardRow) => string | undefined;
  onOpen: (id: string) => void;
  onLine: (row: BoardRow, p: Position) => void;
  /** What carries a view-transition name right now: «kit:id» flies to / from the ficha, «row:id» glides. */
  flying: ReadonlySet<string>;
  /** The scrolling list (the page measures which rows are in view before a transition). */
  boxRef?: Ref<HTMLElement>;
  empty: string | null;
  /** Players without a line show the quick POR · DEF · MED · DEL. */
  quickLine: boolean;
  /** Who is suspended (a red card or a sanction set by hand): «Sancionado» under his name. */
  sanctioned?: ReadonlySet<string> | ReadonlyMap<string, unknown>;
}

const sub = (r: BoardRow, other: boolean, code: string, sanctioned: boolean) =>
  other ? `fuera de la ${code}` : [r.injured ? "Lesionado" : "", sanctioned ? "Sancionado" : "", r.gaps.length ? `faltan ${r.gaps.length}` : "ficha completa"].filter(Boolean).join(" · ");

export function PlantillaList({ groups, others, code, selectedId, still, onOpen, onLine, flying, boxRef, empty, quickLine, sanctioned }: PlantillaListProps) {
  const row = (r: BoardRow, other: boolean, quick: boolean) => {
    const src = still(r);
    const kitStyle: CSSProperties | undefined = flying.has(`kit:${r.id}`) && selectedId !== r.id ? { viewTransitionName: vtName("pl-kit", r.id) } : undefined;
    const rowStyle: CSSProperties | undefined = flying.has(`row:${r.id}`) ? { viewTransitionName: vtName("pl-row", r.id) } : undefined;
    const san = !other && !!sanctioned?.has(r.id);
    return (
      <li key={r.id} data-id={r.id} style={rowStyle} className={["lr", r.injured ? "inj" : "", san ? "san" : "", other ? "other" : ""].filter(Boolean).join(" ")}>
        <button
          type="button"
          className="li"
          aria-current={selectedId === r.id || undefined}
          onClick={() => onOpen(r.id)}
          aria-label={other ? `Abrir la ficha de ${r.name} (no está en la temporada)` : `Abrir la ficha de ${r.name}`}
        >
          <span className="kit" style={kitStyle} aria-hidden="true">
            {src ? <img src={src} alt="" width={40} height={44} decoding="async" /> : <ShirtBack num={r.number ?? ""} size={36} state={other ? "dim" : ""} />}
          </span>
          <span className="tx">
            <b>{r.name}</b>
            <small>{sub(r, other, code, san)}</small>
          </span>
          <span className={r.gaps.length && !other ? "dot gap" : "dot"} aria-hidden="true" />
        </button>
        {quick ? (
          <span className="qp" role="group" aria-label={`Colocar a ${r.name}`}>
            {POSITIONS.map((p) => (
              <button key={p} type="button" onClick={() => onLine(r, p)}>
                {p}
              </button>
            ))}
          </span>
        ) : null}
      </li>
    );
  };
  return (
    <nav className="pl3l" aria-label="La plantilla" ref={boxRef}>
      {groups.map((g) => (
        <section key={g.key} className={g.key === "none" ? "grp none" : "grp"} aria-label={g.title}>
          <h2 className="gh" data-g={g.key} style={flying.has(`gh:${g.key}`) ? { viewTransitionName: vtName("pl-gh", g.key) } : undefined}>
            {g.title}
            <em>{g.rows.length}</em>
            {g.key === "none" && quickLine ? <small>colócalos con un toque</small> : null}
          </h2>
          <ul>{g.rows.map((r) => row(r, false, quickLine && g.key === "none"))}</ul>
        </section>
      ))}
      {others.length ? (
        <section className="grp other" aria-label="Otras temporadas">
          <h2 className="gh">
            Otras temporadas<em>{others.length}</em>
            <small>ábrele la ficha para volver a darle de alta</small>
          </h2>
          <ul>{others.map((r) => row(r, true, false))}</ul>
        </section>
      ) : null}
      {empty ? <p className="nores">{empty}</p> : null}
    </nav>
  );
}
