// r14 «La pizarra» · Partido: what the day of the match does. Every write goes where the app already writes it:
// «Hacer el cambio» and the 2ª parte into the acta through la mesa's liveEvent `addMany` (the same wave call as la
// mesa's Descanso and the pizarra's live «Hacer el cambio» of before), undone by deleting those events; «Mandar a la
// mesa» through setMatchLineup; «Repartir minutos» / «Recalcular» with v2/cambios (generateWaves / replan) into the
// board's `subs` by the session (act.saveBoard). All of it said in a toast and undoable where the server allows.
import type { WaveSub } from "../../../../mesa/api";
import { newId } from "../../../drawings";
import type { Sub } from "../../../formations";
import type { FitGrade } from "../../../../../lib/positions";
import { generateWaves, replan } from "../../../v2/cambios";
import { slotZone } from "../../../v2/geometry";
import type { PzApi } from "../../store/api";
import { fmt } from "../../store/fmt";
import type { PlaceBadge, PrimaryAction } from "../../store/types";
import { feedOf, setUi, uiOf } from "./state";
import { descPairs, intervals, mesaState, phaseOf, playedOf, ptMatch, ptModel, total, type PtModel } from "./partidoView";

export const model = (P: PzApi): PtModel => ptModel(P, feedOf(P), uiOf(P));
const N = (P: PzApi, id: string | null | undefined) => (id ? P.sel.name(id) : "—");

/** setMatchLineup / liveEvent not deployed on this server (an emulator or a backend behind the web). */
const missingCallable = (err: unknown): boolean => {
  const e = err as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === "string" ? e.code : "";
  const msg = typeof e?.message === "string" ? e.message : "";
  return code === "functions/unimplemented" || (code === "functions/not-found" && /^(not[ _-]?found)?$/i.test(msg.trim()));
};
// (the writes load the callables on first use: the place's shell info stays light)
const clubApi = () => import("../../../../../lib/clubApi");
const mesaApi = () => import("../../../../mesa/api");
const errText = async (e: unknown): Promise<string> => (await clubApi()).apiError(e);
const rid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "pt-" + Date.now() + "-" + Math.random().toString(36).slice(2));

/** Writes a wave into the acta; resolves to its event ids. */
async function writeWave(X: PtModel, pairs: { out: string; in: string }[]): Promise<string[]> {
  const M = X.M;
  if (!M) return [];
  const requestId = rid();
  const subs: WaveSub[] = pairs.map((r) => ({ playerId: r.out, inPlayerId: r.in, minute: X.now, ...(X.feed.revision != null ? { clockRevision: X.feed.revision } : {}) }));
  const m = await mesaApi();
  await m.addSubs(M.id, requestId, subs);
  return m.waveIds(requestId, subs.length);
}

/** A wave into the acta with its toast and its 5 s «Deshacer» (the events deleted again). */
export async function apuntar(P: PzApi, pairs: { out: string; in: string }[], label: string): Promise<boolean> {
  const X = model(P);
  if (!X.M || !pairs.length) return false;
  if (!X.decide) {
    P.toast("Los cambios los apuntan los capitanes y el anotador", { icon: "lock" });
    return false;
  }
  if (P.state.estado === "offline") {
    P.toast("Sin conexión: el cambio no llega al acta. Apúntalo cuando vuelva la señal", { icon: "warn" });
    return false;
  }
  if (X.ui.busy) return false;
  const matchId = X.M.id;
  setUi(P, { busy: true, confirm: "" });
  try {
    let ids = await writeWave(X, pairs);
    const cant = { ...uiOf(P).cant };
    pairs.forEach((r) => delete cant[r.out]);
    setUi(P, { busy: false, cant, cond: uiOf(P).cond && !pairs.some((r) => X.next?.cond && r.out === X.next.out) });
    const undo = () => {
      const gone = ids;
      void clubApi()
        .then((c) => Promise.all(gone.map((eventId) => c.mesaEvent({ action: "delete", matchId, eventId }))))
        .catch(async (e: unknown) => P.toast("No se ha podido deshacer: " + (await errText(e)), { icon: "warn" }));
    };
    const redo = () => {
      void writeWave(model(P), pairs).then(
        (x) => {
          ids = x;
        },
        async (e: unknown) => P.toast("No se ha podido apuntar: " + (await errText(e)), { icon: "warn" }),
      );
    };
    P.pushUndo("En el acta, " + label, undo, redo, { toast: false });
    P.toast("En el acta, " + label, { undo: true, ms: 5000, icon: "check" });
    return true;
  } catch (e) {
    setUi(P, { busy: false });
    console.error("No se pudo apuntar el cambio", e);
    P.toast(missingCallable(e) ? "La mesa aún no recibe cambios desde la pizarra en este servidor" : "No se ha podido apuntar: " + (await errText(e)), { icon: "warn" });
    return false;
  }
}

