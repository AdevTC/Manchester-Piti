// Plantilla's domain logic, pure (tested in plantillaLogic.test.ts): the table rows (season shirt name and
// dorsal, position, seasons, state), the live search / position filter, the player drawer's form model
// (defaults + per-season overrides, exactly the shape the old Admin form saved), its live checks (shirt
// name 2–12 letters, dorsal 1–99 and unique per season — the same predicate as lib/dorsalValidation), the
// Firestore payload, and the CSV export. Router-, React- and Firebase-free.
import { isDorsalTaken } from "../../../lib/dorsalValidation";
import { playerName } from "../../../lib/clubData";
import type { PlayerDoc, SeasonDoc } from "../../../lib/schemas";

export const POSITIONS = ["POR", "DEF", "MED", "DEL"] as const;
export type Position = (typeof POSITIONS)[number];
export const POS_LABEL: Record<Position, string> = { POR: "Portero", DEF: "Defensa", MED: "Medio", DEL: "Delantero" };
export const asPosition = (v: unknown): Position | "" => {
  const up = String(v ?? "").toUpperCase();
  return (POSITIONS as readonly string[]).includes(up) ? (up as Position) : "";
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
/** Lower-case, without accents (ADRIÁN ⇢ adrian), for the search. */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** «T1» for «Temporada 1», «T0» for «Temporada 0 · pre-Piti»; the first letters otherwise. */
export function seasonCode(name: string): string {
  const n = /(\d+)/.exec(name)?.[1];
  return n ? `T${n}` : name.trim().slice(0, 3).toUpperCase();
}
/** «Temporada 1 · activa» / «· archivada» / «· en preparación» (the drawer's season toggles). */
export function seasonLabel(s: Pick<SeasonDoc, "id" | "name" | "archived">, activeId: string | undefined): string {
  return `${s.name} · ${s.archived ? "archivada" : s.id === activeId ? "activa" : "en preparación"}`;
}

/** A player's shirt name and dorsal for one season (seasonDetails, typed). */
export function seasonDetailOf(p: Pick<PlayerDoc, "seasonDetails">, seasonId: string): { shirtName?: string; number?: number } {
  const raw = p.seasonDetails?.[seasonId];
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  return { shirtName: typeof r.shirtName === "string" && r.shirtName ? r.shirtName : undefined, number: typeof r.number === "number" ? r.number : undefined };
}
/** Name on the shirt for a season (season detail, else the default, else the person's name). */
export const nameIn = (p: PlayerDoc, seasonId: string | undefined) => (seasonId ? seasonDetailOf(p, seasonId).shirtName : undefined) || playerName(p);
/** Dorsal for a season (season detail, else the default). */
export const numberIn = (p: PlayerDoc, seasonId: string | undefined): number | null => {
  const n = (seasonId ? seasonDetailOf(p, seasonId).number : undefined) ?? p.number;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

// ───────────────────────── table rows ─────────────────────────
export interface PlantillaRow {
  id: string;
  doc: PlayerDoc;
  /** Dorsal in the active season (or the default one). */
  number: number | null;
  /** Shirt name in the active season (or the default one). */
  name: string;
  /** «Nombre Apellidos». */
  full: string;
  position: Position | "";
  injured: boolean;
  /** «T1 · T0» (newest first). */
  seasons: string;
  /** Plays the active season. */
  inSeason: boolean;
}
/** Every player (validated docs), the active season's squad first by dorsal, then the rest by dorsal. */
export function plantillaRows(players: readonly PlayerDoc[], seasons: readonly SeasonDoc[], activeId: string | undefined): PlantillaRow[] {
  const order = new Map(seasons.map((s, i) => [s.id, i]));
  const rows = players.map((p): PlantillaRow => {
    const inSeason = !!activeId && (p.seasons ?? []).includes(activeId);
    const sid = inSeason ? activeId : undefined;
    const codes = [...(p.seasons ?? [])]
      .filter((id) => order.has(id))
      .sort((a, b) => (order.get(b) ?? 0) - (order.get(a) ?? 0))
      .map((id) => seasonCode(seasons[order.get(id) ?? 0].name));
    return {
      id: p.id,
      doc: p,
      number: numberIn(p, sid),
      name: nameIn(p, sid),
      full: [p.firstName, p.lastName].filter(Boolean).join(" ") || "Sin nombre",
      position: asPosition(p.naturalPosition),
      injured: !!p.injured,
      seasons: codes.join(" · ") || "—",
      inSeason,
    };
  });
  return rows.sort((a, b) => Number(b.inSeason) - Number(a.inSeason) || (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, "es"));
}
export type PosFilter = "Todos" | Position;
/** Live search (shirt name, full name or exact dorsal; accents ignored) and the position filter. */
export function filterRows(rows: readonly PlantillaRow[], q: string, pos: PosFilter): PlantillaRow[] {
  const t = fold(q.trim());
  return rows.filter((r) => (pos === "Todos" || r.position === pos) && (!t || fold(r.name).includes(t) || fold(r.full).includes(t) || String(r.number ?? "") === t));
}
/** «2 porteros · 1 lesionado · dorsales únicos» — the view's summary chip. */
export function rosterSummary(rows: readonly PlantillaRow[]): string {
  const squad = rows.filter((r) => r.inSeason);
  const por = squad.filter((r) => r.position === "POR").length;
  const inj = squad.filter((r) => r.injured).length;
  const nums = squad.map((r) => r.number).filter((n): n is number => n != null);
  const dup = nums.length - new Set(nums).size;
  return [plural(por, "portero", "porteros"), inj ? plural(inj, "lesionado", "lesionados") : "", dup ? plural(dup, "dorsal repetido", "dorsales repetidos") : "dorsales únicos"].filter(Boolean).join(" · ");
}

// ───────────────────────── the drawer's form ─────────────────────────
export interface SeasonOverride {
  shirtName: string;
  number: string;
}
export interface PlayerForm {
  firstName: string;
  lastName: string;
  /** Default shirt name (upper-case as typed). */
  shirtName: string;
  /** Default dorsal, as typed. */
  number: string;
  position: Position | "";
  injured: boolean;
  /** Seasons the player plays. */
  seasons: string[];
  /** Per-season shirt name / dorsal; "" = the default one. */
  overrides: Record<string, SeasonOverride>;
  /** YYYY-MM-DD or "". */
  birthDate: string;
  height: string;
  weight: string;
  photoUrl: string;
}
/** «Alta de jugador»: empty, medio, active, in the given seasons (the active one). */
export function emptyForm(seasonIds: readonly string[]): PlayerForm {
  return { firstName: "", lastName: "", shirtName: "", number: "", position: "MED", injured: false, seasons: [...seasonIds], overrides: {}, birthDate: "", height: "", weight: "", photoUrl: "" };
}
/** The form for an existing player: the defaults, and an override wherever a season's value differs. */
export function formFromPlayer(p: PlayerDoc): PlayerForm {
  const seasons = [...(p.seasons ?? [])];
  const first = seasons.map((sid) => seasonDetailOf(p, sid)).find((d) => d.shirtName || d.number != null) ?? {};
  const shirt = (p.shirtName || first.shirtName || "").toUpperCase();
  const num = p.number ?? first.number;
  const overrides: Record<string, SeasonOverride> = {};
  for (const sid of seasons) {
    const d = seasonDetailOf(p, sid);
    const o = { shirtName: d.shirtName && d.shirtName.toUpperCase() !== shirt ? d.shirtName.toUpperCase() : "", number: d.number != null && d.number !== num ? String(d.number) : "" };
    if (o.shirtName || o.number) overrides[sid] = o;
  }
  return {
    firstName: p.firstName ?? "",
    lastName: p.lastName ?? "",
    shirtName: shirt,
    number: num != null ? String(num) : "",
    position: asPosition(p.naturalPosition),
    injured: !!p.injured,
    seasons,
    overrides,
    birthDate: p.birthDate ?? "",
    height: p.height != null ? String(p.height) : "",
    weight: p.weight != null ? String(p.weight) : "",
    photoUrl: p.photoUrl ?? "",
  };
}
/** What the form would save, normalised (trimmed, seasons sorted, empty overrides dropped). */
function normal(f: PlayerForm) {
  const seasons = [...new Set(f.seasons)].sort();
  const overrides = Object.fromEntries(
    seasons
      .map((sid) => [sid, { shirtName: (f.overrides[sid]?.shirtName ?? "").trim().toUpperCase(), number: (f.overrides[sid]?.number ?? "").trim() }] as const)
      .filter(([, o]) => o.shirtName || o.number),
  );
  return [f.firstName.trim(), f.lastName.trim(), f.shirtName.trim().toUpperCase(), f.number.trim(), f.position, f.injured, seasons, overrides, f.birthDate, f.height.trim(), f.weight.trim(), f.photoUrl.trim()];
}
/** The form differs from its starting point («● Cambios sin guardar»). */
export const formDirty = (form: PlayerForm, start: PlayerForm) => JSON.stringify(normal(form)) !== JSON.stringify(normal(start));

export type CheckTone = "ok" | "bad" | "mut";
export interface LiveCheck {
  tone: CheckTone;
  text: string;
}
export interface FormCheck {
  firstName: string | null;
  /** The shirt name is out of 2–12 letters (null = fine or still empty). */
  shirtName: string | null;
  /** The dorsal's live line: mut (empty, the rule), ok («Libre en la Temporada 1»), bad (why not). */
  number: LiveCheck;
  /** Per-season override problems. */
  overrides: Record<string, { shirtName?: string; number?: string }>;
  height: string | null;
  weight: string | null;
  /** The photo link's live line (null = empty). */
  photo: LiveCheck | null;
  /** Every blocking problem, in the form's order (the first one is what «Guardar» explains). */
  errors: string[];
  ok: boolean;
}
export interface CheckContext {
  /** The players as shown (pending changes applied). */
  players: readonly PlayerDoc[];
  seasons: readonly Pick<SeasonDoc, "id" | "name">[];
  /** The player being edited (excluded from the uniqueness check), null for an alta. */
  editingId: string | null;
  /** The form as it was opened: an unchanged out-of-range dorsal does not block saving other fields. */
  start?: PlayerForm | null;
}
/** HTTPS link check (empty = nothing to check). */
export function linkState(v: string): "empty" | "ok" | "bad" {
  const t = v.trim();
  if (!t) return "empty";
  if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(t)) return "bad";
  try {
    return new URL(t).hostname ? "ok" : "bad";
  } catch {
    return "bad";
  }
}
const parseDorsal = (v: string): number | null => (/^\d{1,2}$/.test(v.trim()) ? Number(v.trim()) : null);
/** Who already wears `n` in `seasonId` (the same predicate the old form used), or null. */
export function dorsalHolder(players: readonly PlayerDoc[], seasonId: string, n: number, exceptId: string | null): PlayerDoc | null {
  const like = (p: PlayerDoc) => ({ id: p.id, number: p.number ?? Number.NaN, seasons: p.seasons, seasonDetails: Object.fromEntries((p.seasons ?? []).map((sid) => [sid, { number: seasonDetailOf(p, sid).number ?? p.number ?? Number.NaN }])) });
  return players.find((p) => isDorsalTaken([like(p)], seasonId, n, exceptId)) ?? null;
}
const seasonsWord = (names: string[]) => andList(names.map((n) => `la ${n}`));

export function checkPlayerForm(form: PlayerForm, ctx: CheckContext): FormCheck {
  const errors: string[] = [];
  const seasonName = (id: string) => ctx.seasons.find((s) => s.id === id)?.name ?? "la temporada";
  const start = ctx.start ?? null;

  const firstName = form.firstName.trim() ? null : "Falta el nombre.";
  if (firstName) errors.push(firstName);

  const shirt = form.shirtName.trim();
  const shirtBad = shirt.length < 2 || shirt.length > 12;
  const shirtName = shirt && shirtBad ? "El nombre en camiseta va de 2 a 12 letras." : null;
  if (shirtBad) errors.push(shirtName ?? "Falta el nombre en camiseta (de 2 a 12 letras).");

  // the default dorsal
  const raw = form.number.trim();
  const unchanged = (v: string, was: string | undefined) => !!start && v === (was ?? "").trim() && v !== "";
  let number: LiveCheck;
  const main = parseDorsal(raw);
  const mainOk = main != null && main >= 1 && main <= 99;
  const mainUsable = mainOk || (unchanged(raw, start?.number) && /^\d+$/.test(raw));
  if (!raw) {
    number = { tone: "mut", text: "Del 1 al 99 · único en la temporada" };
    errors.push("Pon un dorsal del 1 al 99.");
  } else if (!mainUsable) {
    number = { tone: "bad", text: "El dorsal va del 1 al 99." };
    errors.push(number.text);
  } else number = { tone: "ok", text: "" };

  // per season: the override (or the default) must be free in that season
  const overrides: FormCheck["overrides"] = {};
  const free: string[] = [];
  let conflict: string | null = null;
  for (const sid of form.seasons) {
    const o = form.overrides[sid] ?? { shirtName: "", number: "" };
    const problems: { shirtName?: string; number?: string } = {};
    const oName = o.shirtName.trim();
    if (oName && (oName.length < 2 || oName.length > 12)) problems.shirtName = "De 2 a 12 letras.";
    const oRaw = o.number.trim();
    let n: number | null = null;
    if (oRaw) {
      const v = parseDorsal(oRaw);
      if ((v != null && v >= 1 && v <= 99) || (unchanged(oRaw, start?.overrides[sid]?.number) && /^\d+$/.test(oRaw))) n = Number(oRaw);
      else problems.number = "Del 1 al 99.";
    } else if (mainUsable) n = Number(raw);
    if (n != null) {
      const holder = dorsalHolder(ctx.players, sid, n, ctx.editingId);
      if (holder) {
        const msg = `El ${n} ya lo lleva ${nameIn(holder, sid)} en la ${seasonName(sid)}.`;
        if (oRaw) problems.number = msg;
        else conflict ??= msg;
      } else free.push(seasonName(sid));
    }
    if (problems.shirtName) errors.push(`${seasonName(sid)}: el nombre en camiseta va de 2 a 12 letras.`);
    if (problems.number) errors.push(oRaw && problems.number.startsWith("El ") ? problems.number : `${seasonName(sid)}: el dorsal va del 1 al 99.`);
    if (problems.shirtName || problems.number) overrides[sid] = problems;
  }
  if (number.tone === "ok") {
    if (conflict) {
      number = { tone: "bad", text: conflict };
      errors.push(conflict);
    } else number = { tone: "ok", text: form.seasons.length ? `Libre en ${seasonsWord(free.length ? free : form.seasons.map(seasonName))}` : "Libre · sin temporada elegida" };
  }

  const measure = (v: string, what: string, unit: string) => {
    const t = v.trim();
    if (!t) return null;
    return /^\d{1,3}$/.test(t) && Number(t) <= 300 ? null : `${what} va en ${unit}, sin decimales.`;
  };
  const height = measure(form.height, "La altura", "centímetros");
  const weight = measure(form.weight, "El peso", "kilos");
  if (height) errors.push(height);
  if (weight) errors.push(weight);

  const ls = linkState(form.photoUrl);
  const photo: LiveCheck | null = ls === "empty" ? null : ls === "ok" ? { tone: "ok", text: "Enlace seguro · se ve en su página" } : { tone: "bad", text: "Tiene que empezar por https://" };
  if (ls === "bad") errors.push("La foto tiene que ser un enlace https://.");

  return { firstName, shirtName, number, overrides, height, weight, photo, errors, ok: errors.length === 0 };
}

/** The Firestore write for the form (players/{id}, merged): the same fields the old Admin form saved —
 *  defaults, a seasonDetails entry per season (override or default) — plus position, state and photo. */
export function playerPayload(form: PlayerForm, create: { createdAt: Date } | null): Record<string, unknown> {
  const shirt = form.shirtName.trim().toUpperCase();
  const num = Number(form.number.trim());
  const seasons = [...new Set(form.seasons)];
  const seasonDetails: Record<string, { shirtName: string; number: number }> = {};
  for (const sid of seasons) {
    const o = form.overrides[sid];
    seasonDetails[sid] = { shirtName: o?.shirtName.trim().toUpperCase() || shirt, number: o?.number.trim() ? Number(o.number.trim()) : num };
  }
  const int = (v: string) => (v.trim() ? Number(v.trim()) : null);
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    shirtName: shirt,
    number: num,
    birthDate: form.birthDate,
    seasons,
    seasonDetails,
    height: int(form.height),
    weight: int(form.weight),
    ...(form.position ? { naturalPosition: form.position } : {}),
    injured: form.injured,
    photoUrl: form.photoUrl.trim(),
    ...(create ? { active: true, createdAt: create.createdAt } : {}),
  };
}
/** The doc as the table shows it while its write waits behind «Deshacer». */
export function previewDoc(base: PlayerDoc | null, id: string, payload: Record<string, unknown>): PlayerDoc {
  const pick = <T>(k: string, ok: (v: unknown) => v is T): T | undefined => (ok(payload[k]) ? payload[k] : undefined);
  const isStr = (v: unknown): v is string => typeof v === "string";
  const isNum = (v: unknown): v is number => typeof v === "number";
  const isBool = (v: unknown): v is boolean => typeof v === "boolean";
  const isList = (v: unknown): v is string[] => Array.isArray(v);
  const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  return {
    ...(base ?? { id }),
    id,
    firstName: pick("firstName", isStr),
    lastName: pick("lastName", isStr),
    shirtName: pick("shirtName", isStr),
    number: pick("number", isNum),
    birthDate: pick("birthDate", isStr),
    seasons: pick("seasons", isList),
    seasonDetails: { ...(base?.seasonDetails ?? {}), ...(pick("seasonDetails", isRec) ?? {}) },
    height: pick("height", isNum),
    weight: pick("weight", isNum),
    naturalPosition: pick("naturalPosition", isStr) ?? base?.naturalPosition,
    injured: pick("injured", isBool),
    photoUrl: pick("photoUrl", isStr),
  };
}

