// «Tableros» (Más → Tableros): Mis tableros (rename the one on screen, duplicate, delete with a
// confirmation and a few seconds to undo, new, open any), Oficial (what the whole team sees: view it,
// copy it to edit, agree or doubt; captains publish theirs for this match or the season) and Partido
// (the match the board is for, with its result band, and the season the data comes from).
import { useEffect, useId, useRef, useState } from "react";
import { Icon, Nuevo } from "./icons";
import { nuevoOn } from "./rail";
import { PanelHead } from "./SheetPanels";
import { useConfirmKeys } from "./useConfirmKeys";
import { matchBand, matchLabel, nameError, NAME_MAX, type CalMatch } from "./boards";
import type { ReactionValue } from "../reactions";
import { apiError } from "../../../lib/clubApi";

export type TbTab = "m" | "o" | "p";

export interface BoardRowView {
  id: string;
  name: string;
  meta: string;
  on: boolean;
  official: boolean;
  /** Only admins delete an official board. */
  deletable: boolean;
}

export interface OfficialView {
  id: string;
  name: string;
  /** «Por @capi · este partido (J8 · MAD SKY)». */
  by: string;
  /** The board on screen is this official. */
  viewing: boolean;
}

export interface ReactionsView {
  enabled: boolean;
  ok: number;
  dudas: number;
  mine: ReactionValue | null;
  /** Admins only: who has doubts (useReactions). */
  who?: string[];
}

/** «Quitar el oficial» waits this long (ms) with a «Deshacer» before it goes through. */
export const UNPUB_MS = 6000;

export interface TablerosProps {
  tab: TbTab;
  onTab: (t: TbTab) => void;
  onBack: () => void;
  ready: boolean;
  /** The board on screen. */
  id: string | null;
  name: string;
  ro: boolean;
  saveTxt: string;
  saveCls: string;
  seasonName: string;
  /** Your boards (for the list and for unique names). */
  boards: BoardRowView[];
  /** The board on screen is one of yours and you have another one to fall back on. */
  canDelete: boolean;
  onRename: (name: string) => Promise<void>;
  onDuplicate: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  /** Boards deleted a moment ago: still undoable until the deletion goes through. */
  pending: { id: string; name: string; undo: () => void }[];
  // Oficial
  official: OfficialView | null;
  reactions: ReactionsView | null;
  isCap: boolean;
  /** The match «este partido» means (linked, else the next one); null = none. */
  scopeMatch: CalMatch | null;
  /** The board on screen is official, and for which match (null = the season). */
  onScreenOfficial: { matchId: string | null } | null;
  /** The board on screen can be published (yours, or any for an admin; loaded). */
  canPublish: boolean;
  /** Why the seven on screen can't be the official yet (not seven, no goalkeeper); null = it can. */
  pubBlock: string | null;
  /** What the team should know before it becomes the official (no va, bajas, out of position). */
  pubWarn: string[];
  onViewOfficial: () => void;
  onDupOfficial: () => void;
  onReact: (v: ReactionValue) => void;
  onPublish: (matchId: string | null) => Promise<void>;
  onUnpublish: (id: string) => void;
  // Partido
  calendar: CalMatch[];
  matchId: string | null;
  onLink: (matchId: string | null) => void;
  seasons: { id: string; name: string }[];
  seasonId: string;
  onSeason: (id: string) => void;
}

