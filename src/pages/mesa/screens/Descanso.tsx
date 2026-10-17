// Placeholder so the core builds: the screens workstream ships the real «Descanso».
import type { MesaScreenProps } from "../types";

export function Descanso({ view }: MesaScreenProps) {
  return (
    <section className="mesa-placeholder" aria-label="Descanso">
      <p>{view.match.rival}</p>
    </section>
  );
}