// ───────────────────────── CSV ─────────────────────────
const CSV_HEAD = ["Dorsal", "Nombre en camiseta", "Nombre", "Apellidos", "Posición", "Estado", "Temporadas", "Nacimiento", "Altura (cm)", "Peso (kg)"];
/** One CSV cell: quoted when it needs it, and a leading = + - @ neutralised (no formulas in a sheet). */
export function csvCell(v: string | number | null | undefined): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
/** The plantilla as a spreadsheet (semicolons and a BOM: opens straight in a Spanish Excel). */
export function rosterCsv(rows: readonly PlantillaRow[]): string {
  const lines = rows.map((r) =>
    [r.number, r.name, r.doc.firstName ?? "", r.doc.lastName ?? "", r.position ? POS_LABEL[r.position] : "", r.injured ? "Lesionado" : "Activo", r.seasons === "—" ? "" : r.seasons, r.doc.birthDate ?? "", r.doc.height ?? "", r.doc.weight ?? ""].map(csvCell).join(";"),
  );
  return `﻿${[CSV_HEAD.join(";"), ...lines].join("\r\n")}\r\n`;
}
/** «plantilla-temporada-1.csv». */
export function csvFileName(seasonName: string | undefined): string {
  const slug = fold(seasonName ?? "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `plantilla${slug ? `-${slug}` : ""}.csv`;
}
