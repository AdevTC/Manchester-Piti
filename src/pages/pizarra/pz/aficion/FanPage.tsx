// r14 «La pizarra» · la vista de la afición (/aficion/<token>, PZ-D21F): a board's cartel and seven by a link,
// read-only and public (fanBoards/{token}: data/fan.ts useFanBoard; no full names, no notas). Placeholder of the
// base: the CHARLA agent fills this file (and its own styles).
import { useParams } from "@tanstack/react-router";
import { CelesteHeader } from "../../../../components/celeste/Chrome";
import { FAN_TOKEN_RE } from "../../data/fan";

export function FanPage() {
  const { token } = useParams({ strict: false }) as { token?: string };
  const valid = !!token && FAN_TOKEN_RE.test(token);
  return (
    <div className="vx vd-pg">
      <CelesteHeader />
      <main id="contenido" style={{ padding: "40px 24px", maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 32, fontWeight: 760 }}>{valid ? "El siete del Manchester Piti" : "Este enlace no es válido"}</h1>
        <p>{valid ? "La vista de la afición llega con su parte." : "Pide a quien te lo pasó un enlace nuevo."}</p>
      </main>
    </div>
  );
}
