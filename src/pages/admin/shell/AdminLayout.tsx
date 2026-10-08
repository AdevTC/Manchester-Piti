// /admin — the admin app's shell («elegida»): a fixed 100dvh frame (the page never scrolls; each list
// scrolls inside its panel) with the slim header, the side menu (≥ 1000 px; folds to icons at 1000–1199
// or when pinned), the workspace (the routed view) and, on phones, the bottom bar + «Más» sheet. It owns
// the providers every view uses: layers (Esc, focus trap, inert), toasts, the unsaved-changes guard, the
// command palette (⌘K / Ctrl K) and its registry, the frame width, and the one useAdminData().
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
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
import { AdminHeader, BottomBar, MasSheet, SideNav, type Captain } from "./Chrome";
import { AdminDataContext, ShellContext, useAdminGo, type ShellApi } from "./context";
import { SECTIONS, sectionOf, type SectionKey } from "./nav";
import { useSidePref } from "./sidePref";
import "../../../styles/admin.css";
import "../../../styles/admin-app.css";

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
  const { user } = useAuth();
  const side = useSidePref(user?.uid, width);
  const data = useAdminData();
  const frame = useMemo(() => frameOf(width), [width]);
  return (
    <FrameContext.Provider value={frame}>
      <AdminDataContext.Provider value={data}>
        <div ref={rootRef} className={`vx adm ${side.className}`.trim()}>
          <div className="adm-bg" aria-hidden="true" />
          <div className="vx-grain" aria-hidden="true" />
          <LayerProvider appRef={appRef}>
            <ToastProvider>
              <GuardProvider>
                <CommandRegistryProvider>
                  <AdminShell appRef={appRef} data={data} collapsed={side.collapsed} onToggleSide={side.toggle} />
                </CommandRegistryProvider>
              </GuardProvider>
            </ToastProvider>
          </LayerProvider>
        </div>
      </AdminDataContext.Provider>
    </FrameContext.Provider>
  );
}

const ROLE: Record<string, string> = { superadmin: "Super admin", admin: "Administrador", user: "Usuario" };

