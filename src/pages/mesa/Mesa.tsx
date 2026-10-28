// La mesa (/partidos/$matchId/mesa): the full-screen scoring screen of a match for an admin or one of its anotadores,
// as the r12 boards draw it (./board). The phase picks the screen (Antes · ¿Quién ha venido? · En juego · Descanso ·
// Final · Publicado), `?vista=cronica` opens «Lo que va pasando». Everyone else gets «Solo para quien anota» with the
// way back; a match that isn't there, «No encontramos el partido»; an acta already out, its closed door.
import { useMemo } from "react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useAuth } from "../../context/AuthContext";
import { useTeam } from "../../context/TeamContext";
import { useNoIndex } from "../../hooks/useNoIndex";
import { useMesa } from "./useMesa";
import { pizarraHref } from "./model";
import { Board, Door, Loading } from "./board/Board";
import type { MesaNav } from "./types";
import { backFromMesa } from "../match/partido/paths";

const route = getRouteApi("/partidos/$matchId/mesa");

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
      cronica: () => void navigate({ to: "/partidos/$matchId/mesa", params: { matchId }, search: (s) => ({ ...s, vista: "cronica" as const }) }),
      mesa: () => void navigate({ to: "/partidos/$matchId/mesa", params: { matchId }, search: (s) => ({ ...s, vista: undefined }) }),
      // «Salir de la mesa»: the screen of the match page la mesa was opened from
      exit: () => void navigate({ href: backFromMesa(matchId) }),
      acta: () => void navigate({ to: "/partidos/$matchId", params: { matchId } }),
      // (by href: the pizarra reads «desde=mesa&partido» itself; its route declares only «tablero»)
      pizarra: (boardId?: string | null) => void navigate({ href: pizarraHref(matchId, boardId) }),
      go: (href: string) => void navigate({ href }),
    }),
    [navigate, matchId],
  );
  const { view, state, canScore, scorersLoading } = useMesa({ matchId, me, nav });

  if (authLoading || !ready || (me && scorersLoading) || state === "loading") return <Loading />;
  if (!me || !canScore)
    return (
      <Door
        kicker="La mesa"
        title="Solo para quien anota"
        body="La mesa es para los capitanes y los anotadores de este partido. El directo se sigue en la página del partido."
        actions={[{ t: "Volver al partido", go: nav.exit, pri: true }]}
      />
    );
  if (state === "missing" || !view)
    return <Door kicker="La mesa" title="No encontramos el partido" body="Puede que se haya borrado o archivado." crest={false} actions={[{ t: "Volver a los partidos", go: () => nav.go("/partidos"), pri: true }]} />;
  return <Board view={view} vista={vista} />;
}
