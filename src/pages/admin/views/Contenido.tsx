// Contenido del club — TEMPORARY (P0): the old ContentEditor until P1b's section list + editor drawer.
import { ContentEditor } from "../ContentEditor";
import { AdminView } from "../shell/AdminView";
import { LegacyNote } from "./LegacyNote";

export function Contenido() {
  return (
    <AdminView kicker="Club" title="Contenido del club" lead="Textos, momentos, historias y galería del club.">
      <div className="vb scr ad-legacy">
        <LegacyNote>El editor de contenido de siempre, mientras llega el nuevo.</LegacyNote>
        <ContentEditor />
      </div>
    </AdminView>
  );
}
