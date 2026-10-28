// PLANTILLA · la ficha (/admin/plantilla/<id>; on the desktop beside the list, on the phone full screen with «‹»), as
// the board's part-plantilla.html § La ficha: his printed shirt, «Ficha 3 de 16 · Defensa», what it lacks, Estado
// (Activo · Lesionado · Sancionado, the sanction's small form and «Levantar la sanción»), his numbers of the season,
// Camiseta (name, dorsal with its live check, name and surnames, the seasons, a season's own name or dorsal), Posiciones
// (the F7 map, ★ preferida and ● también, his proposal to approve, adjust or reject, «Ha jugado de»), Datos, Cuenta y
// web, Ausencias, the baja (never deletes) and «Borrar la ficha» (only one nobody cites, B-CLUB-05), and «anterior ·
// siguiente sin completar · siguiente» on every width (B-CLUB-07). Each field saves itself when you leave it, if it is
// valid (an invalid one is never written, and leaving with it asks first), behind «Deshacer».
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { addDoc, collection, deleteDoc, doc as fsDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../../firebase";
import { useAuth } from "../../../../context/AuthContext";
import { summaryText } from "../../../../components/posiciones/mapaNav";
import { ABSENCE_NOTE_MAX, absenceFields, absenceFormProblem, madridDate } from "../../../../lib/derived/absences";
import { plural } from "../../../../lib/derived/words";
import { resolvePositions, sanitizePositions, type PosCode, type PositionSet } from "../../../../lib/positions";
import { editPositionsPayload, proposalKey, proposalState, reviewPayload } from "../../../../lib/positionsEdit";
import { playerPositions } from "../../../../lib/positionStats";
import { SANCTION_LIMITS, type PlayerDoc } from "../../../../lib/schemas";
import { useAbsences } from "../../../vestuario/live";
import { relativeWhen } from "../../club/fichasLogic";
import type { BoardRow } from "../../club/plantillaBoard";
import { asPosition, checkPlayerForm, dorsalHolder, dorsalLine, evidenceText, formFromPlayer, nameIn, playerPayload, previewDoc, shirtNameError, type PlayerForm } from "../../club/plantillaLogic";
import { checkSanction, liftWrite, liftedDoc, sanctionForm, sanctionStatus, sanctionToast, sanctionWrite, sanctionedDoc, untilLabel, type SanctionForm } from "../../club/sanctionLogic";
import { SalaLink } from "../../shell/SalaLink";
import { useSalaGo } from "../../shell/salaHref";
import { useStatus } from "../../shell/statusContext";
import { useUnsavedGuard } from "../../ui/guard";
import { vtName } from "../../ui/viewTransition";
import { Mapa } from "./Mapa";
import { tapSpot, type MapMode } from "./mapModel";
import { birthdayOf, gapLine, LINE_ONE, nobodyCites, seasonNums } from "./model";
import { Icon, Shirt } from "./parts";
import { usePlantilla } from "./storeContext";

type FieldKey = "shirtName" | "number" | "firstName" | "lastName" | "photoUrl" | "birthDate" | "height" | "weight";
/** A field's key: one of the form's, or a season's own name / dorsal («ov:<season>:shirtName»). */
type Key = FieldKey | `ov:${string}:${"shirtName" | "number"}`;
interface FieldSpec {
  k: Key;
  label: string;
  type: "text" | "url" | "date";
  mode: "text" | "numeric" | "url";
  max: number;
  ph: string;
}

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
const toMs = (v: unknown): number => (typeof v === "number" ? v : v && typeof v === "object" && "toMillis" in v && typeof (v as { toMillis: unknown }).toMillis === "function" ? (v as { toMillis: () => number }).toMillis() : 0);
const dm = (iso: string) => {
  const x = iso.split("-");
  return x.length < 3 ? iso : `${Number(x[2])} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"][Number(x[1]) - 1]}`;
};

function valueOf(f: PlayerForm, k: Key): string {
  if (k.startsWith("ov:")) {
    const [, sid, part] = k.split(":");
    return f.overrides[sid]?.[part as "shirtName" | "number"] ?? "";
  }
  return f[k as FieldKey];
}
function withValue(f: PlayerForm, k: Key, v: string): PlayerForm {
  if (k.startsWith("ov:")) {
    const [, sid, part] = k.split(":");
    const o = f.overrides[sid] ?? { shirtName: "", number: "" };
    return { ...f, overrides: { ...f.overrides, [sid]: { ...o, [part]: v } } };
  }
  return { ...f, [k]: v };
}
const clean = (k: Key, v: string) => (k === "shirtName" || k.endsWith(":shirtName") ? v.toLocaleUpperCase("es") : k === "number" || k.endsWith(":number") ? digits(v, 2) : k === "height" || k === "weight" ? digits(v, 3) : v);

export interface FichaProps {
  row: BoardRow;
  index: number;
  total: number;
  prev: BoardRow | null;
  next: BoardRow | null;
  nextGap: BoardRow | null;
  allDone: boolean;
  /** Opens another ficha (the list's way: with ?vista=cromos when it came from the cromos). */
  open: (id: string, dir: 1 | -1) => void;
  /** The ficha is the selected row beside the list: its shirt carries the morph name (the row's does not). */
  vt: boolean;
}

export function Ficha({ row, index, total, prev, next, nextGap, allDone, open, vt }: FichaProps) {
  const st = usePlantilla();
  const { data, season, players, writes, write, suspended, upcoming } = st;
  const { user } = useAuth();
  const go = useSalaGo();
  const status = useStatus();
  const uid = useId();
  const player = row.doc;
  const id = row.id;
  const name = row.name;
  const inS = row.inSeason;
  const sid = season && inS ? season.id : undefined;

  // ── the form: what is written (derived from the doc, the pending writes applied) and what is being typed ──
  const livePos = asPosition(resolvePositions(player).line);
  const live = (f: PlayerForm): PlayerForm => ({ ...f, position: livePos, injured: !!player.injured });
  const saved = live(formFromPlayer(player));
  const [drafts, setDrafts] = useState<Partial<Record<Key, string>>>({});
  const ctx = (start: PlayerForm) => ({ players, seasons: data.seasons, editingId: id, start });
  const problemOf = (k: Key, form: PlayerForm): string | null => {
    const check = checkPlayerForm(live(form), ctx(saved));
    const v = valueOf(form, k).trim();
    switch (k) {
      case "shirtName":
        return shirtNameError(v, false) || null;
      case "number": {
        const line = dorsalLine(check, live(form), saved);
        return line.tone === "bad" ? line.text : null;
      }
      case "firstName":
      case "lastName":
        return v.length > 40 ? "Como mucho 40 letras" : null;
      case "photoUrl":
        return check.photo?.tone === "bad" ? check.photo.text : null;
      case "birthDate":
        return v && !/^\d{4}-\d{2}-\d{2}$/.test(v) ? "Una fecha: día, mes y año" : null;
      case "height":
        return check.height;
      case "weight":
        return check.weight;
      default: {
        const [, s, part] = k.split(":");
        const p = check.overrides[s]?.[part as "shirtName" | "number"];
        return p ?? null;
      }
    }
  };
  const hintOf = (k: Key, form: PlayerForm): string => {
    const v = valueOf(form, k).trim();
    switch (k) {
      case "shirtName":
        return `${v.length}/12 · en mayúsculas`;
      case "number":
        return dorsalLine(checkPlayerForm(live(form), ctx(saved)), live(form), saved).text;
      case "firstName":
        return "Opcional";
      case "lastName":
        return "Opcional · sale en su página";
      case "photoUrl":
        return v ? "Enlace seguro · se ve en su página" : "Sin foto · su página enseña la camiseta";
      case "birthDate": {
        const b = birthdayOf(v, data.now);
        return b ? `Cumple ${b.age} ${b.when}` : "Sale en los cumpleaños de El club";
      }
      case "height":
        return v ? `${v} cm` : "En centímetros";
      case "weight":
        return v ? `${v} kg` : "En kilos";
      default:
        return k.endsWith(":shirtName") ? `Vacío = ${saved.shirtName || name}` : `Vacío = el ${saved.number || "de arriba"}`;
    }
  };

  const save = (nextForm: PlayerForm, message = `Ficha de ${nameIn(previewDoc(player, id, playerPayload(live(nextForm), { stored: player })), sid)} guardada`) => {
    const payload = playerPayload(live(nextForm), { stored: player });
    write({ id, doc: previewDoc(player, id, payload), tag: "Ficha", message, error: `No se ha podido guardar a ${name}`, commit: () => writes.savePlayer(id, payload) });
  };
  const commit = (k: Key) => {
    const v = drafts[k];
    if (v === undefined) return;
    const nextForm = withValue(saved, k, v);
    if (problemOf(k, nextForm)) return;
    setDrafts((d) => {
      const n = { ...d };
      delete n[k];
      return n;
    });
    if (valueOf(nextForm, k).trim() === valueOf(saved, k).trim()) return;
    save(nextForm);
  };
  // a valid edit still in a field when the ficha goes away (another player, back) is written
  const flush = useRef<() => void>(() => undefined);
  useEffect(() => {
    flush.current = () => {
      let form = saved;
      let changed = false;
      for (const [k, v] of Object.entries(drafts) as [Key, string][]) {
        const f = withValue(form, k, v);
        if (problemOf(k, f) || valueOf(f, k).trim() === valueOf(form, k).trim()) continue;
        form = f;
        changed = true;
      }
      if (changed) save(form);
    };
  });
  useEffect(() => () => flush.current(), []);
  const bad = (Object.keys(drafts) as Key[]).filter((k) => problemOf(k, withValue(saved, k, drafts[k] ?? "")) !== null);
  useUnsavedGuard(bad.length > 0, { what: `la ficha de ${name}` });

  const field = (f: FieldSpec) => {
    const has = f.k in drafts;
    const value = has ? (drafts[f.k] ?? "") : valueOf(saved, f.k);
    const form = withValue(saved, f.k, value);
    const problem = has ? problemOf(f.k, form) : null;
    const fid = `${uid}-${f.k.replace(/:/g, "-")}`;
    return (
      <div className="sc-field" key={f.k}>
        <label className="spl-lab" htmlFor={fid}>
          {f.label}
        </label>
        <input
          className="vd-input vd-glass"
          id={fid}
          type={f.type}
          inputMode={f.mode}
          maxLength={f.max}
          placeholder={f.ph}
          value={value}
          aria-invalid={!!problem}
          aria-describedby={`${fid}-h`}
          autoComplete="off"
          onChange={(e) => {
            const v = clean(f.k, e.currentTarget.value);
            setDrafts((d) => ({ ...d, [f.k]: v }));
          }}
          onBlur={() => commit(f.k)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(f.k);
            }
          }}
        />
        <small className={problem ? "is-bad" : ""} id={`${fid}-h`}>
          {problem ?? hintOf(f.k, form)}
        </small>
      </div>
    );
  };

  // ── the seasons: a switch each (the active one off is the baja; an archived one is changed in Club) ──
  const [bajaOpen, setBajaOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delQ, setDelQ] = useState("");
  const toggleSeason = (s: (typeof data.seasons)[number]) => {
    const on = saved.seasons.includes(s.id);
    if (s.archived) {
      statusSay(`${s.name} está archivada: se cambia desde Club › Temporadas.`);
      return;
    }
    if (on && season && s.id === season.id) {
      setBajaOpen(true);
      setDelOpen(false);
      return;
    }
    const nextForm = { ...saved, seasons: on ? saved.seasons.filter((x) => x !== s.id) : [...saved.seasons, s.id] };
    const check = checkPlayerForm(live(nextForm), ctx(saved));
    if (!check.ok && !on) {
      statusSay(check.errors[0] ?? "No se puede: revisa el dorsal.", true);
      return;
    }
    save(nextForm, `${name} ${on ? "sale de la" : "entra en la"} ${s.name}`);
  };
  function statusSay(message: string, error = false) {
    status.show({ tag: "Temporada", message, ...(error ? { tone: "error" as const } : {}) });
  }

  // ── Estado: Activo · Lesionado · Sancionado ──
  const susp = suspended.get(id);
  const sanctioned = !!susp;
  const injured = !!player.injured;
  const [sanOpen, setSanOpen] = useState(false);
  const setState = (to: "activo" | "lesionado") => {
    if (to === "lesionado") {
      if (injured) return;
      write({ id, doc: { ...player, injured: true }, tag: "Parte", message: `${name}, lesionado · no sale en la convocatoria hasta que vuelva`, error: `No se ha podido cambiar el estado de ${name}`, commit: () => writes.savePlayer(id, { injured: true }) });
      return;
    }
    if (!injured && !sanctioned) return;
    setSanOpen(false);
    const at = data.now;
    const payload = { ...(injured ? { injured: false } : {}), ...(sanctioned ? liftWrite(at) : {}) };
    const d = sanctioned ? liftedDoc({ ...player, injured: false }, at) : { ...player, injured: false };
    write({ id, doc: d, tag: "Parte", message: `${name} vuelve a estar disponible${sanctioned ? " · sanción levantada" : ""}`, error: `No se ha podido cambiar el estado de ${name}`, commit: () => writes.savePlayer(id, payload) });
  };
  const lift = () => {
    const at = data.now;
    write({ id, doc: liftedDoc(player, at), tag: "Sanción", message: `${name}, sanción levantada · vuelve a estar disponible`, error: `No se ha podido levantar la sanción de ${name}`, commit: () => writes.savePlayer(id, liftWrite(at)) });
  };
  const stI = sanctioned ? 2 : injured ? 1 : 0;

  // ── his numbers of the season (published actas) ──
  const cromo = data.squad.byId.get(id);
  const nums = seasonNums(id, data.published, season?.id, cromo ? { played: cromo.stats.played, goals: cromo.stats.goals, assists: cromo.stats.assists, minutes: cromo.stats.timed === 0 && cromo.stats.played > 0 ? null : Math.round(cromo.stats.minutes) } : undefined);

  // ── Posiciones: the map (★ / ●), his proposal ──
  const resolved = resolvePositions(player);
  const current: PositionSet = { main: resolved.main, also: resolved.also };
  const proposal = proposalState(player) === "pendiente" ? sanitizePositions(player.positionsProposal) : null;
  const liveKey = proposalKey(player);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const adj = !!proposal && adjusting !== null && adjusting === liveKey;
  const [mode, setMode] = useState<"main" | "also">("main");
  const [mapErr, setMapErr] = useState("");
  const reviewer = user?.uid ?? null;
  const writePositions = (w: Partial<PlayerDoc>, tag: string, message: string, error: string) => write({ id, doc: { ...player, ...w }, tag, message, error, commit: () => writes.savePlayer(id, w) });
  const onSpot = (c: PosCode) => {
    const base = adj && proposal ? proposal : current;
    const res = tapSpot(base, c, mode as MapMode, name);
    if (typeof res === "string") {
      setMapErr(res);
      return;
    }
    setMapErr("");
    if (adj && reviewer) {
      setAdjusting(null);
      writePositions(reviewPayload("ajustada", res, reviewer, serverTimestamp()) as Partial<PlayerDoc>, "Posición", `Posiciones de ${name}: ${summaryText(res)} · propuesta ajustada, se le avisa`, `No se ha podido ajustar la propuesta de ${name}`);
    } else writePositions(editPositionsPayload(res) as Partial<PlayerDoc>, "Posición", `Posiciones de ${name}: ${summaryText(res)}`, `No se han podido cambiar las posiciones de ${name}`);
  };
  const review = (kind: "aprobada" | "rechazada") => {
    if (!reviewer) return;
    setAdjusting(null);
    if (kind === "rechazada") {
      writePositions(reviewPayload("rechazada", null, reviewer, serverTimestamp()) as Partial<PlayerDoc>, "Posición", `Propuesta de ${name} rechazada · se le avisa y sigue como estaba`, `No se ha podido rechazar la propuesta de ${name}`);
      return;
    }
    if (!proposal) return;
    writePositions(reviewPayload("aprobada", proposal, reviewer, serverTimestamp()) as Partial<PlayerDoc>, "Posición", `Propuesta de ${name} aprobada · se le avisa «El capitán revisó tus posiciones»`, `No se ha podido aprobar la propuesta de ${name}`);
  };
  const played = evidenceText(playerPositions(id, data.published, data.ratings));
  const shown = adj && proposal ? proposal : current;

  // ── la cuenta ──
  const acct =
    row.account === "vinculada"
      ? { t: `Cuenta vinculada · @${row.who}`, d: "Entra al vestuario con su ficha", btn: "Verlo en Socios", to: "/admin/plantilla/socios?ver=dentro" }
      : row.account === "pide"
        ? { t: `Pide su ficha · @${row.who}`, d: `@${row.who} la ha pedido: apruébalo o recházalo en Socios`, btn: "Revisar en Socios", to: "/admin/plantilla/socios?ver=fichas" }
        : row.account === "fuera"
          ? { t: `La guarda @${row.who}, que ya no está dentro`, d: "Nadie más puede pedirla hasta que la liberes en Socios", btn: "Liberarla en Socios", to: "/admin/plantilla/socios?ver=dentro" }
          : { t: "Sin cuenta", d: "Nadie entra al vestuario con esta ficha todavía", btn: "Invitar con esta ficha", to: `/admin/plantilla/socios?ver=invitaciones&para=${encodeURIComponent(id)}` };
  const story = (player.bio ?? "").trim();

  // ── ausencias (H-CLUB-05): what he said in the vestuario; a captain can take one away ──
  const today = madridDate(data.now);
  const stored = useAbsences(today).data.filter((a) => a.playerId === id);
  // (r12: a captain writes one for him from here — only with his member linked, signed `by` the captain; it shows
  // at once while it waits behind «Deshacer», and goes away if undone or not written)
  const member = row.account === "vinculada" ? data.people.find((p) => !p.removed && p.playerId === id) : undefined;
  const [absNew, setAbsNew] = useState<{ key: string; from: string; to: string; note: string }[]>([]);
  const [absForm, setAbsForm] = useState<{ from: string; to: string; note: string; err: string } | null>(null);
  const absences = [...stored, ...absNew.filter((n) => !stored.some((a) => a.from === n.from && a.to === n.to && a.note === n.note)).map((n) => ({ id: n.key, from: n.from, to: n.to, note: n.note, pending: true }))].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  const removeAbsence = (a: { id: string; from: string; to: string }) =>
    status.defer({ tag: "Ausencia", message: `Quitada la ausencia de ${name} (del ${dm(a.from)} al ${dm(a.to)})`, commit: () => deleteDoc(fsDoc(db, "absences", a.id)), errorMessage: "No se ha podido quitar la ausencia" });
  const addAbsence = (e: FormEvent) => {
    e.preventDefault();
    if (!absForm || !member || !user) return;
    const { from, to } = absForm;
    const err = !from || !to ? "Pon desde qué día y hasta qué día." : to < from ? "El último día va después del primero." : absenceFormProblem(from, to, today);
    if (err) {
      setAbsForm({ ...absForm, err });
      return;
    }
    const fields = absenceFields({ uid: member.uid, name: member.nickname, playerId: id }, from, to, absForm.note);
    const key = `nueva-${from}-${to}-${Date.now()}`;
    const drop = () => setAbsNew((l) => l.filter((x) => x.key !== key));
    setAbsNew((l) => [...l, { key, from, to, note: fields.note ?? "" }]);
    setAbsForm(null);
    status.defer({
      tag: "Ausencia",
      message: `${name} no está del ${dm(from)} al ${dm(to)} · sale en la convocatoria`,
      commit: () => addDoc(collection(db, "absences"), { ...fields, createdAt: serverTimestamp(), by: user.uid }),
      onUndo: drop,
      onError: drop,
      onDone: drop,
      errorMessage: `No se ha podido apuntar la ausencia de ${name}`,
    });
  };

  // ── baja, alta otra vez, borrar ──
  const restore = () => {
    if (!season) return;
    const nextForm = { ...saved, seasons: [...new Set([...saved.seasons, season.id])] };
    const payload = { ...playerPayload(live(nextForm), { stored: player }), archived: false };
    const num = Number(saved.number);
    const clash = Number.isFinite(num) ? dorsalHolder(players, season.id, num, id) : null;
    write({ id, doc: { ...previewDoc(player, id, payload), archived: false }, tag: "Alta", message: `${name} vuelve a la ${season.name}${clash ? ` · el ${num} ya lo lleva ${nameIn(clash, season.id)}: cámbiale el dorsal` : saved.number ? ` con el ${saved.number}` : ""}`, error: `No se ha podido dar de alta a ${name}`, commit: () => writes.savePlayer(id, payload) });
  };
  const baja = () => {
    if (!season) return;
    setBajaOpen(false);
    const payload = { seasons: (player.seasons ?? []).filter((s) => s !== season.id) };
    write({ id, doc: { ...player, ...payload }, tag: "Baja", message: `${name} de baja de la ${season.name} · sus actas y estadísticas se quedan`, error: `No se ha podido dar de baja a ${name}`, commit: () => writes.savePlayer(id, payload) });
  };
  const canDelete = nobodyCites(player, [...data.matches, ...data.archivedMatches], row.account);
  const delOk = delQ.trim().toLocaleUpperCase("es") === name.toLocaleUpperCase("es");
  const del = () => {
    if (!delOk) return;
    setDelOpen(false);
    setDelQ("");
    write({ id, doc: null, tag: "Borrada", message: `La ficha de ${name} ya no existe · nunca jugó, ningún acta la cita`, error: `No se ha podido borrar la ficha de ${name}`, commit: () => writes.deletePlayer(id), onDone: () => go("/admin/plantilla") });
  };

  // ── head ──
  const outLine = player.archived ? `Está en el archivo: jugó en ${archivedNames(player, data.seasons)}, que está archivada.` : season ? `Está de baja: no juega la ${season.name}.` : "No juega ninguna temporada visible.";
  const kicker = inS ? `Ficha ${index} de ${total} · ${row.position ? LINE_ONE[row.position] : "sin posición"}` : player.archived ? "De una temporada archivada" : season ? `Fuera de la ${season.name}` : "Sin temporada";
  const src = st.still(row);
  const kitVt = vt ? vtName("spl-shirt", id) : undefined;
  const fields = (list: FieldSpec[]) => list.map(field);
  const shirtFields: FieldSpec[] = [
    { k: "shirtName", label: "Nombre en la camiseta", type: "text", mode: "text", max: 12, ph: "PABLO" },
    { k: "number", label: season && inS ? `Dorsal en la ${season.name}` : "Dorsal", type: "text", mode: "numeric", max: 2, ph: "1–99" },
    { k: "firstName", label: "Nombre", type: "text", mode: "text", max: 40, ph: "Pablo" },
    { k: "lastName", label: "Apellidos", type: "text", mode: "text", max: 40, ph: "García López" },
  ];
  const dataFields: FieldSpec[] = [
    { k: "photoUrl", label: "Foto · enlace https://", type: "url", mode: "url", max: 300, ph: "https://…" },
    { k: "birthDate", label: "Nacimiento", type: "date", mode: "text", max: 10, ph: "" },
    { k: "height", label: "Altura (cm)", type: "text", mode: "numeric", max: 3, ph: "178" },
    { k: "weight", label: "Peso (kg)", type: "text", mode: "numeric", max: 3, ph: "75" },
  ];
  const sdSeasons = data.seasons.filter((s) => !s.archived && saved.seasons.includes(s.id));
  const sdDirty = sdSeasons.some((s) => `ov:${s.id}:shirtName` in drafts || `ov:${s.id}:number` in drafts);
  const hasOverride = sdSeasons.some((s) => saved.overrides[s.id]?.shirtName || saved.overrides[s.id]?.number);
  const [sdOpen, setSdOpen] = useState(hasOverride);
  const short = (n: string) => (/Temporada (\d+)/.exec(n) ? `T${/Temporada (\d+)/.exec(n)?.[1]}` : n);

  return (
    <article className="spl-ficha" aria-labelledby={`${uid}-t`}>
      {!inS && (
        <div className="spl-out" role="status">
          <p>
            <b>{outLine}</b> Sus actas, goles y su carta siguen ahí.
          </p>
          {season && (
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri vd-btn--sm" onClick={restore}>
              Volver a darle de alta
            </button>
          )}
        </div>
      )}
      <header className="spl-fh">
        <div className="spl-fh__kit">
          <Shirt src={src ?? st.blank} size="xl" vt={kitVt} alt={`Camiseta de ${name}${row.number != null ? `, el ${row.number}` : ""}`} />
          {!src && st.blank && (
            <small className="spl-fh__reprint">
              La camiseta impresa se vuelve a estampar con {name}
              {row.number != null ? ` · ${row.number}` : ""}
            </small>
          )}
        </div>
        <div className="spl-fh__t">
          <p className="sc-k">{kicker}</p>
          <h2 className="spl-fh__name" id={`${uid}-t`}>
            <span className="sc-num">{row.number ?? "—"}</span> {name}
          </h2>
          <p className="spl-fh__full">{row.full === "Sin nombre" ? "Nombre y apellidos sin poner" : row.full}</p>
          <p className={`spl-fh__gaps ${row.gaps.length ? "is-gap" : "is-full"}`}>
            {gapLine(row.gaps)}
            {bad.length > 0 && <b className="spl-fh__dirty"> · Sin guardar: revisa lo marcado</b>}
          </p>
          <div className="vd-seg vd-glass spl-state" role="group" aria-label={`Estado de ${name}`} style={{ "--n": 3, "--i": stI } as CSSProperties}>
            <span className="vd-shelf__bead" aria-hidden="true" />
            <button type="button" className="vd-seg__b" aria-pressed={!injured && !sanctioned} onClick={() => setState("activo")}>
              Activo
            </button>
            <button type="button" className="vd-seg__b" aria-pressed={injured} onClick={() => setState("lesionado")}>
              Lesionado
            </button>
            <button type="button" className="vd-seg__b" aria-pressed={sanctioned} aria-expanded={sanOpen} onClick={() => setSanOpen((o) => !o)}>
              Sancionado
            </button>
          </div>
          {susp && (
            <p className="spl-sancline">
              <span className="sc-tag sc-tag--toca">{sanctionStatus(susp, data.matches)}</span>
              <button type="button" className="vd-link" onClick={lift}>
                Levantar la sanción
              </button>
            </p>
          )}
          {sanOpen && (
            <SanctionBox
              name={name}
              editing={sanctioned}
              upcoming={upcoming}
              onCancel={() => setSanOpen(false)}
              onSave={(choice) => {
                setSanOpen(false);
                const s = sanctionWrite(choice, data.now, user?.uid ?? "");
                write({ id, doc: sanctionedDoc(player, s), tag: "Sanción", message: sanctionToast(name, choice, data.matches), error: `No se ha podido sancionar a ${name}`, commit: () => writes.savePlayer(id, { sanction: s }) });
              }}
            />
          )}
          {nums.games > 0 ? (
            <dl className="spl-nums" aria-label={`${season?.name ?? "La temporada"} · ${plural(nums.games, "partido jugado", "partidos jugados")}`}>
              <dt className="spl-nums__k">
                {season?.name ?? "La temporada"} · {plural(nums.games, "partido jugado", "partidos jugados")}
              </dt>
              <dd>
                <b className="sc-num">{nums.minutes == null ? "—" : `${nums.minutes}′`}</b>
                <span>minutos</span>
              </dd>
              <dd>
                <b className="sc-num">{nums.goals}</b>
                <span>{nums.goals === 1 ? "gol" : "goles"}</span>
              </dd>
              <dd>
                <b className="sc-num">{nums.assists}</b>
                <span>{nums.assists === 1 ? "pase de gol" : "pases de gol"}</span>
              </dd>
              <dd>
                <b className="sc-num">{nums.cards}</b>
                <span>{nums.cards === 1 ? "tarjeta" : "tarjetas"}</span>
              </dd>
            </dl>
          ) : (
            <p className="sc-small spl-nums__none">{season ? `Sin minutos en la ${season.name} todavía` : "Sin partidos jugados"}</p>
          )}
          <a className="vd-link spl-page" href={`/jugadores/${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">
            Ver su página
            <Icon name="expand" size={16} />
            <span className="vd-vh"> (se abre en otra pestaña)</span>
          </a>
        </div>
      </header>

      <section className="sc-sec spl-sec" aria-labelledby={`${uid}-cam`}>
        <header className="sc-sec__h">
          <h3 className="sc-h3" id={`${uid}-cam`}>
            Camiseta
          </h3>
        </header>
        <div className="sc-form spl-form">{fields(shirtFields)}</div>
        <div className="spl-seasons" role="group" aria-label="Temporadas">
          <p className="spl-lab">Temporadas</p>
          {data.seasons.map((s) => (
            <button key={s.id} type="button" className="vd-switch" role="switch" aria-checked={saved.seasons.includes(s.id)} aria-disabled={s.archived || undefined} onClick={() => toggleSeason(s)}>
              <span className="vd-switch__track" aria-hidden="true">
                <span className="vd-switch__knob" />
              </span>
              {s.name}
              {s.archived ? " · archivada" : ""}
            </button>
          ))}
        </div>
        {sdSeasons.length > 0 && (
          <div className="spl-det">
            <button type="button" className="vd-link spl-det__b" aria-expanded={sdOpen || sdDirty} onClick={() => setSdOpen((o) => !o)}>
              Nombre o dorsal distinto en una temporada
            </button>
            {(sdOpen || sdDirty) &&
              sdSeasons.map((s) => (
                <div className="spl-sd" key={s.id}>
                  <p className="sc-small">Solo en la {s.name} · vacío = el de arriba</p>
                  <div className="sc-form">
                    {fields([
                      { k: `ov:${s.id}:shirtName`, label: `Nombre solo en la ${short(s.name)}`, type: "text", mode: "text", max: 12, ph: saved.shirtName || name },
                      { k: `ov:${s.id}:number`, label: `Dorsal solo en la ${short(s.name)}`, type: "text", mode: "numeric", max: 2, ph: saved.number },
                    ])}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      <section className="sc-sec spl-sec" aria-labelledby={`${uid}-pos`}>
        <header className="sc-sec__h">
          <h3 className="sc-h3" id={`${uid}-pos`}>
            Posiciones
          </h3>
          <span className="sc-small">
            Preferida {current.main ?? "sin elegir"}
            {current.also.length ? ` · también ${current.also.join(", ")}` : ""}
          </span>
        </header>
        {proposal && !adj && (
          <div className="spl-prop" role="group" aria-label={`Propuesta de ${name}`}>
            <p className="spl-prop__t">
              <span className="sc-tag sc-tag--toca">Te toca</span>
              <b>
                {name} propone: {summaryText(proposal)}
              </b>
            </p>
            <p className="sc-small">
              Ahora: {summaryText(current, "sin posiciones")}
              {toMs((player.positionsProposal as { at?: unknown } | null | undefined)?.at) ? ` · la mandó ${relativeWhen(toMs((player.positionsProposal as { at?: unknown }).at), data.now)}` : ""}
            </p>
            <p className="sc-small">{played}</p>
            <div className="sc-btnrow">
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-disabled={!reviewer || undefined} onClick={() => review("aprobada")}>
                Aprobar
              </button>
              <button
                type="button"
                className="vd-btn vd-glass vd-press vd-btn--sm"
                aria-pressed={false}
                aria-disabled={!reviewer || undefined}
                onClick={() => {
                  if (!reviewer) return;
                  setAdjusting(liveKey);
                  setMode("also");
                }}
              >
                Ajustar
              </button>
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-disabled={!reviewer || undefined} onClick={() => review("rechazada")}>
                Rechazar
              </button>
            </div>
          </div>
        )}
        {adj && (
          <p className="spl-adj" role="status">
            <span>Ajustando la propuesta de {name} · toca en el mapa: se guarda como ajustada</span>
            <button type="button" className="vd-link" onClick={() => setAdjusting(null)}>
              Cancelar
            </button>
          </p>
        )}
        <div className="spl-posgrid">
          <div className="spl-mapw">
            <div className="vd-seg vd-glass spl-mode" role="group" aria-label="Qué marca un toque en el mapa" style={{ "--n": 2, "--i": mode === "also" ? 1 : 0 } as CSSProperties}>
              <span className="vd-shelf__bead" aria-hidden="true" />
              <button type="button" className="vd-seg__b" aria-pressed={mode === "main"} onClick={() => (setMode("main"), setMapErr(""))}>
                ★ Preferida
              </button>
              <button type="button" className="vd-seg__b" aria-pressed={mode === "also"} onClick={() => (setMode("also"), setMapErr(""))}>
                ● También
              </button>
            </div>
            <Mapa value={shown} mode={mode} label={`Posiciones de ${name}`} onTap={onSpot} was={adj ? current : undefined} />
            <p className="spl-map__key" aria-hidden="true">
              <span>
                <b className="spl-key">★</b> preferida
              </span>
              <span>
                <b className="spl-key">●</b> también · hasta 6
              </span>
            </p>
            {mapErr && (
              <p className="spl-err" role="alert">
                {mapErr}
              </p>
            )}
          </div>
          <p className="spl-played">{played}</p>
        </div>
      </section>

      <section className="sc-sec spl-sec" aria-labelledby={`${uid}-dat`}>
        <header className="sc-sec__h">
          <h3 className="sc-h3" id={`${uid}-dat`}>
            Datos
          </h3>
        </header>
        <div className="sc-form spl-form">{fields(dataFields)}</div>
        <p className="sc-small spl-note">La foto solo se cambia aquí: la historia de la web la enseña, pero no la edita.</p>
      </section>

      <section className="sc-sec spl-sec" aria-labelledby={`${uid}-cue`}>
        <header className="sc-sec__h">
          <h3 className="sc-h3" id={`${uid}-cue`}>
            Cuenta y web
          </h3>
        </header>
        <ul className="sc-rows">
          <li className="sc-row">
            <span className="sc-row__t">
              <b>{acct.t}</b>
              <span>{acct.d}</span>
            </span>
            <SalaLink className="vd-btn vd-glass vd-press vd-btn--sm" to={acct.to}>
              {acct.btn}
            </SalaLink>
          </li>
          <li className="sc-row">
            <span className="sc-row__t">
              <b>{story ? "Su historia está escrita" : "Sin historia"}</b>
              <span>{story ? `«${story}»` : "La web enseña su carta sin frase"}</span>
            </span>
            <SalaLink className="vd-btn vd-glass vd-press vd-btn--sm" to={`/admin/club/web/historias?jugador=${encodeURIComponent(id)}`}>
              {story ? "Editar su historia" : "Escribir su historia"}
            </SalaLink>
          </li>
        </ul>
      </section>

      <section className="sc-sec spl-sec" aria-labelledby={`${uid}-aus`}>
        <header className="sc-sec__h">
          <h3 className="sc-h3" id={`${uid}-aus`}>
            Ausencias
          </h3>
          {member && (
            <button type="button" className="vd-link" aria-expanded={!!absForm} onClick={() => setAbsForm(absForm ? null : { from: "", to: "", note: "", err: "" })}>
              <Icon name="plus" size={16} />
              Apuntar una ausencia
            </button>
          )}
        </header>
        {absences.length ? (
          <ul className="sc-rows">
            {absences.map((a) => (
              <li className="sc-row" key={a.id}>
                <span className="sc-row__t">
                  <b>
                    Del {dm(a.from)} al {dm(a.to)}
                  </b>
                  <span>{a.note || "Sin motivo"}</span>
                </span>
                <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-label={`Quitar la ausencia de ${name} del ${dm(a.from)}`} aria-disabled={"pending" in a || undefined} onClick={() => !("pending" in a) && removeAbsence(a)}>
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sc-small">Sin ausencias apuntadas. Las que avisa él desde el vestuario salen aquí y en la convocatoria.</p>
        )}
        {!member && <p className="sc-small">Sin cuenta en el vestuario: sus ausencias las apunta él cuando entre.</p>}
        {absForm && (
          <form className="spl-absf" aria-label="Apuntar una ausencia" onSubmit={addAbsence} noValidate>
            <div className="sc-form">
              <label className="sc-field">
                <span>Desde</span>
                <input className="vd-input vd-glass" type="date" value={absForm.from} onChange={(e) => setAbsForm({ ...absForm, from: e.currentTarget.value, err: "" })} />
              </label>
              <label className="sc-field">
                <span>Hasta (incluido)</span>
                <input className="vd-input vd-glass" type="date" value={absForm.to} onChange={(e) => setAbsForm({ ...absForm, to: e.currentTarget.value, err: "" })} />
              </label>
              <label className="sc-field sc-field--wide">
                <span>Motivo · opcional</span>
                <input className="vd-input vd-glass" type="text" maxLength={ABSENCE_NOTE_MAX} value={absForm.note} onChange={(e) => setAbsForm({ ...absForm, note: e.currentTarget.value })} placeholder="De viaje, trabajo…" />
              </label>
            </div>
            {absForm.err && (
              <p className="spl-err" role="alert">
                {absForm.err}
              </p>
            )}
            <div className="sc-btnrow">
              <button type="submit" className="vd-btn vd-glass vd-press vd-btn--pri vd-btn--sm">
                Apuntar
              </button>
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => setAbsForm(null)}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="sc-sec spl-sec spl-end" aria-labelledby={`${uid}-baja`}>
        <h3 className="vd-vh" id={`${uid}-baja`}>
          Baja
        </h3>
        {inS && season && (
          <>
            <button
              type="button"
              className="vd-btn vd-glass vd-press vd-btn--sm spl-baja"
              aria-expanded={bajaOpen}
              onClick={() => {
                setBajaOpen((o) => !o);
                setDelOpen(false);
              }}
            >
              Dar de baja de la {season.name}
            </button>
            {bajaOpen && (
              <div className="spl-confirm" role="group" aria-label="¿Dar de baja?">
                <p className="sc-h3">¿Dar de baja a {name}?</p>
                <ul className="spl-conseq">
                  <li>Deja la plantilla de la {season.name}</li>
                  <li>Sus actas, goles y su carta se quedan: no se borra nada</li>
                  <li>Se puede volver a dar de alta desde Antiguos</li>
                </ul>
                <div className="sc-btnrow">
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--pri vd-btn--sm" onClick={baja}>
                    Dar de baja
                  </button>
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => setBajaOpen(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {canDelete ? (
          <>
            <button
              type="button"
              className="vd-link spl-del"
              aria-expanded={delOpen}
              onClick={() => {
                setDelOpen((o) => !o);
                setDelQ("");
                setBajaOpen(false);
              }}
            >
              <Icon name="trash" size={16} />
              Borrar la ficha
            </button>
            {delOpen && (
              <div className="spl-confirm spl-confirm--del" role="group" aria-label="¿Borrar la ficha?">
                <p className="sc-h3">¿Borrar la ficha de {name} para siempre?</p>
                <ul className="spl-conseq">
                  <li>Solo se puede porque nunca ha jugado: ningún acta ni convocatoria la cita</li>
                  <li>Desaparece de la plantilla, de las temporadas y de la web</li>
                  <li>Para dejar de contar con él, mejor «Dar de baja»</li>
                </ul>
                <label className="sc-field">
                  <span>Escribe {name} para confirmar</span>
                  <input className="vd-input vd-glass" type="text" value={delQ} onChange={(e) => setDelQ(e.currentTarget.value)} autoComplete="off" />
                </label>
                <div className="sc-btnrow">
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm spl-danger" aria-disabled={!delOk || undefined} onClick={del}>
                    Borrar la ficha
                  </button>
                  <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => setDelOpen(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="sc-small">{row.account === "vinculada" || row.account === "fuera" ? "Su ficha no se puede borrar: tiene una cuenta unida. Dar de baja nunca borra." : "Su ficha no se puede borrar: ha jugado y las actas la citan. Dar de baja nunca borra."}</p>
        )}
        <p className="sc-small spl-savehint">Se guarda solo al salir de cada campo · «Deshacer» durante 5 s en la franja de abajo</p>
      </section>

      <nav className="spl-fnav sc-primary sc-primary--pin" aria-label="Pasar de jugador">
        <button type="button" className="vd-ibtn vd-glass vd-press" aria-label={prev ? `Jugador anterior: ${prev.name}` : "Jugador anterior"} aria-keyshortcuts="ArrowLeft ArrowUp" aria-disabled={!prev || undefined} onClick={() => prev && open(prev.id, -1)}>
          <Icon name="arrow" size={20} flip />
        </button>
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm spl-fnav__gap" aria-disabled={!nextGap || undefined} aria-label={nextGap ? `Siguiente sin completar: ${nextGap.name}` : "No queda otra ficha sin completar"} onClick={() => nextGap && open(nextGap.id, 1)}>
          {allDone ? "Todas completas" : nextGap ? "Siguiente sin completar" : "Es la última sin completar"}
        </button>
        <button type="button" className="vd-ibtn vd-glass vd-press" aria-label={next ? `Jugador siguiente: ${next.name}` : "Jugador siguiente"} aria-keyshortcuts="ArrowRight ArrowDown" aria-disabled={!next || undefined} onClick={() => next && open(next.id, 1)}>
          <Icon name="arrow" size={20} />
        </button>
        <span className="spl-fnav__k" aria-hidden="true">
          ← → o ↑ ↓ para pasar de jugador
        </span>
      </nav>
    </article>
  );
}

/** «Archivo 2025/26» (the archived seasons he played), or «una temporada que ya no existe». */
function archivedNames(p: PlayerDoc, seasons: readonly { id: string; name: string; archived?: boolean }[]): string {
  const names = (p.seasons ?? []).map((s) => seasons.find((x) => x.id === s)).filter((s): s is { id: string; name: string; archived?: boolean } => !!s?.archived).map((s) => s.name);
  return names.length ? names.join(", ") : "una temporada que ya no existe";
}

/** «Sancionado»: matches (1–10) or until a match of the calendar, and a reason (≤ 80), as the board's form. */
function SanctionBox({ name, editing, upcoming, onCancel, onSave }: { name: string; editing: boolean; upcoming: ReturnType<typeof usePlantilla>["upcoming"]; onCancel: () => void; onSave: (choice: Parameters<typeof sanctionToast>[1]) => void }) {
  const uid = useId();
  const [f, setF] = useState<SanctionForm>(() => sanctionForm(upcoming));
  const [err, setErr] = useState("");
  const set = <K extends keyof SanctionForm>(k: K, v: SanctionForm[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErr("");
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = checkSanction(f, upcoming);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    onSave(r.choice);
  };
  const title = editing ? `Cambiar la sanción de ${name}` : `Sanción de ${name}`;
  return (
    <form className="spl-sanc" aria-label={title} onSubmit={submit} noValidate>
      <p className="sc-h3">{title}</p>
      <div className="vd-seg vd-glass" role="group" aria-label="Cómo se cuenta la sanción" style={{ "--n": 2, "--i": f.mode === "until" ? 1 : 0 } as CSSProperties}>
        <span className="vd-shelf__bead" aria-hidden="true" />
        <button type="button" className="vd-seg__b" aria-pressed={f.mode === "games"} onClick={() => set("mode", "games")}>
          Partidos
        </button>
        <button type="button" className="vd-seg__b" aria-pressed={f.mode === "until"} aria-disabled={!upcoming.length || undefined} onClick={() => upcoming.length && set("mode", "until")}>
          Hasta la jornada
        </button>
      </div>
      {!upcoming.length && <small className="sc-small">No hay partidos programados: se cuenta por partidos.</small>}
      {f.mode === "games" ? (
        <label className="sc-field">
          <span>Partidos de sanción · de 1 a {SANCTION_LIMITS.games}</span>
          <input className="vd-input vd-glass" type="number" min={1} max={SANCTION_LIMITS.games} inputMode="numeric" value={f.games} onChange={(e) => set("games", e.currentTarget.value)} />
        </label>
      ) : (
        <label className="sc-field">
          <span>Hasta la jornada (incluida)</span>
          <select className="vd-input vd-glass" value={f.untilId} onChange={(e) => set("untilId", e.currentTarget.value)}>
            {upcoming.map((m) => (
              <option key={m.id} value={m.id}>
                {untilLabel(m)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="sc-field">
        <span>
          Motivo · opcional · {f.reason.length}/{SANCTION_LIMITS.reason}
        </span>
        <input className="vd-input vd-glass" type="text" maxLength={SANCTION_LIMITS.reason} value={f.reason} onChange={(e) => set("reason", e.currentTarget.value)} placeholder="Federación, roja en Copa…" />
      </label>
      {err && (
        <p className="spl-err" role="alert" id={`${uid}-e`}>
          {err}
        </p>
      )}
      <div className="sc-btnrow">
        <button type="submit" className="vd-btn vd-glass vd-press vd-btn--pri vd-btn--sm">
          Sancionar
        </button>
        <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
