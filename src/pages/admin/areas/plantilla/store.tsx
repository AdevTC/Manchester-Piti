// PLANTILLA · what every screen of the area shares while /admin/plantilla/* is open (PlantillaArea mounts it once, so
// going from the list to a ficha, the alta or the cromos keeps it): the fichas (the club's and the archived ones)
// with the writes still behind «Deshacer» already applied, their rows (season name and dorsal, what each lacks, his
// account, suspended), the printed stills of the squad, the list's search and filter, and the alta's seed (a guest
// who becomes a ficha). Every write goes through `write()`: the screen shows it at once, the franja says it with
// «Deshacer» for 5 s, and only then is it written (undone, nothing is written).
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useShirtStills } from "../../../../components/jersey3d/useShirtStills";
import { useDocumentTheme } from "../../../../hooks/useDocumentTheme";
import type { PlayerDoc } from "../../../../lib/schemas";
import { boardRows, type BoardFilter, type BoardRow } from "../../club/plantillaBoard";
import { plantillaRows } from "../../club/plantillaLogic";
import { seasonSuspensions, upcomingFor } from "../../club/sanctionLogic";
import { useClubWrites } from "../../club/useClubWrites";
import { useAdmin } from "../../shell/context";
import { useStatus } from "../../shell/statusContext";
import { PlantillaContext, type AltaDraft, type PlantillaStore, type PlantillaWrite } from "./storeContext";

type Pending = Record<string, PlayerDoc | null>;

export function PlantillaProvider({ children }: { children: ReactNode }) {
  const data = useAdmin();
  const status = useStatus();
  const writes = useClubWrites();
  const theme = useDocumentTheme();
  const [pending, setPending] = useState<Pending>({});
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<BoardFilter>("todos");
  const [alta, setAlta] = useState<AltaDraft | null>(null);

  const players = useMemo(() => {
    const known = new Set(data.players.map((p) => p.id));
    const all = [...data.players, ...data.archivedPlayers.filter((p) => !known.has(p.id))];
    const base = all.filter((p) => pending[p.id] !== null).map((p) => pending[p.id] ?? p);
    const added = Object.values(pending).filter((p): p is PlayerDoc => !!p && !all.some((x) => x.id === p.id));
    return [...base, ...added];
  }, [data.players, data.archivedPlayers, pending]);
  const season = data.season;
  const suspended = useMemo(() => seasonSuspensions(data.matches, season?.id, players), [data.matches, season?.id, players]);
  const upcoming = useMemo(() => upcomingFor(data.matches, season?.id, data.now), [data.matches, season?.id, data.now]);
  const rows = useMemo(() => boardRows(plantillaRows(players, data.seasons, season?.id), { people: data.people, claims: data.claims }, suspended), [players, data.seasons, season?.id, data.people, data.claims, suspended]);
  const squad = useMemo(() => (season ? rows.filter((r) => r.inSeason) : rows.filter((r) => !r.doc.archived)), [rows, season]);

  // the printed stills (rendered once per name and dorsal, then kept on the device), and the plain kit's
  const shot = useCallback((r: Pick<BoardRow, "name" | "number">) => ({ kit: "home" as const, theme, name: r.name.toLocaleUpperCase("es"), num: r.number != null ? String(r.number) : "" }), [theme]);
  const plain = { kit: "home" as const, theme, name: "", num: "" };
  const stillOf = useShirtStills([plain, ...rows.filter((r) => r.inSeason || !season).map(shot)], { offMainThread: true });
  const still = useCallback((r: Pick<BoardRow, "name" | "number">) => stillOf(shot(r)), [stillOf, shot]);

  const write = useCallback(
    (w: PlantillaWrite) => {
      const docs: Pending = { [w.id]: w.doc };
      // drops the pending doc once its write is settled — unless a newer change replaced it meanwhile
      const done = () =>
        setPending((p) => {
          if (!(w.id in p) || p[w.id] !== w.doc) return p;
          const n = { ...p };
          delete n[w.id];
          return n;
        });
      setPending((p) => ({ ...p, ...docs }));
      status.defer({
        tag: w.tag,
        message: w.message,
        commit: w.commit,
        onUndo: () => {
          done();
          w.onUndo?.();
        },
        onError: () => {
          done();
          w.onError?.();
        },
        onDone: (r) => {
          done();
          w.onDone?.(r);
        },
        errorMessage: w.error,
      });
    },
    [status],
  );

  const value: PlantillaStore = {
    data,
    season,
    players,
    rows,
    squad,
    suspended,
    upcoming,
    writes,
    write,
    still,
    blank: stillOf(plain),
    q,
    setQ,
    filter,
    setFilter,
    alta,
    setAlta,
  };
  return <PlantillaContext.Provider value={value}>{children}</PlantillaContext.Provider>;
}
