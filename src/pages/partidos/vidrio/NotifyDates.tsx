// «Avísame cuando haya fecha» on a postponed jornada without its new date: this device's push notices for the
// «Fechas nuevas y cambios» topic (lib/push «dates»: the backend sends «Nueva fecha: …» when the postponed
// match gets one). Where the browser can't get notices (or they were refused) the calendar feed stands in.
// Loaded in its own chunk, only in the browser.
import { useState } from "react";
import { AddToCalendar } from "../../../components/celeste/AddToCalendar";
import { siteOrigin } from "../../../lib/derived/venue";
import { pushState, savedTopics, toggleTopic } from "../../../lib/push";
import { Glyph } from "./bits";

export function NotifyDates() {
  const [on, setOn] = useState(() => savedTopics().includes("dates"));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  if (pushState() !== "ready") return <AddToCalendar className="vd-glass vd-btn vd-btn--sm vd-press" iconName="cal" label="Avísame en mi calendario" feed={`${siteOrigin()}/calendario.ics`} />;
  const ask = () => {
    if (busy || on) return;
    setBusy(true);
    setNote("");
    toggleTopic("dates", true)
      .then(() => {
        setOn(true);
        setNote("Te avisaremos en cuanto tenga fecha.");
      })
      .catch((e: unknown) => setNote(e instanceof Error && e.message ? e.message : "No se ha podido activar el aviso. Prueba otra vez."))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" aria-pressed={on} aria-busy={busy || undefined} onClick={ask}>
        <Glyph name={on ? "check" : "bell"} />
        {on ? "Te avisaremos cuando haya fecha" : "Avísame cuando haya fecha"}
      </button>
      {note && (
        <p className="vp-note" role="status">
          {note}
        </p>
      )}
    </>
  );
}
