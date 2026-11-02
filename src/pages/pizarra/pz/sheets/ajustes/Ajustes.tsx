// r14 «La pizarra» · the «Ajustes de la pizarra» sheet (PiAjustes.dc.html): the one place for each of your pizarra
// settings — Sonido, Cámara al entrar, Capa al abrir el siete, las camisetas (nombre, galones), Movimiento — and
// links to the board's settings where they live (rival, forma libre, dibujos). They follow you to any device
// (users/{uid}/private/pizarra, PZ-D21E) and change the pizarra at once (PrefsBoot, store.stageDefaults).
import { usePz } from "../../store/context";
import type { SheetProps } from "../../store/types";
import type { PzPrefs } from "../../store/api";
import { LAYERS } from "../../store/store";
import { PiCampo } from "../../campo/PiCampo";
import { PzIcon } from "../../campo/Shirt";
import { PREFS_DEFAULT } from "../../../data/prefs";
import { changePrefs, prefsNow, sheetDefault, sonar, systemReduced, SHEET_KEYS } from "./prefsLive";
import "../../../../../styles/pz/pachanga.css";

const CAPA_LINE: Record<string, string> = {
  nada: "Solo las camisetas: el campo limpio.",
  media: "Media: la GLOBAL de la temporada, la misma de su carta.",
  nota: "Nota: la del último partido que jugó, de 1 a 10.",
  quimica: "Química: cómo se entienden los que juegan al lado, en palabras.",
  forma: "Forma: cómo llega cada uno, por sus últimos partidos.",
  minutos: "Minutos: los que lleva jugados esta temporada.",
};
const CAMS = [
  { id: "sitio", t: "Según el sitio", s: "Pizarra para editar, Grada para leer" },
  { id: "pizarra", t: "Pizarra", s: "Desde arriba, para mover" },
  { id: "grada", t: "Grada", s: "Como en la tele, para leer" },
] as const;
const CAM_WORD: Record<string, string> = { sitio: "La de cada sitio", pizarra: "Siempre Pizarra", grada: "Siempre Grada", foco: "Siempre Foco" };

