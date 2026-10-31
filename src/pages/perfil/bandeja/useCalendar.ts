// The season's fixture as ONE notice, for la bandeja and the bell alike: the «Nuevo partido» notices the calendar
// created (one per jornada) leave their match stacks and come back as «Calendario: N jornadas nuevas», with the
// jornada, the day and the rival of each one read from the club's matches.
import { useMemo } from "react";
import { useClubData } from "../../../lib/clubData";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { jornadaOf } from "../../../components/vidrio/account/accountModel";
import { calendarBatch, collapseFixtures, stackSummary } from "./model";
import type { Inbox } from "./useInbox";

/** The id the batch goes by when it sits among the notices. */
export const CAL_ID = "__calendario";

export interface CalendarFold {
  /** The match stacks without the fixture's notices (a stack left empty is gone). */
  stacks: Inbox["stacks"];
  /** The fixture's notices folded into one (null: fewer than two, they stay where they were). */
  cal: ReturnType<typeof calendarBatch> | null;
  /** Some notice of the batch is still unread. */
  unread: boolean;
}

export function useCalendarFold(inbox: Pick<Inbox, "stacks" | "reads">): CalendarFold {
  const { matches } = useClubData();
  const { stacks, batch } = useMemo(() => {
    const f = collapseFixtures(inbox.stacks);
    // (a stack that lost its «Nuevo partido» says what is left: its line was made of its notices' titles)
    const before = new Map(inbox.stacks.map((s) => [s.matchId, s.rows.length]));
    const stacks = f.stacks.map((s) => (before.get(s.matchId) === s.rows.length ? s : { ...s, sum: stackSummary(s.res, s.rival, s.marks, s.rows.map((r) => r.title)) }));
    return { stacks, batch: f.batch };
  }, [inbox.stacks]);
  const cal = useMemo(() => {
    if (!batch.length) return null;
    const byId = new Map(matches.map((m) => [m.id, m]));
    return calendarBatch(batch, (id) => {
      const m = byId.get(id);
      return m ? { j: jornadaOf(matches, m), at: dateMillis(m.date), rival: m.rival?.trim() || "" } : null;
    });
  }, [batch, matches]);
  return { stacks, cal, unread: !!cal && batch.some((n) => inbox.reads.unread(n)) };
}
