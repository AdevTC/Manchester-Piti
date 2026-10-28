// El centro de avisos (pure): which push notice is also kept in `notices/{id}` for the bell's panel, for
// whom («team», «captains» or one member, «personal»), and its doc id. push.ts sendTo stores it; the app
// reads it with three queries, one per audience (the rules can only prove a read filtered by audience).
import type { Notice } from "./pushLogic.js";

export type NoticeAudience = "team" | "captains" | "personal";

/** How long a kept notice lives: a Firestore TTL policy on `notices.expireAt` deletes it after. */
export const NOTICE_TTL_MS = 60 * 24 * 3600_000;
/** A retried trigger stores the same notice again within this bucket: the same doc id, so no copy. */
export const NOTICE_BUCKET_MS = 3600_000;

/** Live goals, the kick-off, half-time and the 2ª parte: the island already tells them; not kept. */
const SKIPPED = new Set<string>(["goals", "start"]);
/** The captains' own notices sent on a member topic to each captain's uid: the answers changed at the last
 *  minute («Baja de última hora», remindersLogic.ts) and the absences (pushLogic.ts absenceNotice). */
const CAPTAIN_TAGS = ["late-", "absence-"];

/** Who reads a notice in the centre (null: not kept). It follows sendTo's audience (pushLogic.ts
 *  pushAudience): «door» is the captains'; a captain notice sent to each captain is kept once, for all of
 *  them; whatever else goes to one uid is that member's; the club's topics without a uid are the team's. */
export function noticeAudience(notice: Pick<Notice, "topic" | "tag">, uid?: string | null): { audience: NoticeAudience; uid?: string } | null {
  if (SKIPPED.has(notice.topic)) return null;
  if (notice.topic === "door" || CAPTAIN_TAGS.some((p) => notice.tag.startsWith(p))) return { audience: "captains" };
  if (uid) return { audience: "personal", uid };
  // (personal news and the door's answer need their member: without one, nobody to keep it for)
  if (notice.topic === "personal" || notice.topic === "access") return null;
  return { audience: "team" };
}

export interface NoticeDoc {
  topic: string;
  title: string;
  body: string;
  url: string;
  /** ms; stored as a Timestamp. */
  at: number;
  audience: NoticeAudience;
  /** Only for «personal». */
  uid?: string;
  /** `at` + NOTICE_TTL_MS (ms; stored as a Timestamp). */
  expireAt: number;
}

/** A short stable hash (cyrb53, base 36): no node:crypto, so the app's tests and bundle can share it. */
function hash(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * The doc id: the notice's `log` (or its `tag`), the hour bucket of `now`, and a hash of what it says and to
 * whom. A retried trigger (same words, same bucket) finds it taken; two different notices that share a tag
 * (two late changes of the same match, the hour moved twice) don't.
 */
export function noticeId(notice: Pick<Notice, "tag" | "log" | "title" | "body" | "url">, audience: NoticeAudience, uid: string | undefined, now: number): string {
  const base = (notice.log || notice.tag || "aviso").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 160);
  const bucket = Math.floor(now / NOTICE_BUCKET_MS);
  return `${base}-${bucket}-${hash([audience, uid ?? "", notice.title, notice.body, notice.url].join("\u0000"))}`;
}

/** What sendTo keeps of a notice (null: not kept): its doc id and fields. */
export function noticeRecord(notice: Notice, uid: string | null | undefined, now: number): { id: string; doc: NoticeDoc } | null {
  const who = noticeAudience(notice, uid);
  return who ? noticeRecordAs(notice, who, now) : null;
}
/** The same, for an audience given rather than inferred (a captain's notice by hand: «Mandar un aviso a mano»). */
export function noticeRecordAs(notice: Notice, who: { audience: NoticeAudience; uid?: string }, now: number): { id: string; doc: NoticeDoc } {
  const doc: NoticeDoc = { topic: notice.topic, title: notice.title, body: notice.body, url: notice.url, at: now, audience: who.audience, expireAt: now + NOTICE_TTL_MS };
  if (who.uid) doc.uid = who.uid;
  return { id: noticeId(notice, who.audience, who.uid, now), doc };
}
