// r14 «La pizarra» · Partido: the words and numbers each region shows (the prototype's PiPartido `renderVals`, on the
// model). Pure: the component attaches the handlers.
import type { PzApi } from "../../store/api";
import { fmt } from "../../store/fmt";
import type { Mark } from "../../store/types";
import { condSentence, descPairs, mesaState, plannedOf, playedOf, slotOf, total, type Interval, type PtModel } from "./partidoView";

export interface Seg {
  cls: "g" | "s" | "p";
  l: number;
  w: number;
}
export const segsOf = (iv: Interval[] | undefined, cls: Seg["cls"], D: number): Seg[] => (iv ?? []).map((x) => ({ cls, l: Math.round((x.from / D) * 1000) / 10, w: Math.max(1.4, Math.round(((x.to - x.from) / D) * 1000) / 10) }));

const CANWORD: Record<Mark["k"], string> = { amarilla: "Amarilla", tocado: "Tocado", gol: "Gol", roja: "Roja" };
const PART: Record<string, string> = { first: "1ª parte", second: "2ª parte", halftime: "Descanso", ended: "Final" };

export function kickerOf(P: PzApi, X: PtModel): string {
  const M = X.M;
  if (!M) return "";
  const J = M.j ? "J" + M.j : "";
  const now = P.state.W.now;
  const today = X.ph === "antes" && M.at > now && M.at - now < 12 * 3600000 && fmt.day(M.at) === fmt.day(now);
  return [J, M.rival, today ? "Hoy" : fmt.day(M.at), M.venue].filter(Boolean).join(" · ");
}

export function stepsOf(X: PtModel) {
  const order = ["antes", "juego", "descanso", "despues"];
  const cur = order.indexOf(X.ph);
  const M = X.M;
  const stepT: Record<string, string> = {
    antes: M ? "Pitido " + fmt.hm(M.at) : "",
    juego: X.ph === "juego" ? "Ahora · " + X.now + "′" : "1ª y 2ª parte",
    descanso: X.HALF + "′",
    despues: X.ph === "despues" && X.L ? "Final · " + X.L.gf + "–" + X.L.ga : "Las notas",
  };
  return [
    ["antes", "Antes", "cal"],
    ["juego", "En juego", "whistle"],
    ["descanso", "Descanso", "clock"],
    ["despues", "Después", "flag"],
  ].map(([id, t, icon], i) => ({ id, t, s: i < cur && id !== "antes" ? "Hecho" : stepT[id], icon: i < cur ? "check" : icon, cls: i < cur ? "is-done" : i === cur ? "is-cur" : "", cur: i === cur }));
}

