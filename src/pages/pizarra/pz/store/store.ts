// r14 «La pizarra»: THE store (the React port of the prototype's PI-store.js; contract: store/api.ts, MARCO.txt).
// One instance per page (PizarraR14 creates it, PzProvider hands it down, `usePz()` reads it). Its world is the
// app's real data, rebuilt by the bridge (store/bridge.tsx) on every change and handed in with `attach`; its writes
// go out through the host (the board session: autosave, draft → board, publish…). Selectors are pure functions of
// the state; actions change it, push undo entries, toast and announce, then bump the version (subscribers are
// called once per microtask).
import type { Lineup } from "../../formations";
import { FORMATIONS } from "../../formations";
import { POSITIONS, LINE_NAMES, fitGrade, type PosCode } from "../../../../lib/positions";
import { SYSTEMS_CATALOGUE } from "../../../../lib/formations";
import { rivalSpots } from "../../v2/rival";
import { toggleRole } from "../../v2/ops";
import type { PzAct, PzApi, PzPrefs, PzSel, PzSlice, ShirtStill, ToastOptions, Candidate, StartSource, PublishCheck } from "./api";
import { fmt } from "./fmt";
import { madridDate } from "../../../../../functions/src/madrid";
import { readLocalPrefs } from "../../data/prefs";
import { parsePizarra, pizarraHref } from "./routes";
import { onRegistry, placeReg, preloadPlace, sheetReg } from "./registry";
import { VERS, verDef, verOf, slotsOf, withVer, slotsForSystem, setPid, snapSeven, restoreSeven, type SevenSnap } from "./seven";
import { resolveView } from "./view";
import type {
  Camera,
  Estado,
  LayerId,
  Layout,
  PlaceId,
  PzBoard,
  PzGalon,
  PzLink,
  PzMatch,
  PzMe,
  PzPlayer,
  PzRoute,
  PzRsvp,
  PzState,
  PzStatus,
  PzVer,
  PzWorld,
  StageSpec,
  VersionId,
} from "./types";

export const PLACES: { id: PlaceId; t: string; icon: string; key: string; dock?: boolean; takeover?: boolean; hidden?: boolean }[] = [
  { id: "siete", t: "Siete", icon: "shirt", key: "1", dock: true },
  { id: "plan", t: "Plan", icon: "flag", key: "2", dock: true },
  { id: "jugadas", t: "Jugadas", icon: "play", key: "3", dock: true },
  { id: "partido", t: "Partido", icon: "clock", key: "4", dock: true },
  { id: "tableros", t: "Tableros", icon: "boards", key: "5" },
  { id: "pachanga", t: "Pachanga", icon: "bib", key: "6" },
  { id: "charla", t: "La charla", icon: "mic", key: "", takeover: true, hidden: true },
];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** «2026-11-12» → «12 nov». */
const isoShort = (s: string) => {
  const p = s.split("-");
  return p.length === 3 ? `${Number(p[2])} ${MONTHS[Number(p[1]) - 1] ?? ""}` : s;
};
export const placeOf = (id: string) => PLACES.find((p) => p.id === id) ?? null;
export const LAYERS: { id: LayerId; t: string; key: string }[] = [
  { id: "nada", t: "Nada", key: "0" },
  { id: "media", t: "Media", key: "1" },
  { id: "nota", t: "Nota", key: "2" },
  { id: "quimica", t: "Química", key: "3" },
  { id: "forma", t: "Forma", key: "4" },
  { id: "minutos", t: "Minutos", key: "5" },
];
export const GALONES = [
  { k: "C", role: "captainId", t: "Capitán", one: "el brazalete" },
  { k: "V", role: "viceId", t: "Vice", one: "la vice" },
  { k: "P", taker: "penalties", role: "penaltiesId", t: "Penaltis", one: "los penaltis" },
  { k: "F", taker: "freekicks", role: "freekicksId", t: "Faltas", one: "las faltas" },
  { k: "E", taker: "corners", role: "cornersId", t: "Córners", one: "los córners" },
] as const;
const RSVP = { yes: { t: "Voy", icon: "check", tone: "ok" }, maybe: { t: "Duda", icon: "help", tone: "warn" }, no: { t: "No va", icon: "close", tone: "bad" }, none: { t: "Sin responder", icon: "dots", tone: "mute" } } as const;
const TIERS = [
  { from: 85, t: "De campeones" },
  { from: 72, t: "Muy alta" },
  { from: 58, t: "Buena" },
  { from: 40, t: "Justa" },
  { from: 0, t: "Floja" },
];

/** What the bridge hands in on every data change. */
export interface PzInputs {
  W: PzWorld;
  me: PzMe;
  /** The board on screen ('nuevo' = the session's draft). */
  boardId: string;
  estado: Estado;
  error?: string;
  saveStatus: PzState["saveStatus"];
  saved: number | null;
  /** The official's reactions (useReactions). */
  reactions?: { ok: number; dudas: number; mine: "ok" | "dudas" | null; who?: string[] };
}

/** Where the store's writes go (the board session, the router, the stills). Every method is optional in tests. */
export interface PzHost {
  navigate(href: string, o?: { replace?: boolean }): void;
  /** The board on screen changed (the session autosaves; the draft becomes a board). */
  commit(lineup: Lineup): void;
  /** Another board changed (an undo after switching boards). */
  save(id: string, lineup: Lineup): void;
  open(id: string): void;
  /** A copy of a board (null = the one on screen) opened, with its charla's voices; resolves with its id. */
  duplicate(id: string | null): Promise<string | void>;
  /** Delete after a few seconds; the returned function undoes it. */
  remove(id: string): () => void;
  /** Publish THIS board (it must be the one on screen: the session writes it) as the official of its match.
   *  Rejects when it isn't. */
  publish(o: { convocatoria: boolean; boardId: string; matchId: string | null }): Promise<void>;
  unpublish(id: string): Promise<void>;
  react(v: "ok" | "dudas" | null): void;
  retry(): void;
  stills(kit: "home" | "away", num?: string): { src: string; printed: boolean } | undefined;
  /** The season id the pizarra's own addresses keep (?season=). */
  season(): string | undefined;
  /** The settings that follow you (usePizarraPrefs); null = not read yet (the device's copy is used). */
  prefs(): PzPrefs | null;
  setPrefs(patch: Partial<PzPrefs>): void;
}

const noop = () => undefined;
export const NULL_HOST: PzHost = {
  navigate: noop,
  commit: noop,
  save: noop,
  open: noop,
  duplicate: async () => undefined,
  remove: () => noop,
  publish: async () => undefined,
  unpublish: async () => undefined,
  react: noop,
  retry: noop,
  stills: () => undefined,
  season: () => undefined,
  prefs: () => null,
  setPrefs: noop,
};

export const EMPTY_WORLD: PzWorld = { now: 0, season: { id: "", name: "" }, squad: [], guests: [], matches: [], next: null, boards: [], official: null, rsvp: {}, absences: [], members: [], together: () => 0, games: 0 };
export const NOBODY: PzMe = { uid: "", name: "", nick: "", label: "", pid: null, cap: false, general: false, socia: false, jugador: false, fuera: true, member: false };

export type PzStore = PzApi & {
  attach(i: PzInputs): void;
  setHost(h: Partial<PzHost>): void;
  /** The address changed (the router): the store follows it. */
  setRoute(r: PzRoute): void;
  setLayout(l: Layout): void;
  /** For tests: the current inputs. */
  inputs(): PzInputs;
};

