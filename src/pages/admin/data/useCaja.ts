// La caja in the Sala de control: the season's caja read through the vestuario's shared listener (the same
// one «La caja» in the vestuario reads, so both see the same numbers) and the captains' writes — direct
// batched writes the rules validate (append-only: a correction only flips `void`).
import { useMemo } from "react";
import { collection, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../../../context/AuthContext";
import { cajaMovFields, cajaSettingsFields, cajaVoidFields, type CajaSettings, type NewCajaMov } from "../../../lib/derived/caja";
import { cajaClaimResolveFields, claimPagoFields, type CajaClaim } from "../../../lib/derived/cajaClaims";

export { useCaja, useCajaClaims, type Caja } from "../../vestuario/live";

/** Firestore's cap on one batch (a squad is far below it; bigger lists commit in several). */
const BATCH_MAX = 450;

/** A new cajaMovs id, made here before the write (the caja shows the movement at once under that id, while its
 *  «Deshacer» waits, and the live list's copy replaces it when it arrives). */
export const newCajaMovId = (): string => doc(collection(db, "cajaMovs")).id;

export interface CajaWrites {
  /** Appends movements to a season's caja (one batch: a cuota or a match cost lands whole). `ids`: their ids
   *  (newCajaMovId), one per movement; without them Firestore makes them. */
  addMovs: (seasonId: string, movs: readonly NewCajaMov[], ids?: readonly string[]) => Promise<void>;
  /** «Anular»: the movement stops counting (it stays in the log). */
  voidMov: (id: string) => Promise<void>;
  /** caja/{seasonId}: cuota, its period and «Cómo pagar». */
  saveSettings: (seasonId: string, s: Pick<CajaSettings, "cuota" | "cuotaPeriod" | "howToPay">) => Promise<void>;
  /** «Ya la he pagado»: «Confirmar» (the claim and its `pago`, one batch; `movId` its id) or «Rechazar» (with
   *  its reason, M-20: the member gets it in a push). */
  resolveClaim: (claim: CajaClaim, status: "confirmado" | "rechazado", opts?: { movId?: string; reason?: string }) => Promise<void>;
}

export function useCajaWrites(): CajaWrites {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  return useMemo<CajaWrites>(
    () => ({
      addMovs: async (seasonId, movs, ids) => {
        if (!uid) throw new Error("Sin sesión de capitán");
        for (let i = 0; i < movs.length; i += BATCH_MAX) {
          const batch = writeBatch(db);
          movs.slice(i, i + BATCH_MAX).forEach((m, j) => {
            const id = ids?.[i + j];
            batch.set(id ? doc(db, "cajaMovs", id) : doc(collection(db, "cajaMovs")), { ...cajaMovFields(seasonId, m, uid), createdAt: serverTimestamp() });
          });
          await batch.commit();
        }
      },
      voidMov: async (id) => {
        if (!uid) throw new Error("Sin sesión de capitán");
        // (who and when: the rules require both, so a voided movement always says who undid it)
        await updateDoc(doc(db, "cajaMovs", id), { ...cajaVoidFields(uid), voidedAt: serverTimestamp() });
      },
      saveSettings: async (seasonId, s) => {
        await setDoc(doc(db, "caja", seasonId), { ...cajaSettingsFields(s), updatedAt: serverTimestamp() });
      },
      resolveClaim: async (claim, status, opts) => {
        if (!uid) throw new Error("Sin sesión de capitán");
        const ref = doc(db, "cajaClaims", claim.id);
        if (status === "rechazado") {
          await updateDoc(ref, { ...cajaClaimResolveFields(uid, "rechazado", undefined, opts?.reason), resolvedAt: serverTimestamp() });
          return;
        }
        // (the rules check the pago exists after this batch, for that player, amount and season)
        const batch = writeBatch(db);
        const mov = opts?.movId ? doc(db, "cajaMovs", opts.movId) : doc(collection(db, "cajaMovs"));
        batch.set(mov, { ...claimPagoFields(claim, uid, Date.now()), createdAt: serverTimestamp() });
        batch.update(ref, { ...cajaClaimResolveFields(uid, "confirmado", mov.id), resolvedAt: serverTimestamp() });
        await batch.commit();
      },
    }),
    [uid],
  );
}
