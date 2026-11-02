// r14 · Plan › Si pasa…: each rule is a sentence of chips («Si vamos [perdiendo] por [1] desde el [35′] → [más
// arriba] + [entra X por Y] + [Plan B]»), ≤ 3, shown on the pitch; live, it says whether it is its moment. La mesa
// gets the suggestion when it comes true (setMatchLineup sends condPlan).
import { usePz } from "../../../store/context";
import type { Layout } from "../../../store/types";
import { PzIcon } from "../../../campo/Shirt";
import { COND_KEEP, type CondRuleR14, type CondVer } from "../../../../data/condPlan";
import { TACTICA_LIMITS } from "../../../../../../lib/tacticaSchemas";
import { durationOf } from "../../../../v2/live";
import { applyRule, newRuleId } from "../planPlace";
import { planLiveState, ruleConse, ruleLive, RULE_CONSE, RULE_VERS, WHEN_WORD } from "../planView";
import { usePlanUi } from "../planHooks";

const WHEN: CondRuleR14["when"][] = ["perdiendo", "empate", "ganando"];
const VERB: Record<CondRuleR14["when"], string> = { perdiendo: "perdemos", empate: "empatamos", ganando: "ganamos" };

type Word = { chip: false; t: string; cls: string } | { chip: true; id: string; t: string; aria: string };

