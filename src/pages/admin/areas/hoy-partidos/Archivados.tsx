// HOY Y PARTIDOS · Archivados (/admin/partidos/archivados) and one archived match (/admin/partidos/archivados/<id>):
// fuera del calendario, consultar o reactivar (board part-partidos.html § 3). TEMPORARY: today's archive view.
import { Partidos } from "../../views/Partidos";
import { Interim } from "../../shell/Interim";

export function ArchivadosScreen() {
  return (
    <Interim search={{ archivados: true }} head={{ title: "Archivados", sub: "Fuera del calendario", back: { to: "/admin/partidos", label: "Volver a Partidos" } }}>
      <Partidos />
    </Interim>
  );
}

export function ArchivadoScreen() {
  return (
    <Interim search={{ archivados: true }} head={{ title: "Archivado", back: { to: "/admin/partidos/archivados", label: "Volver a Archivados" } }}>
      <Partidos />
    </Interim>
  );
}
