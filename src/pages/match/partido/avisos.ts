// «Avisos de este partido»: which events of this match this device is told about — the kick-off, every goal,
// the cards, half-time and the final, the official seven, the acta and the MVP. What already happened switches
// itself off. The choice is this device's push notices for this match only (lib/push setMatchTopics → the
// server's pushSetMatchTopics, functions/src/pushMatchTopics.ts): it starts as the device's current choice (its
// override for this match, else its global topics; nothing without a push subscription). The first switch
// turned on where the browser has no subscription asks for the permission, like «Avisos a medida»; a device
// that can't get notices shows the switches disabled with the reason.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { effectiveMatchTopics, type MatchTopic } from "../../../../functions/src/pushMatchTopics";
import { PUSH_WHY, pushChoiceKey, pushChoiceOf, pushSaveError, pushState, setMatchTopics, subscribePushChoice, type PushState } from "../../../lib/push";
import { pushSubscribed, watchPermission } from "../../perfil/device";
import type { Fase } from "./model";
import { isLive, isPre } from "./model";

export type AvisoId = "inicio" | "goles" | "tarjetas" | "final" | "siete" | "mvp";
export interface AvisoRow {
  id: AvisoId;
  t: string;
  d: string;
  on: boolean;
  /** Already happened in this match (or this device can't get notices): off, and it can't be switched. */
  off: boolean;
  toggle: () => void;
}
export interface Avisos {
  /** Something is still to happen: the header's «Avisos» shows. */
  show: boolean;
  label: string;
  aria: string;
  sub: string;
  rows: AvisoRow[];
  /** «Te avisamos de los goles y el descanso y el final.» (the live side's line). */
  line: string;
  /** How many are on. */
  n: number;
  /** Aplazado / pendiente: «Avísame cuando haya fecha» (dates) / «cuando esté el acta» (mvp), for this match. */
  notify: { on: boolean; toggle: () => void };
}