export function SipasaPart({ layout: _layout }: { layout: Layout }) {
  const P = usePz();
  const { u, setU } = usePlanUi(P);
  const b = P.sel.board();
  if (!b) return null;
  const L = b.lineup;
  const ro = !P.sel.canEdit(b);
  const rules = L.condPlan ?? [];
  const n = (id: string) => P.sel.name(id);
  const v = P.sel.ver(b, "titular");
  const onField = v ? v.slots.map((s) => s.playerId).filter((x): x is string => !!x) : [];
  const benchAvail = P.state.W.squad.map((x) => x.id).filter((id) => !onField.includes(id) && P.sel.rsvp(id).can);
  const M = P.sel.match(b.matchId);
  const dur = durationOf(M?.cal ?? null);
  const liveS = planLiveState(P, M);
  const setRule = (rid: string, label: string, fn: (y: CondRuleR14) => void) => {
    const cur = P.sel.board()?.lineup.condPlan ?? rules;
    P.act.saveBoard(
      {
        condPlan: cur.map((x) => {
          if (x.id !== rid) return x;
          const y: CondRuleR14 = structuredClone(x);
          fn(y);
          return y;
        }),
      },
      label,
    );
  };
  const close = () => setU({ edit: null });
  const shownId = u.showRule && rules.some((r) => r.id === u.showRule) ? u.showRule : rules[0]?.id;
  const h = rules.length ? (rules.length === 1 ? "Un plan si " + VERB[rules[0].when] : rules.length + " planes por si acaso") : "Nada previsto si se tuerce";
  return (
    <>
      <div className="pp__ph">
        <p className="pz-kick">{"Si pasa… · " + rules.length + " de " + TACTICA_LIMITS.rules}</p>
        <h2>{h}</h2>
        <p className="pz-line">{rules.length ? (ro ? "Lo que haremos si el partido se tuerce." : "Cada regla es una frase: toca una palabra subrayada para cambiarla.") : "Una frase por regla: si vamos así desde el minuto tal, hacemos esto."}</p>
      </div>
      {rules.map((r) => {
        const open = u.edit && u.edit.rid === r.id ? u.edit.chip : null;
        const c = ruleConse(r);
        const verT = RULE_VERS.find((x) => x[0] === (r.ver ?? null))?.[1] ?? "sin cambiar de versión";
        const subT = r.sub ? "entra " + n(r.sub.in) + " por " + n(r.sub.out) : "sin cambio";
        const words: Word[] = [
          { chip: false, t: "Si vamos", cls: "pp__w" },
          { chip: true, id: "when", t: WHEN_WORD[r.when], aria: "Si vamos: " + WHEN_WORD[r.when] + ". Cambiar" },
        ];
        if (r.when !== "empate") words.push({ chip: false, t: "por", cls: "pp__w" }, { chip: true, id: "by", t: String(r.by), aria: "Por " + r.by + " goles. Cambiar" });
        words.push({ chip: false, t: "desde el", cls: "pp__w" }, { chip: true, id: "from", t: r.from + "′", aria: "Desde el minuto " + r.from + ". Cambiar" }, { chip: false, t: "→", cls: "pp__arrow" });
        words.push({ chip: true, id: "conse", t: c.t, aria: "Qué cambia: " + c.t + ". Cambiar" }, { chip: false, t: "+", cls: "pp__arrow" });
        words.push({ chip: true, id: "sub", t: subT, aria: "El cambio: " + (r.sub ? subT : "ninguno") + ". Cambiar" }, { chip: false, t: "+", cls: "pp__arrow" });
        words.push({ chip: true, id: "ver", t: verT, aria: "La versión: " + verT + ". Cambiar" });
        const L1 = liveS ? ruleLive(r, liveS) : null;
        const shown = shownId === r.id;
        return (
          <div className="pp__rule" key={r.id}>
            <p className="pp__sent">
              {words.map((w, i) =>
                !w.chip ? (
                  <span key={i} className={w.cls}>
                    {w.t}
                  </span>
                ) : ro ? (
                  <span key={i} className="pp__val">
                    {w.t}
                  </span>
                ) : (
                  <button key={i} type="button" className="vd-glass vd-press pp__chip" aria-expanded={open === w.id} onClick={() => setU({ edit: open === w.id ? null : { rid: r.id, chip: w.id }, showRule: r.id })} aria-label={w.aria}>
                    {w.t}
                  </button>
                ),
              )}
            </p>
            {open && !ro && (
              <div className="pp__pick" role="group" aria-label={open === "when" ? "Si vamos" : open === "by" ? "Por cuántos goles" : open === "from" ? "Desde el minuto" : open === "conse" ? "Qué cambia" : open === "sub" ? "El cambio" : "La versión"}>
                {open === "when" && (
                  <>
                    <p>Si vamos…</p>
                    <div className="pp__opts">
                      {WHEN.map((w) => (
                        <button
                          key={w}
                          type="button"
                          className="vd-glass vd-press pp__opt"
                          aria-pressed={r.when === w}
                          onClick={() => {
                            if (r.when !== w)
                              setRule(r.id, "Si vamos " + WHEN_WORD[w], (y) => {
                                y.when = w;
                                y.by = w === "empate" ? 0 : Math.max(1, y.by);
                              });
                            close();
                          }}
                        >
                          {WHEN_WORD[w]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {open === "by" && (
                  <>
                    <p>Por cuántos goles (o más)</p>
                    <div className="pp__opts">
                      {[1, 2, 3].map((k) => (
                        <button
                          key={k}
                          type="button"
                          className="vd-glass vd-press pp__opt"
                          aria-pressed={r.by === k}
                          onClick={() => {
                            if (r.by !== k)
                              setRule(r.id, "Por " + k + " o más", (y) => {
                                y.by = k;
                              });
                            close();
                          }}
                        >
                          {k === 3 ? "3 o más" : String(k)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {open === "from" && (
                  <>
                    <p>{"Desde el minuto (el partido dura " + dur + ")"}</p>
                    <div className="pp__min">
                      <button type="button" className="vd-glass vd-press pp__ib" disabled={r.from <= 5} onClick={() => setRule(r.id, "Desde el " + Math.max(5, r.from - 5) + "′", (y) => (y.from = Math.max(5, r.from - 5)))} aria-label="Cinco minutos antes">
                        <PzIcon name="chevL" />
                      </button>
                      <b aria-live="polite">{r.from}′</b>
                      <button type="button" className="vd-glass vd-press pp__ib" disabled={r.from >= dur - 5} onClick={() => setRule(r.id, "Desde el " + Math.min(dur - 5, r.from + 5) + "′", (y) => (y.from = Math.min(dur - 5, r.from + 5)))} aria-label="Cinco minutos después">
                        <PzIcon name="chevR" />
                      </button>
                    </div>
                    <div className="pp__opts">
                      {[15, 25, 30, 35, 40]
                        .filter((m) => m < dur)
                        .map((m) => (
                          <button key={m} type="button" className="vd-glass vd-press pp__opt" aria-pressed={r.from === m} onClick={() => r.from !== m && setRule(r.id, "Desde el " + m + "′", (y) => (y.from = m))}>
                            {m}′
                          </button>
                        ))}
                    </div>
                  </>
                )}
                {open === "conse" && (
                  <>
                    <p>Qué cambia en el equipo</p>
                    <div className="pp__opts">
                      {RULE_CONSE.map((x) => {
                        const on = x.key ? r.key === x.key && r.value === x.value : r.value === COND_KEEP;
                        return (
                          <button
                            key={x.id}
                            type="button"
                            className="vd-glass vd-press pp__opt"
                            aria-pressed={on}
                            onClick={() => {
                              if (!on)
                                setRule(r.id, "Entonces: " + x.t, (y) => {
                                  if (x.key && x.value) {
                                    y.key = x.key;
                                    y.value = x.value;
                                  } else y.value = COND_KEEP;
                                });
                              close();
                            }}
                          >
                            {x.t}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                {open === "sub" && (
                  <>
                    <p>Sale</p>
                    <div className="pp__opts">
                      <button type="button" className="vd-glass vd-press pp__opt" aria-pressed={!r.sub} onClick={() => r.sub && setRule(r.id, "Sin cambio", (y) => delete y.sub)}>
                        Sin cambio
                      </button>
                      {onField.map((pid) => (
                        <button
                          key={pid}
                          type="button"
                          className="vd-glass vd-press pp__opt"
                          aria-pressed={r.sub?.out === pid}
                          onClick={() => {
                            const inn = r.sub?.in && r.sub.in !== pid ? r.sub.in : benchAvail.find((x) => x !== pid);
                            if (!inn) {
                              P.toast("No hay nadie en el banquillo para entrar");
                              return;
                            }
                            setRule(r.id, "Sale " + n(pid) + ", entra " + n(inn), (y) => (y.sub = { out: pid, in: inn }));
                          }}
                        >
                          {n(pid)}
                        </button>
                      ))}
                    </div>
                    {r.sub && (
                      <>
                        <p>Entra</p>
                        <div className="pp__opts">
                          {benchAvail.map((pid) => (
                            <button key={pid} type="button" className="vd-glass vd-press pp__opt" aria-pressed={r.sub?.in === pid} disabled={pid === r.sub?.out} onClick={() => r.sub && r.sub.in !== pid && setRule(r.id, "Entra " + n(pid), (y) => (y.sub = { out: r.sub?.out ?? "", in: pid }))}>
                              {n(pid)}
                            </button>
                          ))}
                          {!benchAvail.length && <span className="pp__note">Nadie disponible en el banquillo.</span>}
                        </div>
                      </>
                    )}
                  </>
                )}
                {open === "ver" && (
                  <>
                    <p>Y la versión del siete</p>
                    <div className="pp__opts">
                      {RULE_VERS.map(([id, t]) => {
                        const exists = !id || !!P.sel.ver(b, id)?.exists;
                        return (
                          <button
                            key={t}
                            type="button"
                            className="vd-glass vd-press pp__opt"
                            aria-pressed={(r.ver ?? null) === id}
                            disabled={!exists}
                            title={exists ? undefined : "Este tablero no tiene " + t + ": créala en el Siete"}
                            onClick={() => {
                              if ((r.ver ?? null) !== id)
                                setRule(r.id, id ? "Con la versión " + t : "Sin cambiar de versión", (y) => {
                                  if (id) y.ver = id as CondVer;
                                  else delete y.ver;
                                });
                              close();
                            }}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                <div className="pz-acts">
                  <button type="button" className="nx-lnk" onClick={close}>
                    Listo
                  </button>
                </div>
              </div>
            )}
            {L1 && (
              <div className={`pp__live${L1.on ? " is-on" : ""}`} role="status">
                <PzIcon name={L1.on ? "bellOn" : "clock"} />
                <div>
                  <span>{L1.t}</span>
                  {L1.on && !ro && (
                    <div className="pz-acts">
                      <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => applyRule(P, r)}>
                        Aplicar el plan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="pz-acts">
              <button type="button" className="vd-glass vd-press pz-btn" aria-pressed={shown} onClick={() => setU({ showRule: r.id })}>
                <PzIcon name="pitch" />
                {shown ? "En el campo" : "Verla en el campo"}
              </button>
              {!ro && (
                <button
                  type="button"
                  className="nx-lnk"
                  onClick={() => {
                    setU({ edit: null, showRule: null });
                    P.act.saveBoard({ condPlan: (P.sel.board()?.lineup.condPlan ?? rules).filter((x) => x.id !== r.id) }, "Regla quitada");
                  }}
                >
                  Quitar esta regla
                </button>
              )}
            </div>
          </div>
        );
      })}
      {!rules.length && <p className="pz-line pp__pad">{ro ? "Este plan no tiene reglas." : "Por ejemplo: «si vamos perdiendo por 1 desde el 35′ → más arriba»."}</p>}
      {!ro && rules.length < TACTICA_LIMITS.rules && (
        <div className="pz-acts pp__pad">
          <button
            type="button"
            className="vd-glass vd-press pz-btn"
            onClick={() => {
              const id = newRuleId();
              const first = !rules.length;
              const r: CondRuleR14 = { id, when: first ? "perdiendo" : "ganando", by: 1, from: Math.min(35, dur - 5), key: "mentality", value: first ? "Ofensiva" : "Defensiva" };
              P.act.saveBoard({ condPlan: [...(P.sel.board()?.lineup.condPlan ?? rules), r] }, "Regla añadida");
              setU({ showRule: id, edit: null });
            }}
          >
            <PzIcon name="plus" />
            {rules.length ? "Añadir otra · " + rules.length + " de " + TACTICA_LIMITS.rules : "Añadir la primera"}
          </button>
        </div>
      )}
      <p className="pp__note pp__pad">En el partido se convierte en un aviso cuando se cumple, y la mesa también lo ve.</p>
    </>
  );
}
