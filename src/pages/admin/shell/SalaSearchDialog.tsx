// The sala's «Buscar» dialog (SalaSearch opens it): the web's search (SearchLauncher → SearchPanel, with its View
// Transition out of the button, its keyboard and its preview) listing the sala's commands instead of the web's
// pages — salaCommands and whatever the screen on view registers (palette/registry), as salaEntries turns them
// into entries, with their keys (g + letter, N) and the players' printed shirts. Choosing runs the
// command.
import { useMemo } from "react";
import { SearchPanel } from "../../../components/celeste/SearchPanel";
import type { SrEntry, SrScope } from "../../../components/celeste/searchModel";
import { KitStillContext } from "../../../components/jersey3d/kitStill";
import { usePageKitStills } from "../../../components/jersey3d/usePageKitStills";
import { useTheme } from "../../../hooks/useTheme";
import { usePaletteCommands } from "../palette/registry";
import { useAdmin } from "./context";
import { salaEntries, SALA_OPTIONS, SALA_SCOPES } from "./salaEntries";

/** What the last opening left (the web's search keeps the field between openings too). */
let last: { q: string; scope: SrScope } = { q: "", scope: "todo" };

export function SalaSearchDialog({ onClose }: { onClose: (refocus?: boolean) => void }) {
  const commands = usePaletteCommands();
  const data = useAdmin();
  const { theme } = useTheme();
  const entries = useMemo(() => salaEntries(commands), [commands]);
  const shirts = useMemo(() => data.roster.filter((p) => p.number != null).map((p) => ({ name: p.name, num: String(p.number) })), [data.roster]);
  const stills = usePageKitStills({ on: true, theme, kits: ["home"], players: shirts });
  const choose = (e: SrEntry) => {
    if (e.go.to !== "run") return;
    // (closed first, then run: a command may open a sheet of its own or go to another screen)
    onClose(false);
    e.go.run();
  };
  return (
    <KitStillContext.Provider value={stills}>
      <SearchPanel
        entries={entries}
        viewer="jugador"
        initial={last}
        onState={(s) => {
          last = s;
        }}
        onChoose={choose}
        onClose={() => onClose(true)}
        scopes={SALA_SCOPES}
        options={SALA_OPTIONS}
        heading="Buscar en la sala de control"
        fieldLabel="Busca un partido, un jugador, un sitio o algo que hacer"
        footExtra={
          <>
            <kbd>G</kbd> + letra ir a un sitio
          </>
        }
      />
    </KitStillContext.Provider>
  );
}
