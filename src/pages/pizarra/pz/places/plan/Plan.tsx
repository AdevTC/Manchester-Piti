// r14 «La pizarra» · Plan (PiPlan.dc.html): how we play this match in six parts (el rival · nuestras claves · con y
// sin balón · pelotas paradas · si pasa… · notas), each one driving the pitch. Regions: lead (the plan's state and
// the parts) · side (the part on screen) · peek / panel (phone). Writes through P.act.saveBoard (undoable, toasted).
import "../../../../../styles/pz/plan.css";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { usePz } from "../../store/context";
import type { PzApi } from "../../store/api";
import type { Layout, RegionProps } from "../../store/types";
import { PzIcon } from "../../campo/Shirt";
import { fmt } from "../../store/fmt";
import type { Lineup } from "../../../formations";
import { PLAN_PARTS, planStyle, type PlanPart } from "./planView";
import { partOf, usePlanPlays, usePlanUi } from "./planHooks";
import { PLAN_UI0, partsStatus, planStage, stageHas, type PlanUi } from "./planPlace";
import { planHead, partSubs } from "./planWords";
import { RivalPart } from "./parts/RivalPart";
import { ClavesPart } from "./parts/ClavesPart";
import { JuegoPart } from "./parts/JuegoPart";
import { ParadoPart } from "./parts/ParadoPart";
import { SipasaPart } from "./parts/SipasaPart";
import { NotasPart } from "./parts/NotasPart";

/** Keeps the pitch in step with the part on screen (one owner region mounts it). */
function StageSync({ layout }: { layout: Layout }) {
  const P = usePz();
  const { u } = usePlanUi(P);
  const plays = usePlanPlays(P);
  const part = partOf(P);
  const b = P.sel.board();
  const M = P.sel.match();
  const canEdit = !!b && P.sel.canEdit(b);
  const defLine = b?.lineup.tactics.defLine;
  const handle = canEdit
    ? {
        axis: "y" as const,
        min: 60,
        max: 80,
        step: 10,
        label: "Línea defensiva: " + String(defLine || "Media").toLowerCase(),
        onMove: (y: number) => {
          const cur = P.sel.board();
          if (!cur) return;
          const val = y < 65 ? "Alta" : y > 75 ? "Baja" : "Media";
          if ((cur.lineup.tactics.defLine || "Media") === val) return;
          P.act.saveBoard({ tactics: { ...cur.lineup.tactics, defLine: val } }, "Línea " + val.toLowerCase());
        },
      }
    : null;
  const spec = planStage(P, { part, ui: u, layout, plays, rivalName: M?.rival ?? "Rival", lineHandle: handle });
  // every render: cheap, and it also puts the plan back after the shell resets the stage (a route change)
  useEffect(() => {
    if (P.state.route.place !== "plan") return;
    if (stageHas(P.state.stage, spec)) return;
    P.act.setStage(spec, { replace: true });
  });
  return null;
}

export function Plan({ region, layout }: RegionProps) {
  const P = usePz();
  const { u, setU } = usePlanUi(P);
  const owner = layout === "phone" ? region === "peek" || region === "panel" : region === "lead";
  const flow = layout !== "desktop";
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && (u.preview || u.focus || u.edit)) {
      e.stopPropagation();
      setU({ preview: null, focus: false, edit: null });
      P.say("Vuelve el plan");
    }
  };
  let body: ReactNode = null;
  if (region === "lead") body = <PlanLead layout={layout} />;
  else if (region === "side") body = <PlanSide layout={layout} />;
  else if (region === "peek") body = <PlanPeek />;
  else if (region === "panel")
    body = (
      <>
        <PlanPanelHead />
        <PlanSide layout={layout} />
      </>
    );
  if (!body) return null;
  const cls = ["pp", flow ? "is-flow" : "pz-region", layout === "phone" ? "is-phone" : "", "pp--" + region].filter(Boolean).join(" ");
  return (
    <div className={cls} onKeyDown={onKey} data-pz-place="plan">
      {owner && <StageSync layout={layout} />}
      {flow ? body : <div className="pz-region__scroll">{body}</div>}
    </div>
  );
}

// ── LEAD: the plan's state + the parts ─────────────────────────────────────────────────────────────────────
function Ring({ done }: { done: number }) {
  const off = Math.round(213.6 * (1 - done / 5) * 10) / 10;
  return (
    <span className={`pz-ring${done === 5 ? " is-full" : ""}`} role="img" aria-label={done + " de 5 partes listas"}>
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle className="bg" cx="40" cy="40" r="34" />
        <circle className="fg" cx="40" cy="40" r="34" strokeDasharray="213.6" strokeDashoffset={off} />
      </svg>
      <b>
        {done}
        <small>/5</small>
      </b>
    </span>
  );
}

