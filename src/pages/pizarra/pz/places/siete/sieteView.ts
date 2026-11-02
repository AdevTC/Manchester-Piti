// r14 «La pizarra» · Siete: what the Siete's regions and sheets SAY, as pure functions of the store (the port of
// PiSiete's renderVals). The components only draw it. Named sieteView.ts (not siete.ts: Siete.tsx on Windows).
import type { PublishCheck, PzApi } from "../../store/api";
import { GALONES } from "../../store/store";
import { VERS, verOf } from "../../store/seven";
import { fmt } from "../../store/fmt";
import { SYSTEMS_CATALOGUE, systemDef } from "../../../../../lib/formations";
import type { FormationName } from "../../../formations";
import type { PzBoard, PzPlayer, PzRsvp, PzVer, Tone } from "../../store/types";

export const LINE_FILTERS: [string, string][] = [
  ["todos", "Todos"],
  ["POR", "POR"],
  ["DEF", "DEF"],
  ["MED", "MED"],
  ["DEL", "DEL"],
];
const LINE_SHORT: Record<string, string> = { POR: "Portero", DEF: "Defensa", MED: "Medio", DEL: "Delantero" };

/** Lowercase, without accents (search). */
export const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** The ring's dash offset for n of 7 (r = 34 → 213.6). */
export const ringOff = (n: number) => String(Math.round(213.6 * (1 - Math.max(0, Math.min(7, n)) / 7) * 10) / 10);

/** «ADRIÁN T.C. · 10». */
export const shirtLabel = (p: PzPlayer | null) => (p ? p.shirt + (p.num ? " · " + p.num : "") : "—");

export interface BenchRow {
  id: string;
  name: string;
  sub: string;
  chip: string;
  chipIcon: string;
  tone: Tone;
  media: string;
  mediaK: string;
  can: boolean;
  aria: string;
}

/** One player of the bench as its row says him. */
export function benchRow(P: PzApi, id: string, ro: boolean): BenchRow {
  const pl = P.sel.player(id) as PzPlayer;
  const r = P.sel.rsvp(id);
  const S = P.state;
  const pos = pl.main || pl.also[0] || "";
  const role = pl.guest ? "Invitado" + (pos ? " · " + pos : "") : (pl.line ? LINE_SHORT[pl.line] : "Sin posición") + (pos ? " · " + pos : "");
  const games = pl.guest ? "Sin partidos" : pl.pj ? pl.pj + " PJ · " + pl.min + "′" : "Sin partidos";
  const why = r.why && r.v !== "yes" && r.v !== "guest" ? r.why : r.v === "guest" && r.why && r.why !== "Invitado" ? r.why.replace(/^Invitado\s*·?\s*/, "") : "";
  const sub = [role, games, why].filter(Boolean).join(" · ");
  const band = P.sel.band(pl.global);
  const media = pl.global == null ? "—" : String(pl.global);
  const hint = ro ? ". Ver su ficha" : !r.can ? ". No se puede colocar" : S.sel?.from === "campo" ? ". Toca para que entre por " + P.sel.name(S.sel.pid) : S.slotPick != null ? ". Toca para ponerlo en el hueco" : ". Toca para cogerlo";
  return {
    id,
    name: shirtLabel(pl),
    sub,
    chip: r.t,
    chipIcon: r.icon,
    tone: r.tone,
    media,
    mediaK: pl.global == null ? (pl.guest ? "invitado" : "sin nota") : band.t,
    can: r.can,
    aria: `${pl.shirt}${pl.num ? ", " + pl.num : ""}. ${sub}. ${r.t}. Media ${pl.global == null ? "sin nota" : pl.global}${hint}`,
  };
}

const ORDER: Record<string, number> = { yes: 0, guest: 1, maybe: 2, none: 3 };

/** The bench (everyone not on the pitch), filtered, in two groups: can play (Voy first, then by media) · can't. */
export function benchGroups(P: PzApi, v: PzVer | null): { all: string[]; can: string[]; cant: string[] } {
  const S = P.state;
  const B = S.bench;
  const q = fold(B.q || "").trim();
  const onField = P.sel.placed(v);
  const all = [...S.W.squad.map((x) => x.id), ...S.W.guests.map((g) => g.id)].filter((id) => !onField.includes(id));
  const filtered = all.filter((id) => {
    const pl = P.sel.player(id);
    if (!pl) return false;
    const r = P.sel.rsvp(id);
    if (B.line !== "todos" && pl.line !== B.line) return false;
    if (B.van && !(r.v === "yes" || r.v === "guest")) return false;
    if (q && !fold(`${pl.shirt} ${pl.num ?? ""} ${pl.first} ${pl.last}`).includes(q)) return false;
    return true;
  });
  const g = (id: string) => P.sel.player(id)?.global ?? 0;
  const can = filtered.filter((id) => P.sel.rsvp(id).can).sort((a, c) => (ORDER[P.sel.rsvp(a).v] ?? 3) - (ORDER[P.sel.rsvp(c).v] ?? 3) || g(c) - g(a));
  const cant = filtered.filter((id) => !P.sel.rsvp(id).can);
  return { all, can, cant };
}

