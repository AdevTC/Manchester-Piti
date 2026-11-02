// r14 «La pizarra» · Tableros: the selected board's details (desktop side · tablet · the phone's «Detalles» sheet):
// rename in place with its errors, its versions as minis that open Comparar, the match (link with confirmation), the
// sistema, tags, the official's reactions, the rotating armband, its history (Comparar · Recuperar), and its actions
// (open, compare, duplicate, make or take off the official, delete with 12 s to undo, la mesa's copies).
import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { Link } from "@tanstack/react-router";
import type { Layout, PzBoard } from "../../store/types";
import { PiCampo } from "../../campo/PiCampo";
import { CampoShirt, PzIcon } from "../../campo/Shirt";
import { VERS, verOf } from "../../store/seven";
import { fmt } from "../../store/fmt";
import { TAG_SUGGEST, cleanTag, tagError, tagsInUse } from "../../../v2/tags";
import { pb } from "./pb";
import { del, goCmp, openIn, type Tb } from "./useTb";
import { armbands, dots, jLabel, matchById, resOf, savedOf } from "./tablerosView";
import { whenStore } from "./ops";

interface Act {
  t: string;
  icon: string;
  pri?: boolean;
  danger?: boolean;
  aria?: string;
  off?: boolean;
  run: () => void;
}

