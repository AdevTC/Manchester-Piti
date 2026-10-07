// The board for component tests, without Firebase: the harness keeps the lineup in state (like the real
// session does between autosaves) and lets each test override the session and the board's props.
import { useState } from "react";
import type { Lineup } from "../formations";
import { Board, type BoardProps } from "./Board";
import { PREFS0 } from "./prefs";
import type { BoardSession } from "./useBoardSession";
import { demoSquad, fakeSession } from "./testkit";

export interface HarnessProps {
  initial: Lineup;
  ro?: boolean;
  onCommit?: (l: Lineup) => void;
  onDuplicate?: () => void;
  session?: Partial<BoardSession>;
  props?: Partial<BoardProps>;
}

export function BoardHarness({ initial, ro = false, onCommit, onDuplicate, session: over, props }: HarnessProps) {
  const [lineup, setLineup] = useState(initial);
  const [sq] = useState(demoSquad);
  const session = fakeSession(lineup, {
    readOnly: ro,
    official: ro,
    commit: (n) => {
      onCommit?.(n);
      setLineup(n);
    },
    duplicate: onDuplicate ?? (() => {}),
    ...over,
  });
  return (
    <Board
      session={session}
      squad={sq}
      seasonId="t1"
      seasonName="Temporada 1"
      seasons={[{ id: "t1", name: "Temporada 1" }]}
      onSeason={() => {}}
      match={{ short: "J8 · MAD SKY", date: "sáb 8 nov" }}
      meId="tello"
      prefs={PREFS0}
      onPrefs={() => {}}
      now={0}
      calendar={[]}
      nextMatch={null}
      isAdmin={false}
      official={null}
      reactions={null}
      conv={{ match: null, loading: false, error: false }}
      theme={{ day: false, toggle: () => {} }}
      crest={<a href="/">Inicio</a>}
      {...props}
    />
  );
}
