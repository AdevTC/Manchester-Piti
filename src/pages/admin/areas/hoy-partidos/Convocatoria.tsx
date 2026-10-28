// HOY Y PARTIDOS · the match's Convocatoria (/admin/partidos/<id>/convocatoria), as the board (partidos.js convVals /
// part-partidos.html § 5): one source — here, the pizarra and la mesa read the same. «Quién viene» with the printed
// shirts by answer (the absent with their date), el siete on the pitch at the pizarra's places (or in a row), the
// banquillo, the guests (up to four), «La pizarra coincide» / «tiene otro siete» with «Copiar el de la pizarra» and its
// plan of changes, «Copiar la convocatoria de la J2», the turns of this jornada, the automatic reminders and «Recordar
// ahora a los que faltan» (M-07), the meeting note; the primary «Mandar la convocatoria» waits 5 s behind «Deshacer» and
// goes with what there is then (M-06, B-HOY-01); a draft cannot tell anybody yet (B-HOY-03).
import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { boardSlotCodes } from "../../../../../functions/src/boardCodes";
import { POSITIONS, isPosCode } from "../../../../../functions/src/positions";
import { apiError, remindNow } from "../../../../lib/clubApi";
import type { ClubMatch } from "../../../../lib/clubData";
import { guestRef, isGuestId, withGuestNames } from "../../../../lib/derived/guests";
import { madridDate } from "../../../../lib/derived/madrid";
import { rotaMatch, rotaPlayed, type Turn } from "../../../../lib/derived/rota";
import { useMatchTurns } from "../../../../lib/useRotaTurns";
import { addGuest, guestInUse, removeGuest } from "../../acta/guests";
import { rosterFor } from "../../acta/roster";
import { copyFrom } from "../../convocar/convocarModel";
import { useMatchAnswers, useTeamAbsences } from "../../convocar/live";
import { useReminders } from "../../convocar/reminders";
import { place, SEVEN, type Lineup } from "../../data/lineup";
import { useConvocatoria } from "../../data/useConvocatoria";
import { useTurnosWrites } from "../../data/useTurnos";
import { useMatchShortcuts } from "../../palette/matchShortcuts";
import { usePartido } from "../../partido/partidoContext";
import { useStationPrimary } from "../../partido/primary";
import { useAdmin } from "../../shell/context";
import type { PrimarySpec } from "../../shell/Screen";
import { SalaLink } from "../../shell/SalaLink";
import { useStatus } from "../../shell/statusContext";
import { useLiveDoc } from "../../../vestuario/live";
import { boardBench, convocatoriaWithSeven, sevenAgreement } from "../../../pizarra/officialBoard";
import { bajaOf } from "../../../pizarra/chemistry";
import { seasonSuspensions } from "../../club/sanctionLogic";
import { VIcon } from "../../../../components/vidrio/VIcon";
import { list, plural, rel } from "./fmt";
import { isDraftOnly, isLive, isPlayed } from "./matchWords";
import { answersOf } from "./rsvp";
import { useSheetSession } from "../acta/sheetSession";
import { Shirt, type Kit } from "./Shirt";
import { useShirts } from "./useShirts";
import type { DocumentData } from "firebase/firestore";
import "./partidos.css";

type From = "quien" | "siete" | "banco";
interface Pick {
  id: string;
  from: From;
}
interface PitchSlot {
  code: string;
  x: number;
  y: number;
  playerId: string | null;
}
interface Pitch {
  system: string;
  slots: PitchSlot[];
  subs: { min: number; out: string; in: string }[];
}

/** The official board's places (its seven slots with their codes and where they stand) and its plan of changes. */
function pitchOfDoc(d: DocumentData | undefined): Pitch | null {
  if (!d || !Array.isArray(d.slots)) return null;
  const board = { formation: d.formation, freeMode: d.freeMode, slots: d.slots as { playerId?: string | null; x?: number; y?: number }[] };
  const codes = boardSlotCodes(board);
  const slots = codes.map((code, i) => {
    const s = board.slots[i];
    const free = d.freeMode === true && s && typeof s.x === "number" && typeof s.y === "number";
    const p = isPosCode(code) ? POSITIONS[code] : null;
    return { code, x: free ? (s.x as number) : (p?.x ?? 50), y: free ? (s.y as number) : (p?.y ?? 50), playerId: typeof s?.playerId === "string" && s.playerId ? s.playerId : null };
  });
  const subs = Array.isArray(d.subs)
    ? (d.subs as { minute?: unknown; min?: unknown; out?: unknown; outId?: unknown; in?: unknown; inId?: unknown }[])
        .map((s) => ({ min: Number(s.minute ?? s.min), out: String(s.out ?? s.outId ?? ""), in: String(s.in ?? s.inId ?? "") }))
        .filter((s) => Number.isFinite(s.min) && s.out && s.in)
    : [];
  return { system: d.freeMode === true ? "Libre" : String(d.formation ?? ""), slots, subs };
}

export function ConvocatoriaScreen() {
  const { match } = usePartido();
  return <Convocatoria key={match.id} />;
}

