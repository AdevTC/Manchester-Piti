// Tu juego (/perfil/juego, TuCarta B «Juego»; players only: placesOf): the F7 pitch with today's Posiciones —
// one tap ✓ también, two ★ preferida, three off; «Enviar al capitán» (proposePositions), «Retirar la propuesta»,
// pending / approved / adjusted / rejected with «Ahora en tu ficha: …», read-only out of season, the nudge when he
// plays somewhere he hasn't marked — «Dónde has jugado», his place in five rankings (me.ranks; a zero is «aún a
// cero», never a rank), «Tu mejor sociedad» (me.partner) and «Compararte con…» (a teammate's three numbers beside
// his, then Plantilla's cara a cara with both in it). The pure part is juegoView.ts.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import type { PositionSet } from "../../../../lib/positions";
import { PShirt, SheetFrame } from "../../../stats/palco/kit";
import type { PlaceProps } from "./types";
import {
  baseMarks,
  canSend,
  caraHref,
  compareRows,
  juegoTitle,
  ladders,
  marksText,
  nudgeText,
  partnerView,
  pitchSpots,
  playedText,
  proposalStatus,
  rankMeta,
  squadNumbers,
  tapSpot,
  type SquadNumbers,
} from "./juegoView";

const SEND = "M4 12l16-7.5-5 15-3.5-6zM11.5 13.5l8.5-9";
const USERS = "M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7zM3 19.5a6 6 0 0 1 12 0M15.5 4.3a3.5 3.5 0 0 1 0 6.4M17.5 13.6a6 6 0 0 1 3.5 5.9";
const Svg = ({ d }: { d: string }) => (
  <svg className="nx-ic" viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} />
  </svg>
);

const offline = () => typeof navigator !== "undefined" && navigator.onLine === false;
/** The write failed: offline says so (bug 10), else the plain retry. */
const failText = (what: "enviar" | "retirar") => (offline() ? `Sin conexión: no se ha podido ${what}. Vuelve a intentarlo cuando tengas cobertura.` : `No se ha podido ${what}. Inténtalo otra vez.`);

const subscribeNothing = () => () => {};
const useInBrowser = (): boolean => useSyncExternalStore(subscribeNothing, () => true, () => false);

