// En juego's wiring: the pads' picker, the liveEvent callable (add / undo), the LED's «GOOOL» flash and
// the lower thirds. The minute comes from the match clock (liveMinute). Used by Hoy's «En juego» hero
// and the En juego view (V1a), with the same LivePicker / LivePads / LiveLog.
import { useRef, useState } from "react";
import { apiError, liveEvent } from "../../../lib/clubApi";
import { liveMinute } from "../../../lib/partidos";
import type { AdminMatch } from "../data/adminLogic";
import { jLabel } from "../data/adminLogic";
import type { LedFlash } from "../kit/LedBoard";
import { useToast } from "../ui/toastContext";
import { liveLog, liveSides, pickerView, type LiveEventInput, type LogRow, type PadKind, type PickerView, type PickState, type Step } from "./liveModel";

/** How long the LED says «GOOOL» (the canvas' 2.6 s). */
export const FLASH_MS = 2_600;

export interface LiveApi {
  /** The current minute (the clock's, 0 before kick-off). */
  minute: number;
  /** «Lo que va pasando», newest first. */
  log: LogRow[];
  /** The open picker (null = closed) and its view. */
  pick: PickState | null;
  view: PickerView | null;
  /** The pads: GOL / Tarjeta / Cambio open the picker; Gol rival is written at once (with «Deshacer»). */
  open: (k: PadKind) => void;
  close: () => void;
  choose: (next: Step) => void;
  rivalGoal: () => void;
  /** Takes back the last event written live. */
  undo: () => void;
  /** The LED's «GOOOL» while it lasts. */
  flash: LedFlash | null;
  busy: boolean;
}

/** `now` = the admin's minute clock (useAdmin().now, ticking on each minute). */
export function useLive(match: AdminMatch | null, now: number, nameOf: (id: string) => string, numberOf: (id: string) => string): LiveApi {
  const toast = useToast();
  const [pick, setPick] = useState<PickState | null>(null);
  const [flash, setFlash] = useState<LedFlash | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minute = match ? (liveMinute(match, now) ?? 0) : 0;
  const rival = match?.rival ?? "el rival";
  const tag = match ? jLabel(match) : "J";
  const sides = liveSides(match?.starters, match?.bench, match?.events);
  const view = pick && match ? pickerView(pick, { minute, rival, field: sides.field, bench: sides.bench, player: (id) => ({ num: numberOf(id), name: nameOf(id) }) }) : null;

  const undo = () => {
    if (!match) return;
    liveEvent({ action: "undo", matchId: match.id }).then(
      () => toast.show({ tag, message: "Deshecho lo último apuntado" }),
      (e: unknown) => toast.show({ tone: "error", message: `No se ha podido deshacer: ${apiError(e)}` }),
    );
  };
  const send = (event: LiveEventInput, done: () => void) => {
    if (!match) return;
    setBusy(true);
    liveEvent({ action: "add", matchId: match.id, event }).then(
      () => {
        setBusy(false);
        done();
      },
      (e: unknown) => {
        setBusy(false);
        toast.show({ tone: "error", message: `No se ha podido apuntar: ${apiError(e)}` });
      },
    );
  };
  const choose = (next: Step) => {
    if ("state" in next) {
      setPick(next.state);
      return;
    }
    setPick(null);
    send(next.event, () => {
      if (next.flash) {
        if (timer.current) clearTimeout(timer.current);
        setFlash({ text: next.flash });
        timer.current = setTimeout(() => setFlash(null), FLASH_MS);
      }
      if (next.caption) toast.show({ tag, message: next.caption });
    });
  };
  const rivalGoal = () => send({ type: "opponent_goal", minute }, () => toast.show({ tag, message: `Gol de ${rival} · ${minute}′`, undo }));

  return {
    minute,
    log: match ? liveLog(match.events, rival, nameOf) : [],
    pick,
    view,
    open: (k) => setPick({ k, st: 1 }),
    close: () => setPick(null),
    choose,
    rivalGoal,
    undo,
    flash,
    busy,
  };
}
