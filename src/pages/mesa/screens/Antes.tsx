// Placeholder so the core builds: the screens workstream ships the real «Antes».
import type { MesaScreenProps } from "../types";

export function Antes({ view }: MesaScreenProps) {
  return (
    <section className="mesa-placeholder" aria-label="Antes">
      <p>{view.match.rival}</p>
    </section>
  );
}