/** The name of the board on screen, renamed as you type (saved after a pause, on Enter or on leaving). */
function NameField({ id, name, ro, boards, onRename }: { id: string | null; name: string; ro: boolean; boards: BoardRowView[]; onRename: (n: string) => Promise<void> }) {
  const errId = useId();
  const [edit, setEdit] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // The name being written (Enter, then the blur, must not write it twice).
  const inflight = useRef<string | null>(null);
  const value = edit ?? name;
  const err = edit != null ? nameError(edit, boards, id) : null;
  const save = () => {
    if (edit == null || err || inflight.current === edit) return;
    const v = edit;
    inflight.current = v;
    onRename(v)
      .then(() => {
        setEdit((e) => (e === v ? null : e));
        setFailed(null);
      })
      .catch((e: unknown) => setFailed(apiError(e)))
      .finally(() => {
        if (inflight.current === v) inflight.current = null;
      });
  };
  // A pause while typing saves the name.
  useEffect(() => {
    if (edit == null || err) return;
    const t = window.setTimeout(save, 900);
    return () => window.clearTimeout(t);
  });
  const shown = err ?? failed;
  return (
    <>
      <input
        type="text"
        value={value}
        maxLength={NAME_MAX + 10}
        onChange={(e) => {
          setEdit(e.target.value);
          setFailed(null);
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          } else if (e.key === "Escape" && edit != null) {
            e.preventDefault();
            e.stopPropagation();
            setEdit(null);
            setFailed(null);
          }
        }}
        aria-label="Nombre del tablero"
        aria-invalid={!!shown}
        aria-describedby={shown ? errId : undefined}
        disabled={ro}
      />
      {shown && (
        <p className="nm-err" id={errId} role="alert">
          {shown}
        </p>
      )}
    </>
  );
}

