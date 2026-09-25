// Flat back of the kit (name + number in the print faces), painted from the page's kit tokens
// (--kit, --kit-ink, --kit-acc, --slash) so every shirt follows the 1ª/2ª toggle.
export function ShirtBack({ name, num, hanger = false, className }: { name: string; num: string; hanger?: boolean; className?: string }) {
  const long = [...name].length > 8;
  return (
    <svg className={`sq-shirt${className ? ` ${className}` : ""}`} viewBox={hanger ? "0 -46 200 276" : "0 0 200 230"} aria-hidden="true">
      {hanger && (
        <>
          <path className="hook" d="M100 -6 L100 -22 C100 -34 116 -36 116 -24" />
          <path className="hook" d="M100 -8 L22 32 M100 -8 L178 32" />
        </>
      )}
      <path
        className="body"
        d="M70 14 C84 26 116 26 130 14 L178 34 C186 38 192 46 194 56 L198 98 L166 104 L160 80 L160 214 C160 220 156 224 150 224 L50 224 C44 224 40 220 40 214 L40 80 L34 104 L2 98 L6 56 C8 46 14 38 22 34 Z"
      />
      <path className="slash" d="M134 18 L156 27 L112 150 L100 142 Z" />
      <path className="trim" d="M70 14 C84 26 116 26 130 14 M5 88 L36 94 M195 88 L164 94 M42 206 L158 206" />
      <text className="name" x="100" y="74" textAnchor="middle" {...(long ? { textLength: 112, lengthAdjust: "spacingAndGlyphs" } : {})}>
        {name}
      </text>
      <text className="num" x="100" y="180" textAnchor="middle">
        {num}
      </text>
    </svg>
  );
}
