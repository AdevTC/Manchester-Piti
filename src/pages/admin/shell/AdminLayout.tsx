// /admin — the Sala de control (r12 «Vidrio»): the layout route of every screen of the sala. It decides who looks
// (a captain gets the sala; anyone else inside, «Solo para la capitanía» in the same frame: the anotador with his
// mesa, M-21), measures the frame (≥ 1100 desktop · 700–1099 tablet · phone), and owns what every screen shares:
// the one useAdminData() (the season of the address: the frame's picker), the layers (Esc, focus trap, inert),
// the status strip, the unsaved-changes guard, the palette (⌘K) and its registry, the frame's head (title, line
// and way back), the dock's counters, the keyboard (g + place, `/`, `n`) and how a change of screen travels
// (law 4, on the web's page transitions). Motion follows the device's reduced-motion setting.
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../../hooks/useTheme";
import { useClock } from "../../../hooks/useClock";
import { setAppTravel } from "../../../components/celeste/pageTransition";
import { useAdminData, type AdminData } from "../data/useAdminData";
import { clockTime } from "../data/adminLogic";
import { CommandPalette } from "../palette/CommandPalette";
import { CommandRegistryProvider } from "../palette/CommandRegistryProvider";
import { useRegisterCommands } from "../palette/registry";
import { FrameContext, frameOf } from "../ui/frame";
import { GuardProvider } from "../ui/GuardProvider";
import { useLayerStack } from "../ui/layerCore";
import { LayerProvider } from "../ui/layers";
import type { Viewer } from "./Account";
import { AdminDataContext, ShellContext, useAdminGo, type ShellApi } from "./context";
import { useDockCounts } from "./counters";
import { Door } from "./Door";
import { SalaFrame } from "./Frame";
import { HeadContext, HeadStore, useRegisteredHead } from "./head";
import { salaCommands } from "./salaCommands";
import { useSalaGo } from "./salaHref";
import { salaDirection, sameMatch, screenOf, PLACE } from "./places";
import { OFFLINE_LINE, useOnline, useSalaSeason, useSeasonParam } from "./season";
import { useSalaShortcuts } from "./shortcuts";
import { StatusProvider } from "./StatusStrip";
// The Vidrio tokens, glass, reading pieces and chrome the frame builds on (loaded here too: /admin can be the first
// page loaded — a refresh, a bookmark, a push link), then today's admin styles (the views wave 2 replaces) and the
// sala's own, last.
import "../../../styles/vestuario.css";
import "../../../styles/celeste/base.css";
import "../../../styles/vidrio/tokens.css";
import "../../../styles/vidrio/glass.css";
import "../../../styles/vidrio/reading.css";
import "../../../styles/vidrio/chrome.css";
import "../../../styles/vidrio/transitions.css";
// (the system's shared components the screens use: vd-seg tabs, the shelf…)
import "../../../styles/vidrio/components.css";
import "../../../styles/admin.css";
import "../../../styles/admin-app.css";
import "./sala.css";

/** The frame's inner width, live (ResizeObserver on the root). */
function useFrameWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1440 : window.innerWidth));
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w > 0) setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

const ROLE: Record<string, string> = { superadmin: "Capitán general", admin: "Capitán" };
const isCaptain = (role: string | undefined) => role === "admin" || role === "superadmin";

export function AdminLayout() {
  const rootRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const width = useFrameWidth(rootRef);
  const frame = useMemo(() => frameOf(width), [width]);
  const { profile } = useAuth();
  const nick = profile?.nickname || "capitán";
  const captain = isCaptain(profile?.role);
  const viewer: Viewer = {
    name: nick,
    role: ROLE[profile?.role ?? ""] ?? (profile?.playerId ? "Jugador" : "Socio"),
    initials: nick.charAt(0).toLocaleUpperCase("es"),
    captain,
    general: profile?.role === "superadmin",
  };
  const size = width < 700 ? "is-phone" : width < 1100 ? "is-tablet" : width >= 1800 ? "is-desk is-big" : "is-desk";
  return (
    <MotionConfig reducedMotion="user">
      <FrameContext.Provider value={frame}>
        <div ref={rootRef} className={`vx adm sc ${frame.desktop ? "d" : "m"} ${size}`}>
          <LayerProvider appRef={appRef}>
            <StatusProvider>{captain ? <CaptainSala appRef={appRef} viewer={viewer} desktop={frame.desktop} /> : <DoorSala appRef={appRef} viewer={viewer} desktop={frame.desktop} />}</StatusProvider>
          </LayerProvider>
        </div>
      </FrameContext.Provider>
    </MotionConfig>
  );
}

