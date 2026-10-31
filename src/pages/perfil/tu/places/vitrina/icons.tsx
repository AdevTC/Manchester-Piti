// The vitrina's glyphs (TuCarta's ICX / VXI: stroked 24×24 paths). Decorative: the control or the piece around
// each carries the words.
const PATHS = {
  card: "M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5zM9 16h6M9 7.5h2.5",
  medal: "M12 10a5 5 0 1 0 0 10a5 5 0 1 0 0-10zM8.5 3.5l2 6M15.5 3.5l-2 6",
  record: "M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.2l5.4-.8z",
  now: "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z",
  shield: "M12 3.5l7 2.8v5.2c0 4.3-2.9 7.6-7 9.5c-4.1-1.9-7-5.2-7-9.5V6.3z",
  share: "M12 15V4M8 8l4-4 4 4M5 13v6.5h14V13",
  close: "M6 6l12 12M18 6L6 18",
  chevL: "M15 6l-6 6 6 6",
  chevR: "M9 6l6 6-6 6",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9h-13z",
  album: "M4 5.5h7v13H4zM13 5.5h7v13h-7z",
} as const;
export type VIcName = keyof typeof PATHS;

export function VIc({ name, className }: { name: VIcName; className?: string }) {
  return (
    <svg className={`nx-ic${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
