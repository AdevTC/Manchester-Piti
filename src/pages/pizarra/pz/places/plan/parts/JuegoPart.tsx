// r14 · Plan › Con balón · Sin balón · Fases: the style (preview on the pitch before applying it), the consignas
// painted on the grass, the shape without the ball (saved with the board) and the five phases (autoplay).
import { useEffect, useRef } from "react";
import { usePz } from "../../../store/context";
import type { Layout } from "../../../store/types";
import { PzIcon } from "../../../campo/Shirt";
import { FORMATION_NAMES, type Lineup } from "../../../../formations";
import { clearShapeOff, setOffFormation, shapeOffOf, shiftOffBlock, widenOff } from "../../../../v2/phases";
import { baseTokens, CON_KEYS, CONS, CONSIGNA, FASES, offShape, runWarnings, SIN_KEYS, styleMove } from "../planPlace";
import { PLAN_STYLES, planStyle } from "../planView";
import { usePlanUi } from "../planHooks";

export function JuegoPart({ layout: _layout }: { layout: Layout }) {
  const P = usePz();
  const { u, setU } = usePlanUi(P);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const live = useRef(P);
  useEffect(() => {
    live.current = P;
  });
  // a phase autoplay stops when the part is left (and a «Pausa» left over from before shows «Ver las cinco»)
  useEffect(() => {
    const ui = () => live.current.slice<{ fPlay: boolean }>("planUi");
    if (ui().get()?.fPlay) ui().set({ fPlay: false }, { undoable: false });
    return () => {
      stop();
      if (ui().get()?.fPlay) ui().set({ fPlay: false }, { undoable: false });
    };
  }, []);
  const b = P.sel.board();
  if (!b) return null;
  const L = b.lineup;
  const ro = !P.sel.canEdit(b);
  const v = P.sel.ver(b, "titular");
  const tac = L.tactics;
  const style = planStyle(L.style);
  const retocado = !!style && Object.entries(style.tac).some(([k, x]) => tac[k as keyof typeof tac] !== x);
  const base = baseTokens(P, b);
  const off = offShape(L, base);
  const prevSt = u.preview ? planStyle(u.preview) : null;
  const fase = Math.max(0, Math.min(FASES.length - 1, u.fase || 0));
  const save = (patch: Partial<Lineup>, label: string) => P.act.saveBoard(patch, label);
  const offSave = (next: Lineup, label: string) => {
    if (next === L) return;
    save({ shapeOff: next.shapeOff ?? null }, label);
  };
  const cur = () => P.sel.board()?.lineup ?? L;

  let prev: { t: string; chg: string[]; same: boolean } | null = null;
  if (prevSt) {
    const chg = Object.entries(prevSt.tac)
      .filter(([k, x]) => tac[k as keyof typeof tac] !== x)
      .map(([k, x]) => CONS[k].t + ": " + String(tac[k as keyof typeof tac] || "—").toLowerCase() + " → " + String(x).toLowerCase());
    const m2 = styleMove(base, prevSt.mv);
    const out = base.map((t, i) => ({ t, i })).filter((x) => x.t.line !== "POR");
    const dy = out.length ? out.reduce((s, x) => s + (m2[x.i].y - x.t.y), 0) / out.length : 0;
    const mv = Math.round(Math.abs(dy) * 0.6);
    chg.push(mv ? "El equipo se " + (dy < 0 ? "adelanta " : "echa atrás ") + mv + " m" + (prevSt.mv.w < 1 ? " · más cerrado" : prevSt.mv.w > 1 ? " · más abierto" : "") : "El bloque no se mueve");
    const same = L.style === prevSt.id && Object.entries(prevSt.tac).every(([k, x]) => tac[k as keyof typeof tac] === x);
    prev = { t: "Vista previa: " + prevSt.t, chg: same ? ["Ya jugáis así: no cambia nada"] : chg, same };
  }
  const consRow = (key: string) => {
    const c = CONS[key];
    const val = tac[key as keyof typeof tac] || c.v[1];
    const ph = CONSIGNA[key]?.[val] ?? [val, ""];
    return (
      <div className="pp__con" key={key}>
        <p>
          <b>{c.t}</b>
          <span>{ph[0]}</span>
        </p>
        <div className="vd-glass pp__seg" role="group" aria-label={c.t}>
          {c.v.map((o) => (
            <button key={o} type="button" aria-pressed={o === val} disabled={ro} onClick={() => o !== val && save({ tactics: { ...cur().tactics, [key]: o } }, c.t + ": " + o.toLowerCase())}>
              {o}
            </button>
          ))}
        </div>
        <p className="pp__note">{ph[1]}</p>
      </div>
    );
  };
  const runW = runWarnings(L, (id) => P.sel.name(id));
  const offCycle = (dir: 1 | -1) => () => {
    const f = shapeOffOf(L).formation;
    const i = FORMATION_NAMES.indexOf(f);
    const nx = FORMATION_NAMES[(i + dir + FORMATION_NAMES.length) % FORMATION_NAMES.length];
    offSave(setOffFormation(cur(), nx), "Sin balón: " + nx);
  };
  const fPlay = () => {
    if (u.fPlay) {
      stop();
      setU({ fPlay: false });
      return;
    }
    stop();
    setU({ fPlay: true, fase: 0 });
    let i = 0;
    const tick = () => {
      i++;
      if (i >= FASES.length) {
        timer.current = null;
        setU({ fPlay: false });
        return;
      }
      setU({ fase: i });
      P.say(FASES[i].t + ": " + FASES[i].s);
      timer.current = setTimeout(tick, 1700);
    };
    timer.current = setTimeout(tick, 1700);
  };
  const h = u.tab === "con" ? (prevSt ? prevSt.t + "?" : style ? style.t + (retocado ? " (retocado)" : "") : "Sin estilo") : u.tab === "sin" ? "Sin balón: " + off.formation : FASES[fase].t;
  const line = u.tab === "con" ? "Toca un estilo y míralo en el campo antes de aplicarlo." : u.tab === "sin" ? "Dónde se pone cada uno cuando la tienen ellos." : FASES[fase].s;
  return (
    <>
      <div className="pp__ph">
        <p className="pz-kick">Con balón · Sin balón · Fases</p>
        <h2>{h}</h2>
        <p className="pz-line">{line}</p>
      </div>
      <div className="vd-glass pp__seg" role="group" aria-label="Qué enseña el campo">
        {(
          [
            ["con", "Con balón"],
            ["sin", "Sin balón"],
            ["fases", "Fases"],
          ] as const
        ).map(([id, t]) => (
          <button
            key={id}
            type="button"
            aria-pressed={u.tab === id}
            onClick={() => {
              stop();
              setU({ tab: id, preview: null, fPlay: false });
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {v?.freeMode && (
        <p className="pp__note pp__pad">
          <b>Forma libre:</b> el plan no mueve a nadie; la salida y el foco sí se pintan.
        </p>
      )}

      {u.tab === "con" && (
        <>
          <section className="pz-sec pp__first" aria-labelledby="pp-est">
            <div className="pz-sec__h">
              <h3 className="pp__h3" id="pp-est">
                El estilo
              </h3>
              <p>{style ? "Ahora: " + style.t + (retocado ? " (retocado)" : "") : "Sin estilo"}</p>
            </div>
            {prevSt && prev && (
              <div className="pp__prev" role="region" aria-label="Vista previa del estilo">
                <b>{prev.t}</b>
                <ul className="pp__chg">
                  {prev.chg.map((c) => (
                    <li key={c}>
                      <PzIcon name="arrowR" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
                <div className="pp__pc">
                  <div>
                    <span>A favor</span>
                    {prevSt.pro}
                  </div>
                  <div>
                    <span>En contra</span>
                    {prevSt.con}
                  </div>
                </div>
                <div className="pz-acts">
                  {!ro && (
                    <button
                      type="button"
                      className="vd-glass vd-press pz-btn pz-btn--pri"
                      disabled={prev.same}
                      onClick={() => {
                        save({ style: prevSt.id, tactics: { ...cur().tactics, ...prevSt.tac } as Lineup["tactics"] }, "Estilo «" + prevSt.t + "» aplicado");
                        setU({ preview: null });
                      }}
                    >
                      <PzIcon name="check" />
                      {"Aplicar «" + prevSt.t + "»"}
                    </button>
                  )}
                  <button type="button" className="nx-lnk" onClick={() => setU({ preview: null })} aria-keyshortcuts="Escape">
                    Volver al plan
                  </button>
                </div>
                {ro && <p className="pp__note">Solo es una vista previa: el estilo lo cambia el capitán.</p>}
              </div>
            )}
            <div className="pp__styles" role="group" aria-label="Estilos: tócalo para verlo en el campo">
              {PLAN_STYLES.map((s) => {
                const isCur = L.style === s.id;
                return (
                  <button key={s.id} type="button" className="pp__style" aria-pressed={u.preview === s.id} onClick={() => setU({ preview: u.preview === s.id ? null : s.id })} aria-label={s.t + ": " + s.pro + ". En contra: " + s.con + (isCur ? ". Es el de ahora" : "") + ". Verlo en el campo"}>
                    <span className="pz-mini" aria-hidden="true">
                      {styleMove(base, s.mv).map((t) => (
                        <i key={t.id} style={{ left: t.x + "%", top: t.y + "%" }} />
                      ))}
                    </span>
                    <span>
                      <b>{s.t}</b>
                      <small>{s.pro + " · " + s.con.toLowerCase()}</small>
                    </span>
                    {isCur && (
                      <span className="pz-chip is-ok">
                        <PzIcon name="check" />
                        Ahora
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="pz-sec" aria-labelledby="pp-cb">
            <div className="pz-sec__h">
              <h3 className="pp__h3" id="pp-cb">
                Con el balón
              </h3>
              <p>Se pintan en el campo</p>
            </div>
            <div className="pp__cons">{CON_KEYS.map(consRow)}</div>
          </section>
        </>
      )}

      {u.tab === "sin" && (
        <>
          <section className="pz-sec pp__first" aria-labelledby="pp-sb">
            <div className="pz-sec__h">
              <h3 className="pp__h3" id="pp-sb">
                La forma sin balón
              </h3>
              <span className={`pz-chip ${off.own ? "is-ok" : "is-guest"}`}>
                <PzIcon name={off.own ? "check" : "spark"} />
                {off.own ? "La vuestra" : "Propuesta"}
              </span>
            </div>
            <p className="pp__note">{off.own ? "Guardada con el tablero. La charla y el cartel la enseñan." : "La calcula la pizarra desde tu siete: guárdala para que sea la vuestra."}</p>
            <div className="pp__sysrow">
              <span className="pz-meta">Sistema</span>
              <button type="button" className="vd-glass vd-press nx-ib" onClick={offCycle(-1)} disabled={ro} aria-label="Sistema sin balón anterior">
                <PzIcon name="chevL" />
              </button>
              <b>{off.formation}</b>
              <button type="button" className="vd-glass vd-press nx-ib" onClick={offCycle(1)} disabled={ro} aria-label="Sistema sin balón siguiente">
                <PzIcon name="chevR" />
              </button>
            </div>
            <div className="pp__opts">
              <button type="button" className="vd-glass vd-press pp__opt" disabled={ro} onClick={() => offSave(shiftOffBlock(cur(), 1), "Sin balón: el bloque baja")}>
                Más atrás
              </button>
              <button type="button" className="vd-glass vd-press pp__opt" disabled={ro} onClick={() => offSave(shiftOffBlock(cur(), -1), "Sin balón: el bloque sube")}>
                Más arriba
              </button>
              <button type="button" className="vd-glass vd-press pp__opt" disabled={ro} onClick={() => offSave(widenOff(cur(), -1), "Sin balón: más juntos")}>
                Más juntos
              </button>
              <button type="button" className="vd-glass vd-press pp__opt" disabled={ro} onClick={() => offSave(widenOff(cur(), 1), "Sin balón: más abiertos")}>
                Más abiertos
              </button>
            </div>
            {!ro && (
              <div className="pz-acts">
                {!off.own ? (
                  <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => save({ shapeOff: shapeOffOf(cur()) }, "Forma sin balón guardada")}>
                    <PzIcon name="check" />
                    Guardar esta forma
                  </button>
                ) : (
                  <button type="button" className="nx-lnk" onClick={() => offSave(clearShapeOff(cur()), "Sin balón: vuelve la propuesta")}>
                    Volver a la propuesta
                  </button>
                )}
              </div>
            )}
            {runW.length > 0 && (
              <div className="pp__warns" role="note">
                <b>
                  <PzIcon name="warn" />
                  Corren demasiado entre fases
                </b>
                {runW.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
            )}
          </section>
          <section className="pz-sec" aria-labelledby="pp-sbc">
            <div className="pz-sec__h">
              <h3 className="pp__h3" id="pp-sbc">
                Sin el balón
              </h3>
              {!ro && <p>La línea blanca también se arrastra en el campo</p>}
            </div>
            <div className="pp__cons">{SIN_KEYS.map(consRow)}</div>
          </section>
        </>
      )}

      {u.tab === "fases" && (
        <section className="pz-sec pp__first" aria-labelledby="pp-fa">
          <div className="pz-sec__h">
            <h3 className="pp__h3" id="pp-fa">
              Las fases
            </h3>
            <p>Salen de las consignas; no se guardan</p>
          </div>
          <div className="pp__fases" role="group" aria-label="Fases: toca una para verla en el campo">
            {FASES.map((f, i) => (
              <button
                key={f.id}
                type="button"
                className="pp__fase"
                aria-pressed={i === fase}
                onClick={() => {
                  stop();
                  setU({ fase: i, fPlay: false });
                }}
              >
                <i aria-hidden="true" />
                <span>
                  <b>{f.t}</b>
                  <small>{f.s}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="pz-acts">
            <button
              type="button"
              className="vd-glass vd-press nx-ib"
              onClick={() => {
                stop();
                setU({ fase: Math.max(0, fase - 1), fPlay: false });
              }}
              aria-label="Fase anterior"
              disabled={fase === 0}
            >
              <PzIcon name="chevL" />
            </button>
            <button type="button" className="vd-glass vd-press pz-btn" onClick={fPlay} aria-pressed={u.fPlay}>
              <PzIcon name={u.fPlay ? "pause" : "play"} />
              {u.fPlay ? "Pausa" : "Ver las cinco"}
            </button>
            <button
              type="button"
              className="vd-glass vd-press nx-ib"
              onClick={() => {
                stop();
                setU({ fase: Math.min(FASES.length - 1, fase + 1), fPlay: false });
              }}
              aria-label="Fase siguiente"
              disabled={fase === FASES.length - 1}
            >
              <PzIcon name="chevR" />
            </button>
          </div>
        </section>
      )}
    </>
  );
}
