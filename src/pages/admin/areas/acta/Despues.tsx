// ACTA · Después (/admin/partidos/<id>/despues): el MVP (votación, participación, cierre), las notas, la porra, el
// coste del partido (a la caja), la clasificación de la jornada, los avisos enviados, los turnos hechos, vídeo y
// fotos (board part-partido-despues.html, M-10). TEMPORARY: today's publish peak (the vitrina) for a published acta.
import { Publicado } from "../../publicado/Publicado";
import { Interim } from "../../shell/Interim";
import { usePartido } from "../../partido/partidoContext";
import { useMatchLifecycle } from "../../partido/lifecycle";

export function DespuesScreen() {
  const { match, phase } = usePartido();
  const lifecycle = useMatchLifecycle();
  if (phase !== "publicado" && phase !== "final")
    return (
      <section className="sc-sec" aria-labelledby="sc-de-t">
        <h2 className="sc-h2" id="sc-de-t">
          Después del partido
        </h2>
        <p className="sc-p" style={{ marginTop: 8 }}>
          Cuando se publique el acta, aquí estarán el MVP y su votación, las notas, la porra, el coste del partido y la clasificación de la jornada.
        </p>
      </section>
    );
  return (
    <Interim h1={false}>
      <Publicado match={match} onLifecycle={lifecycle} />
    </Interim>
  );
}
