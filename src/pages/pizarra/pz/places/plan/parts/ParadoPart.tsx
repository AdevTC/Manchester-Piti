// r14 · Plan › Pelotas paradas: for corners, free kicks and penalties, who takes it (the Siete's galón), who goes to
// the box / the rebound and the play it runs (replayed on the pitch). Saved with the board (plan.parado).
import { useEffect, useRef, type CSSProperties } from "react";
import { usePz } from "../../../store/context";
import type { PzApi } from "../../../store/api";
import type { Layout } from "../../../store/types";
import { PzIcon } from "../../../campo/Shirt";
import { fmt } from "../../../store/fmt";
import { PLAN_LIMITS } from "../../../../data/plan";
import { paradoGap, paradoOf, partsStatus, playById, setOk, withParado } from "../planPlace";
import { PARADO_KIND, PARADO_KINDS } from "../planView";
import { isLibraryPlay, usePlanPlays, usePlanUi } from "../planHooks";

/** His printed shirt (or his dorsal while it renders). */
export function PlanShirt({ P, pid, size }: { P: PzApi; pid: string; size?: number }) {
  const s = P.sel.shirt(pid);
  return (
    <span className="pz-shirt pp__shirt" style={size ? ({ "--s": size + "px" } as CSSProperties) : undefined} aria-hidden="true">
      {s.src ? <img src={s.src} alt="" draggable={false} /> : <b className="pp__shirtn">{s.num}</b>}
    </span>
  );
}

