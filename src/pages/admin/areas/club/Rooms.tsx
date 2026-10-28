// CLUB · the rooms of the office (/admin/club/<sala>): temporadas, clasificación, la web del club (/web[/<sección>]),
// turnos, el vestuario (encuestas, tablón, entrenos, ausencias), avisos (los de capitanía y los enviados),
// equipaciones (propuesta) (board part-club.html, club.js). Each room has «‹» back to the office. TEMPORARY: today's
// views where they exist; a note where wave 2 draws something new.
import { useParams } from "@tanstack/react-router";
import { Temporadas } from "../../views/Temporadas";
import { Clasificacion } from "../../views/Clasificacion";
import { Turnos } from "../../views/Turnos";
import { Contenido } from "../../views/Contenido";
import { Interim } from "../../shell/Interim";
import { ComingScreen } from "../../shell/Screen";

const toOffice = { to: "/admin/club", label: "Volver a la oficina" };

export function TemporadasScreen() {
  return (
    <Interim head={{ title: "Temporadas", back: toOffice }}>
      <Temporadas />
    </Interim>
  );
}

export function ClasificacionScreen() {
  return (
    <Interim head={{ title: "Clasificación", back: toOffice }}>
      <Clasificacion />
    </Interim>
  );
}

export function TurnosScreen() {
  return (
    <Interim head={{ title: "Turnos", back: toOffice }}>
      <Turnos />
    </Interim>
  );
}

export function WebScreen() {
  return (
    <Interim head={{ title: "La web del club", back: toOffice }}>
      <Contenido />
    </Interim>
  );
}

/** /admin/club/web/<sección>: historia · contacto · momentos · historias · preguntas · galeria. */
export function WebSeccionScreen() {
  const { seccion = "" } = useParams({ strict: false }) as { seccion?: string };
  return (
    <Interim search={{ seccion }} head={{ title: "La web del club", back: { to: "/admin/club/web", label: "Volver a la web del club" } }}>
      <Contenido />
    </Interim>
  );
}

export function VestuarioScreen() {
  return <ComingScreen title="El vestuario" back={toOffice} body="Las encuestas, el tablón, los entrenos y las ausencias del vestuario, moderados desde la sala." links={[{ to: "/vestuario", label: "Abrir el vestuario" }]} />;
}

export function AvisosScreen() {
  return <ComingScreen title="Avisos" back={toOffice} body="Los avisos de capitanía y lo que se ha mandado al equipo, con a cuántos y cuándo." links={[{ to: "/avisos", label: "Abrir los avisos" }]} />;
}

export function EquipacionesScreen() {
  return <ComingScreen title="Equipaciones" sub="Propuesta · cambia el modelo de datos" back={toOffice} body="Las equipaciones y los trofeos viven hoy en el código de la web; esta sala los haría editables." />;
}