export function antesOf(P: PzApi, X: PtModel) {
  const M = X.M!;
  const J = M.j ? "J" + M.j : "partido";
  const d = M.at - P.state.W.now;
  const min = Math.round(d / 60000);
  const head =
    d <= 0 ? "A punto de empezar" : min < 60 ? "Faltan " + min + " min" : min < 12 * 60 ? "Faltan " + Math.floor(min / 60) + " h" + (min % 60 ? " " + (min % 60) + " min" : "") : Math.round(d / 86400000) <= 1 ? "Mañana a las " + fmt.hm(M.at) : "Faltan " + Math.round(d / 86400000) + " días";
  const line = "Pitido a las " + fmt.hm(M.at) + (M.venue ? " en " + M.venue : "") + (M.home == null ? "" : M.home ? ", en casa" : ", fuera") + "." + (X.st.full ? "" : X.b && X.st.n ? " El siete aún no está completo." : " Aún no hay siete.");
  const stats: { v: string; k: string; w: string }[] = [];
  const Q = X.feed.quedada;
  if (Q) stats.push({ v: fmt.hm(Q.at), k: "Quedada", w: Q.where });
  const W = X.feed.weather;
  if (W) stats.push({ v: W.t + "°", k: "Tiempo", w: W.sky + (W.rain ? " · " + W.rain + "% lluvia" : "") });
  const C = P.sel.counts();
  const anyAns = Object.keys(P.state.W.rsvp).length > 0;
  stats.push(anyAns ? { v: String(C.yes + C.guests), k: "Van", w: C.maybe ? fmt.plural(C.maybe, "duda", "dudan") : "Nadie duda" } : { v: "—", k: "Van", w: "Nadie ha respondido" });
  // la mesa (A-PAR-03: always there with a match; A-PAR-11: the button says what it sends)
  const ms = mesaState(X);
  const MS: Record<string, [string, string, string, string]> = {
    sin: ["Sin siete", "is-warn", "warn", "La mesa aún no tiene el siete. Al mandarlo, la mesa y la página del partido enseñan este."],
    otro: ["Otro siete", "is-warn", "swap", "La mesa tiene otro siete. Al mandarlo, pasa a este."],
    aldia: ["Al día", "is-ok", "check", "La mesa tiene este siete" + (X.feed.lineup?.setAt ? " desde las " + fmt.hm(X.feed.lineup.setAt) : "") + ". Hasta el pitido puedes volver a mandarlo."],
  };
  const m = MS[ms] ?? ["—", "", "dots", ""];
  const block = !X.b || !X.st.n ? "Aún no hay siete para la " + J + ": primero hazlo en Siete." : !X.st.full ? "El siete tiene que estar completo: " + (X.st.missing.length === 1 ? "falta un " + X.st.missing[0] : "faltan " + (7 - X.st.n)) + "." : "";
  const mesa = {
    t: m[0],
    cls: m[1],
    icon: m[2],
    line: block || m[3],
    can: X.decide && !!X.b && !X.ro,
    off: !!block || X.ui.busy,
    btn: P.state.estado === "offline" ? "Mandar al volver la señal" : ms === "aldia" ? "Volver a mandar" : "Mandar a la mesa",
    ro: !X.decide,
    roT: "Lo mandan los capitanes y quien anota la " + J + ".",
    open: ms === "aldia" && X.decide,
    scorer: X.feed.mesaName ? "Anota la " + J + ": " + X.feed.mesaName + ". Puede mandar el siete y apuntar los cambios." : "",
  };
  // the answers with names (H-PZ-09, H-PZ-10)
  const by: Record<"yes" | "maybe" | "no" | "none", { n: string; why: string }[]> = { yes: [], maybe: [], no: [], none: [] };
  P.state.W.squad.forEach((pl) => {
    const r = P.sel.rsvp(pl.id);
    if (r.v === "baja") return;
    const k = r.v === "yes" ? "yes" : r.v === "maybe" ? "maybe" : r.v === "none" ? "none" : "no";
    by[k].push({ n: pl.shirt, why: r.why || "" });
  });
  const rows: { n: string; t: string; cls: string; icon: string; names: string; note: string }[] = [];
  if (!anyAns) rows.push({ n: "0", t: "respuestas", cls: "is-mute", icon: "dots", names: "Nadie ha respondido aún: la convocatoria de la " + J + " se responde en el vestuario.", note: "" });
  else {
    rows.push({ n: String(by.yes.length), t: "van", cls: "is-ok", icon: "check", names: fmt.list(by.yes.map((x) => x.n)) || "Nadie todavía", note: "" });
    if (by.maybe.length) rows.push({ n: String(by.maybe.length), t: by.maybe.length === 1 ? "duda" : "dudan", cls: "is-warn", icon: "help", names: by.maybe.map((x) => x.n + (x.why ? " («" + x.why.toLowerCase() + "»)" : "")).join(" · "), note: "" });
    if (by.no.length) rows.push({ n: String(by.no.length), t: "no", cls: "is-bad", icon: "close", names: by.no.map((x) => x.n + (x.why ? " (" + x.why.toLowerCase() + ")" : "")).join(" · "), note: "" });
    if (by.none.length) rows.push({ n: String(by.none.length), t: "sin responder", cls: "is-mute", icon: "dots", names: fmt.list(by.none.map((x) => x.n)), note: "" });
  }
  P.state.W.guests.forEach((g) => rows.push({ n: "1", t: "invitado", cls: "is-guest", icon: "user", names: g.shirt + (g.by ? ", lo trae " + P.sel.name(g.by) : ""), note: g.note ?? "" }));
  const quedada: { icon: string; t: string; s: string }[] = [];
  if (Q) quedada.push({ icon: "pin", t: fmt.hm(Q.at) + " · " + Q.where, s: [M.venue, Q.note].filter(Boolean).join(" · ") });
  else if (X.feed.meetingNote) quedada.push({ icon: "pin", t: "La quedada", s: X.feed.meetingNote });
  if (W) quedada.push({ icon: "eye", t: W.t + "° · " + W.sky.toLowerCase() + " a las " + fmt.hm(M.at), s: W.rain ? W.rain + "% de lluvia" : "Sin lluvia" });
  return { head, line, stats, mesa, conv: { meta: anyAns ? "Respuestas a la convocatoria" : "", rows }, quedada };
}

