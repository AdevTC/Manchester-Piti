// Convocar › «Recordatorios automáticos»: the captain's switch for this match (on by default). Says what it
// does in words, and whether it is on, never by colour alone.
import { useState } from "react";
import { AdIcon } from "../ui/icons";

export interface RemindersToggleProps {
  auto: boolean;
  loading: boolean;
  /** Convocados who haven't answered yet (the ones the reminders chase). */
  pending: number;
  onSet: (on: boolean) => Promise<void>;
  onError: (msg: string) => void;
}

export function RemindersToggle({ auto, loading, pending, onSet, onError }: RemindersToggleProps) {
  const [busy, setBusy] = useState(false);
  const flip = async () => {
    setBusy(true);
    try {
      await onSet(!auto);
    } catch {
      onError("No se ha podido cambiar: vuelve a intentarlo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="src rmd">
      <AdIcon name="clock" size={20} />
      <span>
        <b>Recordatorios automáticos.</b>{" "}
        {auto
          ? "48 h y 24 h antes del partido, un aviso a cada convocado que no ha contestado" + (pending ? ` (ahora, ${pending})` : "") + "."
          : "Apagados para este partido: nadie recibe el recordatorio."}
      </span>
      <label className="rmd-sw">
        <input type="checkbox" role="switch" checked={auto} disabled={loading || busy} onChange={() => void flip()} aria-label="Recordatorios automáticos de este partido" />
        <small>{auto ? "Sí" : "No"}</small>
      </label>
    </div>
  );
}
