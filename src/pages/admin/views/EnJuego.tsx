// En juego (/admin/en-juego/$matchId), as on the canvas (stats-gen/ad-v2-full.mjs `mJuego`, `heroJuego`;
// shots-adv2f/m-enjuego.png, hoy-juego.png). Phones (primary; the bar hides): back to Hoy, the «EN JUEGO»
// tally, the LED (score + running clock, «GOOOL» flash), «Lo que va pasando» with «Deshacer lo último» and
// the pads; the pads' picker is a bottom sheet. Desktop: the same as a view — the LED with its ticker, the
// log and the pads, the picker as a dialog. «Pitar el final» whistles the end on this device and opens the
// acta («Deshacer» takes the whistle back). Before kick-off / after the end it says so and points to Hoy /
// the acta. Built on the shared live module (live/*: liveEvent add + undo).
import type { ReactNode } from "react";
import { useParams } from "@tanstack/react-router";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { scoreOf } from "../../../lib/partidos";
import { clockTime, jLabel, shortDate, type AdminMatch } from "../data/adminLogic";
import { unwhistle, useWhistled, whistle } from "../data/whistleStore";
import { LedBoard, ShirtBack } from "../kit";
import { LiveClock, LiveLog, LivePads, LivePicker } from "../live/LiveParts";
import { useLive } from "../live/useLive";
import { useAdmin, useAdminGo } from "../shell/context";
import { useFrame } from "../ui/frame";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";
import { tickerText } from "./hoy/hoyModel";
import { phaseOf, type Phase } from "../partidos/workspaceModel";
import "../partidos/partidos.css";

function useNames() {
  const data = useAdmin();
  const by = new Map(data.roster.map((p) => [p.id, p]));
  const nameOf = (id: string) => by.get(id)?.name ?? data.players.find((p) => p.id === id)?.shirtName ?? "Jugador";
  const numberOf = (id: string) => {
    const n = by.get(id)?.number;
    return n != null ? String(n) : "";
  };
  return { nameOf, numberOf };
}

export function EnJuego() {
  const { matchId } = useParams({ strict: false });
  const data = useAdmin();
  const go = useAdminGo();
  const { desktop } = useFrame();
  const whistled = useWhistled();
  const match = data.matches.find((m) => m.id === matchId) ?? null;
  if (!match)
    return (
      <Frame desktop={desktop} title="En juego" lead="El partido" onBack={() => go({ section: "hoy" })} line="">
        <div className="void">
          <ShirtBack size={90} big state="empty" />
          <h3>{data.loading ? "Cargando el partido…" : "Ese partido no está"}</h3>
          <button type="button" className="btn line" onClick={() => go({ section: "hoy" })}>
            Volver a Hoy
          </button>
        </div>
      </Frame>
    );
  const phase = phaseOf(match, data.now, whistled.has(match.id));
  if (phase !== "juego") return <NotLive match={match} phase={phase} />;
  return <Live match={match} />;
}

const metaLine = (m: AdminMatch) => [jLabel(m), (m.competition || "Liga").toLocaleUpperCase("es"), m.home === false ? "FUERA" : "EN CASA"].join(" · ");

/** The view's frame when there is nothing live: the desktop header, or the phone's dark top row with ←. */
function Frame({ desktop, title, lead, line, onBack, children }: { desktop: boolean; title: string; lead: string; line: string; onBack: () => void; children: ReactNode }) {
  if (desktop)
    return (
      <>
        <div className="vh">
          <div>
            <h1 className="ttl">{title}</h1>
            <p className="ld">{lead}</p>
          </div>
        </div>
        {children}
      </>
    );
  return (
    <>
      <div className="lv">
        <div className="r1">
          <button type="button" className="bk" onClick={onBack} aria-label="Volver a Hoy">
            <AdIcon name="back" size={20} />
          </button>
          {line ? <span className="ml">{line}</span> : null}
        </div>
      </div>
      <div className="msc">{children}</div>
    </>
  );
}

