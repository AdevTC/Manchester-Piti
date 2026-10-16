// El centro de avisos (pure): the notices the bell's panel lists (notices/{id}, written by functions/src/push.ts
// sendTo through noticesLogic.ts), merged from the three reads (team, captains, personal), grouped by Madrid
// day, their relative time, what is unread against users/{uid}.noticesSeenAt and the icon of each topic.
import { madridDate, MONTHS_SHORT } from "./madrid";
import type { IconName } from "../../components/celeste/icons";

export type NoticeAudience = "team" | "captains" | "personal";

export interface Notice {
  id: string;
  topic: string;
  title: string;
  body: string;
  url: string;
  /** ms */
  at: number;
  audience: NoticeAudience;
  uid?: string;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** A Firestore Timestamp, a Date, epoch ms or `{ seconds }` as ms; null for anything else (a pending
 *  serverTimestamp reads null). */
export function toMillis(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === "object" && v !== null) {
    const o = v as { toMillis?: unknown; seconds?: unknown };
    if (typeof o.toMillis === "function") {
      const ms: unknown = (o.toMillis as () => unknown).call(v);
      return typeof ms === "number" && Number.isFinite(ms) ? ms : null;
    }
    if (typeof o.seconds === "number") return o.seconds * 1000;
  }
  return null;
}

/** The three reads as one list, newest first, each notice once (by id). */
export function mergeNotices(...lists: readonly (readonly Notice[])[]): Notice[] {
  const byId = new Map<string, Notice>();
  for (const list of lists) for (const n of list) if (!byId.has(n.id)) byId.set(n.id, n);
  return [...byId.values()].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}

/** Days between two Madrid dates `YYYY-MM-DD` (b − a). */
const dayGap = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

export type NoticeGroupKey = "hoy" | "semana" | "antes";
export interface NoticeGroup {
  key: NoticeGroupKey;
  label: string;
  items: Notice[];
}
const GROUP_LABELS: Record<NoticeGroupKey, string> = { hoy: "Hoy", semana: "Esta semana", antes: "Antes" };

/** «Hoy» (the Madrid day of `now`), «Esta semana» (the six days before) and «Antes»; empty groups left out.
 *  `list` keeps its order (newest first) inside each group. */
export function groupNotices(list: readonly Notice[], now: number): NoticeGroup[] {
  const today = madridDate(now);
  const groups: Record<NoticeGroupKey, Notice[]> = { hoy: [], semana: [], antes: [] };
  for (const n of list) {
    const gap = dayGap(madridDate(n.at), today);
    groups[gap <= 0 ? "hoy" : gap < 7 ? "semana" : "antes"].push(n);
  }
  return (Object.keys(groups) as NoticeGroupKey[]).filter((k) => groups[k].length).map((k) => ({ key: k, label: GROUP_LABELS[k], items: groups[k] }));
}

/** «ahora», «hace 5 min», «hace 2 h», «ayer», «hace 3 días»; from 6 days on the Madrid date, «12 oct». */
export function relativeTime(at: number, now: number): string {
  const ago = Math.max(0, now - at);
  if (ago < MIN) return "ahora";
  if (ago < HOUR) return `hace ${Math.floor(ago / MIN)} min`;
  const days = dayGap(madridDate(at), madridDate(now));
  if (ago < 24 * HOUR && days === 0) return `hace ${Math.floor(ago / HOUR)} h`;
  if (days <= 1) return "ayer";
  if (days < 6) return `hace ${days} días`;
  const [y, m, d] = madridDate(at).split("-").map(Number);
  const sameYear = madridDate(now).slice(0, 4) === String(y);
  return `${d} ${MONTHS_SHORT[m - 1]}${sameYear ? "" : ` ${y}`}`;
}

/** Is `n` newer than the member's last look at the panel (no look yet: everything is)? */
export const isUnread = (n: Pick<Notice, "at">, seenAt: number | null): boolean => seenAt === null || n.at > seenAt;

/** How many of `list` are unread. */
export const unreadCount = (list: readonly Pick<Notice, "at">[], seenAt: number | null): number => list.filter((n) => isUnread(n, seenAt)).length;

/** The bell's accessible name: «Avisos» or «Avisos, 3 sin leer». */
export const bellLabel = (unread: number): string => (unread > 0 ? `Avisos, ${unread} sin leer` : "Avisos");

const ICONS: Record<string, IconName> = {
  lineup: "shirt",
  convocatoria: "team",
  dates: "cal",
  final: "flag",
  mvp: "star",
  personal: "user",
  access: "padlock",
  door: "padlock",
  goals: "ball",
  start: "ball",
};
/** The icon of a topic (an unknown topic gets the bell). */
export const noticeIcon = (topic: string): IconName => ICONS[topic] ?? "bell";
