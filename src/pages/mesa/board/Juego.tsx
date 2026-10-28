// La mesa (r12) · en juego: the pitch is the keyboard. On the phone, read at the top, the seven printed shirts in the
// middle (the pitch asks in its own row, never over a shirt), the bench, and everything touched at the bottom (the
// rival's row with its code, «Gol del Piti» in gold, the verbs). On the tablet and the desktop, three regions: the
// pitch with its bench, «Lo que va pasando» beside it, and the action row with its keys.
import type { CSSProperties } from "react";
import type { MesaView } from "../types";
import { benchRows, captainNow, glyphOf, latestFirst, lenCls, metaOf, minText, pitchTokens, plural, upper, whyNot, type Token } from "./derive";
import { Icon, Kbd, Shirt } from "./parts";
import { placeWord, type Mode, type useBoard } from "./useBoard";

type B = ReturnType<typeof useBoard>;
const ACT: Record<string, string> = {
  tarjeta: "Tarjeta", foul: "Falta hecha", chance: "Ocasión", woodwork: "Al palo", foul_received: "Le hacen falta", penalty_received: "Penalti a favor",
  penalty_committed: "Penalti en contra", goal_penalty: "Gol de penalti", goal_freekick: "Gol de falta", penalty_missed: "Penalti fallado", own_goal: "En propia", injury: "Tocado",
};

export function Ask({ v, b, now }: { v: MesaView; b: B; now: number }) {
  const m = b.mode;
  if (!m)
    return (
      <div className="me-ask" role="status" aria-live="polite">
        <p className="me-ask__idle"><b>En el campo</b><span>toca una camiseta para apuntarle algo</span></p>
      </div>
    );
  const left = "until" in m ? Math.max(0, Math.ceil((m.until - now) / 1000)) : 0;
  const cancel = { t: "Cancelar", cls: "", go: () => b.setMode(null) };
  let q = "";
  let sub = "";
  let btns: { t: string; cls: string; go: () => void }[] = [cancel];
  const goal = "ev" in m ? v.events.find((e) => e.id === m.ev) : undefined;
  if (m.k === "scorer") {
    q = "¿Quién marcó?";
    sub = `Gol del Piti, minuto ${goal?.minute ?? v.match.clock.minute} · toca su camiseta`;
    btns = [{ t: "Autogol suyo", cls: "", go: () => b.ownGoalTheirs(m.ev) }, { t: "Lo apunto luego", cls: "", go: b.laterScorer }];
  } else if (m.k === "assist") {
    q = "¿Y el pase?";
    sub = `Gol de ${v.nameOf(m.scorer)} · toca quién se la dio`;
    btns = [{ t: "Sin pase", cls: "is-pri", go: () => b.setAssist(m.ev, m.scorer, null) }];
  } else if (m.k === "in") {
    q = `Entra ${v.nameOf(m.pid)}`;
    sub = "¿Por quién? Toca quién sale";
  } else if (m.k === "outFrom") {
    q = `Sale ${v.nameOf(m.pid)}`;
    sub = "¿Quién entra? Toca en el banquillo";
  } else if (m.k === "pickSub") {
    q = "Cambio";
    sub = "Toca quién sale en el campo, o quién entra en el banquillo";
  } else if (m.k === "hole") {
    q = `Hueco de ${v.nameOf(m.pid)}`;
    sub = "Toca en el banquillo quién entra";
  } else if (m.k === "pick") {
    q = `${ACT[m.act] ?? "Jugada"}: ¿de quién?`;
    const taker = m.act === "goal_penalty" || m.act === "penalty_missed" ? v.galones.takers.penalties.find((id) => v.field.some((p) => p.id === id)) : m.act === "goal_freekick" ? v.galones.takers.freekicks.find((id) => v.field.some((p) => p.id === id)) : undefined;
    sub = taker ? `Toca su camiseta · en la pizarra lo lanza ${v.nameOf(taker)}` : "Toca su camiseta";
  } else if (m.k === "swap") {
    q = m.a ? `¿Con quién cambia el sitio ${v.nameOf(m.a)}?` : "Recolocar";
    sub = m.a ? "Toca a un compañero" : `Toca a dos jugadores y se cambian el sitio${m.n ? ` · ${plural(m.n, "pareja hecha", "parejas hechas")}` : ""}`;
    btns = [{ t: "Hecho", cls: "is-pri", go: () => b.setMode(null) }];
  }
  const gold = m.k === "scorer" || m.k === "assist";
  return (
    <div className={`me-ask is-${m.k}${gold ? " is-gold" : ""}`} role="status" aria-live="polite">
      <p className="me-ask__q">
        <b>{q}</b>
        <span>{sub}</span>
        {left > 0 && <i className="me-ask__left">quedan {left} s</i>}
      </p>
      <div className="me-ask__b">
        {btns.map((x) => (
          <button key={x.t} type="button" className={`vd-btn vd-glass vd-press vd-btn--sm me-askbtn ${x.cls}`.trim()} onClick={x.go}>{x.t}</button>
        ))}
      </div>
    </div>
  );
}

