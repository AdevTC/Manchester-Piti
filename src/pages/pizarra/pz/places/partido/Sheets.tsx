// r14 «La pizarra» · Partido's sheets: «Mandar a la mesa» (?hoja=pt-mesa: everything said before sending — what
// changes in la mesa, what travels with the seven, who is told) and «Otro cambio» (?hoja=pt-otro: who leaves, then who
// comes on, best fits first; written in the acta like «Hacer el cambio»).
import { useState } from "react";
import { usePz } from "../../store/context";
import type { SheetProps } from "../../store/types";
import { PzIcon } from "../../campo/Shirt";
import { fmt } from "../../store/fmt";
import "../../../../../styles/pz/partido.css";
import { doOtro, mesaBlock, model, sendMesa } from "./actions";
import { mesaState, plannedOf, playedOf, slotOf } from "./partidoView";
import { PtShirt } from "./Partido";

const Ic = ({ n }: { n: string }) => <PzIcon name={n} />;

export function MesaSheet(_: SheetProps) {
  const P = usePz();
  const X = model(P);
  const M = X.M;
  const b = X.b;
  const v = X.v;
  if (!M || !b || !v)
    return (
      <div className="pt pt-sh is-flow">
        <p className="pz-line">No hay siete que mandar: primero hazlo en Siete.</p>
      </div>
    );
  const N = (id: string | null | undefined) => (id ? P.sel.name(id) : "—");
  const J = M.j ? "J" + M.j : "partido";
  const st0 = mesaState(X);
  const done = st0 === "aldia" && !!X.ui.sent;
  const block = !X.decide ? "Lo mandan los capitanes y quien anota la " + J + "." : mesaBlock(P, X);
  const offline = P.state.estado === "offline";
  const old = X.feed.lineup;
  const pids = v.slots.map((s) => s.playerId);
  const oldP = old ? old.slots.map((s) => s.playerId) : [];
  const ins = pids.filter((q): q is string => !!q && !oldP.includes(q));
  const outs = oldP.filter((q) => !pids.includes(q));
  const benchNames = X.present.filter((q) => !pids.includes(q)).map(N);
  const chip = (isNew: boolean, same: boolean) => (isNew ? { chip: "Nuevo", cls: "is-guest", chipIcon: "plus" } : same ? { chip: "Igual", cls: "is-ok", chipIcon: "check" } : { chip: "Cambia", cls: "is-warn", chipIcon: "swap" });
  const sys = v.freeMode ? "libre" : v.formation;
  const rows = [
    { icon: "grid", t: "Sistema · " + v.formation, s: old ? (old.system === sys ? "El mismo de la mesa" : "Antes " + old.system) : "La mesa empieza con este sistema", ...chip(!old, !!old && old.system === sys) },
    { icon: "shirt", t: "El siete", s: old && (ins.length || outs.length) ? "Entra " + fmt.list(ins.map(N)) + " · sale " + fmt.list(outs.map(N)) : fmt.list(pids.map(N)), ...chip(!old, !!old && !ins.length && !outs.length) },
    { icon: "bench", t: "Banquillo", s: benchNames.length ? fmt.list(benchNames) : "Nadie en el banquillo", ...chip(!old, !!old) },
    { icon: "shield", t: "Portero · " + N(pids[0]), s: old && old.slots[0]?.playerId !== pids[0] ? "Antes " + N(old.slots[0]?.playerId) : "Juega de POR", ...chip(!old, !!old && old.slots[0]?.playerId === pids[0]) },
  ];
  const tk = b.lineup.takers ?? { penalties: [], freekicks: [], corners: [] };
  const hasV = (id: string) => !!b.lineup.variants?.some((x) => x.id === id);
  const vers = [hasV("v2") ? "la 2ª parte" : "", hasV("vb") ? "el Plan B" : ""].filter(Boolean);
  const nRules = b.lineup.condPlan?.length ?? 0;
  const travel = [
    { icon: "swap", t: "El plan de cambios", s: X.tandas.length ? X.tandas.map((t) => t.min + "′ " + N(t.in)).join(" · ") : "Sin cambios planeados" },
    { icon: "armband", t: "Galones", s: "Capitán " + N(b.lineup.roles.captainId) + " · penaltis " + N(tk.penalties[0]) },
    { icon: "layers", t: vers.length ? "La 2ª parte y el Plan B" : "Versiones", s: vers.length ? "La mesa ofrece " + fmt.list(vers) + " en el descanso y si toca el plan" : "El tablero no tiene 2ª parte ni Plan B" },
    { icon: "flag", t: "Si pasa…", s: nRules ? fmt.plural(nRules, "regla", "reglas") + ": la mesa la sugiere cuando se cumple" : "Sin reglas: se hacen en el Plan" },
  ];
  const notify =
    b.isOfficial && (!old || (!ins.length && !outs.length))
      ? "Nadie: es el siete oficial de la " + J + " y no cambia. «Cambio en el siete» solo sale si cambia quién juega."
      : b.isOfficial
        ? "El equipo recibe «Cambio en el siete: entra " + fmt.list(ins.map(N)) + "»."
        : "Este siete pasa a ser el oficial de la " + J + " y el equipo recibe «Ya está el siete».";
  const btn = offline ? "Mandar al volver la señal" : X.ui.busy ? "Mandando…" : st0 === "aldia" ? "Volver a mandar" : "Mandar a la mesa";
  const mesaHref = "/partidos/" + encodeURIComponent(M.id) + "/mesa";
  if (done)
    return (
      <div className="pt pt-sh is-flow">
        <div className="pt-done" role="status">
          <span className="vx-tile">
            <Ic n="check" />
          </span>
          <b>Siete en la mesa</b>
          <p className="pz-line">La mesa y la página del partido ya tienen este siete. Hasta el pitido puedes volver a mandarlo.</p>
          <div className="pz-acts">
            <a className="vd-glass vd-press pz-btn pz-btn--pri" href={mesaHref}>
              <Ic n="board" />
              Abrir la mesa
            </a>
            <button type="button" className="nx-lnk" onClick={() => P.act.closeSheet()}>
              Seguir en la pizarra
            </button>
          </div>
        </div>
      </div>
    );
  return (
    <div className="pt pt-sh is-flow">
      <p className="pz-line">{st0 === "sin" ? "La mesa aún no tiene siete. Al mandarlo, la mesa y la página del partido pasan a este." : st0 === "aldia" ? "La mesa ya tiene este siete: mandarlo otra vez no cambia nada." : "La mesa tiene otro siete. Al mandarlo, pasa a este."}</p>
      {block && (
        <div className="pt-warn" role="alert">
          <b>Aún no se puede mandar</b>
          <span>{block}</span>
        </div>
      )}
      {offline && (
        <div className="pt-warn" role="status">
          <b>Sin conexión</b>
          <span>Se manda cuando vuelva la señal; hasta entonces la mesa sigue con lo que tenía.</span>
        </div>
      )}
      <p className="pt-step">Lo que cambia en la mesa</p>
      <ul className="pt-rows">
        {rows.map((r) => (
          <li key={r.t}>
            <span className="vx-tile">
              <Ic n={r.icon} />
            </span>
            <div>
              <b>{r.t}</b>
              <span>{r.s}</span>
            </div>
            <span className={`pz-chip ${r.cls}`}>
              <Ic n={r.chipIcon} />
              {r.chip}
            </span>
          </li>
        ))}
      </ul>
      <p className="pt-step">Viaja con el siete</p>
      <ul className="pt-rows">
        {travel.map((r) => (
          <li key={r.t}>
            <span className="vx-tile">
              <Ic n={r.icon} />
            </span>
            <div>
              <b>{r.t}</b>
              <span>{r.s}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="pt-step">A quién se avisa</p>
      <p className="pz-line">{notify}</p>
      <div className="pz-acts">
        <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => void sendMesa(P)} disabled={!!block || offline || X.ui.busy}>
          <Ic n="send" />
          {btn}
        </button>
        <button type="button" className="nx-lnk" onClick={() => P.act.closeSheet()}>
          Cancelar
        </button>
      </div>
      <p className="pz-meta">Hasta el pitido. Si alguien lo cambia en la mesa, aquí lo verás al momento.</p>
    </div>
  );
}

export function OtroSheet(_: SheetProps) {
  const P = usePz();
  const X = model(P);
  const [pick, setPick] = useState<{ out: string | null; in: string | null }>({ out: null, in: null });
  const L = X.L;
  const N = (id: string) => P.sel.name(id);
  const canChange = X.decide && !X.ro && (X.ph === "juego" || X.ph === "descanso");
  if (!L || !canChange)
    return (
      <div className="pt pt-sh is-flow">
        <p className="pt-step">{!L ? "El partido no está en juego." : "Los cambios los apuntan los capitanes y quien anota el partido."}</p>
      </div>
    );
  const out = pick.out && X.field.includes(pick.out) ? pick.out : null;
  if (!out)
    return (
      <div className="pt pt-sh is-flow">
        <p className="pt-step">Paso 1 de 2 · ¿Quién sale?</p>
        <ul className="pz-rows pt-pick">
          {L.slots
            .filter((s): s is typeof s & { playerId: string } => !!s.playerId)
            .map((s) => {
              const mk = L.marks[s.playerId] ?? [];
              return (
                <li key={s.playerId}>
                  <button type="button" className="pz-row" onClick={() => setPick({ out: s.playerId, in: null })} aria-label={"Sale " + N(s.playerId) + ", " + s.code + ", " + playedOf(X, s.playerId) + " minutos hoy"}>
                    <PtShirt pid={s.playerId} />
                    <span className="pz-row__t">
                      <b>{N(s.playerId)}</b>
                      <span>{s.code + (X.ui.cant[s.playerId] ? " · no puede seguir" : "") + (mk.length ? " · " + mk.map((m) => m.t.toLowerCase()).join(", ") : "")}</span>
                    </span>
                    <span className="pt-v pt-mono">{playedOf(X, s.playerId)}′</span>
                  </button>
                </li>
              );
            })}
        </ul>
      </div>
    );
  const code = slotOf(X, out);
  const fitOf = (q: string) => (code ? (P.sel.fit(q, code as Parameters<typeof P.sel.fit>[1]) ?? 0) : 0);
  const cands = X.bench.slice().sort((a, c) => fitOf(c) - fitOf(a));
  const inn = pick.in && cands.includes(pick.in) ? pick.in : null;
  return (
    <div className="pt pt-sh is-flow">
      <p className="pt-step">Paso 2 de 2 · ¿Quién entra?</p>
      <p className="pz-line">Sale {N(out)} ({code}). Primero los que mejor encajan en su sitio.</p>
      {cands.length ? (
        <ul className="pz-rows pt-pick">
          {cands.map((q) => (
            <li key={q}>
              <button type="button" className="pz-row" aria-pressed={inn === q} onClick={() => setPick({ out, in: q })} aria-label={"Entra " + N(q) + ", " + P.sel.fitWord(code ? P.sel.fit(q, code as Parameters<typeof P.sel.fit>[1]) : null)}>
                <PtShirt pid={q} />
                <span className="pz-row__t">
                  <b>{N(q)}</b>
                  <span>{P.sel.fitWord(code ? P.sel.fit(q, code as Parameters<typeof P.sel.fit>[1]) : null) + (code ? " de " + code : "") + " · " + playedOf(X, q) + "′ de " + plannedOf(X, q) + "′ planeados"}</span>
                </span>
                <span className="pt-v pt-mono">{playedOf(X, q)}′</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pz-meta">No hay nadie en el banquillo que pueda entrar.</p>
      )}
      <div className="pz-acts">
        <button
          type="button"
          className="vd-glass vd-press pz-btn pz-btn--pri"
          disabled={!inn || X.ui.busy}
          onClick={() => {
            if (!inn) return;
            void doOtro(P, out, inn).then((ok) => {
              if (ok) {
                setPick({ out: null, in: null });
                P.act.closeSheet();
              }
            });
          }}
        >
          <Ic n="swap" />
          {inn ? "Hacer el cambio · entra " + N(inn) : "Elige quién entra"}
        </button>
        <button type="button" className="nx-lnk" onClick={() => setPick({ out: null, in: null })}>
          Elegir a otro
        </button>
      </div>
    </div>
  );
}
