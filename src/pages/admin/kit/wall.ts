// The peg wall's arithmetic (pure): how many pegs per rail, and the rails.

/** Pegs per rail on the wall: 7 on desktop, 5 with the drawer open beside it, 3 on phones. */
export function pegsPerRail(desktop: boolean, drawerOpen: boolean): number {
  if (!desktop) return 3;
  return drawerOpen ? 5 : 7;
}
/** Splits the wall's pegs into rails of `per`. */
export function railsOf<T>(items: readonly T[], per: number): T[][] {
  const n = Math.max(1, Math.floor(per));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}
