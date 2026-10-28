// CAJA · the season's caja as the screens use it: the live caja and its payment notices (data/useCaja, the
// vestuario's shared listeners) plus what is still behind its «Deshacer» (A-CLUB-06: «Se apunta al momento, con
// «Deshacer» 5 s»). Every write but «Anular» goes through the franja's defer(): the change shows at once (the
// movements with the ids they will have, the notice gone from the queue, the new settings), the write waits 5 s
// and only then commits; «Deshacer» drops it and nothing is written. A failed write puts the screen back and the
// franja says it in the error tone with «Reintentar» (B-CLUB-12). Offline, Firestore keeps the write on this
// device and the line says it goes up by itself when the network is back (M-22).
import { useCallback, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../../context/AuthContext";
import type { CajaMov, CajaSettings, NewCajaMov } from "../../../../lib/derived/caja";
import { claimPagoFields, type CajaClaim } from "../../../../lib/derived/cajaClaims";
import { apiError } from "../../../../lib/clubApi";
import { newCajaMovId, useCaja, useCajaClaims, useCajaWrites } from "../../data/useCaja";
import { useOnline } from "../../shell/season";
import { useStatus } from "../../shell/statusContext";
import { useMarkClaimNoticeRead } from "./claimNotice";
import { withPending } from "./model";

interface Op {
  key: number;
  movs: CajaMov[];
  /** A payment notice answered here (gone from the queue, in «Resueltos» as answered). */
  claim?: CajaClaim;
  settings?: CajaSettings;
}

export interface WriteSpec {
  tag: string;
  message: string;
  /** «No se ha podido confirmar el pago de ERIK» (the franja adds the reason). */
  errorMessage: string;
}

export interface CajaBook {
  loading: boolean;
  error: boolean;
  settings: CajaSettings;
  /** Live + still behind «Deshacer». */
  movs: readonly CajaMov[];
  /** Every notice of the season, pending first (the ones answered here already answered). */
  claims: readonly CajaClaim[];
  /** Movements: appended (one batch), deferred. */
  addMovs: (spec: WriteSpec, movs: readonly NewCajaMov[], after?: () => void) => void;
  saveSettings: (spec: WriteSpec, s: Pick<CajaSettings, "cuota" | "cuotaPeriod" | "howToPay">) => void;
  confirmClaim: (spec: WriteSpec, claim: CajaClaim) => void;
  rejectClaim: (spec: WriteSpec, claim: CajaClaim, reason: string) => void;
  /** «Anular» (no «Deshacer»: it asked first): written at once; a failure is said in the error tone. */
  voidMov: (mov: CajaMov, spec: WriteSpec) => void;
}

export function useCajaBook(seasonId: string | undefined, now: number): CajaBook {
  const caja = useCaja(seasonId);
  const live = useCajaClaims(seasonId, !!seasonId);
  const writes = useCajaWrites();
  const status = useStatus();
  const online = useOnline();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  // (the captain's centro de avisos: answering a notice here marks its «Pago avisado» read, H-SH-02)
  const markRead = useMarkClaimNoticeRead();
  const [ops, setOps] = useState<Op[]>([]);
  const seq = useRef(0);

  const drop = useCallback((key: number) => setOps((xs) => xs.filter((o) => o.key !== key)), []);

  const defer = useCallback(
    (spec: WriteSpec, op: Omit<Op, "key">, commit: () => Promise<unknown>, after?: () => void) => {
      seq.current += 1;
      const key = seq.current;
      setOps((xs) => [...xs, { ...op, key }]);
      status.defer({
        tag: online ? spec.tag : "En este dispositivo",
        message: online ? spec.message : `${spec.message} · se sube solo al volver la red`,
        errorMessage: spec.errorMessage,
        commit,
        onUndo: () => drop(key),
        onError: () => drop(key),
        onDone: () => {
          drop(key);
          after?.();
        },
      });
    },
    [status, online, drop],
  );

  const sid = seasonId ?? "";
  const pendingMovs = useMemo(() => ops.flatMap((o) => o.movs), [ops]);
  const movs = useMemo(() => withPending(caja.movs, pendingMovs), [caja.movs, pendingMovs]);
  const claims = useMemo(() => {
    const answered = new Map(ops.filter((o) => o.claim).map((o) => [o.claim!.id, o.claim!]));
    if (!answered.size) return live.data;
    return live.data.map((c) => (c.status === "pendiente" && answered.has(c.id) ? answered.get(c.id)! : c));
  }, [live.data, ops]);
  const settings = useMemo(() => [...ops].reverse().find((o) => o.settings)?.settings ?? caja.settings, [ops, caja.settings]);

  const asMov = useCallback(
    (m: NewCajaMov, id: string): CajaMov => ({ id, seasonId: sid, kind: m.kind, playerId: m.playerId, amount: m.amount, concept: m.concept.trim(), date: m.date, matchId: m.matchId, by: uid, createdAt: now, void: false }),
    [sid, uid, now],
  );

  return {
    loading: caja.loading,
    error: caja.error,
    settings,
    movs,
    claims,
    addMovs: (spec, list, after) => {
      if (!sid || !list.length) return;
      const ids = list.map(() => newCajaMovId());
      defer(spec, { movs: list.map((m, i) => asMov(m, ids[i])) }, () => writes.addMovs(sid, list, ids), after);
    },
    saveSettings: (spec, s) => {
      if (!sid) return;
      defer(spec, { movs: [], settings: { ...s, howToPay: s.howToPay.trim(), updatedAt: now } }, () => writes.saveSettings(sid, s));
    },
    confirmClaim: (spec, claim) => {
      const movId = newCajaMovId();
      const f = claimPagoFields(claim, uid, now);
      const mov: CajaMov = { id: movId, seasonId: f.seasonId, kind: "pago", playerId: f.playerId, amount: f.amount, concept: f.concept, date: f.date, matchId: null, by: uid, createdAt: now, void: false };
      defer(spec, { movs: [mov], claim: { ...claim, status: "confirmado", resolvedBy: uid, resolvedAt: now, movId } }, () => writes.resolveClaim(claim, "confirmado", { movId }), () => markRead(claim.id));
    },
    rejectClaim: (spec, claim, reason) => {
      const why = reason.trim();
      defer(spec, { movs: [], claim: { ...claim, status: "rechazado", resolvedBy: uid, resolvedAt: now, ...(why ? { reason: why } : {}) } }, () => writes.resolveClaim(claim, "rechazado", { reason: why }), () => markRead(claim.id));
    },
    voidMov: (mov, spec) => {
      const attempt = () => {
        writes.voidMov(mov.id).catch((e: unknown) => {
          status.show({ tone: "error", message: `${spec.errorMessage}: ${apiError(e)}`, retry: attempt });
        });
      };
      attempt();
      status.show({ tag: online ? spec.tag : "En este dispositivo", message: online ? spec.message : `${spec.message} · se sube solo al volver la red` });
    },
  };
}