export interface CountChip {
  t: string;
  n: number | null;
  tone: Tone;
  icon: string;
}
/** The convocatoria's answers as chips («9 van · 2 dudan · 2 no · 3 sin responder · 1 invitado»). */
export function countChips(P: PzApi): CountChip[] {
  const C = P.sel.counts();
  if (!Object.keys(P.state.W.rsvp).length && !C.baja) return [{ t: "Nadie ha respondido aún", n: null, tone: "mute", icon: "dots" }];
  const out: CountChip[] = [
    { t: "van", n: C.yes, tone: "ok", icon: "check" },
    { t: C.maybe === 1 ? "duda" : "dudan", n: C.maybe, tone: "warn", icon: "help" },
    { t: "no", n: C.no + C.baja, tone: "bad", icon: "close" },
    { t: "sin responder", n: C.none, tone: "mute", icon: "dots" },
  ].filter((c) => (c.n ?? 0) > 0 || c.t === "van") as CountChip[];
  if (C.guests) out.push({ t: C.guests === 1 ? "invitado" : "invitados", n: C.guests, tone: "guest", icon: "user" });
  return out;
}

/** Who «Avisar a los que dudan» calls: the squad that doubts or hasn't answered (never an absence or a baja). */
export function dudosos(P: PzApi): string[] {
  return P.state.W.squad.filter((x) => {
    const r = P.sel.rsvp(x.id);
    return r.v === "maybe" || r.v === "none";
  }).map((x) => x.id);
}
/** The message for the team's group. */
export function avisoText(P: PzApi): string {
  const M = P.sel.match();
  const who = dudosos(P).map((id) => P.sel.name(id));
  return (M ? (M.j ? "J" + M.j + " · " : "") + M.rival + ": " : "") + fmt.list(who) + ", ¿venís? Contestad en el vestuario.";
}

/** «El titular es el que se publica; la otra versión va con él.» / «En el descanso: entra KEVIN…». */
export function verLine(P: PzApi, b: PzBoard | null, v: PzVer | null): string {
  if (!b) return "";
  const S = P.state;
  if (S.version === "titular") {
    const n = (b.lineup.variants ?? []).length;
    return n ? "El titular es el que se publica; " + (n === 1 ? "la otra versión va" : "las otras dos van") + " con él." : "El titular es el que se publica. Crea una 2ª parte o un Plan B si los necesitas.";
  }
  const d = P.sel.diff(v, P.sel.ver(b, "titular"));
  return (S.version === "segunda" ? "En el descanso: " : "Si hace falta: ") + (d ? d.text.charAt(0).toLowerCase() + d.text.slice(1) : "") + ".";
}

export interface GalRow {
  k: string;
  t: string;
  who: string;
  holder: string | null;
  aria: string;
}
/** Galones y lanzadores: the holder of each (a taker: the first of his list on the pitch › the next one). */
export function galRows(P: PzApi, b: PzBoard | null, v: PzVer | null, ro: boolean): GalRow[] {
  const placed = P.sel.placed(v);
  return GALONES.map((g) => {
    let holder: string | null = null;
    let extra = "";
    if (b && v) {
      if ("taker" in g) {
        holder = P.sel.taker(b, v, g.taker) ?? null;
        const next = (b.lineup.takers?.[g.taker] ?? []).filter((x) => x !== holder && placed.includes(x));
        extra = next.length ? " › " + P.sel.name(next[0]) : "";
      } else {
        const h = b.lineup.roles[g.role];
        holder = h && placed.includes(h) ? h : null;
      }
    }
    const who = holder ? P.sel.name(holder) + extra : "Sin asignar";
    return { k: g.k, t: g.t, who, holder, aria: g.t + ": " + who + (ro ? "" : ". Cambiar") };
  });
}

/** How many of the seven sit in their place in a system's spots (by slot order, as the glide keeps them). */
export function fitIn(P: PzApi, v: PzVer | null, f: FormationName): boolean[] {
  const spots = systemDef(f).spots;
  return spots.map((sp, i) => {
    const id = v?.slots[i]?.playerId;
    return !!(id && (P.sel.fit(id, sp[0]) ?? 0) >= 2);
  });
}
export interface SysTile {
  id: FormationName;
  name: string;
  n: number;
  on: boolean;
  dots: { x: number; y: number; in: boolean }[];
}
export function sysTiles(P: PzApi, v: PzVer | null): SysTile[] {
  return SYSTEMS_CATALOGUE.map((s) => {
    const inP = fitIn(P, v, s.id);
    return { id: s.id, name: s.name, n: inP.filter(Boolean).length, on: !!v && v.formation === s.id && !v.freeMode, dots: s.spots.map((sp, i) => ({ x: sp[1], y: sp[2], in: inP[i] })) };
  });
}
export const sysDots = (f: FormationName) => systemDef(f).spots.map((sp) => ({ x: sp[1], y: sp[2], in: false }));