export function scoreboardOf(P: PzApi, X: PtModel) {
  const M = X.M!;
  const L = X.L!;
  const us = M.home !== false;
  const st = L.gf > L.ga ? "Ganamos" : L.gf < L.ga ? "Perdemos" : "Empatamos";
  const stD = L.gf > L.ga ? "Ganamos" : L.gf < L.ga ? "Perdimos" : "Empatamos";
  const code = M.rival.replace(/[^A-Za-zÁÉÍÓÚÑ]/g, "").slice(0, 3).toUpperCase() || "RIV";
  const part = X.ph === "despues" ? "Final" : (PART[X.feed.clock ?? ""] ?? (X.ph === "descanso" ? "Descanso" : ""));
  const shown = X.ph === "juego" && X.feed.shown != null ? X.feed.shown : X.now;
  const min = X.ph === "despues" ? X.D + "′" : shown + "′";
  const sub = X.ph === "juego" ? (X.feed.paused ? "Pausado por la mesa" : X.L?.fallback ? "la mesa no tiene el siete: el campo es el oficial" : "el reloj lo lleva la mesa") : X.ph === "descanso" ? "el reloj, parado" : fmt.day(M.at);
  const nx = X.next;
  const line =
    X.ph === "juego"
      ? st + " " + L.gf + "–" + L.ga + " · " + (nx && nx.in ? (nx.urgent ? "cambio urgente" : "próximo cambio en el " + nx.min + "′") : "sin más cambios en el plan")
      : X.ph === "descanso"
        ? "Descanso · " + st.toLowerCase() + " " + L.gf + "–" + L.ga
        : stD + " " + L.gf + "–" + L.ga + " · " + fmt.plural(L.done.length, "cambio", "cambios");
  const aria = (X.ph === "despues" ? "Final" : shown + "′, " + part) + ": Manchester Piti " + L.gf + ", " + M.rival + " " + L.ga + ". " + (X.ph === "despues" ? stD : st);
  return { homeUs: us, l: String(us ? L.gf : L.ga), r: String(us ? L.ga : L.gf), min, part, sub, line, aria, code, rival: M.rival, st };
}

export interface EvRow {
  id: string;
  min: string;
  cls: string;
  kind: "svg" | "card" | "code" | "glyph";
  icon: string;
  t: string;
  s: string;
}
export function eventsOf(P: PzApi, X: PtModel, code: string): EvRow[] {
  const L = X.L;
  if (!L) return [];
  const N = (id?: string) => (id ? P.sel.name(id) : "—");
  const rows = L.events
    .map((e): EvRow | null => {
      const m = (e.minute ?? 0) + "′";
      const base = { id: e.id, min: m };
      switch (e.type) {
        case "goal":
        case "goal_penalty":
        case "goal_freekick":
          return { ...base, cls: "is-gol", kind: "svg", icon: "ball", t: (e.type === "goal_penalty" ? "Gol de penalti de " : e.type === "goal_freekick" ? "Gol de falta de " : "Gol de ") + N(e.playerId), s: e.assistPlayerId ? "Pase de " + N(e.assistPlayerId) : "Sin asistencia" };
        case "opponent_own_goal":
          return { ...base, cls: "is-gol", kind: "svg", icon: "ball", t: "Autogol de " + X.M!.rival, s: "Cuenta para el Piti" };
        case "opponent_goal":
          return { ...base, cls: "is-rival", kind: "code", icon: "", t: "Gol de " + X.M!.rival, s: "Rival · " + code };
        case "own_goal":
          return { ...base, cls: "is-rival", kind: "code", icon: "", t: "Gol en propia de " + N(e.playerId), s: "Cuenta para " + X.M!.rival };
        case "substitution":
          return { ...base, cls: "", kind: "svg", icon: "swap", t: "Entra " + N(e.inPlayerId) + " por " + N(e.playerId), s: X.tandas.some((t) => t.out === e.playerId && t.in === e.inPlayerId) ? "Como en el plan" : "Fuera del plan" };
        case "position_swap":
          return { ...base, cls: "", kind: "svg", icon: "move", t: N(e.playerId) + " y " + N(e.inPlayerId) + " cambian de sitio", s: "Lo apuntó la mesa" };
        case "yellow_card":
          return { ...base, cls: "is-amarilla", kind: "card", icon: "", t: "Amarilla a " + N(e.playerId), s: "Otra y se va" };
        case "double_yellow":
        case "red_card":
          return { ...base, cls: "is-roja", kind: "card", icon: "", t: (e.type === "double_yellow" ? "Segunda amarilla a " : "Roja a ") + N(e.playerId), s: "Jugamos con uno menos" };
        case "injury":
          return { ...base, cls: "is-tocado", kind: "glyph", icon: "+", t: N(e.playerId) + ", tocado", s: e.note || "Lo apuntó la mesa" };
        case "penalty_received":
          return { ...base, cls: "", kind: "svg", icon: "flag", t: "Penalti a favor", s: N(e.playerId) !== "—" ? "Lo provoca " + N(e.playerId) : "Lo apuntó la mesa" };
        case "penalty_missed":
        case "penalty_saved":
          return { ...base, cls: "", kind: "svg", icon: "close", t: (e.type === "penalty_saved" ? "Penalti parado por " : "Penalti fallado por ") + N(e.playerId), s: "" };
        default:
          return null;
      }
    })
    .filter((x): x is EvRow => !!x);
  return X.ph === "despues" ? rows : rows.reverse();
}