/** One store. `init` seeds the world (tests, the first render before the data). */
export function createPzStore(init?: Partial<PzInputs> & { layout?: Layout; route?: PzRoute }): PzStore {
  let host: PzHost = { ...NULL_HOST };
  let inputs: PzInputs = { W: EMPTY_WORLD, me: NOBODY, boardId: "", estado: "cargando", saveStatus: "saved", saved: null, ...init };
  let version = 0;
  /** Until when an undo window holds the app's update reload (ms). */
  let holdUntil = 0;
  let notifyQ = false;
  let toastT: ReturnType<typeof setTimeout> | undefined;
  let sayFlip = false;
  const subs: (() => void)[] = [];
  let quietV = 0;
  const quietSubs: (() => void)[] = [];
  const bus: Record<string, ((d: unknown) => void)[]> = {};
  const sliceDefs: Record<string, unknown | ((W: PzWorld, P: PzApi) => unknown)> = {};
  /** The sheet was opened by a push of the address (closing goes back). */
  let sheetPushed = false;
  let routeWaiters: (() => void)[] = [];

  const S: PzState = {
    W: inputs.W,
    me: inputs.me,
    estado: inputs.estado,
    error: inputs.error ?? "",
    layout: init?.layout ?? "desktop",
    route: init?.route ?? { place: "siete", sub: "", q: {} },
    boardId: inputs.boardId,
    version: "titular",
    sel: null,
    slotPick: null,
    layer: "nada",
    stage: {},
    drawing: false,
    sheet: null,
    sheetH: "peek",
    primary: null,
    toast: null,
    say: "",
    drag: null,
    over: null,
    flash: 0,
    hist: { undo: [], redo: [] },
    slices: {},
    bench: { line: "todos", van: false, q: "" },
    saved: inputs.saved,
    saveStatus: inputs.saveStatus,
    fichaPid: null,
  };

  // ── notify ─────────────────────────────────────────────────────────────────────────────────────────────
  function bump() {
    version++;
    if (notifyQ) return;
    notifyQ = true;
    void Promise.resolve().then(() => {
      notifyQ = false;
      subs.slice().forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.error("[pizarra] subscriber", e);
        }
      });
    });
  }
  function bumpQuiet() {
    quietV++;
    void Promise.resolve().then(() => {
      quietSubs.slice().forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.error("[pizarra] subscriber", e);
        }
      });
    });
  }
  function emit(evt: string, data?: unknown) {
    (bus[evt] ?? []).slice().forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error("[pizarra] on " + evt, e);
      }
    });
    (bus["*"] ?? []).slice().forEach((fn) => {
      try {
        fn({ evt, data });
      } catch {
        /* a listener's failure never stops the store */
      }
    });
  }
  function say(t: string) {
    sayFlip = !sayFlip;
    S.say = t + (sayFlip ? "​" : "");
    bump();
  }
  function toast(text: string, o: ToastOptions = {}) {
    if (toastT) clearTimeout(toastT);
    const undo = o.undo === true ? () => act.undo() : typeof o.undo === "function" ? o.undo : null;
    S.toast = { id: version + 1, text, undo, long: !!o.long, action: o.action ?? null, icon: o.icon ?? "check" };
    // a long undo window (a delete, an unpublish: 12 s) holds the app's update reload until it closes
    if (o.long && undo) holdUntil = Math.max(holdUntil, Date.now() + 12500);
    toastT = setTimeout(() => {
      S.toast = null;
      // (only the toast shows it: the rest of the pizarra — the pitch, the regions — isn't redrawn for it)
      bumpQuiet();
    }, o.ms ?? (o.long ? 12000 : undo || o.action ? 5000 : 3200));
    if (o.say !== false) say(text);
    bump();
  }

  // ── people ─────────────────────────────────────────────────────────────────────────────────────────────
  const me = () => S.me;
  function canEdit(b: PzBoard | null | undefined): boolean {
    const m = me();
    if (!b || m.fuera || m.socia || S.estado === "cargando" || S.estado === "error") return false;
    if (b.draft) return true;
    if (m.cap) return true;
    return b.ownerUid === m.uid && !b.isOfficial;
  }
  function player(id: string | null | undefined): PzPlayer | null {
    if (!id) return null;
    return S.W.squad.find((p) => p.id === id) ?? S.W.guests.find((p) => p.id === id) ?? null;
  }
  const name = (id: string | null | undefined) => player(id)?.shirt || "—";
  const posName = (code: string) => POSITIONS[code as PosCode]?.name ?? code;
  function shirt(pid: string | null | undefined, o: { away?: boolean } = {}): ShirtStill {
    const m = match();
    const kit = (o.away ?? m?.home === false) ? "away" : "home";
    const p = player(pid);
    const num = p && !p.guest && p.num != null ? String(p.num) : "";
    const st = host.stills(kit, num || undefined);
    return { src: st?.src, printed: !!st?.printed, num, name: p?.shirt ?? "", kit };
  }
  function fit(pid: string, code: PosCode): number | null {
    const p = player(pid);
    if (!p || !code) return null;
    const b = board();
    const playAs = b?.lineup.playerPositions[pid];
    if (playAs === code) return 3;
    return fitGrade({ main: p.main, also: p.also, line: p.line }, code);
  }
  const fitWord = (g: number | null) => (g == null ? "sin posición conocida" : g >= 2 ? "en su sitio" : g === 1 ? "adaptado" : "fuera de su sitio");
  const band = (v: number | null): ReturnType<PzSel["band"]> =>
    v == null ? { t: "sin nota", tone: "mute" } : v >= 75 ? { t: "muy buena", tone: "top" } : v >= 68 ? { t: "buena", tone: "good" } : v >= 62 ? { t: "normal", tone: "ok" } : v >= 55 ? { t: "floja", tone: "low" } : { t: "baja", tone: "bad" };
  const notaWord = (n: number | null) => (n == null ? "sin nota" : n >= 8 ? "Muy alta" : n >= 7 ? "Alta" : n >= 6 ? "Buena" : n >= 5 ? "Justa" : "Baja");
  const lastNota = (pid: string) => {
    const p = player(pid);
    return p && p.notas.length ? p.notas[p.notas.length - 1] : null;
  };

  // ── the match, the answers ─────────────────────────────────────────────────────────────────────────────
  function match(id?: string | null): PzMatch | null {
    const b = board();
    const want = id || b?.matchId || S.W.next;
    return S.W.matches.find((m) => m.id === want) ?? null;
  }
  function rsvp(pid: string): PzRsvp {
    const p = player(pid);
    if (p?.guest) return { v: "guest", t: "Invitado", icon: "user", tone: "guest", why: "Invitado" + (p.by ? " de " + name(p.by) : "") + (p.note ? " · " + p.note : ""), can: true };
    if (p?.baja) return { v: "baja", t: p.baja, icon: "warn", tone: "bad", why: p.bajaWhy ? p.bajaWhy.charAt(0).toUpperCase() + p.bajaWhy.slice(1) : p.baja, can: false };
    // an absence over the match's day («no puedo del 12 al 19») wins over any answer
    const M = match();
    const day = M ? madridDate(M.at) : "";
    const ab = day ? S.W.absences.find((x) => x.pid === pid && x.from <= day && x.to >= day) : undefined;
    if (ab) return { v: "ausente", t: "Ausente", icon: "cal", tone: "bad", why: "Ausente · hasta el " + isoShort(ab.to) + (ab.note ? " · " + ab.note.toLowerCase() : ""), until: ab.to, can: false };
    const a = S.W.rsvp[pid];
    const k = a ? a.v : "none";
    const r = RSVP[k];
    return { v: k, t: r.t, icon: r.icon, tone: r.tone, why: a?.why ?? "", at: a?.at ?? null, can: k !== "no" };
  }
  function counts() {
    const c = { yes: 0, maybe: 0, no: 0, none: 0, baja: 0, guests: S.W.guests.length, members: S.W.members.map((x) => ({ uid: x.uid, who: x.name, v: x.v, ...(x.why ? { why: x.why } : {}) })) };
    S.W.squad.forEach((p) => {
      const r = rsvp(p.id);
      if (r.v === "baja") c.baja++;
      else if (r.v === "ausente") c.no++;
      else if (r.v === "yes" || r.v === "maybe" || r.v === "no" || r.v === "none") c[r.v]++;
    });
    return c;
  }

  // ── boards and versions ────────────────────────────────────────────────────────────────────────────────
  function board(id?: string | null): PzBoard | null {
    const want = id || S.boardId;
    return S.W.boards.find((b) => b.id === want) ?? null;
  }
  const official = () => (S.W.official ? board(S.W.official.boardId) : null);
  function ver(b?: PzBoard | null, v?: VersionId): PzVer | null {
    const B = b === undefined ? board() : b;
    return B ? verOf(B.lineup, v ?? S.version) : null;
  }
  const placed = (v?: PzVer | null) => ((v === undefined ? ver() : v)?.slots ?? []).map((s) => s.playerId).filter((x): x is string => !!x);

  // ── the seven: status, química, media ──────────────────────────────────────────────────────────────────
  function status(v0?: PzVer | null): PzStatus {
    const v = v0 === undefined ? ver() : v0;
    const slots = v ? v.slots : [];
    let n = 0;
    const warns: PzStatus["warns"] = [];
    const missing: PosCode[] = [];
    slots.forEach((s) => {
      if (!s.playerId) {
        missing.push(s.code);
        return;
      }
      n++;
      const r = rsvp(s.playerId);
      const nm = name(s.playerId);
      if (!r.can) warns.push({ pid: s.playerId, t: nm + ": " + (r.why || r.t).toLowerCase() });
      else if (r.v === "maybe") warns.push({ pid: s.playerId, t: nm + " duda" });
      if (fit(s.playerId, s.code) === 0) warns.push({ pid: s.playerId, t: `${nm} fuera de su sitio (${s.code})` });
    });
    const gk = slots.find((s) => s.code === "POR");
    const hasGk = !!gk?.playerId;
    return { n, total: slots.length || 7, full: n === 7 && hasGk, gk: hasGk, missing, warns };
  }
  function links(v0?: PzVer | null): PzLink[] {
    const v = v0 === undefined ? ver() : v0;
    const s = v ? v.slots : [];
    const out: PzLink[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < s.length; i++) {
      if (!s[i].playerId) continue;
      const ds: { j: number; d: number }[] = [];
      for (let j = 0; j < s.length; j++) {
        if (j === i || !s[j].playerId) continue;
        const dx = s[i].x - s[j].x;
        const dy = (s[i].y - s[j].y) * 1.4;
        ds.push({ j, d: Math.sqrt(dx * dx + dy * dy) });
      }
      ds.sort((a, b) => a.d - b.d || a.j - b.j);
      for (const x of ds.slice(0, 2)) {
        if (x.d > 60) continue;
        const a = Math.min(i, x.j);
        const b = Math.max(i, x.j);
        const k = a + "-" + b;
        if (seen.has(k)) continue;
        seen.add(k);
        const pa = s[a].playerId as string;
        const pb = s[b].playerId as string;
        const fa = fit(pa, s[a].code);
        const fb = fit(pb, s[b].code);
        const nat = (fa ?? 0) >= 2 && (fb ?? 0) >= 2;
        const tog = S.W.together(pa, pb);
        const guest = !!player(pa)?.guest || !!player(pb)?.guest;
        const score = (nat ? 1 : 0) + (tog >= 60 ? 2 : tog >= 25 ? 1 : 0) + (guest ? 0 : 1) + ((fa ?? 0) >= 1 && (fb ?? 0) >= 1 ? 1 : 0);
        const t = score >= 5 ? 3 : score >= 3 ? 2 : 1;
        out.push({ i: a, j: b, a: pa, b: pb, t, tog, word: t === 3 ? "Muy buena" : t === 2 ? "Buena" : "Floja", why: tog ? tog + "′ juntos" : "Aún sin minutos juntos" });
      }
    }
    return out;
  }
  const tier = (v: number) => TIERS.find((x) => v >= x.from) ?? TIERS[TIERS.length - 1];
  function chem(v0?: PzVer | null) {
    const v = v0 === undefined ? ver() : v0;
    const ls = links(v);
    const st = status(v);
    let nat = 0;
    (v ? v.slots : []).forEach((s) => {
      if (s.playerId && (fit(s.playerId, s.code) ?? 0) >= 2) nat++;
    });
    if (!st.n) return { v: 0, t: "Sin siete", links: [], nat: 0 };
    const avg = ls.length ? ls.reduce((a, l) => a + l.t, 0) / ls.length : 0;
    const val = Math.max(0, Math.min(99, Math.round(22 + avg * 15 + nat * 3 + (st.gk ? 6 : 0) - (7 - st.n) * 7)));
    return { v: val, t: tier(val).t, links: ls, nat };
  }
  function media(v0?: PzVer | null): number | null {
    const g = placed(v0).map((id) => player(id)?.global).filter((x): x is number => x != null);
    return g.length ? Math.round(g.reduce((a, b) => a + b, 0) / g.length) : null;
  }
  function diff(a: PzVer | null, b: PzVer | null) {
    if (!a || !b) return null;
    const A = a.slots.map((s) => s.playerId).filter((x): x is string => !!x);
    const B = b.slots.map((s) => s.playerId).filter((x): x is string => !!x);
    const ins = A.filter((x) => !B.includes(x));
    const outs = B.filter((x) => !A.includes(x));
    const moved = a.slots
      .filter((s) => {
        if (!s.playerId || ins.includes(s.playerId)) return false;
        const o = b.slots.find((y) => y.playerId === s.playerId);
        return !!o && o.code !== s.code;
      })
      .map((s) => s.playerId as string);
    const t: string[] = [];
    if (a.formation !== b.formation) t.push(b.formation + " → " + a.formation);
    if (ins.length) t.push("entra" + (ins.length > 1 ? "n " : " ") + fmt.list(ins.map(name)));
    if (outs.length) t.push("sale" + (outs.length > 1 ? "n " : " ") + fmt.list(outs.map(name)));
    if (moved.length) t.push(fmt.list(moved.map(name)) + " cambia" + (moved.length > 1 ? "n" : "") + " de puesto");
    return { ins, outs, moved, sistema: a.formation !== b.formation, same: !t.length, text: t.length ? t.join(" · ") : "Los mismos siete, igual colocados" };
  }

  // ── who for a slot (PZ-M07), the suggestion, «Empezar desde…» ─────────────────────────────────────────────
  const pool = () => [...S.W.squad.filter((p) => !p.baja || true).map((p) => p.id), ...S.W.guests.map((g) => g.id)];
  function rankScore(pid: string) {
    const p = player(pid);
    const r = rsvp(pid);
    return (p?.global ?? 60) / 10 + (r.v === "yes" ? 0.8 : r.v === "maybe" ? -0.4 : r.v === "guest" ? -1.6 : 0);
  }
  function candidates(i: number, v0?: PzVer | null): Candidate[] {
    const v = v0 === undefined ? ver() : v0;
    if (!v) return [];
    const code = v.slots[i]?.code;
    const on = placed(v);
    return pool()
      .map((id) => {
        const p = player(id) as PzPlayer;
        const g = code ? fit(id, code) : null;
        const r = rsvp(id);
        const why: string[] = [];
        const at = code ? p.playedAt[code] : 0;
        if (at) why.push(`Ha jugado de ${code} ${at}′`);
        else if (g === 3) why.push("Su puesto: " + code);
        else if (g === 2) why.push("También juega de " + code);
        else if (g === 1) why.push("Adaptado: es " + (p.line ? LINE_NAMES[p.line].short.toLowerCase() : "de otra línea"));
        else if (g === 0) why.push("Fuera de su sitio");
        const ln = lastNota(id);
        if (ln) why.push(`nota ${fmt.nota(ln.n)}${ln.j ? " en la J" + ln.j : ""}`);
        else if (p.guest) why.push("Sin partidos con nosotros");
        else why.push("Aún sin nota");
        why.push(r.t);
        const score = (g == null ? 1.2 : p.guest ? Math.min(g, 1) : g) * 2 + rankScore(id) / 3 + (at ? 0.8 : 0);
        return { pid: id, g, fitT: fitWord(g), on: on.includes(id), can: r.can, r, score, why: why.join(" · ") };
      })
      .sort((a, b) => Number(a.on) - Number(b.on) || Number(b.can) - Number(a.can) || b.score - a.score);
  }
  function assign(slots: PzVer["slots"], cands: string[]): (string | null)[] {
    const out: (string | null)[] = slots.map(() => null);
    const left = cands.slice();
    const order = slots.map((_, i) => i).sort((a, b) => (slots[a].code === "POR" ? -1 : 0) - (slots[b].code === "POR" ? -1 : 0));
    order.forEach((i) => {
      let best = -1;
      let bs = -99;
      left.forEach((id, k) => {
        const g = fit(id, slots[i].code);
        let sc = (g == null ? 1 : g) * 3 + rankScore(id) / 2;
        if (slots[i].code === "POR" && (g ?? 0) < 2) sc -= 20;
        if (slots[i].code !== "POR" && (fit(id, "POR") ?? 0) >= 2) sc -= 12;
        if (sc > bs) {
          bs = sc;
          best = k;
        }
      });
      if (best >= 0) {
        out[i] = left[best];
        left.splice(best, 1);
      }
    });
    return out;
  }
  function suggestion(v0?: PzVer | null): (string | null)[] {
    const v = v0 === undefined ? ver() : v0;
    if (!v) return [];
    const cands = pool()
      .filter((id) => rsvp(id).can)
      .sort((a, b) => rankScore(b) - rankScore(a));
    const gks = cands.filter((id) => (fit(id, "POR") ?? 0) >= 2);
    const pick = [...(gks[0] ? [gks[0]] : []), ...cands.filter((id) => id !== gks[0] && (fit(id, "POR") ?? 0) < 2).slice(0, gks[0] ? 6 : 7)];
    return assign(v.slots, pick);
  }
  function sources(): StartSource[] {
    const out: StartSource[] = [];
    const off = official();
    const next = match();
    // the last played match's seven: its official board's titular (the app keeps the lineup on the board)
    const playedBoards = S.W.boards.filter((b) => b.isOfficial && b.matchId && S.W.matches.find((m) => m.id === b.matchId)?.played);
    const lastB = playedBoards.sort((a, b) => (match(b.matchId)?.at ?? 0) - (match(a.matchId)?.at ?? 0))[0];
    const lm = lastB ? match(lastB.matchId) : null;
    if (lastB && lm) {
      const v = verOf(lastB.lineup, "titular");
      out.push({ id: "ultimo", t: "El último siete", s: `${lm.j ? "J" + lm.j + " · " : ""}${lm.rival}${lm.gf != null ? ` · ${lm.gf}–${lm.ga}` : ""} · ${v.formation}`, can: true, formation: v.formation, slots: v.slots });
    } else out.push({ id: "ultimo", t: "El último siete", s: "Aún no hay un siete jugado", can: false, formation: null, slots: null });
    const vsB = next ? S.W.boards.find((b) => b.isOfficial && b.matchId && b.matchId !== next.id && match(b.matchId)?.rival === next.rival) : null;
    const vm = vsB ? match(vsB.matchId) : null;
    out.push(vsB && vm ? { id: "rival", t: "Contra " + next?.rival, s: `${vm.j ? "J" + vm.j : ""}${vm.gf != null ? ` · ${vm.gf}–${vm.ga}` : ""}`, can: true, formation: vsB.lineup.formation, slots: verOf(vsB.lineup, "titular").slots } : { id: "rival", t: "Contra " + (next ? next.rival : "este rival"), s: "Nunca hemos jugado contra ellos", can: false, formation: null, slots: null });
    if (off && off.id !== S.boardId) {
      const v = verOf(off.lineup, "titular");
      out.push({ id: "oficial", t: "El oficial", s: off.name + " · " + v.formation, can: true, formation: v.formation, slots: v.slots });
    } else out.push({ id: "oficial", t: "El oficial", s: off ? "Ya estás en el oficial" : "Aún no hay siete oficial", can: false, formation: null, slots: null });
    return out;
  }
  function taker(b: PzBoard, v: PzVer, k: "penalties" | "freekicks" | "corners"): string | null {
    const on = placed(v);
    const list = b.lineup.takers?.[k] ?? [];
    return list.find((x) => on.includes(x)) ?? null;
  }
  function galones(pid: string, b0?: PzBoard | null, v0?: PzVer | null): PzGalon[] {
    const b = b0 === undefined ? board() : b0;
    const v = v0 === undefined ? ver(b) : v0;
    if (!b || !v || !pid) return [];
    const out: PzGalon[] = [];
    GALONES.forEach((g) => {
      const holder = "taker" in g ? (taker(b, v, g.taker) ?? b.lineup.roles[g.role]) : b.lineup.roles[g.role];
      if (holder === pid) out.push({ k: g.k, t: g.t, aria: g.t + ": " + name(pid) });
    });
    return out;
  }

  // ── the Siete headline that SAYS the state ─────────────────────────────────────────────────────────────
  function headline(): { t: string; s: string; tone: "ok" | "warn" | "calm" } {
    const b = board();
    const m = me();
    const v = ver();
    const st = status(v);
    const M = match();
    const J = M?.j ? "J" + M.j : "";
    if (!b || !v) return { t: m.socia ? "Aún no hay siete" : J ? "Empieza tu siete para la " + J : "Empieza tu siete", s: "Elige un punto de partida o deja que te lo sugiera.", tone: "calm" };
    if (!canEdit(b)) {
      const mine = v.slots.find((s) => s.playerId && s.playerId === m.pid);
      if (b.isOfficial && m.pid && !m.cap) {
        if (mine) return { t: "Tu sitio: " + mine.code, s: `${posName(mine.code)} en el ${v.formation} · el oficial${J ? " de la " + J : ""}`, tone: "ok" };
        return { t: "Empiezas en el banquillo", s: `El oficial${J ? " de la " + J : ""} · ${v.formation}`, tone: "calm" };
      }
      if (b.isOfficial) return { t: "El oficial" + (J ? " de la " + J : ""), s: `${v.formation} · lo publicó @${b.ownerNick}`, tone: "ok" };
      return { t: "El siete de @" + b.ownerNick, s: b.name + " · solo lectura", tone: "calm" };
    }
    if (st.n === 0) return { t: J ? "Empieza tu siete para la " + J : "Empieza tu siete", s: "Toca un hueco o pide que te lo sugiera.", tone: "calm" };
    if (!st.gk) return { t: "Te falta el portero", s: "Sin portero no se puede publicar.", tone: "warn" };
    if (st.missing.length === 1) return { t: "Te falta un " + st.missing[0], s: posName(st.missing[0]) + ": toca el hueco y te digo quién encaja.", tone: "warn" };
    if (st.missing.length > 1) return { t: "Te faltan " + st.missing.length, s: fmt.list(st.missing) + ": toca un hueco para elegir.", tone: "warn" };
    if (b.isOfficial && S.version === "titular") return { t: "El oficial" + (J ? " de la " + J : ""), s: "Publicado · el equipo ya lo ve", tone: "ok" };
    if (st.warns.length) return { t: "Listo, con " + fmt.plural(st.warns.length, "aviso", "avisos"), s: st.warns[0].t, tone: "warn" };
    if (S.version !== "titular") return { t: verDef(S.version).t + " lista", s: "Se publica con el titular.", tone: "ok" };
    return { t: "Listo para publicar", s: v.formation + " · " + (M ? (J ? J + " · " : "") + M.rival : b.name), tone: "ok" };
  }

  // ── the places bar ─────────────────────────────────────────────────────────────────────────────────────
  function placeSub(id: PlaceId): string {
    const r = placeReg(id);
    if (r?.sub) {
      try {
        return r.sub(api);
      } catch {
        /* fall back to the default */
      }
    }
    const b = board();
    const M = match();
    const st = status();
    if (id === "siete") return !b ? "Sin empezar" : st.full ? (b.isOfficial ? "Oficial" : "Listo") : st.n + " de 7";
    if (id === "plan") return b?.lineup.condPlan?.length ? fmt.plural(b.lineup.condPlan.length, "regla", "reglas") : "Sin plan";
    if (id === "jugadas") return String(b?.lineup.plays.length ?? 0);
    if (id === "partido") {
      if (!M) return "Sin partido";
      if (M.phase === "juego") return "En juego";
      if (M.phase === "descanso") return "Descanso";
      if (M.phase === "jugado") return M.gf != null ? `Jugado ${M.gf}–${M.ga}` : "Jugado";
      return fmt.day(M.at).split(" ")[0] + " " + fmt.hm(M.at);
    }
    if (id === "tableros") return String(S.W.boards.filter((x) => !x.draft).length);
    if (id === "pachanga") return "Entreno";
    return "";
  }
  function placeBadge(id: PlaceId) {
    const r = placeReg(id);
    if (r?.badge) {
      try {
        return r.badge(api) ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }

  // ── history (one stack; each entry knows how to undo and redo itself) ──────────────────────────────────
  let histSeq = 0;
  function pushHist(label: string, undo: () => void, redo: () => void | boolean, scope = "siete"): number {
    const id = ++histSeq;
    S.hist.undo.push({ id, scope, label, undo, redo });
    if (S.hist.undo.length > 60) S.hist.undo.shift();
    S.hist.redo = [];
    return id;
  }
  /** A board's new lineup, immutably (the world, its board list and the board are new objects: memoised renders see it). */
  function setLineup(id: string, L: Lineup) {
    S.W = { ...S.W, boards: S.W.boards.map((x) => (x.id === id ? { ...x, lineup: L } : x)) };
  }
  /** Write a seven snapshot back to a board (the one on screen through the session; another one directly). */
  function writeSeven(boardId: string, snap: SevenSnap, v: VersionId) {
    const b = board(boardId);
    if (!b) return;
    const next = restoreSeven(b.lineup, snap);
    setLineup(b.id, next);
    if (boardId === S.boardId) {
      host.commit(next);
      S.version = v;
    } else host.save(boardId, next);
    S.sel = null;
    S.slotPick = null;
    emit("siete", { boardId, undo: true });
  }
  function statusSay(full: boolean) {
    const st = status();
    return full ? ". ¡Siete listo!" : st.n < 7 ? ". Falta" + (7 - st.n === 1 ? " 1" : "n " + (7 - st.n)) : "";
  }
  /** A change of the seven on the board on screen: undoable, saved, toasted, announced. */
  function commit(label: string, fn: (L: Lineup) => Lineup | false, o: { toast?: boolean; long?: boolean; sayText?: string; sayStatus?: boolean } = {}): boolean {
    const b = board();
    if (!b) return false;
    if (!canEdit(b)) {
      toast(b.isOfficial ? "El oficial es de solo lectura: duplícalo para editarlo" : "Solo lectura: duplícalo para editarlo", { action: me().fuera || me().socia ? null : { t: "Duplicar", run: () => act.duplicate() } });
      return false;
    }
    const wasFull = status().full;
    const before = snapSeven(b.lineup);
    const next = fn(b.lineup);
    if (next === false) return false;
    setLineup(b.id, next);
    const after = snapSeven(next);
    const id = b.id;
    const v = S.version;
    host.commit(next);
    // (the draft «nuevo» becomes a stored board on this first change: undo then writes to the board on screen)
    const target = () => (id === "nuevo" ? S.boardId : id);
    pushHist(label, () => writeSeven(target(), before, v), () => writeSeven(target(), after, v));
    const nowFull = status().full;
    if (!wasFull && nowFull) {
      S.flash = version + 1;
      emit("siete:listo", { boardId: id });
    }
    emit("siete", { boardId: id, label });
    if (o.toast !== false) toast(label, { undo: true, long: !!o.long, say: false });
    say((o.sayText ?? label) + (o.sayStatus === false ? "" : statusSay(nowFull)));
    bump();
    return true;
  }
  /** Edit the current version's slots. */
  const editSlots = (L: Lineup, f: (slots: Lineup["slots"]) => Lineup["slots"]) => withVer(L, S.version, { slots: f(slotsOf(L, S.version)) });

  // ── slices ─────────────────────────────────────────────────────────────────────────────────────────────
  function sliceInit(nm: string): unknown {
    const d = sliceDefs[nm];
    const v = typeof d === "function" ? (d as (W: PzWorld, P: PzApi) => unknown)(S.W, api) : d;
    return v === undefined ? undefined : structuredClone(v);
  }
  function slice<T>(nm: string, init?: T | ((W: PzWorld, P: PzApi) => T)): PzSlice<T> {
    if (init !== undefined && !(nm in sliceDefs)) sliceDefs[nm] = init;
    if (!(nm in S.slices) && nm in sliceDefs) S.slices[nm] = sliceInit(nm);
    return {
      get: () => S.slices[nm] as T,
      set: (patch, o = {}) => {
        const before = structuredClone(S.slices[nm]) as T;
        const next = typeof patch === "function" ? (patch as (s: T) => T)(structuredClone(before)) : ({ ...before, ...patch } as T);
        S.slices[nm] = next;
        if (o.undoable !== false) {
          const after = structuredClone(next);
          pushHist(
            o.label ?? "Cambio",
            () => {
              S.slices[nm] = structuredClone(before);
              emit("slice:" + nm, S.slices[nm]);
            },
            () => {
              S.slices[nm] = structuredClone(after);
              emit("slice:" + nm, S.slices[nm]);
            },
          );
        }
        emit("slice:" + nm, next);
        if (o.label && o.toast !== false) toast(o.label, { undo: o.undoable !== false, long: !!o.long });
        else bump();
        return next;
      },
      reset: () => {
        S.slices[nm] = sliceInit(nm);
        bump();
      },
    };
  }

  // ── drag (one controller; targets declare data-pz-drop) ────────────────────────────────────────────────
  const DR: { start: { x: number; y: number; pid: string; from: "campo" | "banquillo"; slot: number | null; touch: boolean } | null; timer: ReturnType<typeof setTimeout> | undefined; held: boolean; suppress: number; ghost: ((x: number, y: number) => void) | null } = { start: null, timer: undefined, held: false, suppress: 0, ghost: null };
  function dropKey(x: number, y: number): string | null {
    if (typeof document === "undefined" || !document.elementFromPoint) return null;
    const el = document.elementFromPoint(x, y);
    const t = el?.closest?.("[data-pz-drop]");
    return t ? t.getAttribute("data-pz-drop") : null;
  }
  function beginDrag() {
    if (!DR.start) return;
    S.drag = { pid: DR.start.pid, from: DR.start.from, slot: DR.start.slot, x: DR.start.x, y: DR.start.y, label: name(DR.start.pid) };
    S.sel = null;
    say("Arrastrando a " + name(DR.start.pid) + ". Suéltalo en un puesto, sobre otro jugador o en el banquillo.");
  }
  function dragMove(e: PointerEvent) {
    if (!DR.start) return;
    const dx = e.clientX - DR.start.x;
    const dy = e.clientY - DR.start.y;
    if (!S.drag) {
      const far = Math.abs(dx) + Math.abs(dy) > 7;
      if (DR.start.touch && DR.start.from === "campo") {
        if (far && !DR.held) cancelDrag();
        return;
      }
      // (from the bench strip a sideways move scrolls it)
      if (DR.start.touch && DR.start.from === "banquillo" && far && Math.abs(dx) > Math.abs(dy) * 1.2 && !DR.held) {
        cancelDrag();
        return;
      }
      if (!far && !DR.held) return;
      beginDrag();
    }
    if (!S.drag) return;
    S.drag.x = e.clientX;
    S.drag.y = e.clientY;
    DR.ghost?.(e.clientX, e.clientY);
    const k = dropKey(e.clientX, e.clientY);
    if (k !== S.over) {
      S.over = k;
      bump();
    }
    if (e.cancelable) e.preventDefault();
  }
  function unlisten() {
    window.removeEventListener("pointermove", dragMove);
    window.removeEventListener("pointerup", dragUp);
    window.removeEventListener("pointercancel", cancelDrag);
  }
  function dragUp(e: PointerEvent) {
    if (!DR.start) return;
    if (DR.timer) clearTimeout(DR.timer);
    const was = S.drag;
    unlisten();
    const start = DR.start;
    DR.start = null;
    if (!was) {
      if (DR.held) DR.suppress = Date.now() + 450;
      DR.held = false;
      return;
    }
    DR.suppress = Date.now() + 450;
    DR.held = false;
    const k = dropKey(e.clientX, e.clientY);
    S.drag = null;
    S.over = null;
    if (!k) {
      say("Vuelve a su sitio");
      return;
    }
    act.dropOn({ pid: start.pid, from: start.from, slot: start.slot }, k);
  }
  function cancelDrag() {
    if (DR.timer) clearTimeout(DR.timer);
    if (typeof window !== "undefined") unlisten();
    DR.start = null;
    DR.held = false;
    if (S.drag) {
      S.drag = null;
      S.over = null;
      bump();
    }
  }

  // ── the stage: what the pitch shows ────────────────────────────────────────────────────────────────────
  function prefs(): PzPrefs {
    return host.prefs() ?? readLocalPrefs();
  }
  function stageDefaults(place: PzRoute["place"]): StageSpec {
    const b = board();
    const m = me();
    const ro = !canEdit(b);
    const d: StageSpec = { source: "siete", camera: "pizarra", focus: null, rival: false, drawings: place === "siete", editable: !ro, overlay: null, marks: null, glideMs: 420, chrome: true, caption: "" };
    if (place === "siete" && ro && b?.isOfficial && !m.cap) d.camera = "grada";
    if (place === "plan") Object.assign(d, { rival: true, editable: false });
    if (place === "jugadas") Object.assign(d, { source: "jugada", editable: false });
    if (place === "partido") Object.assign(d, { source: "ahora", camera: "grada", editable: false });
    if (place === "pachanga") Object.assign(d, { source: "pachanga", editable: false });
    if (place === "tableros") Object.assign(d, { source: "none", editable: false });
    if (place === "charla") Object.assign(d, { camera: "grada", editable: false, chrome: false });
    const pf = prefs();
    if ((pf.camara === "pizarra" || pf.camara === "grada") && place !== "charla") d.camera = pf.camara;
    if (pf.mov === "menos") d.glideMs = 0;
    return d;
  }
  function rivalOf(b: PzBoard | null) {
    const r = b?.lineup.rival;
    if (!r) return null;
    const spots = rivalSpots(r);
    return { name: match(b?.matchId)?.rival ?? "Rival", players: r.players.map((p, i) => ({ num: p.num ?? null, note: p.note ?? "", x: spots[i]?.x ?? 50, y: spots[i]?.y ?? 20, code: FORMATIONS[r.formation][i]?.position ?? "" })) };
  }

  // ── navigation ─────────────────────────────────────────────────────────────────────────────────────────
  function hrefOf(url: string): string {
    const u = new URL(url, "http://x");
    const r = parsePizarra(u.pathname, Object.fromEntries(u.searchParams));
    const q: Record<string, string> = { ...r.q };
    if (!q.tablero && S.boardId && S.boardId !== "nuevo") q.tablero = S.boardId;
    const season = host.season();
    if (season) q.season = season;
    return r.place === "perdido" ? u.pathname : pizarraHref(r.place, r.sub, q);
  }
  /** A View Transition will run (supported, motion allowed). */
  function vtRuns(): boolean {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    return typeof document !== "undefined" && typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === "function" && !reduce;
  }
  function vt(fn: () => void) {
    const doc = typeof document !== "undefined" ? (document as Document & { startViewTransition?: (cb: () => Promise<void>) => unknown }) : null;
    if (!doc?.startViewTransition || !vtRuns()) {
      fn();
      return;
    }
    // The callback waits for the router to show the new address (or 400 ms), then ONE TASK for React to commit it.
    // Never a frame: while the update callback runs the page does not render, so requestAnimationFrame never fires —
    // Chrome then gives up after 4 s, aborts the transition and the screen stays frozen all that time (measured:
    // a 4 s frame on every change of place, impl/perf/BEFORE.txt). The store's update is a sync React update
    // (useSyncExternalStore, flushed in a microtask), so it has committed when the task runs.
    const waitRoute = (from: PzRoute) =>
      new Promise<void>((res) => {
        // (a router that answered while `fn` ran: the address is in already)
        if (S.route !== from) return res();
        const t = setTimeout(res, 400);
        routeWaiters.push(() => {
          clearTimeout(t);
          res();
        });
      }).then(() => new Promise<void>((r) => setTimeout(r, 0)));
    try {
      doc.startViewTransition(() => {
        const from = S.route;
        fn();
        return waitRoute(from);
      });
    } catch {
      fn();
    }
  }
  /** The sheet's address: ?hoja=<name> + its primitive arguments. */
  function sheetHref(name_: string | null, args: Record<string, unknown> = {}): string {
    const q: Record<string, string> = {};
    for (const [k, v] of Object.entries(S.route.q)) if (k !== "hoja" && !(S.sheet && k in S.sheet.args)) q[k] = v;
    if (name_) {
      q.hoja = name_;
      for (const [k, v] of Object.entries(args)) if (typeof v === "string" || typeof v === "number") q[k] = String(v);
    }
    const season = host.season();
    if (season) q.season = season;
    return S.route.place === "perdido" ? "/pizarra/siete" : pizarraHref(S.route.place, S.route.sub, q);
  }
  function applySheetFromRoute(q: Record<string, string>) {
    const want = q.hoja;
    if (!want) {
      if (S.sheet) {
        S.sheet = null;
        S.slotPick = null;
        sheetPushed = false;
      }
      return;
    }
    if (S.sheet?.name === want) return;
    const args: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(q)) if (!["hoja", "tablero", "capa", "modo", "season"].includes(k)) args[k] = /^\d+$/.test(v) ? Number(v) : v;
    if (want === "ficha" && typeof args.jugador === "string") args.pid = args.jugador;
    S.sheet = { name: want, args, title: "", kicker: "" };
    if (want === "candidatos" && typeof args.hueco === "number") S.slotPick = args.hueco;
    emit("sheet", { name: want });
  }

  // ── actions ────────────────────────────────────────────────────────────────────────────────────────────
  const act: PzAct = {
    place(pid, i) {
      const v = ver();
      const slot = v?.slots[i];
      if (!v || !slot) return;
      const r = rsvp(pid);
      if (!r.can) {
        toast(name(pid) + ": " + (r.why || r.t).toLowerCase() + ". No se puede colocar", { icon: "warn" });
        return;
      }
      const from = v.slots.findIndex((s) => s.playerId === pid);
      if (from === i) {
        S.sel = null;
        bump();
        return;
      }
      const prev = slot.playerId;
      const lbl = from >= 0 ? (prev ? `Cambio: ${name(pid)} por ${name(prev)}` : `${name(pid)} al ${slot.code}`) : prev ? `${name(pid)} entra por ${name(prev)}` : `${name(pid)} al ${slot.code}`;
      S.sel = null;
      S.slotPick = null;
      commit(lbl, (L) =>
        editSlots(L, (slots) => {
          let next = setPid(slots, i, pid);
          if (from >= 0) next = setPid(next, from, prev);
          return next;
        }),
      );
      if (S.sheet?.name === "candidatos") act.closeSheet();
    },
    swap(i, j) {
      const v = ver();
      if (!v || i === j || !v.slots[i] || !v.slots[j]) return;
      const a = v.slots[i].playerId;
      const c = v.slots[j].playerId;
      S.sel = null;
      commit(c ? `Cambio: ${name(a)} por ${name(c)}` : `${name(a)} al ${v.slots[j].code}`, (L) => editSlots(L, (slots) => setPid(setPid(slots, i, c), j, a)));
    },
    remove(i) {
      const pid = ver()?.slots[i]?.playerId;
      if (!pid) return;
      S.sel = null;
      commit(name(pid) + " al banquillo", (L) => editSlots(L, (slots) => setPid(slots, i, null)));
    },
    moveTo(pid, i) {
      const v = ver();
      if (!v) return;
      const from = v.slots.findIndex((s) => s.playerId === pid);
      if (from >= 0) act.swap(from, i);
      else act.place(pid, i);
      act.closeSheet();
    },
    setSistema(id) {
      const v = ver();
      if (!v || v.formation === id) return;
      const def = SYSTEMS_CATALOGUE.find((s) => s.id === id);
      commit(`Sistema ${id}${def ? " · " + def.name : ""}`, (L) => withVer(L, S.version, { formation: id, freeMode: false, slots: slotsForSystem(slotsOf(L, S.version), id) }), { sayStatus: false });
      emit("sistema", { id });
    },
    cycleSistema(dir) {
      const v = ver();
      const ids = SYSTEMS_CATALOGUE.map((s) => s.id);
      const k = ids.indexOf(v ? v.formation : "2-3-1");
      act.setSistema(ids[(k + dir + ids.length) % ids.length]);
    },
    setFree(on) {
      const v = ver();
      if (!v) return;
      commit(on ? "Forma libre: cada uno donde lo sueltes" : "Vuelve al " + v.formation, (L) => withVer(L, S.version, on ? { freeMode: true } : { freeMode: false, slots: slotsForSystem(slotsOf(L, S.version), v.formation) }), { sayStatus: false });
    },
    nudge(i, x, y) {
      const pid = ver()?.slots[i]?.playerId;
      commit(name(pid) + " recolocado", (L) => withVer(L, S.version, { freeMode: true, slots: slotsOf(L, S.version).map((s, k) => (k === i ? { ...s, x: Math.max(4, Math.min(96, Math.round(x / 5) * 5)), y: Math.max(4, Math.min(97, Math.round(y / 5) * 5)) } : { ...s })) }), { toast: false, sayStatus: false });
    },
    setVersion(v) {
      const b = board();
      const d = verDef(v);
      if (b && d.vid && !(b.lineup.variants ?? []).some((y) => y.id === d.vid)) {
        if (!canEdit(b)) return;
        const keep = S.version;
        S.version = v;
        const ok = commit(`Versión «${d.t}» creada: una copia del titular`, (L) => withVer(L, v, {}), { sayStatus: false });
        if (!ok) S.version = keep;
      }
      S.version = d.id;
      S.sel = null;
      S.slotPick = null;
      say(`En el campo: la versión «${d.t}»`);
      emit("version", { id: d.id });
    },
    removeVersion(v) {
      const d = verDef(v);
      if (!d.vid) return;
      S.version = "titular";
      commit(`Versión «${d.t}» quitada`, (L) => ({ ...L, variants: (L.variants ?? []).filter((y) => y.id !== d.vid) }), { long: true, sayStatus: false });
    },
    setRole(role, pid) {
      const g = GALONES.find((x) => x.role === role || x.k === role);
      const b = board();
      if (!g || !b) return;
      const off = b.lineup.roles[g.role] === pid;
      commit(off ? `${name(pid)} deja ${g.one}` : `${g.t}: ${name(pid)}`, (L) => {
        const next = toggleRole(L, g.role, pid);
        if (!off && g.role === "captainId" && next.roles.viceId === pid) return { ...next, roles: { ...next.roles, viceId: undefined } };
        if (!off && g.role === "viceId" && next.roles.captainId === pid) return { ...next, roles: { ...next.roles, captainId: undefined } };
        return next;
      }, { sayStatus: false });
    },
    setPlayAs(pid, code) {
      commit(code ? `${name(pid)} juega de ${posName(code).toLowerCase()} (${code}) en este siete` : `${name(pid)} vuelve a su puesto`, (L) => {
        const pp = { ...L.playerPositions };
        if (code) pp[pid] = code;
        else delete pp[pid];
        return { ...L, playerPositions: pp };
      }, { sayStatus: false });
    },
    suggest() {
      const picks = suggestion();
      if (!picks.filter(Boolean).length) {
        toast("No hay nadie disponible para sugerir");
        return;
      }
      commit("Siete sugerido: los que mejor encajan, por forma", (L) => editSlots(L, (slots) => slots.map((s, i) => ({ ...s, playerId: picks[i] ?? null }))));
    },
    startFrom(id) {
      const src = sources().find((s) => s.id === id);
      if (!src?.can || !src.formation || !src.slots) return;
      const f = src.formation;
      const ids = src.slots.map((s) => s.playerId);
      commit(`Empezado desde ${src.t.toLowerCase()} · ${src.s}`, (L) => withVer(L, S.version, { formation: f, freeMode: false, slots: slotsForSystem(slotsOf(L, S.version), f).map((s, i) => ({ ...s, playerId: ids[i] ?? null })) }));
      act.closeSheet();
    },
    clear() {
      commit("Campo vacío", (L) => editSlots(L, (slots) => slots.map((s) => ({ ...s, playerId: null }))), { long: true });
    },
    saveBoard(patch, label, o = {}) {
      const b = board(o.boardId ?? undefined);
      if (!b) return false;
      if (!canEdit(b)) {
        toast(b.isOfficial ? "El oficial es de solo lectura: duplícalo para editarlo" : "Solo lectura: duplícalo para editarlo", { action: me().fuera || me().socia ? null : { t: "Duplicar", run: () => act.duplicate(b.id) } });
        return false;
      }
      const keys = Object.keys(patch) as (keyof Lineup)[];
      const before = structuredClone(Object.fromEntries(keys.map((k) => [k, b.lineup[k]]))) as Partial<Lineup>;
      const after = structuredClone(patch);
      const id = b.id;
      const write = (part: Partial<Lineup>) => {
        const cur = board(id === "nuevo" ? S.boardId : id);
        if (!cur) return;
        const next = { ...cur.lineup, ...structuredClone(part) };
        setLineup(cur.id, next);
        if (cur.id === S.boardId) host.commit(next);
        else host.save(cur.id, next);
      };
      write(after);
      if (o.undoable !== false) pushHist(label, () => write(before), () => write(after), "board");
      emit("board:saved", { boardId: id, keys });
      if (o.toast !== false) toast(label, { undo: o.undoable !== false, long: !!o.long });
      else bump();
      return true;
    },
    tapSlot(i) {
      if (Date.now() < DR.suppress) return;
      const b = board();
      const v = ver();
      const s = v?.slots[i];
      if (!s) return;
      if (!canEdit(b)) {
        if (s.playerId) act.openFicha(s.playerId);
        else say(`Hueco ${s.code} vacío`);
        return;
      }
      if (S.sel) {
        if (s.playerId && S.sel.pid === s.playerId) {
          const pid = S.sel.pid;
          S.sel = null;
          act.openFicha(pid);
          return;
        }
        if (S.sel.from === "campo" && S.sel.slot != null) {
          act.swap(S.sel.slot, i);
          return;
        }
        act.place(S.sel.pid, i);
        return;
      }
      if (s.playerId) {
        S.sel = { pid: s.playerId, from: "campo", slot: i };
        S.slotPick = null;
        say(name(s.playerId) + " en la mano: toca otro puesto, un hueco o uno del banquillo");
        return;
      }
      S.slotPick = i;
      act.openSheet("candidatos", { hueco: i });
      say(`Hueco ${s.code}: los que mejor encajan`);
    },
    tapBench(pid) {
      if (Date.now() < DR.suppress) return;
      if (!canEdit(board())) {
        act.openFicha(pid);
        return;
      }
      const r = rsvp(pid);
      if (!r.can) {
        toast(name(pid) + ": " + (r.why || r.t).toLowerCase() + ". No se puede colocar", { icon: "warn" });
        return;
      }
      if (S.sel?.pid === pid) {
        S.sel = null;
        act.openFicha(pid);
        return;
      }
      if (S.sel?.from === "campo" && S.sel.slot != null) {
        act.place(pid, S.sel.slot);
        return;
      }
      if (S.slotPick != null) {
        act.place(pid, S.slotPick);
        return;
      }
      S.sel = { pid, from: "banquillo", slot: null };
      say(name(pid) + " en la mano: toca un puesto o un hueco");
    },
    release() {
      if (S.sel || S.slotPick != null) {
        S.sel = null;
        S.slotPick = null;
        say("Suelto");
      }
    },
    select(pid, from = "campo", slot = null) {
      S.sel = pid ? { pid, from, slot } : null;
      bump();
    },
    dropOn(start, key) {
      const k = String(key).split(":");
      if (k[0] === "slot") {
        const i = Number(k[1]);
        if (start.from === "campo" && start.slot != null) act.swap(start.slot, i);
        else act.place(start.pid, i);
        return;
      }
      if (k[0] === "bench" && start.from === "campo" && start.slot != null) {
        act.remove(start.slot);
        return;
      }
      if (k[0] === "player") {
        const j = (ver()?.slots ?? []).findIndex((s) => s.playerId === k[1]);
        if (j >= 0) {
          if (start.from === "campo" && start.slot != null) act.swap(start.slot, j);
          else act.place(start.pid, j);
        }
        return;
      }
      bump();
    },
    publishCheck(): PublishCheck {
      const b = board();
      const M = match();
      const t = b ? verOf(b.lineup, "titular") : null;
      const st = status(t);
      const block = !b ? "Abre uno de tus tableros para publicarlo." : !st.gk ? "Pon un portero en la portería del titular para publicarlo." : st.n < 7 ? `Completa el titular para publicarlo (${st.n}/7).` : "";
      const started = !!M && (M.phase === "juego" || M.phase === "descanso" || M.phase === "jugado");
      return { block, warns: st.warns, st, M, started, versions: b ? VERS.filter((x) => verOf(b.lineup, x.id).exists).map((x) => x.t) : [] };
    },
    async publish(o = {}) {
      const chk = act.publishCheck();
      const b = board();
      if (chk.block || !b) {
        toast(chk.block || "Abre uno de tus tableros para publicarlo.", { icon: "warn" });
        return;
      }
      const id = S.boardId;
      const matchId = b.matchId ?? chk.M?.id ?? null;
      // the official it replaces (same match): «Deshacer» takes this one down but does not put that one back up
      const prev = S.W.official && S.W.official.boardId !== id ? board(S.W.official.boardId) : null;
      try {
        await host.publish({ convocatoria: o.convocatoria !== false && !chk.started, boardId: id, matchId });
      } catch (e) {
        toast("No se ha podido publicar: " + (e instanceof Error ? e.message : "inténtalo otra vez"), { icon: "warn" });
        return;
      }
      const name = b.name;
      pushHist(
        "Publicado como oficial",
        () => void host.unpublish(id),
        // redo publishes THAT board again, only while it is the one on screen (never whichever board is open now)
        () => {
          if (S.boardId !== id) {
            toast(`Para volver a publicar «${name}», ábrelo primero`, { icon: "warn" });
            return false;
          }
          host.publish({ convocatoria: false, boardId: id, matchId }).catch((e: unknown) => toast("No se ha podido publicar: " + (e instanceof Error ? e.message : "inténtalo otra vez"), { icon: "warn" }));
          return true;
        },
        "boards",
      );
      emit("publish", { boardId: id, started: chk.started });
      const was = prev ? ` · «${prev.name}» deja de ser el oficial (Deshacer no lo vuelve a publicar)` : "";
      toast((chk.started ? "Publicado sin avisar: el partido ya ha empezado" : "Publicado: el equipo recibe «Ya está el siete»") + was, { undo: true, long: true });
    },
    react(v) {
      const b = board();
      const m = me();
      if (!b?.isOfficial || m.fuera) return;
      const was = inputs.reactions?.mine ?? null;
      host.react(was === v ? null : v);
      emit("react", { v });
      toast(was === v ? "Opinión retirada" : v === "ok" ? "De acuerdo con el siete" : "Tienes dudas: los capitanes lo verán", { undo: () => host.react(was) });
    },
    openBoard(id) {
      if (!board(id)) return;
      host.open(id);
      S.version = "titular";
      S.sel = null;
      S.slotPick = null;
      act.go(pizarraHref(S.route.place === "perdido" ? "siete" : S.route.place, S.route.sub, { ...S.route.q, tablero: id }), { replace: true });
      emit("board", { id });
      say("Tablero «" + (board(id)?.name ?? "") + "»");
    },
    duplicate(id) {
      const m = me();
      const src = board(id ?? S.boardId);
      if (!src || m.fuera || m.socia) {
        toast("Para editar, entra con tu ficha");
        return;
      }
      void host
        .duplicate(id ?? null)
        .then((nid) => {
          if (typeof nid === "string") {
            // undo deletes the copy (with its 12 s); redo makes another one
            let undoDel: () => void = noop;
            pushHist("Copia creada", () => void (undoDel = host.remove(nid)), () => undoDel(), "boards");
            toast("Copia creada: ya puedes editar", { undo: true });
          } else toast("Copia creada: ya puedes editar");
          bump();
        })
        .catch((e: unknown) => toast("No se ha podido duplicar: " + (e instanceof Error ? e.message : "inténtalo otra vez"), { icon: "warn" }));
    },
    deleteBoard(id) {
      const b = board(id);
      if (!b || !canEdit(b) || b.isOfficial) return;
      let undo = host.remove(id);
      const hid = pushHist("«" + b.name + "» borrado", () => undo(), () => void (undo = host.remove(id)), "boards");
      toast("«" + b.name + "» borrado", { undo: true, long: true });
      return hid;
    },
    undoEntry(hid) {
      const k = S.hist.undo.findIndex((e) => e.id === hid);
      if (k < 0) return false;
      const [e] = S.hist.undo.splice(k, 1);
      e.undo();
      S.hist.redo.push(e);
      toast("Deshecho: " + e.label, { icon: "undo" });
      return true;
    },
    undo() {
      const e = S.hist.undo.pop();
      if (!e) {
        say("Nada que deshacer");
        return;
      }
      e.undo();
      S.hist.redo.push(e);
      toast("Deshecho: " + e.label, { icon: "undo" });
    },
    redo() {
      const e = S.hist.redo.pop();
      if (!e) {
        say("Nada que rehacer");
        return;
      }
      // (an entry may refuse: it stays to redo, and says why)
      if (e.redo() === false) {
        S.hist.redo.push(e);
        return;
      }
      S.hist.undo.push(e);
      toast("Rehecho: " + e.label, { icon: "redo" });
    },
    setLayer(id) {
      if (S.layer === id) return;
      S.layer = id;
      const L = LAYERS.find((x) => x.id === id);
      emit("layer", { id });
      say("Capa: " + (L ? L.t : id));
    },
    setCamera(c: Camera, focus) {
      S.stage = { ...S.stage, camera: c, focus: focus ?? (c === "foco" ? S.stage.focus : null) };
      emit("camera", { id: c });
      say("Cámara " + (c === "grada" ? "Grada" : c === "foco" ? "Foco" : "Pizarra"));
    },
    toggleCamera() {
      act.setCamera(S.stage.camera === "grada" ? "pizarra" : "grada");
    },
    setDrawing(on) {
      S.drawing = !!on;
      emit("drawing", { on: !!on });
      say(on ? "Dibujar: elige una herramienta" : "Dibujo guardado en el tablero");
    },
    setBench(patch) {
      S.bench = { ...S.bench, ...patch };
      bump();
    },
    setSheetHeight(h) {
      S.sheetH = h;
      bump();
    },
    openSheet(name_, args = {}, o = {}) {
      const already = S.sheet;
      S.sheet = { name: name_, args, title: o.title ?? "", kicker: o.kicker ?? "" };
      emit("sheet", { name: name_ });
      bump();
      // the address carries it (?hoja=): Atrás closes it; a sheet over a sheet replaces the entry
      const href = sheetHref(name_, args);
      sheetPushed = !already || sheetPushed;
      host.navigate(href, { replace: !!already });
    },
    closeSheet() {
      if (!S.sheet) return;
      const nm = S.sheet.name;
      const pushed = sheetPushed;
      const href = sheetHref(null);
      S.sheet = null;
      sheetPushed = false;
      if (nm === "candidatos") S.slotPick = null;
      emit("sheet", { name: null });
      bump();
      if (pushed && typeof window !== "undefined" && window.history.length > 1) window.history.back();
      else host.navigate(href, { replace: true });
    },
    openFicha(pid) {
      S.fichaPid = pid;
      act.openSheet("ficha", { jugador: pid, pid }, { title: name(pid) });
      say("Ficha de " + name(pid));
    },
    setPrimary(p) {
      S.primary = p;
      bump();
    },
    setStage(spec, o) {
      const next = o?.replace ? { ...stageDefaults(S.route.place), ...spec } : { ...S.stage, ...spec };
      // (a place sets its stage in an effect on arriving; the same stage again redrew the whole pizarra a second
      // time in every change of place — impl/perf: no change, no render)
      if (sameSpec(next, S.stage)) return;
      S.stage = next;
      bump();
    },
    go(url, o) {
      host.navigate(hrefOf(url), o);
    },
    back() {
      if (typeof window !== "undefined") window.history.back();
    },
    forward() {
      if (typeof window !== "undefined") window.history.forward();
    },
    dismissToast() {
      if (toastT) clearTimeout(toastT);
      S.toast = null;
      bump();
    },
    setPrefs(patch) {
      host.setPrefs(patch);
      bump();
    },
    retry() {
      host.retry();
      S.estado = "cargando";
      bump();
    },
  };
  // every action bumps (the ones above that only `say` already did)

  const sel: PzSel = {
    me,
    canEdit: (b) => canEdit(b === undefined ? board() : b),
    player,
    name,
    posName,
    shirt,
    fit,
    fitWord,
    band,
    notaWord,
    lastNota,
    match,
    rsvp,
    counts,
    board,
    boards: () => S.W.boards,
    official,
    ver,
    versions: (b0) => {
      const b = b0 === undefined ? board() : b0;
      return VERS.map((x) => ({ id: x.id, t: x.t, exists: !!(b && verOf(b.lineup, x.id).exists), cur: S.version === x.id }));
    },
    placed,
    status,
    links,
    chem,
    media,
    diff,
    candidates,
    suggestion,
    sources,
    galones,
    taker,
    headline,
    placeSub,
    placeBadge,
    shareSheet: (place) => placeReg(place ?? (S.route.place === "perdido" ? "siete" : S.route.place))?.share ?? "compartir",
    primary: (place) => {
      if (S.primary) return S.primary;
      const r = placeReg(place ?? (S.route.place === "perdido" ? "siete" : S.route.place));
      if (!r?.primary) return null;
      try {
        return r.primary(api);
      } catch {
        return null;
      }
    },
    view: (spec) =>
      resolveView(
        { ...S.stage, ...(spec ?? {}) },
        {
          S,
          board,
          ver,
          player,
          name,
          rsvp,
          fit,
          fitWord,
          galones,
          links,
          diff,
          canEdit,
          rivalOf,
          me,
        },
      ),
    stage: () => S.stage,
    busy: () =>
      S.saveStatus === "saving" ||
      S.saveStatus === "error" ||
      S.saveStatus === "offline" ||
      !!S.sheet ||
      S.drawing ||
      !!S.drag ||
      S.route.place === "charla" ||
      Date.now() < holdUntil,
    histTop: () => {
      const e = S.hist.undo[S.hist.undo.length - 1];
      return e ? { id: e.id, scope: e.scope, label: e.label } : null;
    },
    canUndo: () => S.hist.undo.length > 0,
    canRedo: () => S.hist.redo.length > 0,
    undoLabel: () => S.hist.undo[S.hist.undo.length - 1]?.label ?? "",
    redoLabel: () => S.hist.redo[S.hist.redo.length - 1]?.label ?? "",
    saveLine: () => {
      const b = board();
      if (S.estado === "cargando") return { t: "Cargando…", icon: "clock", tone: "mute" };
      if (S.estado === "error") return { t: "Sin leer · reintenta", icon: "warn", tone: "bad" };
      if (!b) return { t: "", icon: "", tone: "mute" };
      if (b.draft) return { t: "Nuevo · se guarda solo", icon: "edit", tone: "mute" };
      if (!canEdit(b)) return { t: b.isOfficial ? "Solo lectura" : "De @" + b.ownerNick, icon: "lock", tone: "mute" };
      if (S.estado === "offline" || S.saveStatus === "offline") return { t: "Sin conexión · guardado en este móvil", icon: "offline", tone: "warn" };
      if (S.saveStatus === "error") return { t: "No se ha guardado · reintentando", icon: "warn", tone: "bad" };
      if (S.saveStatus === "saving") return { t: "Guardando…", icon: "clock", tone: "mute" };
      return { t: S.saved ? "Guardado " + fmt.hm(S.saved) : "Guardado", icon: "check", tone: "ok" };
    },
    reactions: () => inputs.reactions ?? { ok: 0, dudas: 0, mine: null },
    sheetMeta: () => {
      const sh = S.sheet;
      if (!sh) return null;
      const reg = sheetReg(sh.name);
      const pick = (x: unknown): string => {
        try {
          return typeof x === "function" ? String((x as (a: Record<string, unknown>, P: PzApi) => string)(sh.args, api)) : typeof x === "string" ? x : "";
        } catch {
          return "";
        }
      };
      return { title: sh.title || pick(reg?.title) || (sh.name === "ficha" ? name(sh.args.pid as string) : ""), kicker: sh.kicker || pick(reg?.kicker) };
    },
    prefs,
  };

  // the version the subscribers read
  const api: PzStore = {
    get v() {
      return version;
    },
    get state() {
      return S;
    },
    sel,
    act: new Proxy(act, {
      // every action ends with a bump (a no-op change costs one render) — but setStage, which bumps itself only
      // when the stage changed
      get(target, prop: string) {
        const f = target[prop];
        if (typeof f !== "function") return f;
        if (prop === "setStage") return f;
        return (...args: unknown[]) => {
          const r = (f as (...a: unknown[]) => unknown)(...args);
          bump();
          return r;
        };
      },
    }),
    drag: {
      begin(e, payload) {
        if (e.button > 0) return;
        cancelDrag();
        if (!canEdit(board())) return;
        DR.start = { x: e.clientX, y: e.clientY, pid: payload.pid, from: payload.from, slot: payload.slot, touch: e.pointerType === "touch" || e.pointerType === "pen" };
        DR.held = false;
        DR.timer = setTimeout(() => {
          if (!DR.start || S.drag) return;
          DR.held = true;
          try {
            navigator.vibrate?.(12);
          } catch {
            /* no vibration */
          }
          beginDrag();
          bump();
        }, 400);
        window.addEventListener("pointermove", dragMove, { passive: false });
        window.addEventListener("pointerup", dragUp);
        window.addEventListener("pointercancel", cancelDrag);
      },
      cancel: cancelDrag,
      onGhost(fn) {
        DR.ghost = fn;
      },
      active: () => !!S.drag,
      state: () => S.drag,
    },
    nav: (url) => {
      // a place not fetched yet (the idle preload hasn't reached it): wait for its chunk — ≤ 700 ms, the screen still
      // live — so the transition captures the new place drawn, not an empty region that pops in after it
      const goes = vtRuns() ? preloadPlace(parsePizarra(new URL(url, "http://x").pathname, {}).place) : null;
      if (!goes) {
        vt(() => act.go(url));
        return;
      }
      void Promise.race([goes.catch(() => undefined), new Promise<void>((r) => setTimeout(r, 700))]).then(() => vt(() => act.go(url)));
    },
    vt,
    toast,
    say,
    on(evt, fn) {
      (bus[evt] = bus[evt] ?? []).push(fn);
      return () => {
        bus[evt] = (bus[evt] ?? []).filter((x) => x !== fn);
      };
    },
    emit,
    slice: <T,>(nm: string, init?: T | ((W: PzWorld, P: PzApi) => T)) => slice<T>(nm, init),
    holdFor(ms) {
      holdUntil = Math.max(holdUntil, Date.now() + ms);
    },
    pushUndo(label, undo, redo, o) {
      const hid = pushHist(label, undo, redo, o?.scope ?? "place");
      if (o?.toast === false) bump();
      else toast(label, { undo: true, long: !!o?.long });
      return hid;
    },
    define(nm, fn) {
      sel[nm] = (...args: unknown[]) => fn(api, ...args);
    },
    action(nm, fn) {
      act[nm] = (...args: unknown[]) => fn(api, ...args);
    },
    subscribe(fn) {
      subs.push(fn);
      return () => {
        const k = subs.indexOf(fn);
        if (k >= 0) subs.splice(k, 1);
      };
    },
    get tv() {
      return quietV;
    },
    subscribeQuiet(fn) {
      quietSubs.push(fn);
      return () => {
        const k = quietSubs.indexOf(fn);
        if (k >= 0) quietSubs.splice(k, 1);
      };
    },
    layout: () => S.layout,
    estado: () => S.estado,
    route: () => S.route,

    attach(i) {
      const boardChanged = i.boardId !== S.boardId;
      inputs = i;
      S.W = i.W;
      S.me = i.me;
      S.estado = i.estado;
      S.error = i.error ?? "";
      S.saveStatus = i.saveStatus;
      S.saved = i.saved;
      if (boardChanged) {
        S.boardId = i.boardId;
        S.version = "titular";
        S.sel = null;
        S.slotPick = null;
        S.stage = { ...stageDefaults(S.route.place), ...pickPlaceStage(S.stage) };
      }
      for (const nm of Object.keys(sliceDefs)) if (!(nm in S.slices) || S.slices[nm] === undefined) S.slices[nm] = sliceInit(nm);
      bump();
    },
    setHost(h) {
      host = { ...host, ...h };
    },
    setRoute(r) {
      const prev = S.route;
      const changed = r.place !== prev.place;
      S.route = r;
      if (changed || !Object.keys(S.stage).length) {
        S.stage = stageDefaults(r.place);
        S.primary = null;
        S.sel = null;
        S.slotPick = null;
        if (S.drawing && r.place !== "siete" && r.place !== "jugadas") S.drawing = false;
      }
      if (r.q.capa && LAYERS.some((l) => l.id === r.q.capa)) S.layer = r.q.capa as LayerId;
      if (r.q.modo === "dibujar" && !S.drawing) S.drawing = true;
      if (r.q.alto === "peek" || r.q.alto === "half" || r.q.alto === "full") S.sheetH = r.q.alto;
      if (r.q.camara === "pizarra" || r.q.camara === "grada" || r.q.camara === "foco") S.stage = { ...S.stage, camera: r.q.camara };
      applySheetFromRoute(r.q);
      if (changed) {
        emit("route", { place: r.place, sub: r.sub, from: prev.place });
        say((placeOf(r.place) ?? { t: "Página no encontrada" }).t);
      } else bump();
      const w = routeWaiters;
      routeWaiters = [];
      w.forEach((f) => f());
    },
    setLayout(l) {
      if (S.layout === l) return;
      S.layout = l;
      bump();
    },
    inputs: () => inputs,
  };
  /** A board change keeps what the place set that is not about the board (its source, the camera). */
  /** Two stage specs with the same keys and the same values (by identity). */
  function sameSpec(a: StageSpec, b: StageSpec): boolean {
    const ka = Object.keys(a) as (keyof StageSpec)[];
    if (ka.length !== Object.keys(b).length) return false;
    return ka.every((k) => k in b && Object.is(a[k], b[k]));
  }
  function pickPlaceStage(s: StageSpec): StageSpec {
    const out: StageSpec = {};
    if (s.source) out.source = s.source;
    if (s.camera) out.camera = s.camera;
    return out;
  }

  // a late registration (a lazily loaded place) redraws
  onRegistry(bump);
  // the first layer: the device's default
  const pf = prefs();
  const capa = LAYERS.find((l) => l.id === pf.capa);
  if (capa) S.layer = capa.id;
  S.stage = stageDefaults(S.route.place);
  return api;
}

export { VERS };
export type { PzApi };
