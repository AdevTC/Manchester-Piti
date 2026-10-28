// CLUB · Temporadas (/admin/club/temporadas; board part-club.html § temporadas): the season in course as a vitrina
// (G E P and goals, the balda of its jornadas, the pichichi, mayor victoria, mejor racha, más veces MVP, the captain
// on the pitch), the club's trophies outside the league (M-19), the other seasons and «Nueva temporada». Renames,
// the captain, (un)archiving and the trophies wait 5 s behind «Deshacer»; creating and deleting are awaited in the
// sheet. Eliminar goes through the server (deleteSeason: its players back to the plantilla, B-CLUB-01).
import { useMemo, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase";
import { apiError, deleteSeason } from "../../../../lib/clubApi";
import { useClubContent } from "../../../../lib/clubContent";
import { readTrophies } from "../../../../lib/clubExtras";
import type { ClubTrophy } from "../../../../lib/clubContentDefaults";
import type { SeasonDoc } from "../../../../lib/schemas";
import { plural } from "../../../../lib/derived/words";
import { mvpWinners } from "../../../../lib/vestuario";
import { useArchivedCounts, useMvpTally } from "../../club/clubLive";
import { nameIn } from "../../club/plantillaLogic";
import { archiveImpact, copyLeftOut, copyRosterPlan, countsNote, nextSeasonName, seasonCards, seasonNameError, seasonShowcase, seasonTag, type SeasonCard } from "../../club/seasonsLogic";
import { useClubWrites } from "../../club/useClubWrites";
import { SalaSheet } from "../../shell/Sheet";
import { SalaLink } from "../../shell/SalaLink";
import { ScreenError, ScreenLoading } from "../../shell/Screen";
import { useAdmin } from "../../shell/context";
import { useStatus } from "../../shell/statusContext";
import { la } from "./model";
import { RoomScreen } from "./Room";
import { Shirt } from "./shirts";
import { shirtOf, useStills } from "./stills";

type SheetState =
  | { k: "rename"; id: string; name: string }
  | { k: "arch" | "unarch" | "del"; id: string }
  | { k: "new"; name: string; copy: boolean; from: string; incl: boolean }
  | { k: "cap"; id: string; pid: string }
  | { k: "trophy"; i: number | null; name: string; date: string; photoUrl: string; note: string }
  | null;

const STATE_WORD: Record<SeasonCard["state"], string> = { active: "Activa · se ve en la web", archived: "Archivada · oculta en la web", prep: "En preparación", done: "Terminada" };
const httpsOk = (u: string) => !u.trim() || /^https:\/\/\S+$/.test(u.trim());
const dateOk = (d: string) => /^\d{4}(-\d{2}-\d{2})?$/.test(d.trim());

export function TemporadasScreen() {
  const data = useAdmin();
  const status = useStatus();
  const writes = useClubWrites();
  const mvpTally = useMvpTally();
  const content = useClubContent();
  const [pending, setPending] = useState<Record<string, Partial<SeasonDoc>>>({});
  const [trophyDraft, setTrophyDraft] = useState<ClubTrophy[] | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState("");

  const seasons = useMemo(() => data.seasons.map((s) => (pending[s.id] ? { ...s, ...pending[s.id] } : s)), [data.seasons, pending]);
  const archivedIds = useMemo(() => seasons.filter((s) => s.archived).map((s) => s.id), [seasons]);
  const hidden = useArchivedCounts(archivedIds);
  const activeId = data.season?.id;
  const active = activeId ? (seasons.find((s) => s.id === activeId) ?? null) : null;
  const cards = seasonCards({ seasons, players: data.players, matches: data.matches, stateOf: data.stateOf, activeId, now: data.now, hidden });
  const activeCard = cards.find((c) => c.id === activeId) ?? null;
  const others = cards.filter((c) => c.id !== activeId);
  const trophies = trophyDraft ?? readTrophies(content);
  const pname = (id: string, sid: string) => {
    const p = data.players.find((x) => x.id === id);
    return p ? nameIn(p, sid).toLocaleUpperCase("es") : "—";
  };
  const show = active
    ? seasonShowcase({
        seasonId: active.id,
        matches: data.matches,
        stateOf: data.stateOf,
        now: data.now,
        mvpOf: (m) => mvpWinners(m, mvpTally.get(m.id), data.now),
        nameOf: (id) => pname(id, active.id),
      })
    : null;
  const pich = show?.pichichi ? data.players.find((p) => p.id === show.pichichi?.ids[0]) : undefined;
  const pichShirt = shirtOf(pich, activeId ?? "");
  const src = useStills(pich ? [pichShirt] : []);
  const captain = active?.captainPlayerId ? data.players.find((p) => p.id === active.captainPlayerId) : undefined;
  const roster = active ? data.players.filter((p) => (p.seasons ?? []).includes(active.id)) : [];
  const lastPub = [...data.matches].reverse().find((m) => m.seasonId === activeId && data.stateOf(m) === "published" && m.status === "finished");
  const byId = (id: string) => seasons.find((s) => s.id === id);

  // ── optimistic patches behind «Deshacer» ──
  const patch = (id: string, p: Partial<SeasonDoc>) => setPending((all) => ({ ...all, [id]: { ...all[id], ...p } }));
  const unpatch = (id: string, keys: (keyof SeasonDoc)[]) => () =>
    setPending((all) => {
      const cur = { ...all[id] };
      for (const k of keys) delete cur[k];
      const n = { ...all };
      if (Object.keys(cur).length) n[id] = cur;
      else delete n[id];
      return n;
    });
  const close = () => {
    if (busy) return;
    setSheet(null);
    setSheetError("");
  };
  const open = (s: SheetState) => {
    setSheetError("");
    setSheet(s);
  };

  const copySources = seasons.filter((s) => data.players.some((p) => (p.seasons ?? []).includes(s.id)));
  const openNew = () => open({ k: "new", name: nextSeasonName(seasons), copy: copySources.length > 0, from: active && copySources.some((s) => s.id === active.id) ? active.id : (copySources.at(-1)?.id ?? ""), incl: false });

  const saveTrophies = (next: ClubTrophy[], message: string) => {
    const prevDraft = trophyDraft;
    setTrophyDraft(next);
    const done = () => setTrophyDraft(null);
    status.defer({
      tag: "Vitrina",
      message,
      commit: () => setDoc(doc(db, "clubContent", "main"), { trophies: next.map((t) => ({ name: t.name.trim(), date: t.date.trim(), ...(t.photoUrl?.trim() ? { photoUrl: t.photoUrl.trim() } : {}), ...(t.note?.trim() ? { note: t.note.trim() } : {}) })) }, { merge: true }),
      onUndo: () => setTrophyDraft(prevDraft),
      onError: done,
      onDone: done,
      errorMessage: "No se ha podido guardar la vitrina",
    });
  };

  const submit = async () => {
    if (!sheet) return;
    if (sheet.k === "new") {
      if (seasonNameError(sheet.name, seasons, null)) return;
      const name = sheet.name.trim();
      const copy = sheet.copy && sheet.from ? copyRosterPlan(data.players, sheet.from, sheet.incl) : [];
      setBusy(true);
      setSheetError("");
      try {
        await writes.createSeason(name, copy);
        setSheet(null);
        status.show({ tag: seasonTag(name), message: `${name} creada en preparación${copy.length ? ` · plantilla copiada (${plural(copy.length, "jugador", "jugadores")})` : " · sin plantilla"}` });
      } catch (e) {
        setSheetError(`No se ha podido crear: ${apiError(e)}`);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (sheet.k === "trophy") {
      const t: ClubTrophy = { name: sheet.name.trim(), date: sheet.date.trim(), photoUrl: sheet.photoUrl.trim(), note: sheet.note.trim() };
      if (!t.name || !dateOk(t.date) || !httpsOk(t.photoUrl ?? "")) return;
      const next = sheet.i === null ? [t, ...trophies] : trophies.map((x, i) => (i === sheet.i ? t : x));
      setSheet(null);
      saveTrophies(next.sort((a, b) => b.date.localeCompare(a.date)), sheet.i === null ? `«${t.name}» en la vitrina · la web ya lo enseña` : `«${t.name}» corregido`);
      return;
    }
    const s = byId(sheet.id);
    if (!s) return;
    if (sheet.k === "del") {
      setBusy(true);
      setSheetError("");
      try {
        const r = await deleteSeason({ seasonId: s.id });
        setSheet(null);
        const back = r.data?.players ?? 0;
        status.show({ tag: seasonTag(s.name), message: `${s.name} eliminada${back ? ` · ${plural(back, "jugador vuelve", "jugadores vuelven")} a la plantilla, en «Antiguos»` : ""}` });
      } catch (e) {
        setSheetError(`No se ha podido eliminar: ${apiError(e)}`);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (sheet.k === "rename") {
      const name = sheet.name.trim();
      if (seasonNameError(name, seasons, s.id) || name === s.name) return;
      setSheet(null);
      patch(s.id, { name });
      const done = unpatch(s.id, ["name"]);
      status.defer({ tag: seasonTag(s.name), message: `Ahora se llama «${name}»`, commit: () => writes.saveSeason(s.id, { name }), onUndo: done, onError: done, onDone: done, errorMessage: "No se ha podido renombrar la temporada" });
      return;
    }
    if (sheet.k === "cap") {
      const captainPlayerId = sheet.pid;
      if (captainPlayerId === (s.captainPlayerId ?? "")) return;
      setSheet(null);
      patch(s.id, { captainPlayerId });
      const done = unpatch(s.id, ["captainPlayerId"]);
      const p = data.players.find((x) => x.id === captainPlayerId);
      status.defer({ tag: seasonTag(s.name), message: p ? `Capitán de ${la(s.name)}: ${nameIn(p, s.id).toLocaleUpperCase("es")}` : `${la(s.name)} se queda sin capitán`, commit: () => writes.saveSeason(s.id, { captainPlayerId }), onUndo: done, onError: done, onDone: done, errorMessage: "No se ha podido cambiar el capitán" });
      return;
    }
    const archive = sheet.k === "arch";
    setSheet(null);
    patch(s.id, { archived: archive });
    const done = unpatch(s.id, ["archived"]);
    status.defer({ tag: seasonTag(s.name), message: archive ? `${s.name} archivada · oculta en la web` : `${s.name} visible otra vez`, commit: () => writes.setArchived(s.id, archive), onUndo: done, onError: done, onDone: done, errorMessage: archive ? "No se ha podido archivar" : "No se ha podido desarchivar" });
  };

  const lede = active && activeCard ? `${active.name} · ${activeCard.state === "active" ? "activa" : STATE_WORD[activeCard.state].toLowerCase()} · ${activeCard.played} de ${activeCard.total} jugadas` : "Ninguna temporada en curso";

  const seasonRow = (c: SeasonCard) => {
    const isArch = c.state === "archived";
    const line = isArch ? (c.players === null ? "Contando…" : `${c.matches} · ${plural(c.players, "jugador", "jugadores")}`) : c.played ? `${c.jornadas} jornadas · ${plural(c.players ?? 0, "jugador", "jugadores")}` : `Sin partidos publicados · ${plural(c.players ?? 0, "jugador", "jugadores")}`;
    return (
      <li key={c.id} className="sc-row cl-season">
        <span className="sc-row__t">
          <b>{c.name}</b>
          <span>{STATE_WORD[c.state]}</span>
          <span>{line}</span>
          {c.state === "prep" && <span>Pasa a ser la temporada en curso con su primer partido.</span>}
        </span>
        <span className="cl-acts">
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-haspopup="dialog" onClick={() => open({ k: "rename", id: c.id, name: c.name })}>
            Renombrar
          </button>
          {isArch ? (
            <>
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-haspopup="dialog" onClick={() => open({ k: "unarch", id: c.id })}>
                Desarchivar
              </button>
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm cl-danger" aria-haspopup="dialog" onClick={() => open({ k: "del", id: c.id })}>
                Eliminar
              </button>
            </>
          ) : (
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-haspopup="dialog" onClick={() => open({ k: "arch", id: c.id })}>
              Archivar
            </button>
          )}
        </span>
      </li>
    );
  };

  return (
    <RoomScreen room="temporadas" lede={lede} primary={{ label: "Nueva temporada", onClick: openNew, popup: true }}>
      {data.loading ? (
        <ScreenLoading label="Cargando las temporadas" />
      ) : data.error ? (
        <ScreenError what="las temporadas" onRetry={() => window.location.reload()} />
      ) : (
        <div className="cl-grid cl-tem">
          <section className="cl-col sc-scroll" aria-labelledby="cl-vit-t">
            {active && activeCard && show ? (
              <>
                <header className="cl-vit__h">
                  <h2 className="sc-h2" id="cl-vit-t">
                    {active.name}
                  </h2>
                  <span className="sc-tag sc-tag--toca">{STATE_WORD[activeCard.state]}</span>
                  <span className="cl-acts">
                    <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-haspopup="dialog" onClick={() => open({ k: "rename", id: active.id, name: active.name })}>
                      Renombrar
                    </button>
                    <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-haspopup="dialog" onClick={() => open({ k: active.archived ? "unarch" : "arch", id: active.id })}>
                      {active.archived ? "Desarchivar" : "Archivar"}
                    </button>
                  </span>
                </header>
                {!show.total ? (
                  <p className="sc-p cl-empty">Sin partidos todavía. Crea el primero en Partidos: la vitrina se llena sola con las actas publicadas.</p>
                ) : (
                  <>
                    <p className="cl-gep" aria-label={`${plural(show.g, "victoria", "victorias")}, ${plural(show.e, "empate", "empates")}, ${plural(show.p, "derrota", "derrotas")}, goles ${show.gf} a ${show.ga}`}>
                      <span aria-hidden="true">
                        <b className="sc-num">{show.g}</b>Victorias
                      </span>
                      <span aria-hidden="true">
                        <b className="sc-num">{show.e}</b>Empates
                      </span>
                      <span aria-hidden="true">
                        <b className="sc-num">{show.p}</b>Derrotas
                      </span>
                      <span aria-hidden="true">
                        <b className="sc-num">
                          {show.gf}–{show.ga}
                        </b>
                        Goles
                      </span>
                    </p>
                    <div className="cl-balda">
                      <p className="sc-small">
                        La balda · {show.published} de {show.total} jornadas
                      </p>
                      <ol className="cl-balda__l" aria-label="La balda de la temporada">
                        {show.shelf.map((b) => (
                          <li key={b.id}>
                            <SalaLink className="cl-balda__b" to={`/admin/partidos/${b.id}`} aria-label={b.aria}>
                              <span className={`sc-res ${b.r ? `sc-res--${b.r}` : b.aria.endsWith("aplazado") ? "is-apl" : "is-luego"}`} aria-hidden="true">
                                {b.r ?? (b.aria.endsWith("aplazado") ? "A" : "·")}
                              </span>
                              <small aria-hidden="true">{b.label}</small>
                            </SalaLink>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <ul className="sc-rows">
                      <li className="sc-row cl-pich">
                        {pich ? <Shirt shirt={pichShirt} src={src(pichShirt)} size="s" alt={pichShirt.name} /> : <span aria-hidden="true" />}
                        <span className="sc-row__t">
                          <b>
                            {show.pichichi && show.pichichi.ids.length > 1 ? "Pichichi compartido" : "Pichichi"}
                            {show.pichichi ? ` · ${show.pichichi.ids.map((id) => pname(id, active.id)).join(" · ")}` : ""}
                          </b>
                          <span>{show.pichichi ? `${plural(show.pichichi.goals, "gol", "goles")}${show.pichichi.ids.length > 1 ? " cada uno" : ""}` : "Todavía sin goles"}</span>
                        </span>
                      </li>
                      <li className="sc-row">
                        <span className="sc-row__t">
                          <b>Mayor victoria</b>
                          <span>{show.biggest ? `${show.biggest.gf}–${show.biggest.ga} a ${show.biggest.rival} · ${show.biggest.label}` : "Todavía sin victorias"}</span>
                        </span>
                      </li>
                      <li className="sc-row">
                        <span className="sc-row__t">
                          <b>Mejor racha</b>
                          <span>{show.streak ? plural(show.streak, "victoria seguida", "victorias seguidas") : "Todavía sin victorias"}</span>
                        </span>
                      </li>
                      <li className="sc-row">
                        <span className="sc-row__t">
                          <b>Más veces MVP</b>
                          <span>{show.mvp ? `${show.mvp.ids.map((id) => pname(id, active.id)).join(" · ")} · ${plural(show.mvp.times, "vez", "veces")}` : "Sin votaciones cerradas"}</span>
                        </span>
                        {lastPub && (
                          <SalaLink className="vd-link cl-link" to={`/admin/partidos/${lastPub.id}/despues`}>
                            Corregir un MVP
                          </SalaLink>
                        )}
                      </li>
                      <li className="sc-row">
                        <span className="sc-row__t">
                          <b>Capitán en el campo · {captain ? nameIn(captain, active.id).toLocaleUpperCase("es") : "sin elegir"}</b>
                          <span>{plural(roster.length, "jugador", "jugadores")} en la plantilla · el brazalete de la web, sin permisos (los permisos, en Plantilla › Capitanes)</span>
                        </span>
                        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-haspopup="dialog" onClick={() => open({ k: "cap", id: active.id, pid: active.captainPlayerId ?? "" })}>
                          Cambiar
                        </button>
                      </li>
                    </ul>
                    <p className="sc-small cl-foot">{countsNote(show.waiting, show.waitingDrafts)}</p>
                  </>
                )}
              </>
            ) : (
              <>
                <h2 className="sc-h2" id="cl-vit-t">
                  Ninguna temporada en curso
                </h2>
                <p className="sc-p cl-empty">Crea una temporada y su primer partido: la vitrina se llena sola con las actas publicadas.</p>
              </>
            )}
            <section className="sc-sec" aria-labelledby="cl-tro-t" id="vitrina">
              <header className="sc-sec__h">
                <h2 className="sc-h2" id="cl-tro-t">
                  La vitrina del club
                </h2>
                <span className="sc-sec__n">{trophies.length ? plural(trophies.length, "trofeo", "trofeos") : "Ninguno todavía"}</span>
              </header>
              <p className="sc-small">Las copas y los torneos ganados fuera de la liga: no salen de ninguna acta. La web los pone en la vitrina de El club.</p>
              {trophies.length > 0 && (
                <ul className="sc-rows" style={{ marginTop: 8 }}>
                  {trophies.map((t, i) => (
                    <li key={`${t.name}-${t.date}-${i}`} className="sc-row">
                      <span className="sc-row__t">
                        <b>{t.name}</b>
                        <span>
                          {t.date}
                          {t.note ? ` · ${t.note}` : ""}
                        </span>
                      </span>
                      <span className="cl-acts">
                        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-haspopup="dialog" aria-label={`Corregir «${t.name}»`} onClick={() => open({ k: "trophy", i, name: t.name, date: t.date, photoUrl: t.photoUrl ?? "", note: t.note ?? "" })}>
                          Corregir
                        </button>
                        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Quitar «${t.name}» de la vitrina`} onClick={() => saveTrophies(trophies.filter((_, k) => k !== i), `«${t.name}» fuera de la vitrina`)}>
                          Quitar
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm cl-addrow" aria-haspopup="dialog" aria-disabled={trophies.length >= 30 || undefined} onClick={() => trophies.length < 30 && open({ k: "trophy", i: null, name: "", date: "", photoUrl: "", note: "" })}>
                Añadir un trofeo
              </button>
            </section>
          </section>
          <section className="cl-col sc-scroll" aria-labelledby="cl-oth-t">
            <header className="sc-sec__h">
              <h2 className="sc-h2" id="cl-oth-t">
                Las demás temporadas
              </h2>
            </header>
            {others.length ? <ul className="sc-rows">{others.map(seasonRow)}</ul> : <p className="sc-p cl-empty">No hay más temporadas.</p>}
            <button type="button" className="cl-new" aria-haspopup="dialog" onClick={openNew}>
              <span aria-hidden="true">+</span>
              <span>
                <b>Nueva temporada</b>
                <span>Empieza en preparación, sin partidos. Puedes copiar la plantilla con sus dorsales.</span>
              </span>
            </button>
          </section>
        </div>
      )}
      <TemporadaSheet sheet={sheet} setSheet={setSheet} busy={busy} error={sheetError} onClose={close} onSubmit={() => void submit()} seasons={seasons} activeId={activeId} hidden={hidden} copySources={copySources} />
    </RoomScreen>
  );
}

function TemporadaSheet({
  sheet,
  setSheet,
  busy,
  error,
  onClose,
  onSubmit,
  seasons,
  activeId,
  hidden,
  copySources,
}: {
  sheet: SheetState;
  setSheet: (s: SheetState) => void;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: () => void;
  seasons: SeasonDoc[];
  activeId: string | undefined;
  hidden: ReturnType<typeof useArchivedCounts>;
  copySources: SeasonDoc[];
}) {
  const data = useAdmin();
  if (!sheet) return null;
  const s = "id" in sheet ? seasons.find((x) => x.id === sheet.id) : undefined;
  const active = activeId ? seasons.find((x) => x.id === activeId) : undefined;
  const foot = (label: string, off: boolean, danger = false) => (
    <>
      <button type="button" className="vd-btn vd-glass vd-press" onClick={onClose} aria-disabled={busy || undefined}>
        Cancelar
      </button>
      <button type="button" className={`vd-btn vd-glass vd-press vd-btn--pri${danger ? " cl-danger" : ""}`} aria-disabled={off || busy || undefined} onClick={() => !off && !busy && onSubmit()}>
        {busy ? "Un momento…" : label}
      </button>
    </>
  );
  const err = error ? (
    <p className="cl-alert" role="alert">
      {error}
    </p>
  ) : null;

  if (sheet.k === "new") {
    const bad = seasonNameError(sheet.name, seasons, null);
    const from = seasons.find((x) => x.id === sheet.from);
    const goes = sheet.copy && from ? copyRosterPlan(data.players, from.id, sheet.incl) : [];
    const left = sheet.copy && from ? copyLeftOut(data.players, from.id) : [];
    return (
      <SalaSheet open onClose={onClose} title="Nueva temporada" className="cl-sheet" footer={foot("Crear la temporada", !!bad)}>
        <p className="sc-p cl-sh-lede">Empieza en preparación, sin partidos: pasa a ser la temporada en curso con su primer partido.</p>
        <div className="sc-form sc-form--1">
          <label className="sc-field">
            <span>Nombre</span>
            <input className="vd-input" type="text" maxLength={41} value={sheet.name} onChange={(e) => setSheet({ ...sheet, name: e.target.value })} aria-invalid={!!bad || undefined} />
            <small className={bad ? "is-bad" : ""} role="status">
              {sheet.name.trim().length}/40 · {bad ?? "Libre"}
            </small>
          </label>
          {copySources.length > 0 && (
            <div className="sc-field">
              <span id="cl-cp-l">¿Copiar la plantilla?</span>
              <div className="sc-chips" role="group" aria-labelledby="cl-cp-l">
                <button type="button" className="sc-chip vd-glass vd-press" aria-pressed={sheet.copy} onClick={() => setSheet({ ...sheet, copy: true })}>
                  Sí, con sus dorsales
                </button>
                <button type="button" className="sc-chip vd-glass vd-press" aria-pressed={!sheet.copy} onClick={() => setSheet({ ...sheet, copy: false })}>
                  No, empieza vacía
                </button>
              </div>
            </div>
          )}
          {sheet.copy && copySources.length > 0 && (
            <label className="sc-field">
              <span>Copiar de</span>
              <select className="vd-input" value={sheet.from} onChange={(e) => setSheet({ ...sheet, from: e.target.value })}>
                {copySources.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                    {x.archived ? " · archivada" : ""} · {data.players.filter((p) => (p.seasons ?? []).includes(x.id)).length}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="sc-p">{sheet.copy && from ? `${plural(goes.length, "jugador", "jugadores")} de ${la(from.name)} entran con su nombre en camiseta${sheet.incl && left.length ? `; ${left.length} sin dorsal` : " y su dorsal"}.` : "Empieza con la plantilla vacía: los das de alta desde Plantilla."}</p>
          {sheet.copy && left.length > 0 && (
            <>
              <p className="cl-warn" role="status">
                <span className="sc-tag sc-tag--toca">Sin dorsal</span>
                Sin dorsal en {from ? la(from.name) : "esa temporada"}
                {sheet.incl ? " (entran sin dorsal)" : ", no entran"}: {left.join(", ")}.
              </p>
              <button type="button" className="vd-switch" role="switch" aria-checked={sheet.incl} onClick={() => setSheet({ ...sheet, incl: !sheet.incl })}>
                <span className="vd-switch__track" aria-hidden="true">
                  <span className="vd-switch__knob" />
                </span>
                Copiarlos también, sin dorsal
              </button>
            </>
          )}
        </div>
        {err}
      </SalaSheet>
    );
  }
  if (sheet.k === "trophy") {
    const nameBad = !sheet.name.trim() ? "Ponle nombre." : sheet.name.trim().length > 80 ? "Máximo 80 letras." : "";
    const dBad = !dateOk(sheet.date) ? "La fecha: el año (2026) o el día (2026-05-30)." : "";
    const pBad = !httpsOk(sheet.photoUrl) ? "Tiene que empezar por https://" : "";
    return (
      <SalaSheet open onClose={onClose} title={sheet.i === null ? "Añadir un trofeo" : `Corregir «${sheet.name}»`} className="cl-sheet" footer={foot("Guardar el trofeo", !!(nameBad || dBad || pBad))}>
        <p className="sc-p cl-sh-lede">Una copa o un torneo ganado fuera de la liga. La web lo pone en la vitrina de El club.</p>
        <div className="sc-form sc-form--1">
          <label className="sc-field">
            <span>Nombre</span>
            <input className="vd-input" type="text" maxLength={80} placeholder="Copa de Navidad de Vallecas" value={sheet.name} onChange={(e) => setSheet({ ...sheet, name: e.target.value })} />
            <small className={nameBad ? "is-bad" : ""}>{nameBad || `${sheet.name.trim().length}/80`}</small>
          </label>
          <label className="sc-field">
            <span>Fecha</span>
            <input className="vd-input" type="text" inputMode="numeric" placeholder="2026-12-20" value={sheet.date} onChange={(e) => setSheet({ ...sheet, date: e.target.value.replace(/[^\d-]/g, "").slice(0, 10) })} />
            <small className={dBad && sheet.date ? "is-bad" : ""}>{sheet.date && dBad ? dBad : "El año o el día (AAAA-MM-DD)."}</small>
          </label>
          <label className="sc-field">
            <span>Foto (HTTPS, opcional)</span>
            <input className="vd-input" type="url" placeholder="https://" value={sheet.photoUrl} onChange={(e) => setSheet({ ...sheet, photoUrl: e.target.value })} />
            <small className={pBad ? "is-bad" : ""}>{pBad || (sheet.photoUrl ? "Enlace seguro" : "Opcional")}</small>
          </label>
          <label className="sc-field">
            <span>Nota (opcional)</span>
            <input className="vd-input" type="text" maxLength={200} value={sheet.note} onChange={(e) => setSheet({ ...sheet, note: e.target.value })} />
            <small>{sheet.note.length}/200</small>
          </label>
        </div>
      </SalaSheet>
    );
  }
  if (!s) {
    return (
      <SalaSheet open onClose={onClose} title="Esa temporada ya no está" className="cl-sheet">
        <p className="sc-p">Otro capitán la ha cambiado o eliminado mientras tanto.</p>
      </SalaSheet>
    );
  }
  if (sheet.k === "rename") {
    const bad = seasonNameError(sheet.name, seasons, s.id);
    const t = sheet.name.trim();
    return (
      <SalaSheet open onClose={onClose} title={`Renombrar ${la(s.name)}`} className="cl-sheet" footer={foot("Guardar el nombre", !!bad || t === s.name)}>
        <p className="sc-p cl-sh-lede">El nombre sale en la web, en la caja y en cada partido de la temporada.</p>
        <label className="sc-field">
          <span>Nombre de la temporada</span>
          <input
            className="vd-input"
            type="text"
            maxLength={41}
            value={sheet.name}
            onChange={(e) => setSheet({ ...sheet, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !bad && t !== s.name) {
                e.preventDefault();
                onSubmit();
              }
            }}
            aria-invalid={!!bad || undefined}
            aria-describedby="cl-rn-h"
          />
          <small id="cl-rn-h" className={bad ? "is-bad" : ""} role="status">
            {t.length}/40 · {bad ?? "Libre"}
          </small>
        </label>
      </SalaSheet>
    );
  }
  if (sheet.k === "cap") {
    const opts = data.players
      .filter((p) => (p.seasons ?? []).includes(s.id))
      .map((p) => ({ id: p.id, sh: shirtOf(p, s.id) }))
      .sort((a, b) => (Number(a.sh.num) || 999) - (Number(b.sh.num) || 999));
    return (
      <SalaSheet open onClose={onClose} title={`Capitán en el campo · ${s.name}`} className="cl-sheet" footer={foot("Guardar el capitán", sheet.pid === (s.captainPlayerId ?? ""))}>
        <p className="sc-p cl-sh-lede">El brazalete que sale en la web y en la carta. No da permisos: el brazalete de la sala se da en Plantilla › Capitanes.</p>
        {!opts.length && <p className="sc-p">Nadie juega esta temporada todavía: apúntalos desde la plantilla.</p>}
        <label className="sc-field">
          <span>Capitán</span>
          <select className="vd-input" value={sheet.pid} onChange={(e) => setSheet({ ...sheet, pid: e.target.value })}>
            <option value="">— Sin capitán —</option>
            {opts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.sh.num ? `${o.sh.num} · ` : ""}
                {o.sh.name}
              </option>
            ))}
          </select>
        </label>
      </SalaSheet>
    );
  }
  const impact = archiveImpact(s.id, data.seasons, data.players, data.matches);
  const h = hidden[s.id];
  const nM = s.archived ? (h?.matches ?? impact.matches) : impact.matches;
  const onlyHere = data.players.filter((p) => (p.seasons ?? []).length === 1 && p.seasons?.[0] === s.id).length + (s.archived ? Math.max(0, (h?.players ?? 0) - impact.players) : 0);
  const cons =
    sheet.k === "arch"
      ? [
          `Sus ${plural(impact.matches, "partido", "partidos")} y las estadísticas de ${plural(impact.players, "jugador", "jugadores")} se ocultan en la web`,
          impact.hiddenPlayers ? `${plural(impact.hiddenPlayers, "jugador que solo juega", "jugadores que solo juegan")} esta temporada ${impact.hiddenPlayers === 1 ? "sale" : "salen"} también de la plantilla de aquí` : "Nadie sale de la plantilla: todos juegan otra temporada",
          s.id === activeId ? "Es la temporada en curso: la web se queda sin temporada activa" : "",
          "Las actas y la plantilla no se pierden · se puede desarchivar cuando queráis",
        ]
      : sheet.k === "unarch"
        ? [h ? `Sus ${plural(h.matches, "partido", "partidos")} y las estadísticas de ${plural(h.players, "jugador", "jugadores")} vuelven a verse en la web` : "Sus partidos y sus estadísticas vuelven a verse en la web", active && active.id !== s.id ? `${la(active.name).replace(/^la/, "La")} sigue siendo la temporada en curso` : ""]
        : [
            "Se borran la temporada, su nombre y su capitán en el campo",
            `Sus ${plural(nM, "partido", "partidos")} se quedan sin temporada: no se borran, pero ya no salen en ninguna`,
            onlyHere ? `Sus ${plural(onlyHere, "jugador", "jugadores")} que solo jugaban aquí vuelven a la plantilla, en «Antiguos»` : "Los jugadores siguen en la plantilla: los que solo jugaban aquí vuelven, en «Antiguos»",
            "No se puede deshacer",
          ];
  const title = sheet.k === "arch" ? `¿Archivar ${la(s.name)}?` : sheet.k === "unarch" ? `¿Desarchivar ${la(s.name)}?` : `¿Eliminar ${la(s.name)} para siempre?`;
  const label = sheet.k === "arch" ? "Archivar" : sheet.k === "unarch" ? "Desarchivar" : "Eliminar la temporada";
  return (
    <SalaSheet open onClose={onClose} title={title} center alert={sheet.k === "del"} className="cl-sheet" footer={foot(label, false, sheet.k === "del")}>
      <ul className="sc-rows cl-cons">
        {cons.filter(Boolean).map((x) => (
          <li key={x} className="sc-row">
            <span className="sc-row__t">
              <b>{x}</b>
            </span>
          </li>
        ))}
      </ul>
      {err}
    </SalaSheet>
  );
}
