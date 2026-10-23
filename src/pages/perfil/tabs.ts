// /profile's menu: the tabs (Capitanía only for captains), their deep links (#carta … #capitania) and the
// tablist's keys. Pure, plus the first load's hash (the season sync may rewrite the URL before the page
// reads it, like the pizarra's deeplink).


export type TabId = "carta" | "temp" | "avisos" | "ajustes" | "cuenta" | "cap";
export interface TabDef {
  id: TabId;
  label: string;
  desc: string;
  hash: string;
}
export const TABS: readonly TabDef[] = [
  { id: "carta", label: "Tu carta", desc: "Lo que dice tu carta y cómo mejorarla.", hash: "carta" },
  { id: "temp", label: "Temporada", desc: "Tus números de esta temporada y lo tuyo en el vestuario.", hash: "temporada" },
  { id: "avisos", label: "Avisos", desc: "Qué te llega a este móvil y el calendario del club.", hash: "avisos" },
  { id: "ajustes", label: "Ajustes", desc: "Cómo se ve y cómo suena la web en este móvil.", hash: "ajustes" },
  { id: "cuenta", label: "Cuenta", desc: "Tu Google, tu acceso y tus datos.", hash: "cuenta" },
  { id: "cap", label: "Capitanía", desc: "Lo que solo ves tú como capitán.", hash: "capitania" },
];

export function tabsFor(captain: boolean): TabDef[] {
  return TABS.filter((t) => t.id !== "cap" || captain);
}

/** The tab a hash asks for (#temporada → temp), if it is one of yours. */
export function tabFromHash(hash: string, captain: boolean): TabId | null {
  const h = hash.replace(/^#/, "").toLowerCase();
  return tabsFor(captain).find((t) => t.hash === h)?.id ?? null;
}
/** «Tu temporada en cromos» open over Temporada: /profile#cromos (the vestuario's banner links here). */
export const CROMOS_HASH = "cromos";
export function wantsCromos(hash: string): boolean {
  return hash.replace(/^#/, "").toLowerCase() === CROMOS_HASH;
}
export function hashOf(id: TabId): string {
  return "#" + (TABS.find((t) => t.id === id)?.hash ?? "carta");
}
/** Each tab's address (the TU board's screens): the page writes it as you change tab. */
const TAB_PATH: Record<TabId, string> = {
  carta: "/perfil",
  temp: "/perfil/temporada",
  avisos: "/avisos/a-medida",
  ajustes: "/perfil/ajustes",
  cuenta: "/perfil/cuenta",
  cap: "/perfil/capitania",
};
export const pathOf = (id: TabId): string => TAB_PATH[id];
/** «Tu temporada en cromos»'s own address. */
export const CROMOS_PATH = "/perfil/temporada/cromos";

/** ArrowLeft/Right wrap around, Home/End go to the ends (the shared tablist keys). */
export { tabForKey } from "../../lib/tabKeys";

/** «01 / 05». */
export function counter(i: number, n: number): string {
  const two = (x: number) => (x < 10 ? "0" : "") + x;
  return two(i + 1) + " / " + two(n);
}

/** The panel slides in from the side you moved to. */
export function slideDir(from: TabId, to: TabId, ids: readonly TabId[]): "l" | "r" {
  return ids.indexOf(to) >= ids.indexOf(from) ? "r" : "l";
}

// (each tab is an address now, /perfil/ajustes…: until Tú lands the address stands for the tab's old #hash)
const readHash = () => (typeof window === "undefined" ? "" : window.location.hash);
let firstHash = readHash();
/** The hash the URL asks for now, else the one the first load brought (until the page has used it). */
export function deepHash(): string {
  return readHash() || firstHash;
}
export function forgetDeepHash(): void {
  firstHash = "";
}
