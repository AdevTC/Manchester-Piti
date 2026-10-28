// CLUB · the printed shirt stills of the rooms (the real kit with the season's name and dorsal, rendered once and kept
// on the device; the drawn back while it renders), as the boards show them (.sc-shirt).
import { ShirtBack } from "../../kit";
import type { ShirtOf } from "./stills";

const PX = { xs: 34, s: 46, m: 64, xl: 180 } as const;
export function Shirt({ shirt, src, size = "xs", alt = "" }: { shirt: ShirtOf; src: string | undefined; size?: keyof typeof PX; alt?: string }) {
  if (src) return <img className={`sc-shirt sc-shirt--${size}`} src={src} alt={alt} width={540} height={600} />;
  return (
    <span className={`sc-shirt sc-shirt--${size}`} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
      <ShirtBack name={shirt.name} num={shirt.num} size={PX[size]} />
    </span>
  );
}
