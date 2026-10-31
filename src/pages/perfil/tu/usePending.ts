// «Lo que te toca» (Tú, the card's seal and la bandeja's «Te toca»): the things that wait on him, each answerable
// in place, with its write. An adapter, not a new source: la bandeja's useInbox already holds the convocatoria,
// the door, the open poll, his turno and the MVP vote (its writes: setAvailability, votePoll, markTurnDone,
// voteMvp); this adds what Inicio's useTu had and the bandeja hadn't — what he owes la caja («Ya la he pagado»:
// claimPayment) and his porra for the next match (predictScore). Every read is an existing listener.
import { useState } from "react";
import { useInbox, type Inbox, type Pend } from "../bandeja/useInbox";
import { useCaja, useMyCajaClaims, useMyPrediction } from "../../vestuario/live";
import { claimPayment, predictScore, useMe } from "../../vestuario/writes";
import { balanceOf, fmtEuros } from "../../../lib/derived/caja";
import { cajaOpen, howToPayText, myBalanceText } from "../../../lib/derived/cajaMember";
import { kickoffWindow } from "../../../lib/derived/memberWindows";
import type { ClubMatch } from "../../../lib/clubData";

/** What he owes la caja (only he sees it: «Solo lo ves tú»). */
export interface CajaPend {
  kind: "caja";
  key: "caja";
  /** «Debes 5,00 €». */
  title: string;
  /** How to pay («Bizum a Kevin o en mano el domingo.»). */
  body: string;
  /** He owes and hasn't told the treasurer yet. */
  owes: boolean;
  /** He has told the treasurer and it isn't confirmed yet («Pago avisado»). */
  claimed: boolean;
  done: boolean;
  busy: boolean;
  error: string;
  /** «Ya la he pagado» (a claim the treasurer confirms). */
  claim: () => Promise<void>;
}
/** His porra for the next match, open until kick-off. */
export interface PorraPend {
  kind: "porra";
  key: string;
  matchId: string;
  rival: string;
  /** What he has bet (null: nothing yet). */
  saved: { gf: number; ga: number } | null;
  done: boolean;
  busy: boolean;
  error: string;
  /** «Guardar pronóstico» (our goals first). */
  save: (gf: number, ga: number) => Promise<void>;
}
/** One thing that waits on him: la bandeja's (rsvp · door · poll · turno · mvp — see bandeja/useInbox Pend) or
 *  caja / porra. `done` items stay in the list so the place can show «Lo que ya has hecho». */
export type PendingItem = Pend | CajaPend | PorraPend;

export interface Pending {
  /** In the board's order: convocatoria, caja, turno, encuesta, porra, MVP, the door. */
  items: PendingItem[];
  /** How many are still open (the seal, the Tú tab's badge). */
  open: number;
  /** La bandeja's whole state (notices, stacks, device) for /avisos. */
  inbox: Inbox;
}

const ORDER: Record<PendingItem["kind"], number> = { rsvp: 0, caja: 1, turno: 2, poll: 3, porra: 4, mvp: 5, door: 6 };

/** «Lo que te toca» for the member looking. `seasonId`: la caja's season; `playerId`: his ficha (la caja is a
 *  player's); `next`: the next match (his porra); `now`: the page's clock. Nothing opens for a fan (`enabled` false). */
export function usePending(o: { enabled: boolean; seasonId: string; playerId: string | null; next: Pick<ClubMatch, "id" | "rival" | "status" | "date"> | null; now: number }): Pending {
  const inbox = useInbox();
  const me = useMe();
  const uid = o.enabled ? me?.uid : undefined;

  // ── la caja (a player's)
  const cajaOn = o.enabled && !!o.playerId;
  const caja = useCaja(o.seasonId, cajaOn);
  const claims = useMyCajaClaims(cajaOn ? uid : undefined);
  const [claimSent, setClaimSent] = useState<{ busy: boolean; error: string; ok: boolean } | null>(null);
  const balance = o.playerId ? balanceOf(caja.movs, o.playerId) : 0;
  const open = cajaOn && cajaOpen(caja.settings, caja.movs);
  const owesCaja = open && balance < 0;
  const claimed = claims.data.some((c) => c.status === "pendiente" && c.seasonId === o.seasonId) || !!claimSent?.ok;
  const cajaItem: CajaPend | null = owesCaja
    ? {
        kind: "caja",
        key: "caja",
        title: myBalanceText(balance),
        body: howToPayText(caja.settings),
        owes: !claimed,
        claimed,
        done: claimed,
        busy: !!claimSent?.busy,
        error: claimSent?.error ?? "",
        claim: async () => {
          if (!me || claimed) return;
          setClaimSent({ busy: true, error: "", ok: false });
          try {
            await claimPayment(me, { seasonId: o.seasonId, concept: `La caja: debes ${fmtEuros(-balance)}`, amount: -balance });
            setClaimSent({ busy: false, error: "", ok: true });
          } catch (e) {
            setClaimSent({ busy: false, error: e instanceof Error && e.message ? e.message : "No se ha podido avisar. Inténtalo otra vez.", ok: false });
            throw e;
          }
        },
      }
    : null;

  // ── his porra for the next match (any member), until the kick-off
  const porraMatch = o.enabled && o.next && kickoffWindow(o.next, o.now) === "open" ? o.next : null;
  const prediction = useMyPrediction(porraMatch?.id, uid);
  const [porraSent, setPorraSent] = useState<{ id: string; busy: boolean; error: string; saved: { gf: number; ga: number } | null } | null>(null);
  const here = porraSent && porraSent.id === porraMatch?.id ? porraSent : null;
  const saved = here?.saved ?? (prediction.data ? { gf: prediction.data.goalsFor, ga: prediction.data.goalsAgainst } : null);
  const porraItem: PorraPend | null =
    porraMatch && me
      ? {
          kind: "porra",
          key: `porra-${porraMatch.id}`,
          matchId: porraMatch.id,
          rival: porraMatch.rival?.trim() || "el rival",
          saved,
          done: !!saved,
          busy: !!here?.busy,
          error: here?.error ?? "",
          save: async (gf, ga) => {
            const id = porraMatch.id;
            setPorraSent({ id, busy: true, error: "", saved });
            try {
              await predictScore(me, id, gf, ga, prediction.data?.goals ?? []);
              setPorraSent({ id, busy: false, error: "", saved: { gf, ga } });
            } catch (e) {
              setPorraSent({ id, busy: false, error: "No se ha guardado tu pronóstico. Inténtalo otra vez.", saved });
              throw e;
            }
          },
        }
      : null;

  const items: PendingItem[] = o.enabled ? [...inbox.pends, ...(cajaItem ? [cajaItem] : []), ...(porraItem ? [porraItem] : [])].sort((a, b) => ORDER[a.kind] - ORDER[b.kind]) : [];
  return { items, open: items.filter((p) => !p.done).length, inbox };
}
