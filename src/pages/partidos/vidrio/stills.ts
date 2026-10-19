// The page's real kit stills (one blank shirt per kit, rendered once by useShirtStills): undefined before they
// are ready and on the server, where the drawn shirt stands in.
import { createContext } from "react";

export const StillContext = createContext<(kit: "home" | "away") => string | undefined>(() => undefined);