export function Juego(p: PlaceProps) {
  const { data, me, say } = p;
  const info = data.positions;
  const played = data.played;
  const editable = !!info?.inSeason;
  const [draft, setDraft] = useState<PositionSet | null>(null);
  const [busy, setBusy] = useState(false);
  const base = baseMarks(info);
  const marks = draft ?? base;
  const status = proposalStatus(info, draft, data.card.posLong ?? null);
  const sendable = canSend(info, draft);
  const pending = info?.state === "pendiente";
  const spots = pitchSpots(marks, played, editable);
  const pt = playedText(played);
  const nudge = nudgeText(played, info, marks);

  const raw = data.raw;
  const myId = data.ficha.playerId;
  const squad = useMemo(
    () => squadNumbers({ playerId: myId, seasonId: data.seasonId, matches: raw.matches, players: raw.players, seasons: raw.seasons, mvpResults: raw.mvpResults, standings: raw.standings, now: p.now }),
    // (the clock only moves a match from «to play» to «played»: the minute tick is enough)
    [myId, data.seasonId, raw.matches, raw.players, raw.seasons, raw.mvpResults, raw.standings, p.now],
  );
  const nameOf = useMemo(() => {
    const m = new Map(squad.map((s) => [s.id, s.name]));
    return (id: string) => m.get(id) ?? "";
  }, [squad]);
  const lads = ladders(me.ranks, squad, nameOf);
  const of = me.ranks.find((r) => r.key === "minutos")?.of ?? squad.length;
  const pair = partnerView(me.partner, nameOf);
  const mine = squad.find((s) => s.id === myId) ?? null;
  const mates = squad.filter((s) => s.id !== myId);

  // a proposal written, with «Deshacer» back to what was there
  const write = async (set: PositionSet | null, ok: string, what: "enviar" | "retirar", undoTo: PositionSet | null, keepDraft: PositionSet | null) => {
    if (busy) return;
    setBusy(true);
    try {
      await p.actions.proposePositions(set);
      setDraft(null);
      say(ok, () => {
        void p.actions.proposePositions(undoTo).then(
          () => setDraft(keepDraft),
          () => say(failText(what === "enviar" ? "retirar" : "enviar")),
        );
      });
    } catch {
      say(failText(what));
    } finally {
      setBusy(false);
    }
  };
  const prevProposal = pending ? (info?.proposal ?? null) : null;
  const send = () => {
    if (draft && sendable) void write(draft, "Propuesta enviada al capitán.", "enviar", prevProposal, draft);
  };
  const withdraw = () => void write(null, "Propuesta retirada.", "retirar", prevProposal, null);

  // «Compararte con…»: the sheet with the squad, then the three numbers
  const [cmp, setCmp] = useState<{ open: boolean; with: string | null }>({ open: false, with: null });
  const opener = useRef<HTMLButtonElement>(null);
  const him = cmp.with ? (squad.find((s) => s.id === cmp.with) ?? null) : null;
  const closeCmp = () => {
    setCmp({ open: false, with: null });
    opener.current?.focus();
  };

  return (
    <div className="tc-juego">
      <header className="tc-head">
        <div className="tc-head__t">
          <p className="tc-kick">Tu juego</p>
          <h2 className="nx-h2">{juegoTitle(marks, data.card.posLong ?? null)}</h2>
          <p className="nx-sub">Dónde juegas, dónde quieres jugar, tu sitio en el equipo y con quién te entiendes.</p>
        </div>
        {editable && (
          <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={send} disabled={!sendable || busy} aria-busy={busy || undefined}>
            <Svg d={SEND} />
            {busy && sendable ? "Enviando…" : "Enviar al capitán"}
          </button>
        )}
      </header>

      <div className="tc-ju">
        <section aria-labelledby="tc-pos-h">
          <h3 className="nx-vh" id="tc-pos-h">
            Tus puestos en el campo
          </h3>
          <div className="tc-pitch" role="group" aria-label={editable ? "Tus puestos: toca uno para marcarlo" : "Tus puestos (solo para mirar)"}>
            <span className="tc-pitch__mid" aria-hidden="true" />
            {spots.map((s) => (
              <button
                key={s.code}
                type="button"
                className={`vd-glass vd-press tc-pos${s.mark === "main" ? " is-star" : s.mark === "also" ? " is-also" : ""}`}
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
                aria-label={s.aria}
                aria-disabled={!editable || undefined}
                onClick={() => editable && setDraft(tapSpot(marks, s.code))}
              >
                {s.code}
                <small aria-hidden="true">{s.mark === "main" ? "★" : s.mark === "also" ? "✓" : ""}</small>
                {s.min > 0 && (
                  <span className="tc-pos__min" aria-hidden="true">
                    {s.min}′
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="tc-legend">
            <span>★ Tu preferida</span>
            <span>✓ También juegas</span>
            <span>40′ Donde has jugado</span>
          </p>
        </section>

        <div>
          <section className="tk-panel tc-prop" aria-labelledby="tc-prop-h">
            <p className="tk-card__k">Tu propuesta</p>
            <div role="status">
              <h3 className="nx-h3" id="tc-prop-h">
                {status.t}
              </h3>
              <p className="nx-meta tc-prop__d">{status.d}</p>
              {status.ficha && <p className="nx-meta tc-prop__ficha">{status.ficha}</p>}
            </div>
            <p className="nx-meta tc-prop__m">Marcadas: {marksText(marks) || "ninguna todavía"}.</p>
            {editable && <p className="nx-meta">Un toque: también juegas ahí. Dos: tu preferida. Tres: se quita.</p>}
            {nudge && (
              <p className="tc-prop__warn">
                <b>{nudge}</b> Tócalo en el campo para añadirlo a tu propuesta.
              </p>
            )}
            <div className="nx-links">
              {pending && !draft && (
                <button type="button" className="nx-lnk" onClick={withdraw} disabled={busy} aria-busy={busy || undefined}>
                  Retirar la propuesta
                </button>
              )}
              {draft && (
                <button type="button" className="nx-lnk" onClick={() => setDraft(null)}>
                  Volver a lo de tu ficha
                </button>
              )}
              <Link className="nx-lnk" to="/estadisticas/campo/puestos">
                Las posiciones del equipo
              </Link>
            </div>
          </section>
          <section className="nx-sec" aria-labelledby="tc-played-h">
            <div className="nx-sec__head">
              <h3 className="nx-h3" id="tc-played-h">
                Dónde has jugado
              </h3>
              <p className="nx-meta">Por la pizarra oficial de cada acta</p>
            </div>
            <p className="tc-tri__line">{pt.line}</p>
            {pt.note && <p className="nx-meta tc-played__note">{pt.note}</p>}
          </section>
        </div>
      </div>

      <section className="nx-sec" aria-labelledby="tc-rank-h">
        <div className="nx-sec__head">
          <h3 className="nx-h3" id="tc-rank-h">
            Tu sitio en el equipo
          </h3>
          <p className="nx-meta">{rankMeta(data.seasonName, me.rows, of)}</p>
        </div>
        <ul className="tc-rank">
          {lads.map((r) => (
            <li key={r.key} className="tc-rk">
              <b>{r.label}</b>
              <span className="tc-rk__v">{r.value}</span>
              <span className="tc-rk__l">
                <span className="tc-lad" role="img" aria-label={r.aria} style={{ "--n": r.slots.length } as CSSProperties}>
                  {r.slots.map((s, i) => (
                    <i key={i} className={s === "me" ? "is-me" : s === "none" ? "is-none" : undefined} />
                  ))}
                </span>
                <span>{r.line}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="tc-ju2">
        <section className="nx-sec" aria-labelledby="tc-pair-h">
          <div className="nx-sec__head">
            <h3 className="nx-h3" id="tc-pair-h">
              Tu mejor sociedad
            </h3>
          </div>
          <div className="tc-pair">
            <PShirt n={pair.n} />
            <div>
              <b>{pair.name}</b>
              <span className="nx-meta">{pair.line}</span>
            </div>
          </div>
        </section>
        <section className="nx-sec" aria-labelledby="tc-cmp-h">
          <div className="nx-sec__head">
            <h3 className="nx-h3" id="tc-cmp-h">
              Compararte con…
            </h3>
          </div>
          <p className="nx-meta">Elige un compañero: tus números al lado de los suyos, y el cara a cara de Plantilla con los dos ya puestos.</p>
          <div className="tk-acts tc-cmp__acts">
            <button ref={opener} type="button" className="vd-glass vd-press nx-btn" onClick={() => setCmp({ open: true, with: null })} disabled={!mine || !mates.length}>
              <Svg d={USERS} />
              Elegir compañero
            </button>
          </div>
        </section>
      </div>

      {cmp.open && mine && <CompareSheet me={mine} mates={mates} him={him} onPick={(id) => setCmp({ open: true, with: id })} onBack={() => setCmp({ open: true, with: null })} onClose={closeCmp} />}
    </div>
  );
}

/** «Compararte con…»: the squad to pick from, then his three numbers beside yours and the cara a cara. In the
 *  body (the page is a container: the containing block of fixed boxes); Esc and the scrim close it, the focus goes
 *  in and back to «Elegir compañero». */
function CompareSheet({ me, mates, him, onPick, onBack, onClose }: { me: SquadNumbers; mates: SquadNumbers[]; him: SquadNumbers | null; onPick: (id: string) => void; onBack: () => void; onClose: () => void }) {
  const inBrowser = useInBrowser();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [him]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const rows = him ? compareRows(me, him) : [];
  const href = him ? caraHref(me.id, him.id) : null;
  const sheet = (
    <SheetFrame
      id="tc-cmp-sh"
      sheetRef={ref}
      onClose={onClose}
      className="tju-sheet"
      head={
        <div>
          <p className="nx-sheet__k">Plantilla › Cara a cara</p>
          <h2 id="tc-cmp-sh">{him ? `Tú y ${him.name}` : "Compararte con…"}</h2>
        </div>
      }
    >
      {!him ? (
        <>
          <p className="nx-meta">Elige con quién: verás tus números al lado de los suyos.</p>
          <div className="tju-grid">
            {mates.map((m) => (
              <button key={m.id} type="button" className="vd-glass vd-press" onClick={() => onPick(m.id)}>
                <PShirt n={m.num} />
                {m.name}
                {m.num && <span className="nx-vh">, dorsal {m.num}</span>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <table className="tju-cmp">
            <caption className="nx-vh">Tus números y los de {him.name} esta temporada</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="nx-vh">Número</span>
                </th>
                <th scope="col">Tú</th>
                <th scope="col">{him.name}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">
                    {r.label}
                    <small>{r.ahead}</small>
                  </th>
                  <td className={r.side === "me" ? "is-up" : undefined}>{r.mine}</td>
                  <td className={r.side === "him" ? "is-up" : undefined}>{r.his}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="nx-sheet__btns">
            {href && (
              <Link className="vd-glass vd-press nx-btn nx-btn--pri" to={href.to} search={href.search}>
                Abrir el cara a cara
              </Link>
            )}
            <button type="button" className="nx-lnk" onClick={onBack}>
              Elegir a otro
            </button>
          </div>
        </>
      )}
    </SheetFrame>
  );
  return inBrowser ? createPortal(sheet, document.body) : sheet;
}
