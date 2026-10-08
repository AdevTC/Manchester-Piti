// The palette's command registry: the shell registers the built-ins (Acciones, Secciones, Partidos,
// Jugadores) and every view can add its own while it is mounted:
//
//   const cmds = useMemo<PaletteCommand[]>(() => [{ id: "plantilla:exportar", group: "Acciones", icon: "↓",
//     title: "Exportar plantilla", hint: "acción", run: exportRoster }], [exportRoster]);
//   useRegisterCommands(cmds);
//
// Pass a memoized array: the registry is updated whenever its identity changes. Commands leave the
// palette when the view unmounts.
import { createContext, useContext, useEffect, useId, useSyncExternalStore } from "react";
import type { PaletteCommand } from "./search";

export class CommandRegistry {
  private sources = new Map<string, readonly PaletteCommand[]>();
  private listeners = new Set<() => void>();
  private snapshot: readonly PaletteCommand[] = [];
  set(source: string, commands: readonly PaletteCommand[]) {
    this.sources.set(source, commands);
    this.emit();
  }
  delete(source: string) {
    if (this.sources.delete(source)) this.emit();
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = (): readonly PaletteCommand[] => this.snapshot;
  private emit() {
    this.snapshot = [...this.sources.values()].flat();
    this.listeners.forEach((l) => l());
  }
}

export const RegistryContext = createContext<CommandRegistry | null>(null);
function useRegistry(): CommandRegistry {
  const r = useContext(RegistryContext);
  if (!r) throw new Error("The command palette needs a <CommandRegistryProvider> (AdminLayout provides one).");
  return r;
}

/** Adds `commands` to the palette while the calling component is mounted. */
export function useRegisterCommands(commands: readonly PaletteCommand[]): void {
  const registry = useRegistry();
  const id = useId();
  useEffect(() => {
    registry.set(id, commands);
  }, [registry, id, commands]);
  useEffect(() => () => registry.delete(id), [registry, id]);
}

/** Every registered command (the palette reads this). */
export function usePaletteCommands(): readonly PaletteCommand[] {
  const registry = useRegistry();
  return useSyncExternalStore(registry.subscribe, registry.getSnapshot, registry.getSnapshot);
}