const verbFor = (m: Mode | null): string => {
  if (!m) return "abrir sus acciones";
  if (m.k === "scorer") return "marcó él";
  if (m.k === "assist") return "le dio el pase";
  if (m.k === "in" || m.k === "pickSub") return "sale él";
  if (m.k === "swap") return "cambiar de sitio";
  if (m.k === "pick") return ACT[m.act] ?? "apuntar";
  return "";
};

function Man({ v, b, t }: { v: MesaView; b: B; t: Token }) {
  const m = b.mode;
  const p = t.player;
  const name = upper(p.name);
  const style = { "--nx": t.nx, "--ny": t.ny } as CSSProperties;
  if (t.hole)
    return (
      <button type="button" className={`me-hole${m?.k === "in" ? " is-target" : ""}`} style={style} onClick={() => b.tapHole(p.id)} aria-label={`Hueco de ${p.name}, expulsado. Toca para que entre alguien`}>
        <span className="me-hole__c" aria-hidden="true">{t.code ?? ""}</span>
        <span className="me-hole__t" aria-hidden="true">Hueco</span>
        <span className="me-hole__n" aria-hidden="true">{name} · roja</span>
      </button>
    );
  let cls = "";
  let off = false;
  if (m) {
    if (m.k === "scorer" || m.k === "in" || m.k === "pick" || m.k === "pickSub") cls = "is-target";
    if (m.k === "assist") {
      if (m.scorer === p.id) {
        off = true;
        cls = "is-scorer";
      } else cls = "is-target";
    }
    if (m.k === "swap") cls = m.a === p.id ? "is-picked" : "is-target";
    if (m.k === "outFrom" || m.k === "hole") off = true;
    if (m.k === "outFrom" && m.pid === p.id) cls = "is-picked";
  }
  const s = p.stickers;
  const tags: { t: string; cls: string; l: string }[] = [];
  if (captainNow(v) === p.id) tags.push({ t: "C", cls: "is-cap", l: "capitán" });
  if (s.goals) tags.push({ t: s.goals > 1 ? `⚽${s.goals}` : "⚽", cls: "is-gol", l: plural(s.goals, "gol", "goles") });
  if (s.yellow && !s.red) tags.push({ t: "A", cls: "is-am", l: "amarilla" });
  if (s.red) tags.push({ t: "R", cls: "is-roja", l: "roja" });
  if (s.injured) tags.push({ t: "+", cls: "is-hurt", l: "tocado" });
  if (p.pending) tags.push({ t: `↓${p.pending}`, cls: "is-loc", l: plural(p.pending, "jugada sin subir", "jugadas sin subir") });
  const label = `${p.name}, ${placeWord(t.code)}, ${p.minutes} minutos${tags.length ? `, ${tags.map((x) => x.l).join(", ")}` : ""}: ${verbFor(m)}`;
  return (
    <button type="button" className={`me-man ${cls}`.trim()} style={style} onClick={() => !off && b.tapField(p.id)} aria-label={label} aria-disabled={off}>
      <Shirt kit={v.match.kit} num={p.guest ? undefined : p.number} className="me-man__shirt sc-morph" style={{ viewTransitionName: `me-p-${p.id.replace(/[^\w-]/g, "").slice(0, 24)}` }} />
      <span className="me-man__l" aria-hidden="true">
        <span className={`me-man__n ${lenCls(name)}`.trim()}>{name}</span>
        <span className="me-man__m">{p.minutes}′</span>
      </span>
      {tags.length > 0 && (
        <span className="me-man__tags" aria-hidden="true">
          {tags.map((x) => <i key={x.cls} className={`me-stk ${x.cls}`}>{x.t}</i>)}
        </span>
      )}
    </button>
  );
}

