// Holds the palette's command registry (registry.ts) for the admin shell.
import { useState, type ReactNode } from "react";
import { CommandRegistry, RegistryContext } from "./registry";

export function CommandRegistryProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(() => new CommandRegistry());
  return <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>;
}