export function cantOf(P: PzApi, X: PtModel) {
  const L = X.L;
  if (!L) return { flags: [], chips: [] };
  const N = (id: string) => P.sel.name(id);
  const flags: { id: string; glyph: string; cls: string; min: string; t: string; s: string }[] = [];
  X.field.forEach((pid) =>
    (L.marks[pid] ?? []).forEach((m, k) => {
      if (m.k !== "tocado" && m.k !== "amarilla") return;
      flags.push({ id: pid + k, glyph: m.k === "amarilla" ? "" : "+", cls: m.k === "amarilla" ? "is-amarilla" : "is-tocado", min: m.short ?? "", t: m.k === "tocado" ? N(pid) + ", tocado" : "Amarilla a " + N(pid), s: m.k === "tocado" ? (X.decide ? "Lo apuntó la mesa · si no sigue, márcalo abajo" : "Lo apuntó la mesa") : "Otra y se va: en riesgo" });
    }),
  );
  const chips = [...X.field, ...X.present.filter((p) => !X.field.includes(p) && X.ui.cant[p])].map((pid) => {
    const on = !!X.ui.cant[pid];
    const mk = (L.marks[pid] ?? []).find((m) => m.k === "tocado" || m.k === "amarilla");
    return { pid, name: N(pid), on, w: on ? "No puede" : mk ? CANWORD[mk.k] + " " + (mk.short ?? "") : "Sigue", aria: N(pid) + (on ? ": no puede seguir. Toca si puede" : ": sigue. Toca si no puede seguir") };
  });
  return { flags, chips };
}

export function nextOf(P: PzApi, X: PtModel) {
  const n = X.next;
  const N = (id: string | null | undefined) => (id ? P.sel.name(id) : "—");
  if (!n || !n.in || !X.L) return null;
  const left = n.min - X.now;
  const prev = X.tandas.filter((t) => t.min < n.min).map((t) => t.min).pop() ?? 0;
  const urgentish = !!(n.urgent || n.cond || left <= 0);
  const frac = urgentish ? 1 : Math.max(0, Math.min(1, (X.now - prev) / Math.max(1, n.min - prev)));
  const outCode = slotOf(X, n.out);
  const fitIn = outCode ? P.sel.fit(n.in, outCode as Parameters<typeof P.sel.fit>[1]) : null;
  const outOk = X.field.includes(n.out);
  const inOk = X.bench.includes(n.in);
  const marks = X.L.marks[n.out] ?? [];
  return {
    kicker: n.urgent ? N(n.out) + " no puede seguir" : n.cond ? "El plan «Si pasa…» · ahora" : "Próximo cambio · " + n.min + "′",
    kCls: n.urgent ? "is-urgent" : "",
    kIcon: n.urgent ? "warn" : n.cond ? "flag" : "clock",
    t: "Entra " + N(n.in),
    s: "por " + N(n.out),
    off: Math.round(213.6 * (1 - frac) * 10) / 10,
    due: urgentish,
    cdK: urgentish ? "toca" : "en",
    cdV: urgentish ? "Ya" : left + "′",
    cdAria: urgentish ? "El cambio toca ya" : "Faltan " + left + " minutos para el cambio",
    in: n.in,
    out: n.out,
    inName: N(n.in),
    outName: N(n.out),
    inSub: (outCode ? outCode + " · " : "") + P.sel.fitWord(fitIn) + " · " + playedOf(X, n.in) + "′ hoy",
    outSub: (outCode ? outCode + " · " : "") + playedOf(X, n.out) + "′ hoy" + (marks.length ? " · " + marks.map((m) => m.t.toLowerCase()).join(", ") : ""),
    ok: outOk && inOk,
    chk: outOk && inOk ? N(n.out) + " está en el campo y " + N(n.in) + " en el banquillo" : !outOk ? N(n.out) + " ya no está en el campo" : N(n.in) + " no está en el banquillo",
    ask: "¿Apuntar en el acta, " + X.now + "′: entra " + N(n.in) + " por " + N(n.out) + "?",
    askS: "La mesa y la web lo ven al momento. Tendrás 5 segundos para deshacerlo.",
    btn: n.urgent ? "Hacer este cambio" : left <= 0 ? "¡Hacer el cambio ya!" : "Hacer el cambio",
  };
}

