// «Voy · Duda · No puedo»: a member's answer to a match's convocatoria. The same control and the same
// write (setAvailability) in the vestuario's cartel and in the match page's Vestuario tab; each host
// keeps its own frame around it and reads the answer from its own availability listener.
import { useRef, type KeyboardEvent } from "react";
import type { ClubMatch } from "../../../lib/clubData";
import { kickoffWindow } from "../../../lib/derived/memberWindows";
import { setAvailability, useMe } from "../../../pages/vestuario/writes";
import { Icon } from "../icons";
import { useWrite } from "./useWrite";
import { WriteError } from "./WriteError";
import "./member.css";

export type RsvpAnswer = "yes" | "maybe" | "no";
const RSVP_OPTIONS = [
  { value: "yes", label: "Voy" },
  { value: "maybe", label: "Duda" },
  { value: "no", label: "No puedo" },
] as const;

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

interface Props {
  match: Pick<ClubMatch, "id" | "status" | "date">;
  /** The server's clock: the convocatoria closes at the match's date (firestore.rules upcoming()). */
  now: number;
  /** This member's current answer, from the host's availability listener. */
  answer: RsvpAnswer | undefined;
  /** On the radiogroup: the vestuario's «Primeros pasos» jumps to it. */
  id?: string;
  /** The host's placement (margins, width). */
  className?: string;
}

export function RsvpSwitch({ match, now, answer, id, className }: Props) {
  const me = useMe();
  const { error, write } = useWrite();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const state = kickoffWindow(match, now);
  const root = `mp-rsvp${className ? ` ${className}` : ""}`;
  if (state !== "open")
    return (
      <p className={`${root} mp-note mp-closed`}>
        {state === "undated" ? "La convocatoria se abre cuando el partido tenga fecha." : "La convocatoria se cerró a la hora del partido."}
      </p>
    );

  const index = RSVP_OPTIONS.findIndex((o) => o.value === answer);
  // The local cache updates the answer at once; the rest of the team sees it in realtime.
  const respond = (value: RsvpAnswer) => {
    if (me) write(() => setAvailability(me, match.id, value));
  };
  // The ARIA radio pattern: one tab stop, the arrows move and choose (Home / End: first and last).
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = RSVP_OPTIONS.length - 1;
    const to = e.key === "Home" ? 0 : e.key === "End" ? last : e.key in STEP ? (i + STEP[e.key] + RSVP_OPTIONS.length) % RSVP_OPTIONS.length : null;
    if (to == null) return;
    e.preventDefault();
    buttons.current[to]?.focus();
    respond(RSVP_OPTIONS[to].value);
  };
  return (
    <div className={root}>
      <div className="mp-rsvp-track" id={id} role="radiogroup" aria-label="Tu respuesta a la convocatoria">
        {index >= 0 && <span className="mp-rsvp-thumb" style={{ transform: `translateX(${index * 100}%)` }} aria-hidden="true" />}
        {RSVP_OPTIONS.map((o, i) => (
          <button
            key={o.value}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={answer === o.value}
            tabIndex={i === Math.max(0, index) ? 0 : -1}
            onClick={() => respond(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {answer === o.value && <Icon name="check" size={15} stroke={3} />}
            {o.label}
          </button>
        ))}
      </div>
      <WriteError text={error} />
    </div>
  );
}
