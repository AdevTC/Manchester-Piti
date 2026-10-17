// La mesa · descanso (DescansoV2): the amber DESCANSO plate with the break's timer and a ticker of the half,
// the first half in mirrored bars, «Quién ha jugado» (each player's stints and what he did) where a tap
// picks the seven of the 2ª with its projected minutes, «Igualar minutos», and «Arrancar la 2ª».
import { useState } from "react";
import type { MesaEvent, MesaPlayer, MesaScreenProps } from "../types";
import { buzz, useNow } from "./hooks";
import { fairSeven, fixtureTitle, fmtShort, minuteOfPlay, subsTo } from "./model";
import { BackButton, Check, Screws, Whistle } from "./parts";
import "./screens.css";

const CARD = { yellow_card: "A", double_yellow: "R", red_card: "R" } as const;
const pct = (sec: number, first: number) => Math.round((Math.min(sec, first) / Math.max(1, first)) * 500) / 10;
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

function count(events: readonly MesaEvent[], type: string) {
  return events.filter((e) => e.type === type).length;
}

export function Descanso({ view }: MesaScreenProps) {
  const { match, field, bench, events, actions, nav } = view;
  const now = useNow(1000);
  const [since] = useState(() => Date.now());
  const onPitch = field.map((p) => p.id);
  const [sel, setSel] = useState<string[]>(onPitch);
  const [busy, setBusy] = useState(false);

  const first = match.clock.period === 1 ? match.clock.elapsedSeconds : match.clock.elapsedSeconds - match.clock.periodSeconds;
  const halfMin = Math.round(match.clock.halfSeconds / 60);
  const firstEvents = events.filter((e) => e.period === 1 && !e.dupOf);
  const all = [...field, ...bench];
  const order = new Map(all.map((p, i) => [p.id, i]));
  const startOf = (p: MesaPlayer) => (p.stints.length ? Math.min(...p.stints.map((s) => s.from)) : Infinity);
  const rowsOrder = [...all].sort((a, b) => (a.keeper === b.keeper ? 0 : a.keeper ? -1 : 1) || startOf(a) - startOf(b) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const keeper = field.find((p) => p.keeper) ?? all.find((p) => p.keeper);

  const ticker = [
    ...firstEvents.filter((e) => e.goal).map((e) => `${e.goal === "us" ? (e.playerName ?? "GOL DEL PITI") : match.rival.split(/\s+/)[0]} ${e.minute ?? ""}′`.toUpperCase()),
    ...(count(firstEvents, "woodwork") ? [`${count(firstEvents, "woodwork")} ${count(firstEvents, "woodwork") === 1 ? "PALO" : "PALOS"} DEL PITI`] : []),
    ...(count(firstEvents, "save") && keeper ? [`${count(firstEvents, "save")} ${count(firstEvents, "save") === 1 ? "PARADA" : "PARADAS"} DE ${keeper.name.toUpperCase()}`] : []),
  ].join(" · ");

  const stats: { label: string; a: number; b: number | null }[] = [
    { label: "Ocasiones", a: count(firstEvents, "chance"), b: count(firstEvents, "opponent_chance") },
    { label: "Al palo", a: count(firstEvents, "woodwork"), b: count(firstEvents, "opponent_woodwork") },
    { label: keeper ? `Paradas de ${keeper.name}` : "Paradas", a: count(firstEvents, "save"), b: null },
    { label: "Faltas hechas", a: count(firstEvents, "foul"), b: count(firstEvents, "opponent_foul") },
  ];

  const isOn = (id: string) => sel.includes(id);
  const projected = (p: MesaPlayer) => p.minutes + (isOn(p.id) ? halfMin : 0);
  const outfield = all.filter((p) => !p.keeper).map(projected);
  const fair = fairSeven(all, onPitch);
  const isFair = sameSet(sel, fair);
  const hasKeeper = sel.some((id) => all.find((p) => p.id === id)?.keeper);
  const valid = sel.length === 7 && hasKeeper;
  const nIn = sel.filter((id) => !onPitch.includes(id)).length;
  const why = sel.length !== 7 ? `${sel.length} de 7` : !hasKeeper ? "falta portero" : "";
  const label = why ? "Elige el siete" : nIn ? `Arrancar con ${nIn} ${nIn === 1 ? "cambio" : "cambios"}` : "Arrancar la 2ª parte";
  // (the break's real length from the clock; until it is read, since this screen opened)
  const stop = match.clock.phase === "halftime" && match.clock.breakSeconds > 0 ? match.clock.breakSeconds : Math.max(0, Math.floor((now - since) / 1000));

  const go = async () => {
    if (!valid || busy) return;
    buzz([20, 40, 60]);
    setBusy(true);
    try {
      // (the whole wave in one operation: all the changes or none)
      const subs = subsTo(all, onPitch, sel);
      if (subs.length) actions.addMany(subs.map((s) => ({ playerId: s.outId, inPlayerId: s.inId })));
      await actions.clock("second");
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="col descanso">
      <div className="top">
        <BackButton label="Salir de la mesa" onClick={nav.exit} />
        <div className="ttl"><b>{fixtureTitle(match)}</b><span><em>Descanso</em>la 1ª acabó en el {minuteOfPlay(first, false)}</span></div>
      </div>

      <div className="box">
        <Screws at={8} />
        <div className="glass">
          <div className="sc" role="img" aria-label={`Descanso: Manchester Piti ${match.score.us}, ${match.rival} ${match.score.them}`}>
            <div className="side"><span className="crest">MP</span><span className="code">PITI</span></div>
            <div className="dg"><span className="d">{match.score.us}</span><s>:</s><span className="d">{match.score.them}</span></div>
            <div className="side r"><span className="code r">{match.rivalShort}</span><span className="crest r">{match.rivalInitials}</span></div>
          </div>
          <div className="ln">
            <span className="plate"><i aria-hidden="true" />DESCANSO</span>
            <span className="stop" role="timer" aria-label={`Parados desde hace ${Math.floor(stop / 60)} minutos`}><small>parados</small><b>{fmtShort(stop)}</b></span>
          </div>
          {ticker && <div className="mar" aria-hidden="true"><span>{ticker}</span></div>}
        </div>
      </div>

      <div className="duel" role="group" aria-label={`La primera parte, Piti a la izquierda y ${match.rival} a la derecha`}>
        <div className="dsh" aria-hidden="true"><b>La 1ª parte</b><span style={{ gridColumn: "2 / span 2" }}>PITI</span><span className="r" style={{ gridColumn: "4 / span 2" }}>{match.rivalShort}</span></div>
        {stats.map((s, i) => {
          const max = Math.max(1, s.a, s.b ?? 0);
          const delay = `${0.15 + i * 0.08}s`;
          return (
            <div key={s.label} className="dst" aria-label={`${s.label}: Piti ${s.a}${s.b === null ? "" : `, ${match.rival} ${s.b}`}`} role="img">
              <span className="lb">{s.label}</span>
              <b className={s.b !== null && s.a < s.b ? "l lo" : "l"}>{s.a}</b>
              <span className="mb a">{s.a > 0 && <i style={{ width: `${(s.a / max) * 100}%`, animationDelay: delay }} />}</span>
              <span className="mb b">{s.b ? <i style={{ width: `${(s.b / max) * 100}%`, animationDelay: delay }} /> : null}</span>
              <b className={s.b === null || s.b < s.a ? "r lo" : "r"}>{s.b === null ? "–" : s.b}</b>
            </div>
          );
        })}
      </div>

      <div className="mboard" role="group" aria-label="El siete de la 2ª: toca un jugador para meterlo o sacarlo">
        <div className="cols" aria-hidden="true"><i /></div>
        <div className="ax" aria-hidden="true">
          <span className="k">Quién ha jugado</span>
          <span className="scale"><span style={{ left: "25%" }}>1ª parte</span><span className="b2" style={{ left: "75%" }}>2ª parte</span></span>
          <span className={sel.length === 7 ? "tot" : "tot bad"}>{sel.length} de 7</span>
        </div>
        {rowsOrder.map((p) => {
          const on = isOn(p.id);
          const zero = p.minutes === 0 && !p.played;
          const mine = firstEvents.filter((e) => e.playerId === p.id);
          const goals = mine.filter((e) => e.goal === "us").length;
          const cards = mine.filter((e) => e.type in CARD);
          const tag = p.keeper ? "portero" : p.sentOff ? "expulsado" : p.guest ? "invitado" : "";
          const aria = `${p.name}${p.keeper ? ", portero" : ""}, ${zero ? "sin jugar" : `${p.minutes} minutos`} en la 1ª` +
            (goals ? `, ${goals} ${goals === 1 ? "gol" : "goles"}` : "") + (cards.length ? `, ${cards.some((c) => c.type !== "yellow_card") ? "roja" : "amarilla"}` : "") +
            (p.sentOff ? ". Expulsado: no puede volver" : on ? `. Juega la 2ª: ${projected(p)} minutos en total` : ". Descansa en la 2ª");
          return (
            <button
              key={p.id}
              type="button"
              className={"pr" + (on ? " on" : "") + (zero ? " z" : "")}
              aria-pressed={on}
              aria-label={aria}
              disabled={p.sentOff && !on}
              onClick={() => {
                buzz(on ? [6] : [12]);
                setSel(on ? sel.filter((x) => x !== p.id) : [...sel, p.id]);
              }}
            >
              <span className="ck">{on && <Check color="#0c1733" />}</span>
              <span className="n"><span><em>{p.number}</em>{p.name}</span>{tag && <small>{tag}</small>}</span>
              <span className={zero ? (on ? "tr zero on2" : "tr zero") : "tr"}>
                {p.stints.filter((s) => s.from < first).map((s) => (
                  <i key={s.from} style={{ left: `${pct(s.from, first)}%`, width: `${pct(s.to ?? first, first) - pct(s.from, first)}%` }} />
                ))}
                {on && <i className="p" style={{ left: "50%", width: "50%" }} />}
                {mine.filter((e) => e.goal === "us" && e.elapsedSeconds != null).map((e) => (
                  <span key={e.id} className="mk ball" style={{ left: `${pct(e.elapsedSeconds ?? 0, first)}%` }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0c1733" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="M12 8l3.8 2.8-1.5 4.4H9.7l-1.5-4.4z" fill="#0c1733" /></svg>
                  </span>
                ))}
                {cards.filter((e) => e.elapsedSeconds != null).map((e) => (
                  <span key={e.id} className={CARD[e.type as keyof typeof CARD] === "R" ? "mk card red" : "mk card"} style={{ left: `${pct(e.elapsedSeconds ?? 0, first)}%` }}>
                    {CARD[e.type as keyof typeof CARD]}
                  </span>
                ))}
              </span>
              <span className={on ? "m on" : "m"}>
                {on ? <>{p.minutes}′ → <b>{projected(p)}′</b></> : zero ? "sin jugar" : `${p.minutes}′`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="dock">
        <div className="dbar">
          <span className="rep" aria-live="polite">Jugadores de campo: de <b>{outfield.length ? Math.min(...outfield) : 0}′</b> a <b>{outfield.length ? Math.max(...outfield) : 0}′</b></span>
          <button type="button" className={isFair ? "key on" : "key"} aria-pressed={isFair} onClick={() => {
            buzz([10, 30, 10]);
            setSel(fair);
          }}>Igualar minutos</button>
        </div>
        <button type="button" className="cta" disabled={!valid || busy} onClick={() => void go()}>
          <span>{label}{why && <>: <em>{why}</em></>}</span>
          {valid && <i><Whistle size={24} /></i>}
        </button>
      </div>
    </div>
  );
}
