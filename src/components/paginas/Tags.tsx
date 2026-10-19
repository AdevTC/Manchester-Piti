// The marks of the night as small chips (V-Vivo: ⚽ 6′ — gold for our latest goal —, ↗ 21′ the pass, the yellow
// card 15′, the glove 34′, the change 30′), and the few line icons the other pages share. A chip is an image
// with its words for a screen reader («Gol en el 21»); a card is a card, never only a colour: it carries its
// minute and its label.
import type { LiveTag } from "../../lib/derived/vidrio/squadLive";

export type PgIconId = "ball" | "pass" | "glove" | "swap" | "back" | "pip" | "share" | "expand" | "close" | "shirt" | "cal" | "map" | "board" | "arrow" | "medal" | "trophy";

const PATHS: Record<PgIconId, string> = {
  ball: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4.2 3.6 2.6-1.4 4.2H9.8L8.4 9.8Zm0-4.2v4.2m3.6 2.6 4.1-1.2M14.2 14l2.5 3.4M9.8 14l-2.5 3.4M8.4 9.8 4.3 8.6",
  pass: "M6 18 18 6m0 0H9m9 0v9",
  glove: "M8 21h8l1.5-7V7.5a1.5 1.5 0 0 0-3 0V11V5a1.5 1.5 0 0 0-3 0v6V4.5a1.5 1.5 0 0 0-3 0V12l-1.6-1.8a1.5 1.5 0 0 0-2.3 1.9L8 17Z",
  swap: "M4 8h13l-3-3m6 11H7l3 3",
  back: "M15 5 8 12l7 7",
  pip: "M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5ZM12 12h6v5h-6Z",
  share: "M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12",
  expand: "M14 4h6v6m0-6-7 7M10 20H4v-6m0 6 7-7",
  close: "M6 6l12 12M18 6 6 18",
  shirt: "M8 3 3 6l2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0Z",
  cal: "M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5ZM4 10h16M8 3v4m8-4v4",
  map: "M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  board: "M4 5h16v12H4Zm4 15h8m-4-3v3",
  arrow: "M5 12h14m0 0-6-6m6 6-6 6",
  medal: "M8 3h3l2 6M16 3h-3M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0Zm0 2H5v1a3 3 0 0 0 3 3m8-4h3v1a3 3 0 0 1-3 3m-4 3v4m-4 3h8",
};

export function PgIcon({ id, className }: { id: PgIconId; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[id]} />
    </svg>
  );
}

const TAG_ICON: Partial<Record<LiveTag["kind"], PgIconId>> = { gol: "ball", asis: "pass", cambio: "swap", parada: "glove" };

export function TagChip({ t }: { t: LiveTag }) {
  const icon = TAG_ICON[t.kind];
  return (
    <span className={`vd-tag vd-tag--${t.kind}${t.gold ? " vd-tag--gold" : ""}`} role="img" aria-label={t.label}>
      {icon && <PgIcon id={icon} />}
      {t.text}
    </span>
  );
}

export function TagRow({ tags, className }: { tags: readonly LiveTag[]; className?: string }) {
  if (!tags.length) return null;
  return (
    <span className={className ?? "vd-tags"}>
      {tags.map((t, i) => (
        <TagChip key={`${t.kind}${t.text}${i}`} t={t} />
      ))}
    </span>
  );
}
