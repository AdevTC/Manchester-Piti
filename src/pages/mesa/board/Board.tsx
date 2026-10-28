// La mesa (r12) · the frame: the light field (Noche or Día, the web's theme: M-34), the head, the band, the screen of
// the moment, the status line and the sheets; and the doors (only for who scores, not found, the acta already out:
// B-MESA-12, M-39) and the loading state.
import { useMemo, type ReactNode } from "react";
import { VidrioSky } from "../../../components/vidrio/VidrioSky";
import { KitStillContext } from "../../../components/jersey3d/kitStill";
import { usePageKitStills } from "../../../components/jersey3d/usePageKitStills";
import { useTheme } from "../../../hooks/useTheme";
import { useNow } from "../screens/hooks";
import { maquetaActions, maquetaFase } from "../maqueta";
import type { MesaView } from "../types";
import { Antes, Lista } from "./Antes";
import { Band, Line, Top } from "./Chrome";
import { Cronica } from "./Cronica";
import { Descanso } from "./Descanso";
import { Final, Publicado } from "./Final";
import { Juego } from "./Juego";
import { Sheets } from "./Sheets";
import { upper, shownScore } from "./derive";
import { useBoard } from "./useBoard";
import "../../../styles/vidrio/tokens.css";
import "../../../styles/vidrio/glass.css";
import "../../../styles/vidrio/components.css";
import "../../../styles/vidrio/reading.css";
import "../../../styles/vidrio/transitions.css";
import "./mesa.css";

function Frame({ children, cls = "" }: { children: ReactNode; cls?: string }) {
  return (
    <div className="me-host">
      <div className={`vx vd-pg me ${cls}`.trim()}>
        <VidrioSky light="noche" floodlit={false} />
        {children}
      </div>
    </div>
  );
}

const CREST = "/crest-128.webp";

/** A door: «Solo para quien anota», «No encontramos el partido», «Acta publicada · la mesa está cerrada». */
export function Door({ title, kicker, body, actions, note, crest = true }: { title: string; kicker: string; body: string; actions: { t: string; go: () => void; pri?: boolean }[]; note?: string; crest?: boolean }) {
  return (
    <Frame cls="is-door">
      <main className="me-door vd-reg-1" aria-labelledby="me-door-h">
        {crest && <img className="me-door__crest" src={CREST} alt="" width={72} height={72} />}
        <p className="me-k">{kicker}</p>
        <h1 className="me-door__t" id="me-door-h">{title}</h1>
        <p className="me-door__p">{body}</p>
        <div className="me-door__a">
          {actions.map((a) => (
            <button key={a.t} type="button" className={`vd-btn vd-glass vd-press${a.pri ? " vd-btn--pri" : ""}`} onClick={a.go}>{a.t}</button>
          ))}
        </div>
        {note && <p className="me-small">{note}</p>}
      </main>
    </Frame>
  );
}

export function Loading() {
  return (
    <Frame cls="is-door">
      <section className="me-loading vd-reg-1" role="status" aria-busy="true" aria-label="Abriendo la mesa">
        <i /><i /><i /><i />
        <span>Abriendo la mesa…</span>
      </section>
    </Frame>
  );
}

export function Board({ view: real, vista }: { view: MesaView; vista?: string }) {
  const { theme } = useTheme();
  // (DEV only: under ?fase= the maqueta answers every action and writes nothing)
  const fake = import.meta.env.DEV && !!maquetaFase();
  const view = useMemo(() => (fake ? { ...real, actions: maquetaActions(real.actions) } : real), [fake, real]);
  const printed = useMemo(() => [...view.field, ...view.bench].filter((p) => !p.guest && p.number).map((p) => ({ name: upper(p.name), num: p.number })), [view.field, view.bench]);
  const stillOf = usePageKitStills({ on: true, theme, kits: view.match.kit === "away" ? ["away", "home"] : ["home", "away"], players: printed });
  return (
    <KitStillContext.Provider value={stillOf}>
      <BoardScreens view={view} vista={vista} />
    </KitStillContext.Provider>
  );
}

/** The screens without the page's stills (the tests render this). */
export function BoardScreens({ view: v, vista }: { view: MesaView; vista?: string }) {
  const b = useBoard(v, vista);
  const now = useNow(1000);
  if (b.screen === "cerrada") {
    const sc = shownScore(v);
    return (
      <Door
        kicker={`La mesa · Manchester Piti ${sc.us}–${sc.them} ${v.match.rival}`}
        title="Acta publicada · la mesa está cerrada"
        body="Lo que se apunte aquí ya no cambia el acta: el partido se ve en la web y se corrige en la sala."
        actions={[{ t: "Ver el partido", go: v.nav.acta, pri: true }, ...(v.me.admin ? [{ t: "Corregir el acta en la sala", go: () => v.nav.go(`/admin/partidos/${v.match.id}/acta`) }] : [])]}
        note={v.me.admin ? undefined : "Si algo está mal, díselo a un capitán: solo ellos corrigen un acta publicada."}
      />
    );
  }
  const cls = [`is-${b.screen}`, b.flash > now ? "is-gold" : "", v.match.clock.held ? "is-paused" : "", !v.queue.online ? "is-off" : "", b.hoja ? "has-sheet" : "", b.mode ? "is-asking" : ""].filter(Boolean).join(" ");
  return (
    <Frame cls={cls}>
      <div className="me-goldwash" aria-hidden="true" />
      <Top v={v} b={b} />
      <Band v={v} b={b} />
      <main className="me-main" id="me-main">
        {b.screen === "antes" && <Antes v={v} b={b} now={now} />}
        {b.screen === "lista" && <Lista v={v} b={b} />}
        {b.screen === "juego" && <Juego v={v} b={b} now={now} />}
        {b.screen === "descanso" && <Descanso v={v} b={b} />}
        {b.screen === "final" && <Final v={v} b={b} />}
        {b.screen === "publicado" && <Publicado v={v} b={b} now={now} />}
        {b.screen === "cronica" && <Cronica v={v} b={b} />}
      </main>
      <Line v={v} b={b} now={now} />
      <Sheets v={v} b={b} />
    </Frame>
  );
}
