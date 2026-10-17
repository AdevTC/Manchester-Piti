// La mesa (/matches/$matchId/mesa): the full-screen scoring screen for an admin or one of the match's
// anotadores. The phase picks the screen (Antes · En juego · Descanso · Final), `?vista=cronica` opens
// «Lo que va pasando». Everyone else gets a short «Solo para quien anota» with the way back.
import { useMemo } from "react";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "../../context/AuthContext";
import { useTeam } from "../../context/TeamContext";
import { useNoIndex } from "../../hooks/useNoIndex";
import { useMesa } from "./useMesa";
import { pickScreen } from "./model";
import { EnJuego } from "./EnJuego";
import { Antes } from "./screens/Antes";
import { Cronica } from "./screens/Cronica";
import { Descanso } from "./screens/Descanso";
import { Final } from "./screens/Final";
import type { MesaNav, MesaView } from "./types";
import "./tokens.css";
import "./enjuego.css";

const route = getRouteApi("/matches/$matchId/mesa");

/** The screen for the view (exported for the tests). */
export function MesaScreenFor({ view, vista }: { view: MesaView; vista?: string }) {
  switch (pickScreen(view.match.clock.phase, vista)) {
    case "cronica":
      return <Cronica view={view} />;
    case "antes":
      return <Antes view={view} />;
    case "descanso":
      return <Descanso view={view} />;
    case "final":
      return <Final view={view} />;
    default:
      return <EnJuego view={view} />;
  }
}

function Gate({ matchId, title, body }: { matchId: string; title: string; body: string }) {
  return (
    <main className="mesa">
      <div className="col gate">
        <div className="gate-card" role="status">
          <h1>{title}</h1>
          <p>{body}</p>
          <Link className="gate-back" to="/matches/$matchId" params={{ matchId }}>
            Volver al partido
          </Link>
        </div>
      </div>
    </main>
  );
}

export function Mesa() {
  useNoIndex();
  const { matchId } = route.useParams();
  const { vista } = route.useSearch();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { member, ready } = useTeam();
  const admin = profile?.role === "admin" || profile?.role === "superadmin";
  const uid = user?.uid;
  const nickname = profile?.nickname ?? "";
  const me = useMemo(() => (uid && member ? { uid, name: nickname || "Anotador", admin } : null), [uid, member, nickname, admin]);
  const nav = useMemo<MesaNav>(
    () => ({
      cronica: () => void navigate({ to: "/matches/$matchId/mesa", params: { matchId }, search: (s) => ({ ...s, vista: "cronica" as const }) }),
      mesa: () => void navigate({ to: "/matches/$matchId/mesa", params: { matchId }, search: (s) => ({ ...s, vista: undefined }) }),
      exit: () => void navigate({ to: "/matches/$matchId", params: { matchId } }),
      acta: () => void navigate({ to: "/matches/$matchId", params: { matchId } }),
      pizarra: () => void navigate({ to: "/pizarra" }),
    }),
    [navigate, matchId],
  );
  const { view, state, canScore, scorersLoading } = useMesa({ matchId, me, nav });

  if (authLoading || !ready || (me && scorersLoading) || state === "loading") {
    return (
      <main className="mesa" aria-busy="true">
        <div className="col gate">
          <p className="gate-wait" role="status">Abriendo la mesa…</p>
        </div>
      </main>
    );
  }
  if (!me || !canScore) return <Gate matchId={matchId} title="Solo para quien anota" body="La mesa es para los administradores y los anotadores de este partido. El directo se sigue en la página del partido." />;
  if (state === "missing" || !view) return <Gate matchId={matchId} title="No encontramos el partido" body="Puede que se haya borrado o archivado." />;
  return (
    <main className="mesa">
      <div className="col">
        <MesaScreenFor view={view} vista={vista} />
      </div>
    </main>
  );
}
