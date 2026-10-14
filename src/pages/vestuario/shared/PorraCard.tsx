// «¿Cómo acaba?»: a member's porra for a match, with its scoring rule always in sight. The same steppers
// and the same write (predictScore) in the vestuario and in the match page's Vestuario tab; each host
// keeps its own frame (kicker, heading, links) around it.
import { useState } from "react";
import { dateMillis, type ClubMatch } from "../../../lib/clubData";
import { kickoffWindow } from "../../../lib/derived/memberWindows";
import { countdown } from "../../../lib/vestuario";
import { useMyPrediction } from "../live";
import { predictScore, useMe } from "../writes";
import { useWrite } from "./useWrite";
import { WriteError } from "./WriteError";
import "./member.css";

/** How the porra scores: shown wherever a porra can be made or is about to open. */
export const PORRA_RULE = "3 puntos si clavas el resultado, 1 si aciertas quién gana.";
/** The rules accept 0–30 a side (firestore.rules, predictions). */
const MAX_GOALS = 30;

interface Props {
  match: Pick<ClubMatch, "id" | "status" | "date" | "rival">;
  /** The server's clock: the porra closes at the match's date (firestore.rules upcoming()). */
  now: number;
  /** The member's uid (their own prediction is the only one readable before kick-off). */
  uid: string | undefined;
  /** The host's placement. */
  className?: string;
}

export function PorraCard({ match, now, uid, className }: Props) {
  const saved = useMyPrediction(match.id, uid);
  // (keyed by match: the vestuario's next match can change under an unsaved draft)
  const [draft, setDraft] = useState<{ id: string; gf: number; ga: number } | null>(null);
  const [announce, setAnnounce] = useState("");
  const { error, write } = useWrite();
  const me = useMe();
  const state = kickoffWindow(match, now);
  const open = state === "open";
  const mine = draft?.id === match.id ? draft : null;
  const gf = mine ? mine.gf : (saved.data?.goalsFor ?? 0);
  const ga = mine ? mine.ga : (saved.data?.goalsAgainst ?? 0);
  const dirty = !!mine && (mine.gf !== saved.data?.goalsFor || mine.ga !== saved.data?.goalsAgainst);
  const rival = match.rival || "Rival";
  const set = (side: "gf" | "ga", delta: number) => {
    const base = { id: match.id, gf, ga };
    setAnnounce("");
    setDraft({ ...base, [side]: Math.max(0, Math.min(MAX_GOALS, base[side] + delta)) });
  };
  // The draft stays until the server accepts the write: a refusal leaves the score as the member set it,
  // under the error. (Only the draft that was saved is dropped; a step taken meanwhile stays.)
  const save = () => {
    if (!me) return;
    write(
      () => predictScore(me, match.id, gf, ga),
      () => {
        setDraft((d) => (d && d.id === match.id && d.gf === gf && d.ga === ga ? null : d));
        setAnnounce(`Porra guardada: ${gf} a ${ga}.`);
      },
    );
  };
  return (
    <div className={`ma-porra${className ? ` ${className}` : ""}`}>
      <div className="ma-porra-board" role="group" aria-label={`Tu porra: Piti contra ${rival}`}>
        <Side label="Piti" who="del Piti" value={gf} open={open} onChange={(d) => set("gf", d)} />
        <span className="ma-porra-dash" aria-hidden="true">
          –
        </span>
        <Side label={rival} who={match.rival ? `de ${match.rival}` : "del rival"} value={ga} open={open} onChange={(d) => set("ga", d)} them />
      </div>
      {open && (
        <div className="ma-porra-save">
          <button type="button" className="ma-btn" disabled={!dirty && !!saved.data} onClick={save}>
            {saved.data && !dirty ? "Porra guardada" : saved.data ? "Cambiar mi porra" : "Guardar mi porra"}
          </button>
        </div>
      )}
      <p className="ma-note">
        {open
          ? `Cierra en ${countdown(dateMillis(match.date), now)}.`
          : state === "undated"
            ? "La porra se abre cuando el partido tenga fecha."
            : state === "unavailable"
              ? "Este partido no admite porra."
              : "La porra se cerró a la hora del partido."}{" "}
        {PORRA_RULE}
      </p>
      <WriteError text={error} />
      {/* the only announcement: once, after a save (the scores themselves stay silent) */}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

function Side({ label, who, value, open, onChange, them = false }: { label: string; who: string; value: number; open: boolean; onChange: (d: number) => void; them?: boolean }) {
  return (
    <div className={`ma-side${them ? " them" : ""}`}>
      <span className="ma-side-lbl">{label}</span>
      {/* (an <output> is a polite live region by itself: «off» keeps each step from announcing a bare digit) */}
      <output className="ma-score" aria-live="off">
        {value}
      </output>
      <div className="ma-steps">
        <button type="button" className="ma-step" aria-label={`Un gol menos ${who}`} disabled={!open || value === 0} onClick={() => onChange(-1)}>
          −
        </button>
        <button type="button" className="ma-step plus" aria-label={`Un gol más ${who}`} disabled={!open || value === MAX_GOALS} onClick={() => onChange(1)}>
          +
        </button>
      </div>
    </div>
  );
}