function NotLive({ match, phase }: { match: AdminMatch; phase: Phase }) {
  const go = useAdminGo();
  const { desktop } = useFrame();
  const j = jLabel(match);
  const t = dateMillis(match.date);
  const rival = match.rival ?? "Rival";
  const { gf, ga } = scoreOf(match);
  const body =
    phase === "jugado" ? (
      <div className="void">
        <ShirtBack size={90} big />
        <h3>Pitado el final</h3>
        <p>
          {j} · PITI {gf}–{ga} {rival}. Lo apuntado está en el acta: repásala y publícala.
        </p>
        <button type="button" className="btn gold" onClick={() => go({ section: "partidos", matchId: match.id, tab: "acta" })}>
          <AdIcon name="pencil" size={18} />
          Repasar el acta
        </button>
      </div>
    ) : (
      <div className="void">
        <ShirtBack size={90} big state="empty" />
        <h3>{phase === "off" ? (match.status === "cancelled" ? "Partido cancelado" : "Partido aplazado") : "Todavía no ha empezado"}</h3>
        <p>{phase === "off" ? "No hay nada que apuntar." : `${j} · ${rival} · ${shortDate(t)} ${clockTime(t)}: el marcador se enciende al empezar.`}</p>
        <button type="button" className="btn line" onClick={() => go({ section: "hoy" })}>
          Volver a Hoy
        </button>
      </div>
    );
  return (
    <Frame desktop={desktop} title="En juego" lead={`${j} · ${rival}`} line={metaLine(match)} onBack={() => go({ section: "hoy" })}>
      {body}
    </Frame>
  );
}

function Live({ match }: { match: AdminMatch }) {
  const data = useAdmin();
  const go = useAdminGo();
  const toast = useToast();
  const { desktop } = useFrame();
  const { nameOf, numberOf } = useNames();
  const live = useLive(match, data.now, nameOf, numberOf);
  const { gf, ga } = scoreOf(match);
  const j = jLabel(match);
  const rival = match.rival ?? "Rival";
  const start = dateMillis(match.date);
  const pitar = () => {
    whistle(match.id);
    live.close();
    go({ section: "partidos", matchId: match.id, tab: "acta" });
    toast.show({ tag: "FINAL", message: `Final pitado · ${gf}–${ga} · repasa el acta y publícala`, undo: () => unwhistle(match.id) });
  };
  const pads = <LivePads onGol={() => live.open("gol")} onRival={live.rivalGoal} onTarjeta={() => live.open("tar")} onCambio={() => live.open("cam")} onPitar={pitar} disabled={live.busy} />;
  const undo = live.log.length ? (
    <button type="button" className="btn sm line" onClick={live.undo} disabled={live.busy} style={{ marginLeft: "auto" }}>
      <AdIcon name="undo" size={16} />
      Deshacer lo último
    </button>
  ) : null;

  if (!desktop)
    return (
      <>
        <div className="lv">
          <div className="r1">
            <button type="button" className="bk" onClick={() => go({ section: "hoy" })} aria-label="Volver a Hoy">
              <AdIcon name="back" size={20} />
            </button>
            <span className="tally">EN JUEGO</span>
            <span className="ml">{metaLine(match)}</span>
          </div>
          <LedBoard rival={rival} gf={gf} ga={ga} size="mob" flash={live.flash} sub={<LiveClock start={start} />} />
        </div>
        <div className="lvb">
          <div className="lvh">
            <h3>Lo que va pasando</h3>
            {undo}
          </div>
          <LiveLog rows={live.log} label="Lo que va pasando" />
        </div>
        <div className="mpads">{pads}</div>
        <LivePicker view={live.view} onChoose={live.choose} onClose={live.close} mobile disabled={live.busy} />
      </>
    );
  const note = data.next?.match.id === match.id ? data.next.note : "";
  return (
    <>
      <div className="vh">
        <div>
          <h1 className="ttl">En juego</h1>
          <p className="ld">
            {j} · {rival} · el Piti está jugando · apunta lo que pase
          </p>
        </div>
        <div className="r">
          <button type="button" className="btn line" onClick={() => go({ section: "partidos", matchId: match.id, tab: "acta" })}>
            Ver el acta
          </button>
        </div>
      </div>
      <section className="hB" aria-label={`El marcador de la ${j} en juego`} style={{ flex: 1 }}>
        <LedBoard
          rival={rival}
          rivalLogoUrl={match.rivalLogoUrl}
          gf={gf}
          ga={ga}
          sub={
            <>
              <LiveClock start={start} /> · EN JUEGO
            </>
          }
          ticker={tickerText(match, note)}
          flash={live.flash}
        />
        <div className="live2">
          <div className="calm">
            <h3>
              Lo que va pasando
              {undo}
            </h3>
            <div className="scr">
              <LiveLog rows={live.log} label="Lo que va pasando" />
            </div>
          </div>
          <div className="calm">
            <h3>
              Apunta a un toque <em>minuto del reloj</em>
            </h3>
            {pads}
          </div>
        </div>
        <LivePicker view={live.view} onChoose={live.choose} onClose={live.close} mobile={false} disabled={live.busy} />
      </section>
    </>
  );
}
