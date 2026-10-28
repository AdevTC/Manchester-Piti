// CLUB · la bandeja de la capitanía (M-18, H-SH-02): the notices that are the captains' work — the door's (audience
// «captains») and the ones that open a screen of the sala (a payment to confirm, a turn done, positions to review:
// each captain's own copy, url /admin/…) — read with the captain's own read marks (the same as his bandeja in Tú, so
// reading one here reads it there too). The marks are kept against his whole list, never this slice (a slice would
// drop the marks of the rest).
import { useMemo } from "react";
import { useAuth } from "../../../../context/AuthContext";
import { toMillis, type Notice } from "../../../../lib/derived/notices";
import { useNoticeReads, type NoticeReads } from "../../../../lib/noticeReads";
import { useNotices } from "../../../vestuario/live";

/** Whether a notice is the captaincy's work. */
export const isCaptainNotice = (n: Pick<Notice, "audience" | "url">): boolean => n.audience === "captains" || n.url.startsWith("/admin");

/** Where a captain notice takes the sala (its url, with today's old addresses redirected by the router). */
export const noticeTarget = (n: Pick<Notice, "url">): string => (n.url.startsWith("/") ? n.url : "/admin");

export interface CaptainInbox {
  list: Notice[];
  unread: number;
  loading: boolean;
  error: boolean;
  reads: NoticeReads;
}

const NONE: Notice[] = [];

export function useCaptainInbox(): CaptainInbox {
  const { user, profile } = useAuth();
  const role = profile?.role ?? "";
  const admin = role === "admin" || role === "superadmin";
  const uid = user && admin ? user.uid : undefined;
  const notices = useNotices(uid, admin);
  const all = notices.data;
  const ready = !!uid && !notices.loading && !notices.error;
  const reads = useNoticeReads(uid, ready ? all : null, toMillis(profile?.noticesSeenAt));
  const list = useMemo(() => (uid ? all.filter(isCaptainNotice) : NONE), [uid, all]);
  const unread = list.filter((n) => reads.unread(n)).length;
  return { list, unread, loading: notices.loading, error: !!notices.error, reads };
}
