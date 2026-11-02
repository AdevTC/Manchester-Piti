// r14 «La pizarra» · Siete (PiSiete.dc.html): the headline that SAYS the state, the ring 6/7 with media and
// química, the system, the versions (Titular · 2ª parte · Plan B), the reactions to the official, «Adivina el
// siete», galones y lanzadores, «Sugerir» / «Empezar desde…» / «Duplicar para editar» / «Publicar»; the bench with
// the convocatoria's answers, absences and the guest; on the phone, the peek (headline + bench strip) and the panel.
import { useState, type ChangeEvent, type PointerEvent as RPointerEvent } from "react";
import { usePz } from "../../store/context";
import { LAYERS } from "../../store/store";
import { fmt } from "../../store/fmt";
import { PzIcon } from "../../campo/Shirt";
import { systemDef } from "../../../../../lib/formations";
import { useMyGuess, saveGuess, guessHits, guessLine } from "../../../data/guesses";
import type { PzApi } from "../../store/api";
import type { RegionProps } from "../../store/types";
import { RowShirt } from "./RowShirt";
import { useSieteApi } from "./sieteApi";
import { LINE_FILTERS, avisoText, benchGroups, benchRow, countChips, dudosos, fitIn, galRows, kicker, ringOff, sysDots, verLine, type BenchRow } from "./sieteView";
import "../../../../../styles/pz/siete.css";

export function Siete({ region, layout }: RegionProps) {
  const flow = layout !== "desktop";
  const phone = layout === "phone";
  const cls = `pz-7${flow ? " is-flow" : ""}${phone ? " is-phone" : ""}`;
  if (region === "peek") return <Peek />;
  if (region === "lead" || region === "side") {
    const body = region === "lead" ? <Lead panel={false} /> : <Bench />;
    if (flow) return <div className={cls}>{body}</div>;
    return (
      <div className={`${cls} pz-region`} data-pz-drop={region === "side" ? "bench" : undefined}>
        <div className="pz-region__scroll">{body}</div>
      </div>
    );
  }
  if (region === "panel")
    return (
      <div className={cls}>
        <Lead panel />
        <div className="pz-7__panelbench">
          <Bench />
        </div>
      </div>
    );
  return null;
}

