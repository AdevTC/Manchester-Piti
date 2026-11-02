// r14 «La pizarra» · Jugadas (PiJugadas.dc.html): the library (Del equipo · Tuyas, minis that move on hover), a play
// as a video editor (the step as the second headline; the side: the transport, the timeline of steps — drag to
// reorder, Antes/Después —, speed and what the pitch shows, remembered on this device) and Editar (the pitch is the
// canvas: the Dibujar dock's layer, see Dibujar.tsx). Regions: lead · side (desktop, tablet in flow) · peek · panel.
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { usePz } from "../../store/context";
import type { PzApi } from "../../store/api";
import type { Layout, RegionProps } from "../../store/types";
import { PiCampo } from "../../campo/PiCampo";
import { fmt } from "../../store/fmt";
import { CampoShirt, PzIcon } from "../../campo/Shirt";
import {
  KIND_T,
  MAX_OWN,
  MAX_RIV,
  MAX_STEPS,
  MIN_STEPS,
  RATES,
  TAKER_T,
  TYPES,
  actionY,
  addRivalAll,
  addStepEnd,
  atText,
  ballKind,
  clock,
  delStepAt,
  dist,
  dupStepAt,
  frameSpec,
  keyStep,
  matches,
  moveStepTo,
  parseAt,
  playSig,
  removeRivalAll,
  secs,
  straighten,
  totalDur,
  typeOf,
  videoError,
  type PjPlay,
  type PjStep,
} from "./jugadasView";
import {
  U,
  canEditPlay,
  canMake,
  cur,
  delPlay,
  dupPlay,
  editSteps,
  goStep,
  makeCopy,
  nameAt,
  newPlay,
  onRoute,
  own,
  pause,
  pjPrefs,
  rivalInfo,
  saveSteps,
  setMode,
  setPjPrefs,
  setUi,
  slotsNow,
  stepsOf,
  stopReplay,
  sync,
  takerOf,
  team,
  toggle,
} from "./engine";
import { Moment } from "./Moment";
import { KeepForSeason, SeasonPlays } from "./SeasonPlays";
import "../../../../../styles/pz/jugadas.css";