export function TablerosPanel(p: TablerosProps) {
  // A delete waits for a second tap, next to where it was asked for (the card on top or the row).
  const [confirm, setConfirm] = useState<{ id: string; at: "cur" | "row" } | null>(null);
  const scopeDefault: "p" | "t" = p.onScreenOfficial ? (p.onScreenOfficial.matchId ? "p" : "t") : p.scopeMatch ? "p" : "t";
  const [alc, setAlc] = useState<"p" | "t" | null>(null);
  const scope = alc === "p" && !p.scopeMatch ? "t" : (alc ?? scopeDefault);
  const scopeMatchId = scope === "p" ? (p.scopeMatch?.id ?? null) : null;
  const sameScope = !!p.onScreenOfficial && (p.onScreenOfficial.matchId ?? null) === scopeMatchId;
  const [publishing, setPublishing] = useState(false);
  // Publishing a seven with warnings asks once more, in the card (undefined = not asking).
  const [askPub, setAskPub] = useState<string | null | undefined>(undefined);
  // «Quitar el oficial» and linking the official to another match (it republishes it and tells the team)
  // ask once more too.
  const [askUnpub, setAskUnpub] = useState(false);
  const [askLink, setAskLink] = useState<string | null | undefined>(undefined);
  // «Quitarlo» waits a few seconds with a «Deshacer»; leaving the panel sends it at once.
  const [unpub, setUnpub] = useState<{ id: string; name: string } | null>(null);
  const unpubT = useRef<{ id: string; t: number } | null>(null);
  const onUnpublish = useRef(p.onUnpublish);
  useEffect(() => {
    onUnpublish.current = p.onUnpublish;
  });
  const sendUnpub = () => {
    const u = unpubT.current;
    if (!u) return;
    window.clearTimeout(u.t);
    unpubT.current = null;
    onUnpublish.current(u.id);
  };
  useEffect(() => sendUnpub, []);
  const askedUnpub = (id: string, name: string) => {
    sendUnpub();
    setUnpub({ id, name });
    unpubT.current = {
      id,
      t: window.setTimeout(() => {
        sendUnpub();
        setUnpub(null);
      }, UNPUB_MS),
    };
  };
  const undoUnpub = () => {
    if (unpubT.current) window.clearTimeout(unpubT.current.t);
    unpubT.current = null;
    setUnpub(null);
  };
  useConfirmKeys(!!confirm || askPub !== undefined || askUnpub || askLink !== undefined, () => {
    setConfirm(null);
    setAskPub(undefined);
    setAskUnpub(false);
    setAskLink(undefined);
  });
  const doPublish = (mid: string | null) => {
    setAskPub(undefined);
    setPublishing(true);
    void p.onPublish(mid).finally(() => setPublishing(false));
  };
  const linked = p.calendar.find((m) => m.id === p.matchId) ?? null;
  const band = matchBand(linked);
  const linkM = askLink ? p.calendar.find((m) => m.id === askLink) : undefined;
  const linkTo = !askLink ? "toda la temporada" : linkM ? matchLabel(linkM) : "otro partido";
  const scopeTxt = (matchId: string | null) => (matchId ? "este partido" : "toda la temporada");

  const confirmRow = (bid: string, name: string, at: "cur" | "row") =>
    confirm?.id === bid &&
    confirm.at === at && (
      <div className="cfm" role="group" aria-label={"¿Borrar " + name + "?"}>
        <span>
          ¿Borrar <b>{name}</b>? Tendrás unos segundos para deshacerlo.
        </span>
        <button
          type="button"
          className="b3 danger"
          onClick={() => {
            setConfirm(null);
            p.onDelete(bid);
          }}
        >
          <Icon n="trash" />
          Borrar
        </button>
        <button type="button" className="b3" onClick={() => setConfirm(null)}>
          Cancelar
        </button>
      </div>
    );

  return (
    <>
      <PanelHead kick="Guardado automático" title="Tableros" onBack={p.onBack} />
      <div className="tabs" role="group" aria-label="Sección de tableros" style={{ marginTop: 4 }}>
        <button type="button" onClick={() => p.onTab("m")} aria-pressed={p.tab === "m"}>
          Mis tableros
        </button>
        <button type="button" onClick={() => p.onTab("o")} aria-pressed={p.tab === "o"}>
          Oficial
        </button>
        <button type="button" onClick={() => p.onTab("p")} aria-pressed={p.tab === "p"}>
          Partido
        </button>
      </div>

      {p.tab === "m" && (
        <>
          <div className="bd-cur" style={{ marginTop: 12 }}>
            <NameField key={p.id ?? "draft"} id={p.id} name={p.name} ro={p.ro || !p.ready} boards={p.boards} onRename={p.onRename} />
            <span className="auto">
              <i aria-hidden="true" className={p.saveCls} />
              {p.saveTxt}
            </span>
            <div className="row">
              <button type="button" className="b3" onClick={p.onDuplicate} disabled={!p.ready}>
                <Icon n="copy" />
                Duplicar
              </button>
              <button type="button" className="b3" onClick={() => p.id && setConfirm({ id: p.id, at: "cur" })} disabled={!p.canDelete || !p.id}>
                <Icon n="trash" />
                Borrar
              </button>
              <button type="button" className="b3" onClick={p.onNew} disabled={!p.ready}>
                <Icon n="plus" w={15} />
                Nuevo
              </button>
            </div>
            {p.id && confirmRow(p.id, p.name, "cur")}
          </div>
          {p.pending.map((d) => (
            <div key={d.id} className="cfm" role="group" aria-label={"«" + d.name + "» borrado"} style={{ marginTop: 10 }}>
              <span>
                <b>«{d.name}»</b> borrado: aún puedes recuperarlo.
              </span>
              <button type="button" className="b3" onClick={d.undo} aria-label={"Deshacer el borrado de «" + d.name + "»"}>
                Deshacer
              </button>
            </div>
          ))}
          <h3>Mis tableros · {p.seasonName}</h3>
          {p.boards.length ? (
            <ul className="bl">
              {p.boards.map((b) => (
                <li key={b.id} className={b.on ? "on" : ""}>
                  <button type="button" className="op" onClick={() => p.onOpen(b.id)} aria-current={b.on}>
                    <b>{b.name}</b>
                    <small>{(b.official ? "Oficial · " : "") + b.meta}</small>
                  </button>
                  <button type="button" className="ib" onClick={() => p.onCopy(b.id)} aria-label={"Duplicar " + b.name}>
                    <Icon n="copy" />
                  </button>
                  <button type="button" className="ib" onClick={() => setConfirm({ id: b.id, at: "row" })} disabled={p.boards.length < 2 || !b.deletable} aria-label={"Borrar " + b.name}>
                    <Icon n="trash" />
                  </button>
                  {confirmRow(b.id, b.name, "row")}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">{p.ready ? "Aún no tienes tableros esta temporada: el primero se guarda solo con tu primer cambio." : "Cargando tus tableros…"}</p>
          )}
        </>
      )}

      {p.tab === "o" && (
        <div className="off" style={{ marginTop: 12 }}>
          <span className="k2">
            <Icon n="lock" />
            Lo ve todo el equipo
          </span>
          {p.official ? (
            <>
              <b>{p.official.name}</b>
              <small>{p.official.by}</small>
              <div className="row">
                <button type="button" className="b3" onClick={p.onViewOfficial} aria-pressed={p.official.viewing}>
                  <Icon n="eye" />
                  {p.official.viewing ? "Volver a mi tablero" : "Ver el oficial"}
                </button>
                <button type="button" className="b3" onClick={p.onDupOfficial}>
                  <Icon n="copy" />
                  Duplicar para editar
                </button>
              </div>
              {p.reactions && (
                <div className="reac" role="group" aria-label="¿De acuerdo con el siete oficial?">
                  <button type="button" onClick={() => p.onReact("ok")} aria-pressed={p.reactions.mine === "ok"} disabled={!p.reactions.enabled}>
                    <Icon n="thumb" />
                    De acuerdo <b>{p.reactions.ok}</b>
                  </button>
                  <button type="button" onClick={() => p.onReact("dudas")} aria-pressed={p.reactions.mine === "dudas"} disabled={!p.reactions.enabled}>
                    <Icon n="doubt" />
                    Con dudas <b>{p.reactions.dudas}</b>
                  </button>
                  {nuevoOn("tableros") && <Nuevo />}
                </div>
              )}
              {p.reactions?.who && p.reactions.who.length > 0 && (
                <p className="empty">
                  <b>Con dudas:</b> {p.reactions.who.join(", ")} <small>(solo lo ven los admins)</small>
                </p>
              )}
            </>
          ) : (
            <>
              <b>Aún no hay siete oficial</b>
              <small>{p.isCap ? "Publica tu tablero y el equipo lo verá aquí." : "Cuando un capitán lo publique, aparecerá aquí."}</small>
            </>
          )}
          {p.isCap ? (
            <>
              <span className="k2">Alcance del oficial · capitán</span>
              <div className="sg two" role="group" aria-label="Alcance">
                <button type="button" onClick={() => setAlc("p")} aria-pressed={scope === "p"} disabled={!p.scopeMatch}>
                  Este partido
                </button>
                <button type="button" onClick={() => setAlc("t")} aria-pressed={scope === "t"}>
                  La temporada
                </button>
              </div>
              {!p.scopeMatch && <p>Sin partido por jugar ni vinculado: el oficial será para toda la temporada.</p>}
              <button
                type="button"
                className="b3 gold"
                disabled={!p.canPublish || sameScope || publishing || !!p.pubBlock}
                onClick={() => (p.pubWarn.length ? setAskPub(scopeMatchId) : doPublish(scopeMatchId))}
              >
                {sameScope ? "Ya es el oficial" : p.onScreenOfficial ? "Cambiar el alcance" : "Publicar mi tablero como oficial"}
              </button>
              {askPub !== undefined && (
                <div className="cfm" role="group" aria-label="¿Publicar con avisos?">
                  <span>
                    Este siete tiene avisos: <b>{p.pubWarn.join(", ")}</b>. ¿Publicarlo igualmente?
                  </span>
                  <button type="button" className="b3 gold" onClick={() => doPublish(askPub)}>
                    Publicar igualmente
                  </button>
                  <button type="button" className="b3" onClick={() => setAskPub(undefined)}>
                    Cancelar
                  </button>
                </div>
              )}
              {!p.canPublish && !p.onScreenOfficial && <p>Abre uno de tus tableros para publicarlo.</p>}
              {p.canPublish && !sameScope && p.pubBlock && <p className="why">{p.pubBlock}</p>}
              {p.onScreenOfficial && <p>Publicado: el equipo ya lo ve como oficial ({scopeTxt(p.onScreenOfficial.matchId)}).</p>}
              {p.official && !unpub && (
                <button type="button" className="b3" onClick={() => setAskUnpub(true)} aria-expanded={askUnpub}>
                  <Icon n="x" w={16} />
                  Quitar el oficial
                </button>
              )}
              {unpub && (
                <div className="cfm" role="group" aria-label={"«" + unpub.name + "» deja de ser el oficial"}>
                  <span role="status">
                    <b>«{unpub.name}»</b> deja de ser el oficial en unos segundos.
                  </span>
                  <button type="button" className="b3" onClick={undoUnpub} aria-label={"Deshacer: «" + unpub.name + "» sigue de oficial"}>
                    Deshacer
                  </button>
                </div>
              )}
              {p.official && askUnpub && !unpub && (
                <div className="cfm" role="group" aria-label="¿Quitar el oficial?">
                  <span>
                    ¿Quitar <b>{p.official.name}</b> como oficial? El equipo dejará de verlo.
                  </span>
                  <button
                    type="button"
                    className="b3 danger"
                    onClick={() => {
                      setAskUnpub(false);
                      if (p.official) askedUnpub(p.official.id, p.official.name);
                    }}
                  >
                    Quitarlo
                  </button>
                  <button type="button" className="b3" onClick={() => setAskUnpub(false)}>
                    Cancelar
                  </button>
                </div>
              )}
            </>
          ) : (
            <p>Solo los capitanes y los admins publican el oficial.</p>
          )}
        </div>
      )}

      {p.tab === "p" && (
        <>
          <h3>Partido</h3>
          <label className="selw full">
            Vincular a
            <select
              value={p.matchId ?? ""}
              onChange={(e) => {
                const mid = e.target.value || null;
                // an official's match is its alcance: changing it republishes it and the team is told
                if (p.onScreenOfficial) setAskLink(mid);
                else p.onLink(mid);
              }}
              aria-label="Vincular a un partido"
              disabled={p.ro || !p.ready}
            >
              <option value="">Sin partido</option>
              {p.matchId && !linked && <option value={p.matchId}>Un partido de otra temporada</option>}
              {p.calendar.map((m) => (
                <option key={m.id} value={m.id}>
                  {matchLabel(m)}
                </option>
              ))}
            </select>
          </label>
          {askLink !== undefined && (
            <div className="cfm" role="group" aria-label="¿Cambiar el partido del oficial?" style={{ marginTop: 8 }}>
              <span>
                Esto cambia el oficial {linked ? "del " + matchLabel(linked) : p.matchId ? "de su partido" : "de toda la temporada"} a <b>{linkTo}</b> y avisa al equipo.
              </span>
              <button
                type="button"
                className="b3 gold"
                onClick={() => {
                  const mid = askLink;
                  setAskLink(undefined);
                  p.onLink(mid);
                }}
              >
                Cambiarlo
              </button>
              <button type="button" className="b3" onClick={() => setAskLink(undefined)}>
                Cancelar
              </button>
            </div>
          )}
          <div className="band">
            <span className={"res " + band.r} aria-hidden="true">
              {band.letter}
            </span>
            <div>
              <b>{band.title}</b>
              <small>{band.sub}</small>
            </div>
          </div>
          {!p.calendar.length && <p className="empty">Esta temporada aún no tiene partidos en el calendario.</p>}
          {p.onScreenOfficial && <p className="empty">Es el oficial: el partido vinculado es su alcance (sin partido = toda la temporada).</p>}
          <h3>Temporada</h3>
          <label className="selw full">
            Datos de
            <select value={p.seasonId} onChange={(e) => p.onSeason(e.target.value)} aria-label="Temporada de los datos">
              {p.seasonId === "all" && <option value="all">Histórico total</option>}
              {p.seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </>
  );
}
