// The shirt of la mesa (MainV2's kit): sky blue for the outfield, navy and gold for the keeper, the bench's
// dark training top. The gradients are defined once per screen by <ShirtDefs />.
const PATH = "M15 3 L20 1.5 Q24 6 28 1.5 L33 3 L46 11 L41 20 L36 17 L36 42 L12 42 L12 17 L7 20 L2 11 Z";

export type ShirtKind = "field" | "keeper" | "bench";
const shirtLook = (kind: ShirtKind) =>
  kind === "keeper"
    ? { fill: "url(#mesa-kGk)", stroke: "#FFC659", ink: "#ffd98c", collar: "#FFC659" }
    : kind === "bench"
      ? { fill: "url(#mesa-kBench)", stroke: "rgba(169,214,245,.75)", ink: "#dbeeff", collar: "rgba(169,214,245,.75)" }
      : { fill: "url(#mesa-kSky)", stroke: "rgba(255,255,255,.55)", ink: "#0c1733", collar: "#2a73ad" };

export function ShirtDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="mesa-kSky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9efff" /><stop offset=".55" stopColor="#9fd0f2" /><stop offset="1" stopColor="#6aa7d6" /></linearGradient>
        <linearGradient id="mesa-kGk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2a3f78" /><stop offset="1" stopColor="#101b3c" /></linearGradient>
        <linearGradient id="mesa-kBench" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d2c58" /><stop offset="1" stopColor="#121c3d" /></linearGradient>
      </defs>
    </svg>
  );
}

/** The shirt with its dorsal. `size` is the width (the height keeps the kit's 48:44). */
export function Shirt({ kind, number, size = 48, shadow = false }: { kind: ShirtKind; number: string; size?: number; shadow?: boolean }) {
  const L = shirtLook(kind);
  return (
    <span className="shirt">
      {shadow && <span className="shadow" />}
      <svg width={size} height={Math.round((size * 44) / 48)} viewBox="0 0 48 44" aria-hidden="true">
        <path d={PATH} fill={L.fill} stroke={L.stroke} strokeWidth={kind === "bench" ? 2 : 1.4} strokeLinejoin="round" />
        {kind !== "bench" && <path d="M20 1.8 Q24 7.5 28 1.8" fill="none" stroke={L.collar} strokeWidth="1.6" />}
        {kind !== "bench" && <path d="M12 17 L12 23 M36 17 L36 23" stroke="rgba(12,23,51,.18)" strokeWidth="1" />}
      </svg>
      <span className="dor" style={{ color: L.ink }}>
        {number}
      </span>
    </span>
  );
}
