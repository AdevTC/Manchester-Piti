// r14 «La pizarra» · Tableros' sheets (the shell draws the frame): «Tablero nuevo» (the origins), the phone's
// «Detalles» (the inspector), «Vincular a un partido» (an official asks first: it changes which match it is the
// official of), «¿Quitar el oficial?» (its consequences; 12 s to undo).
import type { SheetProps } from "../../store/types";
import { PzIcon } from "../../campo/Shirt";
import "../../../../../styles/pz/tableros.css";
import { pb } from "./pb";
import { useTb } from "./useTb";
import { jLabel, matchById, resOf } from "./tablerosView";
import { Origins } from "./Lead";
import { Inspector } from "./Inspector";

const idOf = (args: Record<string, unknown>, fallback: string): string => (typeof args.id === "string" && args.id ? args.id : fallback);

export function NuevoSheet() {
  const tb = useTb();
  return (
    <div className="pz-sh pb">
      <p className="pz-line">Se guarda solo con tu primer cambio y se abre en Siete.</p>
      <Origins tb={tb} />
    </div>
  );
}

export function TableroSheet({ layout, args }: SheetProps) {
  const tb = useTb();
  const b = tb.P.sel.board(idOf(args, tb.P.state.boardId));
  if (!b) return <p className="pz-meta">Ese tablero ya no está.</p>;
  return (
    <div className="pz-sh pb">
      <Inspector tb={tb} b={b} layout={layout} />
    </div>
  );
}

