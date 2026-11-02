// r14 · los ajustes de la pizarra te siguen (PZ-D21E): the member's Ajustes (sound, the camera on entering a place,
// the default layer, names and galones on the pitch, motion) live in users/{uid}/private/pizarra = { prefs, at }
// and follow him to any device; this device keeps a copy in localStorage (`mp_pizarra_r14_prefs`, the
// prototype's key) as cache and fallback (signed out, offline, before the doc arrives). The server's copy wins
// when it arrives; a change is written to both at once. Values are validated here (a bad one falls back to its
// default); firestore.rules caps the doc (≤ 24 keys, only its owner).
import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { z } from "zod";
import { db } from "../../../firebase";
import { useLiveDoc } from "../../vestuario/live";

export const PREFS_KEY = "mp_pizarra_r14_prefs";

export const CAMARAS = ["sitio", "pizarra", "grada", "foco"] as const;
export type Camara = (typeof CAMARAS)[number];
export const MOVS = ["sistema", "menos"] as const;

export interface PizarraPrefs {
  /** Sounds on «siete listo» / publicar. */
  sonido: boolean;
  /** The camera on entering a place: «sitio» = each place's own default. */
  camara: Camara;
  /** The default layer of the pitch («nada», «quimica»…: the store's LAYERS ids). */
  capa: string;
  /** Names on the plates. */
  nombre: boolean;
  /** Galones on the pitch. */
  galones: boolean;
  /** Motion: follow the system's setting, or always less. */
  mov: (typeof MOVS)[number];
  /** Mute the charla's voices on this member's devices. */
  vozMute: boolean;
}
export const PREFS_DEFAULT: PizarraPrefs = { sonido: false, camara: "sitio", capa: "nada", nombre: true, galones: true, mov: "sistema", vozMute: false };

const schema = z.object({
  sonido: z.boolean().catch(PREFS_DEFAULT.sonido),
  camara: z.enum(CAMARAS).catch(PREFS_DEFAULT.camara),
  capa: z.string().min(1).max(20).regex(/^[a-z0-9_-]+$/).catch(PREFS_DEFAULT.capa),
  nombre: z.boolean().catch(PREFS_DEFAULT.nombre),
  galones: z.boolean().catch(PREFS_DEFAULT.galones),
  mov: z.enum(MOVS).catch(PREFS_DEFAULT.mov),
  vozMute: z.boolean().catch(PREFS_DEFAULT.vozMute),
});

/** Any stored value → the prefs (unknown keys dropped, a bad value back to its default). */
export function parsePrefs(raw: unknown): PizarraPrefs {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const filled = Object.fromEntries((Object.keys(PREFS_DEFAULT) as (keyof PizarraPrefs)[]).map((k) => [k, k in src ? src[k] : PREFS_DEFAULT[k]]));
  const r = schema.safeParse(filled);
  return r.success ? r.data : { ...PREFS_DEFAULT };
}

export function readLocalPrefs(): PizarraPrefs {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PREFS_KEY) : null;
    return parsePrefs(raw ? JSON.parse(raw) : {});
  } catch {
    return { ...PREFS_DEFAULT };
  }
}
export function writeLocalPrefs(p: PizarraPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* private mode / full: the server copy still follows the member */
  }
}

const mapServer = (d: Record<string, unknown> | undefined): PizarraPrefs | null => (d && d.prefs ? parsePrefs(d.prefs) : null);

/** The member's pizarra prefs (live, from any device) and `set(patch)`. `uid` null (signed out, `?preview`): this
 *  device only. A failed server write keeps the local change (Firestore retries it when back online). */
export function usePizarraPrefs(uid: string | null): { prefs: PizarraPrefs; set: (patch: Partial<PizarraPrefs>) => void; synced: boolean } {
  const [local, setLocal] = useState<PizarraPrefs>(readLocalPrefs);
  const live = useLiveDoc(uid ? `users/${uid}/private/pizarra` : null, "prefs", mapServer, null);
  const server = uid ? live.data : null;
  // the server's copy (another device's change) becomes this device's cache too
  useEffect(() => {
    if (server) writeLocalPrefs(server);
  }, [server]);
  const prefs = useMemo(() => server ?? local, [server, local]);
  const set = useCallback(
    (patch: Partial<PizarraPrefs>) => {
      const next = parsePrefs({ ...prefs, ...patch });
      setLocal(next);
      writeLocalPrefs(next);
      if (uid) void setDoc(doc(db, "users", uid, "private", "pizarra"), { prefs: next, at: serverTimestamp() }).catch((err: unknown) => console.error("No se pudieron guardar los ajustes de la pizarra", err));
    },
    [prefs, uid],
  );
  return { prefs, set, synced: !!server };
}
