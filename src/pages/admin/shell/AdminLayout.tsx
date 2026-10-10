// /admin — the admin v2 «Sala de control»: a fixed 100dvh frame (the page never scrolls; each list scrolls
// inside its panel). ≥ 1000 px (`.d`): the 60 px header, the 224 px rail and the workspace (the routed
// view). Phones (`.m`): the header, the view and the bar Hoy · Partidos · Convocar · Plantilla · Más — both
// hidden inside the match workspace and En juego. It owns the providers every view uses: layers (Esc,
// focus trap, inert), the lower thirds, the unsaved-changes guard, the command palette (⌘K / Ctrl K) and
// its registry, the frame width, and the one useAdminData().
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../../hooks/useTheme";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { initials } from "../../../lib/vestuario";
import { useAdminData, type AdminData } from "../data/useAdminData";
import { jLabel, shortDate } from "../data/adminLogic";
import { CommandPalette } from "../palette/CommandPalette";
import { CommandRegistryProvider } from "../palette/CommandRegistryProvider";
import { useRegisterCommands } from "../palette/registry";
import type { PaletteCommand } from "../palette/search";
import { FrameContext, frameOf } from "../ui/frame";
import { GuardProvider } from "../ui/GuardProvider";
import { LayerProvider } from "../ui/layers";
import { ToastProvider } from "../ui/toasts";
import { AdminHeader, BottomBar, MasSheet, MobileHeader, Rail, type Captain } from "./Chrome";
import { AdminDataContext, ShellContext, useAdminGo, type ShellApi } from "./context";
import { isEnJuego, isWorkspace, LEGACY, SECTIONS, sectionOf, titleOf, type SectionKey } from "./nav";
// The Celeste tokens and the `.vx` size container the admin CSS builds on: imported here too, so /admin
// works when it is the first page loaded (a refresh, a bookmark, a push link), not only after a site page.
import "../../../styles/vestuario.css";
import "../../../styles/admin.css";
import "../../../styles/admin-app.css";
// TEMPORARY (V0): the v1 styles of the views not redesigned yet (scoped under .v1).
import "../../../styles/admin-v1.css";

/** The frame's inner width, live (ResizeObserver on the `.vx.adm` root). */
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

export function AdminLayout() {
  const rootRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const width = useFrameWidth(rootRef);
  const data = useAdminData();
  const frame = useMemo(() => frameOf(width), [width]);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const bare = isWorkspace(pathname);
  // Phones: where the lower thirds sit — above the bar, the pads (En juego) or the workspace footer.
  const style = frame.desktop ? undefined : ({ "--ltb": !bare ? "80px" : isEnJuego(pathname) ? "262px" : "150px" } as CSSProperties);
  return (
    <FrameContext.Provider value={frame}>
      <AdminDataContext.Provider value={data}>
        <div ref={rootRef} className={`vx adm ${frame.desktop ? "d" : "m"}`} style={style}>
          <LayerProvider appRef={appRef}>
            <ToastProvider>
              <GuardProvider>
                <CommandRegistryProvider>
                  <AdminShell appRef={appRef} data={data} desktop={frame.desktop} pathname={pathname} />
                </CommandRegistryProvider>
              </GuardProvider>
            </ToastProvider>
          </LayerProvider>
        </div>
      </AdminDataContext.Provider>
    </FrameContext.Provider>
  );
}

const ROLE: Record<string, string> = { superadmin: "Capitán general", admin: "Capitán", user: "Socio" };

