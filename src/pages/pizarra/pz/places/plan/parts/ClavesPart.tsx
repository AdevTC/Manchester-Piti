// r14 · Plan › Nuestras claves: three at most, each one lights something on the pitch (its icon and its zone are
// saved with the board), up and down by importance, ideas to start.
import { usePz } from "../../../store/context";
import type { Layout } from "../../../store/types";
import { PzIcon } from "../../../campo/Shirt";
import { PLAN_LIMITS } from "../../../../data/plan";
import { IDEAS, KEY_ICON_NAMES, VIZ, withPlan } from "../planPlace";
import { planOf, rivalDanger, vizOf } from "../planView";
import { useDrafts, usePlanUi } from "../planHooks";

const N_WORD = ["Ninguna clave", "Una clave", "Dos claves", "Tres claves"];

export function ClavesPart({ layout: _layout }: { layout: Layout }) {
  const P = usePz();
  const { u, setU } = usePlanUi(P);
  const dr = useDrafts();
  const b = P.sel.board();
  if (!b) return null;
  const L = b.lineup;
  const ro = !P.sel.canEdit(b);
  const pl = planOf(L);
  const n = pl.claves.length;
  const keyIdx = Math.min(u.clave, n - 1);
  const save = (label: string, fn: Parameters<typeof withPlan>[1]) => P.act.saveBoard(withPlan(P.sel.board()?.lineup ?? L, fn), label);
  const moveKey = (i: number, d: 1 | -1) => {
    save("Clave movida", (x) => {
      const j = i + d;
      [x.claves[i], x.claves[j]] = [x.claves[j], x.claves[i]];
      [x.viz[i], x.viz[j]] = [x.viz[j], x.viz[i]];
    });
    setU({ clave: i + d, editKey: i + d });
  };
  const addKey = (t: string) => () => {
    save("Clave añadida", (x) => {
      x.claves.push(t);
      x.viz.push(vizOf({ ...L, plan: { claves: [t], viz: [], notes: "", parado: null } }, 0));
    });
    setU({ clave: n, editKey: t === "Nueva clave" ? n : -1 });
  };
  const ideas = IDEAS.filter((t) => !pl.claves.includes(t)).slice(0, 3);
  const hasDanger = !!rivalDanger(L);
  return (
    <>
      <div className="pp__ph">
        <p className="pz-kick">Nuestras claves · lo que todos tienen que saber</p>
        <h2>{N_WORD[n] ?? n + " claves"}</h2>
        <p className="pz-line">{n ? "Tócalas para encenderlas en el campo" + (ro ? "." : "; súbelas o bájalas por importancia.") : "Tres como mucho: lo que todos tienen que recordar."}</p>
      </div>
      <ul className="pp__keys">
        {pl.claves.map((t, i) => {
          const z = vizOf(L, i);
          const kk = "k" + i;
          const editing = !ro && u.editKey === i;
          const commit = () => {
            const raw = dr.raw(kk);
            if (raw == null) return;
            dr.drop(kk);
            const nv = raw.replace(/\s+/g, " ").trim().slice(0, PLAN_LIMITS.clave);
            if (!nv || nv === t) return;
            save("Clave cambiada", (x) => {
              x.claves[i] = nv;
            });
          };
          const zt = (VIZ.find((x) => x.id === z.zona) ?? VIZ[0]).t.toLowerCase();
          return (
            <li className="pp__key" key={i}>
              <button
                type="button"
                className="pp__keyb"
                aria-pressed={i === keyIdx}
                aria-expanded={ro ? undefined : editing}
                onClick={() => setU({ clave: i, editKey: ro ? -1 : u.editKey === i ? -1 : i })}
                aria-label={t + ". Toca para encenderla en el campo" + (ro ? "" : " y cambiarla")}
              >
                <span className="vx-tile">
                  <PzIcon name={z.icon} />
                </span>
                <span>
                  <b>{t}</b>
                  <small>
                    <PzIcon name="pitch" />
                    {z.zona === "nada" ? "No enciende nada en el campo" : "En el campo: " + zt}
                  </small>
                </span>
              </button>
              {editing && (
                <div className="pp__kedit">
                  <label className="vd-glass pp__field">
                    <input
                      type="text"
                      aria-label="Texto de la clave"
                      maxLength={PLAN_LIMITS.clave}
                      value={dr.get(kk, t)}
                      onChange={(e) => dr.set(kk, e.target.value.slice(0, PLAN_LIMITS.clave))}
                      onBlur={commit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commit();
                        }
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          dr.drop(kk);
                        }
                        if (e.altKey && e.key === "ArrowUp" && i > 0) {
                          e.preventDefault();
                          moveKey(i, -1);
                        }
                        if (e.altKey && e.key === "ArrowDown" && i < n - 1) {
                          e.preventDefault();
                          moveKey(i, 1);
                        }
                      }}
                    />
                  </label>
                  <div className="pp__ktools" role="group" aria-label="Icono de la clave">
                    {KEY_ICON_NAMES.map(([id, name]) => (
                      <button
                        key={id}
                        type="button"
                        className="vd-glass vd-press pp__ib"
                        aria-pressed={z.icon === id}
                        aria-label={"Icono: " + name}
                        onClick={() =>
                          save("Icono de la clave: " + name.toLowerCase(), (x) => {
                            x.viz[i] = { ...x.viz[i], icon: id };
                          })
                        }
                      >
                        <PzIcon name={id} />
                      </button>
                    ))}
                  </div>
                  <p className="pp__note">
                    <b>En el campo:</b> lo que se enciende al tocarla
                  </p>
                  <div className="pp__opts" role="group" aria-label="Qué enciende en el campo">
                    {VIZ.filter((x) => x.id !== "su7" || hasDanger).map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        className="vd-glass vd-press pp__opt"
                        aria-pressed={z.zona === x.id}
                        onClick={() =>
                          save("En el campo: " + x.t.toLowerCase(), (y) => {
                            y.viz[i] = { ...y.viz[i], zona: x.id };
                          })
                        }
                      >
                        {x.t}
                      </button>
                    ))}
                  </div>
                  <div className="pp__ktools">
                    <button type="button" className="vd-glass vd-press pp__ib" onClick={() => moveKey(i, -1)} disabled={i === 0} aria-label={"Subir «" + t + "»"} aria-keyshortcuts="Alt+ArrowUp">
                      <PzIcon name="chevL" className="pp__rot90" />
                    </button>
                    <button type="button" className="vd-glass vd-press pp__ib" onClick={() => moveKey(i, 1)} disabled={i === n - 1} aria-label={"Bajar «" + t + "»"} aria-keyshortcuts="Alt+ArrowDown">
                      <PzIcon name="chevR" className="pp__rot90" />
                    </button>
                    <button
                      type="button"
                      className="nx-lnk pp__push"
                      onClick={() => {
                        setU({ editKey: -1, clave: 0 });
                        save("Clave quitada", (x) => {
                          x.claves.splice(i, 1);
                          x.viz.splice(i, 1);
                        });
                      }}
                    >
                      Quitar esta clave
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!n && <p className="pz-line pp__pad">{ro ? "Este plan aún no tiene claves." : "Empieza por la más importante."}</p>}
      {!ro && n < PLAN_LIMITS.claves && (
        <section className="pz-sec">
          <div className="pz-acts">
            <button type="button" className="vd-glass vd-press pz-btn" onClick={addKey("Nueva clave")}>
              <PzIcon name="plus" />
              {n ? "Añadir otra · caben " + (3 - n) : "Añadir la primera"}
            </button>
          </div>
          {ideas.length > 0 && (
            <div className="pp__ideas">
              <span>Ideas:</span>
              {ideas.map((t) => (
                <button key={t} type="button" className="vd-glass vd-press pp__opt" onClick={addKey(t)}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      {!ro && n >= PLAN_LIMITS.claves && <p className="pp__note pp__pad">Caben tres: quita una para poner otra.</p>}
    </>
  );
}
