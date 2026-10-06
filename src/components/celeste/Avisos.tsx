// "Avisos en el móvil": the switches for push notices on this device (lib/push.ts).
import { useState } from "react";
import { pushState, savedTopics, setTopics, TOPIC_LABELS, type Topic } from "../../lib/push";

export function Avisos() {
  const [state] = useState(pushState);
  const [topics, setLocal] = useState<Topic[]>(savedTopics);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const toggle = async (t: Topic) => {
    const next = topics.includes(t) ? topics.filter((x) => x !== t) : [...topics, t];
    setBusy(true);
    setMsg("");
    try {
      setLocal(await setTopics(next));
      setMsg(next.length ? "Avisos guardados en este dispositivo." : "Ya no recibirás avisos aquí.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudieron guardar los avisos.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pt-card">
      <span className="hm-kick" style={{ margin: 0 }}>
        Avisos en el móvil
      </span>
      <h3>Que te avise la web</h3>
      {state === "ready" ? (
        <>
          <div className="pt-switches">
            {TOPIC_LABELS.map((t) => (
              <label key={t.id}>
                <span>
                  {t.label}
                  {t.hint && <small>{t.hint}</small>}
                </span>
                <input type="checkbox" role="switch" checked={topics.includes(t.id)} disabled={busy} onChange={() => void toggle(t.id)} />
              </label>
            ))}
          </div>
          {msg && (
            <p role="status" className="pt-swmsg">
              {msg}
            </p>
          )}
        </>
      ) : (
        <p>
          {state === "ios-install"
            ? "En iPhone y iPad, añade primero la web a tu pantalla de inicio (Compartir › Añadir a pantalla de inicio) y ábrela desde ahí."
            : state === "denied"
              ? "Los avisos están bloqueados en este navegador. Puedes permitirlos en los ajustes del sitio."
              : "Este navegador no admite avisos."}
        </p>
      )}
    </div>
  );
}
