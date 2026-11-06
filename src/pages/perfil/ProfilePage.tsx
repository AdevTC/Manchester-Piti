// Tú: one page mounted across /perfil/* and /avisos/* (the pathless layout `tu`), so the card travels between
// the places. It reads the screen from the address (tu/model screenAt) and draws:
//   · /perfil without a session: the door (what is inside and how to get in), never a redirect;
//   · /perfil/*: a member's page (tu/shell/Shell) — the stage or the masthead, the bar with his four places and
//     the gear, the place (tu/places/*); /perfil/compartir and /perfil/vitrina/cromos open over Vitrina;
//   · /avisos: la bandeja; /avisos/a-medida: «A medida», for fans too (bandeja/AvisosMain).
// Every move is a View Transition (exit → morph → enter), with the address as an entry of the history. Only a
// member's page reads his profile (useProfileData): a fan's door and the avisos open no member listener.
// The page's CSS: styles/tu/ (the shell and the kit, one file per place), scoped .tup under the container `nx`.
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { CelesteDock, CelesteHeader } from "../../components/celeste/Chrome";
import { VidrioSky } from "../../components/vidrio";
import { usePageKitStills } from "../../components/jersey3d/usePageKitStills";
import { KitStillContext, type KitStills } from "../../components/jersey3d/kitStill";
import { useAuth } from "../../context/AuthContext";
import { useTeam } from "../../context/TeamContext";
import { useClock } from "../../hooks/useClock";
import { useTheme } from "../../hooks/useTheme";
import { leaveDoorNotice } from "../../lib/doorNotice";
import { savedTopics, setTopics } from "../../lib/push";
import { readTuMaqueta, type TuMaqueta } from "../../components/vidrio/tu/maqueta";
import { tuGo } from "../../components/vidrio/tu/kit";
import { cancelPlayerClaim, leaveVestuario, nicknameTaken, proposePositions, requestPlayerClaim, setNickname, setShirtName } from "./api";
import { useProfileData } from "./useProfileData";
import { allowedAj, allowedSec, dirOf, screenAt, screenPath, tuChecking, type Kind, type Screen } from "./tu/model";
import { Door } from "./tu/Door";
import { kindOf } from "./tu/view";
import { Shell } from "./tu/shell/Shell";
import { Failed, Loading } from "./tu/shell/States";
import { useTuToast } from "./tu/shell/useTuToast";
import type { Go, PlaceQuery, Say, TuActions } from "./tu/places/types";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";
import "../../styles/vidrio/reading.css";
import "../../styles/vidrio/sky.css";
import "../../styles/palco/palco.css";
import "../../styles/tu/tu.css";
import "../../styles/tu/tu-tu.css";
import "../../styles/tu/tu-partidos.css";
import "../../styles/tu/tu-juego.css";
import "../../styles/tu/tu-vitrina.css";
import "../../styles/tu/tu-ajustes.css";
import "../../styles/tu/tu-avisos.css";

const keyOf = (s: Screen) => `${s.page}:${s.sec}:${s.aj ?? ""}:${s.open ?? ""}`;
const AvisosMain = lazy(() => import("./bandeja/AvisosMain").then((m) => ({ default: m.AvisosMain })));
const NO_STILLS: KitStills = () => undefined;

/** The page's frame: its sky, the top bar, the dock and the toast around the screen; its root carries the state
 *  classes (page, viewer, place, an open surface, Día). */
function Frame({ screen, kind, stills, toast, children }: { screen: Screen; kind: Kind; stills: KitStills; toast: ReactNode; children: ReactNode }) {
  const { theme } = useTheme();
  const cls = ["vx", "vd-pg", "tu", "tu-pg", `p-${screen.page}`, `k-${kind}`, `s-${screen.sec}`, screen.open ? `has-open o-${screen.open}` : "", theme === "light" ? "is-dia" : ""].filter(Boolean).join(" ");
  return (
    <KitStillContext.Provider value={stills}>
      <div className={cls} style={{ "--vd-sky-h": "1100px" } as CSSProperties}>
        <VidrioSky light={theme === "light" ? "noon" : "noche"} floodlit={false} height={1100} />
        <CelesteHeader />
        {children}
        <CelesteDock />
        {toast}
      </div>
    </KitStillContext.Provider>
  );
}

