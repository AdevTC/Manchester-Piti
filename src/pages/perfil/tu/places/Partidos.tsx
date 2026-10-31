// «Tú» › Tus partidos (/perfil/partidos): three prototypes combined (IMPL-SPEC «Tus partidos»). TuCarta's head
// («Uno jugado, con un 4,7») with the season switcher (?temporada=, as the rest of the web); TuTemporada's river of
// every jornada as the hero (tap, ← →, J±1 and «Hoy» focus one; ?j= in the address); the jornada in focus as
// TuFicha's match sheet — inline under the river on desktop, a sheet on the phone; TuCarta's nota chart and
// figures; TuTemporada's table with its filters; and #porra, «Tu recorrido en la porra». The pure part is
// partidosView.ts; the rows are tu/me's (the frozen nota of each acta, the same the match page shows).
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMedia } from "../../../../components/vidrio/env";
import { TuIcon } from "../../../../components/vidrio/tu/ui";
import { ANSWER_SAID } from "../../bandeja/model";
import { buildMe, type Answer } from "../me";
import type { PendingItem } from "../usePending";
import type { PlaceProps } from "./types";
import { chartOf, defaultIndex, figsOf, focusOf, headOf, nowIndex, riverCol, riverMeta, seasonChoices, type Filter } from "./partidosView";
import { RadioSeg } from "./partidos/RadioSeg";
import { HoyButton, PhoneRiver, Ribbon, type Rsvp } from "./partidos/River";
import { FocusPanel, FocusSheet } from "./partidos/Focus";
import { Figures, NotaChart } from "./partidos/Nota";
import { Lista } from "./partidos/Lista";
import { PorraBlock, PORRA_ID } from "./partidos/PorraBlock";

type RsvpPend = Extract<PendingItem, { kind: "rsvp" }>;
/** The phone layout: the place's container (nx) under 700 px — the page's side padding is 40 px from 700 up. */
const PHONE = "(max-width: 779.98px)";
/** Another season: his answers are only read for the current one. */
const NO_ANSWERS: ReadonlyMap<string, Answer> = new Map();

