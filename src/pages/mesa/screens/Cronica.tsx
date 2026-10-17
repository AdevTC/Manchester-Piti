// Placeholder so the core builds: the screens workstream ships the real «Cronica».
import type { MesaScreenProps } from "../types";

export function Cronica({ view }: MesaScreenProps) {
  return (
    <section className="mesa-placeholder" aria-label="Cronica">
      <p>{view.match.rival}</p>
    </section>
  );
}
