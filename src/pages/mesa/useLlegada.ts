// «¿Quién ha venido?»'s data: the pizarra's cromos for the season (position, rating, form: the same
// useBoardData the pizarra reads), the members' answers to the convocatoria (useConvocatoria), and the
// roll call itself — shown at once on each tap, saved with setMatchPresent a moment after the last one.
// Only mounted while the roll call is open.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiError, setMatchPresent } from "../../lib/clubApi";
import { useBoardData } from "../pizarra/v2/useBoardData";
import { useConvocatoria } from "../pizarra/v2/useConvocatoria";
import type { Convocatoria, Cromo } from "../pizarra/v2/model";
import { samePresent, togglePresent } from "./screens/llegadaModel";

export const SAVE_DELAY_MS = 600;

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface Llegada {
  squad: ReadonlyMap<string, Cromo>;
  conv: ReadonlyMap<string, Convocatoria> | null;
  loading: boolean;
  /** Who has come, as shown now (the taps not saved yet included). */
  present: string[];
  toggle(id: string): void;
  save: SaveState;
  /** Why the last save failed, in Spanish ("" when it didn't). */
  error: string;
  retry(): void;
}

/** A missing callable (the server not deployed yet) says so plainly instead of «no se puede conectar». */
export function presentError(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code;
  if (code === "functions/not-found" || code === "functions/unimplemented") return "El servidor aún no sabe guardar la lista (falta setMatchPresent). Lo marcado se queda en esta pantalla.";
  if (code === "functions/failed-precondition") return "La lista solo se pasa antes del pitido.";
  if (code === "functions/permission-denied") return "Solo los administradores y los anotadores de este partido pasan lista.";
  return apiError(e);
}

export function useLlegada(matchId: string, seasonId: string, server: readonly string[] | null, called: readonly string[]): Llegada {
  const { squad, loading } = useBoardData(seasonId || "all");
  const { conv } = useConvocatoria(matchId);
  // the taps not confirmed yet: what the screen shows until the server's list changes again
  const [local, setLocal] = useState<{ ids: string[]; base: readonly string[] | null } | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const timer = useRef<number | null>(null);
  const latest = useRef<string[] | null>(null);
  const seq = useRef(0);

  const shown = useMemo(() => (local && samePresent(local.base, server) ? local.ids : [...(server ?? [])]), [local, server]);

  const send = useCallback(
    (ids: string[]) => {
      const n = ++seq.current;
      setSave("saving");
      setError("");
      setMatchPresent({ matchId, present: ids })
        .then(() => {
          if (n === seq.current) setSave("saved");
        })
        .catch((e: unknown) => {
          if (n !== seq.current) return;
          setSave("error");
          setError(presentError(e));
        });
    },
    [matchId],
  );

  const toggle = useCallback(
    (id: string) => {
      const next = togglePresent(shown, id, called);
      latest.current = next;
      setLocal({ ids: next, base: server });
      setSave("saving");
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        if (latest.current) send(latest.current);
      }, SAVE_DELAY_MS);
    },
    [shown, called, server, send],
  );

  const retry = useCallback(() => {
    if (latest.current) send(latest.current);
  }, [send]);

  // a pending save still goes up when the roll call closes
  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        if (latest.current) void setMatchPresent({ matchId, present: latest.current }).catch(() => undefined);
      }
    },
    [matchId],
  );

  return { squad: squad.byId, conv, loading, present: shown, toggle, save, error, retry };
}