const reduced = () => {
  try {
    return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/** The one region that drives the place (the route, the stage, the keys): lead on desktop/tablet, the sheet on the phone. */
function useDriver(P: PzApi, drive: boolean) {
  const S = P.state;
  const routeKey = S.route.place === "jugadas" ? S.route.sub + "?" + JSON.stringify(S.route.q) : "";
  const ready = S.estado !== "cargando" && S.estado !== "error";
  const lineup = P.sel.board()?.lineup;
  const slotsKey = slotsNow(P)
    .map((s) => `${s.x},${s.y}${s.playerId ?? ""}`)
    .join(";");
  useEffect(() => {
    if (drive && ready) onRoute(P);
    // oxlint-disable-next-line react/exhaustive-deps -- P is a new facade per version: the route key says when to re-read the address
  }, [drive, routeKey, ready]);
  useEffect(() => {
    if (!drive || !ready) return;
    const u = U(P);
    if (!u.playing && !u.draft) sync(P);
    // oxlint-disable-next-line react/exhaustive-deps -- P is a new facade per version: these keys say when the stage changes
  }, [drive, lineup, slotsKey, S.layout, ready]);
  useEffect(() => {
    if (!drive) return;
    const offDraw = P.on("drawing", (d) => {
      const on = (d as { on?: boolean })?.on;
      if (!on && U(P).mode === "editar") {
        setUi(P, { mode: "ver", sel: [] });
        sync(P);
      }
    });
    const onKey = (e: KeyboardEvent) => {
      const St = P.state;
      if (St.route.place !== "jugadas" || St.sheet || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const pj = cur(P);
      if (!pj) return;
      const k = e.key;
      if (k === " " || k === "Spacebar") {
        if (tag === "BUTTON" || tag === "A") return;
        e.preventDefault();
        toggle(P);
        return;
      }
      if (t?.closest?.("[data-pd-keys]")) return;
      if (k === "ArrowLeft") {
        e.preventDefault();
        goStep(P, U(P).step - 1);
      } else if (k === "ArrowRight") {
        e.preventDefault();
        goStep(P, U(P).step + 1);
      } else if (k === "Home") {
        e.preventDefault();
        goStep(P, 0);
      } else if (k === "End") {
        e.preventDefault();
        goStep(P, pj.steps.length - 1);
      } else if (k === "Escape" && !St.drawing) {
        e.preventDefault();
        P.nav("/pizarra/jugadas");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      offDraw();
      window.removeEventListener("keydown", onKey);
      if (P.state.route.place !== "jugadas") {
        stopReplay(P);
        const u = U(P);
        if (u.playing || u.mode === "editar" || u.open) setUi(P, { playing: false, anim: null, mode: "ver", open: null, draft: null, sel: [] });
      }
    };
    // oxlint-disable-next-line react/exhaustive-deps -- P is a new facade per version: these keys say when the stage changes
  }, [drive]);
}

export function Jugadas({ region, layout }: RegionProps) {
  const P = usePz();
  const drive = region === "lead" || region === "peek" || region === "panel";
  useDriver(P, drive);
  const phone = layout === "phone";
  const flow = phone || layout === "tablet";
  const pj = cur(P);
  if (region === "peek") return <Peek layout={layout} />;
  if (region !== "lead" && region !== "side" && region !== "panel") return null;
  const lead = region === "lead" || region === "panel";
  const side = region === "side" || region === "panel";
  const body = (
    <>
      {lead && (pj ? <PlayLead key={pj.id} pj={pj} layout={layout} /> : <LibLead layout={layout} />)}
      {side && (pj ? <PlaySide pj={pj} /> : <LibSide layout={layout} />)}
    </>
  );
  if (flow)
    return (
      <div className={`pj is-flow${phone ? " is-phone" : ""}`} data-pz-place="jugadas">
        {body}
      </div>
    );
  return (
    <div className="pj pz-region" data-pz-place="jugadas">
      <div className="pz-region__scroll">{body}</div>
    </div>
  );
}

// ── the library ─────────────────────────────────────────────────────────────────────────────────────────
function LibLead({ layout }: { layout: Layout }) {
  const P = usePz();
  const u = U(P);
  const M = P.sel.match();
  const T0 = team(P);
  const O0 = own(P);
  const teamL = T0.filter((x) => matches(x, u.q, u.type));
  const total = T0.length + O0.length;
  const libLine = (O0.length ? `${T0.length} del equipo, hechas para tu siete, y ${O0.length} ${O0.length === 1 ? "tuya." : "tuyas."}` : `${T0.length} del equipo, hechas para tu siete.`) + (layout === "desktop" ? " Pasa por encima para verlas moverse." : " Tócalas para verlas moverse.");
  const types = TYPES.map(([id, t]) => {
    const n = [...T0, ...O0].filter((x) => id === "todas" || typeOf(x) === id).length;
    return { id, t, n };
  });
  return (
    <>
      <section className="pz-hero pj-hero" aria-labelledby="pj-h">
        <p className="pz-kick">{(M ? `J${M.j ?? "?"} · ${M.rival}` : "Sin partido") + " · Jugadas"}</p>
        <h1 className="pz-h1" id="pj-h">
          {total} {total === 1 ? "jugada" : "jugadas"}
        </h1>
        <p className="pz-line">{libLine}</p>
      </section>
      <div className="pj-find">
        <label className="vd-glass pj-search">
          <PzIcon name="search" />
          <span className="pz-vh">Buscar una jugada</span>
          <input type="search" placeholder="Buscar: córner, presión, salida…" value={u.q} onChange={(e) => setUi(P, { q: e.target.value })} />
        </label>
        <div className="vd-glass pj-types" role="group" aria-label="Tipo de jugada">
          {types.map((t) => (
            <button key={t.id} type="button" aria-pressed={u.type === t.id} aria-label={`${t.t}, ${t.n}`} onClick={() => setUi(P, { type: t.id })}>
              {t.t}
              <small>{t.n}</small>
            </button>
          ))}
        </div>
      </div>
      <section className="pz-sec pj-sec0" aria-labelledby="pj-team">
        <div className="pz-sec__h">
          <h2 id="pj-team">Del equipo</h2>
          <p>{teamL.length === T0.length ? `Hechas para tu siete · ${T0.length}` : `${teamL.length} de ${T0.length}`}</p>
        </div>
        {teamL.length > 0 ? (
          <ul className="pj-cards">
            {teamL.map((x) => (
              <li key={x.id}>
                <Card pj={x} layout={layout} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="pz-meta" role="status">
            {T0.length ? `Ninguna del equipo${u.q ? ` con «${u.q}»` : ""}${u.type !== "todas" ? " en este tipo" : ""}.` : "Coloca el siete para ver las del equipo."}
          </p>
        )}
      </section>
    </>
  );
}

function LibSide({ layout }: { layout: Layout }) {
  const P = usePz();
  const u = U(P);
  const b = P.sel.board();
  const m = P.sel.me();
  const mk = canMake(P);
  const O0 = own(P);
  const ownL = O0.filter((x) => matches(x, u.q, u.type));
  const noOwnT = O0.length ? "Ninguna tuya con ese filtro" : m.socia ? "Las tuyas, cuando tengas ficha" : !b ? "Sin tablero todavía" : "Aún no tienes jugadas tuyas";
  const noOwnP = O0.length
    ? "Prueba con «Todas»."
    : m.socia
      ? "Las del equipo se miran igual: tócalas para verlas moverse."
      : !mk
        ? `En este tablero solo se mira. Duplícalo y tendrás las tuyas, hasta ${MAX_OWN}.`
        : P.sel.placed().length
          ? "Haz una desde tu siete, o copia una del equipo y cámbiala."
          : "Coloca a alguien en el siete y haz una desde ahí.";
  return (
    <>
      <section className="pz-sec pj-sec0 pj-own" aria-labelledby="pj-own">
        <div className="pz-sec__h">
          <h2 id="pj-own">Tuyas</h2>
          <p>{`${O0.length} de ${MAX_OWN}${b ? ` · en «${b.name}»` : ""}`}</p>
        </div>
        {mk && (
          <div className="pj-newrow">
            <button type="button" className="vd-glass vd-press pz-btn" onClick={() => newPlay(P)} disabled={O0.length >= MAX_OWN}>
              <PzIcon name="plus" />
              Nueva jugada
            </button>
            <button
              type="button"
              className="vd-glass vd-press pz-btn"
              onClick={() => {
                P.nav("/pizarra/siete?modo=dibujar");
                P.toast("Dibuja una carrera o un pase que salga de un jugador y pulsa «Jugada»");
              }}
            >
              <PzIcon name="pencil" />
              Desde un dibujo
            </button>
          </div>
        )}
        {ownL.length > 0 ? (
          <ul className="pj-cards">
            {ownL.map((x) => (
              <li key={x.id}>
                <Card pj={x} layout={layout} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="pj-empty">
            <b>{noOwnT}</b>
            <p>{noOwnP}</p>
          </div>
        )}
      </section>
      <SeasonPlays />
    </>
  );
}

/** A play's card: a cropped mini of its key step; on hover (or focus) it plays its steps and the stage previews it. */
function Card({ pj, layout }: { pj: PjPlay; layout: Layout }) {
  const P = usePz();
  const [hov, setHov] = useState(false);
  const [hk, setHk] = useState(0);
  const pvT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const steps = pj.steps;
  const n = steps.length;
  const key = keyStep(steps);
  const k = hov ? Math.min(n - 1, hk) : key;
  useEffect(() => {
    if (!hov || reduced() || n < 2) return;
    const t = setInterval(() => setHk((x) => (x + 1) % n), 950);
    return () => clearInterval(t);
  }, [hov, n]);
  useEffect(() => () => clearTimeout(pvT.current), []);
  const tk = takerOf(P, pj);
  const tag = tk ? `Lo tira ${P.sel.name(tk.pid)}` : pj.own ? "Tuya" : "";
  const kindT = pj.own ? (pj.kind !== "propia" ? `Tuya · de ${KIND_T[pj.kind].toLowerCase()}` : "Tuya") : KIND_T[pj.kind] || "Jugada";
  const u = U(P);
  const curr = u.preview === pj.id || (!u.preview && u.lastId === pj.id);
  const riv = rivalInfo(P);
  const on = () => {
    if (hov) return;
    setHov(true);
    setHk(0);
    clearTimeout(pvT.current);
    pvT.current = setTimeout(() => {
      if (U(P).preview !== pj.id) {
        setUi(P, { preview: pj.id });
        sync(P);
      }
    }, 160);
  };
  const off = () => {
    clearTimeout(pvT.current);
    setHov(false);
    setHk(0);
  };
  const show = frameSpec(steps, k, { o: { ghost: false, trails: true, ball: true }, rivals: true, ball: true, rivalName: riv.name, rivalCode: "" });
  return (
    <button
      type="button"
      className="vd-glass vd-press pj-card"
      aria-current={curr}
      onClick={() => P.nav(`/pizarra/jugadas/${pj.id}`)}
      onMouseEnter={layout === "desktop" ? on : undefined}
      onMouseLeave={layout === "desktop" ? off : undefined}
      onFocus={on}
      onBlur={off}
      aria-label={`${pj.name}. ${kindT}, ${n} pasos, ${secs(totalDur(steps))}${tag ? `. ${tag}` : ""}. Abrir`}
    >
      <span className="pj-thumb" style={{ ["--cy" as string]: String(actionY(steps, k)) }} aria-hidden="true">
        <span className="pj-thumb__in">
          <PiCampo layout={layout} mini show={show} camera="pizarra" />
        </span>
      </span>
      <span className="pj-card__t">
        <b>{pj.name}</b>
        <small>{`${kindT} · ${n} pasos · ${secs(totalDur(steps))}`}</small>
      </span>
      {tag && <span className={`pj-tag${tk ? " is-taker" : ""}`}>{tag}</span>}
    </button>
  );
}

// ── a play: the lead (its name, Ver · Editar, the step, the selection, how it reads, actions, the video) ─────
function PlayLead({ pj, layout }: { pj: PjPlay; layout: Layout }) {
  const P = usePz();
  const u = U(P);
  const b = P.sel.board();
  const m = P.sel.me();
  const mk = canMake(P);
  const steps = stepsOf(P, pj);
  const n = steps.length;
  const i = Math.max(0, Math.min(n - 1, u.step));
  const st = steps[i];
  const key = keyStep(steps);
  const editing = u.mode === "editar";
  const edPl = canEditPlay(P, pj);
  const tk = takerOf(P, pj);
  const riv = rivalInfo(P);
  const kick = pj.own ? "Tuya" : `Del equipo · ${KIND_T[pj.kind] || "jugada"} · para tu siete`;
  const line = `${n} pasos · ${secs(totalDur(steps))}` + (tk ? (tk.on ? ` · la tira ${P.sel.name(tk.pid)}, el de los ${TAKER_T[tk.k]}` : ` · ${P.sel.name(tk.pid)} no está en el siete: la tira quien ocupa su sitio`) : "");
  const roNoteT = m.socia ? "Solo lectura: las jugadas se miran; las crean los capitanes y los jugadores en sus tableros." : b?.isOfficial ? "Es el oficial: solo lectura. Duplícalo para tener tus jugadas." : `Solo lectura: este tablero es de @${b?.ownerNick ?? ""}. Duplícalo para editar.`;
  const prevS = i > 0 ? steps[i - 1] : null;
  const slots = slotsNow(P);
  const sel = u.sel.filter((id) => (id === "b" && st.b) || (id[0] === "m" && +id.slice(1) < 7) || (id[0] === "r" && +id.slice(1) < st.r.length));
  const missing = slots.filter((s) => !s.playerId);
  return (
    <>
      <button type="button" className="pj-back" onClick={() => P.nav("/pizarra/jugadas")} aria-keyshortcuts="Escape">
        <PzIcon name="chevL" />
        Las jugadas
      </button>
      <section className="pz-hero pj-hero" aria-labelledby="pj-hp">
        <p className="pz-kick">{kick}</p>
        <h1 className={`pz-h1${pj.name.length > 18 ? " is-long" : ""}`} id="pj-hp">
          {pj.name}
        </h1>
        <p className="pz-line">{line}</p>
      </section>
      <div className="vd-glass pj-seg" role="group" aria-label="Ver o editar la jugada">
        <button type="button" aria-pressed={!editing} onClick={() => setMode(P, "ver")}>
          <PzIcon name="eye" />
          Ver
        </button>
        <button type="button" aria-pressed={editing} onClick={() => setMode(P, "editar")} disabled={!mk}>
          <PzIcon name="edit" />
          Editar
        </button>
      </div>
      {!mk && <p className="pj-hint pj-ro">{roNoteT}</p>}
      {!pj.own && mk && (editing || u.copyHot) && (
        <section className="pz-sec" aria-labelledby="pj-copy">
          <div className={`pj-ask${u.copyHot ? " is-hot" : ""}`} role={u.copyHot ? "alert" : "note"}>
            <b id="pj-copy">Es del equipo</b>
            <p>La usamos todos y se rehace para cada siete. Para cambiarla, haz tu copia: la del equipo se queda como está.</p>
            <div className="pj-acts">
              <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => makeCopy(P)} disabled={own(P).length >= MAX_OWN}>
                <PzIcon name="copy" />
                Hacer mi copia
              </button>
              {editing && (
                <button type="button" className="nx-lnk" onClick={() => setMode(P, "ver")}>
                  Solo mirarla
                </button>
              )}
            </div>
          </div>
        </section>
      )}
      <StepText key={`${pj.id}:${i}`} pj={pj} steps={steps} i={i} write={editing && edPl} isKey={i === key} />
      {editing && (
        <section className="pz-sec" aria-labelledby="pj-sel">
          <div className="pz-sec__h">
            <h2 id="pj-sel">{sel.length > 1 ? `${sel.length} elegidas · se mueven juntas` : sel.length ? "Lo elegido" : "Lo que mueves"}</h2>
            <button
              type="button"
              className="vx-tog"
              aria-pressed={u.multi}
              onClick={() => {
                setUi(P, { multi: !u.multi });
                P.say(!u.multi ? "Varias a la vez: toca las fichas que quieras mover juntas" : "Una a una");
              }}
            >
              <span className="vx-tog__t" aria-hidden="true" />
              Varias a la vez
            </button>
          </div>
          {sel.slice(0, 4).map((id) => {
            if (id === "b")
              return (
                <div key={id} className="pj-selrow">
                  <span className="pj-ball" aria-hidden="true" />
                  <span className="pj-selrow__t">
                    <b>El balón</b>
                    <small>{prevS ? (ballKind(prevS, st) === "conduccion" ? "Llega en conducción" : "Llega en pase") : "Donde empieza la jugada"}</small>
                  </span>
                </div>
              );
            if (id[0] === "r") {
              const k = +id.slice(1);
              return (
                <div key={id} className="pj-selrow">
                  <span className="pj-disc" aria-hidden="true">
                    {riv.code}
                  </span>
                  <span className="pj-selrow__t">
                    <b>{`Rival ${k + 1} · ${riv.name}`}</b>
                    <small>Supr lo quita de toda la jugada</small>
                  </span>
                  {edPl && (
                    <button type="button" className="vd-glass vd-press pz-btn pj-danger" onClick={() => removeRival(P, pj, k)} aria-keyshortcuts="Delete">
                      Quitar
                    </button>
                  )}
                </div>
              );
            }
            const k = +id.slice(1);
            const s = slots[k];
            const moved = prevS && dist(prevS.p[k], st.p[k]) > 4;
            const curved = !!st.c["m" + k];
            return (
              <div key={id} className="pj-selrow">
                <span className="pz-shirt pj-selshirt" aria-hidden="true">
                  <CampoShirt still={P.sel.shirt(s?.playerId ?? null)} />
                </span>
                <span className="pj-selrow__t">
                  <b>{nameAt(P, k) + (s ? " · " + s.code : "")}</b>
                  <small>{!prevS ? "Donde empieza" : moved ? (curved ? "Carrera curva" : "Carrera recta · el asa del medio la curva") : "Quieto en este paso"}</small>
                </span>
                {edPl && curved && (
                  <button type="button" className="vd-glass vd-press pz-btn" onClick={() => saveSteps(P, pj, straighten(steps, i, k), `Carrera de ${nameAt(P, k)} enderezada`)}>
                    Enderezar
                  </button>
                )}
              </div>
            );
          })}
          {edPl && prevS && st.b && prevS.b && dist(prevS.b, st.b) > 3 && (sel.includes("b") || !sel.length) && (
            <div className="vd-glass pj-seg" role="group" aria-label="Cómo va el balón a este paso">
              {(
                [
                  ["pase", "Pase"],
                  ["conduccion", "Conducción"],
                ] as const
              ).map(([w, t]) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={ballKind(prevS, st) === w}
                  onClick={() => {
                    const next = steps.map((x, k2) => (k2 === i ? { ...x, bk: w } : x));
                    saveSteps(P, pj, next, `Balón en ${t.toLowerCase()}`);
                  }}
                >
                  {`Balón: ${t.toLowerCase()}`}
                </button>
              ))}
            </div>
          )}
          <p className="pj-hint">{!edPl ? "Toca una ficha: al moverla te pedirá hacer tu copia." : sel.length ? "Flechas: 2 % (Mayús, 10 %). Supr quita un rival. Esc suelta." : u.multi ? "Toca las fichas que quieras mover juntas y arrastra una." : "Toca una ficha para elegirla (con Mayús, varias) y arrástrala."}</p>
          <div className="pj-acts">
            <button type="button" className="vd-glass vd-press pz-btn" onClick={() => editSteps(P, "Rival añadido en todos los pasos", (s) => addRivalAll(s))} disabled={!edPl || st.r.length >= MAX_RIV}>
              <PzIcon name="plus" />
              {`Rival · ${st.r.length} de ${MAX_RIV}`}
            </button>
            {sel.length > 0 && (
              <button type="button" className="nx-lnk" onClick={() => setUi(P, { sel: [] })} aria-keyshortcuts="Escape">
                Soltar
              </button>
            )}
          </div>
        </section>
      )}
      {editing && missing.length > 0 && (
        <section className="pz-sec">
          <p className="pj-hint">{`Falta ${fmt.list(missing.map((s) => "el " + s.code))} en tu siete: su sitio lo hace una camiseta sin nombre hasta que lo pongas.`}</p>
        </section>
      )}
      <section className="pz-sec" aria-labelledby="pj-lg">
        <div className="pz-sec__h">
          <h2 id="pj-lg">Cómo se lee</h2>
        </div>
        <ul className="pj-legend">
          <li>
            <svg viewBox="0 0 46 18" aria-hidden="true">
              <path className="pj-lg k-carrera" d="M3 15 Q20 -2 43 9" />
            </svg>
            <b>Desmarque</b>
            <span>línea continua, curva si se curva</span>
          </li>
          <li>
            <svg viewBox="0 0 46 18" aria-hidden="true">
              <path className="pj-lg k-pase" d="M3 9 L43 9" />
            </svg>
            <b>Pase</b>
            <span>a rayas</span>
          </li>
          <li>
            <svg viewBox="0 0 46 18" aria-hidden="true">
              <path className="pj-lg k-cond" d="M3 9 L43 9" />
            </svg>
            <b>Conducción</b>
            <span>a puntos, el balón pegado</span>
          </li>
          <li>
            <svg viewBox="0 0 46 18" aria-hidden="true">
              <ellipse className="pj-lg k-ghost" cx="23" cy="9" rx="10" ry="6" />
            </svg>
            <b>Dónde estaba</b>
            <span>anillo del paso anterior</span>
          </li>
          <li>
            <svg viewBox="0 0 46 18" aria-hidden="true">
              <circle className="pj-lgriv" cx="23" cy="9" r="7" />
            </svg>
            <b>{riv.name === "Rival" ? "Rival" : `${riv.name} · rival`}</b>
            <span>disco con su dorsal</span>
          </li>
        </ul>
      </section>
      <PlayActions pj={pj} />
      <Video pj={pj} />
      <Moment pj={pj} layout={layout} />
    </>
  );
}

function removeRival(P: PzApi, pj: PjPlay, k: number) {
  const ok = saveSteps(P, pj, removeRivalAll(stepsOf(P, pj), k), "Rival quitado de la jugada", { long: true, rivalIds: pj.rivalIds.filter((_, j) => j !== k) });
  if (ok) setUi(P, { sel: [] });
}

/** The step: read (Ver) or written (Editar: title, what each one does). One undo step on leaving the field. */
function StepText({ pj, steps, i, write, isKey }: { pj: PjPlay; steps: PjStep[]; i: number; write: boolean; isKey: boolean }) {
  const P = usePz();
  const st = steps[i];
  const [title, setTitle] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [errT, setErrT] = useState(false);
  const commitTitle = () => {
    const v = (title ?? st.title).trim();
    if (v === st.title) {
      setTitle(null);
      setErrT(false);
      return;
    }
    if (!v || v.length > 40) {
      setErrT(true);
      return;
    }
    const next = steps.map((x, k) => (k === i ? { ...x, title: v } : x));
    saveSteps(P, pj, next, `Título del paso: «${v}»`, { toast: false });
    P.say("Título guardado");
    setTitle(null);
    setErrT(false);
  };
  const commitNote = () => {
    const v = (note ?? st.note).slice(0, 140);
    if (v === st.note) {
      setNote(null);
      return;
    }
    const next = steps.map((x, k) => (k === i ? { ...x, note: v } : x));
    saveSteps(P, pj, next, `Nota del paso ${i + 1}`, { toast: false });
    P.say("Nota guardada");
    setNote(null);
  };
  const pauseNow = () => {
    if (U(P).playing) pause(P, true);
  };
  return (
    <section className="pz-sec" aria-labelledby="pj-step">
      <p className="pj-stepk" id="pj-step">
        {`Paso ${i + 1} de ${steps.length} · ${secs(st.dur)}${isKey ? " · paso clave" : ""}`}
      </p>
      {!write ? (
        <>
          <h2 className="pj-steph" aria-live="polite">
            {st.title}
          </h2>
          {st.note && <p className="pj-note">{st.note}</p>}
        </>
      ) : (
        <>
          <label className="pj-field">
            <span>Título del paso</span>
            <input
              type="text"
              className="vd-glass pj-in is-title"
              maxLength={44}
              value={title ?? st.title}
              onChange={(e) => {
                setTitle(e.target.value);
                setErrT(false);
              }}
              onBlur={commitTitle}
              onFocus={pauseNow}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setTitle(null);
                  setErrT(false);
                }
              }}
            />
          </label>
          {errT && (
            <p className="pj-err" role="alert">
              El título lleva entre 1 y 40 caracteres.
            </p>
          )}
          <label className="pj-field">
            <span>Qué hace cada uno</span>
            <textarea
              className="vd-glass pj-in"
              rows={2}
              maxLength={140}
              value={note ?? st.note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={commitNote}
              onFocus={pauseNow}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setNote(null);
                }
              }}
            />
          </label>
        </>
      )}
    </section>
  );
}

/** «Con esta jugada»: the charla, the video (Compartir), duplicate, delete (confirm in line, 12 s to undo), the name. */
function PlayActions({ pj }: { pj: PjPlay }) {
  const P = usePz();
  const u = U(P);
  const mk = canMake(P);
  const edPl = canEditPlay(P, pj);
  const editing = u.mode === "editar";
  const [name, setName] = useState<string | null>(null);
  const [errN, setErrN] = useState(false);
  const pr = pjPrefs();
  const commitName = () => {
    const v = (name ?? pj.name).trim();
    if (v === pj.name) {
      setName(null);
      setErrN(false);
      return;
    }
    if (!v || v.length > 40) {
      setErrN(true);
      return;
    }
    saveSteps(P, pj, stepsOf(P, pj), `Nombre: «${v}»`, { name: v });
    setName(null);
    setErrN(false);
  };
  return (
    <section className="pz-sec" aria-labelledby="pj-with">
      <div className="pz-sec__h">
        <h2 id="pj-with">Con esta jugada</h2>
      </div>
      <div className="pj-acts">
        <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.nav(`/pizarra/charla?jugada=${encodeURIComponent(pj.id)}`)}>
          <PzIcon name="mic" />
          Verla en la charla
        </button>
        <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.openSheet("compartir", { tab: "video", jugada: pj.id, rate: pr.rate, sig: playSig(pj, pr.rate) }, { title: "Compartir", kicker: pj.name })}>
          <PzIcon name="share" />
          Mandarla en vídeo
        </button>
        {mk && (
          <button type="button" className="vd-glass vd-press pz-btn" onClick={() => dupPlay(P)} disabled={own(P).length >= MAX_OWN}>
            <PzIcon name="copy" />
            {pj.own ? "Duplicar" : "Hacer mi copia"}
          </button>
        )}
        {edPl && (
          <button type="button" className="vd-glass vd-press pz-btn pj-danger" onClick={() => setUi(P, { confirmDel: true })}>
            <PzIcon name="trash" />
            Borrar
          </button>
        )}
      </div>
      {edPl && <KeepForSeason pj={pj} />}
      {u.confirmDel && edPl && (
        <div
          className="pj-ask is-bad"
          role="alertdialog"
          aria-labelledby="pj-del"
          onKeyDown={(e: ReactKeyboardEvent) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setUi(P, { confirmDel: false });
            }
          }}
        >
          <b id="pj-del">{`¿Borrar «${pj.name}»?`}</b>
          <p>Se quita de este tablero con todos sus pasos. Tendrás 12 segundos para deshacerlo.</p>
          <div className="pj-acts">
            <button type="button" className="vd-glass vd-press pz-btn pj-danger" onClick={() => delPlay(P)}>
              Borrar la jugada
            </button>
            <button type="button" className="nx-lnk" onClick={() => setUi(P, { confirmDel: false })}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {editing && edPl && (
        <>
          <label className="pj-field">
            <span>Nombre de la jugada</span>
            <input
              type="text"
              className="vd-glass pj-in"
              maxLength={50}
              value={name ?? pj.name}
              onChange={(e) => {
                setName(e.target.value);
                setErrN(false);
              }}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setName(null);
                  setErrN(false);
                }
              }}
            />
          </label>
          {errN && (
            <p className="pj-err" role="alert">
              El nombre lleva entre 1 y 40 caracteres.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** The video of the play (JUG-49): a link that opens elsewhere, at its minute. */
function Video({ pj }: { pj: PjPlay }) {
  const P = usePz();
  const u = U(P);
  const edPl = canEditPlay(P, pj);
  const vid = pj.play.video ?? null;
  const vf = u.vid;
  const host = vid ? (/^https:\/\/([^/]+)/.exec(vid.url)?.[1] ?? "enlace").replace(/^www\./, "") : "";
  const at = vid ? atText(vid.at) : "";
  const save = () => {
    if (!vf) return;
    const err = videoError(vf.url, vf.at);
    if (err) {
      setUi(P, { vid: { ...vf, err } });
      return;
    }
    const sec = parseAt(vf.at) ?? 0;
    setUi(P, { vid: null });
    saveSteps(P, pj, stepsOf(P, pj), `Vídeo enlazado a la jugada${vf.at.trim() ? ` (${vf.at.trim()})` : ""}`, { video: { url: vf.url.trim(), at: sec } });
  };
  return (
    <section className="pz-sec" aria-labelledby="pj-vid">
      <div className="pz-sec__h">
        <h2 id="pj-vid">El vídeo</h2>
        {vid && !vf && <p>{host}</p>}
      </div>
      {vid && !vf && (
        <div className="pj-acts">
          <a className="vd-glass vd-press pz-btn" href={vid.url} target="_blank" rel="noopener noreferrer" aria-label={`Ver en vídeo${at ? ` desde ${at}` : ""}, en ${host}. Se abre en otra pestaña`}>
            <PzIcon name="play" />
            {`Ver en vídeo${at ? ` (${at})` : ""}`}
          </a>
          {edPl && (
            <>
              <button type="button" className="nx-lnk" onClick={() => setUi(P, { vid: { url: vid.url, at, err: "" } })}>
                Cambiar
              </button>
              <button type="button" className="nx-lnk" onClick={() => saveSteps(P, pj, stepsOf(P, pj), "Vídeo quitado de la jugada", { video: null })}>
                Quitar
              </button>
            </>
          )}
        </div>
      )}
      {!vid && !vf && edPl && (
        <div className="pj-acts">
          <button type="button" className="vd-glass vd-press pz-btn" onClick={() => setUi(P, { vid: { url: "", at: "", err: "" } })}>
            <PzIcon name="link" />
            Enlazar un vídeo
          </button>
        </div>
      )}
      {!vid && !vf && !edPl && <p className="pj-hint">{pj.own ? "Sin vídeo enlazado." : "Las del equipo no llevan vídeo: tu copia sí puede llevarlo."}</p>}
      {vf && (
        <div
          className="pj-field"
          onKeyDown={(e: ReactKeyboardEvent) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setUi(P, { vid: null });
            }
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
        >
          <label className="pj-field">
            <span>Enlace del vídeo (https)</span>
            <input type="url" className="vd-glass pj-in" maxLength={320} placeholder="https://youtu.be/…" value={vf.url} onChange={(e) => setUi(P, { vid: { ...vf, url: e.target.value, err: "" } })} />
          </label>
          <label className="pj-field">
            <span>Empieza en (min:seg)</span>
            <input type="text" className="vd-glass pj-in" maxLength={8} placeholder="12:34" value={vf.at} onChange={(e) => setUi(P, { vid: { ...vf, at: e.target.value, err: "" } })} />
          </label>
          {vf.err && (
            <p className="pj-err" role="alert">
              {vf.err}
            </p>
          )}
          <div className="pj-acts">
            <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={save}>
              Guardar el vídeo
            </button>
            <button type="button" className="nx-lnk" onClick={() => setUi(P, { vid: null })}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── a play: the side (the transport, the timeline, speed, what the pitch shows) ────────────────────────────
function PlaySide({ pj }: { pj: PjPlay }) {
  const P = usePz();
  const u = U(P);
  const steps = stepsOf(P, pj);
  const n = steps.length;
  const i = Math.max(0, Math.min(n - 1, u.step));
  const editing = u.mode === "editar";
  const edPl = canEditPlay(P, pj);
  const dur = totalDur(steps);
  const elapsed = steps.slice(0, i).reduce((s, x) => s + x.dur, 0) + (u.anim ? steps[u.anim.to].dur * u.anim.t : 0);
  const atEnd = i >= n - 1 && n > 1;
  const pr = pjPrefs();
  return (
    <>
      <section className="vd-glass pj-tr" aria-label="La repetición">
        <div className="pj-time">
          <span>{`Paso ${i + 1} de ${n}`}</span>
          <b>{`${clock(elapsed)} / ${clock(dur)}`}</b>
        </div>
        <div className="pj-tr__row">
          <button type="button" className="vd-glass vd-press nx-ib" onClick={() => goStep(P, i - 1)} disabled={i === 0} aria-label="Paso anterior" aria-keyshortcuts="ArrowLeft">
            <PzIcon name="chevL" />
          </button>
          <button type="button" className="vd-glass vd-press pj-play pz-btn--pri" onClick={() => toggle(P)} aria-keyshortcuts="Space" aria-label={u.playing ? "Pausar la repetición" : "Reproducir la jugada"}>
            <PzIcon name={u.playing ? "pause" : "play"} />
            {u.playing ? "Pausar" : atEnd ? "Otra vez" : "Reproducir"}
          </button>
          <button type="button" className="vd-glass vd-press nx-ib" onClick={() => goStep(P, i + 1)} disabled={i >= n - 1} aria-label="Paso siguiente" aria-keyshortcuts="ArrowRight">
            <PzIcon name="chevR" />
          </button>
        </div>
        <Track steps={steps} i={i} canDrag={editing && edPl} />
        {editing && (
          <>
            <div className="pj-stepacts" role="group" aria-label="Los pasos">
              <button type="button" className="vd-glass vd-press pz-btn" onClick={() => editSteps(P, `Paso ${n + 1} añadido: mueve las fichas`, addStepEnd, { goTo: (m) => m - 1 })} disabled={!edPl || n >= MAX_STEPS}>
                <PzIcon name="plus" />
                Paso al final
              </button>
              <button type="button" className="vd-glass vd-press pz-btn" onClick={() => editSteps(P, `Paso ${i + 1} duplicado detrás`, (s) => dupStepAt(s, i), { goTo: () => i + 1 })} disabled={!edPl || n >= MAX_STEPS}>
                <PzIcon name="copy" />
                Duplicar este
              </button>
              <span className="pj-stepacts__row">
                <button type="button" className="vd-glass vd-press pz-btn" onClick={() => editSteps(P, "Paso movido", (s) => moveStepTo(s, i, i - 1), { goTo: () => i - 1 })} disabled={!edPl || i === 0} aria-label="Mover este paso antes">
                  <PzIcon name="chevL" />
                  Antes
                </button>
                <button type="button" className="vd-glass vd-press pz-btn" onClick={() => editSteps(P, "Paso movido", (s) => moveStepTo(s, i, i + 1), { goTo: () => i + 1 })} disabled={!edPl || i >= n - 1} aria-label="Mover este paso después">
                  Después
                  <PzIcon name="chevR" />
                </button>
                <button type="button" className="vd-glass vd-press pz-btn pj-danger" onClick={() => editSteps(P, `Paso «${steps[i].title}» quitado`, (s) => delStepAt(s, i), { long: true, goTo: (m) => Math.min(i, m - 1) })} disabled={!edPl || n <= MIN_STEPS} aria-label="Quitar este paso">
                  <PzIcon name="trash" />
                  Quitar
                </button>
              </span>
            </div>
            <p className="pj-hint">{!edPl ? "Haz tu copia para añadir, mover o quitar pasos." : n >= MAX_STEPS ? "Ya tiene 8 pasos: el máximo." : "Arrastra una miniatura para cambiar el orden. Entre 2 y 8 pasos."}</p>
          </>
        )}
      </section>
      <section className="pz-sec pj-sec0" aria-labelledby="pj-spd">
        <div className="pz-sec__h">
          <h2 id="pj-spd">Velocidad</h2>
          <p>Se recuerda en este dispositivo</p>
        </div>
        <div className="vd-glass pj-seg" role="group" aria-label="Velocidad de la repetición">
          {RATES.map(([r, t]) => (
            <button
              key={r}
              type="button"
              aria-pressed={pr.rate === r}
              onClick={() => {
                setPjPrefs({ rate: r });
                P.say("Repetición a " + t);
                sync(P);
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </section>
      <section className="pz-sec" aria-labelledby="pj-opt">
        <div className="pz-sec__h">
          <h2 id="pj-opt">En el campo</h2>
        </div>
        <div className="pj-opts">
          {(
            [
              ["ghost", "Dónde estaba cada uno (calco)"],
              ["trails", "Las líneas del paso (estelas)"],
              ["rivals", "Los rivales"],
              ["ball", "El balón"],
              ["foco", "Acercar la cámara en el paso clave"],
            ] as const
          ).map(([k, t]) => (
            <button
              key={k}
              type="button"
              className="vx-tog"
              aria-pressed={!!pr[k]}
              disabled={editing && (k === "ghost" || k === "trails")}
              onClick={() => {
                setPjPrefs({ [k]: !pr[k] });
                sync(P);
              }}
            >
              <span className="vx-tog__t" aria-hidden="true" />
              <span>{t}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

/** The timeline: one mini per step (the key one says «Clave»), its length and progress. In Editar (own play) a mini
 *  drags to reorder (mouse and touch: a hold on touch so the strip still scrolls); Antes/Después do it by keyboard. */
function Track({ steps, i, canDrag }: { steps: PjStep[]; i: number; canDrag: boolean }) {
  const P = usePz();
  const u = U(P);
  const n = steps.length;
  const key = keyStep(steps);
  const riv = rivalInfo(P);
  const trackRef = useRef<HTMLOListElement | null>(null);
  const justDragged = useRef(0);
  const down = (e: ReactPointerEvent<HTMLButtonElement>, k: number) => {
    if (!canDrag || e.button > 0) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const touch = e.pointerType === "touch" || e.pointerType === "pen";
    let on = false;
    let held = false;
    const hold = touch
      ? setTimeout(() => {
          held = true;
          on = true;
          setUi(P, { dragFr: k });
          try {
            navigator.vibrate?.(12);
          } catch {
            /* no vibration */
          }
        }, 350)
      : undefined;
    const over = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      const li = el?.closest?.("[data-pj-fr]");
      return li && trackRef.current?.contains(li) ? Number(li.getAttribute("data-pj-fr")) : null;
    };
    const mv = (ev: PointerEvent) => {
      const far = Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 10;
      if (touch && !held) {
        if (far) cleanup();
        return;
      }
      if (!on && far) {
        on = true;
        setUi(P, { dragFr: k });
      }
      if (on) {
        ev.preventDefault();
        const o = over(ev.clientX, ev.clientY);
        if (o !== U(P).overFr) setUi(P, { overFr: o });
      }
    };
    const block = (ev: TouchEvent) => {
      if (held) ev.preventDefault();
    };
    const cleanup = () => {
      clearTimeout(hold);
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("touchmove", block);
    };
    const up = (ev: PointerEvent) => {
      cleanup();
      if (!on) return;
      const o = over(ev.clientX, ev.clientY);
      setUi(P, { dragFr: null, overFr: null });
      justDragged.current = Date.now() + 300;
      if (o != null && o !== k) editSteps(P, "Paso movido", (s) => moveStepTo(s, k, o), { goTo: () => o });
    };
    window.addEventListener("pointermove", mv, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("touchmove", block, { passive: false });
  };
  return (
    <ol className="pj-track" aria-label="Los pasos de la jugada" data-scroll-x="1" ref={trackRef}>
      {steps.map((s, k) => {
        const prog = u.anim && u.anim.to === k ? Math.round(u.anim.t * 100) : k <= i ? 100 : 0;
        const cls = [k === key ? "is-key" : "", u.dragFr === k ? "is-drag" : "", u.overFr === k && u.dragFr != null && u.dragFr !== k ? "is-over" : ""].filter(Boolean).join(" ");
        const show = frameSpec(steps, k, { o: { ghost: false, trails: true, ball: true }, rivals: true, ball: true, rivalName: riv.name, rivalCode: "" });
        return (
          <li key={k} className={`pj-fr${cls ? " " + cls : ""}`} aria-current={k === i ? "step" : undefined} data-pj-fr={k}>
            <button
              type="button"
              className="pj-fr__b"
              onClick={() => {
                if (Date.now() < justDragged.current) return;
                goStep(P, k);
              }}
              onPointerDown={(e) => down(e, k)}
              onContextMenu={(e) => canDrag && e.preventDefault()}
              aria-label={`Paso ${k + 1} de ${n}: ${s.title}, ${secs(s.dur)}${k === key ? ", paso clave" : ""}${k === i ? ", en el campo" : ""}`}
            >
              <span className="pj-fr__th" style={{ ["--cy" as string]: String(actionY(steps, k)) }} aria-hidden="true">
                <span className="pj-thumb__in">
                  <PiCampo layout={P.state.layout} mini show={show} camera="pizarra" />
                </span>
              </span>
              <span className="pj-fr__t">{s.title}</span>
            </button>
            <span className="pj-fr__d">
              <span>{secs(s.dur)}</span>
            </span>
            <i className="pj-fr__bar" aria-hidden="true">
              <i style={{ width: `${prog}%` }} />
            </i>
          </li>
        );
      })}
    </ol>
  );
}

// ── the phone's peek: play/pause, the name and the step, back to the library; the steps as chips ────────────
function Peek({ layout }: { layout: Layout }) {
  const P = usePz();
  const u = U(P);
  const pj = cur(P);
  if (pj) {
    const steps = stepsOf(P, pj);
    const n = steps.length;
    const i = Math.max(0, Math.min(n - 1, u.step));
    return (
      <div className="pj pj-peek is-phone" data-pz-place="jugadas" data-pz-layout={layout}>
        <div className="pj-ptop">
          <button type="button" className="vd-glass vd-press pj-pbtn pz-btn--pri" onClick={() => toggle(P)} aria-label={u.playing ? "Pausar la repetición" : "Reproducir la jugada"} aria-keyshortcuts="Space">
            <PzIcon name={u.playing ? "pause" : "play"} />
          </button>
          <div>
            <h1>{pj.name}</h1>
            <p aria-live="polite">{`${u.playing ? "Reproduciendo · " : ""}Paso ${i + 1} de ${n} · ${steps[i].title}`}</p>
          </div>
          <button type="button" className="vd-glass vd-press nx-ib" onClick={() => P.nav("/pizarra/jugadas")} aria-label="Volver a las jugadas">
            <PzIcon name="grid" />
          </button>
        </div>
        <Strip>
          {steps.map((s, k) => {
            const prog = u.anim && u.anim.to === k ? Math.round(u.anim.t * 100) : k <= i ? 100 : 0;
            return (
              <button key={k} type="button" className="vd-glass vd-press pj-chip" aria-current={k === i ? "step" : undefined} onClick={() => goStep(P, k)} aria-label={`Paso ${k + 1} de ${n}: ${s.title}`}>
                <b>{s.title}</b>
                <i aria-hidden="true">
                  <i style={{ width: `${prog}%` }} />
                </i>
              </button>
            );
          })}
        </Strip>
      </div>
    );
  }
  const T0 = team(P);
  const O0 = own(P);
  const total = T0.length + O0.length;
  return (
    <div className="pj pj-peek is-phone" data-pz-place="jugadas" data-pz-layout={layout}>
      <div className="pj-ptop is-lib">
        <div>
          <h1>
            {total} {total === 1 ? "jugada" : "jugadas"}
          </h1>
          <p>{`${T0.length} del equipo · ${O0.length} ${O0.length === 1 ? "tuya" : "tuyas"}`}</p>
        </div>
        {canMake(P) && (
          <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => newPlay(P)} disabled={O0.length >= MAX_OWN}>
            <PzIcon name="plus" />
            Nueva
          </button>
        )}
      </div>
      <Strip label="Las jugadas">
        {[...O0, ...T0].map((x) => (
          <button key={x.id} type="button" className="vd-glass vd-press pj-chip" aria-current={u.lastId === x.id} onClick={() => P.nav(`/pizarra/jugadas/${x.id}`)} aria-label={`${x.name}, abrir`}>
            <b>{x.name}</b>
            <small>{x.own ? "Tuya" : KIND_T[x.kind] || "Jugada"}</small>
          </button>
        ))}
      </Strip>
    </div>
  );
}
function Strip({ children, label = "Los pasos" }: { children: ReactNode; label?: string }) {
  return (
    <div className="pj-strip" role="group" aria-label={label} data-scroll-x="1">
      {children}
    </div>
  );
}