export function ParadoPart({ layout: _layout }: { layout: Layout }) {
  const P = usePz();
  const { u, setU } = usePlanUi(P);
  const plays = usePlanPlays(P);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(P);
  useEffect(() => {
    live.current = P;
  });
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => {
    const ui = () => live.current.slice<{ playing: boolean }>("planUi");
    if (ui().get()?.playing) ui().set({ playing: false }, { undoable: false });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (ui().get()?.playing) ui().set({ playing: false }, { undoable: false });
    };
  }, []);
  const b = P.sel.board();
  if (!b) return null;
  const L = b.lineup;
  const ro = !P.sel.canEdit(b);
  const kind = PARADO_KINDS.includes(u.kind) ? u.kind : "corners";
  const K = PARADO_KIND[kind];
  const pd = paradoOf(L);
  const v = P.sel.ver(b, "titular");
  const takers = L.takers?.[kind] ?? [];
  const onField = v ? v.slots.map((s) => s.playerId).filter((x): x is string => !!x) : [];
  const tk = v ? P.sel.taker(b, v, kind) : null;
  const rest = takers.filter((x) => x !== tk && onField.includes(x));
  const linked = kind !== "penalties" ? playById(plays, pd[kind].playId) : null;
  const boxMax = kind === "penalties" ? 2 : 4;
  const boxRaw = kind === "penalties" ? pd.penalties.rechace : pd[kind].box;
  const boxL = boxRaw.filter((x) => onField.includes(x) && x !== tk);
  const stay = onField.filter((x) => !boxL.includes(x) && x !== tk);
  const PS = partsStatus(P);
  const gap = paradoGap(P, b);
  const n = (id: string) => P.sel.name(id);
  /** «X.» without a second dot after a name that ends in one («ADRIÁN T.C.»). */
  const dot = (t: string) => (t.endsWith(".") ? t + " " : t + ". ");
  const save = (label: string, fn: Parameters<typeof withParado>[1]) => P.act.saveBoard(withParado(P.sel.board()?.lineup ?? L, fn), label);
  const playRun = () => {
    if (u.playing) {
      stop();
      setU({ playing: false });
      return;
    }
    if (!linked) return;
    stop();
    setU({ playing: true, showPlay: true, step: 0 });
    const steps = linked.frames;
    let i = 0;
    const tick = () => {
      i++;
      if (i >= steps.length) {
        timer.current = null;
        setU({ playing: false });
        return;
      }
      setU({ step: i });
      P.say(steps[i].title || "Paso " + (i + 1));
      timer.current = setTimeout(tick, 1900);
    };
    timer.current = setTimeout(tick, 1900);
  };
  const all = kind === "corners" ? "los córners" : kind === "freekicks" ? "las faltas" : "los penaltis";
  const f0 = linked?.frames[0];
  return (
    <>
      <div className="pp__ph">
        <p className="pz-kick">Pelotas paradas</p>
        <h2>{PS.st.parado ? K.t + (tk ? ": " + n(tk) : "") : (gap.length === 1 ? "Falta una cosa" : "Faltan " + gap.length + " cosas")}</h2>
        <p className="pz-line">{PS.st.parado ? "Quién la tira, quién va al área y la jugada, para las tres." : "Falta " + fmt.list(gap) + "."}</p>
      </div>
      <div className="vd-glass pp__seg" role="group" aria-label="Qué pelota parada">
        {PARADO_KINDS.map((k) => {
          const ok = setOk(P, b, k);
          return (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              aria-label={PARADO_KIND[k].t + (ok ? ", listo" : ", falta algo")}
              onClick={() => {
                stop();
                setU({ kind: k, step: 0, playing: false, showPlay: false, tkOpen: false });
              }}
            >
              <PzIcon name={ok ? "check" : "warn"} />
              {PARADO_KIND[k].t}
            </button>
          );
        })}
      </div>
      <section className="pz-sec pp__first" aria-labelledby="pp-tk">
        <div className="pz-sec__h">
          <h3 className="pp__h3" id="pp-tk">
            Quién la tira
          </h3>
          {!ro && (
            <button type="button" className="nx-lnk" onClick={() => setU({ tkOpen: !u.tkOpen })} aria-expanded={u.tkOpen}>
              {u.tkOpen ? "Listo" : "Cambiar"}
            </button>
          )}
        </div>
        <div className="pp__taker">
          {tk && <PlanShirt P={P} pid={tk} size={40} />}
          <span>
            <b>{tk ? n(tk) : "Nadie"}</b>
            <small>
              {tk ? (takers[0] && takers[0] !== tk ? n(takers[0]) + " es el primero, pero no está en el siete. " : "") + (rest.length ? dot("Si no está, " + fmt.list(rest.map(n))) : "") + "El mismo galón que en el Siete." : "Elige quién tira " + all + "."}
            </small>
          </span>
        </div>
        {u.tkOpen && !ro && (
          <div className="pp__seven" role="group" aria-label="Elige quién la tira primero">
            {onField.map((pid) => (
              <button key={pid} type="button" className="vd-glass vd-press pp__sv" aria-pressed={pid === tk} onClick={() => P.act.setRole(K.role, pid)} aria-label={n(pid) + (pid === tk ? ", la tira ahora. Quitarle el galón" : ", que la tire primero")}>
                <PlanShirt P={P} pid={pid} />
                <small>{n(pid)}</small>
              </button>
            ))}
          </div>
        )}
        {kind === "penalties" && tk && <p className="pp__note">En un penalti a favor, la mesa propone a {n(tk)}.</p>}
      </section>
      <section className="pz-sec" aria-labelledby="pp-box">
        <div className="pz-sec__h">
          <h3 className="pp__h3" id="pp-box">
            {kind === "penalties" ? "Al rechace" : "Al área"}
          </h3>
          <p>{boxL.length + " de " + boxMax}</p>
        </div>
        <div className="pp__seven" role="group" aria-label={kind === "penalties" ? "Al rechace" : "Al área"}>
          {onField.map((pid) => {
            const on = boxL.includes(pid);
            const off = ro || pid === tk || (!on && boxL.length >= boxMax);
            return (
              <button
                key={pid}
                type="button"
                className="vd-glass vd-press pp__sv"
                aria-pressed={on}
                disabled={off}
                aria-label={n(pid) + (pid === tk ? ", la tira" : on ? ", va. Quitarlo" : ", se queda. Mandarlo")}
                onClick={() =>
                  save(on ? n(pid) + " se queda atrás" : n(pid) + (kind === "penalties" ? " al rechace" : " al área"), (x) => {
                    const lim = kind === "penalties" ? PLAN_LIMITS.rechace : PLAN_LIMITS.box;
                    if (kind === "penalties") x.penalties.rechace = on ? x.penalties.rechace.filter((y) => y !== pid) : [...x.penalties.rechace, pid].slice(-lim);
                    else x[kind].box = on ? x[kind].box.filter((y) => y !== pid) : [...x[kind].box, pid].slice(-lim);
                  })
                }
              >
                <PlanShirt P={P} pid={pid} />
                <small>{n(pid)}</small>
              </button>
            );
          })}
        </div>
        <p className="pp__note">{boxL.length ? (dot((kind === "penalties" ? "Al rechace: " : "Van: ") + fmt.list(boxL.map(n))) + (stay.length ? dot("Se quedan: " + fmt.list(stay.map(n))) : "")).trim() : "Nadie todavía: toca sus camisetas."}</p>
      </section>
      {kind !== "penalties" && (
        <section className="pz-sec" aria-labelledby="pp-jg">
          <div className="pz-sec__h">
            <h3 className="pp__h3" id="pp-jg">
              La jugada
            </h3>
            {linked && <p>{fmt.plural(linked.frames.length, "paso", "pasos")}</p>}
          </div>
          {linked && f0 ? (
            <div className="pp__play">
              <span className="pz-mini pp__mini" aria-hidden="true">
                {Object.entries(f0.players).map(([id, q]) => (
                  <i key={id} style={{ left: q.x + "%", top: q.y + "%" }} />
                ))}
                {f0.rivals.map((r) => (
                  <i key={r.id} className="is-riv" style={{ left: r.x + "%", top: r.y + "%" }} />
                ))}
                <i className="is-ball" style={{ left: f0.ball.x + "%", top: f0.ball.y + "%" }} />
              </span>
              <div>
                <b>{linked.name}</b>
                <span className="pz-meta">{(isLibraryPlay(linked.id) ? "Del equipo" : "Del tablero") + " · en coral, el rival"}</span>
                <div className="pz-acts">
                  <button type="button" className="vd-glass vd-press pz-btn" onClick={playRun} aria-pressed={u.playing}>
                    <PzIcon name={u.playing ? "pause" : "play"} />
                    {u.playing ? "Pausa" : u.showPlay ? "Otra vez" : "Verla en el campo"}
                  </button>
                </div>
                {u.showPlay && (
                  <div className="pz-acts">
                    <button
                      type="button"
                      className="nx-lnk"
                      onClick={() => {
                        stop();
                        setU({ showPlay: false, playing: false, step: 0 });
                      }}
                    >
                      Volver a la colocación
                    </button>
                  </div>
                )}
                <div className="pz-acts">
                  {!isLibraryPlay(linked.id) && (
                    <button type="button" className="nx-lnk" onClick={() => P.nav("/pizarra/jugadas/" + linked.id)}>
                      Abrir en Jugadas
                    </button>
                  )}
                  {!ro && (
                    <button type="button" className="nx-lnk" onClick={() => P.act.openSheet("plan-jugada", { k: kind })}>
                      Cambiar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="pp__warns" role="note">
                <b>
                  <PzIcon name="warn" />
                  Sin jugada
                </b>
                <span>Sin jugada, cada uno hace lo que le parece. Elige una de Jugadas.</span>
              </div>
              {!ro && (
                <div className="pz-acts">
                  <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => P.act.openSheet("plan-jugada", { k: kind })}>
                    <PzIcon name="play" />
                    Elegir la jugada
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