/** «Hacer el cambio» asks first (the confirm in the side, and in the phone's peek). */
export function askNext(P: PzApi) {
  const X = model(P);
  if (!X.decide || !X.next?.in) return;
  setUi(P, { confirm: "next" });
  P.say("¿Apuntar el cambio en el acta? Sí o No");
}

/** The next change, after «Sí, apuntar»: checked against the pitch as it is. */
export function doNext(P: PzApi): Promise<boolean> {
  const X = model(P);
  const nx = X.next;
  if (!nx || !nx.in) return Promise.resolve(false);
  if (!X.field.includes(nx.out)) {
    P.toast(N(P, nx.out) + " ya no está en el campo", { icon: "warn" });
    return Promise.resolve(false);
  }
  if (!X.bench.includes(nx.in)) {
    P.toast(N(P, nx.in) + " no puede entrar: no está en el banquillo", { icon: "warn" });
    return Promise.resolve(false);
  }
  return apuntar(P, [{ out: nx.out, in: nx.in }], X.now + "′: entra " + N(P, nx.in) + " por " + N(P, nx.out));
}

/** «Otro cambio…»: any one off for any one on the bench. */
export function doOtro(P: PzApi, out: string, inn: string): Promise<boolean> {
  const X = model(P);
  return apuntar(P, [{ out, in: inn }], X.now + "′: entra " + N(P, inn) + " por " + N(P, out));
}

/** Descanso: the 2ª parte in one wave. */
export function doDesc(P: PzApi): Promise<boolean> {
  const X = model(P);
  const pairs = descPairs(X);
  if (!pairs.length) return Promise.resolve(false);
  return apuntar(P, pairs, X.now + "′: " + pairs.map((r) => "entra " + N(P, r.in) + " por " + N(P, r.out)).join(" y "));
}

// ── the minutes plan: «Repartir minutos» (before) and «Recalcular desde el 23′» (live) ──
function genCtx(P: PzApi, X: PtModel) {
  const b = X.b!;
  const v = X.v!;
  const zones = b.lineup.slots.map((_, i) => slotZone(b.lineup, i));
  const nat = (id: string) => P.sel.player(id)?.line ?? undefined;
  const grade = (id: string, i: number) => (v.slots[i] ? (P.sel.fit(id, v.slots[i].code) as FitGrade | null) : null);
  return { zones, nat, grade };
}

/** The proposal (a preview the user applies or discards). */
export function propose(P: PzApi): void {
  const X = model(P);
  if (!X.b || !X.v || !P.sel.canEdit(X.b)) {
    if (X.b) P.toast("El plan de minutos lo cambian los capitanes", { icon: "lock" });
    return;
  }
  const { zones, nat, grade } = genCtx(P, X);
  if (X.ph === "antes") {
    const seats = X.v.slots.map((s) => s.playerId);
    const pool = X.yes.filter((id) => !seats.includes(id));
    const subs = generateWaves({ seats, zones, pool, from: 0, duration: X.D, rotateKeeper: X.ui.rotar, nat, grade, newId: () => newId("s") });
    const iv = intervals(seats, subs, X.D);
    const acc: Record<string, number> = {};
    [...seats, ...pool].forEach((p) => p && (acc[p] = total(iv[p])));
    setUi(P, { prop: { kind: "repartir", subs, acc } });
    P.say("Propuesta de minutos lista: aplícala o descártala");
  } else if (X.L && X.ph === "juego") {
    const played = new Map<string, number>();
    [...X.present, ...X.field].forEach((p) => played.set(p, playedOf(X, p)));
    const subs = replan({ L: X.b.lineup, subs: X.planSubs, from: X.now, duration: X.D, field: X.field, pool: X.bench, played, unavailable: new Set(Object.keys(X.ui.cant)), rotateKeeper: X.ui.rotar, nat, grade, zones, newId: () => newId("s") });
    const future = subs.filter((s) => s.min > X.now).map((s) => ({ min: s.min, out: s.out, in: s.in }));
    const iv = intervals(X.L.start, [...X.L.outs, ...future], X.D);
    const acc: Record<string, number> = {};
    [...X.present, ...X.field].forEach((p) => (acc[p] = total(iv[p])));
    setUi(P, { prop: { kind: "recalc", subs, acc } });
    P.say("Recalculado desde el " + X.now + "′: aplícalo o descártalo");
  }
}

export function applyProp(P: PzApi): void {
  const X = model(P);
  const pr = X.ui.prop;
  if (!pr || !X.b) return;
  const subs: Sub[] = pr.subs;
  const label = pr.kind === "recalc" ? "Plan recalculado desde el " + X.now + "′" : "Minutos repartidos: " + fmt.plural(subs.length, "cambio", "cambios");
  const ok = P.act.saveBoard({ subs }, label, { boardId: X.b.id });
  if (ok) setUi(P, { prop: null, focus: null });
}

