// r14 «La pizarra» · Pachanga (PiPachanga.dc.html): the training's teams. Who came (from the training's «voy»,
// PZ-D09), two or three teams with bibs (word + pattern, never colour alone), the balance (media against media),
// tap-tap to swap, «Fijar», «Mezclar» (undoable, it glides), pairs, keepers by turns or fixed, the image for the
// group; saving who came counts as attendance. Regions: lead · side (desktop/tablet), peek · panel (phone).
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { usePz } from "../../store/context";
import type { PzApi } from "../../store/api";
import type { Layout, RegionProps } from "../../store/types";
import { PzIcon } from "../../campo/Shirt";
import { usePachangaSource, saveAttendance } from "../../../data/attendance";
import * as V from "./pachangaView";
import { handOf, pg, pgSlice, pgStage, seedFromTraining } from "./pgStore";
import { canSaveAttendance, dayWord, readLocalPg, srcSlice, writeLocalPg, type PgSource } from "./pgSource";
import { pgModel, type PgModel } from "./pgModel";
import "../../../../../styles/pz/pachanga.css";

/** A printed shirt in a list (the kit still, cropped like the prototype; a drawn one while it renders). */
export function PgShirt({ P, id, cls = "", size }: { P: PzApi; id: string; cls?: string; size?: number }) {
  const st = P.sel.shirt(id, { away: false });
  const style = size ? ({ "--s": size + "px" } as CSSProperties) : undefined;
  return (
    <span className={`pz-shirt${cls ? " " + cls : ""}`} style={style} aria-hidden="true">
      {st.src ? <img src={st.src} alt="" draggable={false} decoding="async" /> : <i className="pg-shirt0">{st.num}</i>}
    </span>
  );
}
export const Sw = ({ pat, cls = "" }: { pat: V.PgPat; cls?: string }) => <i className={`pg-sw p-${pat}${cls ? " " + cls : ""}`} aria-hidden="true" />;

// ── the owner: one per page (the lead region, or the phone's peek / panel): data, the pitch, the taps ──────────
function PgOwner({ layout }: { layout: Layout }) {
  const P = usePz();
  const s = usePachangaSource(P.state.W.now);
  const tr = s.training;
  const slot = tr?.confirmed ? tr.slots.find((x) => x.id === tr.confirmed?.slotId) : undefined;
  const next: PgSource = {
    loading: s.loading,
    trainingId: tr?.id ?? null,
    slotId: tr?.confirmed?.slotId ?? null,
    at: tr?.confirmed?.at ?? null,
    place: tr?.confirmed?.place || slot?.place || "",
    proposedBy: tr?.proposedBy ?? null,
    present: s.comes.present,
    guests: s.comes.guests,
    saved: s.attendance ? { present: s.attendance.present, guests: s.attendance.guests, at: s.attendance.at, by: s.attendance.by } : null,
  };
  const key = JSON.stringify(next);
  const ref = useRef(P);
  useEffect(() => {
    ref.current = P;
  });
  // the training's answers → the shared slice; once loaded, the starting «¿Quién ha venido?»
  useEffect(() => {
    const p = ref.current;
    const v = JSON.parse(key) as PgSource;
    srcSlice(p).set(v, { undoable: false, toast: false });
    if (v.loading) return;
    const st = pgSlice(p).get();
    if (st.seeded && st.trainingId === v.trainingId) return;
    const local = readLocalPg();
    if (local && local.trainingId === v.trainingId && local.seeded) {
      pgSlice(p).set(local, { undoable: false, toast: false });
      return;
    }
    if (v.saved) seedFromTraining(p, { trainingId: v.trainingId, present: v.saved.present, guests: v.saved.guests, saved: true });
    else seedFromTraining(p, { trainingId: v.trainingId, present: v.present, guests: v.guests, saved: false });
  }, [key]);
  // the pachanga stays on this device
  const st = pgSlice(P).get();
  const stKey = JSON.stringify(st);
  useEffect(() => {
    const v = JSON.parse(stKey) as V.PgState;
    if (v.seeded) writeLocalPg(v);
  }, [stKey]);
  // the pitch shows the teams (compared with what it shows: a board change or a route back redraws it)
  const spec = pgStage(P, layout);
  const specKey = JSON.stringify(spec);
  const cur = P.state.stage;
  const curKey = JSON.stringify({ source: cur.source, tokens: cur.tokens, labels: cur.labels, tappable: cur.tappable, overlay: cur.overlay, caption: cur.caption, glideMs: cur.glideMs });
  const want = JSON.stringify({ source: spec.source, tokens: spec.tokens, labels: spec.labels, tappable: spec.tappable, overlay: spec.overlay, caption: spec.caption, glideMs: spec.glideMs });
  useEffect(() => {
    if (curKey !== want) ref.current.act.setStage(JSON.parse(specKey));
  }, [curKey, want, specKey]);
  // a shirt tapped on the pitch: the same tap-tap as the lists
  useEffect(() => {
    const off = ref.current.on("token:tap", (e) => {
      const p = ref.current;
      if (p.state.route.place !== "pachanga" || !e || typeof e !== "object") return;
      const d = e as { id?: unknown; pid?: unknown };
      const id = typeof d.pid === "string" && d.pid ? d.pid : String(d.id ?? "").replace(/^pg-/, "");
      if (id) pg.tap(p, id);
    });
    // leaving the pachanga lets go of the player in the hand
    const offRoute = ref.current.on("route", (r) => {
      const p = ref.current;
      if ((r as { place?: unknown } | null)?.place !== "pachanga" && handOf(p)) pg.drop(p);
    });
    return () => {
      off();
      offRoute();
    };
  }, []);
  return null;
}

