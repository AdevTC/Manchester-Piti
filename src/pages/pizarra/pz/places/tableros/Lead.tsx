// r14 «La pizarra» · Tableros: the left of the place (desktop lead · tablet · phone panel): the hero that says where
// the official stands, the numbers, «El oficial ha cambiado desde la última vez», «Empieza uno nuevo»; and, without
// boards, the sevens that played.
import { useSeason } from "../../../../../context/SeasonContext";
import { useSetSeason } from "../../../../../lib/useSetSeason";
import type { Layout } from "../../store/types";
import { PzIcon } from "../../campo/Shirt";
import { verOf } from "../../store/seven";
import { fmt } from "../../store/fmt";
import { pb } from "./pb";
import { goCmp, type Tb } from "./useTb";
import { dots, jLabel, matchById, playedSlots, resOf } from "./tablerosView";
import { readSeen, writeSeen } from "./seen";

/** The four ways to start a board (the «nuevo» sheet, the lead, the empty gallery). */
export function Origins({ tb }: { tb: Tb }) {
  const { P } = tb;
  const next = matchById(P, P.state.W.next);
  const srcs = P.sel.sources();
  const busy = !!tb.U.busy;
  const rows = [
    { id: "vacio", t: "Vacío", s: "2-3-1 sin nadie: tú lo llenas", can: true, blank: true, slots: null as null | { x: number; y: number; playerId: string | null }[], run: () => void tb.ops.create({ formation: "2-3-1", ids: [], name: "Nuevo tablero" }) },
    ...srcs.map((s) => ({
      id: s.id,
      t: s.t,
      s: s.s,
      can: s.can,
      blank: false,
      slots: s.slots,
      run: () => {
        if (!s.can || !s.formation || !s.slots) return;
        const name = s.id === "ultimo" ? "Como en " + s.s.split(" · ").slice(0, 2).join(" · ") : s.id === "oficial" ? "Desde el oficial" : "Contra " + (next ? next.rival : "el rival");
        void tb.ops.create({ formation: s.formation, ids: s.slots.map((x) => x.playerId), name });
      },
    })),
  ];
  return (
    <div className="pb-srcs">
      {rows.map((o) => {
        const off = !tb.canCreate || !o.can || busy;
        const s = tb.canCreate ? o.s : "Para tener tableros, entra con tu ficha";
        return (
          <button key={o.id} type="button" className="vd-glass vd-press pb-src" onClick={o.run} disabled={off} aria-label={"Tablero nuevo: " + o.t + ". " + s}>
            {o.blank ? (
              <span className="pb-mini0" aria-hidden="true">
                <PzIcon name="plus" />
              </span>
            ) : (
              <span className="pz-mini" aria-hidden="true">
                {dots(o.slots ?? []).map((d, i) => (
                  <i key={i} style={{ left: d.x + "%", top: d.y + "%" }} />
                ))}
              </span>
            )}
            <span>
              <b>{o.t}</b>
              <small>{s}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Hero({ tb, layout }: { tb: Tb; layout: Layout }) {
  const { P, boards, off, cur, mine } = tb;
  const m = P.sel.me();
  const { seasons } = useSeason();
  const setSeason = useSetSeason();
  const R = P.sel.reactions();
  const next = matchById(P, P.state.W.next);
  const J = next ? jLabel(next) : "";
  const offM = off ? matchById(P, off.matchId) : null;
  let headT: string;
  let headS: string;
  if (P.state.estado === "error") {
    // B-PZ-06: a failed read never says «you have none» (nor offers a first board that would hide the real ones)
    headT = "No se han podido leer los tableros";
    headS = P.state.error || "Prueba otra vez en un momento: tus tableros siguen guardados.";
  } else if (!boards.length) {
    headT = m.socia || !m.member ? "Aún no hay tableros" : "Aún no tienes tableros";
    headS = tb.canCreate ? "El primero se guarda solo con tu primer cambio." : "Cuando un capitán publique el siete, lo verás aquí.";
  } else {
    headT = fmt.plural(boards.length, "tablero", "tableros");
    if (off) headS = "El oficial de la " + (offM ? jLabel(offM) : "temporada") + " es «" + off.name + "»" + (R.ok + R.dudas ? ": " + R.ok + " de acuerdo, " + R.dudas + " con dudas." : ".");
    else if (m.cap) {
      const st = cur && mine(cur) ? P.sel.status(verOf(cur.lineup, "titular")) : null;
      headS = "Aún no hay oficial" + (J ? " para la " + J : "") + (st ? (st.full ? ": el tuyo está listo para publicar." : ": el tuyo va " + st.n + " de 7.") : ".");
    } else headS = "Aún no hay oficial" + (J ? " para la " + J : "") + ": cuando un capitán lo publique, saldrá el primero.";
  }
  const nMine = boards.filter(mine).length;
  const nTeam = boards.length - nMine;
  const stats = boards.length
    ? [
        { v: String(nMine), k: m.socia ? "Tuyos" : nMine === 1 ? "Tuyo" : "Tuyos", w: m.socia ? "Sin ficha" : nMine ? "Los cambias tú" : "Empieza uno" },
        { v: String(nTeam), k: "Del equipo", w: m.cap ? "Editables" : "Para leer" },
        off ? { v: String(R.ok), k: "De acuerdo", w: R.dudas + " con dudas" } : { v: "—", k: "Oficial", w: "Sin publicar" },
      ]
    : [];
  // PAR-42: «El oficial ha cambiado desde la última vez» (for who doesn't edit it): against what this device saw
  const seen = off && !m.cap ? readSeen(off.id) : null;
  const offV = off ? verOf(off.lineup, "titular") : null;
  const d = seen && offV ? P.sel.diff({ ...offV, formation: seen.formation, slots: seen.slots }, offV) : null;
  const hasNews = !!d && !d.same && !tb.U.newsOk;
  const season = P.state.W.season;
  const live = seasons.filter((s) => s.id);
  const phone = layout === "phone";
  return (
    <>
      <section className="pz-hero pb-hero" aria-labelledby="pb-h">
        <p className="pz-kick">
          {live.length > 1 ? (
            <label className="pb-kicksel">
              <span className="pz-vh">Temporada de los tableros</span>
              <select value={season.id} onChange={(e) => setSeason(e.target.value)}>
                {live.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span>{season.name}</span>
          )}
          <span>· se guardan solos</span>
          {P.state.estado === "offline" && (
            <span className="pb-off">
              <PzIcon name="offline" />
              Sin conexión · se guarda en este móvil
            </span>
          )}
        </p>
        <h1 className="pz-h1" id="pb-h">
          {headT}
        </h1>
        <p className="pz-line">{headS}</p>
      </section>
      {!!stats.length && !phone && (
        <div className="pz-stats pb-stats" role="group" aria-label="Tus tableros en números">
          {stats.map((s) => (
            <div key={s.k} className="pz-stat">
              <span className="pz-stat__v">{s.v}</span>
              <span className="pz-stat__k">{s.k}</span>
              <span className="pz-stat__w">{s.w}</span>
            </div>
          ))}
        </div>
      )}
      {hasNews && off && d && (
        <div className="pb-news" role="status">
          <b>El oficial ha cambiado desde la última vez</b>
          <span>{d.text.charAt(0).toUpperCase() + d.text.slice(1) + "."}</span>
          <div className="pz-acts">
            <button
              type="button"
              className="vd-glass vd-press pz-btn"
              onClick={() => {
                pb.set({ newsOk: true });
                goCmp(P, "v:" + off.id, "b:" + off.id + ":titular");
              }}
            >
              <PzIcon name="swap" />
              Ver qué cambia
            </button>
            <button
              type="button"
              className="nx-lnk"
              onClick={() => {
                if (offV) writeSeen(off.id, offV);
                pb.set({ newsOk: true });
              }}
            >
              Vale
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function OriginsSec({ tb }: { tb: Tb }) {
  return (
    <section className="pz-sec" aria-labelledby="pb-nu">
      <div className="pz-sec__h">
        <h2 id="pb-nu">Empieza uno nuevo</h2>
        <p>{tb.canCreate ? "Se abre en Siete" : "Solo con ficha"}</p>
      </div>
      <Origins tb={tb} />
    </section>
  );
}

/** Without boards: what each match played with (start from one, or compare two). */
export function Played({ tb }: { tb: Tb }) {
  const { P } = tb;
  const rows = P.state.W.matches
    .filter((x) => x.played)
    .map((M) => ({ M, ps: playedSlots(P, M) }))
    .filter((x): x is { M: (typeof x)["M"]; ps: NonNullable<(typeof x)["ps"]> } => !!x.ps);
  if (!rows.length) return null;
  const last2 = rows.slice(-2);
  return (
    <section className="pz-sec" aria-labelledby="pb-pl">
      <div className="pz-sec__h">
        <h2 id="pb-pl">Los sietes que jugaron</h2>
        <p>{P.state.W.season.name}</p>
      </div>
      <p className="pz-meta">Lo que salió en cada partido: empieza desde uno o compáralos.</p>
      <ul className="pb-hist">
        {rows.map(({ M, ps }) => (
          <li key={M.id} className="pb-h">
            <span className="pz-mini" aria-hidden="true">
              {dots(ps.slots).map((d, i) => (
                <i key={i} style={{ left: d.x + "%", top: d.y + "%" }} />
              ))}
            </span>
            <span>
              <b>{jLabel(M) + " · " + M.rival}</b>
              <small>{resOf(M).w + " · " + ps.formation}</small>
            </span>
            <span className="pb-h__a">
              <button type="button" className="nx-lnk" disabled={!tb.canCreate || !!tb.U.busy} aria-label={"Empezar un tablero como en la " + jLabel(M)} onClick={() => void tb.ops.create({ formation: ps.formation, ids: ps.slots.map((s) => s.playerId), name: "Como en " + jLabel(M) + " · " + M.rival })}>
                Empezar así
              </button>
            </span>
          </li>
        ))}
      </ul>
      {last2.length > 1 && (
        <div className="pz-acts">
          <button type="button" className="vd-glass vd-press pz-btn" onClick={() => goCmp(P, "j:" + last2[0].M.id, "j:" + last2[1].M.id)}>
            <PzIcon name="swap" />
            {"Comparar " + jLabel(last2[0].M) + " y " + jLabel(last2[1].M)}
          </button>
        </div>
      )}
    </section>
  );
}
