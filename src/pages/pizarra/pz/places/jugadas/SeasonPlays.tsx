// r14 «La pizarra» · Jugadas › «Jugadas de la temporada» (PZ-D05): plays kept outside any board (seasonPlays/{id},
// data/seasonPlays.ts): yours and the team's. «Traer a este tablero» puts one among this board's own plays (the J2's
// serves the J3 without copying the whole board); «Guardar para la temporada» (in an own play) keeps one there.
import { useState } from "react";
import { usePz } from "../../store/context";
import { PzIcon } from "../../campo/Shirt";
import { createSeasonPlay, deleteSeasonPlay, useSeasonPlays, type SeasonPlay } from "../../../data/seasonPlays";
import type { Play } from "../../../plays";
import { newId } from "../../../drawings";
import { MAX_OWN, freeName, type PjPlay } from "./jugadasView";
import { boardOf, canMake } from "./engine";

const MINE_MAX = 12;

export function SeasonPlays() {
  const P = usePz();
  const m = P.sel.me();
  const sid = P.state.W.season.id;
  const { team, mine, loading, error } = useSeasonPlays(sid, m.member);
  const [ask, setAsk] = useState<string | null>(null);
  const b = boardOf(P);
  const mk = canMake(P);
  const list: SeasonPlay[] = [...team, ...mine(m.uid)];
  const bring = (sp: SeasonPlay) => {
    if (!b) return;
    const plays = b.lineup.plays ?? [];
    if (plays.length >= MAX_OWN) {
      P.toast(`Ya tienes ${MAX_OWN} jugadas en este tablero: borra una para traer otra`, { icon: "warn" });
      return;
    }
    const copy: Play = { ...structuredClone(sp.play), id: newId("j"), name: freeName(sp.play.name, plays.map((p) => p.name)) };
    if (P.act.saveBoard({ plays: [...plays, copy] }, `«${sp.play.name}» ya está en este tablero`)) P.act.go(`/pizarra/jugadas/${copy.id}`);
  };
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
        <p>{loading ? "Leyendo…" : `${list.length}`}</p>
      </div>
      {error && (
        <p className="pj-hint" role="status">
          No se han podido leer ahora.
        </p>
      )}
      {!loading && !error && !list.length && <p className="pj-hint">Las tuyas, guardadas para todos tus tableros: la de la J2 sirve para la J3 sin copiar el tablero entero. Guarda una desde la jugada.</p>}
      {list.length > 0 && (
        <ul className="pj-srows">
          {list.map((sp) => (
            <li key={sp.id} className="pj-srow">
              <span className="pj-srow__t">
                <b>{sp.play.name}</b>
                <small>{`${sp.scope === "team" ? "Del equipo" : "Tuya"} · ${sp.play.frames.length} pasos${sp.ownerNickname && sp.scope === "team" ? ` · @${sp.ownerNickname}` : ""}`}</small>
              </span>
              {mk && (
                <button type="button" className="vd-glass vd-press pz-btn" onClick={() => bring(sp)} aria-label={`Traer «${sp.play.name}» a este tablero`}>
                  <PzIcon name="plus" />
                  Traer
                </button>
              )}
              {(sp.ownerUid === m.uid || m.cap) &&
                (ask === sp.id ? (
                  <span className="pj-acts">
                    <button type="button" className="vd-glass vd-press pz-btn pj-danger" onClick={() => del(sp)}>
                      Quitar
                    </button>
                    <button type="button" className="nx-lnk" onClick={() => setAsk(null)}>
                      No
                    </button>
                  </span>
                ) : (
                  <button type="button" className="vd-glass vd-press nx-ib" onClick={() => setAsk(sp.id)} aria-label={`Quitar «${sp.play.name}» de la temporada`}>
                    <PzIcon name="trash" />
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** «Guardar para la temporada» on an own play (captains may keep it for the whole team). */
export function KeepForSeason({ pj }: { pj: PjPlay }) {
  const P = usePz();
  const m = P.sel.me();
  const sid = P.state.W.season.id;
  const { mine, plays } = useSeasonPlays(sid, m.member && pj.own);
  const [busy, setBusy] = useState(false);
  if (!pj.own || m.socia || !m.member || !sid || sid === "all") return null;
  const kept = plays.some((x) => x.play.name === pj.name && x.ownerUid === m.uid);
  const full = mine(m.uid).length >= MINE_MAX;
  const keep = async (scope: "mine" | "team") => {
    setBusy(true);
    try {
      await createSeasonPlay({ seasonId: sid, uid: m.uid, nickname: m.nick, scope, play: pj.play });
      P.toast(scope === "team" ? `«${pj.name}» ya es del equipo esta temporada` : `«${pj.name}» guardada para la temporada`);
    } catch {
      P.toast("No se ha podido guardar: prueba otra vez", { icon: "warn" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pj-acts">
      <button type="button" className="vd-glass vd-press pz-btn" onClick={() => keep("mine")} disabled={busy || kept || full} aria-describedby="pj-keep-why">
        <PzIcon name="pin" />
        {kept ? "Ya está en la temporada" : "Guardar para la temporada"}
      </button>
      {m.cap && (
        <button type="button" className="nx-lnk" onClick={() => keep("team")} disabled={busy}>
          Para todo el equipo
        </button>
      )}
      <span className="pz-vh" id="pj-keep-why">
        {full ? `Ya tienes ${MINE_MAX} de la temporada: quita una para guardar otra.` : "La tendrás en todos tus tableros de la temporada."}
      </span>
    </div>
  );
}
