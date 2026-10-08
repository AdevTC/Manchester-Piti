// The convocatoria rows (`.cvl` / `.cvr`), shared by the match's «Convocatoria» tab and the
// Convocatorias view: dorsal, name, position (+ the member's RSVP in the view) and Titular / Suplente /
// No conv. as a pressed-button group. Unassigned rows carry the amber outline (class U).
import type { RosterPlayer } from "../data/useAdminData";
import { roleOf, type Lineup, type Role } from "../acta/convocatoria";
import { positionName } from "../acta/roster";
import type { Rsvp } from "./live";

const ROLE_WORD: Record<Role, string> = { T: "titular", S: "suplente", N: "no convocado", "": "sin asignar" };
const RSVP_WORD = { yes: "viene", maybe: "en duda", no: "no viene" } as const;
const RSVP_CLASS = { yes: "si", maybe: "duda", no: "no" } as const;

export function ConvocatoriaRows({
  roster,
  lineup,
  onSet,
  rsvp,
  forWhat,
}: {
  roster: readonly RosterPlayer[];
  lineup: Lineup;
  onSet: (playerId: string, role: Role) => void;
  /** The members' answers (the Convocatorias view shows them on each row). */
  rsvp?: readonly Rsvp[];
  /** «para la J8» in each group's name. */
  forWhat?: string;
}) {
  const answer = new Map((rsvp ?? []).filter((a) => a.playerId).map((a) => [a.playerId as string, a.response]));
  return (
    <ul className="cvl">
      {roster.map((p) => {
        const role = roleOf(lineup, p.id);
        const pos = positionName(p.position);
        const a = answer.get(p.id);
        return (
          <li key={p.id} className={`cvr ${role || "U"}`}>
            <span className="dn2">{p.number ?? "—"}</span>
            <span className="w">
              <b>{p.name}</b>
              <small>
                {rsvp ? (
                  <>
                    {pos} · <span className={`rs ${a ? RSVP_CLASS[a] : ""}`.trim()}>{a ? RSVP_WORD[a] : "sin respuesta"}</span>
                    {!role && " · sin asignar"}
                  </>
                ) : (
                  `${pos} · ${ROLE_WORD[role]}`
                )}
              </small>
            </span>
            <div className="sg" role="group" aria-label={`Convocatoria de ${p.name}${forWhat ? ` ${forWhat}` : ""}`}>
              {(
                [
                  ["T", "Titular", "Titular"],
                  ["S", "Suplente", "Supl."],
                  ["N", "No conv.", "No"],
                ] as const
              ).map(([r, l1, l2]) => (
                <button key={r} type="button" aria-pressed={role === r} onClick={() => onSet(p.id, r)} aria-label={r === "N" ? "No convocado" : l1}>
                  <span className="l1" aria-hidden="true">
                    {l1}
                  </span>
                  <span className="l2" aria-hidden="true">
                    {l2}
                  </span>
                </button>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
