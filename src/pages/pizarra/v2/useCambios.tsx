// The board's «día de partido» (Siete → Cambios and the live plate), wired: the plan's state (the scrub,
// «Rotar portero», the proposal of «Repartir minutos» / «Recalcular», who can't go on), what the pitch
// shows at the scrubbed minute, the live match (its clock from the match's date, the wake lock, «Hacer el
// cambio» through the admins' liveEvent), the keys of the tab and the galones in order. The board passes
// its commit and its one announcer; everything here is said through them.
import { useState, type ReactNode } from "react";
import type { Lineup, Sub, TakerKind } from "../formations";
import { newId } from "../drawings";
import { apiError, liveEvent } from "../../../lib/clubApi";
import { serverNow } from "../../../lib/serverTime";
import { slotZone } from "./geometry";
import { natOf, type Squad } from "./model";
import { toggleRole } from "./ops";
import { addSub, exactGrade, generateWaves, lineupAt, moveWave, nextWaveMinute, removeSub, replan, updateSub, wavesOf } from "./cambios";
import { cambiosPool, cambiosView, previewDiff, suggestSub } from "./cambiosView";
import { CambiosTab, type LiveCard } from "./CambiosTab";
import { durationOf, liveNow, liveWave, playedNow, plateAria, subProblem, subsMade, takersNow, waveLine, type LiveNow } from "./live";
import { LivePlate } from "./LivePlate";
import { ORDINAL, setTaker, TAKER_LABEL, takersOf } from "./takers";
import { useMatchClock, useWakeLock } from "./useMatchDay";
import type { CalMatch } from "./boards";

export interface CambiosCtx {
  L: Lineup;
  sq: Squad;
  /** The board's match convocatoria (null = none). */
  called: ReadonlySet<string> | null;
  canEdit: boolean;
  ready: boolean;
  roMsg: string;
  /** The board's linked match (its clock, its acta). */
  match: CalMatch | null;
  isAdmin: boolean;
  now: number;
  /** The tab is on screen. */
  open: boolean;
  commit: (next: Lineup) => void;
  say: (msg: string) => void;
  announce: (msg: string) => void;
  /** Opens Siete → Cambios (the live plate's tap). */
  onOpen: () => void;
  /** More for the live card (the conditional plan's suggestion, useTactica). */
  liveExtra?: (live: LiveNow) => ReactNode;
}

export interface Cambios {
  tab: ReactNode;
  plate: ReactNode;
  /** The seven the pitch shows (another minute while scrubbing). */
  pitch: Lineup;
  /** The pitch shows another minute: it can't be edited there. */
  preview: boolean;
  live: LiveNow | null;
  /** The tab's keys (handled = true). */
  key: (e: { key: string; shiftKey: boolean }) => boolean;
  add: () => void;
  repartir: () => void;
  hacer: () => void;
  scrubBy: (d: number) => void;
}

