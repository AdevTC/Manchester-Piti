// r14 «La pizarra» · Pachanga: what the regions and sheets show, computed from the store (PiPachanga's renderVals).
import type { PzApi } from "../../store/api";
import type { Layout } from "../../store/types";
import { fmt } from "../../store/fmt";
import * as V from "./pachangaView";
import { handOf, pgSlice, whoOf } from "./pgStore";
import { dayWord, isoDay, isoShort, srcOf, type PgSource } from "./pgSource";

export interface PgRow {
  id: string;
  k: number;
  pat: V.PgPat;
  name: string;
  sub: string;
  media: string;
  noNota: boolean;
  locked: boolean;
  on: boolean;
  target: boolean;
  aria: string;
}
export interface PgTeamView {
  t: number;
  name: string;
  short: string;
  pat: V.PgPat;
  media: number;
  n: number;
  sub: string;
  wait: boolean;
  rows: PgRow[];
}
export interface PgAtt {
  id: string;
  name: string;
  sub: string;
  on: boolean;
  out: boolean;
  media: string;
  k: string;
  aria: string;
}
export interface PgQuick {
  id: "entreno" | "partido" | "todos" | "nadie";
  t: string;
  n: number | null;
  ids: string[];
  on: boolean;
}

/** When the training is (its confirmed slot), else now. */
export const pgAt = (P: PzApi, src: PgSource): number => src.at ?? P.state.W.now;

/** Who cannot come that day (an absence or a baja that covers it). */
export function outOn(P: PzApi, id: string, at: number): { t: string; until: string | null; why: string } | null {
  const day = isoDay(at);
  const a = (P.state.W.absences ?? []).find((x) => x.pid === id && x.from <= day && x.to >= day);
  if (a) return { t: "Ausente", until: a.to, why: a.note };
  const p = P.sel.player(id);
  if (p?.baja) return { t: p.baja, until: null, why: "" };
  return null;
}

