// Placeholder so the core builds: the screens workstream ships the real «Final».
import type { MesaScreenProps } from "../types";

export function Final({ view }: MesaScreenProps) {
  return (
    <section className="mesa-placeholder" aria-label="Final">
      <p>{view.match.rival}</p>
    </section>
  );
}