// ── lead: the state, the balance, the teams, the hand ─────────────────────────────────────────────────────────
function Balance({ m }: { m: PgModel }) {
  const t0 = m.teams[0];
  const t1 = m.teams[1];
  return (
    <div className="pg-bal" role="group" aria-label={m.balAria}>
      <div className="pg-bal__s">
        <b>{t0.media}</b>
        <span>
          <Sw pat={t0.pat} />
          {t0.name}
        </span>
      </div>
      <div className="pg-bal__m">
        <span className="pg-bal__track" aria-hidden="true">
          <i />
          <span className="pg-bal__dot" style={{ left: m.balPos + "%" }} />
        </span>
        <span className={`pz-chip ${m.bal.tone}`}>
          <PzIcon name={m.bal.icon} />
          {m.bal.word}
        </span>
      </div>
      <div className="pg-bal__s is-r">
        <b>{t1.media}</b>
        <span>
          {t1.name}
          <Sw pat={t1.pat} />
        </span>
      </div>
    </div>
  );
}

function Hand({ P, m }: { P: PzApi; m: PgModel }) {
  const id = m.hand;
  if (!id) return null;
  const pl = m.who(id);
  const locked = m.st.locked[id] != null;
  const tn = m.names[m.handTeam];
  return (
    <div className="vd-glass vd-glass--deep pg-hand" role="group" aria-label={`${pl.shirt} en la mano`}>
      <div className="pg-hand__t">
        <PgShirt P={P} id={id} size={26} />
        <span>
          <b>{pl.shirt} en la mano</b>
          <small>Toca a uno del otro equipo y se cambian</small>
        </span>
      </div>
      <div className="pg-hand__a">
        {m.names.map((nm, i) =>
          i === m.handTeam ? null : (
            <button key={i} type="button" className="vd-glass vd-press pz-btn" aria-label={`Pasar a ${pl.shirt} a ${nm}`} onClick={() => pg.move(P, id, i)}>
              <PzIcon name="arrowR" />A {m.n === 3 ? V.PG_SHORT[3][i] : nm}
            </button>
          ),
        )}
        <button type="button" className="vd-glass vd-press pz-btn" aria-pressed={locked} aria-label={locked ? `Quitar el fijo de ${pl.shirt}` : `Fijar a ${pl.shirt} en ${tn}: Mezclar no lo mueve`} onClick={() => pg.lock(P, id)}>
          <PzIcon name="lock" />
          {locked ? "Quitar fijo" : "Fijar"}
        </button>
        <button type="button" className="vd-glass vd-press nx-ib" aria-label="Soltar" aria-keyshortcuts="Escape" onClick={() => pg.drop(P)}>
          <PzIcon name="close" />
        </button>
      </div>
    </div>
  );
}