// ── «Mandar a la mesa» ──
/** Why the plan board can't go to la mesa now ('' = it can). */
export function mesaBlock(P: PzApi, X: PtModel): string {
  const J = X.M?.j ? "J" + X.M.j : "partido";
  if (!X.b || !X.st.n) return "Aún no hay siete para la " + J + ": primero hazlo en Siete.";
  if (!X.st.full) return "El siete tiene que estar completo: " + (X.st.missing.length === 1 ? "falta un " + X.st.missing[0] : "faltan " + (7 - X.st.n)) + ".";
  if (X.ph !== "antes") return X.ph === "despues" ? "Ese partido ya se jugó: su alineación queda cerrada." : "El partido ya ha empezado: el siete cambia con los cambios de la mesa.";
  if (X.b.draft || (X.b.id === P.state.boardId && P.state.saveStatus !== "saved")) return "Espera a que el tablero esté guardado (" + (P.state.saveStatus === "error" ? "no se ha podido guardar" : "guardando…") + ").";
  return "";
}

export async function sendMesa(P: PzApi): Promise<boolean> {
  const X = model(P);
  if (!X.M || !X.b || X.ui.busy) return false;
  if (!X.decide) {
    P.toast("Lo mandan los capitanes y el anotador", { icon: "lock" });
    return false;
  }
  const block = mesaBlock(P, X);
  if (block) {
    P.toast(block, { icon: "warn" });
    return false;
  }
  setUi(P, { busy: true });
  try {
    const r = await (await clubApi()).setMatchLineup({ matchId: X.M.id, boardId: X.b.id });
    setUi(P, { busy: false, sent: { at: Date.now() } });
    P.toast(r.data.changed ? "Siete en la mesa · " + X.v!.formation : "La mesa ya tenía este siete", { icon: "check" });
    return true;
  } catch (e) {
    setUi(P, { busy: false });
    console.error("No se pudo mandar el siete a la mesa", e);
    P.toast(missingCallable(e) ? "La mesa aún no recibe el siete desde la pizarra en este servidor" : "No se ha podido mandar: " + (await errText(e)), { icon: "warn" });
    return false;
  }
}

// ── what the place tells the shell ──
export function primaryOf(P: PzApi): PrimaryAction | null {
  const X = model(P);
  if (X.ph === "antes") {
    const ms = mesaState(X);
    if (X.decide && X.b && !X.st.full && P.sel.canEdit(X.b)) return { label: "Completar el siete", short: "Completar", icon: "shirt", run: () => P.nav("/pizarra/siete") };
    if (X.decide && X.b && ms !== "aldia") return { label: "Mandar a la mesa", short: "Mandar", icon: "send", run: () => P.act.openSheet("pt-mesa") };
    return X.b && X.b.isOfficial ? { label: "Ver la charla", short: "Charla", icon: "mic", run: () => P.nav("/pizarra/charla") } : null;
  }
  if (X.ph === "juego" && X.decide && X.next?.in) return { label: "Hacer el cambio", short: "Hacer el cambio", icon: "swap", run: () => askNext(P), disabled: X.ui.busy };
  if (X.ph === "descanso" && X.decide && descPairs(X).length) return { label: "Aplicar la 2ª parte", short: "Aplicar la 2ª", icon: "swap", run: () => setUi(P, { confirm: "desc" }), disabled: X.ui.busy };
  if (X.ph === "despues" && X.M) {
    const id = X.M.id;
    return { label: "Ver el partido", short: "El partido", icon: "star", run: () => P.act.go("/partidos/" + encodeURIComponent(id)) };
  }
  return null;
}

export function badgeOf(P: PzApi): PlaceBadge | null {
  const X = model(P);
  if (!X.L) return null;
  if (X.ph === "juego") return { t: X.now + "′ · " + X.L.gf + "–" + X.L.ga, word: "En juego", live: true };
  if (X.ph === "descanso") return { t: X.L.gf + "–" + X.L.ga, word: "Descanso", live: false };
  return null;
}

export function subOf(P: PzApi): string {
  const M = ptMatch(P);
  if (!M) return "Sin partido";
  const ph = phaseOf(M);
  if (ph === "juego") return "En juego " + model(P).now + "′";
  if (ph === "descanso") return "Descanso";
  if (ph === "despues") return "Jugado " + (M.gf != null && M.ga != null ? M.gf + "–" + M.ga : "");
  const d = M.at - P.state.W.now;
  return d > 0 && d < 12 * 3600000 ? "Hoy " + fmt.hm(M.at) : fmt.day(M.at).split(" ")[0] + " " + fmt.hm(M.at);
}