export function planOf(P: PzApi, X: PtModel) {
  const N = (id: string) => P.sel.name(id);
  const M = X.M;
  if (!M) return null;
  const canEdit = !!X.b && P.sel.canEdit(X.b) && X.ph === "antes" && !X.ro;
  const J = M.j ? "J" + M.j : "partido";
  if (!X.b || (!X.st.n && !X.tandas.length)) return { empty: true, emptyT: "Sin siete para la " + J, emptyS: "Cuando haya siete, aquí se reparten los minutos: quién entra, por quién y cuándo.", emptyGo: P.sel.me().member && !P.sel.me().socia, has: false } as const;
  const nextId = X.next && !X.next.urgent && !X.next.cond ? X.next.id : null;
  const stOf = (t: (typeof X.tandas)[number]) => (t.done ? "done" : t.id === nextId ? "next" : "later");
  const word = { done: "Hecho", next: "El próximo", later: "Después" } as const;
  const D = X.D;
  const pct = (m: number) => Math.round((m / D) * 1000) / 10;
  const marks = X.tandas.map((t) => {
    const s = stOf(t);
    const on = X.ph === "antes" && X.ui.focus === t.min;
    return { id: t.id, min: t.min, t: t.min + "′", l: pct(t.min), done: s === "done" && X.ph !== "antes", on, cls: X.ph === "antes" ? (on ? "is-sel" : "") : "is-" + s, aria: t.min + "′: entra " + N(t.in) + " por " + N(t.out) + (X.ph === "antes" ? (on ? ". En el campo" : ". Verlo en el campo") : ". " + word[s]) };
  });
  // (several cambios in one tanda share one mark)
  const uniq = marks.filter((m, i) => marks.findIndex((x) => x.min === m.min) === i);
  const rows = X.tandas.map((t) => {
    const s = stOf(t);
    const on = X.ph === "antes" && X.ui.focus === t.min;
    const code = X.v?.slots.find((x) => x.playerId === t.out)?.code ?? "";
    return {
      id: t.id,
      min: t.min,
      minT: t.min + "′",
      t: "Entra " + N(t.in) + " por " + N(t.out),
      s: t.done && t.doneMin !== t.min ? "Se hizo en el " + t.doneMin + "′" : (code ? code + " · " : "") + (t.min === X.HALF ? "en el descanso" : t.min < X.HALF ? "1ª parte" : "2ª parte"),
      out: t.out,
      in: t.in,
      on,
      aria: t.min + "′: entra " + N(t.in) + " por " + N(t.out) + (on ? ". En el campo ahora" : ". Verlo en el campo"),
      chip: X.ph === "despues" ? (s === "done" ? "Hecho" : "No se hizo") : word[s],
      chipCls: s === "done" ? "is-ok" : s === "next" ? "is-guest" : X.ph === "despues" ? "is-bad" : "is-mute",
      chipIcon: s === "done" ? "check" : s === "next" ? "clock" : X.ph === "despues" ? "close" : "dots",
    };
  });
  const gks = P.state.W.squad.filter((x) => x.line === "POR" || x.also.includes("POR"));
  const focusT = X.ph === "antes" && X.ui.focus != null && X.tandas.some((x) => x.min === X.ui.focus) ? "El campo enseña el " + X.ui.focus + "′, justo antes del cambio." : "";
  return {
    empty: !X.tandas.length,
    emptyT: "Sin cambios planeados",
    emptyS: canEdit ? "Reparte los minutos y el plan sale en la charla, en la mesa y en el cartel." : "Los capitanes aún no han planeado los cambios.",
    emptyGo: false,
    has: X.tandas.length > 0,
    title: X.ph === "antes" ? "El plan de minutos" : X.ph === "despues" ? "Los cambios: plan y acta" : "Los cambios de hoy",
    meta: fmt.plural(X.tandas.length, "cambio", "cambios") + " · 2 partes de " + X.HALF + "′",
    btns: X.ph === "antes",
    playedW: X.ph === "antes" ? 0 : pct(Math.min(X.now, D)),
    hasNow: X.ph === "juego",
    nowL: pct(Math.min(X.now, D)),
    halfL: pct(X.HALF),
    tlAria: "Línea del partido de 0 a " + D + " minutos con " + fmt.plural(X.tandas.length, "cambio", "cambios"),
    marks: uniq,
    rows,
    tools: canEdit,
    rotarOff: gks.length < 2,
    rotarT: gks.length < 2 ? "Rotar portero: solo " + (gks[0] ? gks[0].shirt : "uno") + " es portero" : "Rotar portero",
    focusT,
  };
}