function PlanLead({ layout }: { layout: Layout }) {
  const P = usePz();
  const b = P.sel.board();
  const m = P.sel.me();
  const ro = !!b && !P.sel.canEdit(b);
  const head = planHead(P);
  const PS = partsStatus(P);
  const pl = b?.lineup.plan;
  const nKeys = pl?.claves.length ?? 0;
  const nRules = b?.lineup.condPlan?.length ?? 0;
  return (
    <div className="pp__lead">
      <section className="pz-hero pp__hero" aria-labelledby="pp-h">
        <p className="pz-kick">
          {head.kicker}
          {ro && b && (
            <span className="pp__ro">
              <PzIcon name="lock" />
              {b.isOfficial ? "Oficial · solo lectura" : "De @" + b.ownerNick + " · solo lectura"}
            </span>
          )}
        </p>
        <h1 className={`pz-h1${head.t.length > 22 ? " is-long" : ""}`} id="pp-h">
          {head.t}
        </h1>
        <p className="pz-line">{head.s}</p>
      </section>
      {b && (
        <div className="pz-stats pp__stats" role="group" aria-label="El plan en números">
          <div className="pz-stat pp__ringstat">
            <Ring done={PS.done} />
            <span className="pp__ringw">
              <span className="pz-stat__k">Partes listas</span>
              <span className="pz-stat__w">{PS.done === 5 ? "Completo" : PS.miss.length === 1 ? "Falta 1" : "Faltan " + PS.miss.length}</span>
            </span>
          </div>
          <div className="pz-stat">
            <span className="pz-stat__v">{nKeys}</span>
            <span className="pz-stat__k">Claves</span>
            <span className="pz-stat__w">{nKeys === 3 ? "Las tres" : "Caben " + (3 - nKeys)}</span>
          </div>
          <div className="pz-stat">
            <span className="pz-stat__v">{nRules}</span>
            <span className="pz-stat__k">Si pasa…</span>
            <span className="pz-stat__w">{nRules ? (nRules === 1 ? "Una regla" : nRules + " reglas") : "Ninguna"}</span>
          </div>
        </div>
      )}
      {b && <Played />}
      {b ? (
        <nav className="pz-sec" aria-label="Las partes del plan">
          <div className="pz-sec__h">
            <h2>Las partes</h2>
            <button type="button" className="nx-lnk" onClick={() => P.act.openSheet("plan-vistazo")}>
              El plan de un vistazo
            </button>
          </div>
          <PartsList layout={layout} />
          {ro && m.member && !m.socia && !m.fuera && (
            <div className="pp__glance">
              <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.duplicate()}>
                <PzIcon name="copy" />
                Duplicar para editar
              </button>
            </div>
          )}
        </nav>
      ) : (
        <NoBoard />
      )}
    </div>
  );
}

function NoBoard() {
  const P = usePz();
  const m = P.sel.me();
  const out = m.fuera || m.socia;
  return (
    <section className="pz-sec pz-empty">
      <h3>{out ? "Aún no hay plan publicado" : "Sin tablero todavía"}</h3>
      <p>{out ? "El plan se ve con el oficial del partido." : "El plan va con un siete: crea el tuyo y vuelve."}</p>
      {!out && (
        <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.nav("/pizarra/siete")}>
          <PzIcon name="shirt" />
          Ir al siete
        </button>
      )}
    </section>
  );
}

function goPart(P: PzApi, id: PlanPart) {
  P.slice<PlanUi>("planUi", PLAN_UI0).set({ preview: null, focus: false, edit: null, editKey: -1, playing: false, showPlay: false, fPlay: false }, { undoable: false });
  P.nav("/pizarra/plan/" + id);
}

