// CLUB · la oficina del club (/admin/club): una puerta por sala, cada una con su detalle vivo (M-16; board
// part-club.html § oficina). TEMPORARY: the doors as plain rows until wave 2 draws them.
import { ComingScreen } from "../../shell/Screen";

const ROOMS: { to: string; label: string }[] = [
  { to: "/admin/club/temporadas", label: "Temporadas" },
  { to: "/admin/club/clasificacion", label: "Clasificación" },
  { to: "/admin/club/web", label: "La web del club" },
  { to: "/admin/club/turnos", label: "Turnos" },
  { to: "/admin/club/vestuario", label: "El vestuario" },
  { to: "/admin/club/avisos", label: "Avisos" },
  { to: "/admin/club/equipaciones", label: "Equipaciones" },
];

export function OficinaScreen() {
  return <ComingScreen title="Club" sub="La oficina del club" body="Una puerta por sala: las temporadas, la clasificación, la web del club, los turnos, el vestuario, los avisos y las equipaciones." links={ROOMS} />;
}