function Convocatoria() {
  const data = useAdmin();
  const status = useStatus();
  const { match: m, phase, j } = usePartido();
  const conv = useConvocatoria(m);
  const answersQ = useMatchAnswers(m.id);
  const absences = useTeamAbsences(madridDate(data.now));
  const rem = useReminders(m.id);
  const boardId = useMatchShortcuts(m);
  const pitch = useLiveDoc(boardId ? `lineups/${boardId}` : null, "convocatoria-pitch", pitchOfDoc, null).data;
  const [pick, setPick] = useState<Pick | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [gName, setGName] = useState("");
  const [gErr, setGErr] = useState("");
  const [reminding, setReminding] = useState(false);
  const roster = useMemo(() => (m.seasonId && m.seasonId === data.season?.id ? data.roster : rosterFor(data.players, data.seasons, m.seasonId)), [m.seasonId, data.season?.id, data.roster, data.players, data.seasons]);
  const answers = useMemo(() => answersOf({ match: m, roster, answers: answersQ.data, absences }), [m, roster, answersQ.data, absences]);
  const kit: Kit = m.kit === "away" ? "away" : m.kit === "home" ? "home" : m.home === false ? "away" : "home";
  const people = useMemo(() => roster.map((p) => ({ name: p.name, number: p.number })), [roster]);
  const still = useShirts(people, kit);
  const byId = new Map(roster.map((p) => [p.id, p]));
  const lineup = conv.lineup;
  const guests = lineup.guests ?? m.guests ?? [];
  const nameOf = withGuestNames({ ...m, guests }, (id: string) => byId.get(id)?.name ?? "Jugador");
  const draft = isDraftOnly(m);
  const editable = phase === "antes" || phase === "aplazado" || (phase === "final" && lineup.starters.length < SEVEN);
  const closedWhy = phase === "cancelado" ? "Partido cancelado: no hay convocatoria que cambiar." : isLive(phase) ? "En juego: el siete está en la mesa; los cambios se apuntan allí." : isPlayed(phase) || phase === "pendiente" ? "Partido jugado: la convocatoria queda cerrada; los cambios del acta ajustan los minutos." : "";
  const placeOf = (id: string): "siete" | "banquillo" | "" => (lineup.starters.includes(id) ? "siete" : lineup.bench.includes(id) ? "banquillo" : "");
  const placeWord = (id: string) => (placeOf(id) === "siete" ? "en el siete" : placeOf(id) === "banquillo" ? "en el banquillo" : "sin colocar");
  const answerOf = (id: string) => answers.word.get(id) ?? (isGuestId(id) ? "invitado" : "sin responder");
  const say = (tag: string, message: string, undo?: () => void) => status.show({ tag, message: `${message}${conv.status.notified && !conv.pending ? " · falta avisar del cambio" : ""}`, undo });
  const change = (next: Lineup, tag: string, message: string) => {
    const before = lineup;
    conv.set(next);
    say(tag, message, () => conv.set(before));
  };
  const closed = () => status.show({ tag: "Cerrada", message: closedWhy || "No se puede cambiar ahora." });
  const open = (id: string, from: From) => () => {
    if (!editable) return closed();
    setSlot(null);
    setPick((p) => (p && p.id === id && p.from === from ? null : { id, from }));
  };
  const toSeven = (id: string) => {
    if (placeOf(id) === "siete") return;
    const r = place(lineup, id, "T");
    if (!r.ok) return status.show({ tag: "7/7", message: "Ya hay siete: baja uno al banquillo antes" });
    change(r.lineup, "Al siete", `${nameOf(id)} al siete · la pizarra y la mesa ya lo ven`);
    setPick(null);
  };
  const toBench = (id: string) => {
    if (placeOf(id) === "banquillo") return;
    const r = place(lineup, id, "B");
    if (r.ok) change(r.lineup, "Al banquillo", `${nameOf(id)} al banquillo`);
    setPick(null);
  };
  const quit = (id: string) => {
    if (!placeOf(id)) return;
    change({ ...lineup, starters: lineup.starters.filter((x) => x !== id), bench: lineup.bench.filter((x) => x !== id) }, "Fuera", `${nameOf(id)} fuera de la convocatoria`);
    setPick(null);
  };

  // el siete at the pizarra's places (their player first, the rest where there is room), or in a row
  const pos = pitch && pitch.slots.length === SEVEN ? pitch.slots : null;
  const occ: (string | null)[] = Array.from({ length: SEVEN }, () => null);
  if (pos) pos.forEach((s, i) => s.playerId && lineup.starters.includes(s.playerId) && (occ[i] = s.playerId));
  for (const id of lineup.starters) if (!occ.includes(id)) {
    const k = occ.indexOf(null);
    if (k >= 0) occ[k] = id;
  }
  const chooser = slot !== null ? [...answers.groups[0].people.map((x) => ({ id: x.id, w: "viene" })), ...answers.groups[1].people.map((x) => ({ id: x.id, w: "en duda" })), ...guests.map((g) => ({ id: guestRef(g.id), w: "invitado" }))].filter((x) => !lineup.starters.includes(x.id)) : [];
  const chooseFor = (i: number, id: string) => {
    const cur = occ[i];
    const bench = lineup.bench.filter((x) => x !== id);
    const starters = cur ? lineup.starters.map((s) => (s === cur ? id : s)) : [...lineup.starters.filter((s) => s !== id), id];
    change({ ...lineup, starters, bench: cur ? [...bench, cur] : bench }, "Al siete", `${nameOf(id)} al siete${pos ? ` de ${pos[i].code}` : ""} · la pizarra y la mesa ya lo ven`);
    setSlot(null);
  };

  // la pizarra: does its seven agree, and the convocatoria with its seven
  const boardSeven = pitch ? pitch.slots.map((s) => s.playerId).filter((x): x is string => !!x) : null;
  const agree = sevenAgreement(boardSeven, lineup.starters);
  const suspended = useMemo(() => seasonSuspensions(data.matches, m.seasonId, data.players), [data.matches, m.seasonId, data.players]);
  const fromBoard = boardSeven && agree === "otro" ? convocatoriaWithSeven({ ...lineup, notCalled: m.notCalled ?? [] }, boardSeven, boardBench(roster.map((p) => ({ id: p.id, baja: bajaOf({ id: p.id, active: p.doc.active, injured: p.injured }, suspended) })), boardSeven)) : null;
  const plus = boardSeven ? boardSeven.filter((x) => !lineup.starters.includes(x)).map(nameOf) : [];
  const minus = boardSeven ? lineup.starters.filter((x) => !boardSeven.includes(x)).map(nameOf) : [];
  const boardDiff = [plus.length ? `La pizarra pone a ${list(plus)}` : "", minus.length ? `aquí están ${list(minus)} y allí no` : ""].filter(Boolean).join("; ");
  const copy = editable ? copyFrom(data.matches, m, lineup, roster.map((p) => p.id)) : null;

  // the primary action (CNV-26/27, M-06, B-HOY-01/03)
  const called = lineup.starters.length + lineup.bench.length;
  const missing = [...lineup.starters, ...lineup.bench].filter((id) => !isGuestId(id) && answerOf(id) === "sin responder").length;
  const sent = (n: number) => (r: { notice: string | null; covered?: boolean }) =>
    r.covered ? "Convocatoria al día · el equipo ya tiene «Ya está el siete» con este siete: sin segundo aviso" : r.notice ? `${n} avisados · con el siete que había al salir el aviso` : "Convocatoria al día · el aviso ya había salido";
  const st = conv.status;
  let label = "Mandar la convocatoria";
  let why = "";
  let off = false;
  if (draft) {
    off = true;
    why = "Es un borrador: publícalo en el calendario (Datos) antes de avisar a nadie.";
  } else if (conv.pending) {
    label = "Deshacer el aviso";
    why = "El aviso sale en 5 s con el siete que haya entonces · si cambias algo, sale con lo nuevo.";
  } else if (st.notified && st.changed) {
    label = "Avisar de los cambios";
    why = `Ha cambiado desde que la mandaste: avisa a los ${called} convocados.`;
  } else if (st.notified) {
    label = `Mandada · ${called} avisados`;
    off = true;
    why = `Mandada ${m.convocatoriaNotifiedAt ? rel(m.convocatoriaNotifiedAt, data.now) : "hace un momento"} · los convocados tienen el aviso; un cambio te deja avisar otra vez.`;
  } else if (called < SEVEN) {
    off = true;
    why = `Faltan ${plural(SEVEN - called, "convocado", "convocados")} para jugar${answers.counts.maybe ? ` (${answers.counts.maybe} en duda)` : ""}: como mínimo siete.`;
  } else why = `Lista: avisa por push a los ${called} convocados${lineup.starters.length < SEVEN ? " · el resto del siete se decide en la mesa" : ""}.`;
  const showPrimary = phase === "antes" || phase === "aplazado" || conv.pending;
  const send = () => {
    if (conv.pending) return conv.cancel();
    if (off) return status.show({ tone: draft ? "error" : "ok", tag: "Todavía no", message: why });
    conv.publish({ tag: j, sent: (r, n) => sent(n)(r) });
  };
  // (the spec changes with what it says; its button always runs this render's send)
  const sendRef = useRef(send);
  useLayoutEffect(() => {
    sendRef.current = send;
  });
  const primary = useMemo<PrimarySpec | null>(() => (showPrimary ? { label, onClick: () => sendRef.current(), disabled: off && !conv.pending, why } : null), [showPrimary, label, off, why, conv.pending]);
  useStationPrimary(primary);
  const stateLine = conv.pending ? "El aviso sale en 5 s · Deshacer" : st.notified ? (st.changed ? "Ha cambiado · Avisar de los cambios" : `Mandada ${m.convocatoriaNotifiedAt ? rel(m.convocatoriaNotifiedAt, data.now) : ""} · ${called} avisados`) : draft ? "Borrador · sin mandar" : `Sin mandar · ${called} convocados`;

  const addGuestNow = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const name = gName.trim();
    if (!name) return setGErr("Escribe su nombre");
    const r = addGuest({ ...lineup, guests, events: m.events }, name);
    if (!r.ok) return setGErr(r.error);
    conv.set({ starters: r.value.starters, bench: r.value.bench, guests: r.value.guests });
    say("Invitado", `${r.guest.name} (invitado), al banquillo · el acta y la mesa ya lo ven`);
    setGName("");
    setGErr("");
  };
  const quitGuest = (id: string) => {
    const r = removeGuest({ ...lineup, guests, events: m.events }, id);
    if (!r.ok) return status.show({ tone: "error", message: r.error });
    const before = lineup;
    conv.set({ starters: r.value.starters, bench: r.value.bench, guests: r.value.guests });
    say("Invitado", "Invitado quitado de la convocatoria", () => conv.set(before));
  };
  const remind = async () => {
    if (reminding) return;
    setReminding(true);
    try {
      const r = await remindNow({ matchId: m.id });
      status.show({ tag: "Recordatorio", message: r.data.sent ? `Recordado ahora a ${plural(r.data.sent, "convocado", "convocados")} · ${r.data.missing} sin responder` : `Nadie con la app enlazada entre los ${r.data.missing} que faltan` });
    } catch (e) {
      status.show({ tone: "error", message: `No se ha podido recordar: ${apiError(e)}`, retry: () => void remind() });
    } finally {
      setReminding(false);
    }
  };

  const peg = (id: string, from: From, note = "") => {
    const p = byId.get(id);
    const guest = isGuestId(id);
    const who = { name: p?.name ?? nameOf(id), number: p?.number ?? null };
    const pl = placeOf(id);
    const x = pick?.id === id && pick.from === from;
    return (
      <button key={`${from}-${id}`} type="button" className={`pa-peg is-${pl || "free"}`} aria-label={`${guest ? `${nameOf(id)}` : who.name}, ${answerOf(id)}, ${placeWord(id)}${editable ? ": elegir dónde" : ""}`} aria-expanded={x} onClick={open(id, from)}>
        <Shirt src={guest ? undefined : still(who)} who={who} kit={kit} size="s" />
        {pl && (
          <i className="pa-peg__tag" aria-hidden="true">
            {pl === "siete" ? "7" : "B"}
          </i>
        )}
        <small className="pa-peg__note" aria-hidden="true">
          {from === "banco" ? cap(answerOf(id)) : note || who.name}
        </small>
      </button>
    );
  };
  const menu = (from: From) => {
    if (!pick || pick.from !== from) return null;
    const id = pick.id;
    const pl = placeOf(id);
    const full = lineup.starters.length >= SEVEN && pl !== "siete";
    return (
      <div className="pa-menu vd-glass" role="group" aria-label={`Dónde va ${nameOf(id)}`}>
        <p className="pa-menu__t">
          <b>{nameOf(id)}</b>
          <span>
            {cap(answerOf(id))} · {placeWord(id)}
          </span>
        </p>
        <div className="pa-menu__a">
          {from !== "siete" && (
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-disabled={pl === "siete" || full || undefined} onClick={() => (full ? status.show({ tag: "7/7", message: "Ya hay siete: baja uno al banquillo antes" }) : toSeven(id))}>
              {pl === "siete" ? "Ya en el siete" : full ? "Al siete · ya hay 7" : "Al siete"}
            </button>
          )}
          {from !== "banco" && (
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-disabled={pl === "banquillo" || undefined} onClick={() => toBench(id)}>
              Al banquillo
            </button>
          )}
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-disabled={!pl || undefined} onClick={() => quit(id)}>
            Quitar
          </button>
          <button type="button" className="vd-ibtn vd-glass vd-press" aria-label="Cerrar" onClick={() => setPick(null)}>
            <VIcon name="close" size={18} />
          </button>
        </div>
      </div>
    );
  };

  const benchIds = lineup.bench;
  // (la mesa's roll call: matches/{id}.present, written by the server)
  const present = ((m as { present?: unknown }).present as string[] | undefined) ?? [];
  return (
    <div className="pa-conv">
      <p className={`pa-why${editable ? "" : " is-closed"}`} id="pa-why" role="status">
        <b>{stateLine}</b>
        <span>{why}</span>
        {conv.pending && (
          <button type="button" className="vd-link pa-why__undo" onClick={conv.cancel}>
            Deshacer
          </button>
        )}
      </p>
      {!editable && <p className="pa-closed">{closedWhy}</p>}

      <section className="pa-col pa-quien" aria-labelledby="pa-quien-t">
        <header className="sc-sec__h">
          <h2 className="sc-h2" id="pa-quien-t">
            Quién viene
          </h2>
          <span className="sc-sec__n">
            {answers.counts.yes} vienen · {answers.counts.maybe} en duda · {answers.counts.no + answers.counts.absent} no · {answers.counts.none} sin responder
          </span>
        </header>
        <ul className="pa-ans">
          {answers.groups.map((g) => (
            <li key={g.id} className={`pa-ans__g is-${g.id}`}>
              <p className="pa-ans__t">
                <b>{g.name}</b>
                <span className="sc-num">{g.people.length}</span>
              </p>
              <div className="pa-ans__shirts">
                {g.people.map((x) => peg(x.id, "quien", x.absent ? `Ausente hasta ${x.until}` : ""))}
                {!g.people.length && <span className="sc-small">Nadie</span>}
              </div>
              {pick?.from === "quien" && g.people.some((x) => x.id === pick.id) && menu("quien")}
            </li>
          ))}
        </ul>
      </section>

      <section className="pa-col pa-sietecol" aria-labelledby="pa-siete-t">
        <header className="sc-sec__h">
          <h2 className="sc-h2" id="pa-siete-t">
            El siete
          </h2>
          <span className="sc-sec__n">{lineup.starters.length >= SEVEN ? "Siete de siete" : lineup.starters.length ? `${lineup.starters.length} de 7 · toca un hueco libre para elegir` : "Por decidir · toca un hueco y elige de los que vienen"}</span>
        </header>
        <SevenView pos={pos} occ={occ} system={pitch?.system ?? ""} kit={kit} still={still} byId={byId} nameOf={nameOf} answerOf={answerOf} pick={pick} slot={slot} editable={editable}
          onPeg={(id) => open(id, "siete")()}
          onFree={(i) => (editable ? (setPick(null), setSlot(slot === i ? null : i)) : closed())}
        />
        {menu("siete")}
        {slot !== null && (
          <div className="pa-menu pa-choose vd-glass" role="group" aria-labelledby="pa-choose-t">
            <p className="pa-menu__t">
              <b id="pa-choose-t">
                Hueco {slot + 1}
                {pos ? ` · ${pos[slot].code}` : ""}: ¿quién?
              </b>
              <span>De los que vienen (y los que dudan)</span>
            </p>
            <div className="pa-choose__list">
              {chooser.map((x) => {
                const p = byId.get(x.id);
                const who = { name: p?.name ?? nameOf(x.id), number: p?.number ?? null };
                return (
                  <button key={x.id} type="button" className="pa-peg pa-peg--pick" aria-label={`Poner a ${nameOf(x.id)} (${x.w}) en el hueco ${slot + 1}${pos ? ` de ${pos[slot].code}` : ""}`} onClick={() => chooseFor(slot, x.id)}>
                    <Shirt src={p ? still(who) : undefined} who={who} kit={kit} size="s" />
                    <small aria-hidden="true">
                      {cap(x.w)}
                      {lineup.bench.includes(x.id) ? " · banquillo" : ""}
                    </small>
                  </button>
                );
              })}
            </div>
            {!chooser.length && <p className="sc-small">Nadie más ha dicho que viene. Los que no responden, desde «Quién viene».</p>}
            <div className="pa-menu__a">
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => setSlot(null)}>
                Cerrar
              </button>
            </div>
          </div>
        )}
        <div className="pa-board">
          <p className="pa-board__t">
            <span className="sc-tag sc-tag--quiet">{boardSeven ? (agree === "coincide" ? "La pizarra coincide · el siete de la pizarra es este" : "La pizarra tiene otro siete") : "La pizarra no tiene siete para esta jornada todavía"}</span>
          </p>
          {agree === "otro" && boardDiff && <p className="sc-small">{boardDiff}.</p>}
          {agree === "otro" && fromBoard && editable && (
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => change({ ...lineup, starters: fromBoard.starters, bench: fromBoard.bench }, "Pizarra", `Copiado el siete de la pizarra${pitch?.system ? ` · ${pitch.system}` : ""} · se guarda sin avisar`)}>
              Copiar el de la pizarra
            </button>
          )}
          <a className="vd-link pa-board__open" href={`/pizarra?${boardId ? `tablero=${encodeURIComponent(boardId)}&` : ""}season=${encodeURIComponent(m.seasonId ?? "")}`} target="_blank" rel="noopener">
            Abrir la pizarra ↗<span className="vd-vh"> (se abre en otra pestaña)</span>
          </a>
          {pitch && pitch.subs.length > 0 && (
            <div className="pa-subs">
              <p className="sc-small">
                <b>El plan de cambios de la pizarra</b> · la mesa los ofrece a su minuto
              </p>
              <ol className="sc-rows">
                {pitch.subs.map((s) => (
                  <li key={`${s.min}-${s.in}`} className="sc-row pa-subs__r">
                    <span className="sc-clock">{s.min}′</span>
                    <span className="sc-row__t">
                      <b>
                        Entra {nameOf(s.in)}, sale {nameOf(s.out)}
                      </b>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {present.length > 0 && (
            <p className="sc-small">
              Pasaron lista en la mesa: {present.length} ({list(present.slice(0, 4).map(nameOf))}
              {present.length > 4 ? ` y ${present.length - 4} más` : ""})
            </p>
          )}
        </div>

        <section className="pa-sub" aria-labelledby="pa-banco-t">
          <header className="sc-sec__h">
            <h3 className="sc-h3" id="pa-banco-t">
              Banquillo
            </h3>
            <span className="sc-sec__n">{benchIds.length}</span>
          </header>
          <div className="pa-bench">{benchIds.map((id) => peg(id, "banco"))}</div>
          {!benchIds.length && <p className="sc-small">Nadie en el banquillo todavía.</p>}
          {menu("banco")}
        </section>

        <section className="pa-sub" aria-labelledby="pa-inv-t">
          <header className="sc-sec__h">
            <h3 className="sc-h3" id="pa-inv-t">
              Invitados
            </h3>
            <span className="sc-sec__n">{guests.length} de 4</span>
          </header>
          {guests.length > 0 && (
            <ul className="sc-rows pa-guests">
              {guests.map((g) => {
                const ref = guestRef(g.id);
                const used = guestInUse(m.events, g.id);
                const where = placeOf(ref) === "siete" ? "En el siete" : placeOf(ref) === "banquillo" ? "En el banquillo" : "Sin colocar";
                return (
                  <li key={g.id} className="sc-row">
                    <span className="sc-row__t">
                      <b>{g.name} · invitado</b>
                      <span>
                        {where}
                        {used ? ` · No se puede quitar a ${g.name}: sale en el acta` : ""}
                      </span>
                    </span>
                    <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-disabled={used || !editable || undefined} aria-label={`Quitar a ${g.name} (invitado)`} onClick={() => (used ? status.show({ tone: "error", message: `No se puede quitar a ${g.name}: sale en el acta` }) : editable ? quitGuest(g.id) : closed())}>
                      Quitar
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {guests.length < 4 && editable && (
            <form className="pa-addg" onSubmit={addGuestNow}>
              <label className="sc-field">
                <span>Añadir invitado</span>
                <input className="vd-input" type="text" maxLength={30} placeholder="Rafa" value={gName} onChange={(e) => (setGName(e.target.value), setGErr(""))} aria-invalid={!!gErr || undefined} />
                {gErr && (
                  <small className="is-bad" role="alert">
                    {gErr}
                  </small>
                )}
              </label>
              <button type="submit" className="vd-btn vd-glass vd-press vd-btn--sm">
                <VIcon name="plus" size={16} />
                Al banquillo
              </button>
            </form>
          )}
          {guests.length >= 4 && <p className="sc-small">Cuatro invitados: es el máximo por partido.</p>}
        </section>
      </section>

      <section className="pa-col pa-more" aria-labelledby="pa-more-t">
        <h2 className="vd-vh" id="pa-more-t">
          Lo demás de la convocatoria
        </h2>
        {copy && (
          <div className="pa-sub pa-copy">
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => change(copy.lineup, "Copiada", `La convocatoria de la ${copy.label} · ${copy.lineup.starters.length + copy.lineup.bench.length} convocados (sin avisar)`)}>
              <VIcon name="undo" size={16} />
              Copiar la convocatoria de la {copy.label}
            </button>
            <p className="sc-small">El siete y el banquillo de entonces; se guarda sin avisar.</p>
          </div>
        )}
        <Turnos match={m} roster={roster} nameOf={nameOf} />
        <section className="pa-sub" aria-labelledby="pa-rem-t">
          <header className="sc-sec__h">
            <h3 className="sc-h3" id="pa-rem-t">
              Recordatorios automáticos
            </h3>
          </header>
          <Reminders auto={rem.auto} loading={rem.loading} draft={draft} missing={missing} onSet={rem.set} />
          {st.notified && !draft && missing > 0 && phase === "antes" && (
            <div className="pa-prop">
              <p className="sc-small">Un aviso ahora mismo, sin esperar a las 48 h: a cada convocado que no ha contestado.</p>
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => void remind()} aria-disabled={reminding || undefined}>
                {reminding ? "Recordando…" : `Recordar ahora a los ${missing} que faltan`}
              </button>
            </div>
          )}
        </section>
        <MeetingNote />
      </section>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toLocaleUpperCase("es") + s.slice(1);

function SevenView(o: {
  pos: PitchSlot[] | null;
  occ: (string | null)[];
  system: string;
  kit: Kit;
  still: (w: { name: string; number: number | string | null }) => string | undefined;
  byId: Map<string, { name: string; number: number | null }>;
  nameOf: (id: string) => string;
  answerOf: (id: string) => string;
  pick: Pick | null;
  slot: number | null;
  editable: boolean;
  onPeg: (id: string) => void;
  onFree: (i: number) => void;
}) {
  const { pos, occ } = o;
  const one = (id: string | null, i: number, inRow: boolean) => {
    const code = pos ? pos[i].code : "";
    const style: CSSProperties | undefined = pos && !inRow ? { left: `${Math.min(88, Math.max(12, pos[i].x))}%`, top: `${Math.min(88, Math.max(12, pos[i].y))}%` } : undefined;
    if (!id)
      return (
        <button type="button" className={`pa-slot${inRow ? " pa-slot--row" : ""} is-free${o.slot === i ? " is-sel" : ""}`} style={style} aria-label={`Hueco libre${code ? ` de ${code}` : ""} ${i + 1} de 7: elegir quién`} aria-expanded={o.slot === i} onClick={() => o.onFree(i)}>
          <span className="pa-slot__free" aria-hidden="true">
            <VIcon name="plus" size={18} />
          </span>
          <small aria-hidden="true">
            {code && <b>{code}</b>} Libre
          </small>
        </button>
      );
    const p = o.byId.get(id);
    const who = { name: p?.name ?? o.nameOf(id), number: p?.number ?? null };
    const ans = o.answerOf(id);
    return (
      <button type="button" className={`pa-slot${inRow ? " pa-slot--row" : ""} is-on`} style={style} aria-label={`${o.nameOf(id)}${code ? `, de ${code}` : ""}, ${ans}, en el siete${o.editable ? ": elegir" : ""}`} aria-expanded={o.pick?.id === id && o.pick.from === "siete"} onClick={() => o.onPeg(id)}>
        <Shirt src={p ? o.still(who) : undefined} who={who} kit={o.kit} size="m" />
        <small aria-hidden="true">
          {code && <b>{code}</b>} {who.name}
          {ans !== "viene" && !isGuestId(id) ? ` · ${ans}` : isGuestId(id) ? " · invitado" : ""}
        </small>
      </button>
    );
  };
  if (pos)
    return (
      <div className="pa-pitch" role="group" aria-label={`El siete: ${occ.filter(Boolean).length} de 7, en el ${o.system || "sistema"} de la pizarra`}>
        <svg className="pa-pitch__lines" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <rect x="2" y="2" width="96" height="136" rx="2" />
          <line x1="2" y1="70" x2="98" y2="70" />
          <circle cx="50" cy="70" r="11" />
          <rect x="26" y="114" width="48" height="24" />
          <rect x="38" y="128" width="24" height="10" />
          <rect x="26" y="2" width="48" height="24" />
          <rect x="38" y="2" width="24" height="10" />
        </svg>
        {o.system && <span className="pa-pitch__sys">{o.system}</span>}
        {occ.map((id, i) => (
          <span key={i}>{one(id, i, false)}</span>
        ))}
      </div>
    );
  return (
    <ol className="pa-sevenrow" aria-label={`El siete: ${occ.filter(Boolean).length} de 7`}>
      {occ.map((id, i) => (
        <li key={i}>{one(id, i, true)}</li>
      ))}
    </ol>
  );
}

function Reminders({ auto, loading, draft, missing, onSet }: { auto: boolean; loading: boolean; draft: boolean; missing: number; onSet: (on: boolean) => Promise<void> }) {
  const status = useStatus();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (busy || loading) return;
    setBusy(true);
    try {
      await onSet(!auto);
      status.show({ tag: "Recordatorios", message: auto ? "Apagados para este partido" : "Encendidos · 48 h y 24 h antes" });
    } catch (e) {
      status.show({ tone: "error", message: `No se ha podido cambiar: ${apiError(e)}`, retry: () => void toggle() });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" className="vd-switch" role="switch" aria-checked={auto} aria-describedby="pa-rem-l" disabled={loading} aria-busy={busy || undefined} onClick={() => void toggle()}>
        <span className="vd-switch__track">
          <span className="vd-switch__knob" />
        </span>
        <span>{auto ? "Sí" : "No"}</span>
      </button>
      <p className="sc-small" id="pa-rem-l">
        {draft
          ? auto
            ? "Un borrador no avisa a nadie: los recordatorios saldrán 48 h y 24 h antes cuando el partido esté en el calendario."
            : "Apagados: cuando el partido esté en el calendario, nadie recibirá el recordatorio."
          : auto
            ? `48 h y 24 h antes del partido, un aviso a cada convocado que no ha contestado (ahora, ${missing}).`
            : "Apagados para este partido: nadie recibe el recordatorio."}
      </p>
    </>
  );
}

function Turnos({ match, roster, nameOf }: { match: ClubMatch; roster: readonly { id: string; name: string }[]; nameOf: (id: string) => string }) {
  const data = useAdmin();
  const published = data.published.find((x) => x.id === match.id) ?? match;
  const { turns, rota, loading, error } = useMatchTurns(published, data.published, true);
  const played = rotaPlayed(rotaMatch(published), data.now);
  return (
    <section className="pa-sub" aria-labelledby="pa-turn-t">
      <header className="sc-sec__h">
        <h3 className="sc-h3" id="pa-turn-t">
          Turnos de esta jornada
        </h3>
        <SalaLink className="vd-link pa-mini-link" to={`/admin/caja/coste/${match.id}`}>
          El coste, en Caja
        </SalaLink>
      </header>
      {error ? (
        <p className="sc-small">No se han podido cargar los turnos.</p>
      ) : loading ? (
        <p className="sc-small">Cargando los turnos…</p>
      ) : !rota?.jobs.length ? (
        <>
          <p className="sc-small">Aún no hay turnos esta temporada.</p>
          <SalaLink className="vd-btn vd-glass vd-press vd-btn--sm" to="/admin/club/turnos">
            Crear los turnos
          </SalaLink>
        </>
      ) : !turns.length ? (
        <p className="sc-small">Ningún turno en este partido (el coche, solo fuera de casa).</p>
      ) : (
        <ul className="sc-rows pa-turns">
          {turns.map((t) => (
            <TurnRow key={t.job.id} matchId={match.id} seasonId={published.seasonId ?? ""} turn={t} played={played || t.frozen} roster={roster} nameOf={nameOf} />
          ))}
        </ul>
      )}
      {match.home !== false && rota?.jobs.some((j) => j.awayOnly) && <p className="sc-small">El coche, solo fuera de casa.</p>}
    </section>
  );
}

function TurnRow({ matchId, seasonId, turn: t, played, roster, nameOf }: { matchId: string; seasonId: string; turn: Turn; played: boolean; roster: readonly { id: string; name: string }[]; nameOf: (id: string) => string }) {
  const writes = useTurnosWrites();
  const status = useStatus();
  const [edit, setEdit] = useState<"cambiar" | "otro" | null>(null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const line = t.playerId ? `${played ? "Lo hizo" : "Le toca a"} ${nameOf(t.playerId)}` : "Nadie disponible";
  const note = t.pinned && t.swappedFrom ? `Cambio del capitán · le tocaba a ${nameOf(t.swappedFrom)}` : !t.pinned && t.skipped.length ? `Se salta a ${t.skipped.map(nameOf).join(", ")} (no puede o está ausente)` : "";
  const save = async () => {
    if (!pick || busy || !seasonId) return;
    setBusy(true);
    try {
      await writes.pin(matchId, seasonId, t.job.id, pick, t.computed);
      status.show({ tag: "Turnos", message: edit === "otro" ? `${t.job.name}: lo hizo ${nameOf(pick)}` : `${t.job.name}: le toca a ${nameOf(pick)}` });
      setEdit(null);
      setPick("");
    } catch (e) {
      status.show({ tone: "error", message: `No se ha podido cambiar: ${apiError(e)}` });
    } finally {
      setBusy(false);
    }
  };
  const back = async () => {
    setBusy(true);
    try {
      await (t.frozen && t.swappedFrom ? writes.pin(matchId, seasonId, t.job.id, t.swappedFrom, null) : writes.unpin(matchId, seasonId, t.job.id));
      status.show({ tag: "Turnos", message: `${t.job.name}: vuelve al turno` });
    } catch (e) {
      status.show({ tone: "error", message: `No se ha podido cambiar: ${apiError(e)}` });
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="sc-row pa-turn">
      <span className="sc-row__t">
        <b>{t.job.name}</b>
        <span>
          {line}
          {note ? ` · ${note}` : ""}
        </span>
      </span>
      <span className="pa-turn__a">
        {!played && (
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => (setEdit("cambiar"), setPick(""))} aria-expanded={edit === "cambiar"}>
            Cambiar
          </button>
        )}
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => (setEdit("otro"), setPick(""))} aria-expanded={edit === "otro"}>
          Lo hizo otro
        </button>
        {t.pinned && (
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => void back()} aria-disabled={busy || undefined}>
            Volver al turno
          </button>
        )}
      </span>
      {edit && (
        <div className="pa-turn__ed">
          <label className="sc-field">
            <span>{edit === "otro" ? "Lo hizo…" : "Cambiar por…"}</span>
            <select className="vd-input" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Elegir</option>
              {roster
                .filter((p) => p.id !== t.playerId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm vd-btn--pri" onClick={() => void save()} aria-disabled={!pick || busy || undefined}>
            Guardar
          </button>
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => setEdit(null)}>
            Cancelar
          </button>
        </div>
      )}
    </li>
  );
}

/** «Nota de quedada»: the one note of the match (it lives in the match's sheet, shared with Datos and the acta; the
 *  whole team sees it in Hoy, the vestuario and the notice). */
function MeetingNote() {
  const s = useSheetSession();
  const { match: m } = usePartido();
  const id = useId();
  const note = s.sheet.meetingNote ?? "";
  const save = () => void (isDraftOnly(m) ? s.saveDraft() : s.saveCalendar(false));
  return (
    <section className="pa-sub" aria-labelledby={`${id}-t`}>
      <header className="sc-sec__h">
        <h3 className="sc-h3" id={`${id}-t`}>
          Nota de quedada
        </h3>
        <span className="sc-sec__n">la ve todo el equipo</span>
      </header>
      <label className="sc-field">
        <span className="vd-vh">Nota de quedada</span>
        <textarea className="vd-input" maxLength={500} placeholder="Quedada, camiseta, material…" value={note} disabled={s.loading} onChange={(e) => s.update((x) => ({ ...x, meetingNote: e.target.value.slice(0, 500) }))} />
        <small>{500 - note.length} letras libres · sale en Hoy, en el vestuario y en el aviso</small>
      </label>
      {s.dirty && (
        <div className="pa-note__a">
          <span className="pa-dirty">● Sin guardar</span>
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={save} aria-disabled={!!s.busy || undefined}>
            {s.busy ? "Guardando…" : "Guardar la nota"}
          </button>
        </div>
      )}
    </section>
  );
}