export function AjustesSheet({ layout }: SheetProps) {
  const P = usePz();
  const pf = prefsNow(P);
  const set = (patch: Partial<PzPrefs>, said?: string) => {
    changePrefs(P, patch);
    if (said) P.say(said);
  };
  const device = layout === "phone" ? "este móvil" : "este ordenador";
  const signed = !!P.sel.me().uid;
  const place = P.state.route.place;
  const b = P.sel.board();
  const ro = !P.sel.canEdit(b);
  const me = P.sel.me();
  const pid = me.pid && P.sel.player(me.pid) ? me.pid : (P.sel.ver()?.slots.find((s) => s.playerId)?.playerId ?? P.state.W.squad[0]?.id ?? null);
  const gal = pid && b ? P.sel.galones(pid, b).map((g) => g.k) : [];
  const still = P.sel.shirt(pid);
  const sysReduce = systemReduced();
  const goSiete = (then: () => void) => {
    P.act.closeSheet();
    if (place !== "siete") P.nav("/pizarra/siete");
    setTimeout(then, 60);
  };
  const reset = () => {
    const before: Partial<PzPrefs> = Object.fromEntries(SHEET_KEYS.map((k) => [k, pf[k]]));
    changePrefs(P, Object.fromEntries(SHEET_KEYS.map((k) => [k, PREFS_DEFAULT[k]])));
    P.toast("Ajustes como venían", { undo: () => set(before, "Ajustes recuperados") });
  };
  return (
    <div className="pg-aj">
      <p className="pg-aj-where">
        <PzIcon name="lock" />
        {signed ? "Te siguen al móvil y al ordenador" : `Se guardan en ${device} · el equipo no ve nada`}
      </p>

      <section className="pg-aj-sec" aria-labelledby="pga-snd">
        <div className="pg-aj-h">
          <h3 id="pga-snd">Sonido</h3>
          <span className={`pg-aj-state${pf.sonido ? " is-on" : ""}`} aria-hidden="true">
            <PzIcon name={pf.sonido ? "check" : "close"} />
            {pf.sonido ? "Encendidos" : "Apagados"}
          </span>
        </div>
        <div className="pg-aj-row">
          <button
            type="button"
            className="vx-tog"
            aria-pressed={pf.sonido}
            onClick={() => {
              const on = !pf.sonido;
              set({ sonido: on }, on ? "Sonidos encendidos" : "Sonidos apagados");
              if (on) sonar(null, "clac", true);
            }}
          >
            <span className="vx-tog__t" aria-hidden="true" />
            Sonidos de la pizarra
          </button>
          <button
            type="button"
            className="vd-glass vd-press pz-btn"
            onClick={() => {
              const ok = sonar(null, "clac", true);
              if (ok) setTimeout(() => sonar(null, "grada", true), 260);
              P.toast(ok ? (pf.sonido ? "Así suena la pizarra" : "Así suena: enciéndelos para oírlos al jugar") : "Este navegador no deja sonar la pizarra", { icon: ok ? "play" : "warn" });
            }}
          >
            <PzIcon name="play" />
            Probar
          </button>
        </div>
        <p className="pg-aj-line">Un clac al soltar una camiseta y la grada cuando el siete está completo o se publica.</p>
      </section>

      <section className="pg-aj-sec" aria-labelledby="pga-cam">
        <div className="pg-aj-h">
          <h3 id="pga-cam">Cámara al entrar</h3>
          <span>{CAM_WORD[pf.camara] ?? ""}</span>
        </div>
        <div className="pg-aj-cams" role="group" aria-labelledby="pga-cam">
          {CAMS.map((c) => {
            const on = pf.camara === c.id;
            return (
              <div key={c.id} className={`vd-glass pg-aj-opt${on ? " is-on" : ""}`}>
                {c.id === "sitio" ? (
                  <span className="pg-aj-both" aria-hidden="true">
                    <span>
                      <PzIcon name="cenital" />
                    </span>
                    <span>
                      <PzIcon name="grada" />
                    </span>
                  </span>
                ) : (
                  <span className="pg-aj-mini" aria-hidden="true">
                    <PiCampo layout={layout} mini bare show={{ source: "siete", overlay: null, caption: "", rival: false, drawings: false, marks: null }} camera={c.id} />
                  </span>
                )}
                <button type="button" aria-pressed={on} aria-label={`Cámara al entrar: ${c.t}. ${c.s}`} onClick={() => set({ camara: c.id }, "Cámara al entrar: " + c.t)}>
                  {c.t}
                </button>
                <small>{c.s}</small>
              </div>
            );
          })}
        </div>
      </section>

      <section className="pg-aj-sec" aria-labelledby="pga-capa">
        <div className="pg-aj-h">
          <h3 id="pga-capa">Capa al abrir el siete</h3>
          <span>Teclas 0–5</span>
        </div>
        <div className="vd-glass pg-aj-seg is-6" role="group" aria-labelledby="pga-capa">
          {LAYERS.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={pf.capa === l.id}
              onClick={() => {
                set({ capa: l.id }, "Capa al abrir: " + l.t);
                P.act.setLayer(l.id);
              }}
            >
              {l.t}
            </button>
          ))}
        </div>
        <p className="pg-aj-line">{CAPA_LINE[pf.capa] ?? ""}</p>
      </section>

      <section className="pg-aj-sec" aria-labelledby="pga-cam2">
        <div className="pg-aj-h">
          <h3 id="pga-cam2">Las camisetas en el campo</h3>
        </div>
        <div className="pg-aj-shirts">
          <div className="pg-aj-grass" aria-hidden="true">
            <span className="pz-shirt">{still.src ? <img src={still.src} alt="" draggable={false} /> : <i className="pg-shirt0">{still.num}</i>}</span>
            {pf.nombre && <span className="pg-aj-plate">{pid ? P.sel.name(pid) : "JUGADOR"}</span>}
            {pf.galones && (
              <span className="pg-aj-gal">
                {(gal.length ? gal.slice(0, 2) : ["C"]).map((g) => (
                  <span key={g}>{g}</span>
                ))}
              </span>
            )}
          </div>
          <div className="pg-aj-tgs">
            <button type="button" className="vx-tog" aria-pressed={pf.nombre} onClick={() => set({ nombre: !pf.nombre }, pf.nombre ? "Sin el nombre debajo" : "Con el nombre debajo")}>
              <span className="vx-tog__t" aria-hidden="true" />
              El nombre debajo
            </button>
            <button type="button" className="vx-tog" aria-pressed={pf.galones} onClick={() => set({ galones: !pf.galones }, pf.galones ? "Sin los galones" : "Con los galones")}>
              <span className="vx-tog__t" aria-hidden="true" />
              Los galones
            </button>
          </div>
        </div>
        <p className="pg-aj-line">El dorsal va impreso en la camiseta. La media, la nota o la química son capas.</p>
      </section>

      <section className="pg-aj-sec" aria-labelledby="pga-mov">
        <div className="pg-aj-h">
          <h3 id="pga-mov">Movimiento</h3>
          <span>Tu sistema: {sysReduce ? "movimiento reducido" : "movimiento normal"}</span>
        </div>
        <div className="vd-glass pg-aj-seg" role="group" aria-labelledby="pga-mov">
          {(
            [
              ["sistema", "Como tu sistema"],
              ["menos", "Menos movimiento"],
            ] as const
          ).map(([k, t]) => (
            <button key={k} type="button" aria-pressed={pf.mov === k} onClick={() => set({ mov: k }, t)}>
              {t}
            </button>
          ))}
        </div>
        <p className="pg-aj-line">{pf.mov === "menos" ? "Las cámaras y las camisetas cambian sin moverse." : sysReduce ? "Tu sistema pide poco movimiento: la pizarra corta en vez de mover." : "Las cámaras viajan y las camisetas se deslizan a su sitio."}</p>
      </section>

      <p className="pg-aj-grp">
        <PzIcon name="board" />
        Se guardan con el tablero · las ve todo el equipo
      </p>
      <ul className="pz-rows pg-aj-rows">
        <li>
          <button
            type="button"
            className="pz-row"
            aria-label="El rival en el campo: se cambia en el Plan"
            onClick={() => {
              P.act.closeSheet();
              P.nav("/pizarra/plan/rival");
            }}
          >
            <span className="vx-tile" aria-hidden="true">
              <PzIcon name="flag" />
            </span>
            <span className="pz-row__t">
              <b>El rival en el campo</b>
              <span>En el Plan · se queda como lo dejes</span>
            </span>
            <PzIcon name="chevR" className="pg-chev" />
          </button>
        </li>
        <li>
          <button type="button" className="pz-row" disabled={ro} aria-label={"Forma libre: se cambia en El sistema" + (ro ? ". Solo lectura" : "")} onClick={() => goSiete(() => P.act.openSheet("sistema"))}>
            <span className="vx-tile" aria-hidden="true">
              <PzIcon name="grid" />
            </span>
            <span className="pz-row__t">
              <b>Forma libre</b>
              <span>{ro ? "Solo lectura: duplica el tablero para cambiarla" : "En El sistema · cada uno donde lo sueltes"}</span>
            </span>
            <PzIcon name="chevR" className="pg-chev" />
          </button>
        </li>
        <li>
          <button type="button" className="pz-row" disabled={ro} aria-label={"Los dibujos: se hacen en el campo con el lápiz" + (ro ? ". Solo lectura" : "")} onClick={() => goSiete(() => P.act.setDrawing(true))}>
            <span className="vx-tile" aria-hidden="true">
              <PzIcon name="pencil" />
            </span>
            <span className="pz-row__t">
              <b>Los dibujos</b>
              <span>{ro ? "Solo lectura: duplica el tablero para dibujar" : "En el campo, con el lápiz (D)"}</span>
            </span>
            <PzIcon name="chevR" className="pg-chev" />
          </button>
        </li>
      </ul>

      <div className="pg-aj-foot">
        <div className="pz-acts">
          <button type="button" className="nx-lnk" onClick={reset} disabled={sheetDefault(pf)}>
            Volver a como venían
          </button>
        </div>
      </div>
    </div>
  );
}
