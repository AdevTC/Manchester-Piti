// The palette's built-ins (⌘K): the five places (Sitios, with their g + letter), the frame's actions, every match
// (the one that matters now and the acta to do pinned) and every player of the season. A screen adds its own while
// it is mounted with useRegisterCommands (palette/registry). Pure: the data and what to call.
import { dateMillis } from "../../../../functions/src/matchEngine";
import { positionText } from "../../../lib/positions";
import type { PaletteCommand } from "../palette/search";
import type { AdminData } from "../data/useAdminData";
import { clockTime, jLabel, shortDate } from "../data/adminLogic";
import { goHint, PLACES } from "./places";

export interface CommandDeps {
  /** Navigates to an address of the sala (keeping the season). */
  go: (to: string) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  /** (the pizarra and the web leave the sala) */
  navigate: (o: { href: string }) => unknown;
}

export function salaCommands(data: AdminData, { go, theme, toggleTheme, navigate }: CommandDeps, counts?: Partial<Record<string, number>>): PaletteCommand[] {
  const cmds: PaletteCommand[] = [
    { id: "a:nuevo-partido", group: "Acciones", icon: "+", title: "Nuevo partido", description: "Rival, fecha y hora · tecla N", keys: "N", keywords: "crear añadir jornada", run: () => go("/admin/partidos/nuevo") },
    { id: "a:alta", group: "Acciones", icon: "+", title: "Alta de jugador", description: "Una camiseta nueva en la plantilla", keywords: "nuevo crear jugador fichar", run: () => go("/admin/plantilla/alta") },
  ];
  const acta = data.overview.pending.find((p) => p.key.startsWith("acta-"));
  const actaMatch = acta ? data.matches.find((m) => `acta-${m.id}` === acta.key) : undefined;
  if (actaMatch) cmds.push({ id: "a:acta", group: "Acciones", icon: "✎", title: `Completar el acta de la ${jLabel(actaMatch)}`, description: actaMatch.rival ?? "Rival", keywords: "acta editar", run: () => go(`/admin/partidos/${actaMatch.id}/acta`) });
  const hero = data.hero;
  if (hero && hero.moment === "antes") cmds.push({ id: "a:convocar", group: "Acciones", icon: "✓", title: `Convocar la ${jLabel(hero.match)}`, description: hero.match.rival ?? "Rival", keywords: "convocar convocatoria titulares siete", run: () => go(`/admin/partidos/${hero.match.id}/convocatoria`) });
  if (hero) {
    const board = data.officialBoardOf(hero.match);
    if (board) cmds.push({ id: "a:pizarra", group: "Acciones", icon: "▦", title: `Abrir la pizarra (${jLabel(hero.match)})`, description: "El siete y las jugadas", keywords: "pizarra tablero tactica", run: () => void navigate({ href: `/pizarra?tablero=${encodeURIComponent(board)}${hero.match.seasonId ? `&season=${encodeURIComponent(hero.match.seasonId)}` : ""}` }) });
  }
  cmds.push({ id: "a:tema", group: "Acciones", icon: "◐", title: theme === "dark" ? "Tema de día" : "Tema de noche", description: "Colores de la sala", keywords: "tema oscuro claro modo", run: toggleTheme });
  for (const p of PLACES) {
    const n = counts?.[p.key] ?? 0;
    cmds.push({ id: `s:${p.key}`, group: "Sitios", icon: p.name.slice(0, 2).toUpperCase(), title: p.name, description: n ? `${n} por hacer` : undefined, keys: goHint(p.key), run: () => go(p.path) });
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
      run: () => go(`/admin/plantilla/${p.id}`),
    });
  return cmds;
}
