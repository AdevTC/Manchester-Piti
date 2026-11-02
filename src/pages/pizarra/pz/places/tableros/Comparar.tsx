// r14 «La pizarra» · Comparar (/pizarra/tableros/comparar?a=&b=): two sevens side by side (desktop/tablet stage),
// what changes puesto by puesto, the cara a cara with «mejor» in words; A and B can be a board's version, another
// board, the official, the seven that played a match, or a snapshot of the board's history.
import type { Layout } from "../../store/types";
import { PiCampo } from "../../campo/PiCampo";
import { PzIcon } from "../../campo/Shirt";
import { defaultTactics } from "../../../tactics";
import { fmt } from "../../store/fmt";
import { pb, usePb } from "./pb";
import { openIn, type Tb } from "./useTb";
import { whenStore } from "./ops";
import { cintaRow, itemList, statsOf, type CmpItem } from "./tablerosView";
import { specA, specB, type CmpModel } from "./cmpModel";

function Cap({ k, it, sys, diff }: { k: "A" | "B"; it: CmpItem; sys: string; diff: boolean }) {
  return (
    <figcaption className="pb-vs__cap">
      <span className={`pb-pick__k${k === "B" ? " is-b" : ""}`} aria-hidden="true">
        {k}
      </span>
      <span>
        <b title={it.short}>{it.short}</b>
        <small>{(it.b?.isOfficial && it.kind === "board" ? "Oficial · " : "") + it.sub}</small>
      </span>
      <span className={`pb-vs__sys${diff ? " is-diff" : ""}`}>{sys}</span>
    </figcaption>
  );
}

/** The two pitches (desktop and tablet stage). */
export function CmpStage({ tb, M, layout }: { tb: Tb; M: CmpModel; layout: Layout }) {
  const { P } = tb;
  const tab = layout === "tablet";
  return (
    <div className={`pb-vs${tab ? " pb-vs--tab" : ""}`}>
      <div className="pb-vs__two">
        <figure className="pb-vs__side" aria-label={"A: " + M.A.t + ", " + M.A.formation}>
          <Cap k="A" it={M.A} sys={M.A.formation} diff={false} />
          <div className="pb-vs__pitch">
            <PiCampo layout="desktop" show={specA(P, M)} bare inert />
          </div>
        </figure>
        <figure className="pb-vs__side" aria-label={"B: " + M.B.t + ", " + M.B.formation}>
          <Cap k="B" it={M.B} sys={M.B.formation} diff={M.c.sistema} />
          <div className="pb-vs__pitch">
            <PiCampo layout="desktop" show={specB(P, M)} bare inert />
          </div>
        </figure>
      </div>
      <div className="pb-legend" aria-hidden="true">
        <span className="pb-lg">
          <i className="sa" />
          Sale (en A)
        </span>
        <span className="pb-lg">
          <i className="en" />
          Entra (en B)
        </span>
        <span className="pb-lg">
          <i className="mu" />
          Cambia de puesto
        </span>
      </div>
    </div>
  );
}