function AdminShell({ appRef, data, collapsed, onToggleSide }: { appRef: RefObject<HTMLDivElement | null>; data: AdminData; collapsed: boolean; onToggleSide: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const section = sectionOf(pathname);
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
    const role = ROLE[profile?.role ?? "admin"] ?? "Administrador";
    const isCaptain = !!profile?.playerId && data.season?.captainPlayerId === profile.playerId;
    return {
      nickname: nick,
      initials: initials(nick),
      role: isCaptain ? `${role} · capitán` : role,
      roleLong: isCaptain && data.season ? `${role} · capitán de la ${data.season.name}` : role,
    };
  }, [profile, data.season]);

  const shell = useMemo<ShellApi>(() => ({ openPalette: () => setPalette(true), theme, toggleTheme: toggle }), [theme, toggle]);
  const goSection = (key: SectionKey) => {
    setMas(false);
    go({ section: key });
  };

  // The palette's built-ins: actions, sections, matches (J7 / J8 pinned), players (by name or dorsal).
  const builtins = useMemo<PaletteCommand[]>(() => {
    const cmds: PaletteCommand[] = [
      { id: "a:nuevo-partido", group: "Acciones", icon: "+", title: "Nuevo partido", description: "Rival, fecha y campo", hint: "acción", keywords: "crear añadir", run: () => go({ section: "partidos", nuevo: true }) },
      { id: "a:alta", group: "Acciones", icon: "+", title: "Alta de jugador", description: "Ficha nueva en la plantilla", hint: "acción", keywords: "nuevo crear jugador", run: () => go({ section: "plantilla", nuevo: true }) },
    ];
    const last = data.last;
    if (last && !last.publishedClean)
      cmds.push({ id: "a:acta", group: "Acciones", icon: "✎", title: `Abrir el acta de la ${jLabel(last.match)}`, description: `${last.match.rival ?? "Rival"} · ${last.review.goalsFor}–${last.review.goalsAgainst} · ${last.match.draft ? "borrador" : "sin empezar"}`, hint: "acción", keywords: "acta editar", run: () => go({ section: "partidos", matchId: last.match.id, tab: "acta" }) });
    if (data.next)
      cmds.push({ id: "a:convocar", group: "Acciones", icon: "✓", title: `Preparar la convocatoria de la ${jLabel(data.next.match)}`, description: data.next.conv.text, hint: "acción", keywords: "convocar titulares", run: () => go({ section: "convocatorias", matchId: data.next?.match.id }) });
    cmds.push(
      { id: "a:contenido", group: "Acciones", icon: "↑", title: "Contenido del club", description: data.content.gaps.length ? `${data.content.gaps.length} por completar` : "Completo", hint: "acción", keywords: "publicar editar textos", run: () => go({ section: "contenido" }) },
      { id: "a:tema", group: "Acciones", icon: "◐", title: theme === "dark" ? "Tema de día" : "Tema de noche", description: "Cambia los colores del panel", hint: "acción", keywords: "tema oscuro claro modo", run: toggle },
    );
    for (const s of SECTIONS) {
      const c = counters[s.key];
      cmds.push({ id: `s:${s.key}`, group: "Secciones", icon: s.abbr, title: s.name, description: c.n && c.tone ? c.label : s.key === "plantilla" ? c.label : s.blurb, hint: "ir", run: () => go({ section: s.key }) });
    }
    const pinned = new Set([last?.match.id, data.next?.match.id].filter(Boolean));
    const ordered = [...data.matches].reverse();
    ordered.forEach((m, i) => {
      const t = dateMillis(m.date);
      const state = data.stateOf(m);
      const j = m.jornada ? `J${m.jornada}` : "";
      const score = typeof m.goalsFor === "number" && state !== "scheduled" && state !== "next" ? `${m.goalsFor}–${m.goalsAgainst ?? 0}` : "";
      const what = state === "draft" ? "Borrador" : state === "acta" ? "Acta por hacer" : state === "published" ? "Publicada" : state === "cancelled" ? "Cancelado" : state === "postponed" ? "Aplazado" : state === "next" ? "Próximo" : "Programado";
      cmds.push({
        id: `m:${m.id}`,
        group: "Partidos",
        icon: j || "vs",
        title: `${j ? `${j} · ` : ""}${m.rival ?? "Rival"}`,
        description: [what, score || `${shortDate(t)}`].join(" · "),
        hint: "abrir",
        keywords: `${m.competition ?? ""} ${shortDate(t)}`,
        exact: j ? [j] : undefined,
        whenEmpty: pinned.has(m.id),
        order: pinned.has(m.id) ? (m.id === last?.match.id ? -2 : -1) : i,
        run: () => go({ section: "partidos", matchId: m.id }),
      });
    });
    const POS: Record<string, string> = { POR: "Portero", DEF: "Defensa", MED: "Medio", DEL: "Delantero" };
    for (const p of data.roster)
      cmds.push({
        id: `p:${p.id}`,
        group: "Jugadores",
        icon: p.number != null ? String(p.number) : "·",
        title: p.name,
        description: `${POS[p.position] ?? "Jugador"} · editar ficha`,
        hint: "editar",
        keywords: [p.doc.firstName, p.doc.lastName].filter(Boolean).join(" "),
        exact: p.number != null ? [String(p.number)] : undefined,
        whenEmpty: false,
        run: () => go({ section: "plantilla", playerId: p.id }),
      });
    return cmds;
  }, [data, counters, go, theme, toggle]);
  useRegisterCommands(builtins);

  const archived = data.seasons.filter((s) => s.archived).length;
  const seasonsText = `${data.season ? `${data.season.name} activa` : "Sin temporada activa"}${archived ? ` · ${archived} archivada${archived === 1 ? "" : "s"}` : ""}`;

  return (
    <ShellContext.Provider value={shell}>
      <div ref={appRef} className="app">
        <AdminHeader section={section} dark={theme === "dark"} onSearch={() => setPalette(true)} onTheme={toggle} />
        <SideNav section={section} counters={counters} captain={captain} collapsed={collapsed} onToggle={onToggleSide} onGo={goSection} />
        <div className="ws" id="ws">
          <Outlet />
        </div>
        <BottomBar section={section} counters={counters} masOpen={mas} onGo={goSection} onMas={() => setMas(true)} />
      </div>
      <MasSheet
        open={mas}
        onClose={() => setMas(false)}
        section={section}
        counters={counters}
        captain={captain}
        dark={theme === "dark"}
        convText={data.next ? data.next.conv.text : "Sin partidos por jugar"}
        seasonsText={seasonsText}
        onGo={goSection}
        onSearch={() => {
          setMas(false);
          setPalette(true);
        }}
        onTheme={toggle}
      />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </ShellContext.Provider>
  );
}
