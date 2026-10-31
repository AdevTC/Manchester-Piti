// «El palco»: the sheet over the page — «Qué números ver», «Busca o pregunta», «Todas las estadísticas», «¿Y si…?»,
// a statistic's ficha and «Exportar la selección». Rendered outside the page's container (a container is the
// containing block of fixed boxes); the scrim and Esc close them, the page gives the focus back.
import { ExportSheet } from "./sheets/ExportSheet";
import { FichaSheet } from "./sheets/FichaSheet";
import { ScopeSheet } from "./sheets/ScopeSheet";
import { SearchSheet } from "./sheets/SearchSheet";
import { StatsSheet } from "./sheets/StatsSheet";
import { YsiSheet } from "./sheets/YsiSheet";
import type { SheetProps } from "./types";

export function Sheets(p: SheetProps) {
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