function Lead({ P, m, panel }: { P: PzApi; m: PgModel; panel: boolean }) {
  const mixCls = m.st.seed > 1 ? (m.st.seed % 2 ? "is-mixA" : "is-mixB") : "";
  return (
    <>
      <section className="pz-hero pg-hero" aria-labelledby="pg-h">
        <p className="pz-kick">{m.kicker}</p>
        <h1 className="pz-h1" id="pg-h">
          {m.head}
        </h1>
        <p className="pz-line">{m.line}</p>
      </section>
      {m.isReady ? (
        <>
          {m.n === 2 ? (
            <Balance m={m} />
          ) : (
            <div className="pg-three" role="group" aria-label={m.balAria}>
              {m.teams.map((t) => (
                <div className="pz-stat" key={t.t}>
                  <span className="pz-stat__v">{t.media}</span>
                  <span className="pz-stat__k">
                    <Sw pat={t.pat} />
                    {t.name}
                  </span>
                </div>
              ))}
              <span className={`pz-chip ${m.bal.tone}`}>
                <PzIcon name={m.bal.icon} />
                {m.bal.word}
              </span>
            </div>
          )}
          <div className={`pg-teams ${mixCls}`} key={m.st.seed}>
            {m.ordered.map((t) => (
              <section key={t.t} className={`pg-team${t.wait ? " is-wait" : ""}`} aria-labelledby={`pg-t${t.t}`}>
                <div className="pg-team__h">
                  <Sw pat={t.pat} />
                  <span>
                    <h2 id={`pg-t${t.t}`}>{t.name}</h2>
                    <small>{t.sub}</small>
                  </span>
                </div>
                <ul className="pg-list">
                  {t.rows.map((r) => (
                    <li key={r.id}>
                      <button type="button" className={`pg-p${r.target ? " is-target" : ""}`} style={{ "--k": r.k } as CSSProperties} aria-pressed={r.on} aria-label={r.aria} onClick={() => pg.tap(P, r.id)}>
                        <PgShirt P={P} id={r.id} cls={`pg-bib p-${r.pat}`} />
                        <span className="pg-p__t">
                          <b>{r.name}</b>
                          <small>{r.sub}</small>
                        </span>
                        <span className={`pg-p__n${r.noNota ? " is-med" : ""}`}>{r.media}</span>
                        {r.locked && <PzIcon name="lock" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <Hand P={P} m={m} />
          {m.st.unmet.length > 0 && (
            <div className="pg-warn" role="status">
              <b>No se ha podido cumplir</b>
              <span>{m.st.unmet.join(" · ")}. Mezcla otra vez o cambia la pareja.</span>
            </div>
          )}
          <div className="pz-acts pg-acts">
            {panel && (
              <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => pg.mezclar(P)}>
                <PzIcon name="swap" />
                Mezclar
              </button>
            )}
            <button type="button" className="vd-glass vd-press pz-btn" aria-label="Compartir los equipos" onClick={() => P.act.openSheet("pg-compartir")}>
              <PzIcon name="share" />
              Compartir
            </button>
            {m.st.gk === "turnos" && (
              <button type="button" className="vd-glass vd-press pz-btn" onClick={() => pg.nextGk(P)}>
                <PzIcon name="shield" />
                Siguiente portero
              </button>
            )}
            {m.n === 3 && (
              <button type="button" className="vd-glass vd-press pz-btn" onClick={() => pg.rotate(P)}>
                <PzIcon name="swap" />
                Entra {m.names[m.wait]}
              </button>
            )}
          </div>
          <p className="pg-note">{m.medNote}</p>
        </>
      ) : (
        <div className="pz-empty pg-empty">
          <div className="pz-acts">
            {m.quick
              .filter((q) => q.id !== "nadie" && (q.n ?? 0) > 0)
              .map((q, i) => (
                <button key={q.id} type="button" className={`vd-glass vd-press pz-btn${i === 0 ? " pz-btn--pri" : ""}`} onClick={() => pg.quick(P, q.id, q.ids)}>
                  <PzIcon name={i === 0 ? "check" : "users"} />
                  {q.t} · {q.n}
                </button>
              ))}
          </div>
          <p>{m.phone ? "O márcalos uno a uno en la lista de abajo." : m.st.comes.length ? "O márcalos uno a uno en la lista." : "O márcalos uno a uno en la lista de la derecha."}</p>
        </div>
      )}
    </>
  );
}

// ── side: who came, pairs, keepers, how many teams, where it is kept ─────────────────────────────────────────
function Side({ P, m }: { P: PzApi; m: PgModel }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const add = () => {
    if (!q.trim()) return;
    pg.guest(P, q);
    setQ("");
  };
  const canSave = canSaveAttendance(P, m.src);
  const squadIds = m.st.comes.filter((id) => !!P.sel.player(id) && !P.sel.player(id)?.guest);
  const guestNames = m.st.comes.filter((id) => !squadIds.includes(id)).map((id) => m.who(id).shirt);
  const savedSame = !!m.src.saved && m.src.saved.present.length === squadIds.length && squadIds.every((id) => m.src.saved?.present.includes(id)) && m.src.saved.guests.length === guestNames.length;
  const save = async () => {
    if (!m.src.trainingId || !m.src.slotId || busy) return;
    setBusy(true);
    try {
      await saveAttendance(m.src.trainingId, { slotId: m.src.slotId, present: squadIds, guests: guestNames, uid: P.sel.me().uid });
      P.toast(`Guardado: ${fmtPeople(squadIds.length + guestNames.length)} en el entreno. Cuenta como asistencia`, { icon: "check" });
    } catch (e) {
      P.toast(e instanceof Error && /Como mucho/.test(e.message) ? e.message : "No se ha podido guardar quién vino", { icon: "warn" });
    } finally {
      setBusy(false);
    }
  };
  const quickN = m.quick.length;
  return (
    <>
      <section className="pz-sec" aria-labelledby="pg-who">
        <div className="pz-sec__h">
          <h2 id="pg-who">¿Quién ha venido?</h2>
          <p>{m.st.comes.length ? fmtCame(m.st.comes.length) : "Nadie aún"}</p>
        </div>
        <p className="pg-src">{m.srcLine}</p>
        <div className="vd-glass pg-seg" style={{ "--n": quickN } as CSSProperties} role="group" aria-label="Marcar de golpe">
          {m.quick.map((x) => (
            <button key={x.id} type="button" aria-pressed={x.on} onClick={() => pg.quick(P, x.id, x.ids)}>
              {x.t}
              {x.n != null && <b>{x.n}</b>}
            </button>
          ))}
        </div>
        <ul className="pz-rows pg-att">
          {m.att.map((a) => (
            <li key={a.id}>
              <button type="button" className="pz-row" aria-pressed={a.on} aria-label={a.aria} onClick={() => pg.tick(P, a.id)}>
                <span className={`pg-check${a.on ? " is-on" : ""}`} aria-hidden="true">
                  <PzIcon name="check" />
                </span>
                <PgShirt P={P} id={a.id} cls={a.out && !a.on ? "is-off" : ""} />
                <span className="pz-row__t">
                  <b>{a.name}</b>
                  <span>{a.sub}</span>
                </span>
                <span className="pz-row__n">
                  <b>{a.media}</b>
                  <small>{a.k}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="pg-guest">
          <label className="vd-glass pg-input">
            <PzIcon name="user" />
            <span className="pz-vh">Nombre de alguien de fuera</span>
            <input
              type="text"
              placeholder="Alguien de fuera"
              maxLength={40}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
            />
          </label>
          <button type="button" className="vd-glass vd-press pz-btn" onClick={add} disabled={!q.trim()}>
            <PzIcon name="plus" />
            Añadir
          </button>
        </div>
      </section>

      <section className="pz-sec" aria-labelledby="pg-pairs">
        <div className="pz-sec__h">
          <h2 id="pg-pairs">Juntos o separados</h2>
          <p>{m.pairs.length ? `${m.pairs.length} de ${V.PAIRS_MAX}` : "Ninguna"}</p>
        </div>
        {m.pairs.length > 0 && (
          <ul className="pz-rows">
            {m.pairs.map((p) => (
              <li key={p.i} className="pz-row pg-pair">
                <span className="vx-tile" aria-hidden="true">
                  <PzIcon name={p.icon} />
                </span>
                <span className="pz-row__t">
                  <b>{p.t}</b>
                  <span>{p.s}</span>
                </span>
                <button type="button" className="vd-glass vd-press nx-ib" aria-label={p.delAria} onClick={() => pg.unpair(P, p.i)}>
                  <PzIcon name="trash" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="pz-acts">
          <button type="button" className="vd-glass vd-press pz-btn" disabled={m.pairs.length >= V.PAIRS_MAX || m.st.comes.length < 2} onClick={() => P.act.openSheet("pg-pareja")}>
            <PzIcon name="plus" />
            Añadir una pareja
          </button>
        </div>
      </section>

      <section className="pz-sec pg-gk" aria-labelledby="pg-gkh">
        <div className="pz-sec__h">
          <h2 id="pg-gkh">Porteros</h2>
          <p>{m.st.gk === "turnos" ? "Turnos de 10′" : "Uno por equipo"}</p>
        </div>
        <div className="vd-glass pg-seg" style={{ "--n": 2 } as CSSProperties} role="group" aria-label="Porteros">
          {(
            [
              ["turnos", "Por turnos"],
              ["fijos", "Fijos"],
            ] as const
          ).map(([k, t]) => (
            <button key={k} type="button" aria-pressed={m.st.gk === k} onClick={() => pg.setGk(P, k)}>
              {t}
            </button>
          ))}
        </div>
        {m.gkRows.length > 0 && (
          <ul className="pz-rows">
            {m.gkRows.map((g) => (
              <li key={g.t}>
                <button type="button" className="pz-row" aria-label={g.aria} onClick={() => (g.fijos ? P.act.openSheet("pg-portero", { t: g.t, nombre: m.names[g.t] }) : pg.nextGk(P))}>
                  <Sw pat={g.pat} />
                  <span className="pz-row__t">
                    <b>{g.title}</b>
                    <span>{g.s}</span>
                  </span>
                  <PzIcon name="chevR" className="pg-chev" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pz-sec" aria-labelledby="pg-nh">
        <div className="pz-sec__h">
          <h2 id="pg-nh">Equipos</h2>
          <p>{m.n === 3 ? "Dos juegan, uno espera" : "Uno contra otro"}</p>
        </div>
        <div className="vd-glass pg-seg" style={{ "--n": 2 } as CSSProperties} role="group" aria-label="Cuántos equipos">
          {([2, 3] as const).map((k) => (
            <button key={k} type="button" aria-pressed={m.n === k} disabled={k === 3 && m.st.comes.length < 6} onClick={() => pg.setN(P, k)}>
              {k} equipos
            </button>
          ))}
        </div>
        <p className="pz-meta">{m.n === 3 ? "Con 3, juegan dos y el tercero entra por el que lleva más tiempo." : m.st.comes.length < 6 ? "Con 6 o más se pueden hacer 3." : "Con 3, juegan dos y el tercero espera su turno."}</p>
      </section>

      <section className="pz-sec" aria-labelledby="pg-save">
        <div className="pz-sec__h">
          <h2 id="pg-save">Asistencia</h2>
          <p>{m.src.saved ? "Guardada" : "Sin guardar"}</p>
        </div>
        <p className="pz-meta">
          {m.src.trainingId
            ? m.src.saved
              ? `Guardado quién vino al entreno de ${dayWord(P, m.at)}: ${fmtPeople(m.src.saved.present.length + m.src.saved.guests.length)}, cuenta como asistencia.${savedSame ? "" : " Has cambiado la lista: guárdala otra vez."}`
              : canSave
                ? "Guárdalo y quien vino cuenta como asistencia al entreno."
                : "Lo guarda quien propuso el entreno o un capitán: quien vino cuenta como asistencia."
            : "Sin entreno confirmado no hay asistencia que guardar."}{" "}
          Los equipos se quedan en {m.phone ? "este móvil" : "este ordenador"}{P.state.estado === "offline" ? " (sin conexión: se hacen igual)" : ""}; no tocan el tablero ni el siete.
        </p>
        {canSave && (
          <div className="pz-acts">
            <button type="button" className="vd-glass vd-press pz-btn" disabled={busy || !m.st.comes.length || savedSame} onClick={() => void save()}>
              <PzIcon name="check" />
              {busy ? "Guardando…" : m.src.saved ? "Guardar los cambios" : "Guardar quién vino"}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
const fmtCame = (n: number) => (n === 1 ? "1 ha venido" : `${n} han venido`);
const fmtPeople = (n: number) => (n === 1 ? "1 persona" : `${n} personas`);

// ── phone peek: the state, Mezclar, the meter ─────────────────────────────────────────────────────────────────
function Peek({ P, m }: { P: PzApi; m: PgModel }) {
  const t0 = m.teams[0];
  const t1 = m.teams[1];
  return (
    <div className="pg-peek">
      <div className="pg-ptop">
        <div>
          <h1>{m.head}</h1>
          <p>{m.peekLine}</p>
        </div>
        <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" disabled={m.st.comes.length < 2 * m.n} onClick={() => pg.mezclar(P)}>
          <PzIcon name="swap" />
          Mezclar
        </button>
      </div>
      {m.isReady && m.n === 2 && (
        <div className="pg-pbal" role="group" aria-label={m.balAria}>
          <span>
            <Sw pat={t0.pat} />
            {t0.short} <b>{t0.media}</b>
          </span>
          <span className="pg-bal__track" aria-hidden="true">
            <i />
            <span className="pg-bal__dot" style={{ left: m.balPos + "%" }} />
          </span>
          <span>
            <b>{t1.media}</b> {t1.short}
            <Sw pat={t1.pat} />
          </span>
        </div>
      )}
    </div>
  );
}

export function Pachanga({ region, layout }: RegionProps) {
  const P = usePz();
  const m = pgModel(P, layout);
  const flow = layout !== "desktop";
  const owner = region === "lead" || region === "peek" || region === "panel";
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && handOf(P)) {
      pg.drop(P);
      e.preventDefault();
      e.stopPropagation();
    }
  };
  if (region !== "lead" && region !== "side" && region !== "peek" && region !== "panel") return null;
  const body =
    region === "peek" ? (
      <Peek P={P} m={m} />
    ) : region === "panel" ? (
      <>
        <Lead P={P} m={m} panel />
        <Side P={P} m={m} />
      </>
    ) : region === "lead" ? (
      <Lead P={P} m={m} panel={false} />
    ) : (
      <Side P={P} m={m} />
    );
  return (
    <div className={`pg${flow ? " is-flow" : ""}${layout === "phone" ? " is-phone" : ""}`} data-pz-place="pachanga" onKeyDown={onKey}>
      {owner && <PgOwner layout={layout} />}
      {flow || region === "peek" ? (
        body
      ) : (
        <div className="pz-region">
          <div className="pz-region__scroll">{body}</div>
        </div>
      )}
    </div>
  );
}
