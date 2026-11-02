// r14 «La pizarra» · Partido (/pizarra/partido): the day of the match in one place, with its phases — Antes (the
// countdown, the quedada, the forecast, who goes, la mesa and «Mandar a la mesa», the minutes plan), En juego (la
// mesa's clock and score, the pitch NOW, the next change with its ring and «Hacer el cambio» with a confirm and
// «Deshacer», «¿Quién no puede seguir?», the «Si pasa…» plan, today's minutes, the galones now), Descanso (the 2ª
// parte ready) and Después (the frozen notas, planned against played). The prototype's PiPartido, regions lead ·
// side · peek · panel. Lead/peek/panel also run the feed bridge, the stage and the keys (H, M).
import { useEffect, useRef, type ReactNode } from "react";
import { usePz } from "../../store/context";
import type { PzApi } from "../../store/api";
import type { RegionProps } from "../../store/types";
import { PzIcon } from "../../campo/Shirt";
import { fmt } from "../../store/fmt";
import "../../../../../styles/pz/partido.css";
import { PtFeedBridge } from "./feed";
import { setUi } from "./state";
import { applyProp, askNext, doDesc, doNext, model, primaryOf, propose } from "./actions";
import { stageFor, type PtModel } from "./partidoView";
import { antesOf, cantOf, condOf, descOf, despOf, eventsOf, galNowOf, kickerOf, minsOf, nextOf, planOf, propOf, scoreboardOf, stepsOf, youOf, type Seg } from "./partidoVals";

/** A shirt in a list (the printed still; while it renders, the dorsal on a plain kit). */
export function PtShirt({ pid, out = false }: { pid: string | null | undefined; out?: boolean }) {
  const P = usePz();
  const st = P.sel.shirt(pid);
  return (
    <span className={`pz-shirt${out ? " is-out" : ""}${st.src ? "" : " pt-drawn"}`} aria-hidden="true">
      {st.src ? <img src={st.src} alt="" draggable={false} decoding="async" /> : <i>{st.num}</i>}
    </span>
  );
}

const Ic = ({ n }: { n: string }) => <PzIcon name={n} />;