export const PitchLines = () => (
  <>
    <svg className="vd-pitch__lines me-lines--up" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect x="3" y="3" width="94" height="134" rx="2" /><line x1="3" y1="70" x2="97" y2="70" /><circle cx="50" cy="70" r="11" /><rect x="28" y="3" width="44" height="17" /><rect x="28" y="120" width="44" height="17" /><rect x="40" y="3" width="20" height="6" /><rect x="40" y="131" width="20" height="6" /></svg>
    <svg className="vd-pitch__lines me-lines--side" viewBox="0 0 140 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect x="3" y="3" width="134" height="94" rx="2" /><line x1="70" y1="3" x2="70" y2="97" /><circle cx="70" cy="50" r="11" /><rect x="3" y="28" width="17" height="44" /><rect x="120" y="28" width="17" height="44" /><rect x="3" y="40" width="6" height="20" /><rect x="131" y="40" width="6" height="20" /></svg>
  </>
);

/** «Lo que va pasando» beside the pitch (tablet and desktop): the latest plays, a duplicate to settle, the plan. */
function Side({ v, b, plan }: { v: MesaView; b: B; plan: MesaView["plan"] }) {
  const dup = v.events.find((e) => e.dupOf);
  const rows = latestFirst(v.events).slice(0, 14);
  return (
    <aside className="me-side vd-reg-3" aria-labelledby="me-side-t">
      <header className="me-side__h">
        <h2 className="me-h3" id="me-side-t">Lo que va pasando</h2>
        <button type="button" className="vd-link me-side__all" onClick={v.nav.cronica}>{plural(v.events.length, "jugada", "jugadas")} ›</button>
      </header>
      {dup && <Dupe v={v} b={b} />}
      {plan.length > 0 && (
        <div className="me-planlist">
          <p className="me-planlist__h"><b>El plan de la pizarra</b><span>«Toca» sale tres minutos antes de cada uno</span></p>
          <ul>{plan.map((x) => <li key={x.outId + x.inId}>{x.min != null ? `${x.min}′ · ` : ""}entra {upper(x.inName)} por {upper(x.outName)}</li>)}</ul>
        </div>
      )}
      <ol className="me-feed" aria-label="Las últimas jugadas">
        {rows.map((e) => (
          <li key={e.id} className={`me-feed__r is-${glyphOf(e.type)}`}>
            <span className="me-feed__m">{minText(e)}</span>
            <span className="me-feed__g" aria-hidden="true" />
            <span className="me-feed__t"><b>{e.text}</b><small>{metaOf(e)}</small></span>
            <button type="button" className="vd-ibtn vd-glass vd-press me-feed__e" onClick={() => b.editOpen(e)} aria-label={`Corregir: ${e.text}`} aria-haspopup="dialog"><Icon name="edit" /></button>
          </li>
        ))}
      </ol>
      {!v.events.length && <p className="me-small me-side__empty">Aún no ha pasado nada.</p>}
    </aside>
  );
}

