// r14 «La pizarra» · Pachanga over the store: its slice (`pg`, undoable: who came, teams, pairs, keepers…), the
// player «en la mano» (`pg-hand`, not undoable), the actions with their toasts and announcements (PiPachanga's
// PZ.act.pg*), what the pitch shows, and the training's answers as the starting «¿Quién ha venido?».
import type { PzApi, PzSlice } from "../../store/api";
import type { Layout, StageLabel, StageSpec, Token } from "../../store/types";
import { lessMotion, sonar } from "../../sheets/ajustes/prefsLive";
import * as V from "./pachangaView";
import { fmt } from "../../store/fmt";
import { readLocalPg } from "./pgSource";
import type { PgN, PgState, PgWho, WhoFn } from "./pachangaView";

export const pgSlice = (P: PzApi): PzSlice<PgState> => P.slice<PgState>("pg", () => readLocalPg() ?? V.emptyPg());
export const handSlice = (P: PzApi): PzSlice<{ id: string | null }> => P.slice<{ id: string | null }>("pg-hand", { id: null });
export const handOf = (P: PzApi): string | null => handSlice(P).get()?.id ?? null;
const setHand = (P: PzApi, id: string | null) => handSlice(P).set({ id }, { undoable: false, toast: false });

/** A person as the pachanga reads him: a squad player or a match guest (the store), else a guest of the training. */
export function whoOf(P: PzApi, st: Pick<PgState, "guests">): WhoFn {
  return (id: string): PgWho => {
    const p = P.sel.player(id);
    if (p) return { id, shirt: p.shirt, num: p.guest ? null : p.num, line: p.line, global: p.guest ? null : p.global, guest: !!p.guest, mine: false };
    const g = st.guests.find((x) => x.id === id);
    if (g) return { id, shirt: g.name.toLocaleUpperCase("es-ES"), num: null, line: null, global: null, guest: true, mine: g.mine };
    return { id, shirt: id.replace(/^g:/, "").toLocaleUpperCase("es-ES"), num: null, line: null, global: null, guest: true, mine: false };
  };
}

/** One change of the pachanga: undoable, toasted with «Deshacer», the hand let go. */
function change(P: PzApi, label: string, f: (who: WhoFn, s: PgState) => PgState, o: { toast?: boolean } = {}) {
  const sl = pgSlice(P);
  if (handOf(P)) setHand(P, null);
  sl.set((s) => f(whoOf(P, s), s), { label, ...(o.toast === false ? { toast: false } : {}) });
}

