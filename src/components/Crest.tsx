import React from "react";

interface CrestProps {
  /** Square render size in px. Omit to size via CSS (className). */
  size?: number;
  className?: string;
  alt?: string;
  /** eager by default (it's brand chrome); pass false for below-the-fold marks. */
  eager?: boolean;
  style?: React.CSSProperties;
}

/**
 * The Manchester Piti club crest (raster badge, transparent PNG).
 * Single source of truth so the mark stays identical across the navbar,
 * landing, auth screens and the loading splash. Served from /public.
 */
export const Crest: React.FC<CrestProps> = ({
  size,
  className,
  alt = "Escudo del Manchester Piti",
  eager = true,
  style,
}) => (
  <img
    src="/crest.png"
    width={size}
    height={size}
    alt={alt}
    draggable={false}
    decoding="async"
    loading={eager ? "eager" : "lazy"}
    className={className}
    style={{ display: "block", objectFit: "contain", ...style }}
  />
);
