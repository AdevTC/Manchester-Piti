// «Avisos de este partido»: which events of this match the viewer is told about — the kick-off, every goal,
// the cards, half-time and the final, the official seven, the acta and the MVP. What already happened switches
// itself off. The choice is the device's notices for this match (lib/push matchTopics), so it reaches the
// phone that has notices on; a member starts with what makes sense to be told, a fan with nothing.
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Fase } from "./model";
import { isLive, isPre } from "./model";

export type AvisoId = "inicio" | "goles" | "tarjetas" | "final" | "siete" | "mvp";
export interface AvisoRow {
  id: AvisoId;
  t: string;
  d: string;
  on: boolean;
  /** Already happened in this match: off, and it can't be switched. */
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
  /** Aplazado / pendiente: «Avísame cuando haya fecha» / «cuando esté el acta». */
  notify: { on: boolean; toggle: () => void };
}

const KEY = (id: string) => `pp-avisos:${id}`;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function read(id: string | null): string | null {
  if (!id) return null;
  try {
    return localStorage.getItem(KEY(id));
  } catch {
    return null;
  }
}
function write(id: string, v: Record<string, boolean>) {
  try {
    localStorage.setItem(KEY(id), JSON.stringify(v));
  } catch {
    /* private mode: the choice lasts for this page */
  }
  emit();
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const ROWS: [AvisoId, string, string, string][] = [
  ["inicio", "Cuando empiece", "El pitido inicial, con el siete ya en el campo", "el pitido inicial"],
  ["goles", "Cada gol", "Los nuestros y los del rival, al momento", "los goles"],
  ["tarjetas", "Tarjetas", "Amarillas y rojas, de los dos", "las tarjetas"],
  ["final", "Descanso y final", "Con el marcador de cada parte", "el descanso y el final"],
  ["siete", "El siete oficial", "Cuando el capitán lo saque de la pizarra", "el siete oficial"],
  ["mvp", "El acta y el MVP", "Cuando se publique el acta y cuando cierre el voto", "el acta y el MVP"],
];
const and = (xs: readonly string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

export function useAvisos(matchId: string | null, fase: Fase, member: boolean, rival = "el rival", say?: (l: string) => void): Avisos {
  const raw = useSyncExternalStore(subscribe, () => read(matchId), () => null);
  const saved = useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : null;
    } catch {
      return null;
    }
  }, [raw]);
  const av: Record<string, boolean> = saved ?? { inicio: member, goles: member, tarjetas: false, final: member, siete: member, mvp: member, notify: false };
  const set = useCallback(
    (patch: Record<string, boolean>) => {
      if (matchId) write(matchId, { ...av, ...patch });
    },
    [matchId, av],
  );
  const pre = isPre(fase);
  const live = isLive(fase);
  const gone: Record<AvisoId, boolean> = { inicio: !pre, goles: !(pre || live), tarjetas: !(pre || live), final: !(pre || live), siete: !pre, mvp: fase === "despues" };
  const words: string[] = [];
  const rows: AvisoRow[] = ROWS.map(([id, t, d, w]) => {
    const off = fase === "aplazado" ? true : gone[id];
    const on = !!av[id] && !off;
    if (on) words.push(w);
    return {
      id,
      t,
      d: off ? "Ya ha pasado en este partido" : d.replace("del rival", `de ${rival}`),
      on,
      off,
      toggle: () => {
        if (off) return;
        set({ [id]: !av[id] });
        say?.(!av[id] ? `Te avisamos de ${w}.` : `Ya no te avisamos de ${w}.`);
      },
    };
  });
  const n = words.length;
  const liveWords = rows.filter((r) => r.on && (r.id === "goles" || r.id === "tarjetas" || r.id === "final")).map((r) => ROWS.find((x) => x[0] === r.id)?.[3] ?? "");
  return {
    show: rows.some((r) => !r.off),
    label: n ? `Avisos: ${n}` : "Avisarme",
    aria: n ? `Avisos de este partido: ${words.join(", ")}. Cambiarlos` : "Elegir qué te avisamos de este partido",
    sub: n ? `Te avisamos de ${and(words)}.` : "No te avisamos de nada de este partido.",
    rows,
    n,
    line: liveWords.length ? `Te avisamos de ${and(liveWords)}.` : "No te avisamos de nada de este partido.",
    notify: { on: !!av.notify, toggle: () => set({ notify: !av.notify }) },
  };
}