export function Inspector({ tb, b, layout }: { tb: Tb; b: PzBoard; layout: Layout }) {
  const { P, U, off, cur, ops } = tb;
  const S = P.state;
  const m = P.sel.me();
  const ce = P.sel.canEdit(b);
  const mine = b.ownerUid === m.uid;
  const isCur = b.id === cur?.id;
  // (several officials can live at once: one per match and one for the season; the reactions the store reads are
  // those of the board's match's official — `off`)
  const quitting = U.pend?.kind === "quitar" && U.pend.ids.includes(b.id);
  const official = b.isOfficial && !quitting;
  const isOff = official && b.id === off?.id;
  const v = verOf(b.lineup, "titular");
  const st = P.sel.status(v);
  const M = matchById(P, b.matchId);
  const res = resOf(M);
  const media = st.n ? P.sel.media(v) : null;
  const chem = st.n > 1 ? P.sel.chem(v) : null;
  const editing = U.editing === b.id && ce;
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const saveName = async (): Promise<boolean> => {
    const err = await ops.rename(b.id, pb.get().draft);
    if (err) {
      pb.set({ nameErr: err });
      return false;
    }
    pb.set({ editing: null, nameErr: "" });
    return true;
  };
  const nameKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void saveName();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      pb.set({ editing: null, nameErr: "" });
      P.say("Nombre sin cambios");
    }
  };

  // ── its versions (minis that open Comparar)
  const vers = VERS.map((x) => {
    const vv = verOf(b.lineup, x.id);
    const ex = x.id === "titular" || vv.exists;
    const sv = P.sel.status(vv);
    return {
      id: x.id,
      t: x.t,
      ex,
      s: ex ? (vv.freeMode ? "Libre" : vv.formation) + " · " + sv.n + "/7" : "No tiene",
      aria: ex ? x.t + ", " + vv.formation + ", " + sv.n + " de 7" + (x.id === "titular" ? ": compararlo" : ": compararla con el titular") : x.t + ": este tablero no la tiene",
      pick: () => {
        if (!ex) return;
        if (x.id === "titular") goCmp(P, off && off.id !== b.id ? "b:" + off.id + ":titular" : cur && cur.id !== b.id ? "b:" + cur.id + ":titular" : null, "b:" + b.id + ":titular");
        else goCmp(P, "b:" + b.id + ":titular", "b:" + b.id + ":" + x.id);
      },
    };
  });

  // ── tags
  const tags = b.lineup.tags ?? [];
  const addTag = (t: string) => {
    const err = tagError(t, tags);
    if (err) {
      pb.set({ tagErr: err });
      return;
    }
    const nt = cleanTag(t);
    if (P.act.saveBoard({ tags: [...tags, nt] }, "Etiqueta «" + nt + "» puesta", { boardId: b.id })) pb.set({ tagErr: "", tagDraft: "" });
  };
  const inUse = tagsInUse(tb.boards.map((x) => ({ tags: x.lineup.tags ?? [] })));
  const sugg = [...TAG_SUGGEST, "Amistoso", "Plan B", ...inUse].filter((t, i, a) => a.indexOf(t) === i && !tags.some((x) => x.toLowerCase() === t.toLowerCase())).slice(0, 4);

  // ── the official's reactions (the counts are the official's; the doubters' names only for captains)
  const R = P.sel.reactions();
  const tot = Math.max(1, R.ok + R.dudas);
  const reactT = R.ok + " de acuerdo · " + R.dudas + " con dudas";
  const react = async (val: "ok" | "dudas") => {
    if (S.boardId !== b.id) {
      P.act.openBoard(b.id);
      if (!(await whenStore(P, (s) => s.boardId === b.id, 4000))) return;
    }
    P.act.react(val);
  };

  // ── capitán rotativo: the one of this seven who has worn the armband the fewest times (the season's officials)
  let arm: { pid: string; t: string; s: string; can: boolean } | null = null;
  if (m.cap && isCur && ce && M && !M.played && st.n > 0) {
    const ARM = armbands(P);
    const on = P.sel.placed(v);
    const capId = b.lineup.roles?.captainId ?? null;
    const cand = on.slice().sort((a, c) => (ARM[a] ?? 0) - (ARM[c] ?? 0) || (P.sel.player(c)?.pj ?? 0) - (P.sel.player(a)?.pj ?? 0))[0];
    if (cand) {
      const already = capId === cand;
      arm = { pid: cand, t: already ? P.sel.name(cand) + " ya lleva el brazalete" : "Le toca a " + P.sel.name(cand), s: "Es quien menos lo ha llevado de este siete: " + fmt.plural(ARM[cand] ?? 0, "brazalete", "brazaletes") + (capId && !already ? " · ahora lo lleva " + P.sel.name(capId) : ""), can: !already };
    }
  }

  const armStill = P.sel.shirt(arm?.pid ?? null);

  // ── its history (the server's snapshots; newest first)
  const snaps = tb.ctx.snaps[b.id] ?? [];
  const hist = snaps.map((h) => {
    const hv = { ...v, formation: h.formation, freeMode: h.freeMode, slots: h.slots.map((s) => ({ code: s.code as (typeof v.slots)[number]["code"], x: s.x, y: s.y, playerId: s.playerId })) };
    const d = P.sel.diff(v, hv);
    const same = !d || d.same;
    return { h, pts: dots(hv.slots), s: savedOf(h.at, S.W.now) + " · " + h.formation + (same ? " · igual que ahora" : ""), cmpAria: "Comparar «" + h.label + "» con ahora (" + (same ? "igual que ahora" : (d?.text ?? "")) + ")", same };
  });

  // ── actions
  const acts: Act[] = [];
  acts.push({ t: isCur ? "Seguir en Siete" : "Abrir en Siete", icon: "shirt", pri: true, aria: "Abrir «" + b.name + "» en Siete", run: () => openIn(P, b.id) });
  acts.push({ t: "Comparar", icon: "swap", aria: "Comparar «" + b.name + "» con otro siete", run: () => goCmp(P, off && off.id !== b.id ? "b:" + off.id + ":titular" : cur && cur.id !== b.id ? "b:" + cur.id + ":titular" : null, "b:" + b.id + ":titular") });
  if (m.member && !m.socia) acts.push({ t: ce ? "Duplicar" : "Duplicar para editar", icon: "copy", aria: "Duplicar «" + b.name + "»", off: !!U.busy, run: () => void ops.duplicate(b.id) });
  if (m.cap && !b.isOfficial)
    acts.push({
      t: "Hacer oficial",
      icon: "send",
      aria: "Publicar «" + b.name + "» como el oficial",
      off: !st.full || !st.gk,
      run: async () => {
        if (S.boardId !== b.id) {
          P.act.openBoard(b.id);
          if (!(await whenStore(P, (s) => s.boardId === b.id, 4000))) return;
        }
        P.act.openSheet("publicar");
      },
    });
  if (m.cap && official) acts.push({ t: "Quitar el oficial", icon: "close", aria: "Quitar «" + b.name + "» como oficial", run: () => P.act.openSheet("pb-quitar", { id: b.id }, { kicker: b.name }) });
  if (ce && !b.isOfficial) acts.push({ t: "Borrar", icon: "trash", danger: true, aria: "Borrar «" + b.name + "»", run: () => (mine ? del(P, b, "mine") : pb.set({ confirmDel: b.id })) });
  let note = "";
  if (m.cap && !b.isOfficial && !st.full) note = "Para hacerlo oficial, completa el titular (" + st.n + "/7).";
  else if (m.cap && !b.isOfficial && !st.gk) note = "Para hacerlo oficial, pon un portero en la portería.";
  const isMesa = ops.isMesa(b.id);
  const mesaN = m.cap ? ops.mesaCopies().length : 0;
  if (isMesa && m.cap) {
    note = M?.played ? "Copia que hizo la mesa el día del partido. Ya jugado: se puede borrar." : "Copia que hizo la mesa el día del partido.";
    if (mesaN > 0) acts.push({ t: mesaN === 1 ? "Borrar la copia de la mesa" : "Borrar las " + mesaN + " copias de la mesa", icon: "trash", danger: true, aria: "Borrar las copias de la mesa de partidos jugados", run: () => P.act.openSheet("pb-mesa") });
  }
  let line: string;
  if (!ce) line = b.isOfficial ? "El oficial es de solo lectura: duplícalo para cambiarlo." : m.socia || !m.member ? "Solo lectura." : "Es de @" + b.ownerNick + ": solo lectura. Duplícalo para tener tu copia.";
  else if (!mine) line = "Es de @" + b.ownerNick + ": si lo cambias, lo cambias para él.";
  else if (b.isOfficial) line = "Es el oficial: lo que cambies lo ve el equipo cuando avises.";
  else line = M && M.played ? "La " + jLabel(M) + " se jugó sin publicar este tablero." : "Tuyo. Se guarda solo con cada cambio.";
  const kick = b.isOfficial ? "El oficial · lo ve todo el equipo" : mine ? "Tuyo" + (isCur ? " · abierto ahora" : "") : "De @" + b.ownerNick + (isCur ? " · abierto ahora" : "");
  const savedT = (isCur && S.estado === "offline" ? "En este móvil · sin conexión" : savedOf(b.updatedAt, S.W.now)) + (b.createdAt ? " · creado el " + fmt.day(b.createdAt) : "");

  return (
    <section className="pb-insp" aria-labelledby="pb-in-h">
      <p className="pz-kick">{kick}</p>
      {editing ? (
        <div className="pb-namein">
          <label>
            <span className="pz-vh">Nombre del tablero</span>
            <input
              ref={inputRef}
              className="vd-glass"
              type="text"
              maxLength={60}
              value={U.draft}
              onChange={(e) => pb.set({ draft: e.target.value, nameErr: "" })}
              onKeyDown={nameKey}
              onBlur={() => {
                if (pb.get().editing === b.id) void saveName();
              }}
              aria-describedby="pb-nerr"
              aria-invalid={!!U.nameErr}
            />
          </label>
          <p className="pb-err" id="pb-nerr" aria-live="polite">
            {U.nameErr}
          </p>
          <p className="pz-meta">Intro para guardar · Esc para dejarlo como estaba</p>
        </div>
      ) : (
        <div className="pb-name">
          <h2 id="pb-in-h">{b.name}</h2>
          {ce && (
            <button type="button" className="vd-glass vd-press nx-ib" onClick={() => pb.set({ editing: b.id, draft: b.name, nameErr: "" })} aria-label={"Renombrar «" + b.name + "»"}>
              <PzIcon name="edit" />
            </button>
          )}
        </div>
      )}
      <p className="pz-line">{line}</p>

      <section className="pz-sec pb-sec1" aria-labelledby="pb-in-v">
        <div className="pz-sec__h">
          <h3 id="pb-in-v">Sus versiones</h3>
          <p>Toca una para compararla</p>
        </div>
        <div className="pb-vers">
          {vers.map((x) => (
            <div key={x.id} className={`vd-glass vd-press pb-ver${x.ex ? "" : " is-none"}`}>
              {/* (the hit is a sibling of the mini: the mini pitch has buttons of its own) */}
              <button type="button" className="pb-card__hit" onClick={x.pick} disabled={!x.ex} aria-label={x.aria} />
              <span className="pb-ver__p">{x.ex && <PiCampo layout={layout} mini show={{ source: "siete", boardId: b.id, version: x.id }} camera="pizarra" />}</span>
              <b>{x.t}</b>
              <small>{x.s}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="pz-sec" aria-label="Datos del tablero">
        <div className="pb-facts">
          <div className="pb-fact">
            <span>Partido</span>
            <b>
              <span className={`pb-res ${res.cls}`} aria-hidden="true">
                {res.l}
              </span>
              <span>
                {M ? jLabel(M) + " · " + M.rival : "Sin partido"}
                <br />
                <em>{res.w}</em>
              </span>
            </b>
            {ce && (
              <button type="button" className="nx-lnk" onClick={() => P.act.openSheet("pb-vincular", { id: b.id })} aria-label={"Cambiar el partido de «" + b.name + "»"}>
                Cambiar
              </button>
            )}
          </div>
          {M && !M.played && (
            <div className="pb-fact pb-fact--links">
              <span />
              <b>
                <button
                  type="button"
                  className="nx-lnk"
                  onClick={async () => {
                    if (S.boardId !== b.id) {
                      P.act.openBoard(b.id);
                      await whenStore(P, (s) => s.boardId === b.id, 4000);
                    }
                    P.nav("/pizarra/partido");
                  }}
                >
                  El día de partido
                </button>
              </b>
              <Link className="nx-lnk" to="/partidos/$matchId" params={{ matchId: M.id }}>
                Ver el partido
              </Link>
            </div>
          )}
          <div className="pb-fact">
            <span>Sistema</span>
            <b>
              {v.freeMode ? "Libre" : v.formation}
              <em>{st.n + "/7" + (media != null ? " · media " + media : "") + (chem ? " · química " + chem.v : "")}</em>
            </b>
          </div>
          <div className="pb-fact">
            <span>Guardado</span>
            <b>{savedT}</b>
          </div>
          <div className="pb-fact pb-fact--tags">
            <span>Etiquetas</span>
            <div className="pb-tagbox">
              <div className="pb-tags">
                {tags.map((t) => (
                  <span key={t} className="pb-tag">
                    {t}
                    {ce && (
                      <button
                        type="button"
                        onClick={() => {
                          P.act.saveBoard({ tags: tags.filter((x) => x !== t) }, "Etiqueta «" + t + "» quitada", { boardId: b.id });
                          pb.set({ tagErr: "" });
                        }}
                        aria-label={"Quitar la etiqueta «" + t + "»"}
                      >
                        <PzIcon name="close" />
                      </button>
                    )}
                  </span>
                ))}
                {!tags.length && <span className="pz-meta">Sin etiquetas</span>}
              </div>
              {ce && tags.length < 3 && (
                <>
                  <label className="vd-glass pb-tagin">
                    <span className="pz-vh">Nueva etiqueta</span>
                    <input
                      type="text"
                      placeholder="Liga, Copa, Entreno…"
                      maxLength={20}
                      value={U.tagDraft}
                      onChange={(e) => pb.set({ tagDraft: e.target.value, tagErr: "" })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(pb.get().tagDraft);
                        }
                      }}
                      aria-describedby="pb-terr"
                    />
                    <button type="button" className="nx-ib" onClick={() => addTag(pb.get().tagDraft)} aria-label="Añadir la etiqueta">
                      <PzIcon name="plus" />
                    </button>
                  </label>
                  <div className="pb-sugg">
                    {sugg.map((t) => (
                      <button key={t} type="button" onClick={() => addTag(t)} aria-label={"Poner la etiqueta «" + t + "»"}>
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="pb-err" id="pb-terr" aria-live="polite">
                {ce ? U.tagErr : ""}
              </p>
            </div>
          </div>
        </div>
      </section>

      {isOff && (
        <section className="pz-sec" aria-labelledby="pb-in-o">
          <div className="pz-sec__h">
            <h3 id="pb-in-o">El oficial</h3>
          </div>
          <p className="pz-meta">{"De @" + b.ownerNick + " · " + (b.matchId ? "para este partido" : "para toda la temporada")}</p>
          <div className="pb-rx" role="img" aria-label={reactT}>
            <span className="pb-rx__bar" aria-hidden="true">
              <i className="ok" style={{ width: Math.round((R.ok / tot) * 100) + "%" }} />
              <i className="du" style={{ width: Math.round((R.dudas / tot) * 100) + "%" }} />
            </span>
            <span className="pb-rx__t">{reactT}</span>
          </div>
          {m.member && !m.cap && (
            <div className="pb-react">
              {(
                [
                  ["ok", "De acuerdo", "thumb", R.ok],
                  ["dudas", "Tengo dudas", "help", R.dudas],
                ] as const
              ).map(([id, t, icon, n]) => (
                <button key={id} type="button" className="vd-glass vd-press" aria-pressed={R.mine === id} onClick={() => void react(id)}>
                  <PzIcon name={icon} />
                  {t}
                  <b>{n}</b>
                </button>
              ))}
            </div>
          )}
          <p className="pz-meta">{m.cap ? (R.dudas ? (R.who?.length ? "Con dudas: " + fmt.list(R.who) + " · solo lo ven los capitanes." : "Hay dudas.") : "Nadie tiene dudas por ahora.") + " Si cambia el siete, se vuelve a preguntar." : "Si el siete cambia, se vuelve a preguntar."}</p>
        </section>
      )}

      {arm && (
        <section className="pz-sec" aria-labelledby="pb-in-a">
          <div className="pz-sec__h">
            <h3 id="pb-in-a">Capitán rotativo</h3>
          </div>
          <div className="pb-arm">
            {armStill.src ? (
              <span className="pz-shirt" style={{ "--s": "34px" } as CSSProperties} aria-hidden="true">
                <img src={armStill.src} alt="" />
              </span>
            ) : (
              <CampoShirt still={armStill} className="pb-armshirt" />
            )}
            <span>
              <b>{arm.t}</b>
              <small>{arm.s}</small>
            </span>
            {arm.can && (
              <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.setRole("captainId", arm.pid)}>
                Darle el brazalete
              </button>
            )}
          </div>
        </section>
      )}

      {hist.length > 0 && (
        <section className="pz-sec" aria-labelledby="pb-in-h2">
          <div className="pz-sec__h">
            <h3 id="pb-in-h2">Cómo ha ido cambiando</h3>
          </div>
          <p className="pz-meta">Una foto cada vez que cambia el sistema, entra alguien o se publica.</p>
          <ol className="pb-hist">
            <li className="pb-h is-now">
              <span className="pz-mini" aria-hidden="true">
                {dots(v.slots).map((d, i) => (
                  <i key={i} style={{ left: d.x + "%", top: d.y + "%" }} />
                ))}
              </span>
              <span>
                <b>{"Ahora · " + (v.freeMode ? "Libre" : v.formation)}</b>
                <small>{st.n + " de 7 · guardado " + savedOf(b.updatedAt, S.W.now)}</small>
              </span>
              <span className="pb-h__a" />
            </li>
            {hist.map((h) => (
              <li key={h.h.id} className="pb-h">
                <span className="pz-mini" aria-hidden="true">
                  {h.pts.map((d, i) => (
                    <i key={i} style={{ left: d.x + "%", top: d.y + "%" }} />
                  ))}
                </span>
                <span>
                  <b>{h.h.label || "Una foto"}</b>
                  <small>{h.s}</small>
                </span>
                <span className="pb-h__a">
                  <button type="button" className="nx-lnk" onClick={() => goCmp(P, "h:" + b.id + ":" + h.h.id, "b:" + b.id + ":titular")} aria-label={h.cmpAria}>
                    Comparar
                  </button>
                  {ce && !h.same && (
                    <button type="button" className="nx-lnk" onClick={() => ops.restore(b.id, h.h)} aria-label={"Recuperar «" + (h.h.label || "la foto") + "»"}>
                      Recuperar
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="pz-sec" aria-label="Acciones del tablero">
        {U.confirmDel === b.id && (
          <div className="pb-confirm" role="alertdialog" aria-labelledby="pb-cd">
            <b id="pb-cd">{"«" + b.name + "» es de @" + b.ownerNick + ": ¿lo borras?"}</b>
            <span className="pz-meta">Tendrás 12 segundos para deshacerlo.</span>
            <div className="pz-acts">
              <button type="button" className="vd-glass vd-press pz-btn pb-danger" onClick={() => del(P, b, "team")}>
                <PzIcon name="trash" />
                Borrarlo
              </button>
              <button type="button" className="nx-lnk" onClick={() => pb.set({ confirmDel: null })}>
                Cancelar
              </button>
            </div>
          </div>
        )}
        <div className="pz-acts">
          {acts.map((a) => (
            <button key={a.t} type="button" className={`vd-glass vd-press pz-btn${a.pri ? " pz-btn--pri" : ""}${a.danger ? " pb-danger" : ""}`} onClick={a.run} aria-label={a.aria} disabled={a.off}>
              <PzIcon name={a.icon} />
              {a.t}
            </button>
          ))}
        </div>
        {note && <p className="pz-meta">{note}</p>}
      </section>
    </section>
  );
}
