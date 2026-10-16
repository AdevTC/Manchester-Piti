// «Responder desde el aviso»: a notice's «Voy» / «No puedo» button opens /vestuario?rsvp=yes|no&m=<id>&n=<nonce>
// (public/push-sw.js). Once the member and the match are known, the answer is written once, through the
// same setAvailability as the RSVP switch, with «Deshacer» in the toast — but only with the worker's
// one-time ticket (src/lib/rsvpTicket.ts): a link alone (crafted, reused, expired) never answers for a
// member, it asks («¿Apuntarte como No puedo · J5 vs Rival?» with «Apuntarme»). The params always leave
// the URL (replace), so a reload never answers twice. A closed convocatoria writes nothing; a fan gets nothing.
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ClubMatch } from "../../lib/clubData";
import { kickoffWindow } from "../../lib/derived/memberWindows";
import { jornadaOf } from "../../lib/derived/jornada";
import { consumeRsvpTicket } from "../../lib/rsvpTicket";
import { setAvailability, type Me } from "./writes";

type Answer = "yes" | "no" | "maybe";
const WORD: Record<Answer, string> = { yes: "Voy", no: "No puedo", maybe: "Duda" };
/** Long enough to reach «Deshacer» (or «Apuntarme») after the vestuario opens from the notice. */
export const RSVP_TOAST_MS = 10_000;

/** «J5 vs Rival» (without its jornada: «vs Rival»). */
const matchLabel = (match: Pick<ClubMatch, "rival">, jornada: number | null) => `${jornada ? `J${jornada} ` : ""}vs ${match.rival?.trim() || "Rival"}`;
/** «Apuntado: Voy · J5 vs Rival». */
export function rsvpToastText(answer: Answer, match: Pick<ClubMatch, "rival">, jornada: number | null): string {
  return `Apuntado: ${WORD[answer]} · ${matchLabel(match, jornada)}`;
}
/** «¿Apuntarte como No puedo · J5 vs Rival?» (a link without its ticket asks first). */
export function rsvpAskText(answer: Answer, match: Pick<ClubMatch, "rival">, jornada: number | null): string {
  return `¿Apuntarte como ${WORD[answer]} · ${matchLabel(match, jornada)}?`;
}

export interface RsvpFromNotice {
  /** The validated search params (router.tsx vestuarioSearchSchema). */
  rsvp: "yes" | "no" | undefined;
  m: string | undefined;
  /** The worker's one-time ticket (only a notice's tap has one). */
  n: string | undefined;
  /** Inside the vestuario (useViewer().member): anyone else gets nothing. */
  member: boolean;
  /** Who writes (useMe): null until the profile is there. */
  me: Me | null;
  matches: readonly ClubMatch[];
  matchesLoading: boolean;
  /** This member's current answer to `m` (from that match's availability listener). */
  previous: { loading: boolean; answer: Answer | undefined };
  now: number;
  /** Takes rsvp, m and n out of the URL (navigate with replace). */
  clear: () => void;
}

export function useRsvpFromNotice({ rsvp, m, n, member, me, matches, matchesLoading, previous, now, clear }: RsvpFromNotice): void {
  // The link already handled (rsvp:m:n): one write per tap, whatever the re-renders before the URL clears.
  const handled = useRef<string | null>(null);
  const clearRef = useRef(clear);
  useEffect(() => {
    clearRef.current = clear;
  });
  useEffect(() => {
    if (!rsvp && !m && !n) return;
    const key = `${rsvp ?? ""}:${m ?? ""}:${n ?? ""}`;
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
    const jornada = jornadaOf(matches, match.id);
    const write = () => {
      setAvailability(me, match.id, rsvp).catch(() => toast.error("No se ha podido guardar tu respuesta. Prueba desde el partido."));
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
      toast.success(rsvpToastText(rsvp, match, jornada), { duration: RSVP_TOAST_MS, ...(undo ? { action: undo } : {}) });
    };
    // Only the notice's own ticket answers at once; anything else asks first.
    void consumeRsvpTicket(n, rsvp, match.id).then((ok) => {
      if (ok) write();
      else toast(rsvpAskText(rsvp, match, jornada), { duration: RSVP_TOAST_MS, action: { label: "Apuntarme", onClick: write } });
    });
  }, [rsvp, m, n, member, me, matches, matchesLoading, previous.loading, previous.answer, now]);
}