export function propOf(P: PzApi, X: PtModel) {
  const pr = X.ui.prop;
  if (!pr) return null;
  const N = (id: string) => P.sel.name(id);
  const isPor = (k: string) => P.sel.player(k)?.line === "POR";
  const vals = Object.keys(pr.acc)
    .filter((k) => pr.acc[k] > 0 && !isPor(k))
    .map((k) => pr.acc[k]);
  const lo = vals.length ? Math.min(...vals) : 0;
  const hi = vals.length ? Math.max(...vals) : 0;
  return {
    t: pr.subs.length ? (pr.kind === "recalc" ? "Desde el " + X.now + "′: todos entre " : "Todos entre ") + lo + "′ y " + hi + "′" : "Sin cambios: nadie en el banquillo para entrar",
    s: pr.kind === "recalc" ? "Cuenta lo jugado hoy y deja fuera a quien no puede seguir." : "Entre los que van; el portero juega entero. Cada uno entra en el sitio del que sale.",
    rows: pr.subs.filter((s) => pr.kind === "repartir" || s.min > X.now).map((s) => ({ id: s.id, min: s.min + "′", t: "Entra " + N(s.in) + " por " + N(s.out), s: s.min === X.HALF ? "en el descanso" : s.min < X.HALF ? "1ª parte" : "2ª parte", out: s.out, in: s.in })),
    delta: Object.keys(pr.acc)
      .filter((k) => !isPor(k))
      .map((k) => ({ k, a: plannedOf(X, k), c: pr.acc[k] }))
      .filter((x) => x.a !== x.c)
      .sort((a, c) => c.c - c.a - (a.c - a.a))
      .slice(0, 6)
      .map((x) => ({ k: x.k, n: N(x.k), t: x.a + "′ → " + x.c + "′" })),
  };
}

