import React from "react";

interface JerseyProps {
  name: string;
  number: number | string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  style?: React.CSSProperties;
}

export const Jersey: React.FC<JerseyProps> = ({
  name,
  number,
  size = "md",
  className = "",
  style = {}
}) => {
  const sizeDims = {
    sm: { width: 80, height: 80 },
    md: { width: 140, height: 140 },
    lg: { width: 220, height: 220 },
    xl: { width: 300, height: 300 }
  };

  const dimensions = sizeDims[size] || sizeDims.md;
  const formattedName = name ? name.toUpperCase().slice(0, 12) : "PITI";

  return (
    <div
      className={`jersey-wrapper ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        filter: "drop-shadow(0 10px 15px rgba(0, 0, 0, 0.4))",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: "pointer",
        ...style
      }}
    >
      <svg
        viewBox="0 0 200 200"
        width={dimensions.width}
        height={dimensions.height}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Sky Blue / Cyan Gradient for premium athletic look */}
          <linearGradient id="jerseyBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7dd3fc" /> {/* Sky Blue Light */}
            <stop offset="100%" stopColor="#0284c7" /> {/* Sky Blue Dark */}
          </linearGradient>

          {/* Slight 3D shading overlay */}
          <linearGradient id="shadeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
          </linearGradient>

          {/* Drop shadow for text inside SVG */}
          <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* LEFT SLEEVE (White) */}
        <path
          d="M 50,55 L 12,88 C 9,91 10,96 14,99 L 34,115 C 38,118 43,117 46,112 L 66,90 Z"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Left Sleeve Cyan Accent Cuff */}
        <path
          d="M 12,88 L 19,83 L 39,100 L 34,115 Z"
          fill="#0284c7"
        />

        {/* RIGHT SLEEVE (White) */}
        <path
          d="M 150,55 L 188,88 C 191,91 190,96 186,99 L 166,115 C 162,118 157,117 154,112 L 134,90 Z"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Right Sleeve Cyan Accent Cuff */}
        <path
          d="M 188,88 L 181,83 L 161,100 L 166,115 Z"
          fill="#0284c7"
        />

        {/* JERSEY BODY (Cyan Gradient) */}
        <path
          d="M 58,55 L 142,55 C 145,55 147,57 146,60 L 152,175 C 153,178 150,181 147,181 L 53,181 C 50,181 47,178 48,175 L 54,60 C 53,57 55,55 58,55 Z"
          fill="url(#jerseyBodyGrad)"
          stroke="#0f172a"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Subtle Vertical Stripes in Body (White overlay with opacity) */}
        <path d="M 75,55 L 75,181" stroke="#ffffff" strokeWidth="2.5" strokeOpacity="0.25" />
        <path d="M 100,68 L 100,181" stroke="#ffffff" strokeWidth="2.5" strokeOpacity="0.25" />
        <path d="M 125,55 L 125,181" stroke="#ffffff" strokeWidth="2.5" strokeOpacity="0.25" />

        {/* White Side Panel Piping */}
        <path d="M 53,100 L 51,178" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 147,100 L 149,178" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />

        {/* COLLAR (White round collar with dark border) */}
        <path
          d="M 82,55 C 82,69 118,69 118,55 Z"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="2.5"
        />
        {/* Inner Collar Shading */}
        <path
          d="M 84,55 C 84,65 116,65 116,55 Z"
          fill="#0f172a"
          fillOpacity="0.2"
        />

        {/* 3D SHADING OVERLAY */}
        <path
          d="M 58,55 L 142,55 L 152,175 L 53,181 Z"
          fill="url(#shadeGrad)"
          style={{ pointerEvents: "none", mixBlendMode: "multiply" as any }}
        />

        {/* PLAYER NAME (Dark Navy/Dark Blue) */}
        <text
          x="100"
          y="92"
          fill="#090d16"
          fontSize="11.5"
          fontWeight="800"
          textAnchor="middle"
          letterSpacing="1.2"
          filter="url(#textShadow)"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          {formattedName}
        </text>

        {/* PLAYER DORSAL NUMBER (Dark Navy/Dark Blue) */}
        <text
          x="100"
          y="146"
          fill="#090d16"
          fontSize="48"
          fontWeight="900"
          textAnchor="middle"
          filter="url(#textShadow)"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          {number}
        </text>
      </svg>
    </div>
  );
};