function AdminShell({ appRef, data, desktop, pathname }: { appRef: RefObject<HTMLDivElement | null>; data: AdminData; desktop: boolean; pathname: string }) {
  const section = sectionOf(pathname);
  const title = titleOf(pathname);
  const bare = isWorkspace(pathname);
  const go = useAdminGo();
  const { theme, toggle } = useTheme();
  const { profile } = useAuth();
  const [palette, setPalette] = useState(false);
  const [mas, setMas] = useState(false);
  const counters = data.overview.counters;

  // ⌘K / Ctrl K opens the palette from anywhere in the admin.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setMas(false);
        setPalette(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const captain: Captain = useMemo(() => {
    const nick = profile?.nickname || "capitán";
    return { nickname: nick, initials: initials(nick), role: ROLE[profile?.role ?? "admin"] ?? "Capitán" };
  }, [profile]);

  const shell: ShellApi = { openPalette: () => setPalette(true), theme, toggleTheme: toggle };
  const goSection = (key: SectionKey) => {
    setMas(false);
    go({ section: key });
  };

  // The palette's built-ins: actions, sections, matches (the hero and the pending acta pinned), players.
  const builtins = useMemo<PaletteCommand[]>(() => {
    const cmds: PaletteCommand[] = [
      { id: "a:nuevo-partido", group: "Acciones", icon: "+", title: "Nuevo partido", description: "Partidos", hint: "acción", keywords: "crear añadir", run: () => go({ section: "partidos", nuevo: true }) },
      { id: "a:alta", group: "Acciones", icon: "+", title: "Alta de jugador", description: "Plantilla", hint: "acción", keywords: "nuevo crear jugador", run: () => go({ section: "plantilla", nuevo: true }) },
    ];
    const acta = data.overview.pending.find((p) => p.key.startsWith("acta-"));
    const actaMatch = acta ? data.matches.find((m) => `acta-${m.id}` === acta.key) : undefined;
    if (actaMatch) cmds.push({ id: "a:acta", group: "Acciones", icon: "✎", title: `Completar el acta ${jLabel(actaMatch)}`, description: actaMatch.rival ?? "Rival", hint: "acción", keywords: "acta editar", run: () => go({ section: "partidos", matchId: actaMatch.id, tab: "acta" }) });
    const hero = data.hero;
    if (hero && hero.moment === "antes")
      cmds.push({ id: "a:convocar", group: "Acciones", icon: "✓", title: `Convocar la ${jLabel(hero.match)}`, description: hero.match.rival ?? "Rival", hint: "acción", keywords: "convocar titulares siete", run: () => go({ section: "convocar", matchId: hero.match.id }) });
    cmds.push(
      { id: "a:contenido", group: "Acciones", icon: "↑", title: "Publicar contenido", description: "Contenido", hint: "acción", keywords: "publicar editar textos web", run: () => go({ section: "contenido" }) },
      { id: "a:tema", group: "Acciones", icon: "◐", title: theme === "dark" ? "Tema de día" : "Tema de noche", description: "Colores de la sala", hint: "acción", keywords: "tema oscuro claro modo", run: toggle },
    );
    for (const s of SECTIONS) {
      const c = s.key in counters ? counters[s.key as keyof typeof counters] : undefined;
      cmds.push({ id: `s:${s.key}`, group: "Secciones", icon: s.name.slice(0, 2).toUpperCase(), title: s.name, description: c && c.n ? c.label : s.blurb, hint: "ir", run: () => go({ section: s.key }) });
    }
    const pinned = new Set([actaMatch?.id, hero?.match.id].filter(Boolean));
    const ordered = [...data.matches].reverse();
    ordered.forEach((m, i) => {
      const t = dateMillis(m.date);
      const j = m.jornada ? `J${m.jornada}` : "";
      const state = data.stateOf(m);
      const score = typeof m.goalsFor === "number" && state !== "scheduled" && state !== "next" ? `${m.goalsFor}–${m.goalsAgainst ?? 0}` : "";
      cmds.push({
        id: `m:${m.id}`,
        group: "Partidos",
        icon: j || "vs",
        title: `${j ? `${j} · ` : ""}${m.rival ?? "Rival"}`,
        description: score || shortDate(t),
        hint: "abrir",
        keywords: `${m.competition ?? ""} ${shortDate(t)}`,
        exact: j ? [j] : undefined,
        whenEmpty: pinned.has(m.id),
        order: pinned.has(m.id) ? (m.id === actaMatch?.id ? -2 : -1) : i,
        run: () => go({ section: "partidos", matchId: m.id }),
      });
    });
    const POS: Record<string, string> = { POR: "Portero", DEF: "Defensa", MED: "Medio", DEL: "Delantero" };
    for (const p of data.roster)
      cmds.push({
        id: `p:${p.id}`,
        group: "Jugadores",
        icon: p.number != null ? String(p.number) : "·",
        title: p.number != null ? `${p.number} · ${p.name}` : p.name,
        description: POS[p.position] ?? "Jugador",
        hint: "editar",
        keywords: [p.doc.firstName, p.doc.lastName].filter(Boolean).join(" "),
        exact: p.number != null ? [String(p.number)] : undefined,
        whenEmpty: false,
        run: () => go({ section: "plantilla", playerId: p.id }),
      });
    return cmds;
  }, [data, counters, go, theme, toggle]);
  useRegisterCommands(builtins);

  const view = LEGACY.has(section) ? (
    // TEMPORARY (V0): a v1 view inside the v2 shell.
    <div className="v1">
      <Outlet />
    </div>
  ) : (
    <Outlet />
  );
  const openPalette = () => {
    setMas(false);
    setPalette(true);
  };

  return (
    <ShellContext.Provider value={shell}>
      {desktop ? (
        <div ref={appRef} className="dk">
          <AdminHeader title={title} dark={theme === "dark"} onSearch={openPalette} onTheme={toggle} />
          <Rail current={section} counters={counters} captain={captain} />
          <main key={section} className="ws anim" id="ws">
            {view}
          </main>
        </div>
      ) : (
        <div ref={appRef} className="mb">
          {!bare && <MobileHeader title={title} onSearch={openPalette} />}
          <main className="mws" id="ws">
            {view}
          </main>
          {!bare && <BottomBar current={section} counters={counters} masOpen={mas} onMas={() => setMas(true)} />}
        </div>
      )}
      <MasSheet
        open={mas && !desktop}
        onClose={() => setMas(false)}
        counters={counters}
        captain={captain}
        dark={theme === "dark"}
        onGo={goSection}
        onSearch={openPalette}
        onTheme={toggle}
      />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </ShellContext.Provider>
  );
}