/** Hero, the pickers and the cara a cara (desktop lead · tablet · phone panel). */
export function CmpLead({ tb, M, phone }: { tb: Tb; M: CmpModel; phone: boolean }) {
  const { P, ctx } = tb;
  const list = itemList(P, ctx);
  [M.A, M.B].forEach((it) => {
    if (!list.some((x) => x.it.key === it.key)) list.push({ g: "Otros", it });
  });
  const groups: { t: string; opts: { v: string; t: string }[] }[] = [];
  list.forEach((x) => {
    let g = groups.find((y) => y.t === x.g);
    if (!g) {
      g = { t: x.g, opts: [] };
      groups.push(g);
    }
    g.opts.push({ v: x.it.key, t: x.it.t + (x.it.kind === "board" && x.it.ver !== "titular" ? " · " + x.it.sub.split(" · ")[0] : "") });
  });
  const tac = (M.A.b ?? M.B.b ?? P.sel.board())?.lineup.tactics ?? defaultTactics();
  const sa = statsOf(P, M.A, tac);
  const sb = statsOf(P, M.B, tac);
  const cinta = [
    cintaRow("Sistema", M.A.formation as string, M.B.formation as string, null),
    cintaRow("Media", sa.media, sb.media, "hi"),
    cintaRow("Química", sa.chem, sb.chem, "hi"),
    cintaRow("En su sitio", sa.inPlace, sb.inPlace, "hi", (x) => x + "/7"),
    cintaRow("Minutos del siete", sa.mins, sb.mins, "hi", (x) => (x ? x + "′" : "—")),
    cintaRow("Galones en el campo", sa.gal, sb.gal, "hi", (x) => (x == null ? "—" : x + "/5")),
  ];
  const pickA = (k: string) => pb.set(k === M.B.key ? { cmpA: k, cmpB: M.A.key } : { cmpA: k, cmpB: M.B.key });
  const pickB = (k: string) => pb.set(k === M.A.key ? { cmpB: k, cmpA: M.B.key } : { cmpB: k, cmpA: M.A.key });
  const sel = (k: "A" | "B", cur: string, on: (v: string) => void) => (
    <label className="vd-glass pb-pick">
      <span className={`pb-pick__k${k === "B" ? " is-b" : ""}`} aria-hidden="true">
        {k}
      </span>
      <span>
        <small>{k === "A" ? "A · el de referencia" : "B · el que miras"}</small>
        <select value={cur} onChange={(e) => on(e.target.value)} aria-label={k === "A" ? "A: el de referencia" : "B: el que miras"}>
          {groups.map((g) => (
            <optgroup key={g.t} label={g.t}>
              {g.opts.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.t}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </span>
    </label>
  );
  return (
    <>
      <section className="pz-hero pb-hero" aria-labelledby="pb-ch">
        <p className="pz-kick">Comparar · cara a cara</p>
        <h1 className="pz-h1" id="pb-ch">
          {M.head}
        </h1>
        <p className="pz-line">{M.line}</p>
      </section>
      <section className="pz-sec" aria-labelledby="pb-cq">
        <div className="pz-sec__h">
          <h2 id="pb-cq">Qué comparas</h2>
          <button
            type="button"
            className="nx-lnk pb-swap"
            onClick={() => {
              pb.set({ cmpA: M.B.key, cmpB: M.A.key });
              P.say("Cambiados de lado");
            }}
          >
            <PzIcon name="swap" />
            Cambiar de lado
          </button>
        </div>
        <div className="pb-picks">
          {sel("A", M.A.key, pickA)}
          {sel("B", M.B.key, pickB)}
        </div>
      </section>
      {phone && <CmpView M={M} />}
      <section className="pz-sec" aria-labelledby="pb-ct">
        <div className="pz-sec__h">
          <h2 id="pb-ct">Cara a cara</h2>
          <p>El mejor, con la palabra</p>
        </div>
        <table className="pb-cinta">
          <thead>
            <tr>
              <th scope="col">
                <span className="pz-vh">Dato</span>
              </th>
              <th scope="col">A</th>
              <th scope="col">B</th>
            </tr>
          </thead>
          <tbody>
            {cinta.map((r) => (
              <tr key={r.k}>
                <th scope="row">{r.k}</th>
                <td className={r.aBest ? "is-best" : ""}>
                  {r.a}
                  {r.aBest && <small>mejor</small>}
                </td>
                <td className={r.bBest ? "is-best" : ""}>
                  {r.b}
                  {r.bBest && <small>mejor</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

/** The phone's «what the pitch shows»: A · Juntos · B (also a horizontal swipe on it). */
export function CmpView({ M }: { M?: CmpModel | null }) {
  const U = usePb();
  const views: ["a" | "juntos" | "b", string][] = [
    ["a", "A" + (M ? " · " + M.A.formation : "")],
    ["juntos", "Juntos"],
    ["b", "B" + (M ? " · " + M.B.formation : "")],
  ];
  const swipe = (e: { clientX: number }) => {
    const x0 = e.clientX;
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointerup", up);
      const dx = ev.clientX - x0;
      if (Math.abs(dx) < 40) return;
      const order = ["a", "juntos", "b"] as const;
      const i = order.indexOf(pb.get().view);
      const n = order[Math.max(0, Math.min(2, i + (dx < 0 ? 1 : -1)))];
      if (n !== pb.get().view) pb.set({ view: n });
    };
    window.addEventListener("pointerup", up);
  };
  return (
    <div className="vd-glass pb-view" role="group" aria-label="Qué ver en el campo" onPointerDown={swipe}>
      {views.map(([k, t]) => (
        <button key={k} type="button" aria-pressed={U.view === k} onClick={() => pb.set({ view: k })}>
          {t}
        </button>
      ))}
    </div>
  );
}

/** What changes, and what to do with it (desktop side · tablet · phone panel). */
export function CmpSide({ tb, M }: { tb: Tb; M: CmpModel }) {
  const { P, ops } = tb;
  const m = P.sel.me();
  const { A, B, c } = M;
  const acts: { t: string; icon: string; pri?: boolean; off?: boolean; run: () => void }[] = [];
  if (B.kind === "board" && B.boardId) {
    const id = B.boardId;
    acts.push({
      t: "Abrir B en Siete",
      icon: "shirt",
      pri: true,
      run: async () => {
        if (P.state.boardId !== id) {
          P.act.openBoard(id);
          await whenStore(P, (s) => s.boardId === id, 4000);
        }
        if (B.ver !== "titular") P.act.setVersion(B.ver);
        openIn(P, id);
      },
    });
    if (m.member && !m.socia) acts.push({ t: "Duplicar B", icon: "copy", off: !!tb.U.busy, run: () => void ops.duplicate(id) });
  }
  if (B.kind === "snap" && B.snap && B.b) {
    const snap = B.snap;
    const bid = B.b.id;
    acts.push({ t: "Recuperar esta foto", icon: "hist", pri: true, off: !P.sel.canEdit(B.b), run: () => ops.restore(bid, snap) });
  }
  if (A.kind === "snap" && A.snap && A.b) {
    const snap = A.snap;
    const bid = A.b.id;
    acts.push({ t: "Recuperar A", icon: "hist", off: !P.sel.canEdit(A.b), run: () => ops.restore(bid, snap) });
  }
  if (B.kind === "match" || A.kind === "match") {
    const it = B.kind === "match" ? B : A;
    acts.push({ t: "Empezar un tablero como " + it.short.split(" · ")[0], icon: "plus", off: !tb.canCreate || !!tb.U.busy, run: () => void ops.create({ formation: it.formation, ids: it.slots.map((s) => s.playerId), name: "Como en " + it.short }) });
  }
  const nChanged = c.rows.filter((r) => r.tag !== "Sistema").length;
  return (
    <>
      <section className="pz-sec" aria-labelledby="pb-cc">
        <div className="pz-sec__h">
          <h2 id="pb-cc">Qué cambia</h2>
          <p>{c.same ? "Nada" : fmt.plural(nChanged, "cambio", "cambios") + (c.sistema ? " y el sistema" : "")}</p>
        </div>
        {c.same && <p className="pz-line pb-same">Los mismos siete, igual colocados.</p>}
        <ul className="pb-chg">
          {c.rows.map((r, i) => (
            <li key={r.k + i} className="pb-c">
              <span className="pb-c__k">{r.k}</span>
              <b>{r.t}</b>
              <span className={`pb-c__t ${r.cls}`}>{r.tag}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="pz-sec" aria-label="Acciones de la comparación">
        <div className="pz-acts">
          {acts.map((a) => (
            <button key={a.t} type="button" className={`vd-glass vd-press pz-btn${a.pri ? " pz-btn--pri" : ""}`} onClick={() => void a.run()} disabled={a.off}>
              <PzIcon name={a.icon} />
              {a.t}
            </button>
          ))}
        </div>
        <button type="button" className="nx-lnk" onClick={() => P.nav("/pizarra/tableros")}>
          Volver a los tableros
        </button>
      </section>
    </>
  );
}