/** act.publishCheck without being an action (an action bumps the store: never during a render). Same rules: the
 *  TITULAR is what is published (B-PZ-02). */
export function publishCheck(P: PzApi): PublishCheck {
  const b = P.sel.board();
  const M = P.sel.match();
  const t = b ? P.sel.ver(b, "titular") : null;
  const st = P.sel.status(t);
  const block = !b ? "Abre uno de tus tableros para publicarlo." : !st.gk ? "Pon un portero en la portería del titular para publicarlo." : st.n < 7 ? `Completa el titular para publicarlo (${st.n}/7).` : "";
  const started = !!M && (M.phase === "juego" || M.phase === "descanso" || M.phase === "jugado");
  return { block, warns: st.warns, st, M, started, versions: b ? VERS.filter((x) => verOf(b.lineup, x.id).exists).map((x) => x.t) : [] };
}

/** What publishing does, in words (the titular, the notice, the official). */
export function conseq(P: PzApi): { icon: string; t: string; s: string }[] {
  const pub = publishCheck(P);
  const b = P.sel.board();
  const off = P.sel.official();
  const M = pub.M;
  const J = M?.j ? "J" + M.j : "";
  const vs = pub.versions;
  const me = P.sel.me();
  const team = P.state.W.squad.filter((p) => p.id !== me.pid).length;
  return [
    { icon: "shirt", t: "Se publica el titular" + (vs.length > 1 ? ", con " + fmt.list(vs.slice(1)) : ""), s: "Es lo que ve el equipo en la pizarra y en la página del partido." },
    pub.started
      ? { icon: "bell", t: "Sin aviso: el partido ya ha empezado", s: "«Ya está el siete» no sale para un partido empezado o jugado." }
      : { icon: "bell", t: (team ? fmt.plural(team, "compañero recibe", "compañeros reciben") : "El equipo recibe") + " «Ya está el siete»", s: "Un aviso en el móvil de cada uno, con el siete y la hora." },
    {
      icon: "users",
      t: b?.isOfficial ? "Ya es el oficial: el equipo ve el cambio" : off && off.id !== b?.id ? "Sustituye al oficial de ahora" : J ? "Pasa a ser el oficial de la " + J : "Pasa a ser el siete oficial",
      s: b?.isOfficial ? "Las opiniones empiezan de cero si cambia quién juega." : off && off.id !== b?.id ? "«" + off.name + "» deja de ser el oficial." : "Los demás lo ven en solo lectura y pueden opinar.",
    },
  ];
}

/** The kicker over the headline: «J3 · Red Demons · dom 8 nov · Titular». */
export function kicker(P: PzApi): string {
  const M = P.sel.match();
  const v = P.sel.ver();
  const head = M ? (M.j ? "J" + M.j + " · " : "") + M.rival + " · " + fmt.day(M.at) : P.state.W.season.name;
  return head + (v ? " · " + v.t : "");
}

/** The rsvp line of a ficha (the convocatoria section). */
export function convLine(P: PzApi, r: PzRsvp): string {
  if (r.v === "guest") return r.why;
  if (r.v === "yes") return "Va" + (r.at ? " · lo dijo " + fmt.ago(r.at, P.state.W.now) : "");
  if (r.v === "maybe") return "Duda" + (r.why ? ": «" + r.why + "»" : "");
  if (r.v === "none") return Object.keys(P.state.W.rsvp).length ? "No ha respondido todavía" : "Nadie ha respondido aún a esta convocatoria";
  if (r.v === "no") return "No va" + (r.why ? ": «" + r.why + "»" : "");
  return r.why || r.t;
}

/** The ficha card's metal (Tú's tiers). */
export function tierCls(p: PzPlayer): string {
  if (p.guest) return "is-inv";
  if (p.type === "Oro" || p.type === "En racha") return "is-oro";
  if (p.type === "Plata") return "is-plata";
  return "";
}

/** Where on an F7 mini map each puesto sits (x, y in %; our goal at the bottom). */
export const POS_XY: Record<string, [number, number]> = { POR: [50, 92], DFC: [50, 72], LIB: [50, 80], LI: [16, 68], LD: [84, 68], MCD: [50, 58], MC: [50, 46], MI: [18, 44], MD: [82, 44], MCO: [50, 32], EI: [18, 20], ED: [82, 20], DC: [50, 12] };