export function Partidos(p: PlaceProps) {
  const { data, query, say } = p;
  const navigate = useNavigate();
  const phone = useMedia(PHONE);
  const reduce = useMedia("(prefers-reduced-motion: reduce)");

  // ── the season (?temporada=): the current one is the shell's; another is derived here
  const { selected, opts } = seasonChoices(data.raw.seasons, data.seasonId, query.temporada);
  const isCurrent = selected === data.seasonId;
  const sel = opts.find((o) => o.id === selected);
  const playerId = data.ficha.state === "vinculada" ? data.ficha.playerId : null;
  const raw = data.raw;
  const other = isCurrent ? null : buildMe({ playerId, seasonId: selected, matches: raw.matches, players: raw.players, seasons: raw.seasons, mvpResults: raw.mvpResults, standings: raw.standings, now: p.now, answers: NO_ANSWERS, card: null });
  const me = other ?? p.me;
  const rows = me.rows;
  const f = me.figures;
  const seasonName = sel?.name ?? data.seasonName;
  const temporada = isCurrent ? undefined : (sel?.slug ?? query.temporada);

  // ── the jornada in focus (?j=): local first, the address follows (replace, no scroll, the season kept)
  const idxOfJ = (j: number | undefined) => (j === undefined ? -1 : rows.findIndex((r) => r.j === j));
  const [focus, setFocus] = useState<number | null>(() => {
    const i = idxOfJ(query.j);
    return i >= 0 ? i : null;
  });
  const focusRef = useRef<number | null>(focus);
  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);
  // back / forward, or a link with ?j=: the address wins when it changes
  const qi = idxOfJ(query.j);
  const [seenQi, setSeenQi] = useState(qi);
  if (qi !== seenQi) {
    setSeenQi(qi);
    if (qi >= 0) setFocus(qi);
  }
  const shown = focus ?? (rows.length ? defaultIndex(rows) : null);
  const now = rows.length ? nowIndex(rows) : -1;
  const writeUrl = (i: number | null) => {
    const j = i !== null ? rows[i]?.j : null;
    void navigate({ to: "/perfil/partidos", search: { ...(temporada ? { temporada } : {}), ...(j ? { j } : {}) }, replace: true, resetScroll: false } as never);
  };
  const panel = useRef<HTMLElement>(null);
  const pick = (i: number, opts2: { reveal?: boolean } = {}) => {
    setFocus(i);
    writeUrl(i);
    if (opts2.reveal && !phone) panel.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  const close = () => {
    setFocus(null);
    writeUrl(null);
  };
  const pickSeason = (id: string) => {
    if (id === selected) return;
    const o = opts.find((x) => x.id === id);
    setFocus(null);
    void navigate({ to: "/perfil/partidos", search: o && !o.current ? { temporada: o.slug } : {}, resetScroll: false } as never);
  };

  // ← → on desktop step through the jornadas (not while typing, nor inside a radio group or a dialog)
  const stepRef = useRef<(d: 1 | -1) => void>(() => undefined);
  useEffect(() => {
    stepRef.current = (d) => {
      if (shown === null) return;
      const i = Math.max(0, Math.min(rows.length - 1, shown + d));
      if (i !== shown) pick(i);
    };
  });
  useEffect(() => {
    if (phone) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target instanceof Element ? e.target : null;
      if (t && (t.closest("input, textarea, select, [contenteditable='true'], [role='radiogroup'], [role='dialog'], [role='slider'], details"))) return;
      e.preventDefault();
      stepRef.current(e.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phone]);

  // ── his convocatoria for the next jornada: la bandeja's rsvp item (the one Tú answers too)
  const next = rows.find((r) => r.kind === "next") ?? null;
  const pend = isCurrent && next ? (p.pending.items.find((x): x is RsvpPend => x.kind === "rsvp" && x.key === `rsvp-${next.matchId}`) ?? null) : null;
  const rsvp: Rsvp | null = pend
    ? {
        matchId: next?.matchId ?? "",
        question: pend.title,
        body: pend.done && pend.after ? pend.after : pend.body,
        value: pend.value,
        busy: pend.busy,
        pick: (a) => {
          const was = pend.value;
          pend
            .pick(a)
            .then(() => say(`${ANSWER_SAID[a]} El capitán ya lo ve.`, was && was !== a ? () => void pend.pick(was).catch(() => say("No se ha deshecho. Inténtalo otra vez.")) : undefined))
            .catch(() => say("No se ha guardado tu respuesta. Inténtalo otra vez."));
        },
      }
    : null;

  // ── what the place draws
  const head = headOf(rows, f, seasonName);
  const cols = rows.map(riverCol);
  const fo = shown !== null ? focusOf(rows, shown, f) : null;
  const [filter, setFilter] = useState<Filter>(() => (f.played > 0 ? "jugados" : "todos"));
  const chart = chartOf(rows, f);
  const archivedEmpty = !!sel?.archived && !rows.some((r) => r.kind === "played");
  const riverLabel = `Las ${rows.length} jornadas de la ${seasonName}`;
  const riverProps = { rows, cols, pick: (i: number) => pick(i), scrub: (i: number) => setFocus(i), scrubEnd: () => writeUrl(focusRef.current), rsvp, average: f.average, played: f.played, label: riverLabel };
  const backToCurrent = () => pickSeason(data.seasonId);
  const cur = opts.find((o) => o.current);

  return (
    <div className="tp">
      <header className="tc-head">
        <div className="tc-head__t">
          <p className="tc-kick">Tus partidos · {seasonName}</p>
          <h2 className="nx-h2">{archivedEmpty ? `La ${seasonName} está en el archivo` : head.title}</h2>
          {!archivedEmpty && <p className="nx-sub">{head.sub}</p>}
        </div>
        {opts.length > 1 && <RadioSeg label="Temporada" className="tp-seasons" opts={opts.map((o) => ({ key: o.id, t: o.t, on: o.on, pick: () => pickSeason(o.id) }))} />}
      </header>

      {archivedEmpty ? (
        <div className="tk-empty">
          <span className="tk-tile">
            <TuIcon name="cal" className="nx-ic" />
          </span>
          <h3>Sin partidos tuyos con nota</h3>
          <p>Es una temporada de antes del Piti: se jugó sin actas ni notas, así que aquí no hay partidos tuyos con nota. Sus resultados siguen en Partidos.</p>
          {cur && (
            <div className="tk-acts">
              <button type="button" className="vd-glass vd-press nx-btn" onClick={backToCurrent}>
                Volver a la {cur.name}
              </button>
            </div>
          )}
        </div>
      ) : !rows.length ? (
        <div className="tk-empty">
          <h3>Sin jornadas</h3>
          <p>{head.sub}</p>
        </div>
      ) : (
        <>
          <section className="tt-season" aria-labelledby="tp-riv-h">
            <div className="tt-season__head">
              <div>
                <h3 className="tt-h" id="tp-riv-h">
                  Tu temporada, jornada a jornada
                </h3>
                <p className="nx-meta">{riverMeta(rows, f)}</p>
              </div>
              <div className="tt-season__acts">
                {!phone && <span className="tt-keys">Toca o arrastra por las jornadas · ← → para moverte</span>}
                <HoyButton onClick={() => pick(now)} disabled={!phone && shown === now} />
              </div>
            </div>
            {phone ? <PhoneRiver {...riverProps} on={focus} /> : <Ribbon {...riverProps} on={shown} />}
          </section>

          {!phone && fo && <FocusPanel fo={fo} rsvp={rsvp} go={(i) => pick(i)} panelRef={panel} />}
          {phone && fo && focus !== null && <FocusSheet fo={fo} rsvp={rsvp} go={(i) => pick(i)} onClose={close} />}

          <div className="tc-pa tp-pa">
            <NotaChart chart={chart} rows={rows} pick={(i) => pick(i, { reveal: true })} />
            <Figures figs={figsOf(rows, f)} />
          </div>

          <Lista rows={rows} filter={filter} setFilter={setFilter} phone={phone} pick={(i) => pick(i, { reveal: true })} nextAnswer={rsvp?.value ?? null} caption={`Tus partidos de la ${seasonName}`} />
        </>
      )}

      {!archivedEmpty && <PorraBlock matches={data.raw.matches} seasonId={selected} uid={data.uid} asked={query.hash === PORRA_ID} line={isCurrent ? data.stuff.porra : null} />}

      <div className="nx-links tp-links">
        {playerId && (
          <Link className="nx-lnk" to="/jugadores/$playerId/temporada" params={{ playerId }}>
            Tu página pública
          </Link>
        )}
        <button type="button" className="nx-lnk" onClick={() => p.go({ page: "perfil", sec: "juego", aj: null, open: null })}>
          Dónde estás en el equipo
        </button>
        <Link className="nx-lnk" to="/estadisticas">
          Los números del equipo
        </Link>
      </div>
    </div>
  );
}
