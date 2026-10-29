// What goes inside a rival's crest ring (vd-team__crest--rival, pa-tbl__crest, tu-sr__rv…): the escudo an acta
// saved (derived/rival rivalLogos), filling the ring, else the rival's initials. A link that stops loading (an
// Instagram one that expired) falls back to the initials too. The ring keeps its size and its place.
import { useState, type ReactNode } from "react";
import "../../styles/vidrio/reading.css";

export function RivalMark({ logo, children }: { logo?: string | null; children?: ReactNode }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (!logo || broken === logo) return <>{children}</>;
  return <img className="vd-rivlogo" src={logo} alt="" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(logo)} />;
}