export function pgModel(P: PzApi, layout: Layout) {
  const st = pgSlice(P).get();
  const src = srcOf(P);
  const who = whoOf(P, st);
  const W = P.state.W;
  const n = st.n;
  const names = V.PG_NAMES[n];
  const pats = V.PG_PATS[n];
  const at = pgAt(P, src);
  const isReady = V.ready(st);
  const stats = isReady ? V.teamStats(who, st) : names.map(() => ({ n: 0, mean: 0, media: 0 }));
  const med = V.medianOf(who, st.comes);
  const spread = isReady ? V.spreadOf(stats) : 0;
  const sizes = stats.map((x) => x.n);
  const vs = sizes.join(n === 2 ? " contra " : " · ");
  const wait = V.waiting(st);
  const bal = V.balanceWord(spread);
  const hand = handOf(P);
  const handTeam = hand ? st.teams.findIndex((t) => t.includes(hand)) : -1;
  const handNow = handTeam >= 0 ? hand : null;

  let head: string;
  let line: string;
  if (!st.comes.length) {
    head = "¿Quién ha venido?";
    line = `Marca a los que están: con ${2 * n} ya hay ${n} equipos.`;
  } else if (!isReady) {
    head = "Faltan jugadores";
    line = `Llevas ${st.comes.length}: hacen falta al menos ${2 * n} para ${n} equipos.`;
  } else {
    head = bal.head;
    const uneven = Math.max(...sizes) !== Math.min(...sizes);
    line = `${vs} · ${spread === 0 ? "la misma media" : fmt.plural(spread, "punto", "puntos") + " de media entre ellos"}${spread > 3 ? ". Mezcla o cambia a alguien." : uneven ? ". Uno más: que rote." : "."}`;
  }
  const kicker = src.trainingId && src.at ? `Pachanga · ${dayWord(P, at)} · ${fmt.hm(at)}${src.place ? " · " + src.place : ""}` : "Pachanga · sin entreno confirmado";
  const d01 = isReady && n === 2 ? stats[1].media - stats[0].media : 0;
  const balPos = Math.round(50 + Math.max(-44, Math.min(44, d01 * 7)));
  const balAria = isReady ? "Media de " + names.map((nm, i) => `${nm} ${stats[i].media}`).join(", ") + ". " + bal.word : "Sin equipos todavía";

  const teams: PgTeamView[] = names.map((nm, t) => {
    const order = isReady ? V.orderTeam(who, st, t) : [];
    const kp = isReady ? V.keeperOf(who, st, t) : null;
    const rows = order.map((id, k): PgRow => {
      const pl = who(id);
      const locked = st.locked[id] != null;
      const isK = id === kp;
      const sub = [isK ? (st.gk === "fijos" ? "Portero" : "Portería ahora") : pl.guest ? (pl.mine ? "De fuera" : "Invitado") : V.LSHORT[pl.line ?? ""] || "", locked ? "fijo" : ""].filter(Boolean).join(" · ");
      const on = handNow === id;
      const target = !!handNow && handTeam !== t;
      const aria = `${pl.shirt}, ${nm}, ${pl.global == null ? "sin nota, cuenta como " + med : "media " + pl.global}${isK ? ", en la portería" : ""}${locked ? ", fijo en este equipo" : ""}. ${on ? "En la mano: toca para soltarlo" : target ? "Toca para cambiarlo por " + who(handNow).shirt : "Toca para cogerlo"}`;
      return { id, k, pat: pats[t], name: pl.shirt, sub, media: String(pl.global ?? med), noNota: pl.global == null, locked, on, target, aria };
    });
    const s = stats[t] ?? { n: 0, media: 0 };
    return { t, name: nm, short: V.PG_SHORT[n][t], pat: pats[t], media: s.media, n: s.n, sub: (t === wait ? "Esperan · " : "") + fmt.plural(s.n, "jugador", "jugadores") + " · media " + s.media, wait: t === wait, rows };
  });
  const ordered = n === 3 ? [...st.playing.map((t) => teams[t]), teams[wait]] : teams;
  const noNota = st.comes.filter((id) => who(id).global == null).map((id) => who(id).shirt);
  const medNote = noNota.length ? fmt.list(noNota) + (noNota.length === 1 ? " no tiene nota: cuenta como " : " no tienen nota: cuentan como ") + med + ", la mediana de los que han venido." : "Las medias son la GLOBAL de cada uno, la de su carta.";

  // who came: the squad, the match's guests, the training's and this pachanga's people from outside
  const ids = [...W.squad.map((x) => x.id), ...W.guests.map((g) => g.id), ...st.guests.map((g) => g.id)].filter((id, i, a) => a.indexOf(id) === i);
  const att: PgAtt[] = ids.map((id) => {
    const pl = who(id);
    const on = st.comes.includes(id);
    const out = pl.guest ? null : outOn(P, id, at);
    const sub = out ? out.t + (out.until ? " · hasta el " + isoShort(out.until) : "") : pl.guest ? (pl.mine ? "De fuera · sin nota" : "Invitado · sin nota") : (V.LSHORT[pl.line ?? ""] || "Sin posición") + (pl.num != null ? " · " + pl.num : "");
    const band = P.sel.band(pl.global);
    return { id, name: pl.shirt, sub, on, out: !!out, media: pl.global == null ? "—" : String(pl.global), k: pl.global == null ? "sin nota" : band.t, aria: `${pl.shirt}. ${sub}${out?.why ? " (" + out.why + ")" : ""}. ${on ? "Ha venido" : "No ha venido"}. Toca para cambiarlo` };
  });
  // a stable order (a row never jumps under the finger): the ones who can come, then the out
  att.sort((a, b) => Number(a.out) - Number(b.out));
  const M = P.sel.match();
  const yesMatch = W.squad.filter((x) => P.sel.rsvp(x.id).v === "yes").map((x) => x.id);
  const todos = ids.filter((id) => !outOn(P, id, at));
  const same = (a: string[]) => a.length === st.comes.length && a.every((x) => st.comes.includes(x));
  const trainingIds = src.trainingId ? [...src.present.filter((id) => !!P.sel.player(id)), ...src.guests.map((g) => V.guestId(g))] : [];
  const quick: PgQuick[] = [];
  if (src.trainingId) quick.push({ id: "entreno", t: "Del entreno", n: trainingIds.length, ids: trainingIds, on: false });
  else if (yesMatch.length && M) quick.push({ id: "partido", t: "Van a la J" + (M.j ?? ""), n: yesMatch.length, ids: yesMatch, on: false });
  quick.push({ id: "todos", t: "Todos", n: todos.length, ids: todos, on: false }, { id: "nadie", t: "Nadie", n: null, ids: [], on: false });
  quick.forEach((q) => (q.on = q.id === "nadie" ? !st.comes.length : same(q.ids) && q.ids.length > 0));
  const srcLine = src.trainingId
    ? st.src === "guardado"
      ? `Los que vinieron al entreno de ${dayWord(P, at)}, guardados.`
      : st.src === "entreno"
        ? `Los que dijeron «voy» al entreno de ${dayWord(P, at)}.`
        : "Cambiado a mano sobre las respuestas del entreno."
    : src.loading
      ? "Leyendo las respuestas del entreno…"
      : quick[0]?.id === "partido" && M
        ? `Sin entreno confirmado: marca a mano o parte de los que van a la J${M.j ?? ""} del ${fmt.day(M.at)}.`
        : "Sin entreno confirmado: marca a mano a los que han venido.";

  const pairs = st.pairs.map((pr, i) => ({ i, t: `${who(pr.a).shirt} y ${who(pr.b).shirt}`, s: pr.kind === "juntos" ? "Juntos, en el mismo equipo" : "Separados, uno en cada equipo", icon: pr.kind === "juntos" ? "link" : "cross", delAria: `Quitar la pareja ${who(pr.a).shirt} y ${who(pr.b).shirt}` }));
  const gkRows = isReady
    ? names.map((nm, t) => {
        const k = V.keeperOf(who, st, t);
        const kn = k ? who(k).shirt : "—";
        if (st.gk === "fijos") return { t, pat: pats[t], title: `${nm}: ${kn}`, s: "Fijo · toca para cambiarlo", aria: `Portero de ${nm}: ${kn}. Cambiar`, fijos: true };
        const order = V.gkOrder(who, st, t);
        const i = k ? order.indexOf(k) : 0;
        const next = [...order.slice(i + 1), ...order.slice(0, i)].slice(0, 3).map((id) => who(id).shirt);
        return { t, pat: pats[t], title: `${nm}: ${kn}`, s: next.length ? "Después " + fmt.list(next) : "Siempre él", aria: `${nm}, en la portería ${kn}${next.length ? ", después " + fmt.list(next) : ""}. Toca para el siguiente`, fijos: false };
      })
    : [];
  const peekLine = isReady ? `${vs} · ${stats.map((x) => x.media).join(" a ")}` : line;
  return { st, src, who, n, names, pats, at, isReady, stats, med, spread, bal, balPos, balAria, head, line, kicker, teams, ordered, wait, hand: handNow, handTeam, medNote, att, quick, srcLine, pairs, gkRows, peekLine, phone: layout === "phone" };
}
export type PgModel = ReturnType<typeof pgModel>;
