// r14 · Plan › El rival: who they are (the league table, the last time), their danger man (Foco on him), their seven
// with a dorsal and a note each, «En el campo» and the danger man saved with the board.
import { usePz } from "../../../store/context";
import type { Layout } from "../../../store/types";
import { PzIcon } from "../../../campo/Shirt";
import { fmt } from "../../../store/fmt";
import { FORMATION_NAMES } from "../../../../formations";
import { newRival, rivalPos, setRivalNote, setRivalNum, setRivalSystem } from "../../../../v2/rival";
import { rivalVisible, setRivalDanger, setRivalVisible, type RivalPlan } from "../../../../data/rival";
import { POSITIONS, type PosCode } from "../../../../../../lib/positions";
import { keepR14 } from "../planPlace";
import { rivalDanger } from "../planView";
import { useDrafts, usePlanTable, usePlanUi } from "../planHooks";

const posName = (code: string) => (POSITIONS[code as PosCode]?.name ?? code).toLowerCase();
const FORM_W: Record<string, string> = { G: "ganar", E: "empatar", P: "perder" };

export function RivalPart({ layout }: { layout: Layout }) {
  const P = usePz();
  const { u, setU } = usePlanUi(P);
  const T = usePlanTable(P);
  const dr = useDrafts();
  const b = P.sel.board();
  const M = P.sel.match();
  if (!b) return null;
  const L = b.lineup;
  const R = L.rival ?? null;
  const ro = !P.sel.canEdit(b);
  const d = rivalDanger(L);
  const save = (next: RivalPlan | null, label: string) => P.act.saveBoard({ rival: next }, label);
  const vsUs = P.state.W.matches.filter((x) => M && x.rival === M.rival && x.played && x.id !== M.id);
  const lastM = vsUs[vsUs.length - 1];
  const code = (M?.rival ?? "Rival").slice(0, 3).toUpperCase();
  const nNotes = R ? R.players.filter((x) => x.note).length : 0;
  const sys = (dir: 1 | -1) => () => {
    if (!R) return;
    const i = FORMATION_NAMES.indexOf(R.formation);
    const nx = FORMATION_NAMES[(i + dir + FORMATION_NAMES.length) % FORMATION_NAMES.length];
    save(keepR14(R, setRivalSystem(R, nx)), "Su sistema: " + nx);
  };
  const where = M ? [M.venue, fmt.hm(M.at)].filter(Boolean).join(" · ") : "";
  return (
    <>
      <div className="pp__ph">
        <p className="pz-kick">{"El rival" + (M ? " · " + [M.j ? "J" + M.j : "", fmt.day(M.at), M.home === true ? "en casa" : M.home === false ? "fuera" : ""].filter(Boolean).join(" · ") : "")}</p>
        <div className="pp__rivh">
          <span className="pp__crest" aria-hidden="true">
            {code}
          </span>
          <div>
            <h2>{M?.rival ?? "El rival"}</h2>
            {where && <p className="pz-meta">{where}</p>}
          </div>
        </div>
        <p className="pz-line">{lastM && lastM.gf != null ? "La última vez: " + lastM.gf + "–" + lastM.ga + "." : "Primera vez contra ellos esta temporada."}</p>
      </div>
      {T && (
        <div className="pz-stats pp__rstats" role="group" aria-label="Cómo llegan">
          <div className="pz-stat">
            <span className="pz-stat__v">{T.pos}º</span>
            <span className="pz-stat__k">En la liga</span>
            <span className="pz-stat__w">{T.pos <= 3 ? "Arriba" : "En la zona media"}</span>
          </div>
          <div className="pz-stat">
            <span className="pz-stat__v">{T.pts}</span>
            <span className="pz-stat__k">Puntos</span>
            <span className="pz-stat__w">{"en " + fmt.plural(T.pj, "partido", "partidos")}</span>
          </div>
          {T.form.length > 0 && (
            <div className="pz-stat">
              <span className="pz-stat__v pp__form" aria-label={"Racha: de " + T.form.map((c) => FORM_W[c]).join(" y ")}>
                {T.form.slice(-3).map((c, i) => (
                  <i key={i}>{c}</i>
                ))}
              </span>
              <span className="pz-stat__k">Racha</span>
              <span className="pz-stat__w">{"De " + T.form.slice(-3).map((c) => FORM_W[c]).join(" y ")}</span>
            </div>
          )}
        </div>
      )}
      {d && (
        <section className="pz-sec" aria-labelledby="pp-dg">
          <div className="pz-sec__h">
            <h3 className="pp__h3" id="pp-dg">
              El que más peligro tiene
            </h3>
          </div>
          <div className="pp__danger">
            <span className="pp__disc is-big" aria-hidden="true">
              <b>{d.num ?? "?"}</b>
              <small>{d.code}</small>
            </span>
            <div>
              <b className="t">{(d.num != null ? "Su " + d.num : "Su " + d.code) + " · " + posName(d.code)}</b>
              <q>{d.note || "El que más peligro tiene"}</q>
            </div>
          </div>
          <div className="pz-acts">
            <button type="button" className="vd-glass vd-press pz-btn" aria-pressed={u.focus} onClick={() => setU({ focus: !u.focus })}>
              <PzIcon name="eye" />
              {u.focus ? "Volver al campo entero" : "Verlo de cerca"}
            </button>
          </div>
        </section>
      )}
      <section className="pz-sec" aria-labelledby="pp-last">
        <div className="pz-sec__h">
          <h3 className="pp__h3" id="pp-last">
            La última vez
          </h3>
        </div>
        <p className="pp__lastt">{lastM && lastM.gf != null ? (lastM.j ? "J" + lastM.j + ": " : "") + lastM.gf + "–" + lastM.ga + "." : "Primera vez esta temporada."}</p>
        <p className="pp__note">{vsUs.length > 1 ? "Esta temporada: " + vsUs.map((x) => (x.gf ?? "?") + "–" + (x.ga ?? "?")).join(", ") + "." : vsUs.length ? "Una vez esta temporada." : "Nunca hemos jugado contra ellos esta temporada."}</p>
      </section>
      <section className="pz-sec" aria-labelledby="pp-s7">
        <div className="pz-sec__h">
          <h3 className="pp__h3" id="pp-s7">
            Su siete
          </h3>
          {R && <p>{fmt.plural(nNotes, "nota", "notas")}</p>}
        </div>
        {R ? (
          <>
            <div className="pp__sysrow">
              <span className="pz-meta">Su sistema</span>
              <button type="button" className="vd-glass vd-press nx-ib" onClick={sys(-1)} disabled={ro} aria-label="Su sistema anterior">
                <PzIcon name="chevL" />
              </button>
              <b>{R.formation}</b>
              <button type="button" className="vd-glass vd-press nx-ib" onClick={sys(1)} disabled={ro} aria-label="Su sistema siguiente">
                <PzIcon name="chevR" />
              </button>
            </div>
            <div className="pp__togrow">
              <button type="button" className="vx-tog" aria-pressed={rivalVisible(R)} onClick={() => save(setRivalVisible(R, !rivalVisible(R)), rivalVisible(R) ? "Su siete fuera del campo" : "Su siete en el campo")} disabled={ro}>
                <span className="vx-tog__t" aria-hidden="true" />
                En el campo
              </button>
              <span className="pp__note">Se guarda con el tablero.</span>
            </div>
            <ul className="pp__rlist">
              {R.players.map((rp, i) => {
                const c = rivalPos(R, i);
                const kN = "n" + i;
                const kT = "t" + i;
                const isD = d?.i === i;
                const saveNum = () => {
                  const raw = dr.raw(kN);
                  if (raw == null) return;
                  dr.drop(kN);
                  const next = setRivalNum(R, i, raw);
                  if (next === R) return;
                  save(keepR14(R, next), raw.trim() ? "Dorsal guardado: el " + raw.trim() + " (" + c + ")" : "Dorsal quitado (" + c + ")");
                };
                const saveNote = () => {
                  const raw = dr.raw(kT);
                  if (raw == null) return;
                  dr.drop(kT);
                  const next = setRivalNote(R, i, raw);
                  if (next === R) return;
                  save(keepR14(R, next), raw.trim() ? "Nota guardada para su " + (rp.num ?? c) : "Nota quitada");
                };
                return (
                  <li className="pp__rrow" key={i}>
                    <span className="pp__disc" aria-hidden="true">
                      <b>{rp.num ?? "?"}</b>
                      <small>{c}</small>
                    </span>
                    <div>
                      <b>
                        {"Su " + c + " · " + posName(c)}
                        {isD && <span className="pp__dtag">El peligroso</span>}
                      </b>
                      {ro ? (
                        <span className={rp.note ? "is-on" : ""}>{rp.note || "Sin nota"}</span>
                      ) : (
                        <div className="pp__in">
                          <label className="vd-glass pp__field is-num">
                            <input
                              type="text"
                              aria-label={"Dorsal de su " + c}
                              inputMode="numeric"
                              maxLength={2}
                              value={dr.get(kN, rp.num != null ? String(rp.num) : "")}
                              onChange={(e) => dr.set(kN, e.target.value.replace(/\D/g, "").slice(0, 2))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  saveNum();
                                }
                                if (e.key === "Escape") {
                                  e.stopPropagation();
                                  dr.drop(kN);
                                }
                              }}
                              onBlur={saveNum}
                            />
                          </label>
                          <label className="vd-glass pp__field pp__field--grow">
                            <input
                              type="text"
                              aria-label={"Qué hacemos con su " + (rp.num ?? "") + " (" + c + ")"}
                              maxLength={80}
                              placeholder="Qué hacemos con él"
                              value={dr.get(kT, rp.note ?? "")}
                              onChange={(e) => dr.set(kT, e.target.value.slice(0, 80))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  saveNote();
                                }
                                if (e.key === "Escape") {
                                  e.stopPropagation();
                                  dr.drop(kT);
                                }
                              }}
                              onBlur={saveNote}
                            />
                          </label>
                          <button
                            type="button"
                            className="vd-glass vd-press pp__ib"
                            aria-pressed={isD && R.danger === i}
                            aria-label={R.danger === i ? "Su " + c + " ya es el peligroso: quitar" : "Marcar a su " + c + " como el peligroso"}
                            onClick={() => save(setRivalDanger(R, R.danger === i ? null : i), R.danger === i ? "Sin peligroso elegido" : "El peligroso: su " + (rp.num ?? c))}
                          >
                            <PzIcon name="star" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {!ro && (
              <div className="pz-acts">
                <button
                  type="button"
                  className="nx-lnk"
                  onClick={() => {
                    setU({ focus: false });
                    save(null, "Su siete quitado");
                  }}
                >
                  Quitar su siete
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="pz-line">{ro ? "Este tablero no tiene su siete." : "Pon su siete enfrente y apunta qué hacer con cada uno."}</p>
            {!ro && (
              <div className="pz-acts">
                <button type="button" className="vd-glass vd-press pz-btn" onClick={() => save(newRival("2-3-1"), "Su siete en el campo, en coral: apunta sus dorsales")}>
                  <PzIcon name="plus" />
                  Poner su siete enfrente
                </button>
              </div>
            )}
          </>
        )}
      </section>
      {layout === "phone" && <div className="pp__end" aria-hidden="true" />}
    </>
  );
}
