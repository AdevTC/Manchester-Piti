// What the score's own window shows (V-Vivo «Sacar el marcador», V-Sistema «La ventana aparte»): the light field
// of the moment behind, our crest, the big score and the rival's crest; a bold line — «En directo, 23′», or the
// play for its four seconds — and under it the last play («21′ Gol de Adrián T.C., pase de Jordi»). The goal
// plays here too (the rings and dust, the digit's roll).
import { VidrioSky } from "../VidrioSky";
import { skyAt } from "../sky";
import { rivalInitials } from "./liveModel";

export interface PipScoreProps {
  big: string | null;
  rival: string;
  head: string;
  sub: string;
  now: number;
  live: boolean;
  /** The goal: the digit's class and who scored (the rings and dust for ours, coral for theirs). */
  digit?: string;
  fx?: "us" | "them" | null;
  gold?: boolean;
  cold?: boolean;
}

export function PipScore({ big, rival, head, sub, now, live, digit, fx = null, gold, cold }: PipScoreProps) {
  const sky = skyAt(now, live);
  return (
    <div className={`vd-pipscr${fx ? ` is-fx is-fx--${fx}` : ""}`}>
      <VidrioSky light={sky.light} floodlit={sky.floodlit} gold={gold} cold={cold} className="vd-pipscr__sky" />
      <div className="vd-pipscore">
        <img className="vd-pipscore__crest" src="/crest-128.webp" alt="" />
        {big && <span className={`vd-score vd-pipscore__num${digit ? ` ${digit}` : ""}`}>{big}</span>}
        <span className="vd-team__crest vd-team__crest--rival vd-pipscore__or" aria-hidden="true">
          {rivalInitials(rival)}
        </span>
        <span className="vd-wave" aria-hidden="true" />
        <span className="vd-wave vd-wave--2" aria-hidden="true" />
      </div>
      <p>
        <b>{head}</b>
        {sub && <span>{sub}</span>}
      </p>
    </div>
  );
}