export function minsOf(P: PzApi, X: PtModel) {
  if (!X.M || !X.b || X.ph === "despues" || X.ph === "none") return null;
  const ids: string[] = [];
  const add = (p: string | null | undefined) => {
    if (p && !ids.includes(p)) ids.push(p);
  };
  X.startPids.forEach(add);
  X.tandas.forEach((t) => add(t.in));
  (X.ph === "antes" ? X.yes : X.present).forEach(add);
  X.L?.done.forEach((e) => add(e.in));
  const antes = X.ph === "antes";
  const nowL = Math.round((Math.min(X.now, X.D) / X.D) * 1000) / 10;
  const rows = ids
    .map((pid) => {
      const pl = P.sel.player(pid);
      const plan0 = plannedOf(X, pid);
      const played = playedOf(X, pid);
      const segs = [...segsOf(X.planIv[pid], "g", X.D), ...(X.actIv ? segsOf(X.actIv[pid], "s", X.D) : [])];
      const onField = X.field.includes(pid);
      const sub = antes ? (X.startPids.includes(pid) ? "Empieza" : plan0 ? "Entra" : pl?.guest ? "Invitado" : "Banquillo") : X.ui.cant[pid] ? "No puede seguir" : onField ? "En el campo" : "Banquillo";
      const name = pl?.shirt ?? P.sel.name(pid);
      return { pid, name, sub, segs, hasNow: X.ph === "juego", nowL, v: (antes ? plan0 : played) + "′", w: antes ? (plan0 ? (plan0 === X.D ? "entero" : "de " + X.D + "′") : "banquillo") : "de " + plan0 + "′", aria: name + ": " + (antes ? (plan0 ? plan0 + " minutos en el plan" : "se come banquillo") : played + " minutos hoy de " + plan0 + " planeados") + ". " + sub, sort: (antes ? plan0 : played) * 100 + plan0 };
    })
    .sort((a, c) => c.sort - a.sort);
  const zero = rows.filter((r) => r.v === "0′").length;
  return {
    title: antes ? "Los minutos de cada uno" : "Minutos de hoy",
    meta: antes ? (zero ? fmt.plural(zero, "se come", "se comen") + " el banquillo" : "Todos juegan") : "El plan, de fondo",
    legend: antes ? [{ cls: "g", t: "En el campo según el plan" }] : [{ cls: "g", t: "El plan" }, { cls: "s", t: "Jugado hoy" }],
    rows,
  };
}

export function descOf(P: PzApi, X: PtModel) {
  if (X.ph !== "descanso" || !X.L) return null;
  const N = (id: string) => P.sel.name(id);
  const pairs = descPairs(X);
  const L = X.L;
  const yel = L.events.filter((e) => e.type === "yellow_card");
  return {
    pairs: pairs.map((r) => ({ id: r.out + r.in, t: "Entra " + N(r.in) + " por " + N(r.out), s: r.why, out: r.out, in: r.in })),
    head: pairs.length ? "La 2ª parte, lista" : "Siguen los mismos",
    sub: pairs.length ? fmt.plural(pairs.length, "cambio", "cambios") + " al volver" : X.ui.descOpt === "version" && !X.b?.lineup.variants?.some((v) => v.id === "v2") ? "El tablero no tiene versión «2ª parte»" : "Nada que cambiar con esta opción",
    ask: "¿Apuntar " + (pairs.length === 1 ? "el cambio" : "los " + pairs.length + " cambios") + ": " + pairs.map((r) => "entra " + N(r.in) + " por " + N(r.out)).join(" y ") + "?",
    off: !pairs.length,
    stats: [
      { v: L.gf + "–" + L.ga, k: "Al descanso", w: L.gf > L.ga ? "Ganando" : L.gf < L.ga ? "Perdiendo" : "Empate" },
      { v: String(L.done.length), k: "Cambios", w: L.done.length === 1 ? "Hecho" : L.done.length ? "Hechos" : "Ninguno" },
      { v: String(yel.length), k: yel.length === 1 ? "Amarilla" : "Amarillas", w: yel.length ? fmt.list(yel.map((e) => N(e.playerId ?? ""))) : "Limpios" },
    ],
  };
}