export const pg = {
  mezclar(P: PzApi) {
    const st = pgSlice(P).get();
    const need = 2 * st.n;
    if (st.comes.length < need) {
      P.toast(`Marca al menos ${need} para hacer ${st.n} equipos`, { icon: "warn" });
      return;
    }
    change(P, "Equipos mezclados", V.mezclar);
    const s2 = pgSlice(P).get();
    const stats = V.teamStats(whoOf(P, s2), s2);
    const dd = V.spreadOf(stats);
    P.say("Equipos hechos: " + stats.map((x) => x.n).join(" contra ") + ", " + (dd ? fmt.plural(dd, "punto", "puntos") + " de media entre ellos" : "la misma media"));
    sonar(P, "mezcla");
  },
  tick(P: PzApi, id: string) {
    const st = pgSlice(P).get();
    const nm = whoOf(P, st)(id).shirt;
    change(P, st.comes.includes(id) ? `${nm} no ha venido` : `${nm} ha venido`, (w, s) => V.tick(w, s, id));
  },
  quick(P: PzApi, k: "entreno" | "partido" | "todos" | "nadie", ids: string[]) {
    const lbl = { entreno: "Los del entreno", partido: "Los que van al partido", todos: "Todos marcados", nadie: "Nadie marcado" }[k];
    change(P, k === "nadie" ? lbl : `${lbl} · ${ids.length}`, (w, s) => V.setComes(w, s, ids, k));
  },
  swap(P: PzApi, a: string, b: string) {
    const st = pgSlice(P).get();
    const w = whoOf(P, st);
    change(P, `Cambio: ${w(a).shirt} por ${w(b).shirt}`, (ww, s) => V.swap(ww, s, a, b));
  },
  move(P: PzApi, id: string, to: number) {
    const st = pgSlice(P).get();
    change(P, `${whoOf(P, st)(id).shirt} a ${V.PG_NAMES[st.n][to]}`, (w, s) => V.move(w, s, id, to));
  },
  lock(P: PzApi, id: string) {
    const st = pgSlice(P).get();
    const nm = whoOf(P, st)(id).shirt;
    const t = st.teams.findIndex((x) => x.includes(id));
    const was = st.locked[id] != null;
    // the hand stays: the bar says «Quitar fijo» now
    pgSlice(P).set((s) => V.toggleLock(s, id), { label: was ? `${nm} ya no es fijo` : `${nm} fijo en ${V.PG_NAMES[st.n][t] ?? "su equipo"}` });
  },
  setN(P: PzApi, n: PgN) {
    if (pgSlice(P).get().n === n) return;
    change(P, `${n} equipos`, (w, s) => V.setN(w, s, n));
  },
  setGk(P: PzApi, mode: "turnos" | "fijos") {
    if (pgSlice(P).get().gk === mode) return;
    change(P, mode === "fijos" ? "Porteros fijos" : "Portería por turnos", (w, s) => V.setGk(w, s, mode));
  },
  keeper(P: PzApi, t: number, id: string) {
    const st = pgSlice(P).get();
    change(P, `${whoOf(P, st)(id).shirt}, portero de ${V.PG_NAMES[st.n][t]}`, (_, s) => V.setKeeper(s, t, id));
  },
  nextGk(P: PzApi) {
    change(P, "Cambio de portero", (_, s) => ({ ...s, turn: (s.turn || 0) + 1 }));
    const s2 = pgSlice(P).get();
    const w = whoOf(P, s2);
    P.say("A la portería: " + fmt.list(s2.teams.map((_, i) => w(V.keeperOf(w, s2, i) ?? "").shirt)));
    sonar(P, "clac");
  },
  rotate(P: PzApi) {
    const st = pgSlice(P).get();
    if (st.n !== 3) return;
    const wait = V.waiting(st);
    change(P, `Entra ${V.PG_NAMES[3][wait]}, descansa ${V.PG_NAMES[3][st.playing[0]]}`, (_, s) => V.rotate(s));
  },
  pair(P: PzApi, a: string, b: string, kind: V.PairKind) {
    const st = pgSlice(P).get();
    if (st.pairs.length >= V.PAIRS_MAX && !st.pairs.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))) {
      P.toast(`Como mucho ${V.PAIRS_MAX} parejas`, { icon: "warn" });
      return;
    }
    const w = whoOf(P, st);
    change(P, `${w(a).shirt} y ${w(b).shirt} ${kind}`, (ww, s) => V.addPair(ww, s, a, b, kind));
  },
  unpair(P: PzApi, i: number) {
    const st = pgSlice(P).get();
    const p = st.pairs[i];
    if (!p) return;
    const w = whoOf(P, st);
    change(P, `Quitada: ${w(p.a).shirt} y ${w(p.b).shirt}`, (ww, s) => V.removePair(ww, s, i));
  },
  guest(P: PzApi, name: string) {
    const t = name.trim();
    if (!t) return;
    change(P, `${t.toLocaleUpperCase("es-ES")} se apunta (de fuera)`, (w, s) => V.addGuest(w, s, t));
  },
  fmt(P: PzApi, f: PgState["fmt"]) {
    pgSlice(P).set({ fmt: f }, { undoable: false, toast: false });
  },
  /** Tap-tap, the same from the lists and from the pitch: pick up · let go · swap with one of the other team. */
  tap(P: PzApi, id: string) {
    const st = pgSlice(P).get();
    const tOf = (x: string) => st.teams.findIndex((t) => t.includes(x));
    if (tOf(id) < 0) return;
    const nm = whoOf(P, st)(id).shirt;
    const hand = handOf(P);
    if (hand === id) {
      setHand(P, null);
      P.say(nm + " suelto");
      return;
    }
    if (hand && tOf(hand) >= 0 && tOf(hand) !== tOf(id)) {
      pg.swap(P, hand, id);
      return;
    }
    setHand(P, id);
    P.say(nm + " en la mano: toca a uno del otro equipo y se cambian");
  },
  drop(P: PzApi) {
    if (!handOf(P)) return;
    setHand(P, null);
    P.say("Suelto");
  },
};

