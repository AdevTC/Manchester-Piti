// CLUB · El vestuario (/admin/club/vestuario; board part-club.html § el vestuario, M-17 and M-46): the captains
// moderate what the members write — polls (close now, delete), the board (delete), trainings (confirm a slot,
// delete), absences (correct the dates or the note, take it away) — and the porra: recalculate the season's and
// correct (or add, or take away) a member's porra of a played match, «Corregida por @capi». Each change waits 5 s
// behind «Deshacer»; the porra goes through the server at once.
import { useMemo, useState } from "react";
import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase";
import { useAuth } from "../../../../context/AuthContext";
import { apiError, confirmTraining, correctPrediction, deleteTraining, recomputeSeasonPorra } from "../../../../lib/clubApi";
import { dateMillis, nameFor } from "../../../../lib/clubData";
import { ABSENCE_NOTE_MAX, absenceRangeProblem, madridDate, type Absence } from "../../../../lib/derived/absences";
import type { Poll } from "../../../../lib/derived/polls";
import { plural } from "../../../../lib/derived/words";
import { useAbsences, useBoard, useClubPeople, useOpenTrainings, usePollVotes, usePolls, useTeamMembers, useTrainingVotes, type BoardMessage, type Training } from "../../../vestuario/live";
import { SalaSheet } from "../../shell/Sheet";
import { ScreenError, ScreenLoading } from "../../shell/Screen";
import { useAdmin } from "../../shell/context";
import { useStatus } from "../../shell/statusContext";
import { useMatchPorras, type PorraRow } from "./live";
import { la, relWhen } from "./model";
import { RoomScreen } from "./Room";
import { Shirt } from "./shirts";
import { shirtOf, useStills } from "./stills";

const DAY = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
const when = (ms: number) => DAY.format(ms).replace(/\./g, "");
const dm = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

type Sheet = { k: "absence"; a: Absence; from: string; to: string; note: string } | { k: "porra"; matchId: string; uid: string; name: string; gf: string; ga: string; goals: { playerId: string; assist: string }[]; isNew: boolean } | null;

