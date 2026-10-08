// TEMPORARY (P0): the line over a view that still embeds its old component. Delete with the last stub.
import type { ReactNode } from "react";
import { AdIcon } from "../ui/icons";

export function LegacyNote({ children }: { children: ReactNode }) {
  return (
    <p className="ad-legacy-note">
      <AdIcon name="info" size={15} />
      <span>{children}</span>
    </p>
  );
}