export function VincularSheet({ args }: SheetProps) {
  const tb = useTb();
  const { P, U } = tb;
  const b = P.sel.board(idOf(args, P.state.boardId));
  if (!b) return <p className="pz-meta">Ese tablero ya no está.</p>;
  const ms = P.state.W.matches.slice().sort((x, y) => x.at - y.at);
  const nextI = ms.findIndex((x) => !x.played);
  const shown = U.linkAll ? ms : ms.filter((x, i) => x.played || x.id === b.matchId || (nextI >= 0 && i >= nextI && i < nextI + 4));
  const go = (mid: string | null) => {
    if (b.isOfficial && mid !== b.matchId) {
      pb.set({ linkAsk: mid ?? "-" });
      return;
    }
    P.act.closeSheet();
    pb.set({ linkAsk: null, linkAll: false });
    void tb.ops.link(b.id, mid);
  };
  if (U.linkAsk) {
    const target = U.linkAsk !== "-" ? matchById(P, U.linkAsk) : null;
    const now = matchById(P, b.matchId);
    return (
      <div className="pz-sh pb">
        <div className="pb-warn" role="alert">
          <b>{"Esto cambia el oficial" + (now ? " de la " + jLabel(now) : "") + " a " + (target ? "la " + jLabel(target) + " · " + target.rival : "toda la temporada")}</b>
          <span>{(now ? "La " + jLabel(now) + " se queda sin oficial" : "Deja de ser de temporada") + " y el equipo lo ve como el oficial de " + (target ? "ese partido" : "la temporada") + "."}</span>
        </div>
        <div className="pz-acts">
          <button
            type="button"
            className="vd-glass vd-press pz-btn pz-btn--pri"
            onClick={() => {
              const mid = U.linkAsk === "-" ? null : U.linkAsk;
              pb.set({ linkAsk: null, linkAll: false });
              P.act.closeSheet();
              void tb.ops.link(b.id, mid);
            }}
          >
            Cambiarlo
          </button>
          <button type="button" className="nx-lnk" onClick={() => pb.set({ linkAsk: null })}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }
  const rows = [
    { id: null as string | null, l: "·", cls: "is-none", t: "Sin partido", s: b.isOfficial ? "Sería el oficial de toda la temporada" : "Un tablero suelto, para probar" },
    ...shown.map((M) => {
      const r = resOf(M);
      return { id: M.id as string | null, l: r.l, cls: r.cls, t: jLabel(M) + " · " + M.rival, s: r.w };
    }),
  ];
  return (
    <div className="pz-sh pb">
      <p className="pz-line">{b.isOfficial ? "Es el oficial: cambiar su partido cambia de qué partido es oficial." : "El tablero lleva el partido en su nombre, en la mesa y en la charla."}</p>
      <ul className="pz-rows pb-link">
        {rows.map((r) => {
          const on = (b.matchId ?? null) === r.id;
          return (
            <li key={r.id ?? "-"}>
              <button type="button" className="pz-row" aria-pressed={on} onClick={() => go(r.id)} aria-label={r.t + ", " + r.s + (on ? ", vinculado ahora" : "")}>
                <span className={`pb-res ${r.cls}`} aria-hidden="true">
                  {r.l}
                </span>
                <span className="pz-row__t">
                  <b>{r.t}</b>
                  <span>{r.s}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!U.linkAll && shown.length < ms.length && (
        <button type="button" className="nx-lnk" onClick={() => pb.set({ linkAll: true })}>
          {"Ver los " + ms.length + " partidos de la temporada"}
        </button>
      )}
    </div>
  );
}

/** «Borrar las copias de la mesa»: each copy with its owner and match before anything goes (12 s to undo after). */
export function MesaSheet() {
  const tb = useTb();
  const { P } = tb;
  const list = P.sel.me().cap ? tb.ops.mesaCopies() : [];
  if (!list.length) return <p className="pz-meta">No quedan copias de la mesa de partidos jugados.</p>;
  return (
    <div className="pz-sh pb">
      <p className="pz-line">Las copias que hizo la mesa el día del partido. Ya jugados: no las usa nadie.</p>
      <ul className="pz-rows pb-link" aria-label="Copias que se borran">
        {list.map((c) => (
          <li key={c.id} className="pz-row">
            <span className="vx-tile" aria-hidden="true">
              <PzIcon name="whistle" />
            </span>
            <span className="pz-row__t">
              <b>{c.name}</b>
              <span>{"De @" + c.owner + (c.match ? " · " + c.match : "")}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="pz-acts">
        <button type="button" className="vd-glass vd-press pz-btn pb-danger" onClick={() => tb.ops.cleanMesa()}>
          <PzIcon name="trash" />
          {list.length === 1 ? "Borrar la copia" : "Borrar las " + list.length + " copias"}
        </button>
        <button type="button" className="nx-lnk" onClick={() => P.act.closeSheet()}>
          Cancelar
        </button>
      </div>
      <p className="pz-meta">Tendrás 12 segundos para deshacerlo.</p>
    </div>
  );
}

export function QuitarSheet({ args }: SheetProps) {
  const tb = useTb();
  const { P } = tb;
  const b = P.sel.board(idOf(args, P.state.boardId));
  if (!b || !b.isOfficial) return <p className="pz-meta">Ese tablero ya no es el oficial.</p>;
  const R = P.sel.reactions();
  const M = matchById(P, b.matchId);
  const n = R.ok + R.dudas;
  const conseq = [
    { icon: "eye", t: "El equipo deja de verlo como el oficial", s: "Sigue siendo un tablero, igual que estaba." },
    { icon: "cal", t: M ? "La página de la " + jLabel(M) + " dirá «Aún no hay siete oficial»" : "La temporada se queda sin oficial", s: "Lo mismo en la mesa, la convocatoria y Hoy." },
    { icon: "thumb", t: n ? "Se borran sus " + n + " opiniones" : "No tenía opiniones", s: n ? R.ok + " de acuerdo y " + R.dudas + " con dudas." : "Nadie había opinado aún." },
    { icon: "bell", t: "No se avisa a nadie", s: "Cuando publiques otro, sí sale «Ya está el siete»." },
  ];
  return (
    <div className="pz-sh pb">
      <ul className="pb-conseq">
        {conseq.map((c) => (
          <li key={c.t}>
            <span className="vx-tile">
              <PzIcon name={c.icon} />
            </span>
            <div>
              <b>{c.t}</b>
              <span>{c.s}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="pz-acts">
        <button type="button" className="vd-glass vd-press pz-btn pb-danger" onClick={() => tb.ops.quitarOficial(b.id)}>
          <PzIcon name="close" />
          Quitar el oficial
        </button>
        <button type="button" className="nx-lnk" onClick={() => P.act.closeSheet()}>
          Cancelar
        </button>
      </div>
      <p className="pz-meta">Tendrás 12 segundos para deshacerlo, aunque salgas de aquí.</p>
    </div>
  );
}
