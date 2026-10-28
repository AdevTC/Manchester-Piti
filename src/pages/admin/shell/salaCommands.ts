// The sala's search's built-ins (⌘K): the five places (Sitios, with their g + letter), the frame's actions, every match
// (the one that matters now and the acta to do pinned) and every player of the season. A screen adds its own while
// it is mounted with useRegisterCommands (palette/registry). Pure: the data and what to call.
import { dateMillis } from "../../../../functions/src/matchEngine";
import { positionText } from "../../../lib/positions";
import type { PaletteCommand } from "../palette/search";
import type { AdminData } from "../data/useAdminData";
import { clockTime, jLabel, shortDate } from "../data/adminLogic";
import { pizarraCommand } from "../palette/matchShortcuts";
import { goHint, PLACES } from "./places";
import type { AdminTarget } from "./nav";

export interface CommandDeps {
  /** Navigates to an address of the sala (keeping the season). */
  go: (to: string) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  /** (the pizarra and the web leave the sala) */
  navigate: (o: { href: string }) => unknown;
  /** Today's router-free targets (useAdminGo): the pizarra's command takes one. */
  adminGo: (t: AdminTarget) => void;
  /** The player whose ficha is on screen, if any. */
  fichaId?: string;
}

export function salaCommands(data: AdminData, { go, theme, toggleTheme, navigate, adminGo, fichaId }: CommandDeps, counts?: Partial<Record<string, number>>): PaletteCommand[] {
  const cmds: PaletteCommand[] = [
    { id: "a:nuevo-partido", group: "Acciones", icon: "+", title: "Nuevo partido", description: "Rival, fecha y hora · tecla N", keys: "N", keywords: "crear añadir jornada", href: "/admin/partidos/nuevo", run: () => go("/admin/partidos/nuevo") },
    { id: "a:alta", group: "Acciones", icon: "+", title: "Alta de jugador", description: "Una camiseta nueva en la plantilla", keywords: "nuevo crear jugador fichar", href: "/admin/plantilla/alta", run: () => go("/admin/plantilla/alta") },
  ];
  const acta = data.overview.pending.find((p) => p.key.startsWith("acta-"));
  const actaMatch = acta ? data.matches.find((m) => `acta-${m.id}` === acta.key) : undefined;
  if (actaMatch) cmds.push({ id: "a:acta", group: "Acciones", icon: "✎", title: `Completar el acta de la ${jLabel(actaMatch)}`, description: actaMatch.rival ?? "Rival", keywords: "acta editar", href: `/admin/partidos/${actaMatch.id}/acta`, run: () => go(`/admin/partidos/${actaMatch.id}/acta`) });
  const hero = data.hero;
  if (hero && hero.moment === "antes") cmds.push({ id: "a:convocar", group: "Acciones", icon: "✓", title: `Convocar la ${jLabel(hero.match)}`, description: hero.match.rival ?? "Rival", keywords: "convocar convocatoria titulares siete", href: `/admin/partidos/${hero.match.id}/convocatoria`, run: () => go(`/admin/partidos/${hero.match.id}/convocatoria`) });
  if (hero) {
    const board = data.officialBoardOf(hero.match);
    if (board) cmds.push(pizarraCommand(hero.match, board, adminGo));
  }
  // (a ficha on screen: his public page)
  const ficha = fichaId ? data.roster.find((p) => p.id === fichaId) : undefined;
  if (ficha) cmds.push({ id: `web:p:${ficha.id}`, group: "Acciones", icon: "↗", title: "Ver en la web", description: `${ficha.name} · su página pública`, hint: "ir", keywords: "web publica pagina jugador", href: `/jugadores/${ficha.id}`, run: () => void navigate({ href: `/jugadores/${ficha.id}` }) });
  cmds.push({ id: "a:tema", group: "Acciones", icon: "◐", vicon: theme === "dark" ? "sun" : "moon", title: theme === "dark" ? "Tema de día" : "Tema de noche", description: "Colores de la sala", keywords: "tema oscuro claro modo", run: toggleTheme });
  for (const p of PLACES) {
    const n = counts?.[p.key] ?? 0;
    cmds.push({ id: `s:${p.key}`, group: "Sitios", icon: p.name.slice(0, 2).toUpperCase(), vicon: p.icon, title: p.name, description: n ? `${n} por hacer` : undefined, keys: goHint(p.key), href: p.path, run: () => go(p.path) });
  }
  const pinned = new Set([actaMatch?.id, hero?.match.id].filter(Boolean));
  [...data.matches].reverse().forEach((m, i) => {
    const t = dateMillis(m.date);
    const j = m.jornada ? `J${m.jornada}` : "";
    const score = typeof m.goalsFor === "number" && m.status === "finished" ? `${m.goalsFor}–${m.goalsAgainst ?? 0}` : "";
    cmds.push({
      id: `m:${m.id}`,
      group: "Partidos",
      icon: j || "vs",
      title: `${j || "Borrador"} · ${m.rival || "Rival por confirmar"}`,
      description: score || (Number.isFinite(t) ? `${shortDate(t)} · ${clockTime(t)}` : "sin fecha"),
      keywords: `${m.competition ?? ""} ${Number.isFinite(t) ? shortDate(t) : ""}`,
      exact: j ? [j] : undefined,
      whenEmpty: pinned.has(m.id),
      order: pinned.has(m.id) ? (m.id === actaMatch?.id ? -2 : -1) : i,
      href: `/admin/partidos/${m.id}`,
      run: () => go(`/admin/partidos/${m.id}`),
    });
  });
  for (const p of data.roster)
    cmds.push({
      id: `p:${p.id}`,
      group: "Jugadores",
      icon: p.number != null ? String(p.number) : "·",
      title: p.number != null ? `${p.number} · ${p.name}` : p.name,
      description: positionText(p.doc) ?? "Jugador",
      keywords: [positionText(p.doc), p.position, p.doc.firstName, p.doc.lastName].filter(Boolean).join(" "),
      exact: p.number != null ? [String(p.number)] : undefined,
      whenEmpty: false,
      href: `/admin/plantilla/${p.id}`,
      run: () => go(`/admin/plantilla/${p.id}`),
    });
  return cmds;
}
