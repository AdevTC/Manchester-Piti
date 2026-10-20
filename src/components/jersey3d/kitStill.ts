// A page's real kit stills: one blank shirt per kit, rendered once by useShirtStills and handed down, so every
// shirt on the page (the pitch, a ranking, a ballot, the MVP) wears the real kit with its number set on it, as the
// boards' .v-shirt. undefined before they are ready and on the server, where the drawn shirt stands in.
import { createContext } from "react";

export type Kit = "home" | "away";

export const KitStillContext = createContext<(kit: Kit) => string | undefined>(() => undefined);