function PartsList({ layout }: { layout: Layout }) {
  const P = usePz();
  const part = partOf(P);
  const PS = partsStatus(P);
  const subs = partSubs(P);
  return (
    <div className="pp__parts">
      {PLAN_PARTS.map((x) => {
        const ok = PS.st[x.id];
        const opt = x.id === "notas";
        const st = ok ? "Listo" : opt ? "Opcional" : "Falta";
        return (
          <button
            key={x.id}
            type="button"
            className="pp__part"
            aria-current={part === x.id ? "true" : undefined}
            onClick={() => goPart(P, x.id)}
            aria-label={x.t + ": " + subs[x.id] + ". " + st + (part === x.id ? ". En el campo ahora" : "")}
          >
            <span className="vx-tile">
              <PzIcon name={x.icon} />
            </span>
            <span>
              <b>{x.t}</b>
              <small>{subs[x.id]}</small>
            </span>
            <span className={`pp__st ${ok ? "is-ok" : opt ? "is-mute" : "is-warn"}`}>
              <PzIcon name={ok ? "check" : opt ? "dots" : "warn"} />
              {layout === "desktop" || layout === "tablet" ? st : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Lo planeado frente a lo jugado (the board's match is over). */
function Played() {
  const P = usePz();
  const b = P.sel.board();
  const M = P.sel.match(b?.matchId);
  const v = b ? P.sel.ver(b, "titular") : null;
  if (!b || !M || !M.played || M.gf == null || M.ga == null || !v) return null;
  const plan7 = v.slots.map((s) => s.playerId).filter((x): x is string => !!x);
  const starters = M.cal.conv?.starters ?? [];
  const missing = starters.length ? plan7.filter((x) => !starters.includes(x)) : [];
  const extra = starters.filter((x) => !plan7.includes(x));
  const evs = M.cal.events ?? [];
  const subsDone = evs.filter((e) => e.type === "substitution");
  const planSubs = b.lineup.subs ?? [];
  const same = planSubs.filter((s) => subsDone.some((e) => e.inPlayerId === s.in && e.playerId === s.out)).length;
  let gf = 0;
  let ga = 0;
  let lost = false;
  [...evs]
    .sort((a, c) => (a.minute ?? 0) - (c.minute ?? 0))
    .forEach((e) => {
      if (e.type === "goal" || e.type === "goal_penalty" || e.type === "goal_freekick" || e.type === "opponent_own_goal") gf++;
      if (e.type === "opponent_goal" || e.type === "own_goal") ga++;
      if (ga > gf) lost = true;
    });
  const rules = b.lineup.condPlan ?? [];
  const n = (id: string) => P.sel.name(id);
  const lines = [
    { icon: "shirt", t: !starters.length ? "Sin alineación en el acta" : missing.length ? "Jugaron " + (plan7.length - missing.length) + " de los " + plan7.length + " planeados · no salió " + fmt.list(missing.map(n)) + (extra.length ? " · salió " + fmt.list(extra.map(n)) : "") : "Salieron los " + plan7.length + " planeados" },
    { icon: "swap", t: planSubs.length ? same + " de " + planSubs.length + " cambios como estaban planeados" : "Sin cambios planeados" },
    { icon: "flag", t: rules.length ? (lost ? "Fuimos perdiendo: el «si pasa…» tocaba" : "El «si pasa…» no hizo falta: nunca fuimos perdiendo") : "Sin «si pasa…»" },
  ];
  return (
    <section className="pz-sec" aria-labelledby="pp-as">
      <div className="pz-sec__h">
        <h2 id="pp-as">Lo planeado frente a lo jugado</h2>
      </div>
      <div className="pp__score">
        <b>
          {M.gf}–{M.ga}
        </b>
        <span className="pz-meta">{(M.gf > M.ga ? "Victoria" : M.gf < M.ga ? "Derrota" : "Empate") + " contra " + M.rival}</span>
      </div>
      <ul className="pp__chg">
        {lines.map((l) => (
          <li key={l.icon}>
            <PzIcon name={l.icon} />
            <span>{l.t}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── SIDE: the part on screen ───────────────────────────────────────────────────────────────────────────────
function PlanSide({ layout }: { layout: Layout }) {
  const P = usePz();
  const b = P.sel.board();
  const part = partOf(P);
  const half = layout === "phone" && P.state.sheetH !== "full";
  if (!b) {
    if (layout === "phone") return null;
    const m = P.sel.me();
    const out = m.fuera || m.socia;
    return (
      <div className="pp__side">
        <div className="pp__ph">
          <p className="pz-kick">El plan</p>
          <h2>{out ? "Aún no hay plan publicado" : "Sin tablero todavía"}</h2>
          <p className="pz-line">{out ? "El plan se ve con el oficial del partido." : "El plan va con un siete: crea el tuyo y vuelve."}</p>
        </div>
      </div>
    );
  }
  if (half) return <HalfPart />;
  return (
    <div className="pp__side" key={part}>
      {part === "rival" && <RivalPart layout={layout} />}
      {part === "claves" && <ClavesPart layout={layout} />}
      {part === "juego" && <JuegoPart layout={layout} />}
      {part === "parado" && <ParadoPart layout={layout} />}
      {part === "sipasa" && <SipasaPart layout={layout} />}
      {part === "notas" && <NotasPart layout={layout} />}
    </div>
  );
}

/** The phone's half sheet: the part in two lines and «Ver la parte entera». */
function HalfPart() {
  const P = usePz();
  const part = partOf(P);
  const subs = partSubs(P);
  const meta = PLAN_PARTS.find((x) => x.id === part) ?? PLAN_PARTS[0];
  const b = P.sel.board();
  const L: Lineup | undefined = b?.lineup;
  const M = P.sel.match();
  const n = L?.plan?.claves.length ?? 0;
  const rules = L?.condPlan ?? [];
  const st = planStyle(L?.style);
  const t =
    part === "rival"
      ? (M?.rival ?? "El rival")
      : part === "claves"
        ? (["Ninguna clave", "Una clave", "Dos claves", "Tres claves"][n] ?? n + " claves")
        : part === "juego"
          ? st
            ? st.t
            : "Sin estilo"
          : part === "parado"
            ? partsStatus(P).st.parado
              ? "Listas las tres"
              : "Falta algo"
            : part === "sipasa"
              ? rules.length
                ? rules.length === 1
                  ? "Un plan si " + (rules[0].when === "perdiendo" ? "perdemos" : rules[0].when === "ganando" ? "ganamos" : "empatamos")
                  : rules.length + " planes por si acaso"
                : "Nada previsto si se tuerce"
              : L?.plan?.notes
                ? "Lo que dirás"
                : "Sin notas todavía";
  return (
    <div className="pp__half">
      <p className="pz-kick">{meta.t}</p>
      <h2>{t}</h2>
      <p className="pp__halfs">{subs[part]}</p>
      <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.setSheetHeight("full")}>
        <PzIcon name="arrowR" />
        Ver la parte entera
      </button>
    </div>
  );
}

// ── PHONE ──────────────────────────────────────────────────────────────────────────────────────────────────
function PartsStrip() {
  const P = usePz();
  const part = partOf(P);
  const PS = partsStatus(P);
  const b = P.sel.board();
  const subs = partSubs(P);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // (only the strip scrolls: scrollIntoView would also nudge the sheet and the page sideways)
    const strip = ref.current;
    const el = strip?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!strip || !el) return;
    const l = el.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft;
    const r = l + el.offsetWidth;
    if (l < strip.scrollLeft) strip.scrollLeft = Math.max(0, l - 8);
    else if (r > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = r - strip.clientWidth + 8;
  }, [part]);
  return (
    <div className="pp__strip" role="group" aria-label="Las partes del plan" data-scroll-x="1" ref={ref}>
      {PLAN_PARTS.map((x) => {
        const ok = PS.st[x.id];
        const miss = !!b && !ok && x.id !== "notas";
        return (
          <button key={x.id} type="button" className="vd-glass vd-press pp__sp" aria-current={part === x.id ? "true" : undefined} onClick={() => goPart(P, x.id)} aria-label={x.t + ": " + subs[x.id] + (miss ? ". Falta" : "")}>
            <PzIcon name={x.icon} />
            {x.short}
            {miss && <i aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

function PlanPeek() {
  const P = usePz();
  const b = P.sel.board();
  const head = planHead(P);
  const PS = partsStatus(P);
  const pri = P.sel.primary("plan");
  return (
    <div className="pp__peek">
      <div className="pp__ptop">
        <div>
          <p className="pp__ptitle">{head.peek}</p>
          {b && <p>{PS.done} de 5 partes listas</p>}
        </div>
        {pri && (
          <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={pri.run} disabled={!!pri.disabled}>
            <PzIcon name={pri.icon ?? "arrow"} />
            {pri.short ?? pri.label}
          </button>
        )}
      </div>
      {b && <PartsStrip />}
    </div>
  );
}

function PlanPanelHead() {
  const P = usePz();
  const head = planHead(P);
  const b = P.sel.board();
  const half = P.state.sheetH !== "full";
  return (
    <>
      <section className={`pp__phero${half ? " is-one" : ""}`} aria-labelledby="pp-hp">
        <h1 id="pp-hp" className="pz-h1">
          {head.t}
        </h1>
        {!half && <p>{head.s}</p>}
      </section>
      {b ? <PartsStrip /> : <NoBoard />}
    </>
  );
}
