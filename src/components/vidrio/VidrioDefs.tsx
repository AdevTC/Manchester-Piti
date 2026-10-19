// The kit's shared SVG paint servers, once per page: the momentum ribbon's «us» fill and the goal's gold peak.
// (The refraction filters are built per size by useRefraction in their own hidden <svg>, client only.)
export function VidrioDefs() {
  return (
    <svg className="vd-defs" width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        <linearGradient id="vd-grad-us" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EAF3FC" stopOpacity=".75" />
          <stop offset="1" stopColor="#6CABDD" stopOpacity=".12" />
        </linearGradient>
        <linearGradient id="vd-grad-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFC659" stopOpacity=".95" />
          <stop offset="1" stopColor="#FFC659" stopOpacity=".1" />
        </linearGradient>
      </defs>
    </svg>
  );
}