export function despOf(P: PzApi, X: PtModel) {
  if (X.ph !== "despues" || !X.L) return null;
  const L = X.L;
  const notas = X.feed.notas;
  const ns = Object.values(notas);
  const avg = ns.length ? ns.reduce((a, c) => a + c, 0) / ns.length : null;
  const doneN = X.tandas.filter((t) => t.done).length;
  const ids: string[] = [];
  const add = (q: string | null | undefined) => {
    if (q && !ids.includes(q)) ids.push(q);
  };
  L.start.forEach(add);
  L.done.forEach((e) => add(e.in));
  X.tandas.forEach((t) => add(t.in));
  let same = 0;
  const rows = ids
    .map((pid) => {
      const pl = P.sel.player(pid);
      const a = plannedOf(X, pid);
      const c = total(X.actIv?.[pid]);
      const asPlanned = Math.abs(a - c) <= 2;
      if (asPlanned) same++;
      const nv = notas[pid];
      const tone = nv == null ? "ok" : nv >= 7 ? "top" : nv >= 6 ? "good" : nv >= 5 ? "ok" : "bad";
      const name = pl?.shirt ?? P.sel.name(pid);
      return { pid, name, segs: [...segsOf(X.planIv[pid], "p", X.D), ...segsOf(X.actIv?.[pid], "s", X.D)], nota: nv == null ? "—" : fmt.nota(nv), nWord: nv == null ? "sin nota" : P.sel.notaWord(nv).toLowerCase(), nCls: "t-" + tone, w: c + "′ · " + (!X.tandas.length && !a ? "sin plan" : asPlanned ? "como se planeó" : c > a ? c - a + "′ más" : a - c + "′ menos"), aria: name + ": jugó " + c + " minutos, planeados " + a + ". Nota " + (nv == null ? "sin nota" : fmt.nota(nv)), sort: nv ?? 0 };
    })
    .sort((x, y) => y.sort - x.sort);
  return {
    rows,
    meta: same + " de " + ids.length + " como se planeó",
    stats: [
      { v: avg == null ? "—" : fmt.nota(avg), k: "Media", w: avg == null ? "Sin notas aún" : P.sel.notaWord(avg) },
      { v: doneN + "/" + X.tandas.length, k: "Cambios", w: !X.tandas.length ? "Sin plan" : doneN === X.tandas.length ? "Como el plan" : "Faltó alguno" },
      { v: String(ids.filter((p) => total(X.actIv?.[p]) > 0).length), k: "Jugaron", w: "de " + X.present.length },
    ],
  };
}

export function condOf(P: PzApi, X: PtModel, canChange: boolean) {
  if (!X.cond || !X.L || X.ph !== "juego") return null;
  const r = X.cond.rule;
  const sentence = condSentence(r, (id) => P.sel.name(id));
  if (X.cond.on) return { sentence, st: "Aplicado: es el próximo cambio", cls: "is-ok", icon: "check", canApply: false };
  if (X.cond.applies) return { sentence, st: "Toca el plan: vamos " + X.L.gf + "–" + X.L.ga + " en el " + X.now + "′", cls: "is-warn", icon: "warn", canApply: canChange && !!r.sub };
  return { sentence, st: X.now < r.from ? "Aún no: es el " + X.now + "′" : "No toca: vamos " + X.L.gf + "–" + X.L.ga, cls: "is-mute", icon: "dots", canApply: false };
}

export function galNowOf(P: PzApi, X: PtModel) {
  const b = X.b;
  if (!b || !X.L || X.ph !== "juego") return [];
  const on = (q?: string | null) => !!q && X.field.includes(q);
  const N = (id: string) => P.sel.name(id);
  const roles = b.lineup.roles;
  const cap = [roles.captainId, roles.viceId].find(on);
  const out = [{ k: "C", t: cap && cap === roles.captainId ? "Capitán" : roles.captainId ? "Capitán (el vice, " + N(roles.captainId) + " no está)" : "Capitán", who: cap ? N(cap) : "Nadie en el campo" }];
  const takers = b.lineup.takers ?? { penalties: [], freekicks: [], corners: [] };
  (
    [
      ["penalties", "P", "Penaltis"],
      ["freekicks", "F", "Faltas"],
      ["corners", "E", "Córners"],
    ] as const
  ).forEach(([k, l, t]) => {
    const w = (takers[k] ?? []).find(on);
    out.push({ k: l, t, who: w ? N(w) : (takers[k] ?? []).length ? "Nadie de la lista en el campo" : "Sin lanzador" });
  });
  return out;
}

export function youOf(P: PzApi, X: PtModel): string {
  const me = P.sel.me();
  if (!X.L || !me.pid || (X.ph !== "juego" && X.ph !== "descanso")) return "";
  const pid = me.pid;
  const onF = X.field.includes(pid);
  const mk = (X.L.marks[pid] ?? []).map((m) => m.t.toLowerCase());
  const planned = X.tandas.find((t) => !t.done && (t.in === pid || t.out === pid));
  if (onF) return "Estás en el campo de " + slotOf(X, pid) + " · " + playedOf(X, pid) + "′ hoy" + (mk.length ? " · " + mk.join(", ") : "") + (planned && planned.out === pid ? " · sales en el " + planned.min + "′" : "");
  if (X.present.includes(pid)) return "En el banquillo" + (planned && planned.in === pid ? " · entras en el " + planned.min + "′ por " + P.sel.name(planned.out) : "");
  return "";
}