export function useCambios(c: CambiosCtx): Cambios {
  const { L, sq } = c;
  const [scrubPick, setScrubPick] = useState<{ key: string; t: number } | null>(null);
  const [rotK, setRotK] = useState(false);
  const [prop, setProp] = useState<{ title: string; subs: Sub[]; msg: string } | null>(null);
  const [off, setOff] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const nm = (id: string) => sq.byId.get(id)?.name ?? "Jugador";
  const subs = L.subs ?? [];
  const clock = useMatchClock(c.match, c.now);
  const live = liveNow(c.match, clock);
  useWakeLock(!!live);
  const D = live?.duration ?? durationOf(c.match);
  const pool = cambiosPool(L, sq, c.called);
  const made = live ? subsMade(subs, live.events) : new Set<string>();
  // (the scrub follows the live minute until it is moved; a new match starts it again)
  const skey = (c.match?.id ?? "") + ":" + (live ? "l" : "p");
  const scrub = Math.max(0, Math.min(D, scrubPick && scrubPick.key === skey ? scrubPick.t : live ? live.minute : 0));
  const setScrub = (t: number) => setScrubPick({ key: skey, t: Math.max(0, Math.min(D, Math.round(t))) });
  const shownSubs = prop?.subs ?? subs;
  const preview = c.open && scrub > 0;
  const pitch = preview ? lineupAt(L, shownSubs, scrub) : L;
  const zones = L.slots.map((_, i) => slotZone(L, i));
  const nat = (id: string) => natOf(L, sq, id);

  const edit = (next: Sub[], msg: string) => {
    if (!c.ready) return;
    if (!c.canEdit) {
      c.say(c.roMsg);
      return;
    }
    c.commit({ ...L, subs: next });
    c.say(msg);
  };
  const add = (min?: number) => {
    if (!c.canEdit) {
      c.say(c.ready ? c.roMsg : "Cargando el tablero…");
      return;
    }
    const m = min ?? nextWaveMinute(subs, D, live?.minute ?? 0);
    const s = suggestSub(L, subs, pool, m, D, newId("s"));
    if (!s) {
      c.say("No hay nadie en el banquillo para entrar");
      return;
    }
    const next = addSub(subs, s);
    if (next.length === subs.length) {
      c.say("Como mucho 20 cambios por tablero");
      return;
    }
    edit(next, "Cambio en el " + m + "′: entra " + nm(s.in) + " por " + nm(s.out));
    setScrub(m);
  };
  const setOut = (id: string, out: string) => edit(updateSub(subs, id, { out }), "Sale " + nm(out));
  const setIn = (id: string, inn: string) => edit(updateSub(subs, id, { in: inn }), "Entra " + nm(inn));
  const del = (id: string) => {
    const s = subs.find((x) => x.id === id);
    edit(removeSub(subs, id), s ? "Cambio quitado: " + nm(s.in) + " por " + nm(s.out) + " en el " + s.min + "′" : "Cambio quitado");
  };
  const move = (from: number, to: number) => {
    const next = moveWave(subs, from, to, D);
    const m = next.find((_, k) => subs[k].min === from)?.min ?? from;
    if (m === from) return;
    if (subs.some((s) => s.min === m)) {
      // (two tandas at the same minute are one)
      edit(next, "Tanda del " + from + "′ junto a la del " + m + "′");
    } else edit(next, "Tanda al " + m + "′");
    setScrub(m);
  };
  const propose = (title: string, next: Sub[], msg: string) => {
    setProp({ title, subs: next, msg });
    const w = wavesOf(next).length;
    c.announce(title + ": " + (next.length ? w + (w === 1 ? " tanda" : " tandas") + ", " + next.length + (next.length === 1 ? " cambio" : " cambios") + ". «Aplicar» para guardarlo" : "sin cambios posibles"));
  };
  const repartir = () => {
    if (!c.canEdit) {
      c.say(c.ready ? c.roMsg : "Cargando el tablero…");
      return;
    }
    if (live) {
      recalc();
      return;
    }
    const seats = L.slots.map((s) => s.playerId ?? null);
    const bench = pool.filter((id) => !seats.includes(id));
    const next = generateWaves({ seats, zones, pool: bench, from: 0, duration: D, rotateKeeper: rotK, nat, grade: exactGrade(L, sq, [...seats, ...bench]), newId: () => newId("s") });
    propose("Repartir minutos", next, "Minutos repartidos");
  };
  const recalc = () => {
    if (!live) return;
    if (!c.canEdit) {
      c.say(c.roMsg);
      return;
    }
    const grade = exactGrade(L, sq, [...live.field, ...live.bench]);
    const next = replan({ L, subs, from: live.minute, duration: D, field: live.field, pool: live.bench, played: playedNow(live), unavailable: off, rotateKeeper: rotK, nat, grade, zones, newId: () => newId("s") });
    propose("Recalcular desde el " + live.shown + "′", next, "Plan recalculado desde el " + live.shown + "′");
  };
  const apply = () => {
    if (!prop) return;
    edit(prop.subs, prop.msg + ": " + (prop.subs.length ? wavesOf(prop.subs).map((w) => w.min + "′").join(", ") : "sin cambios"));
    setProp(null);
  };

  // ── live: «Hacer el cambio» (captains: the acta records it, as in the admin's En juego) ──
  const lw = live ? liveWave(subs, live) : null;
  const hacer = () => {
    if (!live || !lw || !c.match || busy) return;
    if (!c.isAdmin) {
      c.say("Solo los capitanes apuntan los cambios en el acta");
      return;
    }
    const m = c.match;
    const todo = lw.pending;
    const first = todo.map((s) => subProblem(m, live, s, serverNow(), nm)).find(Boolean);
    if (first) {
      c.say(first);
      return;
    }
    setBusy(true);
    const run = async () => {
      for (const s of todo) await liveEvent({ action: "add", matchId: m.id, requestId: crypto.randomUUID(), clockRevision: m.clock?.revision, event: { type: "substitution", minute: live.minute, playerId: s.out, inPlayerId: s.in } });
    };
    run().then(
      () => {
        setBusy(false);
        c.say("En el acta, " + live.shown + "′: " + todo.map((s) => "entra " + nm(s.in) + " por " + nm(s.out)).join(", "));
      },
      (e: unknown) => {
        setBusy(false);
        c.say("No se ha podido apuntar: " + apiError(e));
      },
    );
  };

  const scrubBy = (d: number) => {
    setScrub(scrub + d);
    const t = Math.max(0, Math.min(D, scrub + d));
    c.announce("Minuto " + t);
  };
  const key = (e: { key: string; shiftKey: boolean }): boolean => {
    const k = e.key.toLowerCase();
    if (k === "," || k === ".") {
      scrubBy((k === "," ? -1 : 1) * (e.shiftKey ? 5 : 1));
      return true;
    }
    if (k === "n") {
      add();
      return true;
    }
    if (k === "m") {
      repartir();
      return true;
    }
    if (k === "h" && live && c.isAdmin) {
      hacer();
      return true;
    }
    return false;
  };

  // ── the galones in order ──
  const t = takersOf(L);
  const onCaptain = (role: "captainId" | "viceId", id: string) => {
    if (!c.canEdit) return c.say(c.roMsg);
    const cur = L.roles[role];
    const word = role === "captainId" ? "Capitán" : "Vice-capitán";
    if (!id) {
      if (cur) c.commit(toggleRole(L, role, cur));
      c.say(word + ": nadie");
      return;
    }
    c.commit(toggleRole(L, role, id));
    c.say(word + ": " + nm(id));
  };
  const onTaker = (kind: TakerKind, pos: number, id: string) => {
    if (!c.canEdit) return c.say(c.roMsg);
    const cur = t[kind][pos];
    if (!id) {
      if (cur) c.commit(setTaker(L, kind, cur, pos));
      c.say(TAKER_LABEL[kind] + ": sin " + ORDINAL[pos]);
      return;
    }
    c.commit(setTaker(L, kind, id, Math.min(pos, t[kind].filter((x) => x !== id).length)));
    c.say(TAKER_LABEL[kind] + ": " + nm(id) + " " + ORDINAL[pos]);
  };

  const card: LiveCard | null = live
    ? {
        minute: live.minute,
        shown: live.shown,
        score: "Piti " + live.gf + "–" + live.ga + " " + live.rival,
        line: waveLine(lw),
        due: !!lw?.due,
        pending: (lw?.pending ?? []).map((s) => ({ id: s.id, txt: "Sale " + nm(s.out) + " → entra " + nm(s.in) })),
        canWrite: c.isAdmin,
        busy,
        actaHref: c.isAdmin && c.match ? "/admin/en-juego/" + encodeURIComponent(c.match.id) : null,
        people: [...live.field, ...live.bench].map((id) => ({ id, label: nm(id), field: live.field.includes(id), off: off.has(id) })),
        takers: takersNow(t, live.field, nm),
      }
    : null;
  const tab = c.open ? (
    <CambiosTab
      v={cambiosView({ L, sq, subs: shownSubs, pool, duration: D, keeperFixed: !rotK, scrub, minute: live?.minute ?? null, made })}
      ro={!c.canEdit}
      live={card}
      liveExtra={live ? c.liveExtra?.(live) : null}
      rotK={rotK}
      preview={prop ? { title: prop.title, ...previewDiff(L, subs, prop.subs, pool, D, sq) } : null}
      takers={{ options: pool.map((id) => ({ id, label: (sq.byId.get(id)?.num ?? "–") + " · " + nm(id) })), captainId: L.roles.captainId ?? "", viceId: L.roles.viceId ?? "", lists: t }}
      onScrub={(x) => setScrub(x)}
      onNow={live ? () => setScrubPick(null) : undefined}
      onAdd={add}
      onOut={setOut}
      onIn={setIn}
      onDel={del}
      onMoveWave={move}
      onRepartir={repartir}
      onRotK={() => {
        setRotK(!rotK);
        setProp(null);
        c.announce(!rotK ? "El portero también rota" : "El portero, fijo");
      }}
      onApply={apply}
      onDiscard={() => {
        setProp(null);
        c.announce("Propuesta descartada");
      }}
      onHacer={hacer}
      onRecalc={recalc}
      onOff={(id) => {
        const next = new Set(off);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setOff(next);
        setProp(null);
        c.announce(nm(id) + (next.has(id) ? ": no puede seguir" : ": disponible"));
      }}
      onCaptain={onCaptain}
      onTaker={onTaker}
    />
  ) : null;
  const plate = live ? <LivePlate minute={live.shown} gf={live.gf} ga={live.ga} next={lw} aria={plateAria(live)} onOpen={c.onOpen} /> : null;
  return { tab, plate, pitch, preview, live, key, add: () => add(), repartir, hacer, scrubBy };
}