export function VestuarioScreen() {
  const data = useAdmin();
  const status = useStatus();
  const { user } = useAuth();
  const polls = usePolls(true);
  const board = useBoard(30);
  const trainings = useOpenTrainings(data.now);
  const today = madridDate(data.now);
  const absences = useAbsences(today, true);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [current, setSheet] = useState<Sheet>(null);
  const sheet = current;
  const [busy, setBusy] = useState(false);
  const [sheetErr, setSheetErr] = useState("");
  const sid = data.season?.id ?? "";
  const playedMatches = useMemo(() => data.published.filter((m) => m.seasonId === sid && (m.status === "finished" || (m.status === "scheduled" && dateMillis(m.date) <= data.now))).sort((a, b) => dateMillis(b.date) - dateMillis(a.date)), [data.published, sid, data.now]);
  const [porraMatch, setPorraMatch] = useState<string>("");
  const pm = porraMatch && playedMatches.some((m) => m.id === porraMatch) ? porraMatch : (playedMatches[0]?.id ?? "");
  const porras = useMatchPorras(pm || undefined);
  const people = useClubPeople(true);
  const members = useTeamMembers(true);
  const jOf = (id: string) => data.matches.find((m) => m.id === id)?.jornada;
  const absShirts = absences.data.map((a) => shirtOf(data.players.find((p) => p.id === a.playerId), sid));
  const src = useStills(absShirts);

  /** A moderation behind «Deshacer»: the row hides at once, the write runs after 5 s. */
  const later = (key: string, message: string, tag: string, commit: () => Promise<unknown>, hide = true) => {
    if (hide) setGone((g) => new Set(g).add(key));
    const back = () =>
      setGone((g) => {
        const n = new Set(g);
        n.delete(key);
        return n;
      });
    status.defer({ tag, message, commit, onUndo: back, onError: back, errorMessage: `No se ha podido: ${message.toLowerCase()}` });
  };

  const openPolls = polls.data.filter((p) => !gone.has(`poll:${p.id}`));
  const posts = board.data.filter((p) => !gone.has(`post:${p.id}`));
  const trs = trainings.data.filter((t) => !gone.has(`tr:${t.id}`));
  const abs = absences.data.filter((a) => !gone.has(`ab:${a.id}`));

  const recalc = () => {
    if (!sid) return;
    status.defer({ tag: "Porra", message: `Recalculando la porra de ${la(data.season?.name ?? "la temporada")} con las actas publicadas`, commit: () => recomputeSeasonPorra({ seasonId: sid }), errorMessage: "No se ha podido recalcular la porra" });
  };

  const submitSheet = async (override?: Sheet) => {
    const sheet = override ?? current;
    if (!sheet || busy) return;
    if (sheet.k === "absence") {
      const problem = absenceRangeProblem(sheet.from, sheet.to);
      if (problem || sheet.note.length > ABSENCE_NOTE_MAX || !user) return;
      const a = sheet.a;
      const note = sheet.note.trim();
      setSheet(null);
      later(`edit:${a.id}`, `Ausencia de ${a.name} corregida · del ${dm(sheet.from)} al ${dm(sheet.to)}`, "Ausencia", () => updateDoc(doc(db, "absences", a.id), { from: sheet.from, to: sheet.to, note, editedBy: user.uid, editedAt: serverTimestamp() }), false);
      return;
    }
    const gf = parseInt(sheet.gf, 10);
    const ga = parseInt(sheet.ga, 10);
    if (!Number.isInteger(gf) || !Number.isInteger(ga) || gf < 0 || ga < 0 || sheet.goals.length !== gf || sheet.goals.some((g) => !g.playerId)) return;
    setBusy(true);
    setSheetErr("");
    try {
      await correctPrediction({ matchId: sheet.matchId, uid: sheet.uid, goalsFor: gf, goalsAgainst: ga, goals: sheet.goals.map((g) => ({ playerId: g.playerId, ...(g.assist ? { assistPlayerId: g.assist === "none" ? null : g.assist } : {}) })) });
      setSheet(null);
      status.show({ tag: "Porra", message: `Porra de ${sheet.name} corregida · ${gf}–${ga}` });
    } catch (e) {
      setSheetErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };
  const removePorra = async () => {
    const sheet = current;
    if (!sheet || sheet.k !== "porra" || busy) return;
    setBusy(true);
    setSheetErr("");
    try {
      await correctPrediction({ matchId: sheet.matchId, uid: sheet.uid, remove: true });
      setSheet(null);
      status.show({ tag: "Porra", message: `Porra de ${sheet.name} quitada` });
    } catch (e) {
      setSheetErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const loading = polls.loading && board.loading && trainings.loading && absences.loading;
  const failed = polls.error && board.error && trainings.error && absences.error;
  const ved = openPolls.length + posts.length + trs.length + abs.length;
  const lede = ved ? [plural(openPolls.filter((p) => !p.closedAt && p.closesAt > data.now).length, "encuesta abierta", "encuestas abiertas"), plural(posts.length, "mensaje", "mensajes"), plural(abs.length, "ausencia", "ausencias")].join(" · ") : "Nada que moderar en el vestuario";
  const inside = new Set(members.data.map((m) => m.uid));
  const withPorra = new Set(porras.data.map((p) => p.uid));
  const canAdd = people.data.filter((p) => inside.has(p.uid) && !p.removed && !withPorra.has(p.uid) && p.uid !== user?.uid);
  const pmMatch = playedMatches.find((m) => m.id === pm);

  return (
    <RoomScreen room="vestuario" lede={lede}>
      {loading ? (
        <ScreenLoading label="Cargando el vestuario" />
      ) : failed ? (
        <ScreenError what="el vestuario" onRetry={() => window.location.reload()} />
      ) : (
        <div className="cl-grid cl-ves">
          <div className="cl-col sc-scroll">
            <section className="sc-sec" aria-labelledby="cl-pl-t">
              <header className="sc-sec__h">
                <h2 className="sc-h2" id="cl-pl-t">
                  Encuestas
                </h2>
              </header>
              {!openPolls.length ? (
                <p className="sc-p cl-empty">Ninguna encuesta en el vestuario.</p>
              ) : (
                <ul className="sc-rows">
                  {openPolls.map((p) => (
                    <PollRow key={p.id} poll={p} now={data.now} onClose={() => later(`close:${p.id}`, `«${p.question}» cerrada ya`, "Encuesta", () => updateDoc(doc(db, "polls", p.id), { closedAt: serverTimestamp() }), false)} onDrop={() => later(`poll:${p.id}`, `«${p.question}» borrada`, "Encuesta", () => deleteDoc(doc(db, "polls", p.id)))} />
                  ))}
                </ul>
              )}
            </section>
            <section className="sc-sec" aria-labelledby="cl-tb-t">
              <header className="sc-sec__h">
                <h2 className="sc-h2" id="cl-tb-t">
                  El tablón
                </h2>
              </header>
              {!posts.length ? (
                <p className="sc-p cl-empty">El tablón está vacío.</p>
              ) : (
                <ul className="sc-rows">
                  {posts.map((p: BoardMessage) => (
                    <li key={p.id} className="sc-row cl-mod">
                      <span className="sc-row__t">
                        <b>«{p.text}»</b>
                        <span>
                          {p.name} · {relWhen(p.at, data.now)}
                        </span>
                      </span>
                      <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Borrar el mensaje de ${p.name}`} onClick={() => later(`post:${p.id}`, `Mensaje de ${p.name} borrado del tablón`, "Tablón", () => deleteDoc(doc(db, "board", p.id)))}>
                        Borrar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <div className="cl-col sc-scroll">
            <section className="sc-sec" aria-labelledby="cl-tr-t">
              <header className="sc-sec__h">
                <h2 className="sc-h2" id="cl-tr-t">
                  Entrenos
                </h2>
              </header>
              {!trs.length ? (
                <p className="sc-p cl-empty">Ningún entreno propuesto.</p>
              ) : (
                <ul className="sc-rows">
                  {trs.map((t) => (
                    <TrainingRow key={t.id} t={t} onOk={(slotId, label) => later(`ok:${t.id}`, `Entreno del ${label} confirmado · se avisa a los que van`, "Entreno", () => confirmTraining({ trainingId: t.id, slotId }), false)} onDrop={(label) => later(`tr:${t.id}`, `Entreno del ${label} borrado`, "Entreno", () => deleteTraining({ trainingId: t.id }))} />
                  ))}
                </ul>
              )}
            </section>
            <section className="sc-sec" aria-labelledby="cl-ab-t">
              <header className="sc-sec__h">
                <h2 className="sc-h2" id="cl-ab-t">
                  Ausencias de la temporada
                </h2>
              </header>
              {!abs.length ? (
                <p className="sc-p cl-empty">Nadie ha avisado de una ausencia.</p>
              ) : (
                <ul className="sc-rows">
                  {abs.map((a) => {
                    const i = absences.data.indexOf(a);
                    const sh = absShirts[i];
                    const who = sh?.name || a.name;
                    return (
                      <li key={a.id} className="sc-row cl-mod">
                        {sh?.name ? <Shirt shirt={sh} src={src(sh)} size="xs" /> : <span aria-hidden="true" />}
                        <span className="sc-row__t">
                          <b>{who}</b>
                          <span>
                            Del {dm(a.from)} al {dm(a.to)}
                            {a.note ? ` · ${a.note}` : ""}
                          </span>
                        </span>
                        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-haspopup="dialog" aria-label={`Corregir la ausencia de ${who}`} onClick={() => setSheet({ k: "absence", a, from: a.from, to: a.to, note: a.note ?? "" })}>
                          Corregir
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <section className="sc-sec" aria-labelledby="cl-po-t">
              <header className="sc-sec__h">
                <h2 className="sc-h2" id="cl-po-t">
                  La porra
                </h2>
              </header>
              <ul className="sc-rows">
                <li className="sc-row">
                  <span className="sc-row__t">
                    <b>La porra de la temporada</b>
                    <span>Se recalcula sola al publicar cada acta; si algo no cuadra, recalcúlala.</span>
                  </span>
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={recalc} aria-disabled={!sid || undefined}>
                    Recalcular
                  </button>
                </li>
              </ul>
              {playedMatches.length > 0 ? (
                <>
                  <label className="sc-field" style={{ marginTop: 12 }}>
                    <span>Corregir la porra de un partido</span>
                    <select className="vd-input" value={pm} onChange={(e) => setPorraMatch(e.target.value)}>
                      {playedMatches.map((m) => (
                        <option key={m.id} value={m.id}>
                          {jOf(m.id) ? `J${jOf(m.id)} · ` : ""}
                          {m.rival || "Rival"}
                          {typeof m.goalsFor === "number" ? ` · ${m.goalsFor}–${m.goalsAgainst ?? 0}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {porras.loading ? (
                    <p className="sc-small">Cargando las porras…</p>
                  ) : !porras.data.length ? (
                    <p className="sc-p cl-empty">Nadie hizo la porra de este partido.</p>
                  ) : (
                    <ul className="sc-rows" style={{ marginTop: 8 }}>
                      {porras.data.map((p: PorraRow) => (
                        <li key={p.uid} className="sc-row cl-mod">
                          <span className="sc-row__t">
                            <b>
                              {p.name} · {p.goalsFor}–{p.goalsAgainst}
                            </b>
                            <span>{p.goals.length ? `Goles: ${p.goals.map((g) => nameFor(data.players.find((x) => x.id === g.playerId), sid) || "—").join(", ")}` : "Sin goleadores"}</span>
                          </span>
                          {p.correctedByName ? <span className="sc-tag sc-tag--quiet">Corregida por @{p.correctedByName}</span> : <span aria-hidden="true" />}
                          <button
                            type="button"
                            className="vd-btn vd-glass vd-press vd-btn--sm"
                            aria-haspopup="dialog"
                            aria-label={`Corregir la porra de ${p.name}`}
                            aria-disabled={p.uid === user?.uid || undefined}
                            title={p.uid === user?.uid ? "La tuya te la corrige otro capitán" : undefined}
                            onClick={() => p.uid !== user?.uid && pmMatch && setSheet({ k: "porra", matchId: pm, uid: p.uid, name: p.name, gf: String(p.goalsFor), ga: String(p.goalsAgainst), goals: p.goals.map((g) => ({ playerId: g.playerId, assist: g.assistPlayerId === null ? "none" : (g.assistPlayerId ?? "") })), isNew: false })}
                          >
                            Corregir
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {canAdd.length > 0 && pmMatch && <AddPorra people={canAdd} onPick={(uid, name) => setSheet({ k: "porra", matchId: pm, uid, name, gf: "0", ga: "0", goals: [], isNew: true })} />}
                </>
              ) : (
                <p className="sc-small">Las porras se pueden corregir en cuanto haya un partido jugado.</p>
              )}
            </section>
          </div>
        </div>
      )}
      <VestuarioSheet sheet={sheet} setSheet={setSheet} busy={busy} error={sheetErr} onClose={() => !busy && (setSheet(null), setSheetErr(""))} onSubmit={(s) => void submitSheet(s)} onRemove={() => void removePorra()} onDropAbsence={(a) => { setSheet(null); later(`ab:${a.id}`, `Ausencia de ${a.name} quitada`, "Ausencia", () => deleteDoc(doc(db, "absences", a.id))); }} sid={sid} />
    </RoomScreen>
  );
}

function PollRow({ poll, now, onClose, onDrop }: { poll: Poll; now: number; onClose: () => void; onDrop: () => void }) {
  const votes = usePollVotes(poll.id);
  const closed = !!poll.closedAt || poll.closesAt <= now;
  const count = (id: string) => votes.data.filter((v) => v.optionIds.includes(id)).length;
  return (
    <li className="sc-row cl-mod">
      <span className="sc-row__t">
        <b>{poll.question}</b>
        <span>{poll.options.map((o) => `${o.label} ${count(o.id)}`).join(" · ")}</span>
        <span>
          De {poll.authorName} · {plural(votes.data.length, "voto", "votos")} · {closed ? "cerrada" : `cierra ${relWhen(poll.closesAt, now).replace("hace", "en")}`}
        </span>
      </span>
      <span className={`sc-tag ${closed ? "sc-tag--quiet" : "sc-tag--toca"}`}>{closed ? "Cerrada" : "Abierta"}</span>
      <span className="cl-acts">
        {!closed && (
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Cerrar ya: ${poll.question}`} onClick={onClose}>
            Cerrar ya
          </button>
        )}
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Borrar la encuesta: ${poll.question}`} onClick={onDrop}>
          Borrar
        </button>
      </span>
    </li>
  );
}

function TrainingRow({ t, onOk, onDrop }: { t: Training; onOk: (slotId: string, label: string) => void; onDrop: (label: string) => void }) {
  const votes = useTrainingVotes(t.id);
  const count = (id: string) => votes.data.filter((v) => v.slotIds.includes(id)).length;
  const best = [...t.slots].sort((a, b) => count(b.id) - count(a.id) || a.at - b.at)[0];
  const [pick, setPick] = useState("");
  const slot = t.slots.find((s) => s.id === (pick || best?.id)) ?? best;
  const conf = t.confirmed ? t.slots.find((s) => s.id === t.confirmed?.slotId) : undefined;
  const label = conf ? when(conf.at) : slot ? when(slot.at) : "entreno";
  return (
    <li className="sc-row cl-mod">
      <span className="sc-row__t">
        <b>
          {conf ? `${when(conf.at)} · ${t.confirmed?.place || conf.place}` : slot ? `${when(slot.at)}${slot.place ? ` · ${slot.place}` : ""}` : "Sin franjas"}
        </b>
        <span>
          {conf ? `Confirmado por ${t.confirmed?.byName || "la capitanía"}` : `De ${t.proposedByName} · ${plural(t.slots.length, "franja", "franjas")} · ${slot ? plural(count(slot.id), "va", "van") : "sin votos"}`}
        </span>
      </span>
      <span className="sc-tag sc-tag--quiet">{conf ? "Confirmado" : "Propuesto"}</span>
      <span className="cl-acts">
        {!conf && t.slots.length > 1 && (
          <label className="sc-field">
            <span className="vd-vh">Franja del entreno</span>
            <select className="vd-input" value={slot?.id ?? ""} onChange={(e) => setPick(e.target.value)}>
              {t.slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {when(s.at)} · {plural(count(s.id), "va", "van")}
                </option>
              ))}
            </select>
          </label>
        )}
        {!conf && slot && (
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Confirmar el entreno del ${when(slot.at)}`} onClick={() => onOk(slot.id, when(slot.at))}>
            Confirmar
          </button>
        )}
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Borrar el entreno del ${label}`} onClick={() => onDrop(label)}>
          Borrar
        </button>
      </span>
    </li>
  );
}

function AddPorra({ people, onPick }: { people: { uid: string; nickname: string; displayName: string }[]; onPick: (uid: string, name: string) => void }) {
  const [uid, setUid] = useState("");
  const cur = people.find((p) => p.uid === uid) ?? people[0];
  return (
    <div className="cl-add">
      <label className="sc-field">
        <span>Apuntar la porra de un socio que no la guardó</span>
        <select className="vd-input" value={cur?.uid ?? ""} onChange={(e) => setUid(e.target.value)}>
          {people.map((p) => (
            <option key={p.uid} value={p.uid}>
              @{p.nickname || p.displayName || "socio"}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-haspopup="dialog" onClick={() => cur && onPick(cur.uid, cur.nickname || cur.displayName || "socio")}>
        Apuntarla
      </button>
    </div>
  );
}

function VestuarioSheet({ sheet, setSheet, busy, error, onClose, onSubmit, onRemove, onDropAbsence, sid }: { sheet: Sheet; setSheet: (s: Sheet) => void; busy: boolean; error: string; onClose: () => void; onSubmit: (s?: Sheet) => void; onRemove: () => void; onDropAbsence: (a: Absence) => void; sid: string }) {
  const data = useAdmin();
  if (!sheet) return null;
  if (sheet.k === "absence") {
    const problem = absenceRangeProblem(sheet.from, sheet.to);
    const off = !!problem || sheet.note.length > ABSENCE_NOTE_MAX;
    return (
      <SalaSheet
        open
        onClose={onClose}
        title={`Ausencia de ${sheet.a.name}`}
        className="cl-sheet"
        footer={
          <>
            <button type="button" className="vd-btn vd-glass vd-press" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" aria-disabled={off || undefined} onClick={() => !off && onSubmit(sheet)}>
              Guardar la ausencia
            </button>
          </>
        }
      >
        <p className="sc-p cl-sh-lede">La avisó él desde el vestuario. Corregirla cambia su convocatoria y sus turnos de esas fechas.</p>
        <div className="sc-form">
          <label className="sc-field">
            <span>Desde</span>
            <input className="vd-input" type="date" value={sheet.from} onChange={(e) => setSheet({ ...sheet, from: e.target.value })} />
          </label>
          <label className="sc-field">
            <span>Hasta</span>
            <input className="vd-input" type="date" value={sheet.to} onChange={(e) => setSheet({ ...sheet, to: e.target.value })} />
          </label>
          <label className="sc-field sc-field--wide">
            <span>Nota</span>
            <input className="vd-input" type="text" maxLength={ABSENCE_NOTE_MAX} value={sheet.note} onChange={(e) => setSheet({ ...sheet, note: e.target.value })} />
            <small>
              {sheet.note.length}/{ABSENCE_NOTE_MAX}
            </small>
          </label>
        </div>
        {problem && (
          <p className="cl-alert" role="alert">
            {problem}
          </p>
        )}
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm cl-danger" onClick={() => onDropAbsence(sheet.a)}>
          Quitar la ausencia
        </button>
      </SalaSheet>
    );
  }
  const roster = data.players.filter((p) => (p.seasons ?? []).includes(sid) && !p.archived);
  const gf = parseInt(sheet.gf, 10);
  const gfOk = Number.isInteger(gf) && gf >= 0 && gf <= 30;
  const goals = gfOk ? Array.from({ length: gf }, (_, i) => sheet.goals[i] ?? { playerId: "", assist: "" }) : sheet.goals;
  const off = !gfOk || !/^\d{1,2}$/.test(sheet.ga) || goals.some((g) => !g.playerId);
  const setGoal = (i: number, patch: Partial<{ playerId: string; assist: string }>) => setSheet({ ...sheet, goals: goals.map((g, k) => (k === i ? { ...g, ...patch } : g)) });
  const opt = (p: (typeof roster)[number]) => {
    const sh = shirtOf(p, sid);
    return (
      <option key={p.id} value={p.id}>
        {sh.num ? `${sh.num} · ` : ""}
        {sh.name}
      </option>
    );
  };
  return (
    <SalaSheet
      open
      onClose={onClose}
      title={sheet.isNew ? `Apuntar la porra de ${sheet.name}` : `Corregir la porra de ${sheet.name}`}
      className="cl-sheet"
      footer={
        <>
          {!sheet.isNew && (
            <button type="button" className="vd-btn vd-glass vd-press cl-danger" aria-disabled={busy || undefined} onClick={onRemove}>
              Quitar su porra
            </button>
          )}
          <button type="button" className="vd-btn vd-glass vd-press" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri" aria-disabled={off || busy || undefined} onClick={() => !off && !busy && onSubmit({ ...sheet, goals })}>
            {busy ? "Guardando…" : "Guardar la porra"}
          </button>
        </>
      }
    >
      <p className="sc-p cl-sh-lede">Sale a su nombre, con «Corregida por» ti. Si el partido ya terminó, la porra de la temporada se recalcula sola.</p>
      <div className="sc-form">
        <label className="sc-field">
          <span>Goles del Piti</span>
          <input className="vd-input" type="text" inputMode="numeric" maxLength={2} value={sheet.gf} onChange={(e) => setSheet({ ...sheet, gf: e.target.value.replace(/\D/g, "").slice(0, 2), goals })} />
        </label>
        <label className="sc-field">
          <span>Goles del rival</span>
          <input className="vd-input" type="text" inputMode="numeric" maxLength={2} value={sheet.ga} onChange={(e) => setSheet({ ...sheet, ga: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
        </label>
      </div>
      {goals.length > 0 && (
        <div className="cl-goals">
          {goals.map((g, i) => (
            <div key={i} className="sc-form">
              <label className="sc-field">
                <span>Gol {i + 1} · goleador</span>
                <select className="vd-input" value={g.playerId} onChange={(e) => setGoal(i, { playerId: e.target.value })} aria-invalid={!g.playerId || undefined}>
                  <option value="">— Elige —</option>
                  {roster.map(opt)}
                </select>
              </label>
              <label className="sc-field">
                <span>Pase (opcional)</span>
                <select className="vd-input" value={g.assist} onChange={(e) => setGoal(i, { assist: e.target.value })}>
                  <option value="">Sin apostar</option>
                  <option value="none">Sin pase</option>
                  {roster.filter((p) => p.id !== g.playerId).map(opt)}
                </select>
              </label>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="cl-alert" role="alert">
          {error}
        </p>
      )}
    </SalaSheet>
  );
}
