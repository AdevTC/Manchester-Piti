// The chrome's small animated pieces: the exception counter (odometer), the section icons with their
// micro-animations and the theme's sun ↔ moon. The icons and the theme icon animate in CSS (admin-app.css,
// off under prefers-reduced-motion); the counter uses Motion only when motion is allowed — reduced, it is
// plain text with no Motion props.
import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AdIcon, type AdIconName } from "../ui/icons";
import { digitsOf, nextCount, ROLL, useChromeMotion, type CountState } from "./chromeMotion";

/**
 * An exception counter (amber badge): rolls its digits when the value changes, pops with one soft ring
 * when it goes up, fades out at 0. `className` = the badge's class (`n` in the rail and «Más», `bd` on the
 * bar). Decorative (aria-hidden): the item's accessible name already says «2 por hacer».
 */
export function Count({ n, className }: { n: number; className: string }) {
  const animate = useChromeMotion();
  const [state, setState] = useState<CountState>({ last: n, trend: "same", bumps: 0 });
  // The previous value lives in state (React's «adjust state while rendering» pattern).
  if (state.last !== n) setState(nextCount(state, n));
  if (!animate)
    return n > 0 ? (
      <span className={className} aria-hidden="true" data-motion="off">
        {n}
      </span>
    ) : null;
  const dir = state.trend === "down" ? -1 : 1;
  const digits = digitsOf(n);
  const pop = state.bumps ? (state.bumps % 2 ? " popA" : " popB") : "";
  return (
    <AnimatePresence initial={false}>
      {n > 0 && (
        <motion.span
          key="count"
          className={`${className} odo${pop}`}
          aria-hidden="true"
          data-trend={state.trend}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1, transition: { type: "spring", stiffness: 600, damping: 26 } }}
          exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.22 } }}
        >
          {digits.map((d, i) => (
            <span className="dg" key={digits.length - i}>
              <AnimatePresence initial={false} mode="popLayout" custom={dir}>
                <motion.span key={d} custom={dir} variants={ROLL} initial="enter" animate="center" exit="exit">
                  {d}
                </motion.span>
              </AnimatePresence>
            </span>
          ))}
          {state.bumps > 0 && state.trend === "up" && <span className="ring" key={`ring-${state.bumps}`} />}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

const ANIMATED = new Set<AdIconName>(["home", "cal", "shirt", "team", "inbox", "flag", "shield", "doc", "door"]);
const SHIELD = "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z";

/**
 * A section icon drawn exactly like AdIcon but in parts, so each moves with its meaning on hover / focus
 * and when its item becomes current (CSS `.nvi.{name}` in admin-app.css): the house rises, the calendar
 * page flips, the shirt sways on its hanger, the people nudge, a card drops into the inbox, the flag waves,
 * a shine sweeps the shield, the doc's lines draw, the door opens a crack. Other names = a plain AdIcon.
 */
export function NavIcon({ name, size = 20 }: { name: AdIconName; size?: number }) {
  const clip = `${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-sh`;
  if (!ANIMATED.has(name)) return <AdIcon name={name} size={size} />;
  return (
    <svg className={`nvi ${name}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "home" && (
        <g className="a1">
          <path className="a2" d="M3 11 12 4l9 7" />
          <path d="M5 10v10h14V10" />
        </g>
      )}
      {name === "cal" && (
        <>
          <rect x="3" y="4" width="18" height="18" rx="4" />
          <path d="M16 2v4M8 2v4M3 10h18" />
          <path className="a1" d="M3 10h18v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
        </>
      )}
      {name === "shirt" && <path className="a1" strokeWidth={1.9} d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0Z" />}
      {name === "team" && (
        <>
          <path className="a2" d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14a6 6 0 0 1 3 6" />
          <g className="a1">
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
          </g>
        </>
      )}
      {name === "inbox" && (
        <>
          <rect className="a2" x="8.5" y="5.5" width="7" height="5" rx="1" />
          <g className="a1">
            <path d="M3 13h5l1.5 3h5l1.5-3h5" />
            <path d="M5 5h14l2 8v6H3v-6Z" />
          </g>
        </>
      )}
      {name === "flag" && (
        <>
          <path d="M5 21V4" />
          <path className="a1" d="M5 4h11l-2 4 2 4H5" />
        </>
      )}
      {name === "shield" && (
        <>
          <clipPath id={clip}>
            <path d={SHIELD} />
          </clipPath>
          <path d={SHIELD} />
          <path d="m9 12 2 2 4-4" />
          <g clipPath={`url(#${clip})`}>
            <path className="a1" d="M6 24 18 0" strokeWidth={3.2} />
          </g>
        </>
      )}
      {name === "doc" && (
        <>
          <path d="M14 3H6v18h12V7Z" />
          <path d="M14 3v4h4" />
          <path className="a1" pathLength={1} d="M9 13h6" />
          <path className="a2" pathLength={1} d="M9 17h6" />
        </>
      )}
      {name === "door" && (
        <>
          <path d="M3 21h18" />
          <g className="a1">
            <path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17" />
            <circle cx="15" cy="12" r="1" />
          </g>
        </>
      )}
    </svg>
  );
}

/** The theme button's icon: the sun and the moon swap with a turn (CSS `.thm`). `dark` = the sun shows (go to day). */
export function ThemeIcon({ dark, size = 18 }: { dark: boolean; size?: number }) {
  return (
    <span className={`thm ${dark ? "is-dark" : "is-light"}`} aria-hidden="true">
      <span className="sun">
        <AdIcon name="sun" size={size} />
      </span>
      <span className="moon">
        <AdIcon name="moon" size={size} />
      </span>
    </span>
  );
}
