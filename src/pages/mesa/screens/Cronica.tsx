// La mesa · lo que va pasando (CronicaV2): a small LED, the filters with their counts, who else is scoring,
// the «¿Es la misma jugada?» card, and every play on a chalk rail split by half, with its author and
// «corregido por»; «···» opens Corregir (a sheet: type, player, minute) and Borrar. New plays slide in.
import { useEffect, useRef, useState, type RefObject } from "react";
import type { MesaEvent, MesaPlayer, MesaScreenProps } from "../types";
import { buzz, useFlash, useNow } from "./hooks";
import { avatars, categoryOf, fmtClock, iconOf, initial, listNames, type Category } from "./model";
import { BackButton, Icon, Screws } from "./parts";
import { EditSheet } from "./EditSheet";
import "./screens.css";

type Filter = "all" | Exclude<Category, "otra">;
const FILTERS: { k: Filter; label: string; one: string; many: string }[] = [
  { k: "all", label: "Todo", one: "jugada", many: "jugadas" },
  { k: "gol", label: "Goles", one: "gol", many: "goles" },
  { k: "falta", label: "Faltas", one: "falta", many: "faltas" },
  { k: "cambio", label: "Cambios", one: "cambio", many: "cambios" },
  { k: "tarjeta", label: "Tarjetas", one: "tarjeta", many: "tarjetas" },
];
const PHASE_LABEL = { ready: "PREVIA", first: "1ª PARTE", halftime: "DESCANSO", second: "2ª PARTE", ended: "FINAL" } as const;

function Chip({ f, n, on, pick }: { f: (typeof FILTERS)[number]; n: number; on: boolean; pick: () => void }) {
  const em = useFlash<HTMLElement>(n, "bump");
  return (
    <button type="button" className={on ? "sg on" : "sg"} aria-pressed={on} aria-label={`${f.label}, ${n} ${n === 1 ? f.one : f.many}`} onClick={pick}>
      {f.label}
      <em ref={em}>{n}</em>
    </button>
  );
}

interface RowProps {
  e: MesaEvent;
  first: boolean;
  open: boolean;
  gone: boolean;
  rivalShort: string;
  meUid: string;
  colour: (uid: string | null) => string;
  listReady: RefObject<boolean>;
  filteredAt: RefObject<number>;
  onToggle: () => void;
  onFix: () => void;
  onDelete: () => void;
}

