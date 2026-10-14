// The system played, in words: one label for the Campo, the rival dossier and the match poster. Pure.
import { isFormationName, systemDef } from "../formations";

/** «2-3-1 · Clásico», «Libre · sin sistema fijo», or null (no official board when the acta was saved). */
export function systemText(system: unknown): string | null {
  if (system === "libre") return "Libre · sin sistema fijo";
  if (!isFormationName(system)) return null;
  const s = systemDef(system);
  return `${s.label} · ${s.name}`;
}

/** The short system for the grass («2-3-1», «Libre»), or null. */
export function systemMark(system: unknown): string | null {
  if (system === "libre") return "Libre";
  return isFormationName(system) ? systemDef(system).label : null;
}
