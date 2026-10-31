// The «⋯» menus of la bandeja's rows and match groups (the bell's too: parts.tsx), pure lists of what each does.
import type { MenuItem } from "../../../components/vidrio/tu/ui";
import type { Notice } from "../../../lib/derived/notices";
import type { Topic } from "../../../lib/push";
import { matchOf, MUTABLE, TOPIC_NAME } from "./model";
import type { AvisoActions } from "./actions";
import type { Inbox, StackView } from "./useInbox";

/** A notice's «⋯»: read or unread, silence its topic or its match on this device, pause, A medida. */
export function noticeMenu(n: Notice, inbox: Inbox, a: AvisoActions): MenuItem[] {
  const un = inbox.reads.unread(n);
  const matchId = matchOf(n);
  const items: MenuItem[] = [{ t: un ? "Marcar como leído" : "Marcar como no leído", icon: "check", go: () => a.markRead([n.id], un) }];
  if (MUTABLE.has(n.topic) && inbox.member) {
    const on = inbox.topics.includes(n.topic as Topic);
    const tl = TOPIC_NAME[n.topic];
    items.push({ t: on ? `Silenciar «${tl}» en este móvil` : `Volver a avisarme de «${tl}»`, icon: "bell", go: () => a.muteTopic(n.topic, !on) });
  }
  if (matchId) {
    const muted = inbox.muted.includes(matchId);
    const j = inbox.matchName(matchId);
    items.push({ t: muted ? `Volver a avisarme del ${j}` : `Silenciar el ${j} en este móvil`, icon: "fixtures", go: () => a.muteMatch(matchId, !muted) });
  }
  items.push({ t: "Pausar todo una hora", icon: "clock", go: () => a.pause("1h") }, { t: "Avisos a medida", icon: "gear", go: () => a.goAv("amedida") });
  return items;
}

/** A match stack's «⋯»: silence the match on this device, mark its notices read, A medida. */
export function stackMenu(x: StackView, inbox: Inbox, a: AvisoActions): MenuItem[] {
  const muted = inbox.muted.includes(x.matchId);
  const j = x.j ? `J${x.j}` : "";
  return [
    { t: muted ? `Volver a avisarme del ${j || "partido"}` : `Silenciar el ${j || "partido"} en este móvil`, icon: "bell", go: () => a.muteMatch(x.matchId, !muted) },
    ...(x.rows.length ? [{ t: x.rows.length === 1 ? "Marcar el aviso como leído" : `Marcar los ${x.rows.length} como leídos`, icon: "check" as const, go: () => a.markRead(x.rows.map((n) => n.id), true) }] : []),
    { t: "Avisos a medida", icon: "gear", go: () => a.goAv("amedida") },
  ];
}
