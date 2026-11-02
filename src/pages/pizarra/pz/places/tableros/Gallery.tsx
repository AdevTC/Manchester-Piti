// r14 «La pizarra» · Tableros: the gallery (desktop and tablet stage · phone panel). «El oficial» featured with its
// reactions in words, «Tuyos», «Del equipo»; filters, search and order on a sticky glass bar; crisp minis.
import type { KeyboardEvent, ReactElement } from "react";
import type { Layout, PzBoard } from "../../store/types";
import { PiCampo } from "../../campo/PiCampo";
import { PzIcon } from "../../campo/Shirt";
import { verOf } from "../../store/seven";
import { fmt } from "../../store/fmt";
import { pb, type Filtro, type Orden } from "./pb";
import { goCmp, openIn, pick, undoPend, type Tb } from "./useTb";
import { jLabel, matchById, norm, savedOf } from "./tablerosView";
import { Origins } from "./Lead";

interface Act {
  t: string;
  icon: string;
  pri?: boolean;
  danger?: boolean;
  aria?: string;
  off?: boolean;
  run: () => void;
}

function Acts({ acts, cls }: { acts: Act[]; cls: string }) {
  return (
    <div className={cls}>
      {acts.map((a) => (
        <button key={a.t} type="button" className={`vd-glass vd-press pz-btn${a.pri ? " pz-btn--pri" : ""}${a.danger ? " pb-danger" : ""}`} onClick={a.run} aria-label={a.aria} disabled={a.off}>
          <PzIcon name={a.icon} />
          {a.t}
        </button>
      ))}
    </div>
  );
}

