// r14 «La pizarra»: hands the page's store down (usePz() in store/context reads it).
import type { ReactNode } from "react";
import type { PzApi } from "./api";
import { PzContext } from "./context";

export function PzProvider({ store, children }: { store: PzApi; children: ReactNode }) {
  return <PzContext.Provider value={store}>{children}</PzContext.Provider>;
}
