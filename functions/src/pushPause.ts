// «Pausar» a device (TU boards: Avisos a medida, the bandeja's side and the bell's «⋯»): by its endpoint, like
// pushSetPreset (the endpoint is the device's own secret; the service worker has no session), the device's
// subscription doc gets `pausedUntil` (ms) or loses it. sendTo (push.ts) skips a paused device for every notice;
// the bell keeps them all (sendTo stores the notice before it looks at any device). The logic: pushPauseLogic.ts.
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db, parse } from "./common.js";
import { clampPause } from "./pushPauseLogic.js";

const subId = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 40);

/** `until`: ms in (now, now + a week] (clamped to the week), or null to resume. Answers the pause kept. */
export const pushSetPause = onCall(async (req) => {
  const input = parse(
    z.object({
      endpoint: z.url().refine((u) => u.startsWith("https://"), "Suscripción no válida."),
      until: z.number().int().nullable(),
    }),
    req.data,
  );
  const now = Date.now();
  const pause = clampPause(input.until, now);
  if (!pause.ok) throw new HttpsError("invalid-argument", "Una pausa dura como mucho una semana, a partir de ahora.");
  const ref = db.doc(`pushSubscriptions/${subId(input.endpoint)}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Este dispositivo ya no recibe avisos.");
    tx.update(ref, { pausedUntil: pause.until === null ? FieldValue.delete() : pause.until, updatedAt: FieldValue.serverTimestamp() });
    return { pausedUntil: pause.until };
  });
});
