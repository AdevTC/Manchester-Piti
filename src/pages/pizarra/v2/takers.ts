// La pizarra «día de partido» — los lanzadores en orden. Penaltis, faltas y córners are ordered lists
// (1º, 2º, 3º): whoever is first of his list ON THE PITCH takes it, so the galón follows the cambios.
// Boards saved before the lists carry one id per galón (`roles.penaltiesId`…): they read as one-item
// lists. The lineup keeps `roles.penaltiesId`… as the effective taker of its seven (the cromos, the
// charla and the cartel read it), and writes it too, so an older app still shows who takes it. Pure.
import type { Lineup, RoleKey, Roles, TakerKind, Takers } from "../formations";

export const TAKER_KINDS: TakerKind[] = ["penalties", "freekicks", "corners"];
/** The galón each list wears on the cromo. */
export const TAKER_ROLE: Record<TakerKind, Extract<RoleKey, "penaltiesId" | "freekicksId" | "cornersId">> = {
  penalties: "penaltiesId",
  freekicks: "freekicksId",
  corners: "cornersId",
};
export const ROLE_TAKER: Partial<Record<RoleKey, TakerKind>> = { penaltiesId: "penalties", freekicksId: "freekicks", cornersId: "corners" };
export const TAKER_LABEL: Record<TakerKind, string> = { penalties: "Penaltis", freekicks: "Faltas", corners: "Córners" };
export const TAKER_LETTER: Record<TakerKind, "P" | "F" | "E"> = { penalties: "P", freekicks: "F", corners: "E" };
export const TAKERS_MAX = 3;
export const ORDINAL = ["1º", "2º", "3º"] as const;

export const emptyTakers = (): Takers => ({ penalties: [], freekicks: [], corners: [] });

/** The ordered lists: the board's own, else (an older board) each single galón as a one-item list. */
export function takersOf(L: Pick<Lineup, "roles" | "takers">): Takers {
  if (L.takers) return L.takers;
  const out = emptyTakers();
  TAKER_KINDS.forEach((k) => {
    const id = L.roles[TAKER_ROLE[k]];
    if (id) out[k] = [id];
  });
  return out;
}

/** Migration of a stored board: its lists when it has them, else its old single ids as lists. */
export function migrateTakers(stored: Takers | null, roles: Roles): Takers {
  return stored ?? takersOf({ roles, takers: undefined });
}

const pitchOf = (L: Pick<Lineup, "slots">): Set<string> => new Set(L.slots.map((s) => s.playerId).filter((x): x is string => !!x));

/** The first of the list who is on the pitch (undefined = none of them). */
export const effectiveTaker = (list: readonly string[], onPitch: ReadonlySet<string>): string | undefined => list.find((id) => onPitch.has(id));

/**
 * The galones of a seven: the brazalete on whoever wears it on the pitch, and each dead-ball galón on the
 * first of its list on the pitch. `vice`: the vice-capitán takes the brazalete when the captain is off
 * (a seven after a cambio); the board's own seven keeps the captain's galón to the captain.
 */
export function rolesFor(L: Pick<Lineup, "slots" | "roles" | "takers">, vice = false): Roles {
  const on = pitchOf(L);
  const t = takersOf(L);
  const out: Roles = {};
  const cap = L.roles.captainId;
  if (cap && on.has(cap)) out.captainId = cap;
  else if (vice && L.roles.viceId && on.has(L.roles.viceId)) out.captainId = L.roles.viceId;
  if (L.roles.viceId) out.viceId = L.roles.viceId;
  TAKER_KINDS.forEach((k) => {
    const id = effectiveTaker(t[k], on);
    if (id) out[TAKER_ROLE[k]] = id;
  });
  return out;
}

const sameRoles = (a: Roles, b: Roles): boolean => {
  const ka = Object.keys(a) as RoleKey[];
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

/** The lineup with its galones in step with its seven (the same object when nothing changes). */
export function syncRoles(L: Lineup): Lineup {
  const roles = rolesFor(L);
  return sameRoles(roles, L.roles) ? L : { ...L, roles };
}

/**
 * The seven as the cromos show it at some moment of the match (after the cambios): the vice-capitán
 * wears the brazalete when the captain has gone off, the takers are the first of each list on the pitch.
 */
export function shownAt(L: Lineup): Lineup {
  const roles = rolesFor(L, true);
  return sameRoles(roles, L.roles) ? L : { ...L, roles };
}

/** `id` as the `pos`-th (0 = 1º) of a list; choosing the place he already has takes him off it. */
export function setTaker(L: Lineup, kind: TakerKind, id: string, pos: number): Lineup {
  const t = takersOf(L);
  const list = t[kind];
  const at = list.indexOf(id);
  const rest = list.filter((x) => x !== id);
  const next = at === pos ? rest : [...rest.slice(0, pos), id, ...rest.slice(pos)].slice(0, TAKERS_MAX);
  return syncRoles({ ...L, takers: { ...t, [kind]: next } });
}

/** The galón tap (the fan's P / F / E): `id` becomes the 1º, or comes off the list if he already was. */
export const toggleFirst = (L: Lineup, kind: TakerKind, id: string): Lineup => setTaker(L, kind, id, 0);

/** Only known players stay on the lists (a player gone from the squad leaves them). */
export function knownTakers(t: Takers, known: ReadonlySet<string>): Takers {
  if (!known.size) return t;
  const keep = (l: string[]) => l.filter((id) => known.has(id));
  return { penalties: keep(t.penalties), freekicks: keep(t.freekicks), corners: keep(t.corners) };
}

/** «TELLO › KEVIN › ERIK» (empty = nadie). */
export const orderTxt = (list: readonly string[], name: (id: string) => string): string => list.map(name).join(" › ");

/** Where `id` is in each list: «1º penaltis · 2º córners». */
export function takerPlaces(t: Takers, id: string): { kind: TakerKind; pos: number }[] {
  return TAKER_KINDS.flatMap((k) => {
    const pos = t[k].indexOf(id);
    return pos >= 0 ? [{ kind: k, pos }] : [];
  });
}
