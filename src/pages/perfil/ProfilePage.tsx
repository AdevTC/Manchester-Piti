// Tú (TU boards): one page mounted across /perfil/* and /avisos/* (the pathless layout `tu`), so the card travels
// between the screens. It reads the screen from the address (tu/model screenAt) and draws the board's family:
//   · /perfil without a session: the door (what is inside and how to get in), never a redirect;
//   · /perfil/*: «Mi página» — the identity (the small card, the name, the line), the sticky tabs that say what each
//     screen holds, and the screen with its one primary action and «Más»; /perfil/compartir and
//     /perfil/temporada/cromos are the studio and the cromos over their screen;
//   · /avisos/*: the bandeja and «A medida» (bandeja/AvisosMain), for fans too.
// Every move is a View Transition (exit → morph → enter), with the address as an entry of the history.
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { CelesteDock, CelesteHeader } from "../../components/celeste/Chrome";
import { VidrioSky } from "../../components/vidrio";
import { usePageKitStills } from "../../components/jersey3d/usePageKitStills";
import { KitStillContext } from "../../components/jersey3d/kitStill";
import { useAuth } from "../../context/AuthContext";
import { useTeam } from "../../context/TeamContext";
import { useClock } from "../../hooks/useClock";
import { useTheme } from "../../hooks/useTheme";
import { leaveDoorNotice } from "../../lib/doorNotice";
import { savedTopics, setTopics } from "../../lib/push";
import { readTuMaqueta } from "../../components/vidrio/tu/maqueta";
import { tuGo, useToast } from "../../components/vidrio/tu/ui";
import { cancelPlayerClaim, leaveVestuario, nicknameTaken, proposePositions, requestPlayerClaim, setNickname, setShirtName } from "./api";
import { useProfileData } from "./useProfileData";
import { allowedSec, dirOf, screenAt, secPath, COMPARTIR_PATH, CROMOS_PATH, type Screen, type Sec } from "./tu/model";
import { Door } from "./tu/Door";
import { MiPagina, type TuActions } from "./tu/MiPagina";
import { kindOf } from "./tu/view";

const keyOf = (s: Screen) => `${s.page}:${s.sec}:${s.open ?? ""}`;
const AvisosMain = lazy(() => import("./bandeja/AvisosMain").then((m) => ({ default: m.AvisosMain })));

export function ProfilePage() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const maq = readTuMaqueta();
  const { user, profile, logout } = useAuth();
  const team = useTeam();
  const data = useProfileData(maq);
  const now = useClock(60_000);
  const { theme } = useTheme();
  const { say, node: toast } = useToast();
  const member = maq?.quien ? maq.quien !== "fan" : team.member && !!profile;
  // (the session being restored: no door flash before the page knows him)
  const checking = !maq?.quien && (!team.ready || (team.member && (!profile || data.loading)));
  const who = { kind: member ? kindOf(data, maq) : ("fan" as const), captain: member && data.isCaptain };

  // ── the screen: the address's, kept in state so a move can commit it inside its View Transition
  const urlScreen = screenAt(pathname);
  const [screen, setScreen] = useState<Screen>(urlScreen);
  const urlKey = keyOf(urlScreen);
  const shown = useRef(screen);
  useEffect(() => {
    shown.current = screen;
  }, [screen]);
  useEffect(() => {
    // (back, forward, a link from elsewhere: the address moved on its own)
    const cur = shown.current;
    if (keyOf(cur) === urlKey) return;
    const to = screenAt(pathname);
    const surface = cur.page === to.page && cur.sec === to.sec;
    tuGo(surface ? "left" : dirOf(cur, to), () => flushSync(() => setScreen(to)), surface);
    // (only the address drives this)
  }, [urlKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const sec: Sec = allowedSec(screen.sec, who);

  /** Goes to another screen (or opens/closes the studio or the cromos over this one). */
  const go = (to: Screen, opts: { replace?: boolean; search?: Record<string, string> } = {}) => {
    const path = to.page === "avisos" ? "/avisos/a-medida" : to.open === "compartir" ? COMPARTIR_PATH : to.open === "cromos" ? CROMOS_PATH : secPath(to.sec);
    const surface = to.page === screen.page && to.sec === screen.sec && to.open !== screen.open;
    tuGo(surface ? (to.open ? "up" : "left") : dirOf(screen, to), async () => {
      flushSync(() => setScreen(to));
      await navigate({ to: path, search: opts.search ?? {}, replace: opts.replace, resetScroll: !surface } as never);
    }, surface);
  };

  const uid = data.uid;
  const actions: TuActions = {
    setShirtName: async (name) => (await setShirtName({ name })).data,
    setNickname: async (nickname) => (await setNickname({ nickname })).data.nickname,
    nicknameTaken: (nick) => nicknameTaken(nick, uid),
    cancelClaim: async () => {
      await cancelPlayerClaim({});
    },
    requestClaim: async (playerId) => {
      const r = await requestPlayerClaim({ playerId });
      return { linked: r.data.linked };
    },
    proposePositions: async (set) => {
      const playerId = data.ficha.state === "vinculada" ? data.ficha.playerId : null;
      if (!playerId) throw new Error("Sin ficha vinculada");
      await proposePositions(playerId, set);
    },
    signOut: async () => {
      leaveDoorNotice("Has salido en este dispositivo");
      await logout();
    },
    leaveVestuario: async () => {
      await leaveVestuario({ confirm: true });
      // The server dropped this account's notices: this device forgets its topics too (best effort).
      if (savedTopics().length) void setTopics([]).catch(() => undefined);
      leaveDoorNotice("Te has dado de baja del vestuario. Para volver, un capitán tendrá que abrirte otra vez.");
      await logout();
    },
  };

  // ── the shirts: every player's printed still, both kits (the studio and «Tu nombre» wear the second)
  const hydrated = typeof window !== "undefined";
  const stillOf = usePageKitStills({ on: hydrated, theme, kits: ["home", "away"], players: data.shirt.squad.map((s) => ({ name: s.name, num: s.number == null ? "" : String(s.number) })).filter((s) => s.num) });

  const isAvisos = screen.page === "avisos";
  const back = !isAvisos && who.kind !== "fan" && (sec === "ajustes" || sec === "cuenta" || sec === "capitania");
  const rootCls = ["vx", "vd-pg", "tu", `p-${screen.page}`, `k-${who.kind}`, `s-${sec}`, back ? "is-back" : "", screen.open ? `has-open o-${screen.open}` : "", theme === "light" ? "is-dia" : ""].filter(Boolean).join(" ");
  return (
    <KitStillContext.Provider value={stillOf}>
      <div className={rootCls} style={{ "--vd-sky-h": "1100px" } as CSSProperties}>
        <VidrioSky light={theme === "light" ? "noon" : "noche"} floodlit={false} height={1100} />
        <CelesteHeader />
        {isAvisos ? (
          <Suspense fallback={<main className="tu-main tu-av" id="tu-main" aria-busy="true" />}>
            <AvisosMain say={say} />
          </Suspense>
        ) : checking ? (
          <main className="tu-main" id="tu-main" aria-busy="true" />
        ) : who.kind === "fan" ? (
          <Door signedIn={!!user} onAvisos={() => go({ page: "avisos", sec: "carta", open: null })} />
        ) : (
          <MiPagina data={data} who={who} sec={sec} open={screen.open} go={go} actions={actions} say={say} now={now} maq={maq} />
        )}
        <CelesteDock />
        {toast}
      </div>
    </KitStillContext.Provider>
  );
}
