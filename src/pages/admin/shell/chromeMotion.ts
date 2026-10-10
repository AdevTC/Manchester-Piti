// The chrome's motion logic (rail, phone bar, «Más»): whether motion is allowed, the counters' odometer
// maths, the springs and the haptic tick. The components that use it live in ChromeBits.tsx, Rail.tsx and
// Phone.tsx. Everything animates transform / opacity only.
import { useReducedMotionConfig, type Transition, type Variants } from "motion/react";
import { buzz } from "../../pizarra/v2/sound";

/**
 * Motion is allowed: not reduced by the device (the app's <MotionConfig reducedMotion="user">) nor by a
 * nearer <MotionConfig>. When it is reduced the chrome renders plain elements, with no Motion props at all.
 */
export function useChromeMotion(): boolean {
  return !useReducedMotionConfig();
}

/** A short haptic tick in answer to a tap (only with user activation, where the device vibrates; never throws). */
export const tick = () => buzz(8);

/** The digits of a counter, units last («12» → ["1", "2"]); negatives and fractions never show. */
export function digitsOf(n: number): string[] {
  return String(Math.max(0, Math.floor(n))).split("");
}
export type Trend = "up" | "down" | "same";
/** Which way a counter moved: up (rolls up, pops, one ring), down (rolls back down) or not at all. */
export function trendOf(prev: number, next: number): Trend {
  return next > prev ? "up" : next < prev ? "down" : "same";
}
/** The counter's state after a new value: its trend and how many times it went up (each up = one pop). */
export interface CountState {
  last: number;
  trend: Trend;
  bumps: number;
}
export function nextCount(s: CountState, n: number): CountState {
  if (s.last === n) return s;
  const trend = trendOf(s.last, n);
  return { last: n, trend, bumps: trend === "up" ? s.bumps + 1 : s.bumps };
}

/** One odometer digit: the new one comes in from below (up) or above (down), the old one leaves the other way. */
export const ROLL: Variants = {
  enter: (dir: number) => ({ y: dir >= 0 ? "100%" : "-100%", opacity: 0 }),
  center: { y: "0%", opacity: 1, transition: { type: "spring", stiffness: 520, damping: 34 } },
  exit: (dir: number) => ({ y: dir >= 0 ? "-100%" : "100%", opacity: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }),
};

/** The floodlight indicator gliding between items. */
export const FLOOD: Transition = { type: "spring", stiffness: 430, damping: 36, mass: 0.9 };
/** Tooltips and menus arriving. */
export const POP: Transition = { type: "spring", stiffness: 560, damping: 34 };
/** The «Más» sheet springing up. */
export const SHEET: Transition = { type: "spring", stiffness: 380, damping: 36, mass: 0.9 };
/** Drag the «Más» sheet down past this (px) or flick it faster than this (px/s) and it closes. */
export const DISMISS = { offset: 110, velocity: 650 };

/** Where the captain's menu sits: its left edge and its bottom (px from the viewport's bottom), above him. */
export interface MenuAnchor {
  left: number;
  bottom: number;
}
export const anchorAbove = (el: HTMLElement): MenuAnchor => {
  const r = el.getBoundingClientRect();
  return { left: Math.round(r.left), bottom: Math.round(window.innerHeight - r.top + 8) };
};
