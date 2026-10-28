// CAJA · answering a payment notice in the caja marks its «Pago avisado» read in the captain's centro de avisos
// (H-SH-02, board: «Confirmar … marca leído su aviso»). The backend keeps that notice as `notices/{id}` with an id
// that starts with its log, `cajaclaim-<claimId>-` (functions/src/pushLogic cajaClaimNotice, noticesLogic noticeId).
import { useCallback } from "react";
import { useAuth } from "../../../../context/AuthContext";
import type { Notice } from "../../../../lib/derived/notices";
import { toMillis } from "../../../../lib/derived/notices";
import { useNoticeReads } from "../../../../lib/noticeReads";
import { useNotices } from "../../../vestuario/live";

/** The ids of a claim's notices in `list`. */
export const claimNoticeIds = (list: readonly Pick<Notice, "id">[], claimId: string): string[] => list.filter((n) => n.id.startsWith(`cajaclaim-${claimId}-`)).map((n) => n.id);

/** `mark(claimId)`: its notices read (quietly: a failure only leaves them unread). */
export function useMarkClaimNoticeRead(): (claimId: string) => void {
  const { user, profile } = useAuth();
  const uid = user?.uid;
  const notices = useNotices(uid, true);
  const list = notices.loading || notices.error ? null : notices.data;
  const reads = useNoticeReads(uid, list, toMillis(profile?.noticesSeenAt));
  return useCallback(
    (claimId: string) => {
      const ids = claimNoticeIds(notices.data, claimId);
      if (ids.length) void reads.mark(ids, true).catch(() => undefined);
    },
    [notices.data, reads],
  );
}