// ── lead ─────────────────────────────────────────────────────────────────────────────────────────────────────
function Lead({ panel }: { panel: boolean }) {
  const P = usePz();
  useSieteApi(P);
  const S = P.state;
  const b = P.sel.board();
  const v = P.sel.ver();
  const m = P.sel.me();
  const ro = !!b && !P.sel.canEdit(b);
  const st = P.sel.status(v);
  const chem = P.sel.chem(v);
  const media = P.sel.media(v);
  const head = P.sel.headline();
  const bandM = P.sel.band(media);
  const sysDef = systemDef(v ? v.formation : "2-3-1");
  const onField = P.sel.placed(v);
  const hasBoard = !!b && (st.n > 0 || !b.draft);
  const off = P.sel.official();
  const vsOff = off && b && off.id !== b.id ? P.sel.diff(P.sel.ver(b, "titular"), P.sel.ver(off, "titular")) : null;
  const showReact = !!b?.isOfficial && !m.fuera;
  const canDup = !!b && ro && m.member && !m.socia;
  const canPublish = !ro && m.cap && !!b && st.full && !b.isOfficial;
  const roT = b?.isOfficial ? "Oficial · solo lectura" : b ? "De @" + b.ownerNick + " · solo lectura" : "";
  const nIn = onField.length ? fitIn(P, v, sysDef.id).filter(Boolean).length : 0;
  const react = showReact ? <Reactions /> : null;
  return (
    <>
      <section className="pz-hero pz-7__hero" aria-labelledby="pz7-h">
        <p className="pz-kick">
          {kicker(P)}
          {ro && (
            <span className="pz-7__ro">
              <PzIcon name="lock" />
              {roT}
            </span>
          )}
        </p>
        <h1 className={`pz-h1${head.tone === "warn" ? " is-warn" : ""}`} id="pz7-h">
          {head.t}
        </h1>
        <p className="pz-line">{head.s}</p>
      </section>

      {hasBoard && b && (
        <>
          <div className="pz-stats pz-7__stats" role="group" aria-label="Tu siete en números">
            <div className="pz-stat pz-7__ringstat">
              <span className={`pz-ring${st.full ? " is-full" : ""}`} role="img" aria-label={`${st.n} de 7 en el campo${st.full ? ", completo" : ""}`}>
                <svg viewBox="0 0 80 80" aria-hidden="true">
                  <circle className="bg" cx="40" cy="40" r="34" />
                  <circle className="fg" cx="40" cy="40" r="34" strokeDasharray="213.6" strokeDashoffset={ringOff(st.n)} />
                </svg>
                <b>
                  {st.n}
                  <small>/7</small>
                </b>
              </span>
              <span className="pz-7__ringt">
                <span className="pz-stat__k">En el campo</span>
                <span className="pz-stat__w">{st.full ? (st.warns.length ? "Con " + fmt.plural(st.warns.length, "aviso", "avisos") : "Completo") : "Faltan " + (7 - st.n)}</span>
              </span>
            </div>
            <div className="pz-stat">
              <span className="pz-stat__v">{media == null ? "—" : media}</span>
              <span className="pz-stat__k">Media</span>
              <span className="pz-stat__w">{media == null ? "Sin notas" : bandM.t.charAt(0).toUpperCase() + bandM.t.slice(1)}</span>
            </div>
            <div className="pz-stat">
              <span className="pz-stat__v">{chem.v}</span>
              <span className="pz-stat__k">Química</span>
              <span className="pz-stat__w">{chem.t}</span>
            </div>
          </div>

          {panel && (
            <div className="pz-sec">
              <div className="vd-glass pz-7__lines pz-7__layers" role="group" aria-label="Capa del campo">
                {LAYERS.map((l) => (
                  <button key={l.id} type="button" aria-pressed={S.layer === l.id} onClick={() => P.act.setLayer(l.id)}>
                    {l.t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {ro && react}

          <section className="pz-sec" aria-labelledby="pz7-sys">
            <div className="pz-sec__h">
              <h2 id="pz7-sys">El sistema</h2>
              {nIn > 0 && <p>{nIn}/7 en su sitio</p>}
            </div>
            <div className="pz-7__sys">
              <button type="button" className="vd-glass vd-press nx-ib pz-7__arr" onClick={() => P.act.cycleSistema(-1)} disabled={ro} aria-label="Sistema anterior">
                <PzIcon name="chevL" />
              </button>
              <button type="button" className="vd-glass vd-press pz-7__sysname" onClick={() => P.act.openSheet("sistema")} aria-label={`Sistema ${v?.freeMode ? "libre" : sysDef.id}, ${sysDef.name}. Ver los 15`}>
                <span className="pz-mini" aria-hidden="true">
                  {sysDots(sysDef.id).map((d, i) => (
                    <i key={i} style={{ left: d.x + "%", top: d.y + "%" }} />
                  ))}
                </span>
                <span>
                  <b>{v?.freeMode ? "Libre" : sysDef.id}</b>
                  <small>
                    {v?.freeMode ? "a mano" : sysDef.name} · {sysDef.character}
                  </small>
                </span>
              </button>
              <button type="button" className="vd-glass vd-press nx-ib pz-7__arr" onClick={() => P.act.cycleSistema(1)} disabled={ro} aria-label="Sistema siguiente">
                <PzIcon name="chevR" />
              </button>
            </div>
          </section>

          <section className="pz-sec" aria-labelledby="pz7-ver">
            <div className="pz-sec__h">
              <h2 id="pz7-ver">Versiones</h2>
              {!ro && S.version !== "titular" && v?.exists && (
                <button type="button" className="nx-lnk" onClick={() => P.act.removeVersion(S.version)}>
                  Quitar «{v.t}»
                </button>
              )}
            </div>
            <div className="vd-glass pz-7__vers" role="group" aria-label="Versión del siete">
              {P.sel.versions(b).map((x) => (
                <button
                  key={x.id}
                  type="button"
                  className={x.exists ? "" : "is-new"}
                  aria-pressed={x.cur}
                  onClick={() => P.act.setVersion(x.id)}
                  disabled={!x.exists && ro}
                  aria-label={x.exists ? "Ver la versión " + x.t : "Crear la versión «" + x.t + "»: una copia del titular"}
                >
                  {!x.exists && <PzIcon name="plus" />}
                  {x.t}
                </button>
              ))}
            </div>
            <p className="pz-7__vline">{verLine(P, b, v)}</p>
            {vsOff && (
              <p className="pz-7__vline">
                <b>Frente al oficial:</b> {vsOff.text.charAt(0).toLowerCase() + vsOff.text.slice(1)}
              </p>
            )}
          </section>

          {!ro && react}
          <Guess />

          <section className="pz-sec" aria-labelledby="pz7-gal">
            <div className="pz-sec__h">
              <h2 id="pz7-gal">Galones y lanzadores</h2>
              {!ro && <p>Toca para cambiar</p>}
            </div>
            <div className="pz-7__gal">
              {galRows(P, b, v, ro).map((g) => (
                <button key={g.k} type="button" className="pz-7__g" onClick={() => P.act.openSheet("galones", { k: g.k })} disabled={ro} aria-label={g.aria}>
                  <i className={`k-${g.k}`} aria-hidden="true">
                    {g.k}
                  </i>
                  {g.holder && <RowShirt still={P.sel.shirt(g.holder)} size={22} />}
                  <span>
                    <small>{g.t}</small>
                    <b className={g.holder ? "" : "is-none"}>{g.who}</b>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="pz-sec" aria-label="Más formas de empezar">
            <div className="pz-acts">
              {!ro && (
                <>
                  <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.suggest()}>
                    <PzIcon name="spark" />
                    Sugerir siete
                  </button>
                  <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.openSheet("desde")}>
                    <PzIcon name="start" />
                    Empezar desde…
                  </button>
                </>
              )}
              {canDup && (
                <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.duplicate()}>
                  <PzIcon name="copy" />
                  Duplicar para editar
                </button>
              )}
              {canPublish && (
                <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.openSheet("publicar")}>
                  <PzIcon name="send" />
                  Publicar como oficial
                </button>
              )}
            </div>
          </section>
        </>
      )}

      {!hasBoard && (!b || !ro) && !m.socia && !m.fuera && (
        <section className="pz-sec" aria-label="Por dónde empezar">
          <Sources withSuggest />
        </section>
      )}
    </>
  );
}

/** «Empezar desde…»: the last seven, against this rival, the official (+ Sugerir on an empty board). */
export function Sources({ withSuggest = false }: { withSuggest?: boolean }) {
  const P = usePz();
  return (
    <div className="pz-7__start">
      {P.sel.sources().map((s) => (
        <button key={s.id} type="button" className="vd-glass vd-press pz-7__src" onClick={() => P.act.startFrom(s.id)} disabled={!s.can}>
          <span className="pz-mini" aria-hidden="true">
            {s.formation && sysDots(s.formation).map((d, i) => <i key={i} style={{ left: d.x + "%", top: d.y + "%" }} />)}
          </span>
          <span>
            <b>{s.t}</b>
            <small>{s.s}</small>
          </span>
        </button>
      ))}
      {withSuggest && (
        <button type="button" className="vd-glass vd-press pz-7__src" onClick={() => P.act.suggest()}>
          <span className="vx-tile">
            <PzIcon name="spark" />
          </span>
          <span>
            <b>Sugerir siete</b>
            <small>Los que mejor encajan, por forma</small>
          </span>
        </button>
      )}
    </div>
  );
}

// ── the reactions to the official (PZ-D01: they start again when the seven changes) ────────────────────────
function Reactions() {
  const P = usePz();
  const m = P.sel.me();
  const R = P.sel.reactions();
  const who = R.who ?? [];
  const line = m.cap
    ? (R.dudas ? (who.length ? "Con dudas: " + fmt.list(who) + " · solo lo ven los capitanes" : fmt.plural(R.dudas, "tiene dudas", "tienen dudas")) : "Nadie tiene dudas por ahora") + ". Si cambia quién juega, las opiniones empiezan de cero."
    : `${R.ok} de acuerdo, ${R.dudas} con dudas. Si el siete cambia, se vuelve a preguntar.`;
  const canReact = m.member;
  return (
    <section className="pz-sec" aria-labelledby="pz7-re">
      <div className="pz-sec__h">
        <h2 id="pz7-re">{m.cap ? "Lo que opina el equipo" : "¿Qué te parece?"}</h2>
      </div>
      {canReact && (
        <div className="pz-7__react">
          {(
            [
              ["ok", "De acuerdo", "thumb", R.ok],
              ["dudas", "Tengo dudas", "help", R.dudas],
            ] as const
          ).map(([id, t, icon, n]) => (
            <button key={id} type="button" className="vd-glass vd-press" aria-pressed={R.mine === id} onClick={() => P.act.react(id)}>
              <PzIcon name={icon} />
              {t}
              <b>{n}</b>
            </button>
          ))}
        </div>
      )}
      <p className="pz-meta">{line}</p>
    </section>
  );
}

// ── «Adivina el siete» (PZ-D04): a player bets his seven before the official; then «Acertaste 5 de 7» ───────────
function Guess() {
  const P = usePz();
  const m = P.sel.me();
  const M = P.sel.match();
  const b = P.sel.board();
  const off = P.sel.official();
  const outFor = !!(off && M && off.matchId === M.id);
  const on = !!(m.jugador && m.pid && M && !M.played && (M.phase === "antes" || outFor));
  const { guess } = useMyGuess(on && M ? M.id : null, on ? m.uid : null);
  const [busy, setBusy] = useState(false);
  if (!on || !M) return null;
  if (outFor) {
    if (!guess || !off) return null;
    const seven = (P.sel.ver(off, "titular")?.slots ?? []).map((s) => s.playerId);
    return (
      <section className="pz-sec" aria-labelledby="pz7-gu">
        <div className="pz-sec__h">
          <h2 id="pz7-gu">Adivina el siete</h2>
        </div>
        <p className="pz-line pz-7__guessed">{guessLine(guessHits(guess.slots, seven))}</p>
      </section>
    );
  }
  const t = b ? P.sel.ver(b, "titular") : null;
  const ids = (t?.slots ?? []).map((s) => s.playerId);
  const full = ids.filter(Boolean).length === 7;
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await saveGuess(M.id, m.uid, ids);
      P.toast("Apuesta guardada: tu siete, a las " + fmt.hm(Date.now()));
    } catch (e) {
      P.toast(e instanceof Error && /siete/.test(e.message) ? e.message : "No se ha podido guardar tu apuesta", { icon: "warn" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="pz-sec" aria-labelledby="pz7-gu">
      <div className="pz-sec__h">
        <h2 id="pz7-gu">Adivina el siete</h2>
      </div>
      <p className="pz-line">{guess ? "Tu apuesta está guardada. Cuando el capitán publique, verás cuántos de 7 acertaste." : "Apuesta tu siete antes de que lo publiquen: luego verás cuántos acertaste."}</p>
      <div className="pz-acts">
        <button type="button" className="vd-glass vd-press pz-btn" onClick={() => void save()} disabled={!full || busy} aria-describedby={full ? undefined : "pz7-gu-need"}>
          <PzIcon name="star" />
          {guess ? "Apostar con este siete" : "Apostar con mi siete"}
        </button>
        {!full && (
          <span className="pz-meta" id="pz7-gu-need">
            Pon a los siete en el campo para apostar.
          </span>
        )}
      </div>
    </section>
  );
}

// ── side: the bench ──────────────────────────────────────────────────────────────────────────────────────────
function Bench() {
  const P = usePz();
  const S = P.state;
  const b = P.sel.board();
  const v = P.sel.ver();
  const m = P.sel.me();
  const M = P.sel.match();
  const ro = !b || !P.sel.canEdit(b);
  const B = S.bench;
  const { all, can, cant } = benchGroups(P, v);
  const chips = countChips(P);
  const answered = Object.keys(S.W.rsvp).length > 0;
  const nDud = dudosos(P).length;
  const avisar = () => {
    const text = avisoText(P);
    const n = nDud;
    const done = () => P.toast("Aviso copiado para " + fmt.plural(n, "jugador", "jugadores") + ": pégalo en el grupo", { icon: "copy" });
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => P.toast("No se ha podido copiar: " + text, { long: true }));
    else P.toast(text, { long: true });
  };
  const groups: { t: string; ids: string[] }[] = [];
  if (can.length) groups.push({ t: "Pueden jugar", ids: can });
  if (cant.length) groups.push({ t: "No pueden", ids: cant });
  const dropCls = `${S.over === "bench" ? " is-over" : ""}${S.drag?.from === "campo" ? " is-dragcampo" : ""}`;
  return (
    <div className={`pz-7__drop${dropCls}`} data-pz-drop="bench">
      <div className="pz-7__bh">
        <h2>Banquillo</h2>
        <p className="pz-meta">{M ? "Convocatoria · " + (M.j ? "J" + M.j + " · " : "") + M.rival : "Sin partido a la vista"}</p>
      </div>
      <div className="pz-7__counts" role="group" aria-label="Respuestas a la convocatoria">
        {chips.map((c) => (
          <span key={c.t} className={`pz-chip is-${c.tone}`}>
            <PzIcon name={c.icon} />
            {c.n == null ? c.t : c.n + " " + c.t}
          </span>
        ))}
      </div>
      {!ro && m.cap && answered && nDud > 0 && (
        <button type="button" className="vd-glass vd-press pz-btn pz-7__avisar" onClick={avisar}>
          <PzIcon name="megaphone" />
          Avisar a los que dudan · {nDud}
        </button>
      )}
      <div className="pz-7__filters">
        <div className="vd-glass pz-7__lines" role="group" aria-label="Filtrar por línea">
          {LINE_FILTERS.map(([id, t]) => (
            <button key={id} type="button" aria-pressed={B.line === id} onClick={() => P.act.setBench({ line: id })}>
              {t}
            </button>
          ))}
        </div>
        <div className="pz-7__frow">
          <label className="vd-glass pz-7__search">
            <PzIcon name="search" />
            <span className="pz-vh">Buscar en la plantilla</span>
            <input type="search" placeholder="Nombre o dorsal" value={B.q} onChange={(e: ChangeEvent<HTMLInputElement>) => P.act.setBench({ q: e.target.value })} />
          </label>
          <button type="button" className="vx-tog pz-7__van" aria-pressed={B.van} onClick={() => P.act.setBench({ van: !B.van })}>
            <span className="vx-tog__t" aria-hidden="true" />
            Solo los que van
          </button>
        </div>
      </div>
      <p className="pz-7__drophint">Suéltalo aquí y vuelve al banquillo</p>
      {groups.map((g) => (
        <div key={g.t}>
          <p className="pz-7__grp">
            <span>{g.t}</span>
            <span>{g.ids.length}</span>
          </p>
          <ul className="pz-rows pz-7__bench">
            {g.ids.map((id) => (
              <li key={id}>
                <BenchItem row={benchRow(P, id, ro)} ro={ro} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!groups.length && <p className="pz-meta pz-7__none">{all.length ? "Nadie con ese filtro." : "Todos los convocados están en el campo."}</p>}
    </div>
  );
}

function down(P: PzApi, id: string, ro: boolean, can: boolean) {
  return (e: RPointerEvent<HTMLButtonElement>) => {
    if (!ro && can) P.drag.begin(e, { pid: id, from: "banquillo", slot: null });
  };
}

function BenchItem({ row, ro }: { row: BenchRow; ro: boolean }) {
  const P = usePz();
  const S = P.state;
  const on = S.sel?.pid === row.id;
  return (
    <button
      type="button"
      className={`pz-row${on ? " is-on" : ""}${S.drag?.pid === row.id ? " is-held" : ""}`}
      aria-pressed={on}
      onClick={() => P.act.tapBench(row.id)}
      onPointerDown={down(P, row.id, ro, row.can)}
      aria-label={row.aria}
      data-pz-drop="bench"
    >
      <RowShirt still={P.sel.shirt(row.id)} off={!row.can} />
      <span className="pz-row__t">
        <b>{row.name}</b>
        <span>{row.sub}</span>
      </span>
      <span className={`pz-chip is-${row.tone}`}>
        <PzIcon name={row.chipIcon} />
        {row.chip}
      </span>
      <span className="pz-row__n">
        <b>{row.media}</b>
        <small>{row.mediaK}</small>
      </span>
    </button>
  );
}

// ── phone peek: the state + the bench strip ─────────────────────────────────────────────────────────────────
function Peek() {
  const P = usePz();
  useSieteApi(P);
  const S = P.state;
  const head = P.sel.headline();
  const b = P.sel.board();
  const ro = !b || !P.sel.canEdit(b);
  const pri = P.sel.primary("siete");
  const { can, cant } = benchGroups(P, P.sel.ver());
  const strip = [...can, ...cant];
  return (
    <div className="pz-7 is-flow is-phone">
      <div className="pz-7__peek">
        <div className="pz-7__ptop">
          <div>
            <h1>{head.t}</h1>
            <p>{head.s}</p>
          </div>
          {pri && (
            <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={pri.run} disabled={!!pri.disabled}>
              <PzIcon name={pri.icon ?? "arrow"} />
              {pri.short ?? pri.label}
            </button>
          )}
        </div>
        {strip.length > 0 && (
          <div className="pz-7__strip" role="group" aria-label="El banquillo: toca uno o súbelo al campo" data-scroll-x="1" data-pz-drop="bench">
            {strip.map((id) => {
              const r = benchRow(P, id, ro);
              const on = S.sel?.pid === id;
              return (
                <button key={id} type="button" className={`pz-7__sb${r.can ? "" : " is-off"}`} aria-pressed={on} onClick={() => P.act.tapBench(id)} onPointerDown={down(P, id, ro, r.can)} aria-label={r.aria}>
                  <RowShirt still={P.sel.shirt(id)} />
                  <small>{P.sel.name(id)}</small>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
