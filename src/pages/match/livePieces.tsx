// Small shared pieces of the live match page: the shirts (gradient kit, the keeper's navy and gold, the
// bench's), the stickers (goals, saves, A/R cards, a knock) and the Directo's play icon.
import type { ReactNode } from "react";
import type { EventMeta } from "../../lib/eventMeta";
import type { LiveCounts } from "../../lib/ficha";

const SHIRT = "M15 3 L20 1.5 Q24 6 28 1.5 L33 3 L46 11 L41 20 L36 17 L36 42 L12 42 L12 17 L7 20 L2 11 Z";

/** The gradients the shirts paint with: drawn once per page (the live panes). */
export function ShirtDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="mlSky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9efff" />
          <stop offset=".55" stopColor="#9fd0f2" />
          <stop offset="1" stopColor="#6aa7d6" />
        </linearGradient>
        <linearGradient id="mlGk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a3f78" />
          <stop offset="1" stopColor="#101b3c" />
        </linearGradient>
        <linearGradient id="mlBench" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d2c58" />
          <stop offset="1" stopColor="#121c3d" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const look = (keeper: boolean) => (keeper ? { fill: "url(#mlGk)", stroke: "#FFC659", ink: "#ffd98c", collar: "#FFC659" } : { fill: "url(#mlSky)", stroke: "rgba(255,255,255,.55)", ink: "#0c1733", collar: "#2a73ad" });

/** A shirt with its dorsal. `size`: the pitch's (52), the side column's (34) or the bench's (38). */
export function Shirt({ n, keeper = false, kind = "pitch", children }: { n: string; keeper?: boolean; kind?: "pitch" | "mini" | "bench"; children?: ReactNode }) {
  const L = kind === "bench" ? { fill: "url(#mlBench)", stroke: "rgba(169,214,245,.75)", ink: "#dbeeff", collar: "" } : look(keeper);
  const [w, h] = kind === "pitch" ? [52, 48] : kind === "bench" ? [38, 35] : [34, 31];
  return (
    <span className={kind === "mini" ? "ml-mini" : "ml-shirt"} aria-hidden="true">
      {kind === "pitch" && <span className="ml-shadow" />}
      <svg width={w} height={h} viewBox="0 0 48 44">
        <path d={SHIRT} fill={L.fill} stroke={L.stroke} strokeWidth={kind === "bench" ? 2 : 1.5} strokeLinejoin="round" />
        {L.collar && kind === "pitch" && <path d="M20 1.8 Q24 7.5 28 1.8" fill="none" stroke={L.collar} strokeWidth="1.6" />}
      </svg>
      <span className="ml-dor" style={{ color: L.ink }}>
        {n}
      </span>
      {children}
    </span>
  );
}

function Ball({ stroke = "#0c1733" }: { stroke?: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.4" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7l4 3-1.5 5h-5L8 10z" />
    </svg>
  );
}
function Glove() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffd98c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 11V6a1.5 1.5 0 013 0v4M10 10V4.5a1.5 1.5 0 013 0V10M13 10V5.5a1.5 1.5 0 013 0V11M16 9.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1a6 6 0 01-5-2.7L4 14a1.6 1.6 0 012.6-1.8L8 14" />
    </svg>
  );
}

/** The stickers on a shirt or a row: goals (a ball, ×N), saves (a glove), cards (A / R), a knock (+).
 *  Each says itself to a screen reader in the owner's label, so they are hidden here. */
export function Stickers({ c, pop = false }: { c: LiveCounts; pop?: boolean }) {
  return (
    <>
      {c.goals > 0 && (
        <span className={`ml-ball${pop ? " pop" : ""}`} aria-hidden="true">
          <Ball />
          {c.goals > 1 ? c.goals : ""}
        </span>
      )}
      {c.saves > 0 && (
        <span className="ml-ball gv" aria-hidden="true">
          <Glove />
          {c.saves}
        </span>
      )}
      {c.red > 0 ? (
        <span className="ml-cd r" aria-hidden="true">
          R
        </span>
      ) : (
        c.yellow > 0 && (
          <span className="ml-cd a" aria-hidden="true">
            A
          </span>
        )
      )}
      {c.injured && (
        <span className="ml-ball hurt" aria-hidden="true">
          +
        </span>
      )}
    </>
  );
}

/** The legend under the Campo. */
export function StickerKey() {
  return (
    <ul className="ml-key" aria-label="Leyenda">
      <li>
        <span className="ml-ball" aria-hidden="true">
          <Ball />
        </span>
        goles
      </li>
      <li>
        <span className="ml-cd a" aria-hidden="true">
          A
        </span>
        amarilla
      </li>
      <li>
        <span className="ml-cd r" aria-hidden="true">
          R
        </span>
        roja
      </li>
      <li>
        <span className="ml-ball gv" aria-hidden="true">
          <Glove />
        </span>
        paradas
      </li>
      <li>
        <span className="ml-ball hurt" aria-hidden="true">
          +
        </span>
        tocado
      </li>
    </ul>
  );
}

/** The node of a play on the rail: a card, or its icon in the side's colour (navy on our gold goal). */
export function PlayNode({ meta, tone }: { meta: EventMeta; tone: "gol" | "them" | "" }) {
  return (
    <span className={`ml-nd${tone === "gol" ? " g" : tone === "them" ? " r" : ""}`} aria-hidden="true">
      {meta.card ? <span className={`ml-cd ${meta.card}`}>{meta.card === "r" ? "R" : "A"}</span> : <i className={`ml-gi ${meta.glyph}${tone === "gol" ? " navy" : tone === "them" ? " coral" : ""}`} />}
    </span>
  );
}

/** The goalkeeper's glove on a dark chip (the «Paradas de Álex» row). */
export function GloveIcon() {
  return <i className="ml-gi parada gold" aria-hidden="true" />;
}