function Row({ e, first, open, gone, rivalShort, meUid, colour, listReady, filteredAt, onToggle, onFix, onDelete }: RowProps) {
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el || !listReady.current) return;
    const cls = Date.now() - filteredAt.current < 600 ? "rv0" : "arrive";
    el.classList.add(cls);
    const t = setTimeout(() => el.classList.remove(cls), cls === "arrive" ? 2800 : 600);
    return () => clearTimeout(t);
  }, [listReady, filteredAt]);

  const pending = !!e.dupOf;
  const by = e.mine ? "Lo apuntaste tú" : e.byName ? `Lo apuntó ${e.byName}` : "";
  const note = e.goal === "us" && (e.type === "goal" || e.type === "goal_penalty" || e.type === "goal_freekick")
    ? e.pendingScorer ? "falta el goleador" : e.assistName ? `pase de ${e.assistName}` : "sin pase"
    : "";
  const meta = [by, note].filter(Boolean).join(", ");
  const cls = "ev" + (e.goal ? " goal" : "") + (e.side === "them" ? " them" : "") + (pending ? " q" : "");
  const label = `${e.text}${e.minute != null ? `, minuto ${e.minute}` : ""}`;
  return (
    <div ref={wrap} className={gone ? "cw gone" : "cw"} role="listitem">
      <div className={first ? "wi rail first" : "wi rail"}>
        <div className={cls}>
          <span className="m">{e.minute != null ? `${e.minute}′` : "–"}</span>
          <span className="nd"><Icon id={iconOf(e.type)} /></span>
          <span className="x">
            <b>
              <span className="tt">{e.text}</span>
              {e.side === "them" && <i className="atl">{rivalShort}</i>}
            </b>
            <small>
              {meta && <span>{meta}</span>}
              {e.editedByName && <em className="fx">corregido por {e.editedByUid === meUid ? "ti" : e.editedByName}</em>}
              {pending && <em className="pd">por confirmar</em>}
              {e.local && <em className="pd">en el móvil</em>}
            </small>
          </span>
          <span className="avs" aria-hidden="true">
            {(e.byName || e.mine) && <span className="av" style={{ background: colour(e.byUid) }}>{initial(e.byName)}</span>}
          </span>
          <button type="button" className={open ? "more on" : "more"} aria-label={(open ? "Cerrar opciones de " : "Opciones de ") + label} aria-expanded={open} onClick={onToggle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
          </button>
        </div>
        <div className={open ? "tray open" : "tray"}>
          <div>
            <div className="acts">
              {!e.local && (
                <button type="button" className="key" onClick={onFix} tabIndex={open ? 0 : -1}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
                  Corregir
                </button>
              )}
              <button type="button" className="key warn" onClick={onDelete} tabIndex={open ? 0 : -1}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
                Borrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Cronica({ view }: MesaScreenProps) {
  const { match, events, presence, actions, nav } = view;
  const now = useNow(15000);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState("");
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [fixing, setFixing] = useState<MesaEvent | null>(null);
  const listReady = useRef(false);
  const filteredAt = useRef(0);
  useEffect(() => {
    listReady.current = true;
  }, []);
  const homeRef = useFlash<HTMLSpanElement>(match.score.us, "flip");
  const colour = avatars(presence);

  const hide = (id: string, on: boolean) => setGone((g) => {
    const n = new Set(g);
    if (on) n.add(id);
    else n.delete(id);
    return n;
  });
  const remove = (id: string) => {
    buzz(18);
    setOpen("");
    hide(id, true);
    actions.remove(id).catch(() => hide(id, false));
  };

  const visible = events.filter((e) => !gone.has(e.id));
  const countable = visible.filter((e) => !e.dupOf);
  const countOf = (k: Filter) => (k === "all" ? countable.length : countable.filter((e) => categoryOf(e.type) === k).length);
  const shown = visible.filter((e) => filter === "all" || categoryOf(e.type) === filter).slice().reverse();
  const second = shown.filter((e) => e.period === 2);
  const firstHalf = shown.filter((e) => e.period !== 2);
  const secondStarted = match.clock.period === 2 || match.clock.phase === "ended";

  // The duplicate waiting for a decision (the earliest one), with the play it may repeat.
  const dup = events.find((e) => e.dupOf && events.some((o) => o.id === e.dupOf));
  const orig = dup ? events.find((o) => o.id === dup.dupOf) : undefined;
  const dupHidden = !!dup && gone.has(dup.id);
  const resolve = (same: boolean) => {
    if (!dup) return;
    buzz(same ? [14] : [10, 40, 10]);
    hide(dup.id, true);
    const done = same ? actions.remove(dup.id) : actions.edit(dup.id, { dupOk: true });
    done.then(() => {
      if (!same) hide(dup.id, false);
    }, () => hide(dup.id, false));
  };

  const others = presence.filter((p) => !p.me && p.fresh);
  const lastAt = Math.max(0, ...others.map((p) => p.at));
  const ago = Math.round((now - lastAt) / 60000);
  const presenceText = others.length === 0 ? "Solo tú en la mesa" : `${listNames(others.map((p) => p.name))} también ${others.length === 1 ? "está" : "están"} apuntando`;

  const author = (e: MesaEvent) => (e.mine ? "Tú, a las" : `${e.byName ?? "Otro anotador"},`);
  const rowsOf = (list: MesaEvent[], railFirst: boolean) => list.map((e, i) => (
    <Row
      key={e.id}
      e={e}
      first={railFirst && i === 0}
      open={open === e.id}
      gone={gone.has(e.id)}
      rivalShort={match.rivalShort}
      meUid={view.me.uid}
      colour={colour}
      listReady={listReady}
      filteredAt={filteredAt}
      onToggle={() => setOpen(open === e.id ? "" : e.id)}
      onFix={() => {
        setOpen("");
        setFixing(e);
      }}
      onDelete={() => remove(e.id)}
    />
  ));
  const players: MesaPlayer[] = [...view.field, ...view.bench];

  return (
    <div className="col cronica">
      <div className="top">
        <BackButton label="Volver a la mesa" onClick={nav.mesa} />
        <div className="ttl"><b>Lo que va pasando</b><span>{match.competition ? `${match.competition}, contra ${match.rival}` : `Contra ${match.rival}`}</span></div>
      </div>

      <div className="box">
        <Screws at={7} />
        <div className="glass">
          <span className="crest">MP</span><span className="code">PITI</span>
          <span className="dg" role="img" aria-label={`Manchester Piti ${match.score.us}, ${match.rival} ${match.score.them}`}>
            <span ref={homeRef} className="d">{match.score.us}</span><s>:</s><span className="d">{match.score.them}</span>
          </span>
          <span className="code r">{match.rivalShort}</span><span className="crest r">{match.rivalInitials}</span>
          <span className="now">
            <span className="pt">{match.clock.held ? "PAUSA" : PHASE_LABEL[match.clock.phase]}</span>
            <span className="clk">{match.clock.text}</span>
          </span>
        </div>
      </div>

      <div className="seg" role="group" aria-label="Filtrar jugadas">
        {FILTERS.map((f) => (
          <Chip key={f.k} f={f} n={countOf(f.k)} on={filter === f.k} pick={() => {
            if (f.k === filter) return;
            filteredAt.current = Date.now();
            setOpen("");
            setFilter(f.k);
          }} />
        ))}
      </div>

      <div className="mwho" aria-live="polite">
        <span className="av" style={{ background: colour(others[0]?.uid ?? view.me.uid) }}>{initial(others[0]?.name ?? view.me.name)}</span>
        <span className="tx">{presenceText}</span>
        {others.length > 0 && (
          <>
            <span className="pulse" aria-hidden="true" />
            <small>{ago < 1 ? "ahora" : `hace ${ago} min`}</small>
          </>
        )}
      </div>

      {dup && orig && (
        <div className={dupHidden ? "cw gone" : "cw"}>
          <div className="wi">
            <div className="cf" role="alert">
              <div className="k">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 8v5M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
                <b>¿Es la misma jugada?</b>
                {dup.minute != null && <span>minuto {dup.minute}</span>}
              </div>
              <div className="pair">
                {[orig, dup].map((e, i) => (
                  <div key={e.id} className="pe" style={{ gridColumn: i ? 3 : 1 }}>
                    <span className="av" style={{ background: colour(e.byUid) }}>{initial(e.mine ? view.me.name : e.byName)}</span>
                    <span><b>{e.text}</b><small>{author(e)} <span className="tm">{e.elapsedSeconds != null ? fmtClock(e.elapsedSeconds) : "–"}</span></small></span>
                  </div>
                ))}
                {orig.elapsedSeconds != null && dup.elapsedSeconds != null && (
                  <div className="gap" style={{ gridColumn: 2, gridRow: 1 }} aria-label={`${Math.abs(dup.elapsedSeconds - orig.elapsedSeconds)} segundos de diferencia`}>
                    <i>{Math.abs(dup.elapsedSeconds - orig.elapsedSeconds)} s</i>
                  </div>
                )}
              </div>
              <div className="b">
                <button type="button" className="key on" onClick={() => resolve(true)}>{dup.goal ? "Es el mismo gol" : "Es la misma jugada"}</button>
                <button type="button" className="key" onClick={() => resolve(false)}>{dup.goal ? "Son dos goles" : "Son dos jugadas"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="tl" role="list" aria-label="Jugadas del partido, de la última a la primera">
        {rowsOf(second, true)}
        {secondStarted && (filter === "all" || second.length > 0) && (
          <div className="half" role="listitem">
            <span className="m">2ª</span>
            <span className="nd"><Icon id="falta" size={16} /></span>
            <span><b>Empieza la 2ª parte</b></span>
          </div>
        )}
        {rowsOf(firstHalf, !secondStarted && second.length === 0)}
        {shown.length === 0 && <div className="empty" role="listitem">Nada de esto todavía.</div>}
        <div className="half" role="listitem">
          <span className="m">0′</span>
          <span className="nd"><Icon id="falta" size={16} /></span>
          <span><b>Pitido inicial</b></span>
        </div>
      </div>

      {fixing && (
        <EditSheet
          event={fixing}
          players={players}
          maxMinute={Math.max(match.clock.minute, fixing.minute ?? 1)}
          onClose={() => setFixing(null)}
          onSave={(patch) => {
            const id = fixing.id;
            setFixing(null);
            buzz(12);
            void actions.edit(id, patch);
          }}
        />
      )}
    </div>
  );
}