/** Each switch, its words and the push topic it is. */
const ROWS: [AvisoId, string, string, string, MatchTopic][] = [
  ["inicio", "Cuando empiece", "El pitido inicial, con el siete ya en el campo", "el pitido inicial", "start"],
  ["goles", "Cada gol", "Los nuestros y los del rival, al momento", "los goles", "goals"],
  ["tarjetas", "Tarjetas", "Amarillas y rojas, de los dos", "las tarjetas", "cards"],
  ["final", "Descanso y final", "Con el marcador de cada parte", "el descanso y el final", "final"],
  ["siete", "El siete oficial", "Cuando el capitán lo saque de la pizarra", "el siete oficial", "lineup"],
  ["mvp", "El acta y el MVP", "Cuando se publique el acta y cuando cierre el voto", "el acta y el MVP", "mvp"],
];
const and = (xs: readonly string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

/** The topic of the aplazado's / pendiente's «Avísame…». */
export const notifyTopic = (fase: Fase): MatchTopic => (fase === "aplazado" ? "dates" : "mvp");

/** The match's topics after switching `topic` on or off. */
export const toggled = (current: readonly MatchTopic[], topic: MatchTopic, on: boolean): MatchTopic[] => (on ? [...new Set([...current, topic])] : current.filter((t) => t !== topic));

/** The switches that are over once the match has kicked off: «Cuando empiece» and «El siete oficial». */
const OVER_AFTER_KICKOFF: readonly MatchTopic[] = ["start", "lineup"];
/**
 * What is saved for this match: once it has kicked off (not an aplazado, which keeps its choice for the new
 * date), the switches already over leave the choice. The sheet shows them off, so nothing of theirs may
 * still arrive (a «start» or «lineup» kept would let a kick-off or a late «Cambio en el siete» through; the
 * descanso and the 2ª parte go with «Descanso y final»).
 */
export const withoutOver = (fase: Fase, topics: readonly MatchTopic[]): MatchTopic[] =>
  isPre(fase) || fase === "aplazado" ? [...topics] : topics.filter((t) => !OVER_AFTER_KICKOFF.includes(t));

export interface AvisosInput {
  fase: Fase;
  rival: string;
  /** This device's topics for this match now (override, else global; [] without a subscription). */
  topics: readonly MatchTopic[];
  /** Whether this device can get notices («ready»), or why not. */
  state: PushState;
}

/** What the sheet shows (no toggles): pure, for the tests. */
export function avisosView({ fase, rival, topics, state }: AvisosInput) {
  const pre = isPre(fase);
  const live = isLive(fase);
  const gone: Record<AvisoId, boolean> = { inicio: !pre, goles: !(pre || live), tarjetas: !(pre || live), final: !(pre || live), siete: !pre, mvp: fase === "despues" };
  const blocked = state !== "ready";
  const words: string[] = [];
  const rows = ROWS.map(([id, t, d, w, topic]) => {
    const past = fase === "aplazado" ? true : gone[id];
    const on = !blocked && !past && topics.includes(topic);
    if (on) words.push(w);
    return { id, t, d: past ? "Ya ha pasado en este partido" : d.replace("del rival", `de ${rival}`), on, off: past || blocked, past, w, topic };
  });
  const n = words.length;
  const liveWords = rows.filter((r) => r.on && (r.id === "goles" || r.id === "tarjetas" || r.id === "final")).map((r) => r.w);
  const none = "No te avisamos de nada de este partido.";
  return {
    show: rows.some((r) => !r.past),
    label: n ? `Avisos: ${n}` : "Avisarme",
    aria: n ? `Avisos de este partido: ${words.join(", ")}. Cambiarlos` : "Elegir qué te avisamos de este partido",
    sub: state !== "ready" ? PUSH_WHY[state] : n ? `Te avisamos de ${and(words)}.` : none,
    rows,
    n,
    line: liveWords.length ? `Te avisamos de ${and(liveWords)}.` : none,
    notifyOn: !blocked && topics.includes(notifyTopic(fase)),
  };
}

/** The browser's notices state, live (the permission changes in the settings, back to the tab). */
const subscribeState = (cb: () => void) => watchPermission(cb);
const serverState = (): PushState => "unsupported";

/**
 * This match's avisos for this device. `_member` only shaped the old local defaults: what the sheet shows now
 * is the device's real choice (the DEV `?quien=` hatch changes the page's presentation, never this).
 */
export function useAvisos(matchId: string | null, fase: Fase, _member: boolean, rival = "el rival", say?: (l: string) => void): Avisos {
  const state = useSyncExternalStore(subscribeState, pushState, serverState);
  const key = useSyncExternalStore(subscribePushChoice, pushChoiceKey, () => "");
  // Whether the browser holds a push subscription (null: not known yet; saved topics without one are off).
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void pushSubscribed().then((s) => {
      if (alive) setSubscribed(s);
    });
    return () => {
      alive = false;
    };
  }, [key, state]);
  // (derived from the snapshot alone: the React Compiler memoizes on it)
  const current = useMemo(() => {
    if (!matchId || subscribed === false) return [];
    const choice = pushChoiceOf(key);
    return effectiveMatchTopics(choice.matches[matchId] ?? null, choice.topics);
  }, [key, matchId, subscribed]);
  // The choice being saved (optimistic), in order; a failure goes back to what the server has.
  const [pending, setPending] = useState<{ id: string; topics: MatchTopic[] } | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const seq = useRef(0);
  const topics = pending && pending.id === matchId ? pending.topics : current;
  const choose = useCallback(
    (next: MatchTopic[], line: string) => {
      if (!matchId) return;
      const n = ++seq.current;
      setPending({ id: matchId, topics: next });
      say?.(line);
      chain.current = chain.current
        .then(() => setMatchTopics(matchId, next))
        .then(
          () => setSubscribed(true),
          (e: unknown) => {
            say?.(pushSaveError(e));
            void pushSubscribed().then(setSubscribed);
          },
        )
        .finally(() => {
          if (seq.current === n) setPending(null);
        });
    },
    [matchId, say],
  );
  const v = avisosView({ fase, rival, topics, state });
  const rows: AvisoRow[] = v.rows.map((r) => ({
    id: r.id,
    t: r.t,
    d: r.d,
    on: r.on,
    off: r.off,
    toggle: () => {
      if (r.off) return;
      choose(withoutOver(fase, toggled(topics, r.topic, !r.on)), !r.on ? `Te avisamos de ${r.w}.` : `Ya no te avisamos de ${r.w}.`);
    },
  }));
  const nt = notifyTopic(fase);
  return {
    show: v.show,
    label: v.label,
    aria: v.aria,
    sub: v.sub,
    rows,
    n: v.n,
    line: v.line,
    notify: {
      on: v.notifyOn,
      toggle: () => {
        if (state !== "ready") {
          say?.(PUSH_WHY[state]);
          return;
        }
        const on = !v.notifyOn;
        const what = nt === "dates" ? "cuando haya fecha" : "cuando esté el acta";
        choose(withoutOver(fase, toggled(topics, nt, on)), on ? `Te avisamos ${what}.` : `Ya no te avisamos ${what}.`);
      },
    },
  };
}