/** Someone inside without the armband: the door, in the sala's frame (no places, no data of the captains). */
function DoorSala({ appRef, viewer, desktop }: { appRef: RefObject<HTMLDivElement | null>; viewer: Viewer; desktop: boolean }) {
  const { theme, toggle } = useTheme();
  const online = useOnline();
  const now = useClock(60_000);
  useEffect(() => {
    document.title = "Solo para la capitanía · Sala de control";
  }, []);
  return (
    <SalaFrame mode="door" place={null} head={{ title: "Sala de control" }} viewer={viewer} online={online} rest={online ? `Todo guardado · ${clockTime(now)}` : "Sin conexión"} dark={theme === "dark"} onTheme={toggle} desktop={desktop} appRef={appRef}>
      <Door />
    </SalaFrame>
  );
}

function CaptainSala(props: { appRef: RefObject<HTMLDivElement | null>; viewer: Viewer; desktop: boolean }) {
  const seasonPick = useSeasonParam();
  const data = useAdminData(seasonPick);
  const [heads] = useState(() => new HeadStore());
  return (
    <AdminDataContext.Provider value={data}>
      <HeadContext.Provider value={heads}>
        <GuardProvider>
          <CommandRegistryProvider>
            <Sala {...props} data={data} />
          </CommandRegistryProvider>
        </GuardProvider>
      </HeadContext.Provider>
    </AdminDataContext.Provider>
  );
}

function Sala({ appRef, viewer, desktop, data }: { appRef: RefObject<HTMLDivElement | null>; viewer: Viewer; desktop: boolean; data: AdminData }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const info = screenOf(pathname);
  const registered = useRegisteredHead();
  const head = registered ?? { title: info.title, sub: info.sub || undefined, back: info.back };
  const { theme, toggle } = useTheme();
  const online = useOnline();
  const season = useSalaSeason();
  const counts = useDockCounts(data);
  const go = useSalaGo();
  const navigate = useNavigate();
  const { modalOpen } = useLayerStack();
  const [palette, setPalette] = useState(false);

  // ⌘K / Ctrl K opens the palette from anywhere in the sala.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPalette(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useSalaShortcuts({ onGo: (k) => go(PLACE[k].path), onNuevo: () => go("/admin/partidos/nuevo"), blocked: () => modalOpen || palette });

  // How a change of screen travels (the web's page transitions run it: law 4).
  useEffect(() => {
    setAppTravel((from, to) => ({ direction: salaDirection(from, to), keep: sameMatch(from, to) }));
    return () => setAppTravel(null);
  }, []);
  useEffect(() => {
    document.title = `${head.title} · Sala de control`;
  }, [head.title]);

  const shell = useMemo<ShellApi>(() => ({ openPalette: () => setPalette(true), theme, toggleTheme: toggle }), [theme, toggle]);
  const adminGo = useAdminGo();
  const fichaId = info.screen === "ficha" ? info.playerId : undefined;
  const commands = useMemo(() => salaCommands(data, { go, theme, toggleTheme: toggle, navigate, adminGo, fichaId }, counts), [data, go, theme, toggle, navigate, adminGo, fichaId, counts]);
  useRegisterCommands(commands);

  const rest = online ? `Todo guardado · ${clockTime(data.now)}` : `Sin conexión · ${OFFLINE_LINE}`;
  return (
    <ShellContext.Provider value={shell}>
      <SalaFrame mode="sala" place={info.place} head={head} counts={counts} viewer={viewer} season={season} online={online} rest={rest} dark={theme === "dark"} onTheme={toggle} onSearch={() => setPalette(true)} desktop={desktop} appRef={appRef}>
        {/* (each screen says its own loading and error, with ScreenLoading / ScreenError: the frame is there at once) */}
        <Outlet />
      </SalaFrame>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </ShellContext.Provider>
  );
}
