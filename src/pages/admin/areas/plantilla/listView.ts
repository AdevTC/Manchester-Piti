// PLANTILLA · the list's view (the rows and the cromos share it): the chips with their counts, what the search and
// the chip leave, the other seasons while searching, the groups by line, the count line and the empty line; and
// «Exportar CSV» (the season's squad, also in ⌘K).
import { useEffect, useMemo, useRef } from "react";
import { plural } from "../../../../lib/derived/words";
import { boardGroups, matchesFilter, repeatedDorsals, FILTER_LABEL, type BoardFilter } from "../../club/plantillaBoard";
import { csvFileName, filterRows, rosterCsv } from "../../club/plantillaLogic";
import { downloadText } from "../../club/download";
import { useRegisterCommands } from "../../palette/registry";
import type { PaletteCommand } from "../../palette/search";
import { useStatus } from "../../shell/statusContext";
import { CHIP_ORDER } from "./model";
import { usePlantilla } from "./storeContext";

/** The list's search and chips, the visible rows and their order (shared by the rows and the cromos). */
export function useListView() {
  const st = usePlantilla();
  const { squad, rows, season, q, filter } = st;
  const dup = useMemo(() => repeatedDorsals(squad), [squad]);
  const chips = CHIP_ORDER.map((key) => ({ key, label: FILTER_LABEL[key], n: squad.filter((r) => matchesFilter(r, key, dup)).length })).filter((c) => c.n > 0 || c.key === filter);
  const hits = new Set(filterRows(squad, q, "Todos").map((r) => r.id));
  const visible = squad.filter((r) => hits.has(r.id) && matchesFilter(r, filter, dup));
  const others = season && q.trim() ? filterRows(rows.filter((r) => !r.inSeason), q, "Todos").map((r) => rows.find((x) => x.id === r.id)!) : [];
  const groups = boardGroups(visible);
  const filtering = filter !== "todos" || !!q.trim();
  const count = filtering ? `${visible.length} de ${plural(squad.length, "jugador", "jugadores")}` : `${season?.name ?? "Sin temporada"} · ${plural(squad.length, "jugador", "jugadores")}`;
  const empty = visible.length || others.length ? "" : !squad.length ? "La plantilla está vacía: da de alta al primero." : q.trim() ? `Nadie con «${q.trim()}».` : filter !== "todos" ? `Ya no queda nadie en «${FILTER_LABEL[filter as Exclude<BoardFilter, "todos">]}».` : "";
  return { ...st, dup, chips, visible, others, groups, count, empty, filtering };
}

/** «Exportar CSV»: the season's squad as a spreadsheet (and its ⌘K entry). */
export function useCsv() {
  const { squad, season } = usePlantilla();
  const status = useStatus();
  const run = () => {
    if (!squad.length) return;
    downloadText(csvFileName(season?.name), rosterCsv(squad));
    status.show({ tag: "CSV", message: `Plantilla exportada · ${plural(squad.length, "jugador", "jugadores")} en el CSV` });
  };
  const ref = useRef(run);
  useEffect(() => {
    ref.current = run;
  });
  useRegisterCommands(
    useMemo<PaletteCommand[]>(() => [{ id: "plantilla:csv", group: "Acciones", icon: "↓", title: "Exportar plantilla (CSV)", description: `Plantilla · ${plural(squad.length, "jugador", "jugadores")}`, keywords: "csv excel descargar exportar", run: () => ref.current() }], [squad.length]),
  );
  return run;
}

