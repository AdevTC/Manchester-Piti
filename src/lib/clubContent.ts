import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CONTENT_KEY, subscribeClubContent } from "./publicData";
import { DEFAULT_CONTENT, type ClubContent } from "./clubContentDefaults";
export { DEFAULT_CONTENT, type ClubContent };

/** The club's editable content, live; DEFAULT_CONTENT until (or unless) the document arrives. */
export function useClubContent() {
  const qc = useQueryClient();
  useEffect(() => subscribeClubContent(qc), [qc]);
  const { data } = useQuery<ClubContent>({
    queryKey: CONTENT_KEY,
    queryFn: () => new Promise<ClubContent>(() => {}), // resolved by the snapshot's setQueryData
    staleTime: Infinity,
  });
  return data ?? DEFAULT_CONTENT;
}
