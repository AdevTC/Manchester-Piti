// Ajustes › Avisos: la bandeja's «A medida» as it is (bandeja/AvisosMain AMedida) — this device and its state, the
// shortcuts (presets), tema a tema, «Vibrar con los goles», «Pausar» and the muted matches, «Probar en este móvil»
// and the calendar (Google, Apple, «Copiar enlace»). Loaded on demand, like la bandeja itself.
import { AMedida } from "../../../bandeja/AvisosMain";
import { useAvisoActions } from "../../../bandeja/actions";
import type { ThisDevice } from "../../../bandeja/device";
import type { PlaceProps } from "../types";

export default function Avisos({ pending, say, d }: Pick<PlaceProps, "pending" | "say"> & { d: ThisDevice }) {
  const inbox = pending.inbox;
  const a = useAvisoActions(inbox, say);
  return (
    <div className="tc-ajav">
      <AMedida inbox={inbox} d={d} a={a} say={say} />
    </div>
  );
}
