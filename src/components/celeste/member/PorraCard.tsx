// «¿Cómo acaba?»: a member's porra for a match, with its scoring rule always in sight. The same steppers
// and the same write (predictScore) in the vestuario and in the match page's Vestuario tab; each host
// keeps its own frame (kicker, heading, links) around it.
import { useState } from "react";
import type { ClubMatch } from "../../../lib/clubData";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { kickoffWindow } from "../../../lib/derived/memberWindows";
import { countdown } from "../../../lib/vestuario";
import { useMyPrediction } from "../../../pages/vestuario/live";
import { predictScore, useMe } from "../../../pages/vestuario/writes";
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
    setDraft({ ...base, [side]: Math.max(0, Math.min(MAX_GOALS, base[side] + delta)) });
  };
  const save = () => {
    if (!me) return;
    write(() => predictScore(me, match.id, gf, ga));
    setDraft(null);
  };
  return (
    <div className={`mp-porra${className ? ` ${className}` : ""}`}>
      <div className="mp-porra-board" role="group" aria-label={`Tu porra: Piti contra ${rival}`}>
        <Side label="Piti" who="del Piti" value={gf} open={open} onChange={(d) => set("gf", d)} />
        <span className="mp-porra-dash" aria-hidden="true">
          –
        </span>
        <Side label={rival} who={match.rival ? `de ${match.rival}` : "del rival"} value={ga} open={open} onChange={(d) => set("ga", d)} them />
      </div>
      {open && (
        <div className="mp-porra-save">
          <button type="button" className="mp-btn" disabled={!dirty && !!saved.data} onClick={save}>
            {saved.data && !dirty ? "Porra guardada" : saved.data ? "Cambiar mi porra" : "Guardar mi porra"}
          </button>
        </div>
      )}
      <p className="mp-note">
        {open
          ? `Cierra en ${countdown(dateMillis(match.date), now)}.`
          : state === "undated"
            ? "La porra se abre cuando el partido tenga fecha."
            : "La porra se cerró a la hora del partido."}{" "}
        {PORRA_RULE}
      </p>
      <WriteError text={error} />
    </div>
  );
}

function Side({ label, who, value, open, onChange, them = false }: { label: string; who: string; value: number; open: boolean; onChange: (d: number) => void; them?: boolean }) {
  return (
    <div className={`mp-side${them ? " them" : ""}`}>
      <span className="mp-side-lbl">{label}</span>
      <output className="mp-score" aria-live="polite">
        {value}
      </output>
      <div className="mp-steps">
        <button type="button" className="mp-step" aria-label={`Un gol menos ${who}`} disabled={!open || value === 0} onClick={() => onChange(-1)}>
          −
        </button>
        <button type="button" className="mp-step plus" aria-label={`Un gol más ${who}`} disabled={!open || value === MAX_GOALS} onClick={() => onChange(1)}>
          +
        </button>
      </div>
    </div>
  );
}