/** `split`: the tools stay on top and only the list scrolls (the desktop/tablet stage); else in flow (phone panel). */
export function Gallery({ tb, layout, split = false }: { tb: Tb; layout: Layout; split?: boolean }) {
  const { P, U, boards, off, cur, selId, mine } = tb;
  const phone = layout === "phone";
  const S = P.state;
  const m = P.sel.me();
  const cmp = S.route.sub === "comparar";
  const R = P.sel.reactions();
  const nextM = matchById(P, S.W.next);
  const J = nextM ? jLabel(nextM) : "";
  const offline = S.estado === "offline";

  const card = (b: PzBoard) => {
    const v = verOf(b.lineup, "titular");
    const st = P.sel.status(v);
    const M = matchById(P, b.matchId);
    const on = b.id === selId;
    const isCur = b.id === cur?.id;
    const ro = !P.sel.canEdit(b);
    const marks: { t: string; cls: string; icon?: string }[] = [];
    if (b.isOfficial && b.id === off?.id) marks.push({ t: "Oficial", cls: "is-of", icon: "star" });
    if (isCur) marks.push({ t: "Abierto", cls: "is-open", icon: "eye" });
    if (tb.ops.isMesa(b.id)) marks.push({ t: "De la mesa", cls: "", icon: "whistle" });
    (b.lineup.tags ?? [])
      .filter((t) => t !== "Mesa")
      .slice(0, 2)
      .forEach((t) => marks.push({ t, cls: "is-tag" }));
    const vers = (b.lineup.variants ?? []).length;
    const matchT = (M ? jLabel(M) + " · " + M.rival : "Sin partido") + " · " + (v.freeMode ? "Libre" : v.formation) + (st.full ? "" : " · " + st.n + "/7") + (vers ? " · +" + vers + (vers === 1 ? " versión" : " versiones") : "");
    const savedT = (isCur && offline ? "En este móvil" : (phone ? "" : "Guardado ") + savedOf(b.updatedAt, S.W.now)) + (mine(b) ? "" : " · @" + b.ownerNick);
    const acts: Act[] = [{ t: isCur ? "Seguir" : "Abrir", icon: "shirt", pri: true, aria: "Abrir «" + b.name + "» en Siete", run: () => openIn(P, b.id) }];
    if (phone) acts.push({ t: "Detalles", icon: "dots", aria: "Detalles de «" + b.name + "»", run: () => P.act.openSheet("pb-tablero", { id: b.id }, { title: b.name, kicker: b.id === off?.id ? "El oficial" : mine(b) ? "Tuyo" : "De @" + b.ownerNick }) });
    else if (ro && m.member && !m.socia) acts.push({ t: "Duplicar", icon: "copy", aria: "Duplicar «" + b.name + "» para editarlo", off: !!U.busy, run: () => void tb.ops.duplicate(b.id) });
    else acts.push({ t: "Comparar", icon: "swap", aria: "Comparar «" + b.name + "»", run: () => goCmp(P, off && off.id !== b.id ? "b:" + off.id + ":titular" : cur && cur.id !== b.id ? "b:" + cur.id + ":titular" : null, "b:" + b.id + ":titular") });
    const fresh = !!U.seen[b.id];
    const aria = b.name + ". " + (b.isOfficial ? "Oficial. " : "") + (isCur ? "Abierto ahora. " : "") + matchT + ". " + savedT + (ro ? ". Solo lectura" : "") + (phone ? "" : ". Intro para ver sus detalles; doble toque para abrirlo");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && on) {
        e.preventDefault();
        openIn(P, b.id);
      }
    };
    return (
      <article key={b.id} className={`vd-glass pb-card${on ? " is-on" : ""}${fresh ? " is-new" : ""}`}>
        <button type="button" className="pb-card__hit" onClick={() => pick(P, b)} onDoubleClick={() => openIn(P, b.id)} onKeyDown={onKey} aria-pressed={on} aria-label={aria} aria-keyshortcuts="Enter" />
        <div className="pb-card__pitch">
          <PiCampo layout={layout} mini show={{ source: "siete", boardId: b.id, version: "titular" }} camera="grada" />
        </div>
        <div className="pb-card__body">
          <p className="pb-marks">
            {marks.map((k) => (
              <span key={k.t} className={`pb-mk ${k.cls}`}>
                {k.icon && <PzIcon name={k.icon} />}
                {k.t}
              </span>
            ))}
          </p>
          <h3 title={b.name}>{b.name}</h3>
          <p className="pb-card__m">{matchT}</p>
          <p className="pb-card__s">{savedT}</p>
        </div>
        {on && <Acts cls="pb-card__acts" acts={acts} />}
      </article>
    );
  };

  // ── filters, search, order
  const q = norm(U.q);
  const matchQ = (b: PzBoard) => {
    if (!q) return true;
    const M = matchById(P, b.matchId);
    return norm([b.name, M ? M.rival : "", M ? jLabel(M) : "", (b.lineup.tags ?? []).join(" "), b.ownerNick].join(" ")).includes(q);
  };
  const sortFn: Record<Orden, (a: PzBoard, b: PzBoard) => number> = {
    recientes: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
    nombre: (a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base", numeric: true }),
    partido: (a, b) => (matchById(P, b.matchId)?.at ?? -1) - (matchById(P, a.matchId)?.at ?? -1) || (b.updatedAt || 0) - (a.updatedAt || 0),
  };
  const sort = sortFn[U.orden];
  const mineL = boards.filter((b) => mine(b) && b.id !== off?.id);
  const teamL = boards.filter((b) => !mine(b) && b.id !== off?.id);
  const nMine = boards.filter(mine).length;
  const nTeam = boards.filter((b) => !mine(b)).length;
  const filters = (
    [
      ["todos", "Todos", boards.length],
      ["mios", "Míos", nMine],
      ["oficial", phone ? "Oficial" : "Oficiales", off ? 1 : 0],
      ["equipo", phone ? "Equipo" : "Del equipo", nTeam],
    ] as [Filtro, string, number][]
  ).filter((f) => !(f[0] === "mios" && m.socia));
  const pend = U.pend;
  const pendCard = (g: "mine" | "team" | "off") =>
    pend && pend.group === g ? (
      <div className="pb-pend" role="status">
        <b>{pend.kind === "board" ? "«" + pend.name + "» borrado" : pend.kind === "mesa" ? pend.name : "«" + pend.name + "» ya no es el oficial"}</b>
        <span>Tienes unos segundos para recuperarlo.</span>
        <button type="button" className="vd-glass vd-press pz-btn" onClick={() => undoPend(P, U)}>
          <PzIcon name="undoA" />
          Deshacer
        </button>
      </div>
    ) : null;

  let visible = 0;
  const groups: ReactElement[] = [];
  if (boards.length) {
    const showOff = U.filtro === "todos" || U.filtro === "oficial" || (U.filtro === "mios" && !!off && mine(off)) || (U.filtro === "equipo" && !!off && !mine(off));
    if (showOff) {
      const offM = off ? matchById(P, off.matchId) : null;
      const sub = off ? "Lo ve todo el equipo · " + (offM ? jLabel(offM) : "toda la temporada") : J ? "De la " + J : "";
      let body: ReactElement | null = null;
      if (off && matchQ(off)) {
        const tot = Math.max(1, R.ok + R.dudas);
        const on = off.id === selId;
        const acts: Act[] = [{ t: off.id === cur?.id ? "Seguir en el oficial" : "Ver el oficial", icon: "eye", pri: true, run: () => openIn(P, off.id) }];
        if (!P.sel.canEdit(off) && m.member && !m.socia) acts.push({ t: "Duplicar para editar", icon: "copy", off: !!U.busy, run: () => void tb.ops.duplicate(off.id) });
        else if (cur && cur.id !== off.id) acts.push({ t: "Compararlo con el tuyo", icon: "swap", run: () => goCmp(P, "b:" + off.id + ":titular", "b:" + cur.id + ":titular") });
        const v = verOf(off.lineup, "titular");
        const reactT = R.ok + " de acuerdo · " + R.dudas + " con dudas";
        visible++;
        body = (
          <article className={`vd-glass pb-feat${on ? " is-on" : ""}`}>
            <button type="button" className="pb-card__hit" onClick={() => pick(P, off)} onDoubleClick={() => openIn(P, off.id)} aria-pressed={on} aria-label={"El oficial: " + off.name + ". " + reactT} />
            <div className="pb-card__pitch">
              <PiCampo layout={layout} mini show={{ source: "siete", boardId: off.id, version: "titular" }} camera="grada" />
            </div>
            <div className="pb-feat__b">
              <p className="pb-k">El oficial · {offM ? jLabel(offM) + " · " + offM.rival : "toda la temporada"}</p>
              <h3>{off.name}</h3>
              <p>{"De @" + off.ownerNick + " · " + savedOf(off.updatedAt, S.W.now) + " · " + v.formation}</p>
              <div className="pb-rx" role="img" aria-label={reactT}>
                <span className="pb-rx__bar" aria-hidden="true">
                  <i className="ok" style={{ width: Math.round((R.ok / tot) * 100) + "%" }} />
                  <i className="du" style={{ width: Math.round((R.dudas / tot) * 100) + "%" }} />
                </span>
                <span className="pb-rx__t">
                  {reactT}
                  {R.ok + R.dudas ? null : <small> · nadie ha opinado aún</small>}
                </span>
              </div>
              <Acts cls="pb-feat__acts" acts={acts} />
            </div>
          </article>
        );
      } else if (!off && !q && pend?.kind !== "quitar") {
        const st = cur && mine(cur) ? P.sel.status(verOf(cur.lineup, "titular")) : null;
        body = (
          <div className="pb-nooff">
            <b>{"Aún no hay siete oficial" + (J ? " para la " + J : "")}</b>
            <span>{m.cap ? (st ? (st.full ? "El tuyo está completo: publícalo y el equipo lo verá aquí." : "El tuyo va " + st.n + " de 7: complétalo y publícalo.") : "Publica uno de tus tableros y el equipo lo verá aquí.") : "Cuando un capitán lo publique, saldrá aquí el primero."}</span>
            {m.cap && st?.full && cur && (
              <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.openSheet("publicar")}>
                <PzIcon name="send" />
                {"Publicar «" + cur.name + "»"}
              </button>
            )}
          </div>
        );
      }
      const pc = pendCard("off");
      if (body || pc)
        groups.push(
          <section key="off" className="pb-grp" aria-label="El oficial">
            <div className="pb-grp__h">
              <h2>El oficial</h2>
              <p>{sub}</p>
            </div>
            {pc}
            {body}
          </section>,
        );
    }
    const grp = (key: "mine" | "team", t: string, s: string, list: PzBoard[], emptyT: string) => {
      const cards = list.filter(matchQ).sort(sort);
      visible += cards.length;
      const pc = pendCard(key);
      if (!cards.length && !pc && !emptyT) return;
      groups.push(
        <section key={key} className="pb-grp" aria-label={t}>
          <div className="pb-grp__h">
            <h2>{t}</h2>
            <p>{s}</p>
          </div>
          {cards.length || pc ? (
            <div className="pb-grid">
              {pc}
              {cards.map(card)}
            </div>
          ) : (
            <p className="pz-meta">{emptyT}</p>
          )}
        </section>,
      );
    };
    if ((U.filtro === "todos" || U.filtro === "mios") && !m.socia) grp("mine", "Tuyos", m.cap ? "Solo tú los cambias" : "Solo tú los cambias · los demás los pueden leer", mineL, q ? "" : "Ninguno tuyo todavía.");
    if (U.filtro === "todos" || U.filtro === "equipo") {
      const mesaN = teamL.filter((b) => tb.ops.isMesa(b.id)).length;
      grp("team", "Del equipo", m.cap ? "Puedes cambiarlos: se cambian para su dueño" + (mesaN ? " · " + fmt.plural(mesaN, "copia", "copias") + " de la mesa" : "") : "De solo lectura · duplica el que te guste", teamL, q ? "" : "Nadie más tiene tableros esta temporada.");
    }
  }
  const noMatch = !!q && boards.length > 0 && visible === 0;
  const filtering = !!q || U.filtro !== "todos";

  if (!boards.length) {
    return (
      <div className={split ? "pb-gal pb-gal--split" : "pb-gal"}>
        <div className={split ? "pb-gal__scroll" : "pb-gal__list"}>
          {S.estado === "error" ? (
            <div className="pb-empty" role="alert">
              <h2>No se han podido leer los tableros</h2>
              <p>Tus tableros siguen guardados: prueba otra vez en un momento.</p>
              <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.retry()}>
                Reintentar
              </button>
            </div>
          ) : (
            <div className="pb-empty">
              <h2>{m.socia || !m.member ? "Aún no hay tableros" : "Tu primer tablero"}</h2>
              <p>{tb.canCreate ? "Empieza vacío o desde un siete hecho. Se guarda solo con tu primer cambio." : "Cuando un capitán publique el siete, lo verás aquí."}</p>
              {tb.canCreate && <Origins tb={tb} />}
            </div>
          )}
          {pendCard("mine") ?? pendCard("team") ?? pendCard("off")}
        </div>
      </div>
    );
  }
  const bar = (
    <>
      <div className="pb-tools" role="search">
        <div className="vd-glass pb-seg" role="group" aria-label="Qué tableros ver">
          {filters.map(([k, t, n]) => (
            <button key={k} type="button" aria-pressed={U.filtro === k} onClick={() => pb.set({ filtro: k })}>
              {t}
              <small>{n}</small>
            </button>
          ))}
        </div>
        <label className="vd-glass pb-search">
          <PzIcon name="search" />
          <span className="pz-vh">Buscar tableros</span>
          <input type="search" placeholder={phone ? "Nombre, rival…" : "Nombre, rival o etiqueta"} value={U.q} onChange={(e) => pb.set({ q: e.target.value })} />
        </label>
        <select className="vd-glass pb-sel" aria-label="Ordenar los tableros" value={U.orden} onChange={(e) => pb.set({ orden: e.target.value as Orden })}>
          {(
            [
              ["recientes", "Recientes"],
              ["nombre", "Nombre"],
              ["partido", "Partido"],
            ] as [Orden, string][]
          ).map(([v, t]) => (
            <option key={v} value={v}>
              {(phone ? "" : "Orden: ") + t}
            </option>
          ))}
        </select>
        {!cmp && (
          <button type="button" className="vd-glass vd-press pz-btn pb-cmpbtn" onClick={() => goCmp(P, U.cmpA, U.cmpB)} aria-label="Comparar dos sietes">
            <PzIcon name="swap" />
            <span>Comparar</span>
          </button>
        )}
      </div>
      {filtering && (
        <p className="pb-count" role="status">
          {visible + " de " + boards.length + (boards.length === 1 ? " tablero" : " tableros")}
        </p>
      )}
    </>
  );
  const list = (
    <>
      {groups}
      {noMatch && (
        <div className="pb-empty" role="status">
          <h2>Ningún tablero coincide</h2>
          <p>{"Nada con «" + U.q + "» en el nombre, el rival o las etiquetas."}</p>
          <button type="button" className="vd-glass vd-press pz-btn" onClick={() => pb.set({ q: "", filtro: "todos" })}>
            Ver todos
          </button>
        </div>
      )}
    </>
  );
  if (split)
    return (
      <div className="pb-gal pb-gal--split">
        <div className="pb-gal__bar">{bar}</div>
        <div className="pb-gal__scroll">{list}</div>
      </div>
    );
  return (
    <div className="pb-gal">
      {bar}
      {list}
    </div>
  );
}

