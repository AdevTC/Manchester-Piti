// «Tu voto»: a member's MVP ballot while the 48 h window runs. The same choices and the same write
// (voteMvp) in the vestuario and in the match page's Vestuario tab. It sits under each host's MVP race
// (block 3, mvpRace): the race shows the counts, the ballot only takes this member's vote.
import { useId, useState } from "react";
import type { ClubMatch } from "../../../lib/clubData";
import { mvpCandidates, mvpVoteOpen } from "../../../lib/derived/memberWindows";
import { useMyMvpVote } from "../live";
import { useMe, voteMvp } from "../writes";
import { Icon } from "../../../components/celeste/icons";
import { useWrite } from "./useWrite";
import { WriteError } from "./WriteError";
import "./member.css";

interface Props {
  match: Pick<ClubMatch, "id" | "status" | "voteClosesAt" | "ledger">;
  /** The server's clock: the ballot closes with the vote (firestore.rules mvpOpen()). */
  now: number;
  uid: string | undefined;
  /** The tally so far (mvpResults): the most voted come first. */
  counts: Record<string, number> | undefined;
  nameOf: (id: string) => string;
  /** The team's votes so far, beside the button (the vestuario; the match tab says it in its MVP card). */
  total?: number;
  /** The host's placement. */
  className?: string;
}

export function MvpBallot({ match, now, uid, counts, nameOf, total, className }: Props) {
  const myVote = useMyMvpVote(match.id, uid);
  // (keyed by match: a pick never carries over to another match's ballot)
  const [selection, setSelection] = useState<{ id: string; pick: string } | null>(null);
  const { error, write } = useWrite();
  const me = useMe();
  const group = useId();
  if (!mvpVoteOpen(match, now)) return null;
  const candidates = mvpCandidates(match.ledger, counts, nameOf);
  if (!candidates.length) return null;
  const voted = myVote.data || undefined;
  const pick = selection?.id === match.id ? selection.pick : voted;
  const vote = () => {
    if (me && pick) write(() => voteMvp(me, match.id, pick));
  };
  return (
    <div className={`ma-ballot${className ? ` ${className}` : ""}`}>
      <fieldset>
        <legend>Tu voto</legend>
        <div className="ma-ballot-list">
          {candidates.map((id) => (
            <label key={id}>
              <input type="radio" name={group} value={id} checked={pick === id} onChange={() => setSelection({ id: match.id, pick: id })} />
              {pick === id && <Icon name="check" size={14} stroke={3} />}
              {nameOf(id)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="ma-ballot-foot">
        <button type="button" className="ma-btn" disabled={!pick || pick === voted} onClick={vote}>
          {pick && pick === voted ? "Voto guardado" : voted ? "Cambiar mi voto" : "Votar al MVP"}
        </button>
        {total != null && (
          <span className="ma-count">
            {total} {total === 1 ? "voto del equipo" : "votos del equipo"}
          </span>
        )}
      </div>
      <WriteError text={error} />
    </div>
  );
}
