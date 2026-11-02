// r14 «La pizarra» · Jugadas › «Jugadas de la temporada» (PZ-D05): plays kept outside any board (seasonPlays/{id},
// data/seasonPlays.ts), yours and the team's. A board USES one by naming its id in lineups.seasonPlays (no copy):
// «Usar en este tablero» / «Quitar de este tablero»; the ones it uses sit with the board's own plays and an edit
// changes them on every board that uses them. «Guardar para la temporada» (an own play) moves it there.
import { useEffect, useState } from "react";
import { usePz } from "../../store/context";
import { PzIcon } from "../../campo/Shirt";
import { createSeasonPlay, deleteSeasonPlay, useSeasonPlays, type SeasonPlay } from "../../../data/seasonPlays";
import { withSeasonPlay } from "../../../data/seasonPlayRefs";
import { type PjPlay } from "./jugadasView";
import { boardOf, canMake, seasonAll, seasonOnBoard, setSeasonPlays } from "./engine";

const MINE_MAX = 12;

/** Reads the season's plays into the place's engine (mounted once, by the region that drives the place). */
export function SeasonSync() {
  const P = usePz();
  const m = P.sel.me();
  const { plays } = useSeasonPlays(P.state.W.season.id, m.member);
  useEffect(() => {
    setSeasonPlays(P, plays);
    // oxlint-disable-next-line react/exhaustive-deps -- P is a new facade per version: only the read matters
  }, [plays]);
  return null;
}

export function SeasonPlays() {
  const P = usePz();
  const m = P.sel.me();
  const [ask, setAsk] = useState<string | null>(null);
  const b = boardOf(P);
  const mk = canMake(P);
  const refs = b?.lineup.seasonPlays ?? [];
  const all = seasonAll(P);
  const list: SeasonPlay[] = all.filter((sp) => sp.scope === "team" || sp.ownerUid === m.uid);
  const del = async (sp: SeasonPlay) => {
    setAsk(null);
    try {
      await deleteSeasonPlay(sp.id);
      P.toast(`«${sp.play.name}» ya no está en la temporada`);
    } catch {
      P.toast("No se ha podido quitar: prueba otra vez", { icon: "warn" });
    }
  };
  return (
    <section className="pz-sec" aria-labelledby="pj-season">
      <div className="pz-sec__h">
        <h2 id="pj-season">Jugadas de la temporada</h2>
        <p>{list.length ? `${refs.filter((id) => list.some((x) => x.id === id)).length} de ${list.length} en este tablero` : ""}</p>
      </div>
      {!list.length && <p className="pj-hint">Las tuyas, guardadas para todos tus tableros: la de la J2 sirve para la J3 sin copiar el tablero entero. Guarda una desde la jugada.</p>}
      {list.length > 0 && (
        <ul className="pj-srows">
          {list.map((sp) => {
            const on = refs.includes(sp.id);
            return (
              <li key={sp.id} className="pj-srow">
                <span className="pj-srow__t">
                  <b>{sp.play.name}</b>
                  <small>{`${sp.scope === "team" ? "Del equipo" : "Tuya"} · ${sp.play.frames.length} pasos${sp.ownerNickname && sp.scope === "team" ? ` · @${sp.ownerNickname}` : ""}${on ? " · en este tablero" : ""}`}</small>
                </span>
                {on ? (
                  <>
                    <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.nav(`/pizarra/jugadas/${sp.id}`)} aria-label={`Abrir «${sp.play.name}»`}>
                      <PzIcon name="play" />
                      Abrir
                    </button>
                    {mk && (
                      <button type="button" className="nx-lnk" onClick={() => seasonOnBoard(P, sp.id, false, sp.play.name)} aria-label={`Quitar «${sp.play.name}» de este tablero`}>
                        Quitar
                      </button>
                    )}
                  </>
                ) : (
                  mk && (
                    <button type="button" className="vd-glass vd-press pz-btn" onClick={() => seasonOnBoard(P, sp.id, true, sp.play.name)} aria-label={`Usar «${sp.play.name}» en este tablero`}>
                      <PzIcon name="plus" />
                      Usar
                    </button>
                  )
                )}
                {(sp.ownerUid === m.uid || m.cap) &&
                  (ask === sp.id ? (
                    <span className="pj-acts" role="alertdialog" aria-label={`¿Borrar «${sp.play.name}» de la temporada?`}>
                      <button type="button" className="vd-glass vd-press pz-btn pj-danger" onClick={() => del(sp)}>
                        Borrar de la temporada
                      </button>
                      <button type="button" className="nx-lnk" onClick={() => setAsk(null)}>
                        No
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="vd-glass vd-press nx-ib" onClick={() => setAsk(sp.id)} aria-label={`Borrar «${sp.play.name}» de la temporada (sale de todos los tableros)`}>
                      <PzIcon name="trash" />
                    </button>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** «Guardar para la temporada» on a board play: it moves to seasonPlays and this board uses it from there (captains
 *  may keep it for the whole team). */
export function KeepForSeason({ pj }: { pj: PjPlay }) {
  const P = usePz();
  const m = P.sel.me();
  const sid = P.state.W.season.id;
  const [busy, setBusy] = useState(false);
  if (!pj.own || pj.season || m.socia || !m.member || !sid || sid === "all") return null;
  const mine = seasonAll(P).filter((x) => x.scope === "mine" && x.ownerUid === m.uid).length;
  const full = mine >= MINE_MAX;
  const keep = async (scope: "mine" | "team") => {
    setBusy(true);
    try {
      const id = await createSeasonPlay({ seasonId: sid, uid: m.uid, nickname: m.nick, scope, play: pj.play });
      const b = boardOf(P);
      if (b) {
        P.act.saveBoard({ plays: (b.lineup.plays ?? []).filter((p) => p.id !== pj.id), seasonPlays: withSeasonPlay(b.lineup.seasonPlays, id, true) }, scope === "team" ? `«${pj.name}» ya es del equipo esta temporada` : `«${pj.name}» guardada para la temporada`);
        P.act.go(`/pizarra/jugadas/${id}`);
      }
    } catch {
      P.toast("No se ha podido guardar: prueba otra vez", { icon: "warn" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pj-acts">
      <button type="button" className="vd-glass vd-press pz-btn" onClick={() => keep("mine")} disabled={busy || full} aria-describedby="pj-keep-why">
        <PzIcon name="pin" />
        Guardar para la temporada
      </button>
      {m.cap && (
        <button type="button" className="nx-lnk" onClick={() => keep("team")} disabled={busy}>
          Para todo el equipo
        </button>
      )}
      <span className="pz-vh" id="pj-keep-why">
        {full ? `Ya tienes ${MINE_MAX} de la temporada: quita una para guardar otra.` : "La tendrás en todos tus tableros de la temporada, sin copiarla."}
      </span>
    </div>
  );
}