export function ProfilePage() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const maq = readTuMaqueta();
  const { user, profile, loading } = useAuth();
  const team = useTeam();
  const { say, node: toast } = useTuToast();
  const member = maq?.quien ? maq.quien !== "fan" : team.member && !!profile;
  // (the session being restored: no door flash before the page knows him)
  const checking = !maq?.quien && tuChecking({ teamReady: team.ready, member: team.member, hasProfile: !!profile, profileLoading: loading });

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
    const surface = cur.page === to.page && cur.sec === to.sec && cur.aj === to.aj;
    tuGo(surface ? "left" : dirOf(cur, to), () => flushSync(() => setScreen(to)), surface);
    // (only the address drives this)
  }, [urlKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Goes to another screen (or opens/closes the studio or the cromos over this one). */
  const go: Go = (to, opts = {}) => {
    const surface = to.page === screen.page && to.sec === screen.sec && to.aj === screen.aj && to.open !== screen.open;
    tuGo(
      surface ? (to.open ? "up" : "left") : dirOf(screen, to),
      async () => {
        flushSync(() => setScreen(to));
        await navigate({ to: screenPath(to), search: opts.search ?? {}, hash: opts.hash, replace: opts.replace, resetScroll: !surface } as never);
      },
      surface,
    );
  };

  // «Reintentar»: the member's page mounts again, and its readers reopen the listeners that failed (no reload)
  const [attempt, setAttempt] = useState(0);
  if (screen.page === "perfil" && member && !checking) return <Member key={attempt} screen={screen} go={go} maq={maq} say={say} toast={toast} onRetry={() => setAttempt((n) => n + 1)} />;
  return (
    <Frame screen={screen} kind={member ? "socio" : "fan"} stills={NO_STILLS} toast={toast}>
      {screen.page === "avisos" ? (
        <Suspense
          fallback={
            <main className="tu-main tu-av" id="tu-main" aria-busy="true">
              <p className="vd-vh">Cargando los avisos…</p>
            </main>
          }
        >
          <AvisosMain say={say} />
        </Suspense>
      ) : checking ? (
        <main className="tup nx" id="tu-main">
          <Loading />
        </main>
      ) : (
        <Door signedIn={!!user} onAvisos={() => void navigate({ to: "/avisos/a-medida" })} />
      )}
    </Frame>
  );
}

/** A member's page: his profile, the place's address query, his writes. */
function Member({ screen, go, maq, say, toast, onRetry }: { screen: Screen; go: Go; maq: TuMaqueta | null; say: Say; toast: ReactNode; onRetry: () => void }) {
  const { logout } = useAuth();
  const data = useProfileData(maq);
  const now = useClock(60_000);
  const { theme } = useTheme();
  const who = { kind: kindOf(data, maq), captain: data.isCaptain };
  const placed: Screen = { ...screen, sec: allowedSec(screen.sec, who), aj: allowedAj(screen.aj, who) };
  const search = useLocation({ select: (l) => l.search as Record<string, unknown> });
  const hash = useLocation({ select: (l) => l.hash });
  const query: PlaceQuery = {
    temporada: typeof search.temporada === "string" ? search.temporada : undefined,
    j: typeof search.j === "number" ? search.j : undefined,
    salir: search.salir === "1" || search.salir === 1,
    hash,
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
      // (signed out first: a failure leaves no «Has salido» behind and Cuenta says why)
      await logout();
      leaveDoorNotice("Has salido en este dispositivo");
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
  const stillOf = usePageKitStills({ on: typeof window !== "undefined", theme, kits: ["home", "away"], players: data.shirt.squad.map((s) => ({ name: s.name, num: s.number == null ? "" : String(s.number) })).filter((s) => s.num) });
  return (
    <Frame screen={placed} kind={who.kind} stills={stillOf} toast={toast}>
      {data.loading ? (
        <main className="tup nx" id="tu-main">
          <Loading />
        </main>
      ) : data.error ? (
        <main className="tup nx" id="tu-main">
          <Failed onRetry={onRetry} />
        </main>
      ) : (
        <Shell data={data} who={who} screen={placed} go={go} actions={actions} say={say} now={now} maq={maq} query={query} />
      )}
    </Frame>
  );
}
