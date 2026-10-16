// «Responder desde el aviso»: a notice's «Voy» / «No puedo» button opens /vestuario?rsvp=yes|no&m=<id>
// (public/push-sw.js). Once the member and the match are known, the answer is written once, through the
// same setAvailability as the RSVP switch, with «Deshacer» in the toast; the params leave the URL
// (replace), so a reload never answers twice. A closed convocatoria writes nothing; a fan gets nothing.
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ClubMatch } from "../../lib/clubData";
import { kickoffWindow } from "../../lib/derived/memberWindows";
import { jornadaOf } from "../../lib/derived/jornada";
import { setAvailability, type Me } from "./writes";

type Answer = "yes" | "no" | "maybe";
const WORD: Record<Answer, string> = { yes: "Voy", no: "No puedo", maybe: "Duda" };
/** Long enough to reach «Deshacer» after the vestuario opens from the notice. */
export const RSVP_TOAST_MS = 10_000;

/** «Apuntado: Voy · J5 vs Rival» (without its jornada: «Apuntado: Voy · vs Rival»). */
export function rsvpToastText(answer: Answer, match: Pick<ClubMatch, "rival">, jornada: number | null): string {
  return `Apuntado: ${WORD[answer]} · ${jornada ? `J${jornada} ` : ""}vs ${match.rival?.trim() || "Rival"}`;
}

export interface RsvpFromNotice {
  /** The validated search params (router.tsx vestuarioSearchSchema). */
  rsvp: "yes" | "no" | undefined;
  m: string | undefined;
  /** Inside the vestuario (useViewer().member): anyone else gets nothing. */
  member: boolean;
  /** Who writes (useMe): null until the profile is there. */
  me: Me | null;
  matches: readonly ClubMatch[];
  matchesLoading: boolean;
  /** This member's current answer to `m` (from that match's availability listener). */
  previous: { loading: boolean; answer: Answer | undefined };
  now: number;
  /** Takes rsvp and m out of the URL (navigate with replace). */
  clear: () => void;
}

export function useRsvpFromNotice({ rsvp, m, member, me, matches, matchesLoading, previous, now, clear }: RsvpFromNotice): void {
  // The link already handled (rsvp:m): one write per tap, whatever the re-renders before the URL clears.
  const handled = useRef<string | null>(null);
  const clearRef = useRef(clear);
  useEffect(() => {
    clearRef.current = clear;
  });
  useEffect(() => {
    if (!rsvp && !m) return;
    const key = `${rsvp ?? ""}:${m ?? ""}`;
    if (handled.current === key) return;
    const finish = () => {
      handled.current = key;
      clearRef.current();
    };
    // Half a link (a param the router dropped): nothing to answer, just tidy the URL.
    if (!rsvp || !m) return finish();
    // Not a member (or not known yet): nothing.
    if (!member || !me || matchesLoading) return;
    const match = matches.find((x) => x.id === m);
    if (!match) return finish();
    if (kickoffWindow(match, now) !== "open") {
      finish();
      toast("La convocatoria ya está cerrada");
      return;
    }
    // (the answer to put back on «Deshacer»)
    if (previous.loading) return;
    finish();
    const before = previous.answer;
    const failed = () => toast.error("No se ha podido guardar tu respuesta. Prueba desde el partido.");
    setAvailability(me, match.id, rsvp).catch(failed);
    const undo =
      before && before !== rsvp
        ? {
            label: "Deshacer",
            onClick: () => {
              setAvailability(me, match.id, before).then(
                () => toast(`Vuelves a «${WORD[before]}»`),
                () => toast.error("No se ha podido deshacer."),
              );
            },
          }
        : undefined;
    toast.success(rsvpToastText(rsvp, match, jornadaOf(matches, match.id)), { duration: RSVP_TOAST_MS, ...(undo ? { action: undo } : {}) });
  }, [rsvp, m, member, me, matches, matchesLoading, previous.loading, previous.answer, now]);
}