/** Who came, to start from, when the training's answers (or its saved attendance) arrive: once per training, never
 *  over what someone already marked by hand. Not undoable (it is the starting point, not a change). */
export function seedFromTraining(P: PzApi, o: { trainingId: string | null; present: string[]; guests: string[]; saved: boolean }) {
  const sl = pgSlice(P);
  const st = sl.get();
  if (st.seeded && st.trainingId === o.trainingId) return;
  if (st.seeded && st.src !== "entreno" && st.src !== "guardado" && st.trainingId === null && !o.trainingId) return;
  const guests = o.guests.map((name) => ({ id: V.guestId(name), name, mine: false }));
  sl.set(
    (s) => {
      const base: PgState = { ...s, trainingId: o.trainingId, seeded: true, guests: [...guests, ...s.guests.filter((g) => g.mine && !guests.some((x) => x.id === g.id))] };
      const ids = [...o.present.filter((id) => !!P.sel.player(id)), ...guests.map((g) => g.id)];
      if (!o.trainingId) return base;
      return V.setComes(whoOf(P, base), base, ids, o.saved ? "guardado" : "entreno");
    },
    { undoable: false, toast: false },
  );
}

/** What the pitch shows: both teams in their halves with their bibs (word + pattern), the team names once per half;
 *  before the teams, who came so far in a row. */
export function pgStage(P: PzApi, layout: Layout): StageSpec {
  const st = pgSlice(P).get();
  const w = whoOf(P, st);
  const hand = handOf(P);
  const tokens: Token[] = [];
  const labels: StageLabel[] = [];
  if (!V.ready(st)) {
    const shown = st.comes.slice(0, 8);
    shown.forEach((id, k) => {
      const known = !!P.sel.player(id);
      tokens.push({ id: "pg-" + id, kind: "us", ...(known ? { pid: id } : {}), x: ((k + 1) * 100) / (shown.length + 1), y: 50, label: w(id).shirt });
    });
    const need = 2 * st.n - st.comes.length;
    return { source: "pachanga", tokens, labels, tappable: false, overlay: null, caption: st.comes.length ? `Faltan ${need} para hacer ${st.n} equipos` : "Marca quién ha venido", glideMs: lessMotion(P) ? 0 : 600 };
  }
  const play = st.n === 3 ? st.playing : [0, 1];
  const stats = V.teamStats(w, st);
  play.forEach((t, side) => {
    const top = side === 0;
    const order = V.orderTeam(w, st, t);
    const pts = V.spots(order.length, top);
    const pat = V.PG_PATS[st.n][t];
    const kind = pat === "liso" ? "sinpetos" : "petos";
    order.forEach((id, k) => {
      const known = !!P.sel.player(id);
      tokens.push({ id: "pg-" + id, kind, ...(known ? { pid: id } : {}), x: pts[k]?.[0] ?? 50, y: pts[k]?.[1] ?? 50, label: w(id).shirt, pat, bib: V.PG_NAMES[st.n][t], on: hand === id });
    });
    labels.push({ x: 3, y: top ? 2.6 : 97.4, t: V.PG_NAMES[st.n][t] + (layout === "phone" ? "" : " · " + stats[t].media), align: "left", pat });
  });
  return { source: "pachanga", tokens, labels, tappable: true, overlay: null, caption: "", glideMs: lessMotion(P) ? 0 : 650 };
}

/** The places bar's sublabel. */
export function pgSub(P: PzApi): string {
  const st = pgSlice(P).get();
  if (!st || !st.seeded) return st?.comes.length ? fmt.plural(st.comes.length, "ha venido", "han venido") : "Entreno";
  if (V.ready(st)) return st.teams.map((t) => t.length).join(" contra ");
  return st.comes.length ? fmt.plural(st.comes.length, "ha venido", "han venido") : "Sin equipos";
}