/** The stage and the keys: applied by the one region that leads (lead · peek · panel). */
function useLeader(P: PzApi, X: PtModel) {
  const spec = stageFor(P, X);
  const key = JSON.stringify(spec);
  const last = useRef("");
  useEffect(() => {
    if (P.state.route.place !== "partido" || last.current === key) return;
    last.current = key;
    P.act.setStage(JSON.parse(key) as typeof spec, { replace: true });
    // (the spec's text is what matters: P is a new facade on every store version)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // Después: the pitch shows the notas (the layer comes back when leaving)
  const isAfter = X.ph === "despues";
  useEffect(() => {
    if (!isAfter) return;
    const prev = P.state.layer;
    if (prev === "nada") P.act.setLayer("nota");
    return () => {
      if (prev === "nada" && P.state.layer === "nota") P.act.setLayer("nada");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAfter]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (P.state.route.place !== "partido" || e.ctrlKey || e.metaKey || e.altKey || P.state.sheet) return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      const Y = model(P);
      const k = e.key.toLowerCase();
      if (k === "h" && Y.decide) {
        if (Y.ph === "juego" && Y.next?.in) {
          e.preventDefault();
          askNext(P);
        } else if (Y.ph === "descanso") {
          e.preventDefault();
          setUi(P, { confirm: "desc" });
        }
      }
      if (k === "m" && Y.b && P.sel.canEdit(Y.b) && (Y.ph === "antes" || (Y.ph === "juego" && Y.decide))) {
        e.preventDefault();
        propose(P);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // (P's store is the page's: the listener reads it live)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function Leader({ X }: { X: PtModel }) {
  const P = usePz();
  useLeader(P, X);
  return null;
}

function Steps({ X }: { X: PtModel }) {
  return (
    <ol className="pt-steps" aria-label="Las cuatro partes del día">
      {stepsOf(X).map((s) => (
        <li key={s.id} className={s.cls} aria-current={s.cur ? "step" : undefined}>
          <span>
            <Ic n={s.icon} />
            {s.t}
          </span>
          <small>{s.s}</small>
        </li>
      ))}
    </ol>
  );
}

function Stats({ stats, label, pad }: { stats: { v: string; k: string; w: string }[]; label: string; pad: string }) {
  return (
    <div className="pz-stats" role="group" aria-label={label} style={{ padding: pad }}>
      {stats.map((st) => (
        <div className="pz-stat" key={st.k}>
          <span className="pz-stat__v">{st.v}</span>
          <span className="pz-stat__k">{st.k}</span>
          <span className="pz-stat__w">{st.w}</span>
        </div>
      ))}
    </div>
  );
}

function Bar({ segs, nowL }: { segs: Seg[]; nowL?: number | null }) {
  return (
    <span className="pt-bar" aria-hidden="true">
      <u style={{ left: "50%" }} />
      {segs.map((g, i) => (
        <i key={i} className={g.cls} style={{ left: g.l + "%", width: g.w + "%" }} />
      ))}
      {nowL != null && <b style={{ left: nowL + "%" }} />}
    </span>
  );
}

function Pair({ out, inn }: { out: string; inn: string }) {
  return (
    <span className="pt-pair" aria-hidden="true">
      <PtShirt pid={out} out />
      <Ic n="arrowR" />
      <PtShirt pid={inn} />
    </span>
  );
}

function Confirm({ id, ask, sub, busy, onYes, onNo }: { id: string; ask: string; sub: string; busy: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <div className="pt-confirm" role="alertdialog" aria-labelledby={id}>
      <p id={id}>
        {ask}
        <small>{sub}</small>
      </p>
      <div className="pz-acts">
        <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={onYes} disabled={busy}>
          <Ic n="check" />
          {busy ? "Apuntando…" : "Sí, apuntar"}
        </button>
        <button type="button" className="vd-glass vd-press pz-btn" onClick={onNo} disabled={busy}>
          No
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────── LEAD: what happened and who ─────────────────────────────
function Lead({ X }: { X: PtModel }) {
  const P = usePz();
  const M = X.M;
  const ph = X.ph;
  if (!M)
    return (
      <section className="pz-hero pt-hero">
        <p className="pz-kick">El día de partido</p>
        <h1 className="pz-h1">Sin partido a la vista</h1>
        <p className="pz-line">Cuando el calendario tenga el próximo, aquí estará su día: la quedada, la mesa y los cambios.</p>
      </section>
    );
  const kicker = kickerOf(P, X);
  if (ph === "antes") {
    const A = antesOf(P, X);
    return (
      <>
        <section className="pz-hero pt-hero" aria-labelledby="pt-h">
          <p className="pz-kick">{kicker}</p>
          <h1 className="pz-h1" id="pt-h">
            {A.head}
          </h1>
          <p className="pz-line">{A.line}</p>
        </section>
        <Steps X={X} />
        <Stats stats={A.stats} label="El día en números" pad="18px 0 4px" />
        <section className="pz-sec pt-mesa" aria-labelledby="pt-mesa-h" style={{ marginTop: 14 }}>
          <div className="pt-mesa__top">
            <h2 id="pt-mesa-h">La mesa</h2>
            <span className={`pz-chip ${A.mesa.cls}`}>
              <Ic n={A.mesa.icon} />
              {A.mesa.t}
            </span>
          </div>
          <p>{A.mesa.line}</p>
          {A.mesa.can && (
            <div className="pz-acts">
              <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.openSheet("pt-mesa")} disabled={A.mesa.off}>
                <Ic n="send" />
                {A.mesa.btn}
              </button>
              {A.mesa.open && (
                <a className="nx-lnk" href={"/partidos/" + encodeURIComponent(M.id) + "/mesa"}>
                  Abrir la mesa
                </a>
              )}
            </div>
          )}
          {A.mesa.scorer && <p className="pz-meta">{A.mesa.scorer}</p>}
          {A.mesa.ro && (
            <p className="pt-ro">
              <Ic n="lock" />
              {A.mesa.roT}
            </p>
          )}
        </section>
        <section className="pz-sec" aria-labelledby="pt-conv-h">
          <div className="pz-sec__h">
            <h2 id="pt-conv-h">Quién va</h2>
            {A.conv.meta && <p>{A.conv.meta}</p>}
          </div>
          <ul className="pt-conv">
            {A.conv.rows.map((r) => (
              <li key={r.t + r.names}>
                <span>
                  <span className={`pz-chip ${r.cls}`}>
                    <Ic n={r.icon} />
                    {r.n} {r.t}
                  </span>
                </span>
                <p>
                  {r.names}
                  {r.note && <small>{r.note}</small>}
                </p>
              </li>
            ))}
          </ul>
        </section>
        {A.quedada.length > 0 && (
          <section className="pz-sec" aria-labelledby="pt-qd-h">
            <div className="pz-sec__h">
              <h2 id="pt-qd-h">La quedada</h2>
            </div>
            <ul className="pt-qd">
              {A.quedada.map((q) => (
                <li key={q.t}>
                  <span className="vx-tile">
                    <Ic n={q.icon} />
                  </span>
                  <span>
                    <b>{q.t}</b>
                    <small>{q.s}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    );
  }
  if (!X.L)
    return (
      <section className="pz-hero pt-hero">
        <p className="pz-kick">{kicker}</p>
        <h1 className="pz-h1">{ph === "despues" ? "Jugado" : "En juego"}</h1>
        <p className="pz-line">Sin siete en la mesa ni en la pizarra: no hay campo que enseñar.</p>
      </section>
    );
  const sb = scoreboardOf(P, X);
  const live = ph === "juego";
  const crest = (
    <>
      <img className="pt-crest" src="/crest-128.webp" alt="" />
      <b>Piti</b>
    </>
  );
  const them = (
    <>
      <span className="pt-rival">{sb.code}</span>
      <b>{sb.rival}</b>
    </>
  );
  const you = youOf(P, X);
  const D = despOf(P, X);
  const De = descOf(P, X);
  const canChange = X.decide && !X.ro && (ph === "juego" || ph === "descanso");
  const C = ph === "juego" || ph === "descanso" ? cantOf(P, X) : null;
  const evs = eventsOf(P, X, sb.code);
  const cond = condOf(P, X, canChange);
  return (
    <>
      <section className="pz-hero pt-hero" aria-labelledby="pt-h2">
        <p className="pz-kick">
          {kicker}
          {live && (
            <span className="pt-live">
              <i aria-hidden="true" />
              En juego
            </span>
          )}
        </p>
        <div className="pt-board" role="heading" aria-level={1} id="pt-h2" aria-label={sb.aria}>
          <div className="pt-score" aria-hidden="true">
            <div className="pt-team">{sb.homeUs ? crest : them}</div>
            <div className="pt-num">
              <b>{sb.l}</b>
              <i>–</i>
              <b>{sb.r}</b>
            </div>
            <div className="pt-team">{sb.homeUs ? them : crest}</div>
          </div>
          <p className="pt-clock" aria-hidden="true">
            <b>{sb.min}</b>
            <span>{sb.part}</span>
            <small>{sb.sub}</small>
          </p>
        </div>
        <p className="pz-line pt-sbline">{sb.line}</p>
      </section>
      <Steps X={X} />
      {you && (
        <section className="pz-sec pt-you">
          <div className="pz-sec__h">
            <h2>Tú</h2>
          </div>
          <p className="pz-line">{you}</p>
        </section>
      )}
      {D && (
        <>
          <Stats stats={D.stats} label="El partido en números" pad="18px 0 14px" />
          <section className="pz-sec" aria-label="Más del partido">
            <div className="pt-links">
              <a className="vd-glass vd-press pz-btn" href={"/partidos/" + encodeURIComponent(M.id)}>
                <Ic n="board" />
                Ver el acta
              </a>
              <a className="vd-glass vd-press pz-btn" href={"/partidos/" + encodeURIComponent(M.id) + "/numeros"}>
                <Ic n="star" />
                Los números
              </a>
              <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.openSheet("compartir")}>
                <Ic n="share" />
                El cartel
              </button>
            </div>
          </section>
        </>
      )}
      {De && <Stats stats={De.stats} label="La 1ª parte en números" pad="18px 0 14px" />}
      {C && (
        <section className="pz-sec" aria-labelledby="pt-cant-h">
          <div className="pz-sec__h">
            <h2 id="pt-cant-h">¿Quién no puede seguir?</h2>
            <p>{X.decide ? "Toca a quien no pueda" : "Lo marcan los capitanes"}</p>
          </div>
          {C.flags.length > 0 && (
            <ul className="pt-evs" aria-label="Lo que apunta la mesa">
              {C.flags.map((f) => (
                <li key={f.id} className={f.cls}>
                  <span className="pt-m">{f.min}</span>
                  <span className="pt-ico" aria-hidden="true">
                    <i>{f.glyph}</i>
                  </span>
                  <span className="pt-t">
                    <b>{f.t}</b>
                    <small>{f.s}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="pt-cant" role="group" aria-label="Toca a quien no pueda seguir">
            {C.chips.map((c) => (
              <button
                key={c.pid}
                type="button"
                aria-pressed={c.on}
                disabled={!canChange}
                aria-label={c.aria}
                onClick={() => {
                  const cant = { ...X.ui.cant };
                  if (cant[c.pid]) delete cant[c.pid];
                  else cant[c.pid] = true;
                  P.slice("partido").set({ cant }, { label: cant[c.pid] ? c.name + " no puede seguir" : c.name + " puede seguir" });
                }}
              >
                <PtShirt pid={c.pid} />
                {c.name}
                <small>{c.w}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="pz-sec" aria-labelledby="pt-ev-h">
        <div className="pz-sec__h">
          <h2 id="pt-ev-h">{ph === "despues" ? "Cómo fue" : "Lo que ha pasado"}</h2>
          <p>{ph === "despues" ? "Del acta" : "Lo apunta la mesa"}</p>
        </div>
        {evs.length ? (
          <ul className="pt-evs" aria-live="polite">
            {evs.map((e) => (
              <li key={e.id} className={e.cls}>
                <span className="pt-m">{e.min}</span>
                <span className="pt-ico" aria-hidden="true">
                  {e.kind === "svg" && <Ic n={e.icon} />}
                  {e.kind === "card" && <i />}
                  {e.kind === "glyph" && <i>{e.icon}</i>}
                  {e.kind === "code" && sb.code}
                </span>
                <span className="pt-t">
                  <b>{e.t}</b>
                  {e.s && <small>{e.s}</small>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pz-meta">Nada todavía: la mesa apunta goles, cambios y tarjetas al momento.</p>
        )}
      </section>
      {cond && (
        <section className="pz-sec pt-cond" aria-labelledby="pt-cond-h">
          <div className="pz-sec__h">
            <h2 id="pt-cond-h">Si pasa…</h2>
            <p>La mesa lo ve igual</p>
          </div>
          <p>{cond.sentence}</p>
          <div className="pt-cond__st">
            <span className={`pz-chip ${cond.cls}`}>
              <Ic n={cond.icon} />
              {cond.st}
            </span>
            {cond.canApply && (
              <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => P.slice("partido").set({ cond: true }, { label: "Plan aplicado: es el próximo cambio" })}>
                Aplicar
              </button>
            )}
          </div>
        </section>
      )}
    </>
  );
}

// ───────────────────────────── SIDE: what to do now ─────────────────────────────
function Side({ X }: { X: PtModel }) {
  const P = usePz();
  const ph = X.ph;
  const M = X.M;
  if (!M) return null;
  const canChange = X.decide && !X.ro && (ph === "juego" || ph === "descanso");
  const J = M.j ? "J" + M.j : "partido";
  const roChange = P.sel.me().socia ? "Lo ves en directo; los cambios los apuntan los capitanes y quien anota." : "Los cambios los apuntan los capitanes y quien anota la " + J + ".";
  const nx = ph === "juego" ? nextOf(P, X) : null;
  const plan = planOf(P, X);
  const prop = ph === "antes" || ph === "juego" ? propOf(P, X) : null;
  const mins = minsOf(P, X);
  const De = descOf(P, X);
  const D = despOf(P, X);
  const gal = galNowOf(P, X);
  const busy = X.ui.busy;
  const set = (patch: Parameters<typeof setUi>[1]) => setUi(P, patch);
  const blocks: ReactNode[] = [];
  if (nx)
    blocks.push(
      <section className="pt-next" aria-labelledby="pt-next-h" key="next">
        <div className="pt-next__top">
          <div>
            <p className={`pt-next__k ${nx.kCls}`}>
              <Ic n={nx.kIcon} />
              {nx.kicker}
            </p>
            <h2 id="pt-next-h">
              {nx.t}
              <small>{nx.s}</small>
            </h2>
          </div>
          <Ring nx={nx} />
        </div>
        <div className="pt-who">
          <div>
            <PtShirt pid={nx.in} />
            <span>
              <small>
                <Ic n="arrow" />
                Entra
              </small>
              <b>{nx.inName}</b>
              <em>{nx.inSub}</em>
            </span>
          </div>
          <div>
            <PtShirt pid={nx.out} out />
            <span>
              <small>
                <Ic n="arrow" />
                Sale
              </small>
              <b>{nx.outName}</b>
              <em>{nx.outSub}</em>
            </span>
          </div>
        </div>
        <p className={`pt-chk${nx.ok ? "" : " is-warn"}`}>
          <Ic n={nx.ok ? "check" : "warn"} />
          {nx.chk}
        </p>
        {canChange && X.ui.confirm === "next" && <Confirm id="pt-cf-t" ask={nx.ask} sub={nx.askS} busy={busy} onYes={() => void doNext(P)} onNo={() => set({ confirm: "" })} />}
        {canChange && X.ui.confirm !== "next" && (
          <div className="pt-do">
            <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => askNext(P)} aria-keyshortcuts="H" disabled={busy}>
              <Ic n="swap" />
              {nx.btn}
              <kbd aria-hidden="true">H</kbd>
            </button>
            <div className="pz-acts pt-do__more">
              <button type="button" className="nx-lnk" onClick={() => P.act.openSheet("pt-otro")}>
                Otro cambio…
              </button>
              {X.b && P.sel.canEdit(X.b) && (
                <button type="button" className="nx-lnk" onClick={() => propose(P)} aria-keyshortcuts="M">
                  Recalcular desde el {X.now}′
                </button>
              )}
            </div>
          </div>
        )}
        {!canChange && (
          <p className="pt-ro">
            <Ic n="lock" />
            {roChange}
          </p>
        )}
      </section>,
    );
  else if (ph === "juego")
    blocks.push(
      <section className="pt-next" key="nonext">
        <p className="pt-next__k">
          <Ic n="check" />
          Cambios
        </p>
        <h2>Sin más cambios en el plan</h2>
        {canChange && (
          <div className="pz-acts">
            <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.openSheet("pt-otro")}>
              <Ic n="swap" />
              Otro cambio…
            </button>
          </div>
        )}
      </section>,
    );
  if (De)
    blocks.push(
      <section className="pt-next" aria-labelledby="pt-2p-h" key="desc">
        <p className="pt-next__k">
          <Ic n="clock" />
          Descanso · la 2ª parte
        </p>
        <h2 id="pt-2p-h">
          {De.head}
          <small>{De.sub}</small>
        </h2>
        <div className="vd-glass pt-seg" role="group" aria-label="Qué cambios hacer">
          {(
            [
              ["version", "La versión «2ª parte»"],
              ["plan", "Seguir el plan"],
            ] as const
          ).map(([id, t]) => (
            <button key={id} type="button" aria-pressed={X.ui.descOpt === id} onClick={() => set({ descOpt: id })}>
              {t}
            </button>
          ))}
        </div>
        {De.pairs.length > 0 && (
          <ul className="pt-tandas">
            {De.pairs.map((r) => (
              <li key={r.id}>
                <div className="pt-tanda">
                  <b>{X.HALF}′</b>
                  <span className="pt-tx">
                    <strong>{r.t}</strong>
                    <small>{r.s}</small>
                  </span>
                  <Pair out={r.out} inn={r.in} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {canChange && X.ui.confirm === "desc" && <Confirm id="pt-cf2" ask={De.ask} sub="Se apunta en el acta para la 2ª parte. Tendrás 5 segundos para deshacerlo." busy={busy} onYes={() => void doDesc(P)} onNo={() => set({ confirm: "" })} />}
        {canChange && X.ui.confirm !== "desc" && (
          <div className="pt-do">
            <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => set({ confirm: "desc" })} disabled={De.off || busy} aria-keyshortcuts="H">
              <Ic n="swap" />
              Aplicar la 2ª parte
              <kbd aria-hidden="true">H</kbd>
            </button>
          </div>
        )}
        {!canChange && (
          <p className="pt-ro">
            <Ic n="lock" />
            {roChange}
          </p>
        )}
        <p className="pz-meta">La mesa ofrece esta misma 2ª parte en su descanso.</p>
      </section>,
      <section className="pz-sec" aria-label="Qué enseña el campo" key="descv">
        <div className="vd-glass pt-seg" role="group" aria-label="El campo enseña">
          {(
            [
              ["ahora", "El campo ahora"],
              ["segunda", "Cómo sale la 2ª"],
            ] as const
          ).map(([id, t]) => (
            <button key={id} type="button" aria-pressed={X.ui.desc === id} onClick={() => set({ desc: id })}>
              {t}
            </button>
          ))}
        </div>
      </section>,
    );
  if (D)
    blocks.push(
      <section className="pz-sec pt-first" aria-label="Qué enseña el campo" key="despv">
        <div className="vd-glass pt-seg" role="group" aria-label="El campo enseña">
          {(
            [
              ["acabo", "Acabaron"],
              ["empezo", "Empezaron"],
              ["plan", "Lo planeado"],
            ] as const
          ).map(([id, t]) => (
            <button key={id} type="button" aria-pressed={X.ui.desp === id} onClick={() => set({ desp: id })}>
              {t}
            </button>
          ))}
        </div>
      </section>,
      <section className="pz-sec" aria-labelledby="pt-pv-h" key="desp">
        <div className="pz-sec__h">
          <h2 id="pt-pv-h">Planeado y jugado</h2>
          <p>{D.meta}</p>
        </div>
        <p className="pt-legend">
          <span>
            <i className="p" aria-hidden="true" />
            Lo planeado
          </span>
          <span>
            <i className="s" aria-hidden="true" />
            Lo jugado
          </span>
        </p>
        <ul className="pt-after">
          {D.rows.map((r) => (
            <li key={r.pid} aria-label={r.aria}>
              <PtShirt pid={r.pid} />
              <div>
                <span>
                  <b>{r.name}</b>
                  <small>{r.w}</small>
                </span>
                <Bar segs={r.segs} />
              </div>
              <span className={`pt-nota ${r.nCls}`}>
                {r.nota}
                <small>{r.nWord}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>,
    );
  if (prop)
    blocks.push(
      <section className="pz-sec pt-first" aria-labelledby="pt-prop-h" key="prop">
        <div className="pt-prop" role="region" aria-labelledby="pt-prop-h">
          <b id="pt-prop-h">{prop.t}</b>
          <p>{prop.s}</p>
          <ul className="pt-tandas">
            {prop.rows.map((r) => (
              <li key={r.id}>
                <div className="pt-tanda">
                  <b>{r.min}</b>
                  <span className="pt-tx">
                    <strong>{r.t}</strong>
                    <small>{r.s}</small>
                  </span>
                  <Pair out={r.out} inn={r.in} />
                </div>
              </li>
            ))}
          </ul>
          {prop.delta.length > 0 && (
            <p className="pt-delta">
              {prop.delta.map((d) => (
                <span key={d.k}>
                  <b>{d.n}</b> {d.t}
                </span>
              ))}
            </p>
          )}
          <div className="pz-acts">
            <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => applyProp(P)}>
              <Ic n="check" />
              Aplicar
            </button>
            <button
              type="button"
              className="nx-lnk"
              onClick={() => {
                set({ prop: null });
                P.toast("Propuesta descartada", { icon: "close" });
              }}
            >
              Descartar
            </button>
          </div>
        </div>
      </section>,
    );
  if (plan)
    blocks.push(
      <section className={nx || De || prop ? "pz-sec" : "pz-sec pt-first"} aria-labelledby="pt-plan-h" key="plan">
        {"title" in plan && (
          <div className="pz-sec__h">
            <h2 id="pt-plan-h">{plan.title}</h2>
            <p>{plan.meta}</p>
          </div>
        )}
        {"title" in plan && plan.has && (
          <>
            <div className="pt-tl" role="group" aria-label={plan.tlAria}>
              <span className="pt-tl__track" aria-hidden="true" />
              <span className="pt-tl__played" style={{ width: plan.playedW + "%" }} aria-hidden="true" />
              <span className="pt-tl__half" style={{ left: plan.halfL + "%" }} aria-hidden="true" />
              <span className="pt-tl__halfT" style={{ left: plan.halfL + "%" }} aria-hidden="true">
                Descanso
              </span>
              <span className="pt-tl__end" style={{ left: 0 }} aria-hidden="true">
                0′
              </span>
              <span className="pt-tl__end" style={{ right: 0 }} aria-hidden="true">
                {X.D}′
              </span>
              {plan.hasNow && (
                <>
                  <span className="pt-tl__now" style={{ left: plan.nowL + "%" }} aria-hidden="true" />
                  <span className="pt-tl__nowT" style={{ left: plan.nowL + "%" }} aria-hidden="true">
                    {X.now}′
                  </span>
                </>
              )}
              {plan.marks.map((k) =>
                plan.btns ? (
                  <button key={k.id} type="button" className={`pt-tl__m ${k.cls}`} style={{ left: k.l + "%" }} aria-pressed={k.on} aria-label={k.aria} onClick={() => set({ focus: X.ui.focus === k.min ? null : k.min })}>
                    {k.t}
                  </button>
                ) : (
                  <span key={k.id} className={`pt-tl__m ${k.cls}`} style={{ left: k.l + "%" }} role="img" aria-label={k.aria}>
                    {k.done && <Ic n="check" />}
                    {k.t}
                  </span>
                ),
              )}
            </div>
            <ul className="pt-tandas">
              {plan.rows.map((r) => (
                <li key={r.id}>
                  {plan.btns ? (
                    <button type="button" className="pt-tanda" aria-pressed={r.on} aria-label={r.aria} onClick={() => set({ focus: X.ui.focus === r.min ? null : r.min })}>
                      <b>{r.minT}</b>
                      <span className="pt-tx">
                        <strong>{r.t}</strong>
                        <small>{r.s}</small>
                      </span>
                      <Pair out={r.out} inn={r.in} />
                    </button>
                  ) : (
                    <div className="pt-tanda">
                      <b>{r.minT}</b>
                      <span className="pt-tx">
                        <strong>{r.t}</strong>
                        <small>{r.s}</small>
                      </span>
                      <span className={`pz-chip ${r.chipCls}`}>
                        <Ic n={r.chipIcon} />
                        {r.chip}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {plan.focusT && (
              <p className="pz-meta pt-focus">
                {plan.focusT}
                <button type="button" className="nx-lnk" onClick={() => set({ focus: null })}>
                  Ver el siete del pitido
                </button>
              </p>
            )}
          </>
        )}
        {plan.empty && (
          <div className="pz-empty">
            <h3>{plan.emptyT}</h3>
            <p>{plan.emptyS}</p>
            {plan.emptyGo && (
              <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.nav("/pizarra/siete")}>
                <Ic n="shirt" />
                Ir al siete
              </button>
            )}
          </div>
        )}
        {"title" in plan && plan.tools && (
          <>
            <div className="pz-acts">
              <button type="button" className="vd-glass vd-press pz-btn" onClick={() => propose(P)} aria-keyshortcuts="M">
                <Ic n="users" />
                Repartir minutos
              </button>
            </div>
            <button type="button" className="vx-tog" aria-pressed={X.ui.rotar} onClick={() => set({ rotar: !X.ui.rotar, prop: null })} disabled={plan.rotarOff}>
              <span className="vx-tog__t" aria-hidden="true" />
              {plan.rotarT}
            </button>
          </>
        )}
      </section>,
    );
  if (mins)
    blocks.push(
      <section className="pz-sec" aria-labelledby="pt-min-h" key="mins">
        <div className="pz-sec__h">
          <h2 id="pt-min-h">{mins.title}</h2>
          <p>{mins.meta}</p>
        </div>
        <p className="pt-legend">
          {mins.legend.map((l) => (
            <span key={l.cls}>
              <i className={l.cls} aria-hidden="true" />
              {l.t}
            </span>
          ))}
        </p>
        <ul className="pt-mins">
          {mins.rows.map((r) => (
            <li key={r.pid} aria-label={r.aria}>
              <PtShirt pid={r.pid} />
              <span className="pt-n">
                {r.name}
                <small>{r.sub}</small>
              </span>
              <Bar segs={r.segs} nowL={r.hasNow ? r.nowL : null} />
              <span className="pt-v">
                {r.v}
                <small>{r.w}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>,
    );
  if (gal.length)
    blocks.push(
      <section className="pz-sec" aria-labelledby="pt-gal-h" key="gal">
        <div className="pz-sec__h">
          <h2 id="pt-gal-h">Galones ahora</h2>
          <p>El primero de cada lista que esté en el campo</p>
        </div>
        <ul className="pt-qd">
          {gal.map((g) => (
            <li key={g.k}>
              <span className="vx-tile pt-gal">{g.k}</span>
              <span>
                <b>{g.who}</b>
                <small>{g.t}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>,
    );
  return <>{blocks}</>;
}

function Ring({ nx, small = false }: { nx: NonNullable<ReturnType<typeof nextOf>>; small?: boolean }) {
  return (
    <span className={`pt-cd${nx.due ? " is-due" : ""}${small ? " is-sm" : ""}`} role="img" aria-label={nx.cdAria}>
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle className="bg" cx="40" cy="40" r="34" />
        <circle className="fg" cx="40" cy="40" r="34" strokeDasharray="213.6" strokeDashoffset={nx.off} />
      </svg>
      <span>
        <small>{nx.cdK}</small>
        <b>{nx.cdV}</b>
      </span>
    </span>
  );
}

// ───────────────────────────── PEEK: the clock on top, the next change at the thumb ─────────────────────────────
function Peek({ X }: { X: PtModel }) {
  const P = usePz();
  const ph = X.ph;
  const M = X.M;
  const nx = ph === "juego" ? nextOf(P, X) : null;
  const pri = primaryOf(P);
  const canChange = X.decide && !X.ro && (ph === "juego" || ph === "descanso");
  let t = "";
  let s = "";
  if (!M) t = "Sin partido a la vista";
  else if (ph === "antes") {
    const A = antesOf(P, X);
    t = A.head;
    s = X.feed.quedada ? "Quedada " + fmt.hm(X.feed.quedada.at) + " · " + X.feed.quedada.where + (X.feed.weather ? " · " + X.feed.weather.t + "°" : "") : A.line;
  } else if (ph === "juego") {
    if (nx) {
      t = nx.t;
      s = nx.s + (X.next?.urgent ? " · no puede seguir" : X.next?.cond ? " · el plan" : "");
    } else {
      t = "Sin más cambios";
      s = "El plan de minutos, cumplido";
    }
  } else if (ph === "descanso") {
    const De = descOf(P, X);
    t = De?.head ?? "Descanso";
    s = De?.pairs.map((r) => r.t).join(" · ") || De?.sub || "";
  } else if (ph === "despues" && X.L) {
    t = scoreboardOf(P, X).line.split(" · ")[0];
    s = despOf(P, X)?.meta ?? "";
  }
  const asking = ph === "juego" && X.ui.confirm === "next" && !!nx;
  if (asking && nx) {
    t = "¿Lo apuntamos en el acta?";
    s = nx.t + " " + nx.s + " · " + X.now + "′";
  }
  const asking2 = ph === "descanso" && X.ui.confirm === "desc";
  const showBtn = !!pri && !asking && !asking2 && !(ph === "juego" && !canChange);
  const ring = !!nx && !asking;
  const L = X.L;
  // (live, the clock and the score are in the header's badge: the peek keeps its room for the change)
  const sb = L && ph === "despues" ? scoreboardOf(P, X) : null;
  return (
    <div className="pt-peek">
      {sb && (
        <p className="pt-peek__clock" role="status">
          {ph === "juego" && (
            <span className="pt-live">
              <i aria-hidden="true" />
            </span>
          )}
          <b>{sb.min}</b>
          <span>
            {sb.part} · Piti {L!.gf}–{L!.ga} {M!.rival}
          </span>
        </p>
      )}
      <div className={`pt-peek__row ${ring ? "is-ring" : "no-ring"}`}>
        {ring && nx && <Ring nx={nx} small />}
        <div>
          <h1>{t}</h1>
          <p>{s}</p>
        </div>
        {showBtn && !ring && pri && (
          <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={pri.run} disabled={pri.disabled}>
            <Ic n={pri.icon ?? "arrow"} />
            {pri.short ?? pri.label}
          </button>
        )}
      </div>
      {showBtn && ring && pri && (
        <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri pt-peek__go" onClick={pri.run} disabled={pri.disabled} aria-keyshortcuts="H">
          <Ic n={pri.icon ?? "swap"} />
          {pri.short ?? pri.label}
          <kbd aria-hidden="true">H</kbd>
        </button>
      )}
      {(asking || asking2) && (
        <div className="pz-acts pt-peek__ask" role="group" aria-label={asking ? nx!.ask : "¿Apuntar la 2ª parte?"}>
          <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => void (asking ? doNext(P) : doDesc(P))} disabled={X.ui.busy}>
            <Ic n="check" />
            {X.ui.busy ? "Apuntando…" : "Sí, apuntar"}
          </button>
          <button type="button" className="vd-glass vd-press pz-btn" onClick={() => setUi(P, { confirm: "" })}>
            No
          </button>
        </div>
      )}
    </div>
  );
}

export function Partido({ region, layout }: RegionProps) {
  const P = usePz();
  const X = model(P);
  const leads = region === "lead" || region === "peek" || region === "panel";
  if (region === "peek")
    return (
      <>
        <PtFeedBridge />
        <Leader X={X} />
        <Peek X={X} />
      </>
    );
  const phone = layout === "phone";
  const flow = phone || layout === "tablet" || region === "panel";
  // on the tablet the two regions stack (lead, then side): during the match the next change goes first
  const swap = layout === "tablet" && (X.ph === "juego" || X.ph === "descanso");
  const showLead = region === (swap ? "side" : "lead") || region === "panel";
  const showSide = region === (swap ? "lead" : "side") || region === "panel";
  const sideFirst = region === "panel" && (X.ph === "juego" || X.ph === "descanso");
  const cls = ["pt", flow ? "is-flow" : "", phone ? "is-phone" : "", sideFirst ? "is-sidefirst" : ""].filter(Boolean).join(" ");
  const wrap = (k: string, body: ReactNode) =>
    flow ? (
      <div className={`pt-${k}w`}>{body}</div>
    ) : (
      <div className={`pz-region pt-${k}w`}>
        <div className="pz-region__scroll">{body}</div>
      </div>
    );
  return (
    <div className={cls} data-pz-place="partido">
      {leads && <PtFeedBridge />}
      {leads && <Leader X={X} />}
      {showLead && wrap("lead", <Lead X={X} />)}
      {showSide && wrap("side", <Side X={X} />)}
    </div>
  );
}
