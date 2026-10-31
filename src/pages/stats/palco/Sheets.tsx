// «El palco»: the sheet over the page — «Qué números ver», «Busca o pregunta», «Todas las estadísticas», «¿Y si…?»,
// a statistic's ficha and «Exportar la selección». Rendered in the body once the page is in the browser: the page
// is its own stacking context (.vx.vd-pg isolates), so a sheet inside it sat under the root's floating live score
// (.vd-floatzone, z 40), which covered its «Cerrar»; and a container is the containing block of fixed boxes. On the
// server (and the first render, so hydration matches) it stays in place. The scrim and Esc close them, the page
// gives the focus back.
import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ExportSheet } from "./sheets/ExportSheet";
import { FichaSheet } from "./sheets/FichaSheet";
import { ScopeSheet } from "./sheets/ScopeSheet";
import { SearchSheet } from "./sheets/SearchSheet";
import { StatsSheet } from "./sheets/StatsSheet";
import { YsiSheet } from "./sheets/YsiSheet";
import type { SheetProps } from "./types";

const subscribeNothing = () => () => {};
/** True once in the browser (false on the server and while hydrating, so the first render matches the server's). */
const useInBrowser = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);

function sheetOf(p: SheetProps): ReactNode {
  switch (p.st.sheet) {
    case "scope":
      return <ScopeSheet {...p} />;
    case "search":
      return <SearchSheet {...p} />;
    case "stats":
      return <StatsSheet {...p} />;
    case "ysi":
      return <YsiSheet {...p} />;
    case "metric":
      return p.st.sheetId ? <FichaSheet {...p} /> : null;
    case "export":
      return <ExportSheet {...p} />;
    default:
      return null;
  }
}

export function Sheets(p: SheetProps) {
  const inBrowser = useInBrowser();
  const sheet = sheetOf(p);
  if (!sheet) return null;
  return inBrowser ? createPortal(sheet, document.body) : sheet;
}
