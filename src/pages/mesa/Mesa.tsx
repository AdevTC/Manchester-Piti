// La mesa (/partidos/$matchId/mesa): the full-screen scoring screen of a match for an admin or one of its anotadores,
// as the r12 boards draw it (./board). The phase picks the screen (Antes · ¿Quién ha venido? · En juego · Descanso ·
// Final · Publicado), `?vista=cronica` opens «Lo que va pasando». Everyone else gets «Solo para quien anota» with the
// way back; a match that isn't there, «No encontramos el partido»; an acta already out, its closed door.
import { useMemo } from "react";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useAuth } from "../../context/AuthContext";
import { useTeam } from "../../context/TeamContext";
import { useNoIndex } from "../../hooks/useNoIndex";
import { useMesa } from "./useMesa";
import { pizarraHref } from "./model";
import { Board, Door, Loading } from "./board/Board";
import { useSheetUrl, type SheetHistory } from "./board/useSheetUrl";
import type { MesaNav } from "./types";
import { backFromMesa } from "../match/partido/paths";

const route = getRouteApi("/partidos/$matchId/mesa");

export function Mesa() {
  useNoIndex();
  const { matchId } = route.useParams();
  const { vista, hoja, j } = route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  // (the open sheet in the address: Atrás closes it, Adelante opens it again)
  const history = useMemo<SheetHistory>(
    () => ({
      push: (h, id) => void navigate({ from: "/partidos/$matchId/mesa", to: "/partidos/$matchId/mesa", params: { matchId }, search: (s) => ({ ...s, hoja: h as typeof hoja, j: id ?? undefined }) }),
      replace: (h, id) => void navigate({ from: "/partidos/$matchId/mesa", to: "/partidos/$matchId/mesa", params: { matchId }, search: (s) => ({ ...s, hoja: (h ?? undefined) as typeof hoja, j: id ?? undefined }), replace: true }),
      back: () => router.history.back(),
    }),
    [navigate, matchId, router],
  );
  const sheet = useSheetUrl({ hoja: hoja ?? "", j: j ?? null }, history);
  const { user, profile, loading: authLoading } = useAuth();
  const { member, ready } = useTeam();
  const admin = profile?.role === "admin" || profile?.role === "superadmin";
  const uid = user?.uid;
  const nickname = profile?.nickname ?? "";
  const me = useMemo(() => (uid && member ? { uid, name: nickname || "Anotador", admin } : null), [uid, member, nickname, admin]);
  const nav = useMemo<MesaNav>(
    () => ({
      // (from a sheet it pushed, the crónica takes that entry: Atrás from it comes back to la mesa, not to the sheet)
      cronica: () => void navigate({ from: "/partidos/$matchId/mesa", to: "/partidos/$matchId/mesa", params: { matchId }, search: (s) => ({ ...s, vista: "cronica" as const, hoja: undefined, j: undefined }), replace: sheet.pushedSheet() }),
      mesa: () => void navigate({ from: "/partidos/$matchId/mesa", to: "/partidos/$matchId/mesa", params: { matchId }, search: (s) => ({ ...s, vista: undefined }) }),
      // «Salir de la mesa»: the screen of the match page la mesa was opened from
      exit: () => void navigate({ href: backFromMesa(matchId) }),
      acta: () => void navigate({ to: "/partidos/$matchId", params: { matchId } }),
      // (by href: the pizarra reads «desde=mesa&partido» itself; its route declares only «tablero»)
      pizarra: (boardId?: string | null) => void navigate({ href: pizarraHref(matchId, boardId) }),
      go: (href: string) => void navigate({ href }),
    }),
    [navigate, matchId, sheet],
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
  return <Board view={view} vista={vista} sheet={sheet} />;
}
