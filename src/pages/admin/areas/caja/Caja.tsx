// CAJA · la caja (/admin/caja): el bote, los saldos, los movimientos, los pagos avisados por confirmar, cobrar cuota,
// apuntar pago, gasto o ingreso, anular, ajustes; the season is the frame's (useAdmin().season) (board
// part-caja.html). Also /admin/caja/coste/<id> (CosteScreen). TEMPORARY: today's Caja.
import { useParams } from "@tanstack/react-router";
import { Caja } from "../../views/Caja";
import { Interim } from "../../shell/Interim";

export function CajaScreen() {
  return (
    <Interim>
      <Caja />
    </Interim>
  );
}

/** /admin/caja/coste/<id>: el coste del partido, a partes iguales entre los que jugaron. */
export function CosteScreen() {
  const { matchId = "" } = useParams({ strict: false }) as { matchId?: string };
  return (
    <Interim search={{ coste: matchId }} head={{ title: "Coste del partido", back: { to: "/admin/caja", label: "Volver a la caja" } }}>
      <Caja />
    </Interim>
  );
}