/** «¿Es la misma jugada?»: two scorers wrote the same thing, or not. */
export function Dupe({ v, b }: { v: MesaView; b: B }) {
  const d = v.events.find((e) => e.dupOf);
  if (!d) return null;
  const o = v.events.find((e) => e.id === d.dupOf);
  const goal = !!d.goal;
  const who = (e: typeof d) => (e.mine ? "tú" : e.byName ?? "otro anotador");
  const gap = Math.abs((d.elapsedSeconds ?? 0) - (o?.elapsedSeconds ?? 0));
  return (
    <div className="me-dupe" role="group" aria-labelledby="me-dp-t">
      <p className="me-dupe__t"><b id="me-dp-t">¿Es la misma jugada?</b><span>{gap} s de diferencia</span></p>
      {o && <p className="me-small">{minText(o)} · {o.text} · {who(o)}</p>}
      <p className="me-small">{minText(d)} · {d.text} · {who(d)}</p>
      <div className="me-btnrow">
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => b.dupSame(d)}>{goal ? "Es el mismo gol" : "Es la misma jugada"}</button>
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => b.dupTwo(d)}>{goal ? "Son dos goles" : "Son dos jugadas"}</button>
      </div>
    </div>
  );
}

export function Juego({ v, b, now }: { v: MesaView; b: B; now: number }) {
  const m = b.mode;
  const tokens = pitchTokens(v.field, v.bench);
  const bench = benchRows(v);
  const c = v.match.clock;
  const running = (c.phase === "first" || c.phase === "second") && !c.held;
  const plan = v.plan.filter((x) => !b.ui.skipped.includes(x.outId + x.inId));
  const next = plan.find((x) => x.min == null || c.minute >= x.min - 3);
  const fieldLabel = `En el campo: ${v.field.map((p) => upper(p.name)).join(", ")}`;
  const unplayed = bench.filter((x) => x.l1 === "sin jugar").length;
  const dis = (t: Parameters<typeof whyNot>[1]) => !!whyNot(v, t);
  return (
    <section className="me-juego" aria-label="La mesa en juego">
      <div className="me-play vd-reg-2">
        <Ask v={v} b={b} now={now} />
        <div className="me-pitch vd-pitch" role="group" aria-label={fieldLabel}>
          <PitchLines />
          {tokens.map((t) => <Man key={t.id} v={v} b={b} t={t} />)}
        </div>
        {next && !m && running && (
          <div className="me-plan">
            <button type="button" className="vd-btn vd-glass vd-press me-plan__go" onClick={() => b.change(next.outId, next.inId, true)}>
              <Icon name="swap" />
              <span className="me-plan__t"><b>Toca: entra {upper(next.inName)} por {upper(next.outName)}</b><small>Plan de la pizarra{next.min != null ? ` · ${next.min}′` : ""}</small></span>
            </button>
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => b.skip(next)}>Saltar</button>
          </div>
        )}
        <div className="me-bench" role="group" aria-label="Banquillo: toca para que entre">
          <p className="me-bench__h"><b>Banquillo</b><span>{bench.length ? (unplayed ? `${unplayed} sin jugar` : "todos han jugado") : ""}</span></p>
          <div className="me-bench__row">
            {bench.map(({ player: p, l1, l2, gone }) => {
              const tgt = m && (m.k === "outFrom" || m.k === "hole" || m.k === "pickSub") && !gone ? "is-target" : m?.k === "in" && m.pid === p.id ? "is-picked" : "";
              const off = gone || (!!m && (m.k === "scorer" || m.k === "assist" || m.k === "swap" || m.k === "pick"));
              const name = upper(p.name);
              return (
                <button key={p.id} type="button" className={`me-sub ${tgt}${gone ? " is-gone" : ""}`.trim()} onClick={() => !off && b.tapBench(p.id)} aria-disabled={off} aria-label={`${p.name}, ${l1}${l2 ? ` · ${l2}` : ""}${gone ? "" : m && (m.k === "outFrom" || m.k === "hole") ? ": entra él" : ": toca para que entre"}`}>
                  <Shirt kit={v.match.kit} num={p.guest ? undefined : p.number} className="me-sub__shirt" />
                  <span className={`me-sub__n ${lenCls(name)}`.trim()} aria-hidden="true">{name}</span>
                  <span className="me-sub__l" aria-hidden="true">{l1}</span>
                  {l2 && <span className="me-sub__l" aria-hidden="true">{l2}</span>}
                  {p.pending > 0 && <i className="me-stk is-loc" aria-hidden="true">↓{p.pending}</i>}
                </button>
              );
            })}
            {!bench.length && <p className="me-small">Nadie en la banda.</p>}
          </div>
        </div>
      </div>

      <Side v={v} b={b} plan={plan} />

      <div className="me-dock vd-reg-4" role="group" aria-label="Apuntar">
        <div className="me-rival" role="group" aria-label={`${v.match.rivalShort}: jugadas del rival`}>
          <span className="me-rc me-rival__c" aria-hidden="true"><i>{v.match.rivalShort}</i></span>
          <button type="button" className="vd-btn vd-glass vd-press me-rbtn me-rbtn--gol" onClick={b.rivalGoal} aria-disabled={dis("opponent_goal")} aria-keyshortcuts="R"><span className="me-btn__t">Gol de {v.match.rivalShort}</span><Kbd>R</Kbd></button>
          <button type="button" className="vd-btn vd-glass vd-press me-rbtn" onClick={() => b.play("opponent_foul")} aria-disabled={dis("opponent_foul")} aria-label={`Falta de ${v.match.rival}`}><span className="me-btn__t">Falta</span></button>
          <button type="button" className="vd-btn vd-glass vd-press me-rbtn" onClick={() => b.play("opponent_woodwork")} aria-disabled={dis("opponent_woodwork")} aria-label={`Al palo de ${v.match.rival}`}><span className="me-btn__t">Palo</span></button>
          <button type="button" className="vd-btn vd-glass vd-press me-rbtn" onClick={() => b.play("opponent_corner")} aria-disabled={dis("opponent_corner")} aria-label={`Córner de ${v.match.rival}`}><span className="me-btn__t">Córner</span></button>
          <button type="button" className="vd-ibtn vd-glass vd-press me-rbtn me-rbtn--more" onClick={() => b.openSheet("rival")} aria-label={`Más jugadas de ${v.match.rivalShort}`} aria-haspopup="dialog"><Icon name="dots" /></button>
        </div>
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--gold me-golbtn" onClick={b.golPiti} aria-disabled={dis("goal")} aria-keyshortcuts="G"><Icon name="ball" /><span className="me-btn__t">Gol del Piti</span><Kbd>G</Kbd></button>
        <div className="me-verbs">
          <button type="button" className="vd-btn vd-glass vd-press me-verb" onClick={() => (dis("substitution") ? b.fail(whyNot(v, "substitution")) : b.setMode({ k: "pickSub" }))} aria-disabled={dis("substitution")} aria-keyshortcuts="C"><Icon name="swap" /><span className="me-btn__t">Cambio</span><Kbd>C</Kbd></button>
          <button type="button" className="vd-btn vd-glass vd-press me-verb" onClick={() => b.pickFor("tarjeta")} aria-disabled={dis("yellow_card")} aria-keyshortcuts="T"><Icon name="card" /><span className="me-btn__t">Tarjeta</span><Kbd>T</Kbd></button>
          <button type="button" className="vd-btn vd-glass vd-press me-verb" onClick={() => b.pickFor("foul")} aria-disabled={dis("foul")} aria-keyshortcuts="F"><Icon name="whistle" /><span className="me-btn__t">Falta</span><Kbd>F</Kbd></button>
          <button type="button" className="vd-btn vd-glass vd-press me-verb" onClick={() => b.openSheet("mas")} aria-haspopup="dialog"><Icon name="dots" /><span className="me-btn__t">Más</span></button>
        </div>
      </div>
    </section>
  );
}
