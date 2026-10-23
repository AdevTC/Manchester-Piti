// What a notice or a «Te toca» item does, shared by the bell, «Tú» and /avisos: open it, mark it read or unread,
// silence its topic or its match on this device, pause, go to the bandeja or A medida; and the MVP candidates'
// printed stills. Hooks only (the pieces that draw them: parts.tsx).
import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { tuGo } from "../../../components/vidrio/tu/kit";
import { usePageKitStills } from "../../../components/jersey3d/usePageKitStills";
import { useTheme } from "../../../hooks/useTheme";
import type { Notice } from "../../../lib/derived/notices";
import { matchEndAt, pushSaveError, savedVibrate, setMatchTopics, setPushPause, setPushPreset, toggleTopic, tomorrowAtNine, type PauseKind, type Topic } from "../../../lib/push";
import { pauseSaid, TOPIC_NAME, verOf, type ActKey, type AvFilter } from "./model";
import type { Inbox, Pend } from "./useInbox";

export interface AvisoActions {
  open: (n: Notice) => void;
  act: (k: ActKey, n: Notice) => void;
  markRead: (ids: readonly string[], read: boolean) => void;
  muteTopic: (topic: string, on: boolean) => void;
  muteMatch: (matchId: string, mute: boolean) => void;
  pause: (k: PauseKind) => void;
  resume: () => void;
  /** To the bandeja (a filter) or A medida, closing whatever surface is open. */
  goAv: (to: "bandeja" | "amedida", f?: AvFilter, anchor?: string) => void;
  go: (path: string) => void;
  answered: (p: Pend) => void;
}

/** What the actions need of the inbox (a fan's bell has none: no reads, no next match). */
export type ActionInbox = { reads: Pick<Inbox["reads"], "mark">; next: Inbox["next"]; matchName: Inbox["matchName"] };

/** An address of this site («/partidos/…»): not «//host», «/\host» or a scheme. */
export const isAppPath = (p: string): boolean => p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\");

/** The actions, with `say` for the toast and `leave` to close the surface they were taken from (the bell, «Tú»). */
export function useAvisoActions(inbox: ActionInbox, say: (t: string) => void, leave?: () => void): AvisoActions {
  const navigate = useNavigate();
  const fail = useCallback((e: unknown) => say(pushSaveError(e)), [say]);
  const go = useCallback(
    (path: string) => {
      // (a notice's url comes from the server: only an address of this site is followed, never another origin)
      if (!isAppPath(path)) return;
      leave?.();
      tuGo("right", async () => {
        await navigate({ href: path });
      });
    },
    [leave, navigate],
  );
  const goAv = useCallback(
    (to: "bandeja" | "amedida", f?: AvFilter, anchor?: string) => {
      leave?.();
      const ver = f ? verOf(f) : undefined;
      tuGo("right", async () => {
        await navigate({ to: to === "amedida" ? "/avisos/a-medida" : "/avisos", search: ver ? { ver } : {} } as never);
        if (anchor) window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ block: "start" }), 120);
      });
    },
    [leave, navigate],
  );
  const markRead = useCallback((ids: readonly string[], read: boolean) => void inbox.reads.mark(ids, read).catch(() => say("No se ha podido guardar. Inténtalo otra vez.")), [inbox.reads, say]);
  const open = useCallback(
    (n: Notice) => {
      markRead([n.id], true);
      go(n.url);
    },
    [markRead, go],
  );
  const pause = useCallback(
    (k: PauseKind) => {
      const now = Date.now();
      const next = inbox.next;
      const until = k === "1h" ? now + 3600_000 : k === "manana" ? tomorrowAtNine(now) : next ? matchEndAt(next.at, next.dur) : NaN;
      if (!Number.isFinite(until) || until <= now) {
        say("No hay un partido próximo para pausar hasta después.");
        return;
      }
      setPushPause({ until, kind: k }).then(() => say(pauseSaid(k)), fail);
    },
    [inbox.next, say, fail],
  );
  return {
    open,
    go,
    goAv,
    markRead,
    pause,
    resume: () => void setPushPause(null).then(() => say("Avisos reanudados."), fail),
    act: (k, n) => {
      markRead([n.id], true);
      if (k === "goles") {
        setPushPreset("goles", savedVibrate()).then(() => say("Este móvil, solo goles. Lo cambias en Avisos a medida."), fail);
        return;
      }
      if (k === "cal") return goAv("amedida", undefined, "tu-cal");
      if (k === "carta") return go("/perfil");
      if (k === "caja") return go("/vestuario/caja");
      go(n.url);
    },
    muteTopic: (topic, on) => {
      const name = TOPIC_NAME[topic] ?? topic;
      toggleTopic(topic as Topic, on).then(() => say(on ? `Te volvemos a avisar de «${name}».` : `«${name}» silenciado en este móvil. Siguen llegando a la campana.`), fail);
    },
    muteMatch: (matchId, mute) => {
      const j = inbox.matchName(matchId);
      setMatchTopics(matchId, mute ? [] : null).then(() => say(mute ? `El ${j} no sonará en este móvil. Lo verás aquí.` : `Te volvemos a avisar del ${j}.`), fail);
    },
    answered: (p) => markRead(p.noticeIds, true),
  };
}

/** The printed stills of the MVP's candidates (the home kit, this theme). */
export function useCandStills(pends: readonly Pend[]): (num: string) => string | undefined {
  const { theme } = useTheme();
  const players = pends.flatMap((p) => (p.kind === "mvp" ? p.cands.map((c) => ({ name: c.name, num: c.num })) : [])).filter((x) => x.num);
  const still = usePageKitStills({ on: typeof window !== "undefined" && players.length > 0, theme, kits: ["home"], players });
  return (num) => still("home", num)?.src;
}

