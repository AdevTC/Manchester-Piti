// En juego (/admin/en-juego/$matchId) — the phone's touchline view (the bar hides): back to Hoy, the
// «EN JUEGO» tally, the LED (score + running clock, «GOOOL» flash), «Lo que va pasando» and the pads; the
// pads open the live picker as a bottom sheet. On desktop, Hoy's «En juego» hero is the same thing, so
// this route shows Hoy there. Built on the shared live module (V1a may extend it).
import { Navigate, useParams } from "@tanstack/react-router";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { scoreOf } from "../../../lib/partidos";
import { jLabel } from "../data/adminLogic";
import { whistle, unwhistle } from "../data/whistleStore";
import { LedBoard, ShirtBack } from "../kit";
import { LiveClock, LiveLog, LivePads, LivePicker } from "../live/LiveParts";
import { useLive } from "../live/useLive";
import { useAdmin, useAdminGo } from "../shell/context";
import { useFrame } from "../ui/frame";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";

export function EnJuego() {
  const { matchId } = useParams({ strict: false });
  const data = useAdmin();
  const go = useAdminGo();
  const toast = useToast();
  const { desktop } = useFrame();
  const match = data.matches.find((m) => m.id === matchId) ?? null;
  const by = new Map(data.roster.map((p) => [p.id, p]));
  const nameOf = (id: string) => by.get(id)?.name ?? data.players.find((p) => p.id === id)?.shirtName ?? "Jugador";
  const numberOf = (id: string) => {
    const n = by.get(id)?.number;
    return n != null ? String(n) : "";
  };
  const live = useLive(match, data.now, nameOf, numberOf);
  if (desktop) return <Navigate to="/admin" replace />;
  if (!match)
    return (
      <div className="msc">
        <div className="void">
          <ShirtBack size={90} big state="empty" />
          <h3>{data.loading ? "Cargando el partido…" : "Ese partido no está"}</h3>
          <button type="button" className="btn line" onClick={() => go({ section: "hoy" })}>
            Volver a Hoy
          </button>
        </div>
      </div>
    );
  const { gf, ga } = scoreOf(match);
  const pitar = () => {
    whistle(match.id);
    live.close();
    go({ section: "partidos", matchId: match.id, tab: "acta" });
    toast.show({ tag: "FINAL", message: `Final pitado · ${gf}–${ga} · repasa el acta y publícala`, undo: () => unwhistle(match.id) });
  };
  const where = match.home === false ? "FUERA" : "EN CASA";
  return (
    <>
      <div className="lv">
        <div className="r1">
          <button type="button" className="bk" onClick={() => go({ section: "hoy" })} aria-label="Volver a Hoy">
            <AdIcon name="back" size={20} />
          </button>
          <span className="tally">EN JUEGO</span>
          <span className="ml">{[jLabel(match), (match.competition || "Liga").toLocaleUpperCase("es"), where].join(" · ")}</span>
        </div>
        <LedBoard
          rival={match.rival ?? "Rival"}
          gf={gf}
          ga={ga}
          size="mob"
          flash={live.flash}
          sub={<LiveClock start={dateMillis(match.date)} />}
        />
      </div>
      <div className="lvb">
        <h3>Lo que va pasando</h3>
        <LiveLog rows={live.log} label="Lo que va pasando" />
      </div>
      <div className="mpads">
        <LivePads onGol={() => live.open("gol")} onRival={live.rivalGoal} onTarjeta={() => live.open("tar")} onCambio={() => live.open("cam")} onPitar={pitar} disabled={live.busy} />
      </div>
      <LivePicker view={live.view} onChoose={live.choose} onClose={live.close} mobile disabled={live.busy} />
    </>
  );
}
