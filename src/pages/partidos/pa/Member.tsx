// The viewer's own pieces on Partidos (PA- boards), in their own chunk (mounted only once hydrated): the jugador's
// «¿Vas el domingo?» (setAvailability, his own answer only), «Tu porra» in Directo, and the push switches —
// «Avísame del siete y del pitido» (lineup + start), «Avísame cuando haya fecha» (dates) and «Avísame cuando se
// publique» (tabla). Where this device can't get notices, the switch says why instead of flipping.
import { useState, type CSSProperties } from "react";
import type { ClubMatch } from "../../../lib/clubData";
import { pushState, savedTopics, setTopics, type Topic } from "../../../lib/push";
import { setAvailability, useMe } from "../../vestuario/writes";
import { useLiveDoc, useMyPrediction } from "../../vestuario/live";
import { porraVerdict } from "../vidrio/model";

type Answer = "yes" | "maybe" | "no";
const OPTS: { v: Answer; t: string }[] = [
  { v: "yes", t: "Voy" },
  { v: "maybe", t: "Duda" },
  { v: "no", t: "No voy" },
];
const readAnswer = (d: { response?: unknown } | undefined): Answer | "" => (d?.response === "yes" || d?.response === "maybe" || d?.response === "no" ? d.response : "");

/** «¿Vas el domingo?»: Voy · Duda · No voy, the bead hidden until he answers. */
export function Rsvp({ match, wd, say }: { match: ClubMatch; wd: string; say: (t: string) => void }) {
  const me = useMe();
  const mine = useLiveDoc<Answer | "">(me?.uid ? `matchPrivate/${match.id}/availability/${me.uid}` : null, "response", readAnswer, "").data;
  const [busy, setBusy] = useState(false);
  if (!me?.playerId) return <p className="pa-sub">La convocatoria es del vestuario; el siete sale aquí en cuanto el capitán lo publique.</p>;
  const at = OPTS.findIndex((o) => o.v === mine);
  const pick = (v: Answer) => {
    if (busy || v === mine) return;
    setBusy(true);
    setAvailability(me, match.id, v)
      .then(() => say(v === "yes" ? `Apuntado: vas el ${wd}.` : v === "maybe" ? "Apuntado como duda." : "Apuntado: no vas."))
      .catch(() => say("No se ha guardado. Prueba otra vez."))
      .finally(() => setBusy(false));
  };
  return (
    <div className="pa-rsvp">
      <b>¿Vas el {wd}?</b>
      <div className="vd-glass vd-seg pa-rsvp__seg" role="radiogroup" aria-label="¿Vas?" aria-busy={busy || undefined} style={{ "--n": 3, "--i": Math.max(0, at) } as CSSProperties}>
        <span className={`vd-shelf__bead${at < 0 ? " pa-bead-off" : ""}`} aria-hidden="true" />
        {OPTS.map((o) => (
          <button key={o.v} type="button" role="radio" className="vd-seg__b" aria-checked={mine === o.v} onClick={() => pick(o.v)}>
            {o.t}
          </button>
        ))}
      </div>
      <p className="pa-note">{mine ? "Puedes cambiarla hasta que salga el siete." : "Tu respuesta le llega al capitán al momento."}</p>
    </div>
  );
}

/** «Tu porra, 2–1: ahora mismo la clavas.» while the match is live (nothing if he didn't play it). */
export function PorraLine({ match, gf, ga }: { match: ClubMatch; gf: number; ga: number }) {
  const me = useMe();
  const saved = useMyPrediction(match.id, me?.uid);
  if (!me || !saved.data) return null;
  const p = { gf: saved.data.goalsFor, ga: saved.data.goalsAgainst };
  const v = porraVerdict(p, { gf, ga });
  return (
    <p className="pa-porra">
      Tu porra, {p.gf}–{p.ga}: {v === "exacta" ? "ahora mismo la clavas" : v === "cerca" ? "ahora mismo, a un gol" : "de momento, no"}.
    </p>
  );
}

/** A push switch for some topics (on when all of them are on). */
export function NotifySwitch({ topics, label, on: onSaid, off: offSaid, say, className = "pa-notify" }: { topics: Topic[]; label: string; on: string; off: string; say: (t: string) => void; className?: string }) {
  const [on, setOn] = useState(() => topics.every((t) => savedTopics().includes(t)));
  const [busy, setBusy] = useState(false);
  const flip = () => {
    if (busy) return;
    const state = pushState();
    if (state !== "ready") {
      say(state === "denied" ? "Los avisos están bloqueados en este navegador: actívalos en sus ajustes." : "Este navegador no recibe avisos. En el iPhone, añade la web a la pantalla de inicio.");
      return;
    }
    const next = !on;
    const rest = savedTopics().filter((t) => !topics.includes(t));
    setBusy(true);
    setTopics(next ? [...rest, ...topics] : rest)
      .then(() => {
        setOn(next);
        say(next ? onSaid : offSaid);
      })
      .catch((e: unknown) => say(e instanceof Error && e.message ? e.message : "No se ha podido cambiar el aviso. Prueba otra vez."))
      .finally(() => setBusy(false));
  };
  return (
    <button type="button" className={`vd-switch ${className}`} role="switch" aria-checked={on} aria-busy={busy || undefined} onClick={flip}>
      <span className="vd-switch__track" aria-hidden="true">
        <span className="vd-switch__knob" />
      </span>
      {label}
    </button>
  );
}
